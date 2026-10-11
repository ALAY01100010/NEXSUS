// Made by Alay
import assert from 'node:assert/strict';
import { Script } from 'node:vm';
import { describe, it } from 'node:test';
import { getProviderAdapter } from '../src/providers/context-adapters.ts';

const fixtures = [
  { id: 'claude', name: 'Claude', url: 'https://claude.ai/chat/abc', messages: '[data-testid="user-message"]' },
  { id: 'chatgpt', name: 'ChatGPT', url: 'https://chatgpt.com/c/abc', messages: '[data-message-author-role="user"]' },
  { id: 'gemini', name: 'Google Gemini', url: 'https://gemini.google.com/app/abc', messages: '[data-test-id="user-query"]' },
  { id: 'grok', name: 'Grok', url: 'https://grok.com/chat/abc', messages: '[data-testid*="user-message"]' },
];

function source(provider) {
  return { providerId: provider.id, providerName: provider.name, accountId: `${provider.id}-account`, accountName: 'Work', conversationUrl: provider.url, extractedAt: '2026-10-11T00:00:00.000Z' };
}

describe('provider context adapters', () => {
  for (const provider of fixtures) {
    it(`${provider.name} maps a visible conversation into a provider-independent capsule`, () => {
      const adapter = getProviderAdapter(provider.id);
      assert.ok(adapter?.canExtractContext(provider.url));
      const capsule = adapter.extractConversationContext({
        url: provider.url, title: `Transfer architecture · ${provider.name}`,
        turns: [
          { role: 'user', text: 'Build a local-first context transfer feature.\nConstraints: Do not send without approval.' },
          { role: 'assistant', text: 'Decision: keep SQLite.\nCompleted: the account sessions are isolated.\n```ts\nconst mode = "local";\n```' },
          { role: 'user', text: 'Next step: add version history.' },
        ],
        attachments: [{ filename: 'notes.pdf', mimeType: 'application/pdf', size: 42 }],
      }, source(provider));
      assert.equal(capsule.objective.startsWith('Build a local-first'), true);
      assert.ok(capsule.decisions.some((item) => item.includes('Decision:')));
      assert.ok(capsule.constraints.some((item) => item.includes('Constraints:')));
      assert.ok(capsule.completed.some((item) => item.includes('Completed:')));
      assert.match(capsule.nextAction, /Next step:/);
      assert.match(String(capsule.technicalContext.codeExcerpts), /const mode/);
      assert.equal(capsule.source.providerId, provider.id);
      assert.equal(capsule.source.accountName, 'Work');
      assert.equal(capsule.attachments[0].filename, 'notes.pdf');
    });

    it(`${provider.name} uses provider-specific DOM and composer selectors and never submits`, () => {
      const adapter = getProviderAdapter(provider.id);
      assert.ok(adapter);
      const readScript = adapter.buildConversationReadScript();
      const injectionScript = adapter.buildInjectionScript('review this context');
      const selectorKey = provider.id === 'gemini' ? 'user-query' : 'user-message';
      assert.ok(readScript.includes(selectorKey), `${provider.id} should use its own message selector`);
      assert.match(injectionScript, /insertText/);
      assert.doesNotMatch(injectionScript, /\.submit\(|requestSubmit|form\.submit|sendButton/);
      assert.doesNotMatch(injectionScript, /click\(/);
      assert.doesNotThrow(() => new Script(readScript));
      assert.doesNotThrow(() => new Script(injectionScript));
      return adapter.injectContext('review this context', async (script) => script === injectionScript ? 'inserted' : 'rejected')
        .then((result) => assert.equal(result, 'inserted'));
    });
  }

  it('fails clearly for unknown providers, unsupported pages, missing messages, and oversized conversations', () => {
    assert.equal(getProviderAdapter('unknown'), undefined);
    const adapter = getProviderAdapter('chatgpt');
    const chatgpt = fixtures.find((provider) => provider.id === 'chatgpt');
    assert.equal(adapter.canExtractContext('https://example.com/chat/abc'), false);
    assert.throws(() => adapter.extractConversationContext({ url: chatgpt.url, title: 'ChatGPT', turns: [] }, source(chatgpt)), /did not expose recognizable/);
    assert.throws(() => adapter.extractConversationContext({ url: chatgpt.url, title: 'ChatGPT', turns: [{ role: 'user', text: 'message' }], truncated: true }, source(chatgpt)), /did not create a partial capsule/);
    assert.throws(() => adapter.extractConversationContext({ url: chatgpt.url, title: 'ChatGPT', turns: [{ role: 'user', text: 'message' }] }, source(fixtures[0])), /not a supported ChatGPT conversation/);
  });

  it('reports composer outcomes without claiming failed insertions succeeded', async () => {
    const adapter = getProviderAdapter('gemini');
    assert.equal(await adapter.injectContext('capsule text', async () => 'missing'), 'missing');
    assert.equal(await adapter.injectContext('capsule text', async () => 'occupied'), 'occupied');
    assert.equal(await adapter.injectContext('capsule text', async () => 'rejected'), 'rejected');
  });
});
