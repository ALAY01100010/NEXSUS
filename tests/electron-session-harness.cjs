// Made by Alay
const { app, BrowserWindow, WebContentsView, session } = require('electron');
const http = require('node:http');
const path = require('node:path');

const providerIds = ['claude', 'chatgpt', 'gemini', 'grok'];
const accounts = Object.fromEntries(providerIds.flatMap((providerId, index) => [
  [`${providerId}-A`, `persist:nexsus-account-${String(index * 2 + 1).padStart(8, '0')}-1111-4111-8111-${String(index * 2 + 1).padStart(12, '0')}`],
  [`${providerId}-B`, `persist:nexsus-account-${String(index * 2 + 2).padStart(8, '0')}-2222-4222-8222-${String(index * 2 + 2).padStart(12, '0')}`],
]));
accounts['custom-A'] = 'persist:nexsus-custom-aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa';
accounts['custom-B'] = 'persist:nexsus-custom-bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb';

app.setPath('userData', process.env.NEXSUS_TEST_USER_DATA);
app.setPath('sessionData', process.env.NEXSUS_TEST_SESSION_DATA);
app.commandLine.appendSwitch('disable-gpu');

app.whenReady().then(async () => {
  let failed = false;
  const server = http.createServer((_request, response) => {
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    response.end('<!doctype html><title>NEXSUS session test</title><body>session test</body>');
  });
  await new Promise((resolve, reject) => server.listen(Number(process.env.NEXSUS_TEST_PORT), '127.0.0.1', resolve).once('error', reject));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Could not start local session test server.');
  const url = `http://127.0.0.1:${address.port}/`;
  const window = new BrowserWindow({ show: false, width: 900, height: 700, webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true } });
  const views = new Map();
  const sessions = new Map();
  for (const [account, partition] of Object.entries(accounts)) {
    const accountSession = session.fromPartition(partition);
    if (!accountSession.storagePath) throw new Error(`Account ${account} did not receive a persistent session storage path.`);
    const relativeStoragePath = path.relative(process.env.NEXSUS_TEST_SESSION_DATA, accountSession.storagePath);
    if (relativeStoragePath.startsWith('..') || path.isAbsolute(relativeStoragePath)) {
      throw new Error(`Account ${account} session storage escaped the configured profile: ${accountSession.storagePath}`);
    }
    sessions.set(account, accountSession);
    const view = new WebContentsView({ webPreferences: { session: accountSession, contextIsolation: true, nodeIntegration: false, sandbox: true } });
    view.setBounds({ x: 0, y: 0, width: 900, height: 700 });
    window.contentView.addChildView(view);
    view.setVisible(false);
    views.set(account, view);
    await view.webContents.loadURL(url);
  }

  const getState = async (account) => views.get(account).webContents.executeJavaScript('JSON.stringify({ account: localStorage.getItem("account"), cookie: document.cookie })').then(JSON.parse);
  const switchTo = (account) => {
    for (const [key, view] of views) view.setVisible(key === account);
  };
  const verify = async (account, expected) => {
    switchTo(account);
    const state = await getState(account);
    const cookies = await sessions.get(account).cookies.get({ url });
    if (state.account !== expected || state.cookie !== `account=${expected}` || cookies.find((cookie) => cookie.name === 'account')?.value !== expected) {
      throw new Error(`Account ${account} storage was not isolated: ${JSON.stringify({ state, cookies })}`);
    }
  };

  try {
    const storagePaths = [...sessions.values()].map((accountSession) => accountSession.storagePath);
    if (new Set(storagePaths).size !== Object.keys(accounts).length) {
      throw new Error('Two provider accounts resolved to the same persistent session storage path.');
    }
    if (process.env.NEXSUS_TEST_PHASE === 'write') {
      for (const account of Object.keys(accounts)) {
        const accountSession = sessions.get(account);
        await accountSession.cookies.set({ url, name: 'account', value: account, path: '/', expirationDate: Math.floor(Date.now() / 1000) + 3600 });
        await views.get(account).webContents.executeJavaScript(`localStorage.setItem('account', ${JSON.stringify(account)})`);
      }
      for (const account of Object.keys(accounts)) await verify(account, account);
      for (const account of Object.keys(accounts).reverse()) await verify(account, account);
    } else {
      for (const account of Object.keys(accounts)) await verify(account, account);
      for (const account of Object.keys(accounts).reverse()) await verify(account, account);
    }
    for (const accountSession of sessions.values()) {
      accountSession.flushStorageData();
      await accountSession.cookies.flushStore();
    }
    console.log(`SESSION_PROFILE:${JSON.stringify({ userData: app.getPath('userData'), sessionData: app.getPath('sessionData'), origin: url, partitions: Object.fromEntries([...sessions].map(([account, accountSession]) => [account, accountSession.storagePath])) })}`);
    console.log(`SESSION_ISOLATION_OK:${process.env.NEXSUS_TEST_PHASE}`);
  } catch (error) {
    console.error(error instanceof Error ? error.stack : String(error));
    failed = true;
  } finally {
    window.destroy();
    await new Promise((resolve) => server.close(resolve));
    if (failed) app.exit(1);
    else app.quit();
  }
}).catch((error) => {
  console.error(error instanceof Error ? error.stack : String(error));
  app.exit(1);
});
