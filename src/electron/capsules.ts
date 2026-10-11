/* NEXSUS · Made by Alay */
import type { Capsule, CapsuleInput } from '../shared/contracts.js';
import { normalizeCapsule } from './store.ts';

export interface CapsuleDocument {
  format: 'nexsus-context-capsule';
  version: 1;
  capsule_version: 1;
  exported_at: string;
  application_version: string;
  title: string;
  objective: string;
  summary: string;
  current_state?: string;
  decisions: string[];
  constraints: string[];
  completed: string[];
  pending: string[];
  next_action: string;
  technical_context: Record<string, unknown>;
  files: string[];
  conversation_excerpt: string;
  project_version?: number;
  source?: Capsule['source'];
  attachments?: Capsule['attachments'];
}

export function toCapsuleDocument(capsule: Capsule, applicationVersion = '0.1.0'): CapsuleDocument {
  return {
    format: 'nexsus-context-capsule', version: 1, capsule_version: 1,
    exported_at: new Date().toISOString(), application_version: safeVersion(applicationVersion),
    title: capsule.title, objective: capsule.objective, summary: capsule.summary, current_state: capsule.currentState ?? '',
    decisions: capsule.decisions, constraints: capsule.constraints, completed: capsule.completed,
    pending: capsule.pending, next_action: capsule.nextAction,
    technical_context: capsule.technicalContext ?? {}, files: capsule.files ?? [],
    conversation_excerpt: capsule.conversationExcerpt ?? '', project_version: capsule.version ?? 1,
    source: capsule.source ?? null, attachments: capsule.attachments ?? [],
  };
}

export function toCapsuleMarkdown(capsule: Capsule, applicationVersion = '0.1.0'): string {
  const section = (title: string, text: string | string[]) => {
    const value = Array.isArray(text) ? text.map((line) => `- ${escapeHeading(line)}`).join('\n') : escapeHeading(text);
    return value ? `## ${title}\n${value}\n` : '';
  };
  const context = Object.keys(capsule.technicalContext ?? {}).length ? JSON.stringify(capsule.technicalContext, null, 2) : '';
  return [
    `# ${escapeHeading(capsule.title)}`,
    `<!-- nexsus-context-capsule capsule_version=1 application_version=${safeVersion(applicationVersion)} exported_at=${new Date().toISOString()} -->`,
    '', section('Objective', capsule.objective), section('Summary', capsule.summary), section('Current state', capsule.currentState ?? ''),
    section('Decisions', capsule.decisions), section('Constraints', capsule.constraints),
    section('Completed', capsule.completed), section('Pending', capsule.pending),
    section('Next action', capsule.nextAction), section('Technical context', context),
    section('Files', capsule.files ?? []), section('Conversation excerpt', capsule.conversationExcerpt ?? ''),
    section('Source metadata', JSON.stringify(capsule.source ?? null, null, 2)),
    section('Attachments', JSON.stringify(capsule.attachments ?? [], null, 2)),
  ].filter(Boolean).join('\n').trimEnd() + '\n';
}

export function parseCapsuleDocument(source: string): CapsuleInput {
  if (source.length > 1_000_000) throw new Error('This capsule file is larger than 1 MB.');
  const trimmed = source.trim();
  if (!trimmed) throw new Error('The selected capsule file is empty.');
  if (trimmed.startsWith('{')) {
    let parsed: unknown;
    try { parsed = JSON.parse(trimmed); } catch { throw new Error('This file is not valid capsule JSON.'); }
    if (!isRecord(parsed) || !['nexsus-context-capsule', 'nexus-context-capsule'].includes(String(parsed.format)) || (parsed.version !== 1 && parsed.capsule_version !== 1)) {
      throw new Error('This is not a supported NEXSUS Context Capsule (version 1).');
    }
    return normalizeCapsule({
      title: stringValue(parsed.title), objective: stringValue(parsed.objective), summary: stringValue(parsed.summary), currentState: stringValue(parsed.current_state),
      decisions: stringList(parsed.decisions), constraints: stringList(parsed.constraints), completed: stringList(parsed.completed),
      pending: stringList(parsed.pending), nextAction: stringValue(parsed.next_action),
      technicalContext: recordValue(parsed.technical_context), files: stringList(parsed.files),
      conversationExcerpt: stringValue(parsed.conversation_excerpt), source: capsuleSource(parsed.source), attachments: attachmentList(parsed.attachments),
    });
  }

  const lines = trimmed.replace(/\r/g, '').split('\n');
  const titleLine = lines.find((line) => /^#\s+/.test(line));
  if (!titleLine) throw new Error('Markdown capsule files need a top-level heading for the title.');
  const sections: Record<string, string[]> = {};
  let sectionName = '';
  let fenced = false;
  for (const line of lines) {
    if (/^\s*```/.test(line)) fenced = !fenced;
    const heading = fenced ? null : line.match(/^##\s+(.+)$/);
    if (heading) { sectionName = heading[1]!.trim().toLowerCase(); sections[sectionName] ??= []; }
    else if (sectionName) sections[sectionName]!.push(line);
  }
  const body = (name: string) => unescapeHeadings((sections[name] ?? []).join('\n').trim());
  const list = (name: string) => (sections[name] ?? []).map((line) => unescapeHeadings(line.replace(/^\s*[-*]\s+/, '').trim())).filter(Boolean);
  let technicalContext: Record<string, unknown> = {};
  const contextBody = body('technical context');
  if (contextBody) {
    try { technicalContext = recordValue(JSON.parse(contextBody)); }
    catch { throw new Error('The Technical context section must contain valid JSON.'); }
  }
  let sourceMetadata: CapsuleInput['source'] = null;
  let attachments: NonNullable<CapsuleInput['attachments']> = [];
  try { if (body('source metadata')) sourceMetadata = capsuleSource(JSON.parse(body('source metadata'))); }
  catch { throw new Error('The Source metadata section must contain valid JSON.'); }
  try { if (body('attachments')) attachments = attachmentList(JSON.parse(body('attachments'))); }
  catch { throw new Error('The Attachments section must contain valid JSON.'); }
  return normalizeCapsule({
    title: unescapeHeadings(titleLine.replace(/^#\s+/, '').trim()), objective: body('objective'), summary: body('summary'), currentState: body('current state'),
    decisions: list('decisions'), constraints: list('constraints'), completed: list('completed'), pending: list('pending'),
    nextAction: body('next action'), technicalContext, files: list('files'), conversationExcerpt: body('conversation excerpt'), source: sourceMetadata, attachments,
  });
}

function escapeHeading(value: string): string { return value.replace(/^(\s*)(#{1,6})(\s)/gm, '$1\\$2$3'); }
function unescapeHeadings(value: string): string { return value.replace(/^(\s*)\\(#{1,6})(\s)/gm, '$1$2$3'); }
function safeVersion(value: string): string { return value.replace(/[^\w.+-]/g, '').slice(0, 40) || 'unknown'; }
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value); }
function recordValue(value: unknown): Record<string, unknown> {
  if (value === undefined || value === null) return {};
  if (!isRecord(value)) throw new Error('Capsule technical_context must be an object.');
  return value;
}
function stringValue(value: unknown): string { return value === undefined || value === null ? '' : typeof value === 'string' ? value : (() => { throw new Error('Capsule fields must contain text.'); })(); }
function stringList(value: unknown): string[] { return value === undefined || value === null ? [] : Array.isArray(value) && value.every((item) => typeof item === 'string') ? value : (() => { throw new Error('Capsule list fields must contain text items.'); })(); }
function capsuleSource(value: unknown): CapsuleInput['source'] {
  if (value === undefined || value === null) return null;
  if (!isRecord(value) || ['providerId', 'providerName', 'accountId', 'accountName', 'conversationUrl', 'extractedAt'].some((key) => typeof value[key] !== 'string')) throw new Error('Capsule source metadata is invalid.');
  return value as unknown as NonNullable<CapsuleInput['source']>;
}
function attachmentList(value: unknown): NonNullable<CapsuleInput['attachments']> {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.some((item) => !isRecord(item) || typeof item.filename !== 'string')) throw new Error('Capsule attachment metadata is invalid.');
  return value as unknown as NonNullable<CapsuleInput['attachments']>;
}
