// Made by Alay
import type { CapsuleInput } from '../shared/contracts.js';
import type { ProviderDefinition } from '../providers/types.js';
import { isProviderUrlAllowed } from '../providers/registry.ts';
import { normalizeCapsule } from './store.ts';

export interface BrowserBounds { x: number; y: number; width: number; height: number; }

export function validateId(value: unknown): string {
  if (typeof value !== 'string' || !/^[0-9a-f-]{36}$/i.test(value)) throw new Error('Invalid item identifier.');
  return value;
}

export function validateText(value: unknown, label: string, maxLength: number): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > maxLength) throw new Error(`${label} is invalid.`);
  return value.trim();
}

export function validateCapsule(value: unknown): CapsuleInput {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('Invalid capsule content.');
  return normalizeCapsule(value as CapsuleInput);
}

export function validateHttpsNavigation(value: unknown): string {
  if (typeof value !== 'string' || value.length > 2048) throw new Error('Enter a valid web address.');
  const candidate = value.trim();
  if (!candidate) throw new Error('Enter a web address.');
  const url = new URL(/^[a-z][a-z\d+.-]*:/i.test(candidate) ? candidate : `https://${candidate}`);
  if (url.protocol !== 'https:') throw new Error('Only secure HTTPS pages can be opened in NEXSUS.');
  return url.href;
}

export function validateProviderNavigation(value: unknown, provider: ProviderDefinition): string {
  const url = validateHttpsNavigation(value);
  if (!isProviderUrlAllowed(provider, url)) throw new Error('Only pages belonging to this account’s provider can be opened inside NEXSUS.');
  return url;
}

export function validateBrowserBounds(value: unknown, viewport: { width: number; height: number }): BrowserBounds | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const bounds = value as Record<string, unknown>;
  const values = [bounds.x, bounds.y, bounds.width, bounds.height];
  if (values.some((number) => typeof number !== 'number' || !Number.isFinite(number))) return null;
  const [rawX, rawY, rawWidth, rawHeight] = values as number[];
  if (rawX < 0 || rawY < 0 || rawWidth < 0 || rawHeight < 0 || values.some((number) => (number as number) > 10000)) return null;
  if (rawX >= viewport.width || rawY >= viewport.height) return null;
  return {
    x: Math.round(rawX), y: Math.round(rawY),
    width: Math.round(Math.min(rawWidth, viewport.width - rawX)),
    height: Math.round(Math.min(rawHeight, viewport.height - rawY)),
  };
}
