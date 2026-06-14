# Chrome Web Store Privacy Field Copy

## Single Purpose

Floun provides lightweight, on-demand crypto-readiness and migration signal scanning for the active HTTP or HTTPS tab.

## Permission Justifications

`activeTab`: Used only after the user clicks Scan so Floun can inspect the currently active HTTP or HTTPS tab.

`scripting`: Used to inject the page collector into the active tab after a user-initiated scan. There is no always-on content script.

`https://api.ssllabs.com/*`: Used by the background service worker to request TLS analysis metadata for the scanned hostname.

`https://ssl-checker.io/*`: Used by the background service worker to request certificate metadata for the scanned hostname.

`https://api.deepseek.com/*`: Used by the optional AI report-drafting flow to send redacted report sections to DeepSeek V4 Flash. Not contacted unless the user has set `VITE_DEEPSEEK_API_KEY` in a local development build. The Chrome Web Store package is shipped without that key.

## Data Use Disclosure

Floun processes the active tab URL locally to build scan target metadata, minimizing it to the tab origin before the target is sent to the background worker. When the user has configured a local `VITE_DEEPSEEK_API_KEY`, redacted report sections are sent to DeepSeek V4 Flash at `https://api.deepseek.com` for optional AI-drafted report text; the Chrome Web Store package does not ship with that key configured. This removes paths, credentials, query strings, and fragments. It also processes the active tab hostname, visible page metadata, bounded same-origin script text, sanitized same-origin script locations, and bounded browser-visible token candidates that match local heuristics. Token evidence is redacted before display in reports.

Floun sends the scanned hostname to SSL Labs and ssl-checker.io for TLS and certificate metadata. It does not sell user data, use it for advertising, or transfer raw token values to those services.

The Chrome Web Store package is built without `VITE_DEEPSEEK_API_KEY`. Optional DeepSeek report drafting is local-development only unless a later release adds explicit user-facing privacy coverage for it.

## Remote Code Declaration

Select: No, Floun does not execute remotely hosted code.

Explanation: Floun runs bundled extension code only. TLS and certificate services return data used by the scanner; those responses are not executed as code.

## Privacy Policy URL

Use the GitHub-hosted policy after this release-prep material is pushed:

`https://github.com/platypus27/Floun/blob/main/docs/store/PRIVACY_POLICY.md`
