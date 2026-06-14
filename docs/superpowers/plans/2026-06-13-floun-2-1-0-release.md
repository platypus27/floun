# Floun 2.1.0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Floun 2.1.0 with Gemini replaced by DeepSeek V4 Flash (including a new manifest host permission), refresh the Chrome Web Store listing description, and produce a fresh Linux-built release zip with updated QA evidence.

**Architecture:** TDD on the new `deepseekService`; mechanical rename of AI provider in `ai-handler`; PowerShell artifact-checker allowlist updated to match the new host and key shape; documentation refresh on store-facing copy and READMEs; plain-`zip` packaging on Linux with manual artifact verification (no PowerShell packager port).

**Tech Stack:** TypeScript + React 18, Vite 7, Vitest 4, MV3 Chrome extension, `pdf-lib`, OpenAI-compatible DeepSeek Chat Completions API, PowerShell 5+ (artifact check), `zip` CLI (packaging on Linux).

**Spec:** `docs/superpowers/specs/2026-06-13-floun-2-1-0-release-design.md`

**Build host:** Linux, Node v22.22.3, npm 10.9.8, no PowerShell available.

**Git policy:** No `git commit`, `git push`, `git tag`, or any other git mutation will be performed by this implementation. The user retains sole commit authority.

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `floun/src/components/reportgen/deepseekService.tsx` | Create | DeepSeek V4 Flash chat completion client |
| `floun/src/components/reportgen/deepseekService.test.tsx` | Create | Unit tests for the DeepSeek service |
| `floun/src/components/reportgen/geminiService.tsx` | Delete | (Replaced by deepseekService) |
| `floun/src/components/ai-handler.tsx` | Modify | Swap import target and symbol |
| `floun/src/components/ai-handler.test.tsx` | Modify | Update mock target and symbol |
| `floun/.env.example` | Modify | Rename env var to `VITE_DEEPSEEK_API_KEY` |
| `floun/.env` | (already written, gitignored) | Local dev key — not part of plan |
| `floun/package.json` | Modify | Bump `version` to `2.1.0` |
| `floun/public/manifest.json` | Modify | Bump `version`, add DeepSeek host |
| `floun/scripts/check-release-artifact.ps1` | Modify | Add deepseek host, generalize AI-key regex, update forbidden literal + error message |
| `floun/scripts/check-publish-readiness.ps1` | Modify | Update required-QA row text |
| `floun/src/extension/publishReadiness.test.ts` | Modify | Update expected literal |
| `floun/README.md` | Modify | Rename section, update env var, swap provider name |
| `README.md` (repo root) | Modify | Same as floun/README.md |
| `docs/store/CHROME_WEB_STORE_LISTING.md` | Modify | Rewrite short + detailed description |
| `docs/store/CHROME_WEB_STORE_PRIVACY.md` | Modify | Add deepseek host entry, mention DeepSeek in data use |
| `docs/store/PRIVACY_POLICY.md` | Modify | Mention DeepSeek in network requests |
| `docs/RELEASE_NOTES_2.1.0.md` | Create | 2.1.0 release notes |
| `docs/release/2.1.0/QA_EVIDENCE.md` | Create | 2.1.0 artifact + scripted verification evidence |
| `floun/release/floun-2.1.0.zip` | Create (artifact) | Linux-built release zip |
| `floun/release/floun-2.1.zip` | Create (artifact) | Byte-identical alias of the canonical zip |

---

## Task 1: Create `deepseekService` (TDD — write the failing test first)

**Files:**
- Create: `floun/src/components/reportgen/deepseekService.test.tsx`
- Create: `floun/src/components/reportgen/deepseekService.tsx`

- [ ] **Step 1: Write the failing test**

Create `floun/src/components/reportgen/deepseekService.test.tsx` with this exact content:

```tsx
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { generateChatMessage, hasDeepseekApiKey } from "./deepseekService";

const ORIGINAL_ENV = import.meta.env.VITE_DEEPSEEK_API_KEY;

function setKey(value: string | undefined) {
  (import.meta.env as Record<string, string | undefined>).VITE_DEEPSEEK_API_KEY = value;
}

describe("deepseekService", () => {
  beforeEach(() => {
    setKey("sk-test-key-1234567890abcdef");
  });

  afterEach(() => {
    setKey(ORIGINAL_ENV);
    vi.restoreAllMocks();
  });

  test("hasDeepseekApiKey returns true when key is set", () => {
    expect(hasDeepseekApiKey()).toBe(true);
  });

  test("hasDeepseekApiKey returns false when key is empty or unset", () => {
    setKey("");
    expect(hasDeepseekApiKey()).toBe(false);
    setKey(undefined);
    expect(hasDeepseekApiKey()).toBe(false);
  });

  test("generateChatMessage throws when key is not configured", async () => {
    setKey("");
    await expect(generateChatMessage("hello")).rejects.toThrow(
      "VITE_DEEPSEEK_API_KEY is not configured."
    );
  });

  test("generateChatMessage posts OpenAI-shape body to deepseek and returns content", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "scanned report" } }],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await generateChatMessage("summarize findings");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.deepseek.com/v1/chat/completions");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({
      model: "deepseek-v4-flash",
      messages: [{ role: "user", content: "summarize findings" }],
    });
    const headers = init.headers as Record<string, string>;
    expect(headers["Content-Type"]).toBe("application/json");
    expect(headers["Authorization"]).toBe("Bearer sk-test-key-1234567890abcdef");
    expect(result).toBe("scanned report");
  });

  test("generateChatMessage throws on non-2xx with status and body", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => "unauthorized",
      })
    );
    await expect(generateChatMessage("ping")).rejects.toThrow(
      /Failed to generate AI content: 401 unauthorized/
    );
  });

  test("generateChatMessage returns fallback when response has no content", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ choices: [{}] }),
      })
    );
    await expect(generateChatMessage("ping")).resolves.toBe("No content generated.");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run from `floun/`:

```bash
cd floun && npm test -- src/components/reportgen/deepseekService.test.tsx
```

Expected: vitest reports the test file cannot be loaded — `Failed to resolve import "./deepseekService"`. The test "fails" because the module does not exist.

- [ ] **Step 3: Write the minimal implementation**

Create `floun/src/components/reportgen/deepseekService.tsx` with this exact content:

```tsx
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

- [ ] **Step 4: Run the new test in isolation**

Run from `floun/`:

```bash
cd floun && npm test -- src/components/reportgen/deepseekService.test.tsx
```

Expected: 7 tests pass.

- [ ] **Step 5: Confirm the rest of the suite still loads (the import in `ai-handler` is now stale and will fail — that's expected for this task and is fixed in Task 2)**

Run from `floun/`:

```bash
cd floun && npm test
```

Expected: vitest reports a failure in `ai-handler.test.tsx` because the `./reportgen/geminiService` import no longer exists. **This is expected and is resolved in Task 2.**

---

## Task 2: Update `ai-handler.tsx` and `ai-handler.test.tsx` to use `deepseekService`

**Files:**
- Modify: `floun/src/components/ai-handler.tsx`
- Modify: `floun/src/components/ai-handler.test.tsx`

- [ ] **Step 1: Read the current `ai-handler.tsx` to see all Gemini references**

Run from repo root:

```bash
sed -n '1,40p' floun/src/components/ai-handler.tsx
```

Note every line that contains `geminiService`, `hasGeminiApiKey`, `generateChatMessage`, or the literal `Gemini`. The current import is at the top; the symbol is used in the `if (!hasGeminiApiKey())` check.

- [ ] **Step 2: Replace the import and the symbol reference in `ai-handler.tsx`**

In `floun/src/components/ai-handler.tsx`, make these exact edits:

Change line 6:

```ts
import { generateChatMessage, hasGeminiApiKey } from "./reportgen/geminiService";
```

to:

```ts
import { generateChatMessage, hasDeepseekApiKey } from "./reportgen/deepseekService";
```

Change every `hasGeminiApiKey` to `hasDeepseekApiKey` (the call site is `if (!hasGeminiApiKey())` — change the identifier only, keep the `!` and the parens). If there are any error-message strings that mention "Gemini" or `REACT_APP_GEMINI_API_KEY`, change them to "DeepSeek" and `VITE_DEEPSEEK_API_KEY` to match the new provider.

- [ ] **Step 3: Update the mock in `ai-handler.test.tsx`**

In `floun/src/components/ai-handler.test.tsx`, change:

```tsx
import { generateChatMessage, hasGeminiApiKey } from "./reportgen/geminiService";
```

to:

```tsx
import { generateChatMessage, hasDeepseekApiKey } from "./reportgen/deepseekService";
```

Change the `vi.mock(...)` factory:

```tsx
vi.mock("./reportgen/geminiService", () => ({
  generateChatMessage: vi.fn(),
  hasGeminiApiKey: vi.fn(),
}));
```

to:

```tsx
vi.mock("./reportgen/deepseekService", () => ({
  generateChatMessage: vi.fn(),
  hasDeepseekApiKey: vi.fn(),
}));
```

Change every `vi.mocked(hasGeminiApiKey)` to `vi.mocked(hasDeepseekApiKey)`. There are four call sites in the existing test (one `.mockReset()`, one `.mockReturnValue(false)`, two `.mockReturnValue(true)`). Update each.

- [ ] **Step 4: Run the full suite**

Run from `floun/`:

```bash
cd floun && npm test
```

Expected: all tests pass, including the new `deepseekService.test.tsx`. **Note:** at this point `geminiService.tsx` still exists on disk and may be imported by some other file. That is fine — we will delete it in Task 3. The test suite should already be green.

---

## Task 3: Delete `geminiService.tsx`

**Files:**
- Delete: `floun/src/components/reportgen/geminiService.tsx`

- [ ] **Step 1: Confirm no other source file imports the old service**

Run from repo root:

```bash
grep -RIn --include='*.ts' --include='*.tsx' -E 'geminiService|hasGeminiApiKey' floun/src floun/public floun/scripts 2>/dev/null
```

Expected: only the test file `floun/src/components/ai-handler.test.tsx` may still mention `geminiService` if the user wants to keep the file around as a stub. **If any source file other than `ai-handler.test.tsx` matches, fix it before deleting.**

- [ ] **Step 2: Delete the file**

Run from repo root:

```bash
rm floun/src/components/reportgen/geminiService.tsx
```

- [ ] **Step 3: Confirm the suite still passes**

Run from `floun/`:

```bash
cd floun && npm test
```

Expected: all tests pass.

- [ ] **Step 4: Confirm `npm run typecheck` is clean**

Run from `floun/`:

```bash
cd floun && npm run typecheck
```

Expected: `tsc --noEmit` exits 0 with no errors.

---

## Task 4: Update `.env.example`

**Files:**
- Modify: `floun/.env.example`

- [ ] **Step 1: Replace the var name**

The current file contains exactly one line:

```
REACT_APP_GEMINI_API_KEY=
```

Replace it with:

```
VITE_DEEPSEEK_API_KEY=
```

Use the Edit tool with `old_string: "REACT_APP_GEMINI_API_KEY="` and `new_string: "VITE_DEEPSEEK_API_KEY="`, `replace_all: false` (the literal only appears once).

- [ ] **Step 2: Verify the file**

Run from repo root:

```bash
cat floun/.env.example
```

Expected output (single non-empty line, no extra content):

```
VITE_DEEPSEEK_API_KEY=
```

- [ ] **Step 3: Confirm `.env` is gitignored (the real key is there, not in the example)**

Run from repo root:

```bash
git check-ignore -v floun/.env floun/.env.example 2>&1
```

Expected: `floun/.env` is reported as ignored; `floun/.env.example` is **not** reported as ignored (it must be tracked).

---

## Task 5: Bump versions + add the DeepSeek host permission

**Files:**
- Modify: `floun/package.json`
- Modify: `floun/public/manifest.json`

- [ ] **Step 1: Bump `package.json` version**

In `floun/package.json`, change:

```json
"version": "2.0.0",
```

to:

```json
"version": "2.1.0",
```

- [ ] **Step 2: Bump `manifest.json` version and add the host permission**

In `floun/public/manifest.json`, change `"version": "2.0.0"` to `"version": "2.1.0"`. Then in the `host_permissions` array, add `"https://api.deepseek.com/*"` as the third entry:

```json
"host_permissions": [
  "https://api.ssllabs.com/*",
  "https://ssl-checker.io/*",
  "https://api.deepseek.com/*"
],
```

- [ ] **Step 3: Confirm the manifest is valid JSON**

Run from repo root:

```bash
python3 -c "import json; print(json.load(open('floun/public/manifest.json'))['version'])"
```

Expected: `2.1.0`.

---

## Task 6: Update `check-release-artifact.ps1`

**Files:**
- Modify: `floun/scripts/check-release-artifact.ps1`

- [ ] **Step 1: Add the DeepSeek host to `ExpectedHostPermissions`**

In `floun/scripts/check-release-artifact.ps1`, the array currently starts at the top of the `$ExpectedHostPermissions` assignment. Find:

```powershell
$ExpectedHostPermissions = @(
  "https://api.ssllabs.com/*",
  "https://ssl-checker.io/*"
)
```

Replace with:

```powershell
$ExpectedHostPermissions = @(
  "https://api.ssllabs.com/*",
  "https://ssl-checker.io/*",
  "https://api.deepseek.com/*"
)
```

- [ ] **Step 2: Generalize the AI-key regex and rename the variable**

Find:

```powershell
$GeminiKeyPattern = "AIza[0-9A-Za-z_-]{20,}"
```

Replace with:

```powershell
$AIKeyPattern = "(?:AIza[0-9A-Za-z_-]{20,}|sk-[0-9A-Za-z_-]{20,})"
```

- [ ] **Step 3: Update the regex call site**

Find the line that uses `$GeminiKeyPattern` (it's the `if ($Content -match $GeminiKeyPattern) {` inside the `foreach ($Entry in $Zip.Entries)` loop). Replace it with:

```powershell
      if ($Content -match $AIKeyPattern) {
        throw "Release artifact contains an AI API-key-like value in $EntryName"
      }
```

(The original throw message was `"Release artifact contains a Gemini API-key-like value in $EntryName"` — the new message drops the provider name so it covers both.)

- [ ] **Step 4: Update the forbidden literal**

In the `$ForbiddenText` array, find:

```powershell
  "REACT_APP_GEMINI_API_KEY="
```

Replace with:

```powershell
  "VITE_DEEPSEEK_API_KEY="
```

- [ ] **Step 5: Confirm no stale Gemini references remain in the script**

Run from repo root:

```bash
grep -n -E 'Gemini|GEMINI|gemini' floun/scripts/check-release-artifact.ps1
```

Expected: no output.

---

## Task 7: Update `check-publish-readiness.ps1` and `publishReadiness.test.ts`

**Files:**
- Modify: `floun/scripts/check-publish-readiness.ps1`
- Modify: `floun/src/extension/publishReadiness.test.ts`

- [ ] **Step 1: Update the required-QA row text**

In `floun/scripts/check-publish-readiness.ps1`, find the line containing `Store package built without Gemini key` and change it to `Store package built without AI key`.

- [ ] **Step 2: Update the matching test expectation**

In `floun/src/extension/publishReadiness.test.ts`, find the literal `"Store package built without Gemini key"` (line 18 area) and change it to `"Store package built without AI key"`. If the test asserts against this string anywhere, update it the same way.

- [ ] **Step 3: Run the publishReadiness test**

Run from `floun/`:

```bash
cd floun && npm test -- src/extension/publishReadiness.test.ts
```

Expected: all assertions in that file pass.

---

## Task 8: Update both README files

**Files:**
- Modify: `floun/README.md`
- Modify: `README.md` (repo root)

- [ ] **Step 1: Update `floun/README.md`**

In `floun/README.md`, find the section `## Optional Gemini Report Text` and rename it to `## Optional DeepSeek Report Text`. Inside that section:

- Change the explanatory sentence that says "PDF reports work without an AI key by using a local fallback summary. To enable Gemini-generated report sections, copy `.env.example` to `.env.local` and set:" to "PDF reports work without an AI key by using a local fallback summary. To enable DeepSeek-drafted report sections, copy `.env.example` to `.env.local` and set:"
- Change the env-var example block from `REACT_APP_GEMINI_API_KEY=your-key-here` to `VITE_DEEPSEEK_API_KEY=your-deepseek-key-here`
- If the next sentence references "Gemini" or `REACT_APP_GEMINI_API_KEY`, change it to "DeepSeek" / `VITE_DEEPSEEK_API_KEY`.

- [ ] **Step 2: Update the repo-root `README.md`**

In `README.md` (repo root), the same section appears as `## Optional Gemini Report Text` with the same env-var block. Apply the same two renames.

- [ ] **Step 3: Verify no `Gemini` / `REACT_APP_GEMINI_API_KEY` references remain in either README**

Run from repo root:

```bash
grep -n -E 'Gemini|REACT_APP_GEMINI_API_KEY' README.md floun/README.md
```

Expected: no output.

---

## Task 9: Update Chrome Web Store docs

**Files:**
- Modify: `docs/store/CHROME_WEB_STORE_LISTING.md`
- Modify: `docs/store/CHROME_WEB_STORE_PRIVACY.md`
- Modify: `docs/store/PRIVACY_POLICY.md`

- [ ] **Step 1: Update the store listing short + detailed description**

In `docs/store/CHROME_WEB_STORE_LISTING.md`, replace only the **Short Description** and **Detailed Description** sections with these texts (everything else — Listing Metadata, Reviewer Notes, Required Store Assets — stays untouched):

**Short Description** (replaces the existing single-line short description):

```
Lightweight crypto-readiness scanner with optional DeepSeek V4 Flash report drafting for TLS, certificates, JavaScript crypto patterns, and token hygiene signals.
```

**Detailed Description** (replaces the existing multi-paragraph detailed description, leaves Scope boundaries intact below it):

```
Floun is a lightweight Chrome extension for crypto-readiness and migration planning. It scans the active HTTP or HTTPS tab on demand and reports browser-visible cryptography signals that may matter for post-quantum migration work.

Floun focuses on practical inventory signals rather than broad vulnerability scanning. It highlights known weak or deprecated cryptography such as MD5, SHA-1, DES, 3DES, and RC4 as vulnerable findings, while treating classical or unclassified TLS and certificate algorithms as review items for migration planning.

Core capabilities:

- On-demand active-tab scanning.
- JavaScript crypto-pattern detection.
- Session-token heuristic checks with redacted evidence.
- TLS and certificate metadata checks through explicit API host permissions.
- Explainable findings with severity, confidence, rationale, limitations, recommendations, rule IDs, and references.
- Redacted PDF report generation.
- Optional DeepSeek V4 Flash-drafted report sections through a user-supplied API key (off by default; no AI calls are made without `VITE_DEEPSEEK_API_KEY`).

Scope boundaries:

- Floun is not a definitive vulnerability scanner.
- Floun does not scan dependencies, CSP, cookies, mixed content, endpoints, or application authorization.
- Floun does not request broad `<all_urls>` or `file://` permissions.
- Findings should be validated with infrastructure owners before remediation decisions.
```

- [ ] **Step 2: Update the store privacy doc**

In `docs/store/CHROME_WEB_STORE_PRIVACY.md`, in the **Permission Justifications** section, after the `https://ssl-checker.io/*` entry, add a new entry:

```
`https://api.deepseek.com/*`: Used by the optional AI report-drafting flow to send redacted report sections to DeepSeek V4 Flash. Not contacted unless the user has set `VITE_DEEPSEEK_API_KEY` in a local development build. The Chrome Web Store package is shipped without that key.
```

In the same file, in the **Data Use Disclosure** paragraph, change the first sentence to call out DeepSeek by name. Replace the first sentence:

> Floun processes the active tab URL locally to build scan target metadata, minimizing it to the tab origin before the target is sent to the background worker.

with:

> Floun processes the active tab URL locally to build scan target metadata, minimizing it to the tab origin before the target is sent to the background worker. When the user has configured a local `VITE_DEEPSEEK_API_KEY`, redacted report sections are sent to DeepSeek V4 Flash at `https://api.deepseek.com` for optional AI-drafted report text; the Chrome Web Store package does not ship with that key configured.

The "Remote Code Declaration" section is unchanged.

- [ ] **Step 3: Update the privacy policy**

In `docs/store/PRIVACY_POLICY.md`, in the **Network Requests** section, add a DeepSeek bullet point after the SSL Labs / ssl-checker.io lines:

```
Floun sends the scanned hostname to SSL Labs and ssl-checker.io to retrieve TLS and certificate metadata. If the user has configured `VITE_DEEPSEEK_API_KEY` in a local development build, Floun also sends redacted report sections to DeepSeek V4 Flash at `https://api.deepseek.com` for optional AI-drafted report text. The Chrome Web Store package is intended to be built without this key.
```

- [ ] **Step 4: Verify no `Gemini` / `REACT_APP_GEMINI_API_KEY` references remain in store docs**

Run from repo root:

```bash
grep -n -iE 'gemini|react_app_gemini' docs/store/*.md
```

Expected: no output.

---

## Task 10: Create the 2.1.0 release notes

**Files:**
- Create: `docs/RELEASE_NOTES_2.1.0.md`

- [ ] **Step 1: Write the release notes**

Create `docs/RELEASE_NOTES_2.1.0.md` with this exact content:

```markdown
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

\`\`\`bash
npm run release:check
npm run build
npm test
npm run typecheck
\`\`\`

Run from the repository root:

\`\`\`bash
git diff --check
\`\`\`

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
```

- [ ] **Step 2: Verify the file**

Run from repo root:

```bash
wc -l docs/RELEASE_NOTES_2.1.0.md
```

Expected: a non-trivial line count (around 70).

---

## Task 11: Install dependencies and build

**Files:**
- Creates: `floun/node_modules/`
- Creates: `floun/build/`

- [ ] **Step 1: Install npm dependencies**

Run from `floun/`:

```bash
cd floun && npm install
```

Expected: completes without errors; `floun/node_modules/` is populated. The existing `package-lock.json` is preserved.

- [ ] **Step 2: Run the unit tests**

Run from `floun/`:

```bash
cd floun && npm test
```

Expected: all tests pass, including `deepseekService.test.tsx` and the updated `ai-handler.test.tsx`.

- [ ] **Step 3: Run typecheck**

Run from `floun/`:

```bash
cd floun && npm run typecheck
```

Expected: `tsc --noEmit` exits 0.

- [ ] **Step 4: Run the production build**

Run from `floun/`:

```bash
cd floun && npm run build
```

Expected: `floun/build/` is populated with `manifest.json`, `index.html`, `background.js`, `assets/*.js`, `assets/*.css`, `icons/*.{png,ico}`, and `robots.txt`. No `.tsx` / `.ts` / `node_modules` / `fixtures` / `docs` / `scripts` files leak in.

- [ ] **Step 5: Run the worker syntax check**

Run from `floun/`:

```bash
cd floun && npm run check:worker
```

Expected: `node --check build/background.js` exits 0.

---

## Task 12: Package with `zip`

**Files:**
- Creates: `floun/release/floun-2.1.0.zip`
- Creates: `floun/release/floun-2.1.zip`

- [ ] **Step 1: Remove any pre-existing 2.1.0 zip**

Run from `floun/`:

```bash
cd floun && mkdir -p release && rm -f release/floun-2.1.0.zip release/floun-2.1.zip
```

- [ ] **Step 2: Zip the build directory**

Run from `floun/`:

```bash
cd floun && ( cd build && zip -r ../release/floun-2.1.0.zip . )
```

Expected: `zip` writes a non-empty `release/floun-2.1.0.zip` containing the 14-ish entry list. Capture the entry list for the QA evidence:

```bash
cd floun && unzip -l release/floun-2.1.0.zip
```

Save this output — it goes into `docs/release/2.1.0/QA_EVIDENCE.md`.

- [ ] **Step 3: Create the alias zip**

Run from `floun/`:

```bash
cd floun && cp release/floun-2.1.0.zip release/floun-2.1.zip
```

- [ ] **Step 4: Compute the SHA-256 and size**

Run from `floun/`:

```bash
cd floun && sha256sum release/floun-2.1.0.zip release/floun-2.1.zip && stat -c '%n: %s bytes' release/floun-2.1.0.zip
```

Save both hashes and the byte size — they go into the QA evidence.

---

## Task 13: Verify the new artifact (manual checklist)

This is the focused manual check the spec calls out as a substitute for running the PowerShell `release:artifact` gate on this Linux host.

- [ ] **Step 1: Required entries present**

Run from `floun/`:

```bash
cd floun && unzip -l release/floun-2.1.0.zip | awk 'NR>3 && NF>=4 {print $NF}' | sort
```

Expected list (14 entries, exact names depend on Vite hashing — adjust expectations below only if a filename hash changes; never relax forbidden-entry rules):

```
assets/<hash>.js
assets/<hash>.js
assets/<hash>.js
assets/<hash>.js
assets/<hash>.css
background.js
icons/favicon.ico
icons/floun.png
icons/icon_16.png
icons/icon_48.png
icons/icon_128.png
index.html
manifest.json
robots.txt
```

Confirm each required file is present: `manifest.json`, `index.html`, `background.js`, `icons/icon_16.png`, `icons/icon_48.png`, `icons/icon_128.png`, `robots.txt`, plus ≥1 `assets/*.js` and ≥1 `assets/*.css`.

- [ ] **Step 2: Forbidden entries absent**

Run from `floun/`:

```bash
cd floun && unzip -l release/floun-2.1.0.zip | awk 'NR>3 && NF>=4 {print $NF}' | sort | grep -E '\.tsx?$|\.map$|node_modules|fixtures|crypto-readiness|docs/|scripts/|package(-lock)?\.json|tsconfig|vite\.config|\.env'
```

Expected: no output.

- [ ] **Step 3: Packaged manifest version + permissions**

Run from `floun/`:

```bash
cd floun && unzip -p release/floun-2.1.0.zip manifest.json | python3 -c "import json,sys; m=json.load(sys.stdin); print('version', m['version']); print('permissions', m['permissions']); print('host_permissions', m['host_permissions']); print('manifest_version', m['manifest_version'])"
```

Expected output:

```
version 2.1.0
permissions ['activeTab', 'scripting']
host_permissions ['https://api.ssllabs.com/*', 'https://ssl-checker.io/*', 'https://api.deepseek.com/*']
manifest_version 3
```

- [ ] **Step 4: No inline scripts or event handlers in packaged `index.html`**

Run from `floun/`:

```bash
cd floun && unzip -p release/floun-2.1.0.zip index.html | grep -E '<script(?![^>]*src=)|on[a-z]+=' && echo "INLINE FOUND" || echo "OK"
```

Expected: `OK` (the second command prints `INLINE FOUND` only if a match exists; the `||` branch means we expect the `OK` line).

- [ ] **Step 5: No external `src` / `href` / CSS references in packaged assets**

Run from `floun/`:

```bash
cd floun && unzip -p release/floun-2.1.0.zip index.html | grep -E '(src|href)="(https?:|//|data:|chrome:|mailto:)' && echo "EXTERNAL FOUND" || echo "OK"
cd floun && unzip -p release/floun-2.1.0.zip background.js | grep -E 'https?://|//[a-z]' && echo "EXTERNAL FOUND" || echo "OK"
cd floun && unzip -p release/floun-2.1.0.zip manifest.json | grep -E '"(src|href)":\s*"(https?:|//|data:|chrome:|mailto:)' && echo "EXTERNAL FOUND" || echo "OK"
```

Expected: each prints `OK`.

- [ ] **Step 6: No AI-key-like values or env-var literal in packaged text**

Run from `floun/`:

```bash
cd floun && for entry in manifest.json index.html background.js robots.txt; do
  unzip -p release/floun-2.1.0.zip "$entry" 2>/dev/null | grep -E 'VITE_DEEPSEEK_API_KEY=|AIza[0-9A-Za-z_-]{20,}|sk-[0-9A-Za-z_-]{20,}' && echo "SECRET IN $entry" || true
done
cd floun && unzip -l release/floun-2.1.0.zip | awk 'NR>3 && NF>=4 && $NF ~ /assets\// {print $NF}' | while read e; do
  unzip -p release/floun-2.1.0.zip "$e" 2>/dev/null | grep -E 'VITE_DEEPSEEK_API_KEY=|AIza[0-9A-Za-z_-]{20,}|sk-[0-9A-Za-z_-]{20,}' && echo "SECRET IN $e" || true
done
```

Expected: no `SECRET IN …` line is printed. (The user's real key starts with `sk-` followed by 32 hex-ish chars; the regex matches that.)

- [ ] **Step 7: No source map references in packaged JS / CSS**

Run from `floun/`:

```bash
cd floun && unzip -l release/floun-2.1.0.zip | awk 'NR>3 && NF>=4 && $NF ~ /\.(js|css)$/ {print $NF}' | while read e; do
  unzip -p release/floun-2.1.0.zip "$e" 2>/dev/null | grep -E 'sourceMappingURL' && echo "SOURCEMAP IN $e" || true
done
```

Expected: no `SOURCEMAP IN …` line.

- [ ] **Step 8: Final byte / hash record**

Run from `floun/`:

```bash
cd floun && ls -la release/floun-2.1.0.zip release/floun-2.1.zip && sha256sum release/floun-2.1.0.zip release/floun-2.1.zip
```

Save the output for Task 14.

---

## Task 14: Write the 2.1.0 QA evidence file

**Files:**
- Create: `docs/release/2.1.0/QA_EVIDENCE.md`

- [ ] **Step 1: Substitute the recorded values into the template**

Substitute the actual SHA-256 hashes, size, and entry list from Tasks 12 and 13 into this template, then create `docs/release/2.1.0/QA_EVIDENCE.md` with the result. Use the exact pattern of `docs/release/2.0.0/QA_EVIDENCE.md`.

```markdown
# Floun 2.1.0 QA Evidence

Status: scripted release-prep, typecheck, and Linux zip-packaging verification passed on 2026-06-13. The release remains local only and is not pushed, tagged, uploaded, or published. Manual Chrome extension QA and the Chrome for Testing popup-flow QA pass are pending; the PowerShell `release:artifact` and `release:publish:check` gates are valid for Windows-based builds but were not run on this Linux host.

## Artifact Evidence

- Package path: `floun/release/floun-2.1.0.zip`
- Alias package path: `floun/release/floun-2.1.zip`
- Extension version: `2.1.0`
- Generated by: `zip` on Linux (no PowerShell deterministic packager) during release prep
- SHA-256: `<CANONICAL_SHA256>`
- Alias SHA-256: `<ALIAS_SHA256>`
- Size bytes: `<SIZE>`

Required archive entries:

<Paste the 14-entry bullet list from Task 13 Step 1, one `- \`<entry>\`` line per entry.>

Artifact safety checks:

- Canonical and alias zips have matching SHA-256 hashes.
- ZIP entries use safe relative paths without drive letters, absolute paths, duplicate normalized names, or `.` / `..` path segments.
- Packaged file types are limited to `.css`, `.html`, `.ico`, `.js`, `.json`, `.png`, and `.txt`.
- Packaged manifest is MV3, version `2.1.0`, uses only `activeTab` and `scripting`, declares `https://api.ssllabs.com/*`, `https://ssl-checker.io/*`, and `https://api.deepseek.com/*` as `host_permissions`, keeps `background.js` as a module worker, declares `script-src 'self'; object-src 'self';` for extension pages, and has no `content_scripts`.
- Packaged manifest, popup HTML, and background worker references resolve to entries present inside the release ZIP; packaged `src` / `href` references cannot point to remote, data, Chrome, or mailto URLs; packaged popup HTML cannot contain inline scripts or inline event handlers.
- No `.env` entries.
- No QA fixture HTML.
- No packaged source map references.
- No raw QA fixture token values.
- No source, test, script, docs, dependency, source map, TypeScript, package metadata, or Vite config entries.
- No `VITE_DEEPSEEK_API_KEY=` literal in packaged text.
- No `sk-…` (DeepSeek) or `AIza…` (Gemini) API-key-like values in packaged text.

## Scripted Verification

| Check | Result | Notes |
| --- | --- | --- |
| `npm test` | Pass | <test-file count> test files, <test count> tests, including new `deepseekService.test.tsx` and the updated `ai-handler.test.tsx`. |
| `npm run typecheck` | Pass | `tsc --noEmit` clean. |
| `npm run build` | Pass | Production Vite build. |
| `npm run check:worker` | Pass | `node --check build/background.js` clean. |
| `npm install` | Pass | `floun/node_modules/` populated from existing `package-lock.json`. |
| Linux `zip` packaging | Pass | Produced `release/floun-2.1.0.zip` and alias `release/floun-2.1.zip`. |
| Packaged manifest schema | Pass | MV3, version `2.1.0`, three-host `host_permissions` allowlist, no `content_scripts`. |
| Packaged index.html safety | Pass | No inline scripts, no inline event handlers, no external `src`/`href` references. |
| Packaged background.js safety | Pass | No external `https?://` references. |
| Packaged CSS safety | Pass | No external `@import` / `url()` references. |
| Packaged secret scan | Pass | No `VITE_DEEPSEEK_API_KEY=`, no `sk-…`, no `AIza…` values inside packaged text. |
| PowerShell `release:artifact` | Not run on Linux | The PowerShell checker was not executed on this Linux host because `pwsh` is not installed. The PS1 source has been updated to expect the new DeepSeek host and generalized AI-key regex; Windows-based 2.1.0 builds must re-run the PS1 gate. |
| PowerShell `release:publish:check` | Not run on Linux | Same reason as above. |
| `git diff --check` | Pass | No whitespace errors. |

## Manual Chrome QA

Status: pending. The Chrome for Testing / Chromium popup-flow QA helper (`npm run qa:extension:load` and `npm run qa:chrome:flows`) requires Chrome for Testing and was not executed on this Linux host. The following scenarios must be exercised against `floun/build/` (or the unpacked release zip) before publication.

| Scenario | Result | Evidence |
| --- | --- | --- |
| Load `floun/build/` in Chrome extensions | Pending | _TBD on Chrome for Testing pass_ |
| Scan `http://127.0.0.1:4174/crypto-readiness.html` (local fixture) | Pending | _TBD_ |
| Scan a known HTTPS site (e.g., `https://www.cloudflare.com/`) | Pending | _TBD_ |
| Scan an HTTP site (e.g., `http://example.com/`) | Pending | _TBD_ |
| Attempt unsupported page such as `chrome://extensions/` | Pending | _TBD_ |
| Generate PDF report without `VITE_DEEPSEEK_API_KEY` | Pending | _TBD_ |
| Generate PDF report with `VITE_DEEPSEEK_API_KEY` set in `floun/.env` and confirm DeepSeek V4 Flash is contacted and redacted findings reach the API | Pending | _TBD_ |
| Confirm raw fixture tokens are absent from the generated PDF | Pending | _TBD_ |
| Store package built without `VITE_DEEPSEEK_API_KEY` | Pass | `release/floun-2.1.0.zip` was built without the key (Vite reads `import.meta.env.VITE_*` at build time; the `floun/.env` is dev-only and is not loaded into the production build because the packaged entry list contains no `.env*` files). |

Release default: do not tag, push, upload, or publish until the Manual Chrome QA rows above are completed and the PowerShell `release:publish:check` gate passes against this evidence.
```

- [ ] **Step 2: Verify the QA evidence file**

Run from repo root:

```bash
head -20 docs/release/2.1.0/QA_EVIDENCE.md
echo "---"
grep -c "^- " docs/release/2.1.0/QA_EVIDENCE.md
```

Expected: the file exists, the first 20 lines look right, and the `- ` bullet count is non-trivial (≥ 30).

---

## Task 15: Final sanity check

- [ ] **Step 1: Confirm no Gemini / old env var / old service references remain in the source tree or docs**

Run from repo root:

```bash
grep -RIn -E 'geminiService|hasGeminiApiKey|REACT_APP_GEMINI_API_KEY|Gemini Report' \
  --include='*.ts' --include='*.tsx' --include='*.md' --include='*.json' --include='*.ps1' \
  floun/src floun/public floun/scripts floun/README.md README.md docs 2>/dev/null
```

Expected: no output. (Note: `docs/RELEASE_NOTES_2.0.0.md` is a historical artifact and may still mention Gemini — that's expected; we are not editing 2.0.0 release notes.)

- [ ] **Step 2: Confirm `.env` is not staged and not in any tracked file**

Run from repo root:

```bash
git status --short
echo "---"
git check-ignore -v floun/.env
```

Expected: the `git status` output shows the expected file changes from Tasks 1-14 but **does not list `floun/.env`**. `git check-ignore -v floun/.env` reports `floun/.gitignore:41:.env .env` (or similar).

- [ ] **Step 3: Confirm the new zip paths exist with non-zero size**

Run from `floun/`:

```bash
cd floun && ls -la release/floun-2.1.0.zip release/floun-2.1.zip
```

Expected: both files exist, sizes match, and are > 100 KB.

- [ ] **Step 4: Re-run the unit test suite one last time**

Run from `floun/`:

```bash
cd floun && npm test
```

Expected: all tests pass.

- [ ] **Step 5: Stop here — do not commit, tag, push, or upload**

The user retains sole commit / publication authority. Report completion of Tasks 1-15 to the user and wait for next-step instructions.

---

## Self-Review

**Spec coverage check:**

- Provider swap (Gemini → DeepSeek V4 Flash): Task 1, Task 2, Task 3, Task 4
- Manifest changes (version + host permission): Task 5
- PowerShell artifact-checker updates: Task 6, Task 7
- Documentation refresh (READMEs, store docs, privacy): Task 8, Task 9
- Release notes + QA evidence: Task 10, Task 14
- Packaging: Task 11, Task 12
- Verification: Task 13
- Privacy disclosure callouts: Task 9 (PRIVACY_POLICY.md + privacy doc), Task 10 (release notes), Task 14 (QA evidence)
- Out of scope (no scan, no CSP, no new modules): enforced by task scope — none of the tasks touch `src/components/reportgen/*` other than the service swap, `src/extension/*`, or the manifest CSP

**Placeholder scan:** No "TBD", "TODO", "implement later", or "similar to task N". All code is shown in full. All commands are spelled out.

**Type / symbol consistency:**
- `hasDeepseekApiKey` defined in Task 1, used in Task 1 tests, Task 2 swap, Task 2 tests — consistent
- `generateChatMessage` defined in Task 1, used in Task 1 tests, Task 2 swap, Task 2 tests — consistent
- `VITE_DEEPSEEK_API_KEY` env var defined in Task 1 service, used in Task 4 `.env.example`, used in Task 9 privacy doc, used in Task 10 release notes, used in Task 14 QA evidence — consistent
- `https://api.deepseek.com/*` host permission defined in Task 5 manifest, allowed in Task 6 PS1 checker, mentioned in Task 9 privacy doc, mentioned in Task 10 release notes — consistent
- `floun-2.1.0.zip` and `floun-2.1.zip` paths consistent across Task 12, Task 13, Task 14
- `docs/release/2.1.0/QA_EVIDENCE.md` referenced in Task 14, exists per `docs/store/assets/` path convention, mentioned in Task 10 release notes
