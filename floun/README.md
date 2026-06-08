# Floun Extension

Floun is a lightweight Chrome extension popup for crypto-readiness and migration signals. It scans the active tab for visible JavaScript, token, TLS, and certificate indicators, summarizes findings, and can generate a redacted PDF report.

## Development

```bash
npm install
npm run release:check
```

The production extension is emitted to `build/`.

## Release Candidate Packaging

```bash
npm run package:extension
```

The package command runs the full release check, then writes `release/floun-2.0.0.zip` and the byte-identical alias `release/floun-2.0.zip`.

To verify the package artifact and Chrome Web Store prep material:

```bash
npm run release:ready
```

For manual QA, serve the HTTP fixture:

```bash
npm run fixture:server
```

Then scan `http://127.0.0.1:4174/crypto-readiness.html`.

## Optional Gemini Report Text

PDF reports work without an AI key by using a local fallback summary. To enable Gemini-generated report sections, copy `.env.example` to `.env.local` and set:

```bash
REACT_APP_GEMINI_API_KEY=your-key-here
```

Do not commit `.env.local` or API key files.

## Current Modules

- `src/App.tsx` coordinates popup state, active-tab scanning, registry-derived sections, and report generation.
- `src/extension/scanProtocol.ts` owns scan request/response builders, action constants, and runtime guards.
- `src/extension/scanClient.ts` sends popup scan requests through the shared scan protocol.
- `src/components/analysisFinding.ts` defines the shared findings interface and summary logic.
- `src/components/analysisModules.ts` defines the JavaScript, Tokens, TLS, and Certificates analysis registry.
- `src/components/cryptoRules.ts` defines the versioned cryptography rule catalogue, including rule status, rationale, limitations, and references.
- `src/components/*analysis.tsx` modules turn JavaScript, token, TLS, and certificate scan payloads into structured findings.
- `src/components/sessiontokenanalysis/tokenCheckRegistry.ts` coordinates single-token and batch-token checks.
- `src/components/findingUiSerializers.ts`, `src/components/reportgen/findingSerializers.ts`, and `src/components/evidenceRedaction.ts` own UI/report formatting and evidence redaction policy.
- `src/components/reportgen/reportDocument.ts` builds redacted report documents for AI prompts and PDF rendering.
- `src/components/reportgen/*` builds redacted report content and writes the PDF.
- `src/extension/background/*` receives direct popup scan requests, performs active-tab page injection on demand, runs TLS/certificate API calls, and normalizes provider output into scan facts.

## Scan Scope

Findings use `Safe`, `Review`, `Vulnerable`, and `Info` severities. Classical or unclassified TLS/certificate cryptography is reported as `Review` for migration planning; `Vulnerable` is reserved for known weak or deprecated signals such as MD5, SHA-1, DES, 3DES, and RC4.

## Verification

The baseline checks are:

```bash
npm test
npm run build
npm run audit:prod
npm run typecheck
npm run check:worker
```

The project uses Vite for the popup build and Vitest for unit tests. Production dependencies currently audit clean with `npm audit --omit=dev`.
