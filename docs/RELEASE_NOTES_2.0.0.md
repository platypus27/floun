# Floun 2.0.0 Release Notes

Status: prepared locally for release QA and Chrome Web Store submission; not pushed, tagged, uploaded, or published.

## Release Theme

Floun 2.0.0 is a lightweight crypto-readiness release candidate. It strengthens trust, accuracy, scan resilience, and release repeatability without expanding into general web vulnerability scanning.

## Highlights

- Minimized Chrome extension scope by removing the always-on content script, removing broad host permissions, and keeping active scans routed through direct popup-to-background messaging.
- Added `Review` severity, richer crypto rule metadata, and adapter status warnings so classical or unclassified cryptography is treated as migration inventory rather than a confirmed vulnerability.
- Moved the background worker into typed TypeScript modules with dedicated page, TLS, and certificate adapters.
- Added explainable findings in the popup and reports, including rationale, limitations, recommendations, confidence, standard status, references, and redacted evidence.
- Kept PDF generation lazy-loaded and report output redacted.
- Added repeatable release-candidate scripts, a Windows-first PowerShell packager, and an HTTP-served QA fixture.
- Added release-readiness checks, QA evidence docs, Chrome Web Store listing/privacy copy, and required store asset files.
- Added fixture-driven analyzer calibration coverage and refreshed byte-identical `2.0.0` / `2.0` release zips from the current source.
- Tightened scan request validation so target URLs are minimized to origin-only metadata, tab IDs are non-negative, and URL, origin, protocol, and hostname must agree before background adapters run.
- Removed unused future-domain analysis placeholders from the release source tree.
- Made release ZIP packaging deterministic so repeated packaging of unchanged build output preserves the artifact hash.
- Validated packaged manifest permissions and background worker settings directly inside the release ZIP artifact.
- Validated packaged manifest, popup HTML, and background worker asset references directly inside the release ZIP artifact.
- Validated release QA evidence against the packaged ZIP hash, size, and archive entries to prevent stale release documentation.
- Derived store readiness release evidence paths from `package.json` so future version changes cannot keep checking stale release docs.
- Added a publish readiness gate that fails until every required Manual Chrome QA evidence row is present, completed, backed by non-placeholder evidence, and marked Pass.
- Added automated report pipeline checks proving raw token evidence is omitted before PDF generation and Gemini prompt drafting.
- Expanded release artifact safety checks to reject raw QA fixture tokens and source/test/dev files in the packaged ZIP.
- Hardened popup scan-client error handling for Chrome active-tab query and background-message runtime failures.
- Hardened the page scan adapter to sanitize malformed injected collector data before it enters the scan payload.
- Hardened page scan normalization so external script locations keep paths but drop credentials, query strings, and fragments before findings or reports are generated.
- Hardened page collection with lightweight script count/content caps and partial scan warnings when script payload data is truncated.
- Hardened page collector error handling so primitive or malformed callback values become partial scan warnings rather than adapter crashes or invalid metadata.
- Hardened scan response validation so the popup rejects malformed page headers, normalized TLS facts, certificate facts, adapter metadata, and warning arrays.

## Verification Commands

Run from `floun/`:

```bash
npm run release:check
npm run package:extension
npm run release:artifact
npm run release:determinism
npm run store:check
npm run release:ready
npm test
npm run build
npm audit --omit=dev
npx tsc --noEmit
node --check build/background.js
```

Run from the repository root:

```bash
git diff --check
```

The package artifacts are written to `floun/release/floun-2.0.0.zip` and byte-identical alias `floun/release/floun-2.0.zip`.
Chrome Web Store prep material lives under `docs/store/`.

`npm run release:publish:check` is intentionally stricter than the scripted release-prep checks. It runs release readiness and then fails until every required Manual Chrome QA evidence row is present, marked Pass, and backed by non-placeholder evidence.

## Manual QA Targets

- Load `floun/build/` in Chrome extensions.
- Serve the fixture with `npm run fixture:server` and scan `http://127.0.0.1:4174/crypto-readiness.html`.
- Scan a known HTTPS site and confirm TLS/certificate adapter status is visible.
- Scan an HTTP site and confirm certificate lookup is reported as unavailable.
- Attempt unsupported pages and confirm graceful errors.
- Generate a PDF report and confirm raw tokens are absent.
- Record manual QA in `docs/release/2.0.0/QA_EVIDENCE.md`.

## Scope Boundaries

- No new Chrome permissions.
- No new scan domains.
- No CSP, cookie-flag, mixed-content, dependency, endpoint, or general vulnerability scanning.
- Findings remain crypto-readiness and migration signals, not a definitive vulnerability assessment.
- The local fixture is HTTP-served QA content; `file://` support is intentionally not reintroduced.

## Publication Status

This release candidate is not pushed, tagged, uploaded, or published. Manual Chrome extension QA must be completed or the recorded automation blockage must be resolved before release submission.
