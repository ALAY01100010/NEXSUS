// Made by Alay
import { isIP } from 'node:net';

const maxFaviconBytes = 256 * 1024;
const timeoutMs = 2500;

export function normalizeCustomWebsiteUrl(value: unknown): string {
  if (typeof value !== 'string' || value.length > 2048) throw new Error('Enter a valid HTTPS website address.');
  const candidate = value.trim();
  if (!candidate) throw new Error('Enter a website address.');
  let url: URL;
  try { url = new URL(candidate); } catch { throw new Error('Enter a valid absolute HTTPS website address.'); }
  if (url.protocol !== 'https:' || !url.hostname || url.username || url.password) throw new Error('Custom websites must use HTTPS and cannot include embedded credentials.');
  if (/^\/+$/u.test(url.pathname)) url.pathname = '/';
  return url.href;
}

export function validateCustomWebsiteNavigation(value: unknown): string {
  if (typeof value !== 'string' || value.length > 2048) throw new Error('Enter a valid HTTPS web address.');
  const candidate = value.trim();
  const normalized = /^[a-z][a-z\d+.-]*:/i.test(candidate) ? candidate : `https://${candidate}`;
  let url: URL;
  try { url = new URL(normalized); } catch { throw new Error('Enter a valid HTTPS web address.'); }
  if (url.protocol !== 'https:' || !url.hostname || url.username || url.password) throw new Error('Custom websites can navigate only to HTTPS pages without embedded credentials.');
  return url.href;
}

export function customWebsiteDisplayName(hostname: string): string {
  const cleanHost = hostname.toLowerCase().replace(/^www\./, '').replace(/\.$/, '');
  if (!cleanHost || isIP(cleanHost)) return cleanHost || 'Website';
  const labels = cleanHost.split('.');
  const secondLevelDomains = new Set(['co', 'com', 'org', 'net', 'gov', 'ac', 'edu']);
  const name = labels.length >= 3 && labels.at(-1)!.length === 2 && secondLevelDomains.has(labels.at(-2)!) ? labels.at(-3)! : labels[0]!;
  const commonNames: Record<string, string> = { github: 'GitHub', stackoverflow: 'Stack Overflow' };
  if (commonNames[name]) return commonNames[name]!;
  return name.split(/[-_]+/).filter(Boolean).map((part) => part[0]!.toUpperCase() + part.slice(1)).join(' ') || 'Website';
}

export async function fetchCustomWebsiteFavicon(
  websiteUrl: string,
  fetcher: typeof fetch = fetch,
): Promise<string | null> {
  const origin = new URL(normalizeCustomWebsiteUrl(websiteUrl));
  // Do not make the app process fetch local network or literal-IP resources.
  if (isIP(origin.hostname)) return null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    let htmlText = '';
    let documentUrl = origin.href;
    try {
      const response = await fetcher(origin.href, { signal: controller.signal, redirect: 'follow' });
      documentUrl = response.url || origin.href;
      if (response.ok && new URL(documentUrl).protocol === 'https:') {
        try { htmlText = new TextDecoder().decode(await readLimited(response, 512 * 1024)); } catch { /* Try the standard favicon path below. */ }
      }
    } catch { /* A site can still publish /favicon.ico when its home page is unavailable. */ }
    const iconUrls = [...htmlText.matchAll(/<link\b[^>]*>/gi)].flatMap(([tag]) => {
      const rel = tag.match(/\brel\s*=\s*["']([^"']+)["']/i)?.[1]?.toLowerCase().split(/\s+/) ?? [];
      const href = tag.match(/\bhref\s*=\s*["']([^"']+)["']/i)?.[1];
      if (!href || !(rel.includes('icon') || rel.includes('shortcut'))) return [];
      try { const url = new URL(href, documentUrl); return url.protocol === 'https:' ? [url.href] : []; } catch { return []; }
    });
    const candidates = [...iconUrls, new URL('/favicon.ico', origin).href];
    for (const candidate of [...new Set(candidates)]) {
      try {
        const iconResponse = await fetcher(candidate, { signal: controller.signal, redirect: 'follow' });
        if (!iconResponse.ok || new URL(iconResponse.url || candidate).protocol !== 'https:') continue;
        const bytes = await readLimited(iconResponse, maxFaviconBytes);
        const mime = safeRasterMime(bytes);
        if (mime) return `data:${mime};base64,${Buffer.from(bytes).toString('base64')}`;
      } catch { /* A missing or unsupported icon uses the local generic website glyph. */ }
    }
    return null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function readLimited(response: Response, maxBytes: number): Promise<Uint8Array> {
  const length = Number(response.headers.get('content-length'));
  if (Number.isFinite(length) && length > maxBytes) throw new Error('Remote resource is too large.');
  const reader = response.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) { await reader.cancel(); throw new Error('Remote resource is too large.'); }
    chunks.push(value);
  }
  const result = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.byteLength; }
  return result;
}

function safeRasterMime(bytes: Uint8Array): string | null {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) return 'image/png';
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes.length >= 6 && String.fromCharCode(...bytes.subarray(0, 3)) === 'GIF') return 'image/gif';
  if (bytes.length >= 6 && bytes[0] === 0 && bytes[1] === 0 && bytes[2] === 1 && bytes[3] === 0) return 'image/x-icon';
  return null;
}
