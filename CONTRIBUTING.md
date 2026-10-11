<!-- Made by Alay -->

# Contributing

Thanks for helping build NEXSUS. The project prioritizes reliable account isolation, user privacy, security, and a clear desktop experience.

## Development setup

- Install Node.js 24 or newer and pnpm 11.25.0.
- Run `pnpm install` and `pnpm dev`.
- Run `pnpm typecheck`, `pnpm test`, and `pnpm build` before submitting a change.

## Project structure

- `src/electron/`: privileged desktop main and preload processes.
- `src/shared/`: structured contracts shared across the desktop boundary.
- `src/renderer/`: local application interface.
- `src/providers/`: provider metadata and URL policy.
- `tests/`: database persistence, capsule format, and IPC input validation tests.

Keep provider pages isolated from privileged application APIs. Do not add credential collection, automatic account rotation, rate-limit bypasses, or telemetry without explicit user opt-in and project review.

## Changes

Keep pull requests focused, describe the user-visible behavior, and include tests for account, storage, provider-policy, or capsule behavior as those features are introduced. Update documentation when changing privacy or security behavior.
