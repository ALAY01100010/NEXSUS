// Made by Alay
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { LocalStore } from '../src/electron/store.ts';

let directory;
let databasePath;

before(() => {
  directory = mkdtempSync(join(tmpdir(), 'nexsus-store-test-'));
  databasePath = join(directory, 'nexsus.sqlite');
});

after(() => rmSync(directory, { recursive: true, force: true }));

describe('local metadata store', () => {
  it('creates, renames, activates, and removes isolated provider accounts', () => {
    const store = new LocalStore(new DatabaseSync(':memory:'));
    const personal = store.createAccount('claude', 'Personal');
    const work = store.createAccount('claude', 'Work');
    assert.equal(personal.providerName, 'Claude');
    assert.notEqual(personal.id, work.id);
    store.moveAccount(work.id, -1);
    assert.deepEqual(store.listAccounts().map((account) => account.displayName), ['Work', 'Personal']);
    store.setAccountFavorite(personal.id, true);
    assert.equal(store.listAccounts()[0].isFavorite, true);
    store.markAccountUsed(work.id);
    assert.equal(store.getActiveAccountId(), work.id);
    assert.equal(store.renameAccount(work.id, 'Studio').displayName, 'Studio');
    assert.throws(() => store.createAccount('unknown', 'Other'), /supported AI provider/);
    assert.match(store.getAccountSessionPartition(work.id), new RegExp(work.id));
    store.removeAccount(work.id);
    assert.equal(store.getActiveAccountId(), null);
    assert.deepEqual(store.listAccounts().map((account) => account.displayName), ['Personal']);
    store.close();
  });

  it('creates independent persistent accounts for every registered provider', () => {
    const store = new LocalStore(new DatabaseSync(':memory:'));
    const providerIds = ['claude', 'chatgpt', 'gemini', 'grok'];
    const accounts = providerIds.flatMap((providerId) => [
      store.createAccount(providerId, 'Personal'),
      store.createAccount(providerId, 'Work'),
    ]);
    const partitions = accounts.map((account) => store.getAccountSessionPartition(account.id));
    assert.equal(new Set(partitions).size, 8);
    for (const providerId of providerIds) {
      assert.equal(accounts.filter((account) => account.providerId === providerId).length, 2);
    }
    assert.deepEqual(new Set(accounts.map((account) => account.providerName)), new Set(['Claude', 'ChatGPT', 'Google Gemini', 'Grok']));
    store.close();
  });

  it('persists accounts and capsules after reopening the SQLite database', () => {
    let store = new LocalStore(new DatabaseSync(databasePath));
    const account = store.createAccount('claude', 'Research');
    store.setAccountLastUrl(account.id, 'https://claude.ai/new');
    const capsule = store.createCapsule({
      title: 'Project notes', objective: 'Ship the feature', summary: 'Use an isolated profile.',
      decisions: ['SQLite metadata'], constraints: ['Local only'], completed: ['Foundation'], pending: ['Browser view'], nextAction: 'Add WebContentsView',
      technicalContext: { runtime: 'Node.js', heading: '## Heading' }, files: ['src/main.ts'], conversationExcerpt: '## Kept as content',
    });
    store.close();

    store = new LocalStore(new DatabaseSync(databasePath));
    assert.equal(store.listAccounts()[0].id, account.id);
    assert.equal(store.listAccounts()[0].lastUrl, 'https://claude.ai/new');
    assert.equal(store.getCapsule(capsule.id)?.nextAction, 'Add WebContentsView');
    assert.deepEqual(store.getCapsule(capsule.id)?.technicalContext, { runtime: 'Node.js', heading: '## Heading' });
    assert.deepEqual(store.getCapsule(capsule.id)?.files, ['src/main.ts']);
    assert.equal(store.getCapsule(capsule.id)?.conversationExcerpt, '## Kept as content');
    const duplicate = store.duplicateCapsule(capsule.id);
    assert.equal(duplicate.title, 'Project notes copy');
    store.updateCapsule(duplicate.id, { ...duplicate, title: 'Edited notes' });
    assert.equal(store.getCapsule(duplicate.id)?.title, 'Edited notes');
    assert.throws(() => store.createCapsule({ ...capsule, title: ' ' }), /title is required/);
    store.removeCapsule(capsule.id);
    assert.equal(store.getCapsule(capsule.id), null);
    const longTitle = store.createCapsule({ title: 'x'.repeat(120) });
    assert.equal(store.duplicateCapsule(longTitle.id).title.length, 120);
    store.close();
  });

  it('migrates the previous schema and records its current version', () => {
    const db = new DatabaseSync(':memory:');
    db.exec(`CREATE TABLE accounts (id TEXT PRIMARY KEY, provider_id TEXT NOT NULL, display_name TEXT NOT NULL, session_partition TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL, last_used_at TEXT, is_favorite INTEGER NOT NULL DEFAULT 0, sort_order INTEGER NOT NULL);
      CREATE TABLE capsules (id TEXT PRIMARY KEY, title TEXT NOT NULL, objective TEXT NOT NULL DEFAULT '', summary TEXT NOT NULL DEFAULT '', decisions_json TEXT NOT NULL DEFAULT '[]', constraints_json TEXT NOT NULL DEFAULT '[]', completed_json TEXT NOT NULL DEFAULT '[]', pending_json TEXT NOT NULL DEFAULT '[]', next_action TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
      CREATE TABLE workspace_state (key TEXT PRIMARY KEY, value TEXT NOT NULL); PRAGMA user_version = 1;`);
    const store = new LocalStore(db);
    assert.equal(db.prepare('PRAGMA user_version').get().user_version, 3);
    assert.ok(db.prepare('PRAGMA table_info(accounts)').all().some((column) => column.name === 'last_url'));
    assert.ok(db.prepare('PRAGMA table_info(capsules)').all().some((column) => column.name === 'technical_context_json'));
    assert.ok(db.prepare('PRAGMA table_info(capsules)').all().some((column) => column.name === 'version_group_id'));
    assert.ok(db.prepare('PRAGMA table_info(capsules)').all().some((column) => column.name === 'current_state'));
    store.close();
  });

  it('moves accounts within their favorite ordering group', () => {
    const store = new LocalStore(new DatabaseSync(':memory:'));
    const personal = store.createAccount('claude', 'Personal');
    const work = store.createAccount('claude', 'Work');
    const research = store.createAccount('claude', 'Research');
    store.setAccountFavorite(personal.id, true);
    store.moveAccount(research.id, -1);
    assert.deepEqual(store.listAccounts().map((account) => account.displayName), ['Personal', 'Research', 'Work']);
    store.close();
  });

  it('skips corrupted capsule JSON instead of crashing capsule listing', () => {
    const db = new DatabaseSync(':memory:');
    const store = new LocalStore(db);
    const capsule = store.createCapsule({ title: 'Healthy' });
    db.prepare('UPDATE capsules SET decisions_json = ? WHERE id = ?').run('{', capsule.id);
    assert.equal(store.listCapsules()[0]?.id, capsule.id);
    assert.deepEqual(store.getCapsule(capsule.id)?.decisions, []);
    store.close();
  });

  it('keeps capsule versions and restores an older version without deleting history', () => {
    const store = new LocalStore(new DatabaseSync(':memory:'));
    const first = store.createCapsule({ title: 'Workspace plan', objective: 'Ship capsule transfer' });
    const second = store.createCapsuleVersion(first.id, { ...first, title: 'Workspace plan', objective: 'Add provider adapters', source: { providerId: 'claude', providerName: 'Claude', accountId: 'account-1', accountName: 'Work', conversationUrl: 'https://claude.ai/chat/example', extractedAt: '2026-10-11T00:00:00.000Z' }, attachments: [{ filename: 'notes.pdf', mimeType: 'application/pdf', size: 1200 }] });
    assert.equal(second.version, 2);
    assert.equal(second.isCurrent, true);
    assert.equal(store.listCapsules().length, 1);
    assert.equal(store.listCapsules()[0]?.id, second.id);
    assert.deepEqual(store.listCapsuleVersions(first.id).map((version) => version.version), [2, 1]);
    assert.equal(store.getCapsule(second.id)?.source?.accountName, 'Work');
    assert.equal(store.getCapsule(second.id)?.attachments[0]?.filename, 'notes.pdf');
    assert.equal(store.restoreCapsuleVersion(first.id).isCurrent, true);
    assert.equal(store.listCapsules()[0]?.id, first.id);
    store.close();
  });
});
