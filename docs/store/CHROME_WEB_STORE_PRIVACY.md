# Chrome Web Store Privacy Field Copy

## Single Purpose

Floun provides lightweight, on-demand crypto-readiness and migration signal scanning for the active HTTP or HTTPS tab.

## Permission Justifications

`activeTab`: Used only after the user clicks Scan so Floun can inspect the currently active HTTP or HTTPS tab.

`scripting`: Used to inject the page collector into the active tab after a user-initiated scan. There is no always-on content script.

`https://api.ssllabs.com/*`: Used by the background service worker to request TLS analysis metadata for the scanned hostname.

`https://ssl-checker.io/*`: Used by the background service worker to request certificate metadata for the scanned hostname.

## Data Use Disclosure

Floun processes the active tab URL locally to build scan target metadata, stripping credentials, query strings, and fragments before the target is sent to the background worker. It also processes the active tab hostname, visible page metadata, same-origin script text, and browser-visible token candidates that match local heuristics. Token evidence is redacted before display in reports.

Floun sends the scanned hostname to SSL Labs and ssl-checker.io for TLS and certificate metadata. It does not sell user data, use it for advertising, or transfer raw token values to those services.

The Chrome Web Store package is built without `REACT_APP_GEMINI_API_KEY`. Optional Gemini report drafting is local-development only unless a later release adds explicit user-facing privacy coverage for it.

## Remote Code Declaration

Select: No, Floun does not execute remotely hosted code.

Explanation: Floun runs bundled extension code only. TLS and certificate services return data used by the scanner; those responses are not executed as code.

## Privacy Policy URL

Use the GitHub-hosted policy after this release-prep material is pushed:

`https://github.com/platypus27/Floun/blob/main/docs/store/PRIVACY_POLICY.md`
