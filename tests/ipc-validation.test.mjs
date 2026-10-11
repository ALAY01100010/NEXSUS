// Made by Alay
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { validateBrowserBounds, validateCapsule, validateHttpsNavigation, validateId, validateProviderNavigation, validateText } from '../src/electron/ipc-validation.ts';
import { getProvider } from '../src/providers/registry.ts';

describe('privileged IPC input validation', () => {
  it('accepts only UUID-shaped item identifiers and bounded text', () => {
    assert.equal(validateId('6c1d13bb-f054-4a2b-926f-1b6ef6fc3323'), '6c1d13bb-f054-4a2b-926f-1b6ef6fc3323');
    assert.throws(() => validateId('../capsule'), /identifier/);
    assert.equal(validateText('  Work  ', 'Account name', 60), 'Work');
    assert.throws(() => validateText('x'.repeat(61), 'Account name', 60), /invalid/);
  });

  it('normalizes HTTPS navigation and rejects unsafe schemes', () => {
    assert.equal(validateHttpsNavigation('claude.ai'), 'https://claude.ai/');
    assert.equal(validateHttpsNavigation('https://claude.ai/settings'), 'https://claude.ai/settings');
    assert.throws(() => validateHttpsNavigation('javascript:alert(1)'), /HTTPS/);
    assert.throws(() => validateHttpsNavigation('http://claude.ai'), /HTTPS/);
  });

  it('limits in-app navigation to the selected provider domain', () => {
    const claude = getProvider('claude');
    assert.ok(claude);
    assert.equal(validateProviderNavigation('claude.ai/settings', claude), 'https://claude.ai/settings');
    assert.throws(() => validateProviderNavigation('https://example.com', claude), /provider/);
  });

  it('clips remote browser view bounds and rejects malformed requests', () => {
    assert.deepEqual(validateBrowserBounds({ x: 200, y: 60, width: 900, height: 800 }, { width: 1000, height: 700 }), {
      x: 200, y: 60, width: 800, height: 640,
    });
    assert.equal(validateBrowserBounds({ x: -1, y: 0, width: 10, height: 10 }, { width: 100, height: 100 }), null);
    assert.equal(validateBrowserBounds({ x: 0, y: 0, width: Number.NaN, height: 10 }, { width: 100, height: 100 }), null);
  });

  it('validates capsule content before it enters the local store', () => {
    assert.equal(validateCapsule({ title: ' Brief ', decisions: [' local '], constraints: [], completed: [], pending: [] }).title, 'Brief');
    assert.throws(() => validateCapsule({ title: '', decisions: [], constraints: [], completed: [], pending: [] }), /title is required/);
    assert.throws(() => validateCapsule({ title: 'Brief', decisions: 'not a list' }), /list of text items/);
  });
});
