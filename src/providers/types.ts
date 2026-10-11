// Made by Alay
export interface ProviderDefinition {
  readonly id: string;
  readonly name: string;
  readonly glyph: string;
  readonly homepage: string;
  /** Provider-owned hostnames. These are the only hosts accepted from the address field. */
  readonly allowedDomains: readonly string[];
  /** Narrow identity-provider hostnames required by the provider's own sign-in redirects. */
  readonly authDomains: readonly string[];
  readonly accountManagement: { readonly multipleAccounts: true; readonly signIn: 'manual' };
  readonly capabilities: { readonly extractContext: true; readonly injectCapsule: true };
  readonly limitations: readonly string[];
}
