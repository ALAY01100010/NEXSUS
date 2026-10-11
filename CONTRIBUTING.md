<!-- Made by Alay -->

# Contributing to NEXSUS

Thanks for your interest in contributing. NEXSUS is primarily created and maintained by Alay, and community contributions are welcome.

## Development setup

- Install Node.js 24 or newer. The project does not pin a Node.js version in `package.json`; Node 24 is the current development baseline.
- Install pnpm 11.25.0, as declared by the `packageManager` field in `package.json`.
- Install dependencies and launch the desktop app:

  ```sh
  pnpm install
  pnpm dev
  ```

- Before opening a pull request, run:

  ```sh
  pnpm typecheck
  pnpm test
  pnpm build
  pnpm test:electron
  ```

- Build a local package with `pnpm package`. Targets are configured for Windows NSIS, macOS DMG, and Linux AppImage; public installers are not currently published.

## Project structure

- `src/electron/` — privileged main process, preload bridge, IPC validation, SQLite metadata store, and Capsule import/export.
- `src/providers/` — provider registry, navigation policy, and provider-specific conversation/composer adapters.
- `src/renderer/` — local workspace UI and styles.
- `src/shared/` — contracts shared across the renderer and main process.
- `src/assets/` — locally bundled NEXSUS logo.
- `tests/` — unit, Capsule, IPC, adapter, and Electron session integration tests.
- `scripts/` — build asset copying and Electron integration test runner.
- `build/icon.ico` — Windows app and installer icon resource.

## Contribution workflow

1. Fork the repository.
2. Create a focused branch for your change.
3. Make a focused change and add or update tests where appropriate.
4. Run typecheck, tests, and build; run the Electron session test when your change affects account or session behavior.
5. Update documentation when behavior, privacy, security, or setup instructions change.
6. Open a pull request with a clear description, motivation, and validation results.

Please preserve account/session isolation, local-first privacy, secure IPC, provider security boundaries, Context Capsule integrity, and existing test coverage. Provider DOM adapters are subject to website changes, so distinguish automated coverage from live provider verification in pull requests.

Contributions must not collect provider passwords, export authentication cookies or tokens, bypass rate limits or CAPTCHAs, automate account rotation, circumvent provider security controls, silently add telemetry, or send user/provider data to an external backend without explicit project approval.

**Primary maintainer: Alay**
