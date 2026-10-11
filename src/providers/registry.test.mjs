// Made by Alay
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getProvider, isProviderAuthUrlAllowed, isProviderNavigationAllowed, isProviderUrlAllowed, providers } from './registry.ts';

describe('provider registry', () => {
  it('registers all official providers with manual multi-account support and capsule capabilities', () => {
    assert.deepEqual(providers.map(({ id, homepage }) => [id, homepage]), [
      ['claude', 'https://claude.ai/'],
      ['chatgpt', 'https://chatgpt.com/'],
      ['gemini', 'https://gemini.google.com/'],
      ['grok', 'https://grok.com/'],
    ]);
    assert.equal(providers.length, 4);
    for (const provider of providers) {
      assert.deepEqual(provider.accountManagement, { multipleAccounts: true, signIn: 'manual' });
      assert.deepEqual(provider.capabilities, { extractContext: true, injectCapsule: true });
      assert.ok(provider.glyph);
      assert.ok(provider.limitations.length > 0);
    }
  });

  it('allows HTTPS on the provider domain and its subdomains', () => {
    const claude = getProvider('claude');
    assert.ok(claude);
    assert.equal(isProviderUrlAllowed(claude, 'https://claude.ai'), true);
    assert.equal(isProviderUrlAllowed(claude, 'https://support.claude.ai/help'), true);
    assert.equal(isProviderNavigationAllowed(claude, 'https://accounts.google.com/signin'), true);
    assert.equal(isProviderUrlAllowed(claude, 'https://accounts.google.com/signin'), false);
    assert.equal(isProviderAuthUrlAllowed(claude, 'https://accounts.google.com/signin'), true);
  });

  it('rejects lookalike hosts and insecure protocols', () => {
    const claude = getProvider('claude');
    assert.ok(claude);
    assert.equal(isProviderUrlAllowed(claude, 'https://claude.ai.attacker.example'), false);
    assert.equal(isProviderUrlAllowed(claude, 'http://claude.ai'), false);
  });

  it('keeps provider and authentication navigation allowlists independent', () => {
    assert.equal(isProviderUrlAllowed(getProvider('chatgpt'), 'https://chatgpt.com/c/abc'), true);
    assert.equal(isProviderAuthUrlAllowed(getProvider('chatgpt'), 'https://auth.openai.com/log-in'), true);
    assert.equal(isProviderAuthUrlAllowed(getProvider('chatgpt'), 'https://accounts.google.com/'), true);
    assert.equal(isProviderNavigationAllowed(getProvider('gemini'), 'https://accounts.google.com/'), true);
    assert.equal(isProviderNavigationAllowed(getProvider('grok'), 'https://x.com/i/flow/login'), true);
    assert.equal(isProviderNavigationAllowed(getProvider('grok'), 'https://evil.example/'), false);
    assert.equal(isProviderNavigationAllowed(getProvider('gemini'), 'http://gemini.google.com/'), false);
  });
});
