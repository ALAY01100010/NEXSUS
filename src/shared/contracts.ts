// Made by Alay
export interface Account {
  id: string;
  providerId: string;
  providerName: string;
  displayName: string;
  createdAt: string;
  lastUsedAt: string | null;
  lastUrl: string | null;
  isFavorite: boolean;
  sortOrder: number;
}

export interface Capsule {
  id: string;
  title: string;
  objective: string;
  summary: string;
  currentState: string;
  decisions: string[];
  constraints: string[];
  completed: string[];
  pending: string[];
  nextAction: string;
  technicalContext: Record<string, unknown>;
  files: string[];
  conversationExcerpt: string;
  versionGroupId: string;
  version: number;
  isCurrent: boolean;
  source: CapsuleSource | null;
  attachments: CapsuleAttachment[];
  createdAt: string;
  updatedAt: string;
}

export interface CapsuleSource {
  providerId: string;
  providerName: string;
  accountId: string;
  accountName: string;
  conversationUrl: string;
  extractedAt: string;
}

export interface CapsuleAttachment {
  filename: string;
  mimeType?: string;
  size?: number;
  localReference?: string;
}

export interface CapsuleInput {
  title: string;
  objective: string;
  summary: string;
  currentState?: string;
  decisions: string[];
  constraints: string[];
  completed: string[];
  pending: string[];
  nextAction: string;
  technicalContext?: Record<string, unknown>;
  files?: string[];
  conversationExcerpt?: string;
  source?: CapsuleSource | null;
  attachments?: CapsuleAttachment[];
}

export interface CapsuleExtraction extends CapsuleInput {
  title: string;
  source: CapsuleSource;
}

export interface NexsusApi {
  version: string;
  providers: { list(): Promise<import('../providers/types.js').ProviderDefinition[]> };
  accounts: {
    list(): Promise<Account[]>;
    create(providerId: string, displayName: string): Promise<Account>;
    rename(id: string, displayName: string): Promise<Account>;
    remove(id: string): Promise<void>;
    activate(id: string): Promise<void>;
    favorite(id: string, isFavorite: boolean): Promise<Account>;
    move(id: string, direction: -1 | 1): Promise<void>;
    clearSession(id: string): Promise<void>;
  };
  capsules: {
    list(): Promise<Capsule[]>;
    create(input: CapsuleInput): Promise<Capsule>;
    update(id: string, input: CapsuleInput): Promise<Capsule>;
    remove(id: string): Promise<void>;
    duplicate(id: string): Promise<Capsule>;
    versions(id: string): Promise<Capsule[]>;
    createVersion(id: string, input: CapsuleInput): Promise<Capsule>;
    restoreVersion(id: string): Promise<Capsule>;
    copy(id: string): Promise<void>;
    export(id: string): Promise<void>;
    import(): Promise<Capsule | null>;
    inject(id: string, accountId: string): Promise<void>;
  };
  browser: {
    back(): void;
    forward(): void;
    reload(): void;
    stop(): void;
    navigate(url: string): void;
    openExternally(): void;
    setOverlayOpen(isOpen: boolean): void;
    updateBounds(bounds: { x: number; y: number; width: number; height: number }): void;
    extractCapsule(): Promise<CapsuleExtraction>;
    onState(callback: (state: { url: string; title: string; loading: boolean; canGoBack: boolean; canGoForward: boolean; error: string | null; recoveryAvailable: boolean }) => void): () => void;
  };
  onError(callback: (message: string) => void): () => void;
  onAccountsChanged(callback: () => void): () => void;
  onCapsulesChanged(callback: () => void): () => void;
}
