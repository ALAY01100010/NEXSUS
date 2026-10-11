/* NEXSUS · Made by Alay */
import { randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import type { Account, Capsule, CapsuleInput } from '../shared/contracts.js';
import { getProvider } from '../providers/registry.ts';

const schemaVersion = 3;

export class LocalStore {
  private readonly database: DatabaseSync;

  constructor(database: DatabaseSync) {
    this.database = database;
    try { this.migrate(); } catch (error) { database.close(); throw error; }
  }

  private migrate(): void {
    const version = (this.database.prepare('PRAGMA user_version').get() as { user_version: number }).user_version;
    if (version > schemaVersion) throw new Error(`NEXSUS database version ${version} is newer than this application supports.`);
    this.database.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; BEGIN IMMEDIATE;');
    try {
      this.database.exec(`
        CREATE TABLE IF NOT EXISTS accounts (
          id TEXT PRIMARY KEY, provider_id TEXT NOT NULL, display_name TEXT NOT NULL,
          session_partition TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL, last_used_at TEXT,
          is_favorite INTEGER NOT NULL DEFAULT 0, sort_order INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS capsules (
          id TEXT PRIMARY KEY, title TEXT NOT NULL, objective TEXT NOT NULL DEFAULT '',
          summary TEXT NOT NULL DEFAULT '', decisions_json TEXT NOT NULL DEFAULT '[]',
          constraints_json TEXT NOT NULL DEFAULT '[]', completed_json TEXT NOT NULL DEFAULT '[]',
          pending_json TEXT NOT NULL DEFAULT '[]', next_action TEXT NOT NULL DEFAULT '',
          created_at TEXT NOT NULL, updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS workspace_state (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      `);
      this.database.exec('PRAGMA user_version = 1;');
      this.ensureColumn('accounts', 'last_url', 'TEXT');
      this.ensureColumn('capsules', 'technical_context_json', "TEXT NOT NULL DEFAULT '{}' ");
      this.ensureColumn('capsules', 'files_json', "TEXT NOT NULL DEFAULT '[]'");
      this.ensureColumn('capsules', 'conversation_excerpt', "TEXT NOT NULL DEFAULT ''");
      this.ensureColumn('capsules', 'version_group_id', 'TEXT');
      this.ensureColumn('capsules', 'version_number', 'INTEGER NOT NULL DEFAULT 1');
      this.ensureColumn('capsules', 'is_current', 'INTEGER NOT NULL DEFAULT 1');
      this.ensureColumn('capsules', 'source_json', "TEXT NOT NULL DEFAULT 'null'");
      this.ensureColumn('capsules', 'attachments_json', "TEXT NOT NULL DEFAULT '[]'");
      this.ensureColumn('capsules', 'current_state', "TEXT NOT NULL DEFAULT ''");
      this.database.exec('UPDATE capsules SET version_group_id = id WHERE version_group_id IS NULL;');
      this.database.exec('CREATE INDEX IF NOT EXISTS capsules_version_group_idx ON capsules(version_group_id, version_number DESC); CREATE UNIQUE INDEX IF NOT EXISTS capsules_one_current_version_idx ON capsules(version_group_id) WHERE is_current = 1;');
      this.database.exec(`PRAGMA user_version = ${schemaVersion}; COMMIT;`);
    } catch (error) {
      this.database.exec('ROLLBACK;');
      throw error;
    }
  }

  private ensureColumn(table: string, name: string, declaration: string): void {
    const columns = this.database.prepare(`PRAGMA table_info(${table})`).all() as unknown as { name: string }[];
    if (!columns.some((column) => column.name === name)) this.database.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${declaration};`);
  }

  listAccounts(): Account[] {
    const rows = this.database.prepare('SELECT * FROM accounts ORDER BY is_favorite DESC, provider_id ASC, sort_order ASC, created_at ASC, id ASC').all() as unknown as AccountRow[];
    return rows.flatMap((row) => {
      const provider = getProvider(row.provider_id);
      if (!provider || typeof row.id !== 'string' || typeof row.display_name !== 'string') return [];
      return [{
        id: row.id, providerId: row.provider_id, providerName: provider.name, displayName: row.display_name,
        createdAt: row.created_at, lastUsedAt: row.last_used_at, lastUrl: row.last_url ?? null,
        isFavorite: row.is_favorite === 1, sortOrder: row.sort_order,
      }];
    });
  }

  createAccount(providerId: string, displayName: string): Account {
    if (!getProvider(providerId)) throw new Error('Choose a supported AI provider.');
    const cleanName = validateText(displayName, 'Account name', 60);
    const id = randomUUID();
    const createdAt = new Date().toISOString();
    const nextOrder = this.database.prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order FROM accounts WHERE provider_id = ?').get(providerId) as { next_order: number };
    this.database.prepare(`INSERT INTO accounts (id, provider_id, display_name, session_partition, created_at, sort_order)
      VALUES (?, ?, ?, ?, ?, ?)`).run(id, providerId, cleanName, `persist:nexsus-account-${id}`, createdAt, nextOrder.next_order);
    const account = this.listAccounts().find((item) => item.id === id);
    if (!account) throw new Error('The account could not be created.');
    return account;
  }

  renameAccount(id: string, displayName: string): Account {
    const result = this.database.prepare('UPDATE accounts SET display_name = ? WHERE id = ?').run(validateText(displayName, 'Account name', 60), id);
    if (Number(result.changes) === 0) throw new Error('This account no longer exists.');
    return this.accountById(id)!;
  }

  setAccountFavorite(id: string, isFavorite: boolean): Account {
    const result = this.database.prepare('UPDATE accounts SET is_favorite = ? WHERE id = ?').run(isFavorite ? 1 : 0, id);
    if (Number(result.changes) === 0) throw new Error('This account no longer exists.');
    return this.accountById(id)!;
  }

  moveAccount(id: string, direction: -1 | 1): void {
    this.database.exec('BEGIN IMMEDIATE;');
    try {
      const current = this.database.prepare('SELECT provider_id, sort_order, is_favorite FROM accounts WHERE id = ?').get(id) as { provider_id: string; sort_order: number; is_favorite: number } | undefined;
      if (!current) throw new Error('This account no longer exists.');
      const neighbors = this.database.prepare('SELECT id, sort_order FROM accounts WHERE provider_id = ? AND is_favorite = ? ORDER BY sort_order ASC, created_at ASC, id ASC').all(current.provider_id, current.is_favorite) as unknown as { id: string; sort_order: number }[];
      const currentIndex = neighbors.findIndex((account) => account.id === id);
      const target = neighbors[currentIndex + direction];
      if (target) {
        this.database.prepare('UPDATE accounts SET sort_order = ? WHERE id = ?').run(target.sort_order, id);
        this.database.prepare('UPDATE accounts SET sort_order = ? WHERE id = ?').run(current.sort_order, target.id);
      }
      this.database.exec('COMMIT;');
    } catch (error) {
      this.database.exec('ROLLBACK;');
      throw error;
    }
  }

  getAccountSessionPartition(id: string): string {
    const row = this.database.prepare('SELECT session_partition FROM accounts WHERE id = ?').get(id) as { session_partition: string } | undefined;
    if (!row) throw new Error('This account no longer exists.');
    return row.session_partition;
  }

  removeAccount(id: string): void {
    this.database.exec('BEGIN IMMEDIATE;');
    try {
      const result = this.database.prepare('DELETE FROM accounts WHERE id = ?').run(id);
      if (Number(result.changes) === 0) throw new Error('This account no longer exists.');
      if (this.getActiveAccountId() === id) this.setActiveAccountId(null);
      this.database.exec('COMMIT;');
    } catch (error) {
      this.database.exec('ROLLBACK;');
      throw error;
    }
  }

  setAccountLastUrl(id: string, url: string): void {
    this.database.prepare('UPDATE accounts SET last_url = ? WHERE id = ?').run(url, id);
  }

  markAccountUsed(id: string): void {
    const result = this.database.prepare('UPDATE accounts SET last_used_at = ? WHERE id = ?').run(new Date().toISOString(), id);
    if (Number(result.changes) === 0) throw new Error('This account no longer exists.');
    this.setActiveAccountId(id);
  }

  getActiveAccountId(): string | null {
    const row = this.database.prepare("SELECT value FROM workspace_state WHERE key = 'active_account_id'").get() as { value: string } | undefined;
    return row?.value ?? null;
  }

  setActiveAccountId(id: string | null): void {
    if (id === null) this.database.prepare("DELETE FROM workspace_state WHERE key = 'active_account_id'").run();
    else this.database.prepare("INSERT INTO workspace_state (key, value) VALUES ('active_account_id', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(id);
  }

  listCapsules(): Capsule[] {
    const rows = this.database.prepare('SELECT * FROM capsules WHERE is_current = 1 ORDER BY updated_at DESC, id ASC').all() as unknown as CapsuleRow[];
    return rows.flatMap((row) => { try { return [toCapsule(row)]; } catch { return []; } });
  }

  createCapsule(input: CapsuleInput): Capsule {
    const clean = normalizeCapsule(input);
    const id = randomUUID();
    const now = new Date().toISOString();
    this.insertCapsuleRow(id, id, 1, clean, now);
    return this.getCapsule(id)!;
  }

  listCapsuleVersions(id: string): Capsule[] {
    const capsule = this.getCapsule(id);
    if (!capsule) throw new Error('This Context Capsule no longer exists.');
    const rows = this.database.prepare('SELECT * FROM capsules WHERE version_group_id = ? ORDER BY version_number DESC').all(capsule.versionGroupId) as unknown as CapsuleRow[];
    return rows.flatMap((row) => { try { return [toCapsule(row)]; } catch { return []; } });
  }

  createCapsuleVersion(id: string, input: CapsuleInput): Capsule {
    const source = this.getCapsule(id);
    if (!source) throw new Error('This Context Capsule no longer exists.');
    const clean = normalizeCapsule(input);
    this.database.exec('BEGIN IMMEDIATE;');
    try {
      const nextVersion = this.database.prepare('SELECT COALESCE(MAX(version_number), 0) + 1 AS next_version FROM capsules WHERE version_group_id = ?').get(source.versionGroupId) as { next_version: number };
      this.database.prepare('UPDATE capsules SET is_current = 0 WHERE version_group_id = ?').run(source.versionGroupId);
      const idForVersion = randomUUID();
      this.insertCapsuleRow(idForVersion, source.versionGroupId, nextVersion.next_version, clean, new Date().toISOString());
      this.database.exec('COMMIT;');
      return this.getCapsule(idForVersion)!;
    } catch (error) { this.database.exec('ROLLBACK;'); throw error; }
  }

  restoreCapsuleVersion(id: string): Capsule {
    const capsule = this.getCapsule(id);
    if (!capsule) throw new Error('This Context Capsule no longer exists.');
    this.database.exec('BEGIN IMMEDIATE;');
    try {
      this.database.prepare('UPDATE capsules SET is_current = 0 WHERE version_group_id = ?').run(capsule.versionGroupId);
      this.database.prepare('UPDATE capsules SET is_current = 1, updated_at = ? WHERE id = ?').run(new Date().toISOString(), id);
      this.database.exec('COMMIT;');
      return this.getCapsule(id)!;
    } catch (error) { this.database.exec('ROLLBACK;'); throw error; }
  }

  private insertCapsuleRow(id: string, groupId: string, version: number, clean: NormalizedCapsuleInput, now: string): void {
    this.database.prepare(`INSERT INTO capsules (id, title, objective, summary, decisions_json, constraints_json, completed_json, pending_json, next_action, created_at, updated_at, technical_context_json, files_json, conversation_excerpt, version_group_id, version_number, is_current, source_json, attachments_json, current_state)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`)
      .run(id, clean.title, clean.objective, clean.summary, JSON.stringify(clean.decisions), JSON.stringify(clean.constraints), JSON.stringify(clean.completed), JSON.stringify(clean.pending), clean.nextAction, now, now, JSON.stringify(clean.technicalContext), JSON.stringify(clean.files), clean.conversationExcerpt, groupId, version, JSON.stringify(clean.source), JSON.stringify(clean.attachments), clean.currentState);
  }

  updateCapsule(id: string, input: CapsuleInput): Capsule {
    const clean = normalizeCapsule(input);
    const result = this.database.prepare(`UPDATE capsules SET title = ?, objective = ?, summary = ?, decisions_json = ?, constraints_json = ?, completed_json = ?, pending_json = ?, next_action = ?, updated_at = ?, technical_context_json = ?, files_json = ?, conversation_excerpt = ?, source_json = ?, attachments_json = ?, current_state = ? WHERE id = ?`)
      .run(clean.title, clean.objective, clean.summary, JSON.stringify(clean.decisions), JSON.stringify(clean.constraints), JSON.stringify(clean.completed), JSON.stringify(clean.pending), clean.nextAction, new Date().toISOString(), JSON.stringify(clean.technicalContext), JSON.stringify(clean.files), clean.conversationExcerpt, JSON.stringify(clean.source), JSON.stringify(clean.attachments), clean.currentState, id);
    if (Number(result.changes) === 0) throw new Error('This capsule no longer exists.');
    return this.getCapsule(id)!;
  }

  removeCapsule(id: string): void {
    const capsule = this.getCapsule(id);
    if (!capsule) throw new Error('This capsule no longer exists.');
    this.database.exec('BEGIN IMMEDIATE;');
    try {
      const result = this.database.prepare('DELETE FROM capsules WHERE id = ?').run(id);
      if (Number(result.changes) === 0) throw new Error('This capsule no longer exists.');
      const replacement = this.database.prepare('SELECT id FROM capsules WHERE version_group_id = ? ORDER BY version_number DESC LIMIT 1').get(capsule.versionGroupId) as { id: string } | undefined;
      if (replacement) this.database.prepare('UPDATE capsules SET is_current = 1 WHERE id = ?').run(replacement.id);
      this.database.exec('COMMIT;');
    } catch (error) { this.database.exec('ROLLBACK;'); throw error; }
  }

  duplicateCapsule(id: string): Capsule {
    const source = this.getCapsule(id);
    if (!source) throw new Error('This capsule no longer exists.');
    const suffix = ' copy';
    return this.createCapsule({ ...source, title: `${source.title.slice(0, 120 - suffix.length).trimEnd()}${suffix}` });
  }

  getCapsule(id: string): Capsule | null {
    const row = this.database.prepare('SELECT * FROM capsules WHERE id = ?').get(id) as CapsuleRow | undefined;
    if (!row) return null;
    try { return toCapsule(row); } catch { throw new Error('This Context Capsule is damaged and cannot be opened.'); }
  }

  close(): void { this.database.close(); }

  private accountById(id: string): Account | undefined { return this.listAccounts().find((account) => account.id === id); }
}

export function normalizeCapsule(input: CapsuleInput): NormalizedCapsuleInput {
  const technicalContext = validateRecord(input.technicalContext);
  const serializedContext = JSON.stringify(technicalContext);
  if (serializedContext.length > 20_000) throw new Error('Technical context contains too much data.');
  return {
    title: validateText(input.title, 'Capsule title', 120),
    objective: validateOptionalText(input.objective, 'Objective', 4000),
    summary: validateOptionalText(input.summary, 'Summary', 12000),
    decisions: validateList(input.decisions, 'Decisions'), constraints: validateList(input.constraints, 'Constraints'),
    completed: validateList(input.completed, 'Completed items'), pending: validateList(input.pending, 'Pending items'),
    nextAction: validateOptionalText(input.nextAction, 'Next action', 1000), technicalContext,
    currentState: validateOptionalText(input.currentState, 'Current state', 4000),
    files: validateList(input.files, 'Files'), conversationExcerpt: validateOptionalText(input.conversationExcerpt, 'Conversation excerpt', 12000),
    source: validateCapsuleSource(input.source), attachments: validateAttachments(input.attachments),
  };
}

export type NormalizedCapsuleInput = CapsuleInput & { technicalContext: Record<string, unknown>; files: string[]; conversationExcerpt: string; currentState: string; source: CapsuleInput['source']; attachments: NonNullable<CapsuleInput['attachments']> };

function validateCapsuleSource(value: CapsuleInput['source']): CapsuleInput['source'] {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'object' || typeof value.providerId !== 'string' || typeof value.providerName !== 'string' || typeof value.accountId !== 'string' || typeof value.accountName !== 'string' || typeof value.conversationUrl !== 'string' || typeof value.extractedAt !== 'string') throw new Error('Capsule source details are invalid.');
  return { providerId: value.providerId.slice(0, 40), providerName: value.providerName.slice(0, 80), accountId: value.accountId.slice(0, 36), accountName: value.accountName.slice(0, 80), conversationUrl: value.conversationUrl.slice(0, 2048), extractedAt: value.extractedAt.slice(0, 40) };
}
function validateAttachments(value: CapsuleInput['attachments']): NonNullable<CapsuleInput['attachments']> {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > 50) throw new Error('Capsule attachments are invalid.');
  return value.map((item) => {
    if (typeof item !== 'object' || !item || typeof item.filename !== 'string') throw new Error('Capsule attachment metadata is invalid.');
    const attachment: NonNullable<CapsuleInput['attachments']>[number] = { filename: item.filename.trim().slice(0, 260) };
    if (typeof item.mimeType === 'string') attachment.mimeType = item.mimeType.slice(0, 120);
    if (typeof item.size === 'number' && Number.isFinite(item.size) && item.size >= 0) attachment.size = Math.floor(item.size);
    if (typeof item.localReference === 'string') attachment.localReference = item.localReference.slice(0, 1000);
    return attachment;
  });
}

function validateRecord(value: unknown): Record<string, unknown> {
  if (value === undefined || value === null) return {};
  if (typeof value !== 'object' || Array.isArray(value)) throw new Error('Technical context must be an object.');
  try { return JSON.parse(JSON.stringify(value)) as Record<string, unknown>; } catch { throw new Error('Technical context must contain valid JSON data.'); }
}
function validateText(value: unknown, label: string, maxLength: number): string {
  if (typeof value !== 'string') throw new Error(`${label} is required.`);
  const clean = value.trim();
  if (!clean) throw new Error(`${label} is required.`);
  if (clean.length > maxLength) throw new Error(`${label} must be ${maxLength} characters or fewer.`);
  return clean;
}
function validateOptionalText(value: unknown, label: string, maxLength: number): string {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string') throw new Error(`${label} must be text.`);
  const clean = value.trim();
  if (clean.length > maxLength) throw new Error(`${label} must be ${maxLength} characters or fewer.`);
  return clean;
}
function validateList(value: unknown, label: string): string[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > 100 || value.some((item) => typeof item !== 'string')) throw new Error(`${label} must be a list of text items.`);
  const items = value.map((item: string) => item.trim()).filter(Boolean);
  if (items.some((item) => item.length > 2000) || items.reduce((size, item) => size + item.length, 0) > 12000) throw new Error(`${label} contains too much text.`);
  return items;
}

interface AccountRow { id: string; provider_id: string; display_name: string; created_at: string; last_used_at: string | null; is_favorite: number; sort_order: number; last_url: string | null; }
interface CapsuleRow { id: string; title: string; objective: string; summary: string; current_state: string; decisions_json: string; constraints_json: string; completed_json: string; pending_json: string; next_action: string; created_at: string; updated_at: string; technical_context_json: string; files_json: string; conversation_excerpt: string; version_group_id: string | null; version_number: number; is_current: number; source_json: string; attachments_json: string; }
function parseJson<T>(source: string, fallback: T, valid: (value: unknown) => value is T): T {
  try { const value: unknown = JSON.parse(source); return valid(value) ? value : fallback; } catch { return fallback; }
}
function isStringList(value: unknown): value is string[] { return Array.isArray(value) && value.every((item) => typeof item === 'string'); }
function isObject(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value); }
function toCapsule(row: CapsuleRow): Capsule {
  if (typeof row.title !== 'string' || typeof row.created_at !== 'string' || typeof row.updated_at !== 'string') throw new Error('Invalid capsule row.');
  return {
    id: row.id, title: row.title, objective: row.objective ?? '', summary: row.summary ?? '', currentState: row.current_state ?? '',
    decisions: parseJson(row.decisions_json, [], isStringList), constraints: parseJson(row.constraints_json, [], isStringList),
    completed: parseJson(row.completed_json, [], isStringList), pending: parseJson(row.pending_json, [], isStringList),
    nextAction: row.next_action ?? '', technicalContext: parseJson(row.technical_context_json, {}, isObject),
    files: parseJson(row.files_json, [], isStringList), conversationExcerpt: row.conversation_excerpt ?? '',
    versionGroupId: row.version_group_id ?? row.id, version: row.version_number ?? 1, isCurrent: row.is_current !== 0,
    source: parseJson(row.source_json, null, (value): value is NonNullable<Capsule['source']> => value === null || (isObject(value) && typeof value.providerId === 'string' && typeof value.providerName === 'string' && typeof value.accountId === 'string' && typeof value.accountName === 'string' && typeof value.conversationUrl === 'string' && typeof value.extractedAt === 'string')),
    attachments: parseJson(row.attachments_json, [], (value): value is Capsule['attachments'] => Array.isArray(value) && value.every((item) => isObject(item) && typeof item.filename === 'string')),
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}
