declare const process: { cwd: () => string };
declare function require(moduleName: string): any;

const { execFileSync } = require("child_process");
const { mkdtempSync, readFileSync, rmSync, writeFileSync } = require("fs");
const { tmpdir } = require("os");
const { join } = require("path");

const projectRoot = process.cwd();
const repoRoot = join(projectRoot, "..");
const artifactScript = join(projectRoot, "scripts", "check-release-artifact.ps1");
const qaEvidencePath = join(repoRoot, "docs", "release", "2.0.0", "QA_EVIDENCE.md");

test("release artifact check rejects stale QA evidence", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "floun-qa-evidence-"));
  const staleEvidencePath = join(tempDir, "QA_EVIDENCE.md");
  const staleEvidence = readFileSync(qaEvidencePath, "utf8")
    .replace(/SHA-256: `[^`]+`/, "SHA-256: `stale`")
    .replace(/Alias SHA-256: `[^`]+`/, "Alias SHA-256: `stale`")
    .replace(/Size bytes: `\d+`/, "Size bytes: `1`");

  writeFileSync(staleEvidencePath, staleEvidence, "utf8");

  try {
    expect(() => execFileSync("powershell", [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      artifactScript,
      "-QaEvidencePath",
      staleEvidencePath,
    ], {
      encoding: "utf8",
      stdio: "pipe",
    })).toThrow(/QA evidence/i);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}, 30000);

test("release artifact check enforces packaged manifest CSP", () => {
  const script = readFileSync(artifactScript, "utf8");

  expect(script).toContain("$ExpectedExtensionPagesCsp = \"script-src 'self'; object-src 'self';\"");
  expect(script).toContain("$Manifest.content_security_policy.extension_pages");
  expect(script).toContain("Packaged manifest extension_pages CSP");
});

test("release artifact check rejects remote or data packaged references", () => {
  const script = readFileSync(artifactScript, "utf8");

  expect(script).toContain("Release artifact contains forbidden external or data reference");
  expect(script).not.toContain('return $null');
});

test("release artifact check rejects inline HTML execution", () => {
  const script = readFileSync(artifactScript, "utf8");

  expect(script).toContain("Packaged index.html must not contain inline scripts.");
  expect(script).toContain("Packaged index.html must not contain inline event handlers.");
});

test("release artifact check rejects source map references", () => {
  const script = readFileSync(artifactScript, "utf8");

  expect(script).toContain("Release artifact contains forbidden source map reference");
  expect(script).toContain("sourceMappingURL");
});

export {};
