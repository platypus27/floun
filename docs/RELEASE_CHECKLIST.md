# Floun Release Checklist

Run this checklist before packaging or loading a release build.

## Required Checks

```bash
cd floun
npm test
npm run build
npm audit --omit=dev
node --check public/background.js
```

## Manual Extension Check

1. Load `floun/build/` in `chrome://extensions/`.
2. Open `testpage.html` or a known HTTPS site.
3. Run Scan from the popup.
4. Confirm JavaScript, Token, Header, and Certificate sections render without console errors.
5. Confirm partial scan warnings appear if TLS or certificate adapters are unavailable.
6. Generate a PDF report without `REACT_APP_GEMINI_API_KEY` configured.
7. If Gemini drafting is configured locally, confirm generated report text does not contain raw tokens, code snippets, hashes, or certificate bodies.

## Security Hygiene

- Rotate any key that was ever committed or shared outside the local environment.
- Keep `.env.local` untracked.
- Do not add raw scan payload dumps to reports, logs, tests, or fixtures.
- Use rule IDs for new findings and add fixtures with every new crypto rule.
