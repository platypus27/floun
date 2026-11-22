# Floun 3.0.0 QA Evidence

Status: release candidate verified locally on Linux on 2026-07-20; artifact evidence and the local fixture Chrome QA were re-verified on 2026-11-22 after the round-2 PDF report layout changes. The candidate is ready for Chrome Web Store submission, but has not been tagged, uploaded, or published.

## Artifact Evidence

- Package path: `floun/release/floun-3.0.0.zip`
- Alias package path: `floun/release/floun-3.0.zip`
- Extension version: `3.0.0`
- SHA-256: `ae70773d1a046c573a00a4be83b4ea588e31bcc6b3539a0c543909648f1605bc`
- Alias SHA-256: `ae70773d1a046c573a00a4be83b4ea588e31bcc6b3539a0c543909648f1605bc`
- Size bytes: `380741`
- Two independent deterministic packaging runs produced matching SHA-256: `ae70773d1a046c573a00a4be83b4ea588e31bcc6b3539a0c543909648f1605bc`

Required archive entries:

- `LICENSE.txt`
- `NOTICE.txt`
- `THIRD_PARTY_NOTICES.txt`
- `assets/ai-handler-ZchShEOW.js`
- `assets/index-VW9Q_lNK.css`
- `assets/index-eHfhEp7J.js`
- `assets/pdfService-CJjh8-so.js`
- `assets/reportDraftingSettings-CXA6zaou.js`
- `background.js`
- `icons/favicon.ico`
- `icons/floun.png`
- `icons/icon_128.png`
- `icons/icon_16.png`
- `icons/icon_48.png`
- `index.html`
- `manifest.json`
- `robots.txt`

The artifact gate verifies the Apache-2.0 license, Kryv Labs notice, generated production-dependency notices, safe relative ZIP entries, an exact MV3 manifest schema, `activeTab`, `scripting`, and `storage` permissions, the SSL Labs and DeepSeek host allowlist, CSP, internal asset references, expected file types, and absence of source, fixtures, source maps, environment files, raw QA tokens, or API-key-like values.

## Scripted Verification

| Check | Result | Evidence |
| --- | --- | --- |
| Teal dependency install | Pass | Installed published `@kryv/teal@1.2.0`; the production dependency audit reported zero vulnerabilities. |
| `npm run release:check` | Pass | 36 test files and 160 tests passed; lint, production build, production dependency audit, typecheck, and worker syntax check passed. |
| `npm run release:artifact` | Pass | Canonical and alias archives matched the recorded version, entries, size, and SHA-256. |
| `npm run release:determinism` | Pass | Two clean package runs were byte-identical. |
| `npm run store:check` | Pass | Required store documents and 128x128, 1280x800, and 440x280 PNG assets passed. |
| `npm run qa:chrome:flows` | Pass | Chrome 150.0.7871.128 completed all required popup flows against the production build. |
| `npm audit` | Pass | Full dependency audit reported zero vulnerabilities. |
| `git diff --check` | Pass | No whitespace errors. |

## Manual Chrome QA

These rows are backed by the Chrome DevTools Protocol QA run against the unpacked production build. External provider responses for BYOK were intercepted and mocked so no real API key or user content left the isolated QA profile.

| Scenario | Result | Evidence |
| --- | --- | --- |
| Load `floun/build/` in Chrome extensions | Pass | Chrome 150.0.7871.128 loaded Floun 3.0.0 as an unpacked MV3 extension. |
| Scan `http://127.0.0.1:4174/crypto-readiness.html` | Pass | Detected 20 signals and rendered all four Teal result accordions; external TLS and certificate lookups were explicitly unavailable for the loopback host. |
| Scan `https://www.cloudflare.com/` | Pass | Detected 95 signals, rendered TLS and certificate evidence from one SSL Labs assessment, and displayed page truncation in a Teal warning alert. |
| Scan `http://example.com/` | Pass | Completed with explicit TLS and certificate unavailable warnings for the blacklisted host. |
| Attempt unsupported page such as `chrome://extensions/` | Pass | Displayed the expected HTTP/HTTPS-only Teal danger alert without crashing the popup. |
| Generate PDF report | Pass | Downloaded a 27,035-byte PDF; none of the five raw fixture token values appeared in the file. |
| Configure and clear DeepSeek BYOK with explicit consent | Pass | Saved the fake key only after consent, reopened the Teal dialog with masked status, sent seven redacted authenticated requests to the intercepted endpoint, generated a leak-free PDF, and removed the key through the UI. |
| Store package built without AI key | Pass | Artifact secret scanning found no DeepSeek-style key, environment file, or build-time AI secret. |
| Inspect v3 wordmark, animation, dialog, and narrow layout | Pass | Production screenshots confirmed the lowercase teal `floun` wordmark, 400 px layout, status cards, warning alert, centered AI dialog, masked key card, and button alignment without horizontal overflow or clipping. |

## Round 2 Refresh (2026-11-22)

After the PDF report layout changes (finding blocks, summary tables, slim appendices), the artifact evidence above was regenerated and the local-fixture Chrome QA was re-run against the new production build. Chrome 157.0.8103.78 loaded Floun 3.0.0 as an unpacked MV3 extension, scanned `http://127.0.0.1:4174/crypto-readiness.html` with 20 detected signals across all four Teal result accordions (TLS and certificate lookups explicitly unavailable for the loopback host), and exported a 42,048-byte, 10-page PDF report in which none of the five raw fixture token values appeared. Every page image of that PDF was visually inspected for overlap, orphans, clipping, and uneven spacing. The external HTTPS, HTTP, and BYOK rows above remain from the 2026-07-20 verification.

## Publication Boundary

Local implementation and release evidence are complete. Chrome Web Store account submission, reviewer feedback, staged rollout, and production telemetry remain operational steps outside this repository.
