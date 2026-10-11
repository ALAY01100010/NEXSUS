/* NEXSUS · Made by Alay */
import { app, BrowserWindow, WebContentsView, clipboard, dialog, ipcMain, shell, session } from 'electron';
import type { IpcMainEvent, IpcMainInvokeEvent, Session } from 'electron';
import { appendFileSync, mkdirSync } from 'node:fs';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Account } from '../shared/contracts.js';
import { getProvider, isProviderAuthUrlAllowed, isProviderNavigationAllowed, isProviderUrlAllowed, providers } from '../providers/registry.js';
import { getProviderAdapter } from '../providers/context-adapters.js';
import { LocalStore } from './store.js';
import { parseCapsuleDocument, toCapsuleDocument, toCapsuleMarkdown } from './capsules.js';
import { validateBrowserBounds, validateCapsule, validateId, validateProviderNavigation, validateText } from './ipc-validation.js';

const maxWarmViews = 3;
let mainWindow: BrowserWindow | null = null;
let store: LocalStore;
let activeAccountId: string | null = null;
let activeView: WebContentsView | null = null;
let overlayOpen = false;
let recoveringActiveView = false;
let lastBrowserBounds: { x: number; y: number; width: number; height: number } | null = null;
const accountViews = new Map<string, WebContentsView>();
const warmOrder: string[] = [];
const configuredSessions = new WeakSet<Session>();
const providerContexts = new Map<number, { accountId: string; provider: NonNullable<ReturnType<typeof getProvider>>; session: Session }>();
const providerAuthWindows = new Map<string, Set<BrowserWindow>>();
const hasSingleInstanceLock = app.requestSingleInstanceLock();

if (!hasSingleInstanceLock) app.quit();
else app.on('second-instance', () => {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
});

app.on('web-contents-created', (_event, contents) => {
  contents.setWindowOpenHandler(({ url }) => {
    const context = providerContexts.get(contents.id);
    if (!context || !isProviderAuthUrlAllowed(context.provider, url)) return { action: 'deny' };
    return {
      action: 'allow',
      overrideBrowserWindowOptions: {
        autoHideMenuBar: true,
        width: 520,
        height: 720,
        webPreferences: { session: context.session, contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true },
      },
    };
  });
  contents.on('did-create-window', (popup, details) => {
    const context = providerContexts.get(contents.id);
    if (!context || !isProviderAuthUrlAllowed(context.provider, details.url)) {
      popup.close();
      return;
    }
    providerContexts.set(popup.webContents.id, context);
    const windows = providerAuthWindows.get(context.accountId) ?? new Set<BrowserWindow>();
    windows.add(popup);
    providerAuthWindows.set(context.accountId, windows);
    popup.setMenuBarVisibility(false);
    popup.on('closed', () => {
      providerContexts.delete(popup.webContents.id);
      windows.delete(popup);
      if (!windows.size) providerAuthWindows.delete(context.accountId);
    });
  });
  contents.on('will-navigate', (event, url) => {
    if (contents === mainWindow?.webContents) {
      if (url !== trustedRendererUrl()) event.preventDefault();
      return;
    }
    const provider = providerForContents(contents);
    if (!provider || !isProviderNavigationAllowed(provider, url)) event.preventDefault();
  });
  contents.on('will-redirect', (event, url, _isInPlace, isMainFrame) => {
    if (!isMainFrame || contents === mainWindow?.webContents) return;
    const provider = providerForContents(contents);
    if (!provider || !isProviderNavigationAllowed(provider, url)) event.preventDefault();
  });
  contents.on('will-frame-navigate', (details) => {
    if (!details.isMainFrame || contents === mainWindow?.webContents) return;
    const provider = providerForContents(contents);
    if (!provider || !isProviderNavigationAllowed(provider, details.url)) details.preventDefault();
  });
});

function trustedRendererUrl(): string {
  return pathToFileURL(join(app.getAppPath(), 'dist', 'index.html')).href;
}

function assertTrustedSender(event: IpcMainInvokeEvent | IpcMainEvent): void {
  if (!mainWindow || event.sender !== mainWindow.webContents || event.senderFrame !== event.sender.mainFrame || event.senderFrame.url !== trustedRendererUrl()) {
    throw new Error('This request did not come from the NEXSUS application window.');
  }
}

function createMainWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 840,
    minHeight: 560,
    backgroundColor: '#101114',
    title: 'NEXSUS',
    icon: app.isPackaged ? join(process.resourcesPath, 'icon.ico') : join(app.getAppPath(), 'build', 'icon.ico'),
    show: false,
    webPreferences: {
      preload: join(import.meta.dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });

  mainWindow.once('ready-to-show', () => mainWindow?.show());
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (handleAccountShortcut(input)) event.preventDefault();
  });
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (url !== trustedRendererUrl()) event.preventDefault();
  });
  mainWindow.on('resize', updateActiveViewBounds);
  mainWindow.on('closed', () => {
    mainWindow = null;
    activeView = null;
    for (const view of accountViews.values()) {
      if (!view.webContents.isDestroyed()) view.webContents.close({ waitForBeforeUnload: false });
    }
    accountViews.clear();
    warmOrder.length = 0;
  });
  void mainWindow.loadFile(join(app.getAppPath(), 'dist', 'index.html'));
}

function configureSession(providerSession: Session): void {
  if (configuredSessions.has(providerSession)) return;
  configuredSessions.add(providerSession);
  providerSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
  providerSession.setPermissionCheckHandler(() => false);
}

function getOrCreateAccountView(account: Account): WebContentsView {
  const existing = accountViews.get(account.id);
  if (existing && !existing.webContents.isDestroyed()) return existing;
  const provider = getProvider(account.providerId);
  if (!provider) throw new Error('This account uses a provider that is not available in this version.');
  const partition = `persist:nexsus-account-${account.id}`;
  const providerSession = session.fromPartition(partition);
  configureSession(providerSession);
  const view = new WebContentsView({
    webPreferences: {
      session: providerSession,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });
  providerContexts.set(view.webContents.id, { accountId: account.id, provider, session: providerSession });
  if (lastBrowserBounds) view.setBounds(lastBrowserBounds);
  view.setVisible(false);
  recoveringActiveView = false;
  view.webContents.on('did-start-loading', () => sendBrowserState());
  view.webContents.on('did-stop-loading', () => sendBrowserState());
  const rememberUrl = (_event: unknown, url: string) => {
    if (isProviderUrlAllowed(provider, url)) store.setAccountLastUrl(account.id, url);
    sendBrowserState();
  };
  view.webContents.on('did-navigate', rememberUrl);
  view.webContents.on('did-navigate-in-page', rememberUrl);
  view.webContents.on('page-title-updated', () => sendBrowserState());
  view.webContents.on('did-fail-load', (_event, errorCode, _errorDescription, _validatedUrl, isMainFrame) => {
    if (isMainFrame && errorCode !== -3 && activeAccountId === account.id) sendBrowserState(`The ${provider.name} page could not be loaded. Check your internet connection or try again.`, false);
  });
  view.webContents.on('render-process-gone', () => markProviderViewUnresponsive(account.id, view, provider.name));
  view.webContents.on('unresponsive', () => markProviderViewUnresponsive(account.id, view, provider.name));
  view.webContents.on('responsive', () => {
    if (activeView !== view || activeAccountId !== account.id) return;
    recoveringActiveView = false;
    view.setVisible(!overlayOpen && view.getBounds().width > 0 && view.getBounds().height > 0);
    sendBrowserState();
  });
  view.webContents.on('before-input-event', (event, input) => {
    if (handleAccountShortcut(input)) event.preventDefault();
  });

  mainWindow?.contentView.addChildView(view);
  accountViews.set(account.id, view);
  warmOrder.push(account.id);
  const initialUrl = account.lastUrl && isProviderUrlAllowed(provider, account.lastUrl) ? account.lastUrl : provider.homepage;
  void view.webContents.loadURL(initialUrl);
  return view;
}

function providerForContents(contents: Electron.WebContents) {
  const context = providerContexts.get(contents.id);
  if (!context || !store?.listAccounts().some((item) => item.id === context.accountId)) return undefined;
  return context.provider;
}

function activateAccount(accountId: string): void {
  const account = store.listAccounts().find((item) => item.id === accountId);
  if (!account) throw new Error('This account no longer exists.');
  if (activeView) activeView.setVisible(false);
  activeAccountId = accountId;
  store.markAccountUsed(accountId);
  activeView = getOrCreateAccountView(account);
  activeView.setVisible(!overlayOpen);
  touchWarmOrder(accountId);
  updateActiveViewBounds();
  sendBrowserState();
  discardExcessViews();
}

function touchWarmOrder(accountId: string): void {
  const index = warmOrder.indexOf(accountId);
  if (index !== -1) warmOrder.splice(index, 1);
  warmOrder.push(accountId);
}

function discardExcessViews(): void {
  while (accountViews.size > maxWarmViews) {
    const oldest = warmOrder.shift();
    if (!oldest || oldest === activeAccountId) {
      if (oldest) warmOrder.push(oldest);
      break;
    }
    const view = accountViews.get(oldest);
    if (!view) continue;
    destroyAccountView(oldest);
  }
}

function destroyAccountView(accountId: string): void {
  for (const popup of providerAuthWindows.get(accountId) ?? []) popup.close();
  providerAuthWindows.delete(accountId);
  const view = accountViews.get(accountId);
  if (!view) return;
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.contentView.removeChildView(view);
  if (!view.webContents.isDestroyed()) view.webContents.close({ waitForBeforeUnload: false });
  providerContexts.delete(view.webContents.id);
  accountViews.delete(accountId);
  const index = warmOrder.indexOf(accountId);
  if (index !== -1) warmOrder.splice(index, 1);
  if (activeAccountId === accountId) activeView = null;
}

function setOverlayOpen(isOpen: boolean): void {
  overlayOpen = isOpen;
  if (!activeView || activeView.webContents.isDestroyed()) return;
  activeView.setVisible(!overlayOpen && activeView.getBounds().width > 0 && activeView.getBounds().height > 0);
}

function markProviderViewUnresponsive(accountId: string, view: WebContentsView, providerName: string): void {
  if (activeAccountId !== accountId || activeView !== view || view.webContents.isDestroyed()) return;
  recoveringActiveView = true;
  view.setVisible(false);
  sendBrowserState(`${providerName} stopped responding.`, true);
}

function recoverActiveView(): void {
  if (!recoveringActiveView || !activeAccountId) {
    if (activeView?.webContents.isLoading()) activeView.webContents.stop();
    else activeView?.webContents.reload();
    return;
  }
  const accountId = activeAccountId;
  const account = store.listAccounts().find((item) => item.id === accountId);
  if (!account) return;
  destroyAccountView(accountId);
  const view = getOrCreateAccountView(account);
  activeView = view;
  activeView.setVisible(!overlayOpen);
  touchWarmOrder(accountId);
  updateActiveViewBounds();
  sendBrowserState();
}

function handleAccountShortcut(input: { type: string; control: boolean; meta: boolean; shift: boolean; key: string }): boolean {
  if (input.type !== 'keyDown' || (!input.control && !input.meta) || !store) return false;
  const accounts = store.listAccounts();
  if (input.key === 'Tab' && accounts.length > 1) {
    const current = accounts.findIndex((account) => account.id === activeAccountId);
    const direction = input.shift ? -1 : 1;
    activateAccount(accounts[(current + direction + accounts.length) % accounts.length]!.id);
    return true;
  }
  if (!input.shift && /^[1-9]$/.test(input.key)) {
    const account = accounts[Number(input.key) - 1];
    if (!account) return false;
    activateAccount(account.id);
    return true;
  }
  return false;
}

function updateActiveViewBounds(): void {
  if (!activeView || activeView.webContents.isDestroyed() || !mainWindow) return;
  const bounds = mainWindow.getContentBounds();
  const current = activeView.getBounds();
  if (current.width <= 0 || current.height <= 0) {
    activeView.setVisible(false);
    return;
  }
  activeView.setBounds({ x: Math.max(0, current.x), y: Math.max(0, current.y), width: Math.max(0, Math.min(current.width, bounds.width)), height: Math.max(0, Math.min(current.height, bounds.height - Math.max(0, current.y))) });
}

function sendBrowserState(error: string | null = null, recoveryAvailable = false): void {
  if (!mainWindow) return;
  if (!activeView || activeView.webContents.isDestroyed()) {
    mainWindow.webContents.send('browser:state', { url: '', title: '', loading: false, canGoBack: false, canGoForward: false, error, recoveryAvailable });
    return;
  }
  mainWindow.webContents.send('browser:state', {
    url: activeView.webContents.getURL(),
    title: activeView.webContents.getTitle(),
    loading: activeView.webContents.isLoading(),
    canGoBack: activeView.webContents.navigationHistory.canGoBack(),
    canGoForward: activeView.webContents.navigationHistory.canGoForward(),
    error,
    recoveryAvailable,
  });
}

function validateForActiveProvider(raw: unknown): string {
  const account = store.listAccounts().find((item) => item.id === activeAccountId);
  const provider = account ? getProvider(account.providerId) : undefined;
  if (!provider) throw new Error('Choose an account before navigating.');
  return validateProviderNavigation(raw, provider);
}

function listen(channel: string, handler: (event: IpcMainEvent, ...args: unknown[]) => void): void {
  ipcMain.on(channel, (event, ...args) => {
    try {
      assertTrustedSender(event);
      handler(event, ...args);
    } catch (error) {
      sendAppError(error);
    }
  });
}

function handle(channel: string, handler: (...args: unknown[]) => unknown | Promise<unknown>): void {
  ipcMain.handle(channel, async (event, ...args: unknown[]) => {
    assertTrustedSender(event);
    return handler(...args);
  });
}

function emit(channel: string): void { mainWindow?.webContents.send(channel); }
function sendAppError(error: unknown): void {
  const message = error instanceof Error ? error.message : 'Something went wrong. Please try again.';
  mainWindow?.webContents.send('app:error', message);
}

function reportStartupFailure(error: unknown): void {
  const message = error instanceof Error ? `${error.name}: ${error.message}\n${error.stack ?? ''}` : String(error);
  console.error('NEXSUS startup failed:', message);
  try {
    const logDirectory = join(app.getPath('userData'), 'logs');
    mkdirSync(logDirectory, { recursive: true });
    appendFileSync(join(logDirectory, 'nexsus.log'), `${new Date().toISOString()} ${message}\n`, 'utf8');
  } catch (logError) {
    console.error('Could not write the NEXSUS startup diagnostic.', logError);
  }
  dialog.showErrorBox('NEXSUS could not start', `${error instanceof Error ? error.message : 'An unexpected error occurred.'}\n\nA technical diagnostic was saved in the local NEXSUS data folder.`);
}

function registerIpc(): void {
  handle('providers:list', () => providers);
  handle('accounts:list', () => store.listAccounts());
  handle('accounts:create', (providerId, displayName) => {
    const account = store.createAccount(validateText(providerId, 'Provider', 40), validateText(displayName, 'Account name', 60));
    emit('accounts:changed');
    return account;
  });
  handle('accounts:rename', (id, displayName) => {
    const account = store.renameAccount(validateId(id), validateText(displayName, 'Account name', 60));
    emit('accounts:changed');
    return account;
  });
  handle('accounts:remove', async (id) => {
    const accountId = validateId(id);
    const partition = store.getAccountSessionPartition(accountId);
    const wasActive = activeAccountId === accountId;
    destroyAccountView(accountId);
    if (wasActive) activeAccountId = null;
    const providerSession = session.fromPartition(partition);
    try {
      await providerSession.clearStorageData();
      await providerSession.clearCache();
      providerSession.flushStorageData();
      store.removeAccount(accountId);
    } catch (error) {
      if (wasActive) activateAccount(accountId);
      throw error;
    }
    recoveringActiveView = false;
    sendBrowserState();
    emit('accounts:changed');
  });
  handle('accounts:activate', (id) => activateAccount(validateId(id)));
  handle('accounts:favorite', (id, isFavorite) => {
    if (typeof isFavorite !== 'boolean') throw new Error('Favorite setting is invalid.');
    const account = store.setAccountFavorite(validateId(id), isFavorite);
    emit('accounts:changed');
    return account;
  });
  handle('accounts:move', (id, direction) => {
    if (direction !== -1 && direction !== 1) throw new Error('Account ordering request is invalid.');
    store.moveAccount(validateId(id), direction);
    emit('accounts:changed');
  });
  handle('accounts:clear-session', async (id) => {
    const accountId = validateId(id);
    const account = store.listAccounts().find((item) => item.id === accountId);
    if (!account) throw new Error('This account no longer exists.');
    const provider = getProvider(account.providerId);
    if (!provider) throw new Error('This account uses a provider that is not available in this version.');
    const providerSession = session.fromPartition(store.getAccountSessionPartition(accountId));
    const wasActive = activeAccountId === accountId;
    destroyAccountView(accountId);
    try {
      await providerSession.clearStorageData();
      await providerSession.clearCache();
      providerSession.flushStorageData();
      store.setAccountLastUrl(accountId, provider.homepage);
    } finally {
      recoveringActiveView = false;
      if (wasActive) {
        const refreshed = store.listAccounts().find((item) => item.id === accountId);
        if (refreshed) {
          activeView = getOrCreateAccountView(refreshed);
          activeView.setVisible(!overlayOpen);
          updateActiveViewBounds();
        }
      }
      sendBrowserState();
    }
  });

  handle('capsules:list', () => store.listCapsules());
  handle('capsules:versions', (id) => store.listCapsuleVersions(validateId(id)));
  handle('capsules:create-version', (id, input) => {
    const capsule = store.createCapsuleVersion(validateId(id), validateCapsule(input));
    emit('capsules:changed');
    return capsule;
  });
  handle('capsules:restore-version', (id) => {
    const capsule = store.restoreCapsuleVersion(validateId(id));
    emit('capsules:changed');
    return capsule;
  });
  handle('capsules:create', (input) => {
    const capsule = store.createCapsule(validateCapsule(input));
    emit('capsules:changed');
    return capsule;
  });
  handle('capsules:update', (id, input) => {
    const capsule = store.updateCapsule(validateId(id), validateCapsule(input));
    emit('capsules:changed');
    return capsule;
  });
  handle('capsules:remove', (id) => {
    store.removeCapsule(validateId(id));
    emit('capsules:changed');
  });
  handle('capsules:duplicate', (id) => {
    const capsule = store.duplicateCapsule(validateId(id));
    emit('capsules:changed');
    return capsule;
  });
  handle('capsules:copy', (id) => {
    const capsule = store.getCapsule(validateId(id));
    if (!capsule) throw new Error('This capsule no longer exists.');
    clipboard.writeText(toCapsuleMarkdown(capsule));
  });
  handle('capsules:export', async (id) => {
    const capsule = store.getCapsule(validateId(id));
    if (!capsule || !mainWindow) throw new Error('This capsule no longer exists.');
    const result = await dialog.showSaveDialog(mainWindow, {
      defaultPath: `${safeFileName(capsule.title)}.json`,
      filters: [{ name: 'Context Capsule', extensions: ['json', 'md'] }],
    });
    if (result.canceled || !result.filePath) return;
    const extension = result.filePath.toLowerCase().endsWith('.md') ? 'md' : 'json';
    const data = extension === 'md' ? toCapsuleMarkdown(capsule, app.getVersion()) : `${JSON.stringify(toCapsuleDocument(capsule, app.getVersion()), null, 2)}\n`;
    await writeFile(result.filePath, data, 'utf8');
  });
  handle('capsules:import', async () => {
    if (!mainWindow) return null;
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [{ name: 'Context Capsule', extensions: ['json', 'md', 'markdown'] }],
    });
    const path = result.filePaths[0];
    if (result.canceled || !path) return null;
    if ((await stat(path)).size > 1_000_000) throw new Error('This capsule file is larger than 1 MB.');
    const source = await readFile(path, 'utf8');
    const capsule = store.createCapsule(parseCapsuleDocument(source));
    emit('capsules:changed');
    return capsule;
  });
  handle('browser:extract-capsule', async () => {
    if (!activeAccountId || !activeView || activeView.webContents.isDestroyed()) throw new Error('Open a provider conversation before extracting a capsule.');
    const account = store.listAccounts().find((item) => item.id === activeAccountId);
    const provider = account ? getProvider(account.providerId) : undefined;
    const adapter = account ? getProviderAdapter(account.providerId) : undefined;
    const currentUrl = activeView.webContents.getURL();
    if (!account || !provider || !adapter || !provider.capabilities.extractContext || !adapter.canExtractContext(currentUrl)) {
      throw new Error(provider ? `Open a ${provider.name} conversation to extract a capsule.` : 'Choose a supported provider account before extracting a capsule.');
    }
    const rawSnapshot: unknown = await activeView.webContents.executeJavaScript(adapter.buildConversationReadScript(), true);
    if (!rawSnapshot || typeof rawSnapshot !== 'object' || Array.isArray(rawSnapshot)) throw new Error(`${provider.name} did not return a readable conversation snapshot.`);
    const snapshot = rawSnapshot as { url?: unknown; title?: unknown; turns?: unknown; attachments?: unknown; truncated?: unknown };
    if (typeof snapshot.url !== 'string' || typeof snapshot.title !== 'string' || !Array.isArray(snapshot.turns)) throw new Error(`${provider.name}’s conversation structure was not recognized. Try refreshing the page.`);
    const safeUrl = new URL(currentUrl);
    safeUrl.search = '';
    safeUrl.hash = '';
    return adapter.extractConversationContext({ url: snapshot.url, title: snapshot.title, turns: snapshot.turns as { role: 'user' | 'assistant'; text: string }[], attachments: Array.isArray(snapshot.attachments) ? snapshot.attachments as { filename: string; mimeType?: string; size?: number }[] : [], truncated: snapshot.truncated === true }, {
      providerId: provider.id, providerName: provider.name, accountId: account.id, accountName: account.displayName,
      conversationUrl: `${safeUrl.origin}${safeUrl.pathname}`.slice(0, 2048), extractedAt: new Date().toISOString(),
    });
  });
  handle('capsules:inject', async (id, accountId) => {
    const capsule = store.getCapsule(validateId(id));
    const targetId = validateId(accountId);
    const account = store.listAccounts().find((item) => item.id === targetId);
    const adapter = account ? getProviderAdapter(account.providerId) : undefined;
    if (!capsule || !account) throw new Error('Choose a valid capsule and destination account.');
    if (!adapter || !getProvider(account.providerId)?.capabilities.injectCapsule) throw new Error(`Capsule injection is not implemented for ${account.providerName} yet.`);
    activateAccount(targetId);
    const view = activeView;
    if (!view || view.webContents.isDestroyed()) throw new Error('The destination provider view is not available.');
    if (view.webContents.isLoadingMainFrame()) await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => { cleanup(); reject(new Error('The destination provider did not finish loading.')); }, 20_000);
      const done = () => { cleanup(); resolve(); };
      const cleanup = () => { clearTimeout(timer); view.webContents.removeListener('did-finish-load', done); view.webContents.removeListener('destroyed', destroyed); };
      const destroyed = () => { cleanup(); reject(new Error('The destination provider view was closed.')); };
      view.webContents.once('did-finish-load', done);
      view.webContents.once('destroyed', destroyed);
    });
    const url = view.webContents.getURL();
    if (!adapter.canInjectContext(url)) throw new Error(`Open a ${adapter.name} conversation before injecting a capsule.`);
    const context = toCapsuleMarkdown(capsule, app.getVersion());
    const result = await adapter.injectContext(context, (script) => view.webContents.executeJavaScript(script, true));
    if (result === 'missing') throw new Error(`Could not find ${adapter.name}’s message composer. The provider page may have changed.`);
    if (result === 'occupied') throw new Error(`${adapter.name}’s message composer already contains a draft. Clear or copy that draft before injecting.`);
    if (result !== 'inserted') throw new Error(`${adapter.name} did not accept the capsule in its composer.`);
  });

  listen('browser:back', () => { if (activeView?.webContents.navigationHistory.canGoBack()) activeView.webContents.navigationHistory.goBack(); });
  listen('browser:forward', () => { if (activeView?.webContents.navigationHistory.canGoForward()) activeView.webContents.navigationHistory.goForward(); });
  listen('browser:stop', () => activeView?.webContents.stop());
  listen('browser:navigate', (_event, raw) => {
    if (!activeView) return;
    try { void activeView.webContents.loadURL(validateForActiveProvider(raw)); }
    catch (error) { sendAppError(error); }
  });
  listen('browser:open-external', () => {
    const url = activeView?.webContents.getURL();
    if (url && activeAccountId) {
      const account = store.listAccounts().find((item) => item.id === activeAccountId);
      const provider = account ? getProvider(account.providerId) : undefined;
      if (provider && isProviderUrlAllowed(provider, url)) void shell.openExternal(url);
    }
  });
  listen('browser:overlay', (_event, value) => {
    if (typeof value !== 'boolean') return;
    setOverlayOpen(value);
  });
  listen('browser:bounds', (_event, value) => {
    if (!activeView || !mainWindow) return;
    const viewport = mainWindow.getContentBounds();
    const bounds = validateBrowserBounds(value, viewport);
    if (!bounds) return;
    lastBrowserBounds = bounds;
    activeView.setBounds(bounds);
    activeView.setVisible(!overlayOpen && bounds.width > 0 && bounds.height > 0);
  });

  listen('browser:reload', () => recoverActiveView());
}

let shutdownStarted = false;

if (hasSingleInstanceLock) app.whenReady().then(async () => {
  app.setAppUserModelId('org.nexsus.desktop');
  const appData = app.getPath('userData');
  await mkdir(appData, { recursive: true });
  const { DatabaseSync } = await import('node:sqlite');
  store = new LocalStore(new DatabaseSync(join(appData, 'nexsus.sqlite')));
  registerIpc();
  createMainWindow();
  const rememberedAccountId = store.getActiveAccountId();
  if (rememberedAccountId && store.listAccounts().some((account) => account.id === rememberedAccountId)) activateAccount(rememberedAccountId);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
      if (activeAccountId) activateAccount(activeAccountId);
    }
  });
}).catch(reportStartupFailure);

app.on('before-quit', () => {
  if (shutdownStarted) return;
  shutdownStarted = true;
  if (store) {
    for (const account of store.listAccounts()) {
      try { session.fromPartition(`persist:nexsus-account-${account.id}`).flushStorageData(); } catch { /* A session that never opened has nothing to flush. */ }
    }
  }
  for (const view of accountViews.values()) {
    if (!view.webContents.isDestroyed()) view.webContents.close({ waitForBeforeUnload: false });
  }
  accountViews.clear();
  store?.close();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

function safeFileName(name: string): string {
  return name.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-').trim().slice(0, 80) || 'context-capsule';
}
