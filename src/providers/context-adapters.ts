/* NEXSUS · Made by Alay */
import type { CapsuleExtraction, CapsuleSource } from '../shared/contracts.js';
import { getProvider } from './registry.ts';

export interface ConversationTurn { role: 'user' | 'assistant'; text: string; }
export interface ConversationSnapshot { url: string; title: string; turns: ConversationTurn[]; attachments?: { filename: string; mimeType?: string; size?: number }[]; truncated?: boolean; }
export interface ProviderAdapter {
  readonly id: string;
  readonly name: string;
  validateProviderPage(url: string): boolean;
  canExtractContext(url: string): boolean;
  buildConversationReadScript(): string;
  extractConversationContext(snapshot: ConversationSnapshot, source: CapsuleSource): CapsuleExtraction;
  canInjectContext(url: string): boolean;
  buildInjectionScript(context: string): string;
  injectContext(context: string, execute: (script: string) => Promise<unknown>): Promise<'inserted' | 'missing' | 'occupied' | 'rejected'>;
}

interface AdapterSelectors {
  messageSelectors: string;
  composerSelectors: string[];
  attachmentSelectors: string;
}

const selectorSets: Record<string, AdapterSelectors> = {
  claude: {
    messageSelectors: 'main [data-testid="user-message"],main [data-testid="assistant-message"],main [data-testid*="conversation-turn"],main [data-testid*="assistant-response"],main [data-message-author-role]',
    composerSelectors: ['[data-testid*="composer"] [contenteditable="true"]', 'main [contenteditable="true"][role="textbox"]', 'main textarea'],
    attachmentSelectors: 'main [data-testid*="attachment"],main [data-testid*="file"]',
  },
  chatgpt: {
    messageSelectors: 'main [data-message-author-role="user"],main [data-message-author-role="assistant"]',
    composerSelectors: ['#prompt-textarea', '[data-testid="prompt-textarea"]', 'main [contenteditable="true"][role="textbox"]'],
    attachmentSelectors: 'main [data-testid*="attachment"],main [data-testid*="file"]',
  },
  gemini: {
    messageSelectors: 'main [data-test-id="user-query"],main [data-test-id="model-response"],main [data-testid="user-query"],main [data-testid="model-response"],main [data-message-author-role]',
    composerSelectors: ['rich-textarea [contenteditable="true"]', '[data-test-id="input-area"] [contenteditable="true"]', 'main [contenteditable="true"][role="textbox"]'],
    attachmentSelectors: 'main [data-test-id*="attachment"],main [data-testid*="attachment"],main [data-testid*="file"]',
  },
  grok: {
    messageSelectors: 'main [data-testid*="user-message"],main [data-testid*="assistant-message"],main [data-testid*="message-bubble"],main [data-message-author-role],main [data-message-id]',
    composerSelectors: ['main [data-testid*="composer"] textarea', 'main [data-testid*="composer"] [contenteditable="true"]', 'main [contenteditable="true"][role="textbox"]', 'main textarea'],
    attachmentSelectors: 'main [data-testid*="attachment"],main [data-testid*="file"]',
  },
};

function createAdapter(providerId: string): ProviderAdapter {
  const provider = getProvider(providerId);
  const selectors = selectorSets[providerId];
  if (!provider || !selectors) throw new Error(`No visible-page adapter is configured for ${providerId}.`);
  return {
    id: provider.id,
    name: provider.name,
    validateProviderPage(url) {
      try {
        const parsed = new URL(url);
        return parsed.protocol === 'https:' && provider.allowedDomains.some((domain) => parsed.hostname === domain || parsed.hostname.endsWith(`.${domain}`));
      } catch { return false; }
    },
    canExtractContext(url) { return this.validateProviderPage(url); },
    buildConversationReadScript() {
      const messageSelectors = JSON.stringify(selectors.messageSelectors);
      const attachmentSelectors = JSON.stringify(selectors.attachmentSelectors);
      return `(async () => {
        const root = document.querySelector('main,[role="main"]');
        if (!root) return { url: location.href, title: document.title, turns: [], attachments: [] };
        const visible = (node) => node.getClientRects().length > 0 && node.getAttribute('aria-hidden') !== 'true';
        const candidates = [...root.querySelectorAll(${messageSelectors})];
        const turns = [];
        const seen = new Set();
        for (const node of candidates) {
          if (!visible(node)) continue;
          const testId = (node.getAttribute('data-testid') || node.getAttribute('data-test-id') || '').toLowerCase();
          const roleValue = (node.getAttribute('data-message-author-role') || node.getAttribute('data-role') || node.getAttribute('aria-roledescription') || '').toLowerCase();
          let role = roleValue === 'user' || testId.includes('user-message') || testId === 'user-query' ? 'user' : ['assistant','model'].includes(roleValue) || /assistant|response|model/.test(testId) ? 'assistant' : '';
          let messageNode = node;
          if (!role) {
            const child = node.querySelector('[data-message-author-role="user"],[data-message-author-role="assistant"],[data-test-id="user-query"],[data-test-id="model-response"],[data-testid="user-message"],[data-testid="assistant-message"]');
            if (child) {
              const childId = (child.getAttribute('data-testid') || child.getAttribute('data-test-id') || '').toLowerCase();
              const childRole = (child.getAttribute('data-message-author-role') || child.getAttribute('data-role') || '').toLowerCase();
              role = childRole === 'user' || childId.includes('user') ? 'user' : ['assistant','model'].includes(childRole) || /assistant|response|model/.test(childId) ? 'assistant' : '';
              messageNode = child;
            }
          }
          if (!role) continue;
          const copy = messageNode.cloneNode(true);
          copy.querySelectorAll('button,[role="button"],[aria-label]').forEach((control) => control.remove());
          const text = (copy.innerText || copy.textContent || '').replace(/\\u0000/g, '').trim();
          if (!text || seen.has(role + '\\n' + text)) continue;
          seen.add(role + '\\n' + text);
          turns.push({ role, text: text.slice(0, 30000) });
        }
        const attachmentNodes = [...root.querySelectorAll(${attachmentSelectors})].filter(visible).slice(0, 30);
        const attachments = attachmentNodes.map((node) => {
          const sizeValue = Number(node.getAttribute('data-size') || node.getAttribute('data-file-size'));
          const filename = node.getAttribute('data-filename') || node.getAttribute('aria-label') || node.getAttribute('title') || (node.innerText || '').trim();
          return { filename, mimeType: node.getAttribute('data-mime-type') || undefined, size: Number.isFinite(sizeValue) && sizeValue > 0 ? sizeValue : undefined };
        }).filter((item) => item.filename);
        return { url: location.href, title: document.title, turns: turns.slice(0, 201), truncated: turns.length > 200, attachments };
      })()`;
    },
    extractConversationContext(snapshot, source) {
      if (!this.validateProviderPage(snapshot.url) || source.providerId !== provider.id) throw new Error(`The current page is not a supported ${provider.name} conversation.`);
      if (snapshot.truncated || snapshot.turns.length > 200) throw new Error('This conversation is larger than the safe extraction limit. NEXSUS did not create a partial capsule.');
      const turns = snapshot.turns.map((turn) => ({ role: turn.role, text: cleanText(turn.text) })).filter((turn) => turn.text.length > 0);
      if (!turns.length) throw new Error(`${provider.name} did not expose recognizable conversation messages. The page may have changed or no conversation may be open.`);
      const allText = turns.map((turn) => turn.text).join('\n');
      const users = turns.filter((turn) => turn.role === 'user');
      const assistants = turns.filter((turn) => turn.role === 'assistant');
      const objective = clip(users[0]?.text ?? '', 4000);
      const decisions = collectLines(allText, /\b(?:decision|decided|we(?:'|’)ll use|we will use|chosen|selected)\b/i);
      const constraints = collectLines(allText, /\b(?:must|must not|should not|shouldn't|cannot|can't|constraint|do not|don't|only)\b/i);
      const completed = collectLines(allText, /\b(?:completed|implemented|finished|built|fixed|shipped|created)\b/i);
      const pending = collectLines(allText, /\b(?:pending|todo|to do|next step|still need|unresolved|remaining|not yet)\b/i);
      const lastUser = users.at(-1)?.text ?? '';
      const currentState = clip(assistants.at(-1)?.text ?? lastUser, 1800);
      const priorTurns = turns.slice(1, -1).slice(-4);
      const excerpt = priorTurns.map(({ role, text }) => `### ${role === 'user' ? 'User' : 'Assistant'}\n${clip(text, 900)}`).join('\n\n').slice(0, 5000);
      const code = [...allText.matchAll(/```[\w-]*\s*\n([\s\S]*?)```/g)].map((match) => match[1]?.trim() ?? '').filter(Boolean).slice(-8).join('\n\n');
      const inlineFiles = [...allText.matchAll(/(?:`([^`]+\.(?:[cm]?[jt]sx?|json|css|html|md|py|rs|go|sql))`|(?:^|\s)((?:[\w.-]+\/)+[\w.-]+\.[\w.-]+))/gm)].map((match) => match[1] ?? match[2] ?? '').filter(Boolean);
      const title = meaningfulTitle(snapshot.title, provider.name) ?? (clip(objective.split(/[.!?\n]/)[0] ?? '', 72) || `${provider.name} conversation`);
      const summarySource = assistants.slice(-2, -1)[0]?.text ?? (users.length > 1 ? users[1]?.text : '');
      return {
        title: clip(title, 120), objective, summary: clip(summarySource ?? '', 1600), currentState, decisions, constraints, completed,
        pending: pending.length ? pending : lastUser ? [clip(lastUser, 1000)] : [],
        nextAction: pending[0] ?? (lastUser ? `Continue from: ${clip(lastUser, 240)}` : 'Review the extracted context and choose the next step.'),
        technicalContext: {
          ...(code ? { codeExcerpts: code.slice(-4200) } : {}),
          ...(inlineFiles.length ? { mentionedFiles: [...new Set(inlineFiles)].slice(0, 40) } : {}),
        },
        files: [...new Set(inlineFiles)].slice(0, 40), conversationExcerpt: excerpt,
        attachments: snapshot.attachments ?? [], source,
      };
    },
    canInjectContext(url) { return this.validateProviderPage(url); },
    buildInjectionScript(context) {
      return `(async () => {
        const selectors = ${JSON.stringify(selectors.composerSelectors)};
        let editor = null;
        for (const selector of selectors) { editor = document.querySelector(selector); if (editor) break; }
        if (!editor) return 'missing';
        const isValueEditor = editor instanceof HTMLTextAreaElement || editor instanceof HTMLInputElement;
        const existing = (isValueEditor ? editor.value : editor.innerText || editor.textContent || '').trim();
        if (existing) return 'occupied';
        editor.focus();
        if (isValueEditor) {
          const prototype = editor instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
          const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
          if (!setter) return 'rejected';
          setter.call(editor, ${JSON.stringify(context)});
          editor.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: ${JSON.stringify(context)} }));
        } else {
          const inserted = document.execCommand('insertText', false, ${JSON.stringify(context)});
          if (!inserted) return 'rejected';
          editor.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: ${JSON.stringify(context)} }));
        }
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        const finalText = (isValueEditor ? editor.value : editor.innerText || editor.textContent || '');
        return finalText.includes(${JSON.stringify(context.slice(0, 80))}) ? 'inserted' : 'rejected';
      })()`;
    },
    async injectContext(context, execute) {
      const result = await execute(this.buildInjectionScript(context));
      return result === 'inserted' || result === 'missing' || result === 'occupied' ? result : 'rejected';
    },
  };
}

const adapters: readonly ProviderAdapter[] = ['claude', 'chatgpt', 'gemini', 'grok'].map(createAdapter);

export function getProviderAdapter(providerId: string): ProviderAdapter | undefined {
  return adapters.find((adapter) => adapter.id === providerId);
}

function cleanText(value: string): string { return value.replace(/\u0000/g, '').replace(/[ \t]+\n/g, '\n').trim(); }
function clip(value: string, length: number): string { return value.length > length ? `${value.slice(0, length - 1).trimEnd()}…` : value; }
function meaningfulTitle(value: string, providerName: string): string | null { const clean = value.replace(new RegExp(`\\s*[|·-]\\s*${providerName}.*$`, 'i'), '').trim(); return !clean || new RegExp(`^${providerName}$`, 'i').test(clean) ? null : clean; }
function collectLines(text: string, pattern: RegExp): string[] {
  const matches: string[] = [];
  let remaining = 8000;
  for (const line of text.split(/\r?\n/)) {
    const clean = line.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').trim();
    if (clean && pattern.test(clean) && !matches.includes(clean) && remaining > 0) {
      const item = clip(clean, Math.min(1000, remaining));
      matches.push(item);
      remaining -= item.length;
    }
  }
  return matches;
}
