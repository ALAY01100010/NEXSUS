// Made by Alay
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseCapsuleDocument, toCapsuleDocument, toCapsuleMarkdown } from '../src/electron/capsules.ts';

const capsule = {
  id: 'capsule-id', title: 'Campus API', objective: 'Ship the backend', summary: 'Auth is done.', currentState: 'Webhook remains.',
  decisions: ['PostgreSQL'], constraints: ['No cloud'], completed: ['Auth'], pending: ['Webhook'],
  technicalContext: { runtime: 'Node.js', note: '## Heading remains context' }, files: ['src/main.ts'], conversationExcerpt: '## This is excerpt text',
  nextAction: 'Add payment webhook', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-02T00:00:00.000Z',
  version: 3, source: { providerId: 'claude', providerName: 'Claude', accountId: 'account-id', accountName: 'Work', conversationUrl: 'https://claude.ai/chat/abc', extractedAt: '2026-01-02T00:00:00.000Z' },
  attachments: [{ filename: 'notes.pdf', mimeType: 'application/pdf', size: 128 }],
};

describe('Context Capsule documents', () => {
  it('exports portable versioned JSON and imports it back', () => {
    const document = toCapsuleDocument(capsule);
    assert.equal(document.format, 'nexsus-context-capsule');
    assert.equal(document.version, 1);
    assert.equal(document.capsule_version, 1);
    assert.equal(document.project_version, 3);
    assert.equal(typeof document.exported_at, 'string');
    assert.equal(document.application_version, '0.1.0');
    assert.deepEqual(parseCapsuleDocument(JSON.stringify(document)), {
      title: capsule.title, objective: capsule.objective, summary: capsule.summary, currentState: capsule.currentState,
      decisions: capsule.decisions, constraints: capsule.constraints, completed: capsule.completed,
      pending: capsule.pending, nextAction: capsule.nextAction, technicalContext: capsule.technicalContext,
      files: capsule.files, conversationExcerpt: capsule.conversationExcerpt, source: capsule.source, attachments: capsule.attachments,
    });
  });

  it('imports the previously shipped format identifier', () => {
    const legacy = { ...toCapsuleDocument(capsule), format: 'nexus-context-capsule' };
    assert.deepEqual(parseCapsuleDocument(JSON.stringify(legacy)).technicalContext, capsule.technicalContext);
  });

  it('exports readable Markdown and imports it back', () => {
    const markdown = toCapsuleMarkdown(capsule);
    const imported = parseCapsuleDocument(markdown);
    assert.equal(imported.title, capsule.title);
    assert.equal(imported.currentState, capsule.currentState);
    assert.deepEqual(imported.decisions, capsule.decisions);
    assert.deepEqual(imported.pending, capsule.pending);
    assert.equal(imported.nextAction, capsule.nextAction);
    assert.deepEqual(imported.technicalContext, capsule.technicalContext);
    assert.deepEqual(imported.files, capsule.files);
    assert.equal(imported.conversationExcerpt, capsule.conversationExcerpt);
    assert.deepEqual(imported.source, capsule.source);
    assert.deepEqual(imported.attachments, capsule.attachments);
  });

  it('keeps heading-like user content inside its original Markdown section', () => {
    const withHeadings = { ...capsule, objective: 'First line\n## A user supplied heading\nLast line', summary: '## Summary data' };
    const imported = parseCapsuleDocument(toCapsuleMarkdown(withHeadings));
    assert.equal(imported.objective, withHeadings.objective);
    assert.equal(imported.summary, withHeadings.summary);
    assert.equal(imported.conversationExcerpt, capsule.conversationExcerpt);
  });

  it('rejects unsupported or oversized capsule documents', () => {
    assert.throws(() => parseCapsuleDocument('{"format":"other","version":1}'), /not a supported/);
    assert.throws(() => parseCapsuleDocument('{'), /not valid capsule JSON/);
    assert.throws(() => parseCapsuleDocument('{"format":"nexsus-context-capsule","version":1,"title":{},"decisions":[]}'), /fields must contain text/);
    assert.throws(() => parseCapsuleDocument('x'.repeat(1_000_001)), /larger than 1 MB/);
  });
});
