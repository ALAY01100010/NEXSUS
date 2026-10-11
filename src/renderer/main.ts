/* NEXSUS · Made by Alay */
import type { Account, Capsule, CapsuleInput, CapsuleExtraction } from '../shared/contracts';
import type { ProviderDefinition } from '../providers/types';
import { BRAND } from './brand.js';

const root = document.querySelector<HTMLDivElement>('#root');
if (!root) throw new Error('NEXSUS renderer root was not found.');
document.documentElement.style.setProperty('--accent', BRAND.accent);
document.documentElement.style.setProperty('--accent-deep', BRAND.accentDeep);
document.documentElement.style.setProperty('--accent-hover', BRAND.accentHover);
document.documentElement.style.setProperty('--accent-line', BRAND.accentLine);

root.innerHTML = `
  <div class="app-shell">
    <aside class="sidebar" id="sidebar">
      <div class="brand-row"><img class="brand-logo" src="${BRAND.logoAssetPath}" alt="NEXSUS emblem"><span class="brand-name">NEXSUS</span><button class="icon-button sidebar-toggle" id="sidebar-toggle" aria-label="Collapse sidebar" title="Collapse sidebar">${icon('panel-left')}</button></div>
      <label class="search-box">${icon('search')}<input id="global-search" type="search" placeholder="Search anything" autocomplete="off"><kbd>⌘ K</kbd></label>
      <div class="collapsed-rail" id="collapsed-rail"></div>
      <div class="sidebar-scroll">
        <div class="section-heading"><span>ACCOUNTS</span><button class="icon-button small" id="add-account" aria-label="Add account">${icon('plus')}</button></div>
        <div id="account-list" class="account-list"></div>
        <button class="add-row" id="add-account-row">${icon('plus')}<span>Add account</span></button>
        <div class="section-heading capsule-heading"><button class="section-link" id="open-capsule-hub">CAPSULE HUB</button><button class="icon-button small" id="add-capsule" aria-label="Create capsule" title="New capsule">${icon('plus')}</button></div>
        <div id="capsule-list" class="capsule-list"></div>
        <button class="add-row" id="import-capsule">${icon('download')}<span>Import capsule</span></button>
      </div>
      <div class="sidebar-footer"><div class="privacy-note">${icon('shield')}<span>Your sessions stay on this device</span></div><button class="settings-row" id="settings">${icon('settings')}<span>Settings & About</span></button><div class="version">NEXSUS <span>v${escapeHtml(window.nexsus.version)}</span></div><div class="brand-credit">Made by Alay <span>• NEXSUS</span></div></div>
      <div class="resize-handle" id="resize-handle" aria-hidden="true"></div>
    </aside>
    <main class="main-panel">
      <header class="browser-toolbar">
        <div class="nav-controls"><button class="icon-button" id="browser-back" aria-label="Back" disabled>${icon('back')}</button><button class="icon-button" id="browser-forward" aria-label="Forward" disabled>${icon('forward')}</button><button class="icon-button" id="browser-reload" aria-label="Reload">${icon('reload')}</button></div>
        <div class="address-wrap">${icon('lock')}<input id="address" type="text" spellcheck="false" placeholder="Choose an account to begin" aria-label="Current website address"></div>
        <button class="icon-button" id="open-external" aria-label="Open website externally" title="Open externally">${icon('external')}</button>
        <button class="primary-button extract-button" id="extract-capsule" title="Extract useful context from this visible conversation">${icon('capsule')}<span>Extract Capsule</span></button>
        <div class="toolbar-divider"></div>
        <div class="active-account-label" id="active-label">No account selected</div>
      </header>
      <section class="browser-surface" id="browser-surface">
        <div class="welcome-state" id="welcome-state">
          <div class="welcome-orbit"><div class="orbit-dot one"></div><div class="orbit-dot two"></div><div class="orbit-center"><img src="${BRAND.logoAssetPath}" alt="NEXSUS emblem"></div></div>
          <div class="welcome-kicker">YOUR AI WORKSPACE</div>
          <h1>Every account,<br><span>in its own space.</span></h1>
          <p>Bring your AI accounts together. Your sessions stay private on this device, and you keep using the providers you know.</p>
          <button class="primary-button" id="welcome-add">${icon('plus')}Add your first account</button>
          <div class="provider-hints" id="provider-hints"></div>
          <div class="welcome-credit">Made by Alay</div>
        </div>
        <div class="capsule-view hidden" id="capsule-view"></div>
        <div class="browser-error hidden" id="browser-error" role="alert"><div class="modal-kicker">BROWSER RECOVERY</div><h2 id="browser-error-message">The provider stopped responding.</h2><p>Your saved sign-in session is still on this device.</p><button class="primary-button" id="browser-error-reload">${icon('reload')}Reload</button></div>
        <div class="toast" id="toast" role="status"></div>
      </section>
    </main>
  </div>
  <dialog class="modal" id="account-dialog"><form id="account-form" method="dialog"><div class="modal-top"><div><div class="modal-kicker">NEW WORKSPACE</div><h2>Add an account</h2></div><button class="icon-button" type="button" data-close aria-label="Close">${icon('close')}</button></div><label class="field-label" for="provider">AI provider</label><select id="provider" name="provider"></select><label class="field-label" for="account-name">Account name</label><input id="account-name" name="name" maxlength="60" placeholder="Personal, Work, Research…" required><p class="form-note">A private browser profile will be created for this account. Sign in directly with your provider; NEXSUS never handles your password.</p><div class="modal-actions"><button class="secondary-button" type="button" data-close>Cancel</button><button class="primary-button" type="submit">Continue</button></div></form></dialog>
  <dialog class="modal" id="rename-dialog"><form id="rename-form" method="dialog"><div class="modal-top"><div><div class="modal-kicker">ACCOUNT SETTINGS</div><h2>Rename account</h2></div><button class="icon-button" type="button" data-close aria-label="Close">${icon('close')}</button></div><input type="hidden" name="id"><label class="field-label" for="rename-name">Account name</label><input id="rename-name" name="name" maxlength="60" required><div class="modal-actions"><button class="secondary-button" type="button" data-close>Cancel</button><button class="primary-button" type="submit">Save name</button></div></form></dialog>
  <dialog class="modal" id="account-picker-dialog"><form id="account-picker-form" method="dialog"><div class="modal-top"><div><div class="modal-kicker">CAPSULE INJECTION</div><h2>Inject Capsule</h2></div><button class="icon-button" type="button" data-close aria-label="Close">${icon('close')}</button></div><input type="hidden" name="capsuleId"><div id="inject-preview" class="inject-preview"></div><label class="field-label" for="target-account">Target provider account</label><select id="target-account" name="accountId"></select><p class="form-note">The context will be inserted into the provider composer for your review. NEXSUS will not send it.</p><div class="modal-actions"><button class="secondary-button" type="button" data-close>Cancel</button><button class="primary-button" type="submit">Review & Inject</button></div></form></dialog>
  <dialog class="modal capsule-modal" id="capsule-dialog"><form id="capsule-form" method="dialog"><div class="modal-top"><div><div class="modal-kicker">MANUAL CONTEXT TRANSFER</div><h2 id="capsule-dialog-title">New capsule</h2></div><button class="icon-button" type="button" data-close aria-label="Close">${icon('close')}</button></div><p class="form-note hidden" id="extraction-note">Built from recognizable messages in the visible provider conversation. Review and edit the extracted fields before saving.</p><input type="hidden" name="id"><label class="field-label">Title</label><input name="title" maxlength="120" placeholder="Project or topic" required><label class="field-label">Objective</label><textarea name="objective" rows="2" placeholder="What are you trying to accomplish?"></textarea><label class="field-label">Summary</label><textarea name="summary" rows="4" placeholder="Important context to bring into another conversation"></textarea><label class="field-label">Current state</label><textarea name="currentState" rows="3" placeholder="What is true now? What remains in progress?"></textarea><div class="field-grid"><label><span class="field-label">Decisions</span><textarea name="decisions" rows="3" placeholder="One per line"></textarea></label><label><span class="field-label">Constraints</span><textarea name="constraints" rows="3" placeholder="One per line"></textarea></label><label><span class="field-label">Completed</span><textarea name="completed" rows="3" placeholder="One per line"></textarea></label><label><span class="field-label">Pending</span><textarea name="pending" rows="3" placeholder="One per line"></textarea></label></div><label class="field-label">Next action</label><input name="nextAction" maxlength="1000" placeholder="The most useful next step"><label class="field-label">Technical context · JSON</label><textarea name="technicalContext" rows="3" placeholder='{"runtime":"Node.js"}'></textarea><label class="field-label">Files</label><textarea name="files" rows="2" placeholder="One path per line"></textarea><label class="field-label">Conversation excerpt</label><textarea name="conversationExcerpt" rows="3"></textarea><div class="modal-actions"><button class="secondary-button" type="button" data-close>Cancel</button><button class="primary-button" type="submit" id="capsule-save">Save capsule</button></div></form></dialog>
  <dialog class="modal" id="settings-dialog"><form method="dialog"><div class="modal-top"><div><div class="modal-kicker">PREFERENCES & ABOUT</div><h2>Settings</h2></div><button class="icon-button" type="button" data-close aria-label="Close">${icon('close')}</button></div><div class="settings-copy"><div class="settings-row-static"><span>Privacy</span><strong>Local only</strong></div><p>Account sessions and capsule data are stored in your local application data folder. NEXSUS has no cloud account or telemetry.</p><div class="settings-row-static"><span>Application version</span><strong>${escapeHtml(window.nexsus.version)}</strong></div><div class="settings-row-static"><span>Provider support</span><strong id="provider-support"></strong></div><div class="about-card"><img src="${BRAND.logoAssetPath}" alt="NEXSUS emblem"><div><strong>NEXSUS</strong><span>Made by Alay</span></div></div><button class="secondary-button about-open" type="button" id="open-about">About NEXSUS</button></div><div class="modal-actions"><button class="primary-button" type="submit">Done</button></div></form></dialog>
  <dialog class="modal" id="about-dialog"><div class="about-dialog"><button class="icon-button about-close" id="about-close" aria-label="Close About" data-close>${icon('close')}</button><img src="${BRAND.logoAssetPath}" alt="NEXSUS emblem"><div class="modal-kicker">LOCAL AI WORKSPACE</div><h2>NEXSUS</h2><p>All your AI accounts. One workspace.</p><strong>Made by Alay</strong><span>Version ${escapeHtml(window.nexsus.version)}</span></div></dialog>
  <dialog class="modal" id="confirm-dialog"><form method="dialog"><div class="modal-top"><div><div class="modal-kicker">CONFIRM ACTION</div><h2>Are you sure?</h2></div><button class="icon-button" type="button" data-close aria-label="Close">${icon('close')}</button></div><p class="form-note" id="confirm-message"></p><div class="modal-actions"><button class="secondary-button" type="submit" value="cancel">Cancel</button><button class="primary-button" type="submit" value="confirm" id="confirm-accept">Confirm</button></div></form></dialog>
`;

let accounts: Account[] = [];
let capsules: Capsule[] = [];
let providerDefinitions: ProviderDefinition[] = [];
let activeAccountId: string | null = null;
let activeCapsuleId: string | null = null;
let capsuleHubOpen = false;
let editorSource: CapsuleInput['source'] = null;
let editorAttachments: NonNullable<CapsuleInput['attachments']> = [];
let editorVersionOfId: string | null = null;
let toastTimer: number | undefined;

const accountList = byId<HTMLDivElement>('account-list');
const collapsedRail = byId<HTMLDivElement>('collapsed-rail');
const capsuleList = byId<HTMLDivElement>('capsule-list');
const capsuleView = byId<HTMLDivElement>('capsule-view');
const browserSurface = byId<HTMLElement>('browser-surface');
const searchInput = byId<HTMLInputElement>('global-search');

void refresh();
window.nexsus.onAccountsChanged(() => void refreshAccounts());
window.nexsus.onCapsulesChanged(() => void refreshCapsules());
window.nexsus.browser.onState((state) => {
  byId<HTMLInputElement>('address').value = state.url;
  byId<HTMLButtonElement>('browser-back').disabled = !state.canGoBack;
  byId<HTMLButtonElement>('browser-forward').disabled = !state.canGoForward;
  byId<HTMLButtonElement>('browser-reload').innerHTML = icon(state.loading ? 'stop' : 'reload');
  byId<HTMLButtonElement>('browser-reload').setAttribute('aria-label', state.loading ? 'Stop loading' : 'Reload');
  const activeProvider = providerDefinitions.find((provider) => provider.id === accounts.find((account) => account.id === activeAccountId)?.providerId);
  const extractButton = byId<HTMLButtonElement>('extract-capsule');
  extractButton.disabled = !state.url || state.loading || !activeProvider?.capabilities.extractContext;
  extractButton.title = activeProvider?.capabilities.extractContext ? 'Extract useful context from this visible conversation' : 'Choose an account with capsule extraction support';
  const recovery = byId<HTMLDivElement>('browser-error');
  recovery.classList.toggle('hidden', !state.recoveryAvailable);
  if (state.error && state.recoveryAvailable) byId('browser-error-message').textContent = state.error;
  else if (state.error) notify(state.error);
});
window.nexsus.onError(notify);
window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason;
  notify(reason instanceof Error ? reason.message : 'Something went wrong. Please try again.');
});

byId('add-account').addEventListener('click', openAccountDialog);
byId('add-account-row').addEventListener('click', openAccountDialog);
byId('welcome-add').addEventListener('click', openAccountDialog);
byId('add-capsule').addEventListener('click', () => openCapsuleDialog());
byId('open-capsule-hub').addEventListener('click', openCapsuleHub);
byId('import-capsule').addEventListener('click', () => void importCapsule());
byId('extract-capsule').addEventListener('click', () => void extractCapsule());
byId('settings').addEventListener('click', () => showDialog(byId<HTMLDialogElement>('settings-dialog')));
byId('open-about').addEventListener('click', () => showDialog(byId<HTMLDialogElement>('about-dialog')));
byId('browser-error-reload').addEventListener('click', () => window.nexsus.browser.reload());
byId('browser-back').addEventListener('click', () => window.nexsus.browser.back());
byId('browser-forward').addEventListener('click', () => window.nexsus.browser.forward());
byId('browser-reload').addEventListener('click', () => window.nexsus.browser.reload());
byId('open-external').addEventListener('click', () => window.nexsus.browser.openExternally());
byId<HTMLInputElement>('address').addEventListener('keydown', (event) => {
  if (event.key === 'Enter') window.nexsus.browser.navigate((event.currentTarget as HTMLInputElement).value);
});
byId<HTMLButtonElement>('sidebar-toggle').addEventListener('click', () => {
  const collapsed = document.body.classList.toggle('sidebar-collapsed');
  localStorage.setItem('nexsus.sidebarCollapsed', String(collapsed));
  requestAnimationFrame(updateBrowserBounds);
});
if (localStorage.getItem('nexsus.sidebarCollapsed') === 'true') document.body.classList.add('sidebar-collapsed');
new ResizeObserver(updateBrowserBounds).observe(browserSurface);
window.addEventListener('resize', updateBrowserBounds);

const resizeHandle = byId<HTMLDivElement>('resize-handle');
resizeHandle.addEventListener('pointerdown', (event) => {
  event.preventDefault();
  resizeHandle.setPointerCapture(event.pointerId);
  const move = (pointer: PointerEvent) => {
    const width = Math.min(380, Math.max(220, pointer.clientX));
    document.documentElement.style.setProperty('--sidebar-width', `${width}px`);
    localStorage.setItem('nexsus.sidebarWidth', String(width));
    updateBrowserBounds();
  };
  const end = () => {
    resizeHandle.removeEventListener('pointermove', move);
    resizeHandle.removeEventListener('pointerup', end);
  };
  resizeHandle.addEventListener('pointermove', move);
  resizeHandle.addEventListener('pointerup', end);
});
const savedWidth = Number(localStorage.getItem('nexsus.sidebarWidth'));
if (savedWidth >= 220 && savedWidth <= 380) document.documentElement.style.setProperty('--sidebar-width', `${savedWidth}px`);

searchInput.addEventListener('input', () => renderLists(searchInput.value.trim().toLowerCase()));
document.addEventListener('keydown', (event) => {
  if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'a') {
    event.preventDefault();
    openAccountDialog();
  }
  if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'c') {
    event.preventDefault();
    openCapsuleDialog();
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault();
    searchInput.focus();
    searchInput.select();
  }
  if ((event.ctrlKey || event.metaKey) && event.key === 'Tab' && accounts.length > 1) {
    event.preventDefault();
    const currentIndex = accounts.findIndex((account) => account.id === activeAccountId);
    const direction = event.shiftKey ? -1 : 1;
    const nextIndex = (currentIndex + direction + accounts.length) % accounts.length;
    void activateAccount(accounts[nextIndex]!.id);
  }
  if ((event.ctrlKey || event.metaKey) && /^[1-9]$/.test(event.key)) {
    const account = accounts[Number(event.key) - 1];
    if (account) {
      event.preventDefault();
      void activateAccount(account.id);
    }
  }
  if (event.key === 'Escape') {
    activeCapsuleId = null;
    capsuleHubOpen = false;
    capsuleView.classList.add('hidden');
    const account = accounts.find((item) => item.id === activeAccountId);
    byId('active-label').textContent = account ? `${account.providerName} · ${account.displayName}` : 'No account selected';
    renderLists(searchInput.value.trim().toLowerCase());
    syncNativeOverlay();
  }
});

for (const dialog of document.querySelectorAll<HTMLDialogElement>('dialog')) {
  dialog.querySelectorAll<HTMLButtonElement>('[data-close]').forEach((button) => button.addEventListener('click', () => dialog.close()));
  dialog.addEventListener('close', syncNativeOverlay);
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
}

byId<HTMLFormElement>('account-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget as HTMLFormElement;
  const data = new FormData(form);
  const account = await window.nexsus.accounts.create(String(data.get('provider')), String(data.get('name')).trim());
  byId<HTMLDialogElement>('account-dialog').close();
  form.reset();
  await refreshAccounts();
  await activateAccount(account.id);
});

byId<HTMLFormElement>('capsule-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget as HTMLFormElement;
  const data = new FormData(form);
  let technicalContext: Record<string, unknown> = {};
  const technicalContextSource = String(data.get('technicalContext')).trim();
  if (technicalContextSource) {
    try {
      const parsed: unknown = JSON.parse(technicalContextSource);
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) throw new Error();
      technicalContext = parsed as Record<string, unknown>;
    } catch {
      notify('Technical context must be a JSON object');
      return;
    }
  }
  const input: CapsuleInput = {
    title: String(data.get('title')).trim(), objective: String(data.get('objective')).trim(), summary: String(data.get('summary')).trim(), currentState: String(data.get('currentState')).trim(),
    decisions: lines(String(data.get('decisions'))), constraints: lines(String(data.get('constraints'))), completed: lines(String(data.get('completed'))), pending: lines(String(data.get('pending'))), nextAction: String(data.get('nextAction')).trim(),
    technicalContext, files: lines(String(data.get('files'))), conversationExcerpt: String(data.get('conversationExcerpt')).trim(),
    source: editorSource, attachments: editorAttachments,
  };
  const id = String(data.get('id'));
  const capsule = id ? await window.nexsus.capsules.update(id, input) : editorVersionOfId ? await window.nexsus.capsules.createVersion(editorVersionOfId, input) : await window.nexsus.capsules.create(input);
  byId<HTMLDialogElement>('capsule-dialog').close();
  form.reset();
  await refreshCapsules();
  openCapsule(capsule.id);
  notify('Capsule saved');
});

byId<HTMLFormElement>('rename-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget as HTMLFormElement;
  const data = new FormData(form);
  await window.nexsus.accounts.rename(String(data.get('id')), String(data.get('name')).trim());
  byId<HTMLDialogElement>('rename-dialog').close();
  await refreshAccounts();
  notify('Account renamed');
});

byId<HTMLFormElement>('account-picker-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget as HTMLFormElement;
  const data = new FormData(form);
  const accountId = String(data.get('accountId'));
  const capsuleId = String(data.get('capsuleId'));
  const capsule = capsules.find((item) => item.id === capsuleId);
  const account = accounts.find((item) => item.id === accountId);
  byId<HTMLDialogElement>('account-picker-dialog').close();
  if (!capsule || !account) return;
  const estimate = Math.max(1, Math.ceil(capsuleText(capsule).length / 4));
  if (!await askConfirm(`Insert “${capsule.title}” v${capsule.version} (~${estimate.toLocaleString()} tokens) into ${account.providerName} · ${account.displayName}? You will review it in the composer and send it yourself.`, 'Inject Capsule')) return;
  await window.nexsus.capsules.inject(capsuleId, accountId);
  activeAccountId = accountId;
  activeCapsuleId = null;
  capsuleHubOpen = false;
  capsuleView.classList.add('hidden');
  await refreshAccounts();
  renderLists(searchInput.value.trim().toLowerCase());
  syncNativeOverlay();
  notify('Capsule inserted into the composer. Review it before sending.');
});

async function refresh(): Promise<void> {
  providerDefinitions = await window.nexsus.providers.list();
  byId<HTMLSelectElement>('provider').innerHTML = providerDefinitions.map((provider) => `<option value="${escapeHtml(provider.id)}">${escapeHtml(provider.name)}</option>`).join('');
  byId('provider-support').textContent = providerDefinitions.filter((provider) => provider.capabilities.extractContext && provider.capabilities.injectCapsule).map((provider) => provider.name).join(', ');
  byId('provider-hints').innerHTML = providerDefinitions.map((provider) => `<span>${escapeHtml(provider.name.toUpperCase())}</span>`).join('<i></i>');
  await Promise.all([refreshAccounts(), refreshCapsules()]);
  const remembered = accounts.filter((account) => account.lastUsedAt).sort((a, b) => (b.lastUsedAt ?? '').localeCompare(a.lastUsedAt ?? ''))[0];
  if (remembered) await activateAccount(remembered.id);
  updateBrowserBounds();
}

async function refreshAccounts(): Promise<void> {
  accounts = await window.nexsus.accounts.list();
  const active = accounts.find((account) => account.id === activeAccountId);
  if (active && activeCapsuleId === null) byId('active-label').textContent = `${active.providerName} · ${active.displayName}`;
  renderLists(searchInput.value.trim().toLowerCase());
}

async function refreshCapsules(): Promise<void> {
  capsules = await window.nexsus.capsules.list();
  renderLists(searchInput.value.trim().toLowerCase());
}

function openCapsuleHub(): void {
  activeCapsuleId = null;
  capsuleHubOpen = true;
  capsuleView.classList.remove('hidden');
  byId('welcome-state').classList.add('hidden');
  byId('active-label').textContent = 'Capsule Hub';
  byId<HTMLInputElement>('address').value = '';
  capsuleView.innerHTML = `<div class="hub-page"><div class="hub-heading"><div><div class="modal-kicker">CONTEXT TRANSFER</div><h1>Capsule Hub</h1><p>Carry project context between your provider accounts.</p></div><button class="primary-button" id="hub-new">${icon('plus')}New Capsule</button></div><div class="hub-controls"><label class="hub-search">${icon('search')}<input id="hub-search" type="search" placeholder="Search capsules" aria-label="Search capsules"></label><label class="hub-filter-label">Sort<select id="hub-sort" aria-label="Sort capsules"><option value="updated">Recently updated</option><option value="title">Title A–Z</option><option value="size">Context size</option></select></label><label class="hub-filter-label">Source<select id="hub-filter" aria-label="Filter capsules"><option value="all">All capsules</option><option value="extracted">Extracted</option><option value="manual">Manual</option></select></label></div><div id="hub-cards" class="hub-cards"></div><div class="hub-credit">NEXSUS · Made by Alay</div></div>`;
  byId('hub-new').addEventListener('click', () => openCapsuleDialog());
  const search = byId<HTMLInputElement>('hub-search');
  const sort = byId<HTMLSelectElement>('hub-sort');
  const filter = byId<HTMLSelectElement>('hub-filter');
  const render = () => {
    const query = search.value.trim().toLowerCase();
    const visible = capsules.filter((capsule) => {
      const textMatch = !query || `${capsule.title} ${capsule.objective} ${capsule.summary} ${capsule.source?.providerName ?? ''} ${capsule.source?.accountName ?? ''}`.toLowerCase().includes(query);
      return textMatch && (filter.value === 'all' || (filter.value === 'extracted' ? Boolean(capsule.source) : !capsule.source));
    }).sort((a, b) => sort.value === 'title' ? a.title.localeCompare(b.title) : sort.value === 'size' ? capsuleText(b).length - capsuleText(a).length : b.updatedAt.localeCompare(a.updatedAt));
    byId('hub-cards').innerHTML = visible.map((capsule) => `<article class="hub-card"><div class="hub-card-top"><span class="version-badge">v${capsule.version}</span></div><h2>${escapeHtml(capsule.title)}</h2><div class="capsule-meta">${capsule.source ? `${escapeHtml(capsule.source.providerName)} · ${escapeHtml(capsule.source.accountName)}` : 'Manual capsule'} · ${escapeHtml(new Date(capsule.updatedAt).toLocaleString())}</div><div class="hub-objective-label">Objective</div><p class="hub-objective">${escapeHtml(capsule.objective || capsule.summary || 'Add a concise objective to make this capsule easier to reuse.')}</p><div class="hub-card-foot"><span>~${Math.ceil(capsuleText(capsule).length / 4).toLocaleString()} tokens</span><div><button class="secondary-button" data-open-hub="${escapeHtml(capsule.id)}">Open</button><button class="primary-button" data-inject-hub="${escapeHtml(capsule.id)}">Inject</button></div></div></article>`).join('') || `<div class="hub-empty"><div class="hub-empty-mark">💊</div><h2>No capsules yet</h2><p>Create a capsule manually or extract structured context from a provider conversation.</p><button class="primary-button" id="hub-empty-new">${icon('plus')}Create your first capsule</button></div>`;
    byId('hub-cards').querySelectorAll<HTMLButtonElement>('[data-open-hub]').forEach((button) => button.addEventListener('click', () => openCapsule(button.dataset.openHub ?? '')));
    byId('hub-cards').querySelectorAll<HTMLButtonElement>('[data-inject-hub]').forEach((button) => { const capsule = capsules.find((item) => item.id === button.dataset.injectHub); if (capsule) button.addEventListener('click', () => openInjectDialog(capsule)); });
    byId('hub-empty-new')?.addEventListener('click', () => openCapsuleDialog());
  };
  search.addEventListener('input', render);
  sort.addEventListener('change', render);
  filter.addEventListener('change', render);
  render();
  syncNativeOverlay();
}

function renderLists(query = ''): void {
  const filteredAccounts = accounts.filter((account) => !query || `${account.providerName} ${account.displayName}`.toLowerCase().includes(query));
  const providers = new Map<string, Account[]>();
  for (const account of filteredAccounts) providers.set(account.providerId, [...(providers.get(account.providerId) ?? []), account]);
  accountList.innerHTML = [...providers.entries()].map(([providerId, group]) => `
    <section class="provider-group"><div class="provider-label"><span class="provider-glyph ${escapeHtml(providerId)}">${providerGlyph(providerId)}</span><span>${escapeHtml(group[0]?.providerName ?? providerId)}</span><span class="account-count">${group.length}</span></div>
      ${group.map((account) => `<div class="account-row ${activeAccountId === account.id ? 'selected' : ''}" data-account="${escapeHtml(account.id)}"><button class="account-select" aria-pressed="${activeAccountId === account.id}" aria-label="${escapeHtml(`${account.providerName} account ${account.displayName}${activeAccountId === account.id ? ', active' : ''}`)}"><span class="account-status" aria-hidden="true"></span><span class="account-name">${escapeHtml(account.displayName)}</span>${account.isFavorite ? '<span class="favorite-mark" aria-label="Favorite">✦</span>' : ''}</button><button class="row-menu" data-account-menu="${escapeHtml(account.id)}" aria-label="Account options" title="Account options">${icon('more')}</button></div>`).join('')}
    </section>`).join('') || (query ? '<div class="sidebar-empty">No matching accounts</div>' : '');
  collapsedRail.innerHTML = filteredAccounts.map((account) => `<button class="collapsed-account-icon ${activeAccountId === account.id ? 'selected' : ''}" data-collapsed-account="${escapeHtml(account.id)}" title="${escapeHtml(`${account.providerName} · ${account.displayName}`)}" aria-label="${escapeHtml(`${account.providerName} account ${account.displayName}`)}">${providerGlyph(account.providerId)}</button>`).join('') + `<button class="collapsed-tool" data-collapsed-capsules aria-label="Open Capsule Hub" title="Capsule Hub">${icon('capsule')}</button><button class="collapsed-tool" data-collapsed-settings aria-label="Settings and About" title="Settings & About">${icon('settings')}</button>`;
  collapsedRail.querySelectorAll<HTMLButtonElement>('[data-collapsed-account]').forEach((button) => button.addEventListener('click', () => void activateAccount(button.dataset.collapsedAccount ?? '')));
  collapsedRail.querySelector<HTMLButtonElement>('[data-collapsed-capsules]')?.addEventListener('click', openCapsuleHub);
  collapsedRail.querySelector<HTMLButtonElement>('[data-collapsed-settings]')?.addEventListener('click', () => showDialog(byId<HTMLDialogElement>('settings-dialog')));
  accountList.querySelectorAll<HTMLElement>('[data-account]').forEach((row) => row.querySelector<HTMLButtonElement>('.account-select')?.addEventListener('click', () => void activateAccount(row.dataset.account ?? '')));
  accountList.querySelectorAll<HTMLButtonElement>('[data-account-menu]').forEach((button) => button.addEventListener('click', (event) => {
    event.stopPropagation();
    const id = button.dataset.accountMenu ?? '';
    const account = accounts.find((item) => item.id === id);
    if (!account) return;
    const providerAccounts = accounts.filter((item) => item.providerId === account.providerId && item.isFavorite === account.isFavorite);
    const position = providerAccounts.findIndex((item) => item.id === id);
    const menuItems: { label: string; action: () => void; danger?: boolean }[] = [
      { label: account.isFavorite ? 'Remove favorite' : 'Add to favorites', action: () => void window.nexsus.accounts.favorite(id, !account.isFavorite).then(refreshAccounts) },
      ...(position > 0 ? [{ label: 'Move up', action: () => void window.nexsus.accounts.move(id, -1).then(refreshAccounts) }] : []),
      ...(position < providerAccounts.length - 1 ? [{ label: 'Move down', action: () => void window.nexsus.accounts.move(id, 1).then(refreshAccounts) }] : []),
      { label: 'Clear local session…', action: () => {
        void (async () => {
          if (!await askConfirm(`Sign out of “${account.displayName}” and clear its saved browser session?`, 'Clear session')) return;
          await window.nexsus.accounts.clearSession(id);
          notify('Saved session cleared');
        })();
      } },
    ];
    showMenu(button, [
      ...menuItems,
      { label: 'Rename account', action: () => openRenameDialog(account) },
      { label: 'Delete account', danger: true, action: () => {
        void (async () => {
          if (!await askConfirm(`Delete “${account.displayName}” and its local session?`, 'Delete account')) return;
          await window.nexsus.accounts.remove(id);
          if (activeAccountId === id) {
            activeAccountId = null;
            byId('active-label').textContent = 'No account selected';
            byId<HTMLInputElement>('address').value = '';
          }
          await refreshAccounts();
        })();
      } },
    ]);
  }));

  const filteredCapsules = capsules.filter((capsule) => !query || `${capsule.title} ${capsule.objective} ${capsule.summary}`.toLowerCase().includes(query));
  capsuleList.innerHTML = filteredCapsules.map((capsule) => `<div class="capsule-row ${activeCapsuleId === capsule.id ? 'selected' : ''}" data-capsule="${escapeHtml(capsule.id)}"><button class="capsule-select" aria-label="Open capsule ${escapeHtml(capsule.title)}, version ${capsule.version}"><span class="capsule-icon">${icon('file')}</span><span class="capsule-name">${escapeHtml(capsule.title)}</span></button><button class="row-menu" data-capsule-menu="${escapeHtml(capsule.id)}" aria-label="Capsule options" title="Capsule options">${icon('more')}</button></div>`).join('') || (query ? '<div class="sidebar-empty">No matching capsules</div>' : '<div class="capsule-empty">Save project context to pick up where you left off.</div>');
  capsuleList.querySelectorAll<HTMLElement>('[data-capsule]').forEach((row) => row.querySelector<HTMLButtonElement>('.capsule-select')?.addEventListener('click', () => openCapsule(row.dataset.capsule ?? '')));
  capsuleList.querySelectorAll<HTMLButtonElement>('[data-capsule-menu]').forEach((button) => button.addEventListener('click', (event) => {
    event.stopPropagation();
    const capsule = capsules.find((item) => item.id === button.dataset.capsuleMenu);
    if (!capsule) return;
    showMenu(button, [
      { label: 'Edit capsule', action: () => openCapsuleDialog(capsule) },
      { label: 'Copy as Markdown', action: () => void window.nexsus.capsules.copy(capsule.id).then(() => notify('Capsule copied to clipboard')) },
      { label: 'Export…', action: () => void window.nexsus.capsules.export(capsule.id) },
      { label: 'Duplicate', action: () => void window.nexsus.capsules.duplicate(capsule.id).then(refreshCapsules) },
      { label: 'Delete capsule', danger: true, action: () => {
        void (async () => {
          if (!await askConfirm(`Delete “${capsule.title}”?`, 'Delete capsule')) return;
          await window.nexsus.capsules.remove(capsule.id);
          if (activeCapsuleId === capsule.id) activeCapsuleId = null;
          capsuleView.classList.add('hidden');
          await refreshCapsules();
          syncNativeOverlay();
        })();
      } },
    ]);
  }));
  byId('welcome-state').classList.toggle('hidden', activeAccountId !== null || activeCapsuleId !== null || capsuleHubOpen);
}

async function activateAccount(id: string): Promise<void> {
  if (!id) return;
  activeAccountId = id;
  activeCapsuleId = null;
  capsuleHubOpen = false;
  capsuleView.classList.add('hidden');
  byId<HTMLDivElement>('browser-error').classList.add('hidden');
  await window.nexsus.accounts.activate(id);
  const account = accounts.find((item) => item.id === id);
  byId('active-label').textContent = account ? `${account.providerName} · ${account.displayName}` : 'Account';
  byId('welcome-state').classList.add('hidden');
  renderLists(searchInput.value.trim().toLowerCase());
  syncNativeOverlay();
}

function openCapsule(id: string, selectedVersion?: Capsule): void {
  const capsule = selectedVersion ?? capsules.find((item) => item.id === id);
  if (!capsule) return;
  activeCapsuleId = id;
  capsuleHubOpen = false;
  capsuleView.classList.remove('hidden');
  byId('welcome-state').classList.add('hidden');
  byId('active-label').textContent = 'Context Capsule';
  byId<HTMLInputElement>('address').value = '';
  capsuleView.innerHTML = `<div class="capsule-document"><div class="document-top"><div><div class="modal-kicker">CAPSULE HUB · VERSION ${capsule.version}${capsule.isCurrent ? ' · CURRENT' : ' · HISTORY'}</div><h1>${escapeHtml(capsule.title)}</h1><div class="capsule-meta">${capsule.source ? `${escapeHtml(capsule.source.providerName)} · ${escapeHtml(capsule.source.accountName)}` : 'Manual capsule'} · Updated ${escapeHtml(new Date(capsule.updatedAt).toLocaleString())} · ~${Math.ceil(capsuleText(capsule).length / 4).toLocaleString()} tokens</div></div><button class="secondary-button" id="capsule-edit">${icon('edit')} ${capsule.isCurrent ? 'Edit' : 'Create version from this'}</button></div><div class="document-actions"><button class="primary-button" id="capsule-use">${icon('capsule')}Inject Capsule</button><button class="secondary-button" id="capsule-copy">${icon('copy')}Copy</button><button class="secondary-button" id="capsule-export">${icon('download')}Export</button><button class="secondary-button" id="capsule-create-version">${icon('plus')}Create version</button>${capsule.isCurrent ? '' : '<button class="secondary-button" id="capsule-restore">Restore this version</button>'}</div><div class="version-panel"><h2>Version history</h2><div id="capsule-version-list" class="version-list"><span class="muted">Loading versions…</span></div></div>${capsuleSection('Objective', capsule.objective)}${capsuleSection('Summary', capsule.summary)}${capsuleSection('Current state', capsule.currentState)}${capsuleSection('Decisions', capsule.decisions.join('\n'))}${capsuleSection('Constraints', capsule.constraints.join('\n'))}${capsuleSection('Completed', capsule.completed.join('\n'))}${capsuleSection('Pending', capsule.pending.join('\n'))}${capsuleSection('Next action', capsule.nextAction)}${capsuleSection('Technical context', JSON.stringify(capsule.technicalContext, null, 2))}${capsuleSection('Files', capsule.files.join('\n'))}${capsuleSection('Attachments', capsule.attachments.map((item) => `${item.filename}${item.mimeType ? ` · ${item.mimeType}` : ''}${item.size ? ` · ${item.size} bytes` : ''}`).join('\n'))}${capsuleSection('Conversation excerpt', capsule.conversationExcerpt)}${capsule.source ? capsuleSection('Source', `${capsule.source.providerName} · ${capsule.source.accountName}\n${capsule.source.conversationUrl}\nExtracted ${new Date(capsule.source.extractedAt).toLocaleString()}`) : ''}<div class="document-foot">Stored locally · Made by Alay</div></div>`;
  byId('capsule-edit').addEventListener('click', () => capsule.isCurrent ? openCapsuleDialog(capsule) : openCapsuleDialog(undefined, capsule, capsule.id));
  byId('capsule-copy').addEventListener('click', () => void window.nexsus.capsules.copy(id).then(() => notify('Capsule copied to clipboard')));
  byId('capsule-export').addEventListener('click', () => void window.nexsus.capsules.export(id));
  byId('capsule-create-version').addEventListener('click', () => openCapsuleDialog(undefined, capsule, capsule.id));
  if (!capsule.isCurrent) byId('capsule-restore').addEventListener('click', () => void window.nexsus.capsules.restoreVersion(capsule.id).then(async (restored) => { await refreshCapsules(); openCapsule(restored.id); notify(`Restored version ${restored.version}`); }));
  byId('capsule-use').addEventListener('click', () => {
    openInjectDialog(capsule);
  });
  void window.nexsus.capsules.versions(capsule.id).then((versions) => {
    const list = byId<HTMLDivElement>('capsule-version-list');
    list.innerHTML = versions.map((version) => `<div class="version-row"><button class="version-open" data-version-id="${escapeHtml(version.id)}">v${version.version}${version.isCurrent ? ' · Current' : ''} <span>${escapeHtml(new Date(version.updatedAt).toLocaleDateString())}</span></button><button class="icon-button small" data-version-duplicate="${escapeHtml(version.id)}" aria-label="Duplicate version ${version.version}" title="Duplicate version">${icon('copy')}</button></div>`).join('');
    list.querySelectorAll<HTMLButtonElement>('[data-version-id]').forEach((button) => button.addEventListener('click', () => { const version = versions.find((item) => item.id === button.dataset.versionId); if (version) openCapsule(version.id, version); }));
    list.querySelectorAll<HTMLButtonElement>('[data-version-duplicate]').forEach((button) => button.addEventListener('click', () => { const version = versions.find((item) => item.id === button.dataset.versionDuplicate); if (version) void window.nexsus.capsules.duplicate(version.id).then(async (copy) => { await refreshCapsules(); openCapsule(copy.id); notify('Version duplicated'); }); }));
  }).catch((error: unknown) => notify(error instanceof Error ? error.message : 'Could not load version history'));
  renderLists(searchInput.value.trim().toLowerCase());
  syncNativeOverlay();
}

function openInjectDialog(capsule: Capsule): void {
  if (!accounts.length) return notify('Add an account before injecting a capsule.');
  const form = byId<HTMLFormElement>('account-picker-form');
  (form.elements.namedItem('capsuleId') as HTMLInputElement).value = capsule.id;
  byId<HTMLSelectElement>('target-account').innerHTML = accounts.map((account) => `<option value="${escapeHtml(account.id)}">${escapeHtml(account.providerName)} · ${escapeHtml(account.displayName)}</option>`).join('');
  byId('inject-preview').innerHTML = `<strong>${escapeHtml(capsule.title)} · v${capsule.version}</strong><span>Approx. ${Math.ceil(capsuleText(capsule).length / 4).toLocaleString()} tokens</span>`;
  showDialog(byId<HTMLDialogElement>('account-picker-dialog'));
}

function openCapsuleDialog(capsule?: Capsule, extracted?: CapsuleInput, versionOfId?: string): void {
  const dialog = byId<HTMLDialogElement>('capsule-dialog');
  const form = byId<HTMLFormElement>('capsule-form');
  form.reset();
  editorSource = extracted?.source ?? capsule?.source ?? null;
  editorAttachments = extracted?.attachments ?? capsule?.attachments ?? [];
  editorVersionOfId = versionOfId ?? null;
  byId('extraction-note').classList.toggle('hidden', !extracted);
  byId('capsule-dialog-title').textContent = capsule ? (versionOfId ? 'Review new version' : 'Edit capsule') : extracted ? (versionOfId ? 'Review extracted version' : 'Review extracted capsule') : 'New capsule';
  byId<HTMLButtonElement>('capsule-save').textContent = versionOfId ? 'Create version' : capsule ? 'Save changes' : 'Save capsule';
  const set = (key: string, value: string) => { (form.elements.namedItem(key) as HTMLInputElement | HTMLTextAreaElement).value = value; };
  set('id', capsule?.id ?? '');
  set('title', extracted?.title ?? capsule?.title ?? '');
  set('objective', extracted?.objective ?? capsule?.objective ?? '');
  set('summary', extracted?.summary ?? capsule?.summary ?? '');
  set('currentState', extracted?.currentState ?? capsule?.currentState ?? '');
  set('decisions', (extracted?.decisions ?? capsule?.decisions ?? []).join('\n'));
  set('constraints', (extracted?.constraints ?? capsule?.constraints ?? []).join('\n'));
  set('completed', (extracted?.completed ?? capsule?.completed ?? []).join('\n'));
  set('pending', (extracted?.pending ?? capsule?.pending ?? []).join('\n'));
  set('nextAction', extracted?.nextAction ?? capsule?.nextAction ?? '');
  set('technicalContext', JSON.stringify(extracted?.technicalContext ?? capsule?.technicalContext ?? {}, null, 2));
  set('files', (extracted?.files ?? capsule?.files ?? []).join('\n'));
  set('conversationExcerpt', extracted?.conversationExcerpt ?? capsule?.conversationExcerpt ?? '');
  showDialog(dialog);
}

function openAccountDialog(): void {
  showDialog(byId<HTMLDialogElement>('account-dialog'));
  byId<HTMLInputElement>('account-name').focus();
}

function openRenameDialog(account: Account): void {
  const form = byId<HTMLFormElement>('rename-form');
  (form.elements.namedItem('id') as HTMLInputElement).value = account.id;
  byId<HTMLInputElement>('rename-name').value = account.displayName;
  showDialog(byId<HTMLDialogElement>('rename-dialog'));
  byId<HTMLInputElement>('rename-name').select();
}

function showMenu(anchor: HTMLElement, items: { label: string; action: () => void; danger?: boolean }[]): void {
  document.querySelector('.context-menu')?.remove();
  const menu = document.createElement('div');
  menu.className = 'context-menu';
  menu.setAttribute('role', 'menu');
  menu.innerHTML = items.map((item, index) => `<button class="context-menu-item ${item.danger ? 'danger' : ''}" role="menuitem" data-menu-index="${index}">${escapeHtml(item.label)}</button>`).join('');
  document.body.append(menu);
  syncNativeOverlay();
  const rect = anchor.getBoundingClientRect();
  menu.style.left = `${Math.max(8, Math.min(window.innerWidth - menu.offsetWidth - 8, rect.right - menu.offsetWidth))}px`;
  menu.style.top = `${Math.max(8, Math.min(window.innerHeight - menu.offsetHeight - 8, rect.bottom + 4))}px`;
  menu.querySelectorAll<HTMLButtonElement>('[data-menu-index]').forEach((button, index) => button.addEventListener('click', () => {
    menu.remove();
    syncNativeOverlay();
    items[index]?.action();
  }));
  const dismiss = (event: Event) => {
    if (!menu.contains(event.target as Node)) {
      menu.remove();
      syncNativeOverlay();
    }
  };
  window.setTimeout(() => document.addEventListener('pointerdown', dismiss, { once: true }), 0);
}

async function importCapsule(): Promise<void> {
  const capsule = await window.nexsus.capsules.import();
  if (capsule) {
    await refreshCapsules();
    openCapsule(capsule.id);
    notify('Capsule imported');
  }
}

async function extractCapsule(): Promise<void> {
  const button = byId<HTMLButtonElement>('extract-capsule');
  button.disabled = true;
  try {
    const extraction: CapsuleExtraction = await window.nexsus.browser.extractCapsule();
    const existing = capsules.find((capsule) => capsule.title.trim().toLowerCase() === extraction.title.trim().toLowerCase());
    openCapsuleDialog(undefined, extraction, existing?.id);
  } catch (error) {
    notify(error instanceof Error ? error.message : 'Could not extract this conversation.');
  } finally {
    button.disabled = false;
  }
}

function capsuleText(capsule: Capsule): string {
  return [capsule.title, capsule.objective, capsule.summary, capsule.currentState, ...capsule.decisions, ...capsule.constraints, ...capsule.completed, ...capsule.pending, capsule.nextAction, JSON.stringify(capsule.technicalContext), ...capsule.files, JSON.stringify(capsule.attachments), JSON.stringify(capsule.source), capsule.conversationExcerpt].filter(Boolean).join('\n');
}

function updateBrowserBounds(): void {
  const bounds = browserSurface.getBoundingClientRect();
  const capsuleOpen = activeCapsuleId !== null || capsuleHubOpen;
  window.nexsus.browser.updateBounds({ x: bounds.x, y: bounds.y, width: capsuleOpen ? 0 : bounds.width, height: capsuleOpen ? 0 : bounds.height });
}

function syncNativeOverlay(): void {
  const dialogOpen = [...document.querySelectorAll<HTMLDialogElement>('dialog')].some((dialog) => dialog.open);
  const overlayOpen = dialogOpen || Boolean(document.querySelector('.context-menu')) || activeCapsuleId !== null || capsuleHubOpen;
  window.nexsus.browser.setOverlayOpen(overlayOpen);
  updateBrowserBounds();
}

function showDialog(dialog: HTMLDialogElement): void {
  dialog.showModal();
  syncNativeOverlay();
}

function askConfirm(message: string, actionLabel: string): Promise<boolean> {
  const dialog = byId<HTMLDialogElement>('confirm-dialog');
  dialog.returnValue = '';
  byId('confirm-message').textContent = message;
  byId('confirm-accept').textContent = actionLabel;
  return new Promise((resolve) => {
    dialog.addEventListener('close', () => resolve(dialog.returnValue === 'confirm'), { once: true });
    showDialog(dialog);
  });
}

function notify(message: string): void {
  const toast = byId<HTMLDivElement>('toast');
  toast.textContent = message;
  toast.classList.add('visible');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove('visible'), 2400);
}

function capsuleSection(title: string, body: string): string {
  return body ? `<section class="document-section"><h2>${escapeHtml(title)}</h2><p>${escapeHtml(body).replaceAll('\n', '<br>')}</p></section>` : '';
}

function providerGlyph(providerId: string): string { return escapeHtml(providerDefinitions.find((provider) => provider.id === providerId)?.glyph ?? providerId.slice(0, 1).toUpperCase()); }
function lines(value: string): string[] { return value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean); }
function byId<T extends HTMLElement = HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing UI element: ${id}`);
  return element as T;
}
function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character] ?? character);
}
function icon(name: string): string {
  const paths: Record<string, string> = {
    'panel-left': '<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M9 4v16"/>', search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>', plus: '<path d="M12 5v14M5 12h14"/>', shield: '<path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z"/><path d="m9 12 2 2 4-4"/>', settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a2 2 0 0 0 1.4-3.4 2 2 0 0 0-1.4-3.4 2 2 0 0 0-3.4-1.4 2 2 0 0 0-3.4-1.4 2 2 0 0 0-3.4 1.4 2 2 0 0 0-3.4 1.4 2 2 0 0 0-1.4 3.4 2 2 0 0 0 1.4 3.4 2 2 0 0 0 3.4 1.4 2 2 0 0 0 3.4 1.4 2 2 0 0 0 3.4-1.4 2 2 0 0 0 3.4-1.4Z"/>', capsule: '<path d="m8 4 12 12a4.2 4.2 0 0 1-6 6L2 10a4.2 4.2 0 0 1 6-6Z"/><path d="m6 6 12 12"/>',
    back: '<path d="m15 18-6-6 6-6"/>', forward: '<path d="m9 18 6-6-6-6"/>', reload: '<path d="M20 7v5h-5M4 17v-5h5M5.5 9a7 7 0 0 1 11.6-2.6L20 12M4 12l2.9 5.6A7 7 0 0 0 18.5 15"/>', stop: '<path d="M7 7h10v10H7z"/>', lock: '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 1 1 8 0v3"/>', external: '<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h6"/>', close: '<path d="m18 6-12 12M6 6l12 12"/>', more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>', file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h8"/>', download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>', edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"/>', copy: '<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>', 'arrow-up': '<path d="M12 19V5m-7 7 7-7 7 7"/>',
  };
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] ?? ''}</svg>`;
}
