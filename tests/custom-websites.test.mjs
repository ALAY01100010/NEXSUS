// Made by Alay
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { customWebsiteDisplayName, fetchCustomWebsiteFavicon, normalizeCustomWebsiteUrl, validateCustomWebsiteNavigation } from '../src/electron/custom-websites.ts';

describe('custom website support', () => {
  it('requires absolute credential-free HTTPS URLs and normalizes trailing slashes', () => {
    assert.equal(normalizeCustomWebsiteUrl('https://amazon.in///'), 'https://amazon.in/');
    assert.equal(normalizeCustomWebsiteUrl('https://example.com/path///#fragment'), 'https://example.com/path///#fragment');
    for (const value of ['javascript:alert(1)', 'data:text/html,hi', 'file:///C:/secret', 'http://example.com', 'C:\\secret\\file.html', 'https://user:pass@example.com']) {
      assert.throws(() => normalizeCustomWebsiteUrl(value));
    }
    assert.throws(() => normalizeCustomWebsiteUrl('example.com'), /absolute HTTPS/);
  });

  it('derives human-readable names from hostnames', () => {
    assert.equal(customWebsiteDisplayName('www.amazon.in'), 'Amazon');
    assert.equal(customWebsiteDisplayName('github.com'), 'GitHub');
    assert.equal(customWebsiteDisplayName('stackoverflow.com'), 'Stack Overflow');
    assert.equal(customWebsiteDisplayName('my_site.example.com'), 'My Site');
  });

  it('allows HTTPS navigation for custom accounts and rejects dangerous schemes/credentials', () => {
    assert.equal(validateCustomWebsiteNavigation('example.com/path'), 'https://example.com/path');
    assert.equal(validateCustomWebsiteNavigation('https://github.com/user/repo'), 'https://github.com/user/repo');
    for (const value of ['javascript:alert(1)', 'data:text/html,hi', 'file:///etc/passwd', 'http://example.com', 'https://a:b@example.com']) {
      assert.throws(() => validateCustomWebsiteNavigation(value));
    }
  });

  it('uses a declared raster favicon, falls back to /favicon.ico, and rejects SVG/oversized icons', async () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const calls = [];
    const fetcher = async (url) => {
      calls.push(String(url));
      if (String(url) === 'https://example.com/') return new Response('<link rel="icon" href="/brand.png">', { status: 200 });
      if (String(url) === 'https://example.com/brand.png') return new Response(png, { status: 200 });
      throw new Error('Unexpected request');
    };
    assert.equal(await fetchCustomWebsiteFavicon('https://example.com', fetcher), `data:image/png;base64,${png.toString('base64')}`);
    assert.deepEqual(calls, ['https://example.com/', 'https://example.com/brand.png']);

    const fallbackCalls = [];
    const fallback = await fetchCustomWebsiteFavicon('https://example.com', async (url) => {
      fallbackCalls.push(String(url));
      if (String(url) === 'https://example.com/') return new Response('<link rel="icon" href="/unsafe.svg">', { status: 200 });
      if (String(url) === 'https://example.com/unsafe.svg') return new Response('<svg/>', { status: 200 });
      if (String(url) === 'https://example.com/favicon.ico') return new Response(png, { status: 200 });
      throw new Error('Unexpected request');
    });
    assert.equal(fallback, `data:image/png;base64,${png.toString('base64')}`);
    assert.equal(fallbackCalls.at(-1), 'https://example.com/favicon.ico');
    assert.equal(await fetchCustomWebsiteFavicon('https://127.0.0.1/', async () => { throw new Error('must not fetch IPs'); }), null);
    assert.equal(await fetchCustomWebsiteFavicon('https://example.com', async (url) => String(url).endsWith('/') ? new Response('<link rel="icon" href="/icon.svg">') : new Response('<svg/>')), null);
    assert.equal(await fetchCustomWebsiteFavicon('https://example.com', async () => new Response('x'.repeat(300_000), { status: 200 })), null);
    const failedHomeFallback = await fetchCustomWebsiteFavicon('https://example.com', async (url) => {
      if (String(url) === 'https://example.com/') throw new Error('offline home page');
      return new Response(png, { status: 200 });
    });
    assert.equal(failedHomeFallback, `data:image/png;base64,${png.toString('base64')}`);
  });
});
