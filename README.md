# Floun - Crypto-Readiness Signal Scanner

![Floun Logo](floun/public/icons/floun.png)

Floun is a lightweight Chrome extension that scans the active website for cryptographic readiness signals, highlights migration review items and known weak crypto, and generates a redacted PDF report for quantum-safe cryptography planning.

## Features

- Scans active tabs for JavaScript cryptography patterns, session-token signals, TLS cipher suites, and certificate signature algorithms.
- Summarizes findings as safe, review, vulnerable, or informational.
- Generates PDF reports with redacted findings.
- Supports optional Gemini-drafted report sections through a local environment variable.

## Development

The extension app lives in `floun/`.

```bash
cd floun
npm install
npm test
npm run build
npm audit --omit=dev
```

The built extension is emitted to `floun/build/`.

## Optional Gemini Report Text

PDF reports work without an AI key by using local fallback text. To enable Gemini-generated sections, copy `floun/.env.example` to `floun/.env.local` and set:

```bash
REACT_APP_GEMINI_API_KEY=your-key-here
```

Do not commit `.env.local` or API key files.

## Manual Installation

1. Run `npm run build` from `floun/`.
2. Open Chrome and go to `chrome://extensions/`.
3. Enable Developer Mode.
4. Click Load unpacked and select `floun/build/`.

## Privacy

Floun stores scan data locally in the browser extension flow. If Gemini report drafting is configured, findings are redacted before being sent for report-section drafting. Raw tokens are not included in generated prompts or report appendices.

## Roadmap

- Move the background service worker into TypeScript.
- Add deeper integration tests for Chrome message flows.
- Expand the cryptography rule catalogue as standards and browser support evolve.

## Contact

For questions, feedback, or support: [ngaoyu27@gmail.com](mailto:ngaoyu27@gmail.com)
