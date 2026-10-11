// Made by Alay
import type { ProviderDefinition } from './types.js';

const definitions: readonly ProviderDefinition[] = [
  {
    id: 'claude',
    name: 'Claude',
    glyph: '✳',
    homepage: 'https://claude.ai/',
    allowedDomains: ['claude.ai'],
    authDomains: ['accounts.google.com', 'appleid.apple.com'],
    accountManagement: { multipleAccounts: true, signIn: 'manual' },
    capabilities: { extractContext: true, injectCapsule: true },
    limitations: ['Conversation extraction depends on the visible Claude page DOM and needs live verification.'],
  },
  {
    id: 'chatgpt',
    name: 'ChatGPT',
    glyph: '◉',
    homepage: 'https://chatgpt.com/',
    allowedDomains: ['chatgpt.com'],
    authDomains: ['auth.openai.com', 'auth0.openai.com', 'accounts.google.com', 'appleid.apple.com', 'login.microsoftonline.com'],
    accountManagement: { multipleAccounts: true, signIn: 'manual' },
    capabilities: { extractContext: true, injectCapsule: true },
    limitations: ['Conversation extraction and composer insertion depend on the live ChatGPT page DOM and need live verification.'],
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    glyph: '✦',
    homepage: 'https://gemini.google.com/',
    allowedDomains: ['gemini.google.com'],
    authDomains: ['accounts.google.com', 'consent.google.com'],
    accountManagement: { multipleAccounts: true, signIn: 'manual' },
    capabilities: { extractContext: true, injectCapsule: true },
    limitations: ['Conversation extraction and composer insertion depend on the live Gemini page DOM and need live verification.'],
  },
  {
    id: 'grok',
    name: 'Grok',
    glyph: '𝕏',
    homepage: 'https://grok.com/',
    allowedDomains: ['grok.com'],
    authDomains: ['x.com', 'twitter.com'],
    accountManagement: { multipleAccounts: true, signIn: 'manual' },
    capabilities: { extractContext: true, injectCapsule: true },
    limitations: ['Conversation extraction and composer insertion depend on the live Grok page DOM and need live verification.'],
  },
];

export const providers: readonly ProviderDefinition[] = definitions;

export function getProvider(id: string): ProviderDefinition | undefined {
  return providers.find((provider) => provider.id === id);
}

export function isProviderUrlAllowed(provider: ProviderDefinition, input: string): boolean {
  return isDomainAllowed(provider.allowedDomains, input);
}

export function isProviderAuthUrlAllowed(provider: ProviderDefinition, input: string): boolean {
  return isDomainAllowed(provider.authDomains, input);
}

export function isProviderNavigationAllowed(provider: ProviderDefinition, input: string): boolean {
  return isProviderUrlAllowed(provider, input) || isProviderAuthUrlAllowed(provider, input);
}

function isDomainAllowed(domains: readonly string[], input: string): boolean {
  try {
    const url = new URL(input);
    if (url.protocol !== 'https:') return false;
    return domains.some((domain) => url.hostname === domain || url.hostname.endsWith(`.${domain}`));
  } catch {
    return false;
  }
}
