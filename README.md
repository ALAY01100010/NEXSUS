<!-- Made by Alay -->

# NEXSUS

**All Your AI Accounts. One Workspace.**

NEXSUS is an open-source desktop workspace for using your existing AI provider accounts in one place. It displays the providers' actual websites and keeps each account in its own persistent browser session.

## Features

- A dark desktop workspace with account and Context Capsule sidebars, global search, resizable sidebar, and browser controls.
- Multiple Claude accounts, each using a separate persistent Chromium session partition.
- Local SQLite storage for account and capsule metadata.
- Manual Context Capsules with editing, duplication, clipboard copy, and JSON or Markdown import/export.
- Secure IPC boundary; remote provider pages have no preload bridge, Node.js integration, or application APIs.
- Windows, macOS, and Linux packaging targets.

## Screenshot

The first interactive product screenshot will be added after the desktop launch workflow has been verified on a supported developer machine.

## Supported providers

| Provider | Status |
| --- | --- |
| Claude | Supported at `https://claude.ai`. Multiple persistent, isolated accounts are supported. |
| ChatGPT, Gemini, Perplexity | Not implemented yet. |

NEXSUS uses the real provider website. It does not recreate a chatbot interface. Embedded sign-in flows may change when a provider updates its website; NEXSUS does not bypass provider restrictions or automate account rotation.

## Install

There are no published installers yet. Windows NSIS, macOS DMG, and Linux AppImage targets are configured for release builds.

## Development

Requirements: Node.js 24 or newer and pnpm 11.25.0.

```sh
pnpm install
pnpm dev
```

Build, type-check, and test:

```sh
pnpm typecheck
pnpm test
pnpm build
```

Create a package for the current operating system:

```sh
pnpm package
```

## Local data and privacy

NEXSUS has no cloud account, mandatory server, or telemetry. Application metadata is stored in `nexsus.sqlite` under Electron's local `userData` directory. Provider cookies, local storage, and other session state are stored in Chromium profile partitions in Electron's local session data directory. Those local files contain sensitive sign-in state and should be protected like credentials on the device.

NEXSUS does not ask for provider passwords, copy authentication cookies, or send provider session data, conversations, or credentials to a NEXSUS service. Context Capsules are created and transferred manually by the user.

## Security model

Electron's main process owns account metadata and browser views. The local renderer uses a narrow preload API with context isolation and sandboxing. Provider websites run in separate `WebContentsView` instances with Node integration disabled, no NEXSUS preload, HTTPS-only navigation, and separate persistent partitions. Permission requests and pop-up windows from provider pages are denied by default.

IPC calls validate the sender frame and the received identifiers, text, URLs, and browser bounds. Logs are reserved for technical startup diagnostics and do not include page content or session data. See [SECURITY.md](SECURITY.md) for reporting guidance.

## Limitations

- Claude is the only configured provider in this release milestone.
- The app has not yet been launch-verified in this managed Windows environment. Run `pnpm dev` on a regular desktop machine to exercise Electron's Chromium window.
- Provider website changes and sign-in policies can affect embedded browsing. NEXSUS does not work around those restrictions.
- Settings, drag-to-reorder accounts, favorites, detached windows, and broad keyboard customization remain on the roadmap.

## Roadmap

1. Project foundation and provider registry
2. Premium workspace interface
3. Embedded Chromium browser workspace
4. Claude account workflow and persistent isolated sessions
5. Account management and fast switching
6. Context Capsules
7. Additional providers
8. Security review, integration tests, and Windows release preparation

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup and project principles. Read [SECURITY.md](SECURITY.md) before reporting a vulnerability.

## License

NEXSUS is distributed under the MIT License. See [LICENSE](LICENSE).
