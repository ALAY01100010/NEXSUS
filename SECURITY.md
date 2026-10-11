<!-- Made by Alay -->

# Security policy

## Reporting a vulnerability

Please do not report security vulnerabilities in public issues. Use the repository host's private vulnerability reporting feature. A project-specific security contact will be added before the first public release.

## Sensitive data

Provider session partitions contain authentication state such as cookies, local storage, and IndexedDB. Treat the local NEXSUS user-data directory as sensitive. NEXSUS does not collect provider passwords, export cookies, log page contents, or transmit session state to a NEXSUS server.

## Electron boundaries

- The local renderer has context isolation and sandboxing enabled, with Node integration disabled.
- Remote provider pages use separate `WebContentsView` instances, persistent per-account session partitions, no preload, and no Node.js integration.
- IPC handlers validate the sender's main frame and validate item IDs, text, navigation URLs, capsule structures, and browser bounds.
- Provider permission requests and popup windows are denied by default; insecure HTTP navigation is rejected.
- The local app document has a restrictive Content Security Policy and does not load remote assets.

NEXSUS currently uses Electron's built-in SQLite module for local metadata. Application startup failures may write technical stack details to a local diagnostic log; provider URLs, passwords, cookies, tokens, and conversation contents are not included.

## Scope

The account isolation and capsule storage paths have unit and persistence tests. The managed Windows environment used to prepare the project terminates the Electron Chromium process before a window appears, so the account switching and provider login integration flow still needs verification on a normal desktop machine before release.
