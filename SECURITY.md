<!-- Made by Alay -->

# Security policy

## Reporting a vulnerability

Please do not disclose suspected vulnerabilities in public issues or discussions. If GitHub private vulnerability reporting is enabled for this repository, use that mechanism to report the issue. If private reporting is unavailable, contact the maintainer through a private contact mechanism associated with the repository rather than opening a public issue. No security email address is currently published here.

Include the affected version, a description of the impact, and steps to reproduce where safe. Do not include real provider credentials, cookies, tokens, or personal conversation data in a report.

## Sensitive local data

NEXSUS stores account metadata, custom website URLs, and locally cached favicons in a SQLite database under Electron's `userData` directory. Persistent provider and custom website session partitions are stored under Electron's local session data directory and can contain cookies, local storage, IndexedDB, and other browser session state, including authentication state. Protect the NEXSUS data directory and device account as sensitive; do not share a profile directory or diagnostic bundle without reviewing its contents.

NEXSUS does not collect provider passwords or export provider cookies or tokens. The application has no mandatory cloud backend or telemetry. Capsule contents and source metadata are stored locally and may contain sensitive project information.

## Electron security boundaries

- The local application window uses context isolation and sandboxing, disables Node integration, and exposes a narrow preload API to the trusted renderer.
- Provider pages run in separate `WebContentsView` instances with per-account persistent partitions, context isolation and sandboxing enabled, Node integration disabled, and no NEXSUS preload.
- Custom websites use the same isolated `WebContentsView` and unique persistent partition per entry. They are arbitrary untrusted remote content; they receive no NEXSUS preload or IPC, Node integration remains disabled, only HTTPS top-level navigation is accepted, popups are denied, and permission requests are denied.
- IPC handlers validate the sender frame and validate identifiers, text, navigation URLs, Capsule structures, and browser bounds before acting.
- Main-frame provider navigation is restricted to HTTPS provider domains and explicitly configured identity-provider hosts. Custom website views accept HTTPS navigation only and deny popups. Permission requests and permission checks are denied for both.
- The local application document has a restrictive Content Security Policy and loads its scripts, styles, and logo from packaged local files. Provider websites are remote third-party content and remain subject to their own policies.
- Startup failures may write the error message and stack details to a local diagnostic log. The application does not collect page contents or session data for diagnostics; review a log before sharing it because exception text can vary.

## Threat model and limitations

NEXSUS embeds third-party provider websites. Their authentication and security policies remain authoritative; NEXSUS does not bypass provider restrictions, CAPTCHAs, or rate limits. Provider website or DOM changes can break sign-in flows, conversation extraction, or composer insertion. The provider-specific adapters are implemented and covered by automated tests, but authenticated live extraction and injection have not been verified for the current provider pages.

The Electron session integration test uses a local test page to verify persistence and isolation across eight account partitions and process restart. It does not verify live provider authentication or current provider DOM compatibility. Users should protect local session data as they would other credentials.
