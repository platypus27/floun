# Chrome Web Store Listing Copy

## Listing Metadata

- Name: Floun
- Category: Developer Tools
- Language: English
- Homepage URL: `https://github.com/platypus27/Floun`
- Support contact: `ngaoyu27@gmail.com`

## Short Description

Lightweight crypto-readiness scanner for TLS, certificates, JavaScript crypto patterns, and token hygiene signals.

## Detailed Description

Floun is a lightweight Chrome extension for crypto-readiness and migration planning. It scans the active HTTP or HTTPS tab on demand and reports browser-visible cryptography signals that may matter for post-quantum migration work.

Floun focuses on practical inventory signals rather than broad vulnerability scanning. It highlights known weak or deprecated cryptography such as MD5, SHA-1, DES, 3DES, and RC4 as vulnerable findings, while treating classical or unclassified TLS and certificate algorithms as review items for migration planning.

Core capabilities:

- On-demand active-tab scanning.
- JavaScript crypto-pattern detection.
- Session-token heuristic checks with redacted evidence.
- TLS and certificate metadata checks through explicit API host permissions.
- Explainable findings with severity, confidence, rationale, limitations, recommendations, rule IDs, and references.
- Redacted PDF report generation.

Scope boundaries:

- Floun is not a definitive vulnerability scanner.
- Floun does not scan dependencies, CSP, cookies, mixed content, endpoints, or application authorization.
- Floun does not request broad `<all_urls>` or `file://` permissions.
- Findings should be validated with infrastructure owners before remediation decisions.

## Reviewer Notes

No account, paid service, or credentials are required to test the extension.

Suggested review flow:

1. Load the unpacked extension from `build/` or upload `release/floun-2.0.0.zip`.
2. Open an HTTPS site and click Scan.
3. Confirm findings and adapter status warnings render in the popup.
4. Generate a PDF report and confirm raw token values are not exposed.
5. Optional local fixture: serve `floun/fixtures/` with `npm run fixture:server` and scan `http://127.0.0.1:4174/crypto-readiness.html`.

The store package is built without `REACT_APP_GEMINI_API_KEY`. Optional Gemini report drafting is a local development configuration only unless a future release adds explicit privacy and review coverage for it.

## Required Store Assets

- Extension icon: `floun/public/icons/icon_128.png`
- Screenshot: `docs/store/assets/floun-store-screenshot-1280x800.png`
- Small promotional image: `docs/store/assets/floun-small-promo-440x280.png`
