# Floun 2.1.0 Release — DeepSeek Provider Swap + Linux Zip Rebuild

Date: 2026-06-13
Status: Design — awaiting user review
Author: Kimi Code (brainstorming)

## Context

Floun is a Chrome extension (MV3) that scans the active HTTP/HTTPS tab for crypto-readiness and migration signals and generates a redacted PDF report. The 2.0.0 release is prepared locally with `release/floun-2.0.0.zip` (SHA-256 `e918fec…`) and full Chrome for Testing QA evidence, but has not been pushed, tagged, or published.

The optional AI-driven report text was implemented against Google Gemini 1.5 Flash, wired through the env var `REACT_APP_GEMINI_API_KEY` and a single outbound host (`generativelanguage.googleapis.com` — note this host is **not** declared in the MV3 manifest's `host_permissions`; the current AI call works only in dev with the Vite dev server / the future call would need a host permission declaration).

The user is preparing a follow-up release with two bundled changes:

1. **Provider swap** — replace Gemini 1.5 Flash with **DeepSeek V4 Flash** (MIT-licensed, 284B/13B active MoE, 1M-token context, OpenAI-compatible Chat Completions API at `https://api.deepseek.com/v1/chat/completions`, model id `deepseek-v4-flash`, released 2026-04-24).
2. **Release refresh on Linux** — this build host is Linux, the existing packager is PowerShell-only, and `build/` is missing. The user has chosen a plain `zip` rebuild over porting the deterministic packager.

These two changes ship together as **Floun 2.1.0** because the provider swap is a feature change (new host permission, new env var, new privacy disclosure) and warrants a minor version bump.

## Goals

- Ship 2.1.0 with DeepSeek V4 Flash as the optional AI report-drafting provider
- Produce a fresh `floun/release/floun-2.1.0.zip` and byte-identical alias `floun/release/floun-2.1.zip` from the current source on this Linux host
- Refresh the Chrome Web Store short + detailed description in `docs/store/CHROME_WEB_STORE_LISTING.md` to reflect the new AI provider
- Update privacy disclosures, READMEs, release notes, and the PowerShell artifact-checker allowlists to match
- Keep 2.0.0 evidence, zip, and tooling in place (additive change, no destructive edits)

## Non-goals

- Push, tag, upload, or publish anything
- Commit anything to git (waiting for user sign-off at each step)
- Port the PowerShell packager/checker to Node.js (user chose `zip`)
- Add new functionality beyond the provider swap (no new scan modules, no new rules, no new PDF features)
- Change scan scope, permissions beyond the new AI host, CSP, or extension-page behavior

## Design

### 1. Provider swap — Gemini → DeepSeek V4 Flash

**New file:** `floun/src/components/reportgen/deepseekService.tsx`

```ts
const API_KEY = (import.meta.env.VITE_DEEPSEEK_API_KEY || "").trim();
const API_URL = "https://api.deepseek.com/v1/chat/completions";
const MODEL = "deepseek-v4-flash";

interface DeepseekResponse {
  choices?: Array<{
    message?: { content?: string };
  }>;
}

export function hasDeepseekApiKey(): boolean {
  return API_KEY.length > 0;
}

export async function generateChatMessage(prompt: string): Promise<string> {
  if (!hasDeepseekApiKey()) {
    throw new Error("VITE_DEEPSEEK_API_KEY is not configured.");
  }
  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Failed to generate AI content: ${response.status} ${errorBody}`);
  }
  const data = (await response.json()) as DeepseekResponse;
  return data.choices?.[0]?.message?.content || "No content generated.";
}
```

**Delete:** `floun/src/components/reportgen/geminiService.tsx`

**Update:** `floun/src/components/ai-handler.tsx`
- Import path: `./reportgen/geminiService` → `./reportgen/deepseekService`
- Symbol: `hasGeminiApiKey` → `hasDeepseekApiKey`
- Any literal "Gemini" / `REACT_APP_GEMINI_API_KEY` references in error text or comments

**Update:** `floun/src/components/ai-handler.test.tsx`
- Update the `vi.mock` path to `./reportgen/deepseekService`
- Update the mocked symbol from `hasGeminiApiKey` to `hasDeepseekApiKey`
- The existing test name `...when local AI drafting is configured` remains accurate

**New file:** `floun/src/components/reportgen/deepseekService.test.tsx`
- Mock `global.fetch`, assert request URL is `https://api.deepseek.com/v1/chat/completions`
- Assert method is `POST`, headers include `Authorization: Bearer …`
- Assert body parses as `{ model: "deepseek-v4-flash", messages: [{ role: "user", content: prompt }] }`
- Assert happy path returns `choices[0].message.content`
- Assert missing-key throws `"VITE_DEEPSEEK_API_KEY is not configured."`
- Assert non-2xx response throws with status and body

**Update:** `floun/.env.example`
- `REACT_APP_GEMINI_API_KEY=` → `VITE_DEEPSEEK_API_KEY=`

(`floun/.env` is gitignored and already contains the real key, set up out-of-band for local dev.)

### 2. Manifest changes

`floun/public/manifest.json`:

- `"version": "2.0.0"` → `"2.1.0"`
- `host_permissions` array gains `"https://api.deepseek.com/*"`:
  ```json
  "host_permissions": [
    "https://api.ssllabs.com/*",
    "https://ssl-checker.io/*",
    "https://api.deepseek.com/*"
  ]
  ```

### 3. PowerShell artifact-checker updates

`floun/scripts/check-release-artifact.ps1`:

- `ExpectedHostPermissions` array gets `"https://api.deepseek.com/*"`
- `GeminiKeyPattern = "AIza[0-9A-Za-z_-]{20,}"` → generalized to a single regex matching both Google and DeepSeek key shapes:
  ```
  $AIKeyPattern = "(?:AIza[0-9A-Za-z_-]{20,}|sk-[0-9A-Za-z_-]{20,})"
  ```
- The string `"AIza…"` body check → uses `$AIKeyPattern`
- The forbidden literal `"REACT_APP_GEMINI_API_KEY="` → `"VITE_DEEPSEEK_API_KEY="`
- Error message `"Release artifact contains a Gemini API-key-like value in $EntryName"` → `"Release artifact contains an AI API-key-like value in $EntryName"`

`floun/scripts/check-publish-readiness.ps1`:

- Required manual-QA row text `"Store package built without Gemini key"` → `"Store package built without AI key"`

`floun/src/extension/publishReadiness.test.ts`:

- Update the matching expected literal to `"Store package built without AI key"`

### 4. Documentation refresh

**`docs/store/CHROME_WEB_STORE_LISTING.md`** — rewrite only the **Short Description** and **Detailed Description** sections to describe DeepSeek V4 Flash. Leave Listing Metadata, Reviewer Notes, and Required Store Assets sections untouched.

**`docs/store/CHROME_WEB_STORE_PRIVACY.md`**:
- `Permission Justifications` gains a new `https://api.deepseek.com/*` entry: "Used by the optional AI report-drafting service to send redacted report sections to DeepSeek V4 Flash. Not contacted unless `VITE_DEEPSEEK_API_KEY` is set by the user."
- `Data Use Disclosure` paragraph updated to mention DeepSeek as the optional AI provider and note that the Chrome Web Store package ships without the key.
- `Remote Code Declaration` unchanged (Floun still does not execute remotely hosted code).

**`docs/store/PRIVACY_POLICY.md`**:
- `Network Requests` section mentions DeepSeek alongside the existing SSL Labs and ssl-checker.io entries.
- Effective date stays as-is (the policy text is being updated, not re-issued).

**`floun/README.md`**:
- `## Optional Gemini Report Text` → `## Optional DeepSeek Report Text`
- Env var name updated in the copy-block example
- Reference to Gemini in the explanatory text replaced with DeepSeek V4 Flash

**`README.md`** (repo root):
- Same updates as `floun/README.md` for the "Optional Gemini Report Text" block

**`docs/RELEASE_NOTES_2.1.0.md`** — new file modeled after `docs/RELEASE_NOTES_2.0.0.md`:
- Release theme: AI provider swap to DeepSeek V4 Flash
- Highlights: provider swap, env var rename, new `host_permission`, listing + privacy copy refresh
- Verification commands (same shape as 2.0.0)
- Manual QA targets (same shape as 2.0.0)
- Scope boundaries (no new scan modules, no new permissions beyond the AI host)
- Publication status: prepared locally on Linux, not pushed, tagged, or published

**`docs/release/2.1.0/QA_EVIDENCE.md`** — new file modeled after `docs/release/2.0.0/QA_EVIDENCE.md`:
- Artifact Evidence section with new SHA-256, size, entries
- Scripted Verification table with the new build hash
- Manual Chrome QA table marked pending (this Linux run cannot complete Chrome for Testing flow)
- Status line notes the rebuild was done with plain `zip` on Linux and the artifact is not byte-deterministic

### 5. Packaging on Linux

```bash
cd floun
npm install                # if not already installed
npm run build              # produces build/
mkdir -p release
rm -f release/floun-2.1.0.zip release/floun-2.1.zip
( cd build && zip -r ../release/floun-2.1.0.zip . )
cp release/floun-2.1.0.zip release/floun-2.1.zip
```

**Trade-offs accepted:**
- Plain `zip` is not byte-deterministic across hosts/runs. The existing PowerShell `release:determinism` check (which produces a stable hash for a given `build/`) is no longer meaningful for this Linux build.
- The Linux build's SHA-256 will differ from any future Windows-built 2.1.0 zip. We document this explicitly in the 2.1.0 release notes and QA evidence.
- We do not run the full PowerShell `release:artifact` or `release:publish:check` gates on this host. We do a focused manual check instead (Section 6).

**Files NOT touched by the packaging step:**
- `floun/scripts/package-extension.ps1` and `floun/scripts/check-release-artifact.ps1` and `check-package-determinism.ps1` remain in the tree as Windows-friendly tools. Their source-of-truth contract (deny list, allow list, manifest schema) is updated in place (Section 3) so the Windows flow stays valid for the next Windows release.

### 6. Manual verification on Linux

After packaging, the new zip is verified by:

- **Required entries:** `manifest.json`, `index.html`, `background.js`, `icons/icon_16.png`, `icons/icon_48.png`, `icons/icon_128.png`, `robots.txt`, plus at least one `assets/*.js` and one `assets/*.css`
- **Forbidden entries:** no `*.tsx`, `*.ts`, `node_modules/`, `fixtures/`, `docs/`, `scripts/`, `*.map`, `package*.json`, `tsconfig*`, `vite.config.*`, `.env*`, `crypto-readiness.html`
- **Manifest:** `manifest_version === 3`, `version === "2.1.0"`, `permissions === ["activeTab", "scripting"]`, `host_permissions` matches the 3-entry allowlist (deepseek added)
- **No inline scripts / event handlers** in packaged `index.html`
- **No external `src`/`href` references** in packaged `index.html`, `background.js`, or any packaged `.css`
- **No `VITE_DEEPSEEK_API_KEY=` literal** inside any packaged text
- **No `sk-…` or `AIza…` key-like values** inside any packaged text
- **SHA-256 and size** recorded into the new `docs/release/2.1.0/QA_EVIDENCE.md`

### 7. Privacy disclosure callouts

The user wants the DeepSeek swap to ship, but DeepSeek is a Chinese AI provider and that's worth surfacing clearly in the public docs:

- The Chrome Web Store listing's **Detailed Description** and `docs/store/CHROME_WEB_STORE_PRIVACY.md` both explicitly name **DeepSeek** as the AI provider. No euphemism.
- The **Privacy Policy** mentions DeepSeek in `Network Requests` and notes the optional nature of the integration.
- The **Reviewer Notes** in the store listing explain that the uploaded package is built without `VITE_DEEPSEEK_API_KEY`, so a reviewer testing the packaged extension will never see DeepSeek contacted.
- `floun/README.md` and the repo-root `README.md` retain a privacy note that the integration is opt-in and disabled by default.

### 8. Out of scope

- No changes to scan protocol, finding registry, PDF generation, evidence redaction, or any non-AI service
- No new tests beyond the new `deepseekService.test.tsx` and the existing `ai-handler.test.tsx` symbol rename
- No `.env*` key rotation or audit (the key the user provided is the user's own; we don't introspect it)
- No version of the Chrome Web Store dashboard submission itself

## File-by-file change list

| File | Change |
|---|---|
| `floun/src/components/reportgen/deepseekService.tsx` | New |
| `floun/src/components/reportgen/deepseekService.test.tsx` | New |
| `floun/src/components/reportgen/geminiService.tsx` | Delete |
| `floun/src/components/ai-handler.tsx` | Update import + symbol |
| `floun/src/components/ai-handler.test.tsx` | Update mock target + symbol |
| `floun/.env.example` | Rename var |
| `floun/.env` | (already set, gitignored) |
| `floun/package.json` | Bump `version` to `2.1.0` |
| `floun/public/manifest.json` | Bump `version`, add host permission |
| `floun/scripts/check-release-artifact.ps1` | Add deepseek host, generalize key regex, update forbidden literal + error msg |
| `floun/scripts/check-publish-readiness.ps1` | Update required-QA row text |
| `floun/src/extension/publishReadiness.test.ts` | Update expected literal |
| `floun/README.md` | Rename section, update env var, swap provider name |
| `README.md` (repo root) | Same as floun/README.md |
| `docs/store/CHROME_WEB_STORE_LISTING.md` | Rewrite short + detailed description |
| `docs/store/CHROME_WEB_STORE_PRIVACY.md` | New deepseek host entry, mention DeepSeek in data-use |
| `docs/store/PRIVACY_POLICY.md` | Mention DeepSeek in network requests |
| `docs/RELEASE_NOTES_2.1.0.md` | New |
| `docs/release/2.1.0/QA_EVIDENCE.md` | New (pending manual Chrome QA) |
| `floun/release/floun-2.1.0.zip` | New artifact |
| `floun/release/floun-2.1.zip` | New alias artifact |

## Test plan

1. `npm install` then `npm test` — all unit tests pass, including new `deepseekService.test.tsx`
2. `npm run typecheck` — clean
3. `npm run build` — Vite production build succeeds
4. Run the `zip` packaging commands from Section 5
5. Run the manual verification checklist from Section 6
6. Update `docs/release/2.1.0/QA_EVIDENCE.md` with the new hash, size, entries, and recorded manual checks
7. Final sanity: `git status` shows the expected file changes; `.env` is not in the diff

## Verification before claiming done

Per the verification-before-completion skill, I will not claim this release is "prepared" until:

- All commands in the test plan above have run with observed output
- The new QA evidence file references the actual computed SHA-256, size, and entry list
- `git status` confirms `.env` is not staged
- All renames/deletions resolve cleanly (no stale Gemini references remain in the source tree)
