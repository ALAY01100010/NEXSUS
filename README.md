<!-- Made by Alay -->

# NEXSUS — All Your AI Accounts. One Workspace.

NEXSUS is a local-first desktop workspace for using multiple AI provider accounts in one application, with a separate persistent browser session for each account. It uses the providers' actual websites rather than recreating their chat interfaces.

> NEXSUS is primarily created and maintained by Alay, with the project open to community contributions.

## Providers

| Provider | Account sessions | Capsule adapters | Live provider verification |
| --- | --- | --- | --- |
| Claude | Multiple isolated persistent sessions | Extraction and composer injection implemented | Live verified |
| ChatGPT | Multiple isolated persistent sessions | Extraction and composer injection implemented | Live verified |
| Gemini | Multiple isolated persistent sessions | Extraction and composer injection implemented | Live verified |
| Grok | Multiple isolated persistent sessions | Extraction and composer injection implemented | Live verified |

Provider adapters inspect visible conversation DOM and insert Capsule text into provider-specific composers. Automated tests cover adapter selection, mapping, selectors, and injection behavior. These adapters have also been tested against authenticated live provider sessions. Provider website changes may require adapter updates; live verification does not guarantee compatibility with every website state or account configuration.

## Context Capsules

Context Capsules preserve useful, provider-independent working context for a user to carry between AI sessions. A Capsule can include an objective and summary, decisions, constraints, completed work, current state, pending work and next action, technical context, conversation excerpts, source metadata, and attachment metadata.

Capsules support editing, duplication, version history and restoration, and JSON or Markdown import/export. A user can choose a target account, review the context, and explicitly inject it into that provider's composer. The Capsule workflow has been tested through the actual provider composer workflow. Injection does not send or submit the message. NEXSUS does not automatically migrate conversations between providers.

## Architecture and privacy

- Electron hosts the local workspace and provider pages in `WebContentsView` instances.
- Each account receives a distinct persistent Electron session partition; accounts do not share cookies or browser storage.
- SQLite stores local account and Capsule metadata. Provider session data remains in local Chromium profile storage.
- The trusted application renderer uses a narrow preload API, context isolation, sandboxing, and validated IPC. Provider pages have no NEXSUS preload or Node.js integration.
- Provider navigation is limited to HTTPS provider and configured sign-in hosts. Popups are limited to configured authentication hosts, and provider permission requests are denied.
- The local app uses a restrictive Content Security Policy and bundled assets. There is no mandatory cloud backend or telemetry.

Users sign in on the providers' websites; NEXSUS does not collect provider passwords or export provider cookies or tokens. It does not send provider session data to a NEXSUS cloud service, use private provider APIs to bypass normal website access, rotate accounts automatically, or bypass CAPTCHAs or provider security controls. Protect the local NEXSUS data directory as sensitive authentication data.

See [SECURITY.md](SECURITY.md) for the security boundaries and vulnerability reporting guidance.

## Installation and development

There are no public installers yet. Local packaging targets are configured for Windows NSIS, macOS DMG, and Linux AppImage.

Development uses Node.js 24 or newer and pnpm 11.25.0. The pnpm version is declared in `package.json`; a Node.js version is not pinned there.

```sh
pnpm install
pnpm dev
```

Run validation:

```sh
pnpm typecheck
pnpm test
pnpm build
pnpm test:electron
```

Create a local package for the current operating system:

```sh
pnpm package
```

## Validation status

| Area | Status |
| --- | --- |
| Provider registry, account partitions, Capsule adapters | Implemented |
| Typecheck, unit tests, and production build | Automated-tested |
| Electron persistence and account isolation | Automated-tested; eight account partitions passed switching and restart checks |
| Authenticated provider sign-in, live extraction, and live injection | Live verified |

The latest recorded automated checks passed: `pnpm typecheck`, `pnpm test` (33 tests), `pnpm build`, and `pnpm test:electron`. The Electron integration test exercises persistent, isolated partitions using a local test page. In addition, authenticated live testing has been performed for the configured provider workflows, including conversation extraction and Capsule composer injection.

## Project structure

- `src/electron/` — Electron main process, IPC validation, SQLite store, and Capsule import/export.
- `src/providers/` — provider registry, navigation policy, and context adapters.
- `src/renderer/` — local workspace UI and bundled brand styles.
- `src/shared/` — shared contracts across the IPC boundary.
- `src/assets/` — bundled official NEXSUS logo.
- `tests/` and `scripts/` — unit and Electron session integration checks.
- `build/icon.ico` — Windows application and installer icon source.

## Screenshots

No product screenshot is committed yet. Screenshots will be added after the desktop UI has been visually verified on a supported machine.

## Roadmap

- Ongoing maintenance of provider-specific extraction and composer adapters as provider websites evolve.
- Broader provider and platform testing, plus public release preparation.
- Additional contributor documentation and community contributions.

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup and contribution guidance. NEXSUS is distributed under the [MIT License](LICENSE).
