// Made by Alay
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const electronExecutable = join(projectRoot, 'node_modules', 'electron', 'dist', process.platform === 'win32' ? 'electron.exe' : 'electron');
const harness = join(projectRoot, 'tests', 'electron-session-harness.cjs');
const temporaryRoot = mkdtempSync(join(tmpdir(), 'nexsus-electron-session-'));
const appDirectory = join(temporaryRoot, 'test-app');
const userData = join(temporaryRoot, 'user-data');
const sessionData = join(temporaryRoot, 'session-data');
let testPort;

mkdirSync(appDirectory, { recursive: true });
mkdirSync(userData, { recursive: true });
mkdirSync(sessionData, { recursive: true });
writeFileSync(join(appDirectory, 'package.json'), JSON.stringify({ name: 'nexsus-session-test', version: '1.0.0', main: harness }), 'utf8');

async function getAvailablePort() {
  const server = createServer();
  await new Promise((resolve, reject) => server.listen(0, '127.0.0.1', resolve).once('error', reject));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Could not reserve a local port for the Electron session test.');
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return address.port;
}

function run(phase) {
  const result = spawnSync(electronExecutable, [appDirectory], {
    encoding: 'utf8', timeout: 120_000, windowsHide: true,
    env: {
      ...process.env,
      NEXSUS_TEST_PHASE: phase,
      NEXSUS_TEST_USER_DATA: userData,
      NEXSUS_TEST_SESSION_DATA: sessionData,
      NEXSUS_TEST_PORT: String(testPort),
    },
  });
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  if (result.error) throw result.error;
  if (result.status !== 0 || !output.includes(`SESSION_ISOLATION_OK:${phase}`)) {
    throw new Error(`Electron session integration phase '${phase}' failed (exit ${result.status}).\n${output}`);
  }
  process.stdout.write(`Electron session ${phase}: passed\n`);
}

try {
  if (!existsSync(electronExecutable)) throw new Error(`Electron executable is missing at ${electronExecutable}.`);
  testPort = await getAvailablePort();
  run('write');
  run('restart');
  process.stdout.write('Eight Claude, ChatGPT, Gemini, and Grok account partitions remained distinct across switches and application restart.\n');
} finally {
  rmSync(temporaryRoot, { recursive: true, force: true });
}
