# Floun Extension

Floun is a Chrome extension popup that scans the active tab for web cryptography signals, summarizes findings, and can generate a redacted PDF report.

## Development

```bash
npm install
npm test
npm run build
```

The production extension is emitted to `build/`.

## Optional Gemini Report Text

PDF reports work without an AI key by using a local fallback summary. To enable Gemini-generated report sections, copy `.env.example` to `.env.local` and set:

```bash
REACT_APP_GEMINI_API_KEY=your-key-here
```

Do not commit `.env.local` or API key files.

## Current Modules

- `src/App.tsx` coordinates popup state, active-tab scanning, summaries, and report generation.
- `src/extension/scanClient.ts` owns the popup-facing scan message contract.
- `src/components/analysisFinding.ts` defines the shared findings interface, summary logic, formatting, and redaction helpers.
- `src/components/cryptoRules.ts` defines the versioned cryptography rule catalogue.
- `src/components/*analysis.tsx` modules turn JavaScript, token, TLS, and certificate scan payloads into structured findings.
- `src/components/reportgen/reportDocument.ts` builds redacted report documents for AI prompts and PDF rendering.
- `src/components/reportgen/*` builds redacted report content and writes the PDF.
- `public/contentScript.js` bridges popup requests into the page.
- `public/background.js` runs page injection plus TLS and certificate API calls.

## Verification

The baseline checks are:

```bash
npm test
npm run build
npm audit --omit=dev
node --check public/background.js
node --check public/contentScript.js
```

The project uses Vite for the popup build and Vitest for unit tests. Production dependencies currently audit clean with `npm audit --omit=dev`.
