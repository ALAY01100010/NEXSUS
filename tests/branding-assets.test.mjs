// Made by Alay
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';
import '../scripts/copy-assets.mjs';

describe('official NEXSUS branding assets', () => {
  it('packages the supplied PNG unchanged for offline renderer use', async () => {
    const source = await readFile(new URL('../src/assets/nexsus-logo.png', import.meta.url));
    const packaged = await readFile(new URL('../dist/assets/nexsus-logo.png', import.meta.url));
    assert.deepEqual(packaged, source);
    assert.equal(source.toString('hex', 0, 8), '89504e470d0a1a0a');
  });

  it('references a local Windows icon in the installer configuration', async () => {
    const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
    const icon = await readFile(new URL('../build/icon.ico', import.meta.url));
    assert.equal(packageJson.build.win.icon, 'build/icon.ico');
    assert.deepEqual(packageJson.build.extraResources, [{ from: 'build/icon.ico', to: 'icon.ico' }]);
    assert.equal(icon.readUInt16LE(0), 0);
    assert.equal(icon.readUInt16LE(2), 1);
    assert.ok(icon.readUInt32LE(14) > 0);
    assert.equal(icon.readUInt32BE(22 + 16), 256);
    assert.equal(icon.readUInt32BE(22 + 20), 256);
  });
});
