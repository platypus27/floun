# Floun Privacy Policy

Effective date: June 5, 2026

Floun is a lightweight Chrome extension for crypto-readiness and migration signal scanning. It runs on demand when the user clicks Scan.

## Data Floun Processes

Floun may process the active tab URL locally to build scan target metadata. Target URL metadata is minimized to the tab origin before it is sent to the background worker, removing paths, credentials, query strings, and fragments. Floun may also process the active tab hostname, page metadata, same-origin JavaScript text, sanitized same-origin script locations, TLS metadata, certificate metadata, and browser-visible token candidates that match local session-token heuristics.

Token findings are redacted before being displayed in reports. Floun does not intentionally collect passwords, payment information, personal communications, browsing history, or files from the user's device.

## Network Requests

Floun sends the scanned hostname to SSL Labs and ssl-checker.io to retrieve TLS and certificate metadata. These requests are limited to the explicit host permissions in the extension manifest.

The Chrome Web Store package is intended to be built without `REACT_APP_GEMINI_API_KEY`. Optional Gemini report drafting can be configured locally by developers, but it is not part of the default store package.

## Storage and Retention

Floun keeps scan results in the extension popup flow while the user is using it. Generated PDF reports are saved only when the user chooses to create them.

Floun does not sell user data, use it for advertising, or share raw token values with third parties.

## Permissions

Floun uses `activeTab` and `scripting` for user-initiated scans of the active tab. It uses explicit host permissions for SSL Labs and ssl-checker.io TLS and certificate metadata lookups.

Floun does not request `<all_urls>`, `file://`, cookies, browsing history, or always-on content-script permissions.

## Contact

Questions or privacy requests can be sent to `ngaoyu27@gmail.com`.
