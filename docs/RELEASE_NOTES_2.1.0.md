# Floun 2.1.0 Release Notes

Status: prepared locally on Linux for release QA and Chrome Web Store submission; not pushed, tagged, uploaded, or published.

## Release Theme

Floun 2.1.0 swaps the optional AI report-drafting provider from Google Gemini 1.5 Flash to DeepSeek V4 Flash, refreshes the Chrome Web Store description, and adds an explicit host permission for the new provider. Scope, scan rules, and PDF pipeline are unchanged.

## Highlights

- Replaced the optional AI report-drafting provider with DeepSeek V4 Flash via the OpenAI-compatible Chat Completions API at `https://api.deepseek.com/v1/chat/completions`.
- Renamed the build-time env var from `REACT_APP_GEMINI_API_KEY` to `VITE_DEEPSEEK_API_KEY`. Local development must copy `floun/.env.example` to `floun/.env` (or `.env.local`) and set the new variable.
- Added `https://api.deepseek.com/*` to the manifest `host_permissions` so the optional AI flow can reach the provider. The two existing TLS / certificate hosts are unchanged.
- Refreshed the Chrome Web Store short and detailed description to call out DeepSeek V4 Flash as the optional AI provider.
- Updated the Chrome Web Store privacy field copy, the GitHub-hosted privacy policy, and both READMEs to mention DeepSeek by name. The remote-code declaration is unchanged.
- Generalized the PowerShell artifact-checker AI-key regex so it catches both `AIza…` (Gemini-shaped) and `sk-…` (DeepSeek-shaped) values inside packaged text.
- Updated the PowerShell artifact-checker host-permission allowlist to include the DeepSeek host.
- Updated the PowerShell publish-readiness required-manual-QA row text to "Store package built without AI key".
- Version bumped from 2.0.0 to 2.1.0 in `floun/package.json` and `floun/public/manifest.json`.

## Verification Commands

Run from `floun/`:

```bash
npm run release:check
npm run build
npm test
npm run typecheck
```

Run from the repository root:

```bash
git diff --check
```

The package artifacts are written to `floun/release/floun-2.1.0.zip` and the byte-identical alias `floun/release/floun-2.1.zip`.
Chrome Web Store prep material lives under `docs/store/`.

The 2.1.0 build on this Linux host is produced with the system `zip` command rather than the PowerShell deterministic packager; the resulting SHA-256 is therefore not byte-deterministic across hosts. The PowerShell `release:artifact` and `release:publish:check` gates remain valid for Windows-based 2.1.0 builds and are not gated by this Linux run.

## Manual QA Targets

- Load `floun/build/` in Chrome extensions.
- Serve the fixture with `npm run fixture:server` and scan `http://127.0.0.1:4174/crypto-readiness.html`.
- Scan a known HTTPS site and confirm TLS/certificate adapter status is visible.
- Scan an HTTP site and confirm certificate lookup is reported as unavailable.
- Attempt unsupported pages and confirm graceful errors.
- With `VITE_DEEPSEEK_API_KEY` set in `floun/.env`, generate a PDF report and confirm redacted findings reach DeepSeek V4 Flash and the response renders in the report.
- Without `VITE_DEEPSEEK_API_KEY`, confirm the local fallback text is used and no outbound request to `api.deepseek.com` is made.
- Record manual QA in `docs/release/2.1.0/QA_EVIDENCE.md`.

## Scope Boundaries

- No new scan domains beyond the new AI host.
- No changes to TLS / certificate adapter behavior, scan protocol, finding registry, or PDF redaction.
- Findings remain crypto-readiness and migration signals, not a definitive vulnerability assessment.
- The local fixture is HTTP-served QA content; `file://` support is intentionally not reintroduced.
- The Chrome Web Store package is built without `VITE_DEEPSEEK_API_KEY`.

## Publication Status

This release candidate is not pushed, tagged, uploaded, or published. Manual Chrome extension QA must be completed or the recorded automation blockage must be resolved before release submission.
