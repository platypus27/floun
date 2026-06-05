# Floun Release Checklist

Run this checklist before packaging, loading, or publishing a release build.

## Scripted Checks

```bash
cd floun
npm run release:check
npm run package:extension
```

`npm run package:extension` writes `release/floun-2.0.0.zip` after the full release check passes.

Individual checks remain available when debugging:

```bash
npm test
npm run build
npm run audit:prod
npm run typecheck
npm run check:worker
```

## Manual Extension QA

1. Run `npm run package:extension`.
2. Load `floun/build/` in `chrome://extensions/`, or unzip `floun/release/floun-2.0.0.zip` and load the unpacked output.
3. Start the local HTTP fixture with `npm run fixture:server`.
4. Open `http://127.0.0.1:4174/crypto-readiness.html`.
5. Run Scan from the popup and confirm JavaScript, Token, Header, and Certificate sections render without console errors.
6. Confirm the HTTP fixture reports a certificate adapter warning rather than reintroducing `file://` support or broad host permissions.
7. Scan a known HTTPS site and confirm TLS and certificate adapters report `complete`, `partial`, or `unavailable` states clearly.
8. Attempt unsupported extension/browser pages such as `chrome://extensions/` and confirm the popup shows a graceful error.
9. Generate a PDF report without `REACT_APP_GEMINI_API_KEY` configured and confirm raw tokens are absent.
10. If Gemini drafting is configured locally, confirm generated report text does not contain raw tokens, code snippets, hashes, or certificate bodies.

## Security Hygiene

- Rotate any key that was ever committed or shared outside the local environment.
- Keep `.env.local` untracked.
- Do not add raw scan payload dumps to reports, logs, tests, or fixtures.
- Use rule IDs for new findings and add fixtures with every new crypto rule.
- Do not publish, tag, or push a release candidate until manual QA is complete.
