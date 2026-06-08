declare const process: { cwd: () => string };
declare function require(moduleName: string): any;

const { execFileSync } = require("child_process");
const { mkdtempSync, rmSync, writeFileSync } = require("fs");
const { tmpdir } = require("os");
const { dirname, join } = require("path");

const publishReadinessScript = join(process.cwd(), "scripts", "check-publish-readiness.ps1");

const manualQaScenarios = [
  "Load `floun/build/` in Chrome extensions",
  "Scan `http://127.0.0.1:4174/crypto-readiness.html`",
  "Scan `https://www.cloudflare.com/`",
  "Scan `http://example.com/`",
  "Attempt unsupported page such as `chrome://extensions/`",
  "Generate PDF report",
  "Store package built without Gemini key",
];

function runPublishReadinessCheck(extraArgs: string[] = []) {
  try {
    const output = execFileSync("powershell", [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      publishReadinessScript,
      ...extraArgs,
    ], {
      encoding: "utf8",
      stdio: "pipe",
    });

    return { output, errorMessage: "" };
  } catch (error) {
    return { output: "", errorMessage: String(error) };
  }
}

function writeQaEvidence(rows: Array<{ scenario: string; result: string; evidence: string }>): string {
  const tempDir = mkdtempSync(join(tmpdir(), "floun-publish-readiness-"));
  const evidencePath = join(tempDir, "QA_EVIDENCE.md");
  const tableRows = rows
    .map(row => `| ${row.scenario} | ${row.result} | ${row.evidence} |`)
    .join("\n");

  writeFileSync(evidencePath, [
    "# Test QA Evidence",
    "",
    "## Manual Chrome QA",
    "",
    "| Scenario | Result | Evidence |",
    "| --- | --- | --- |",
    tableRows,
    "",
  ].join("\n"));

  return evidencePath;
}

function runWithQaEvidence(rows: Array<{ scenario: string; result: string; evidence: string }>) {
  const evidencePath = writeQaEvidence(rows);

  try {
    return runPublishReadinessCheck(["-QaEvidencePath", evidencePath]);
  } finally {
    rmSync(dirname(evidencePath), { recursive: true, force: true });
  }
}

test("publish readiness check rejects blocked manual Chrome QA", () => {
  const { errorMessage } = runPublishReadinessCheck();

  expect(errorMessage).toMatch(/Manual Chrome QA/i);
  expect(errorMessage).toMatch(/Load `floun\/build\/` in Chrome\s+extensions=Blocked/);
  expect(errorMessage).not.toContain("Scenario=Result");
}, 30000);

test("publish readiness check passes when every required manual QA row has evidence", () => {
  const { output, errorMessage } = runWithQaEvidence(
    manualQaScenarios.map(scenario => ({
      scenario,
      result: "Pass",
      evidence: `Verified manually for ${scenario}.`,
    }))
  );

  expect(errorMessage).toBe("");
  expect(output).toContain("Publish readiness verified.");
}, 30000);

test("publish readiness check rejects missing required manual QA scenarios", () => {
  const { errorMessage } = runWithQaEvidence(
    manualQaScenarios
      .filter(scenario => scenario !== "Generate PDF report")
      .map(scenario => ({
        scenario,
        result: "Pass",
        evidence: `Verified manually for ${scenario}.`,
      }))
  );

  expect(errorMessage).toMatch(/missing required Manual Chrome QA scenarios/i);
  expect(errorMessage).toContain("Generate PDF report");
}, 30000);

test("publish readiness check rejects pass rows with placeholder evidence", () => {
  const { errorMessage } = runWithQaEvidence(
    manualQaScenarios.map(scenario => ({
      scenario,
      result: "Pass",
      evidence: scenario === "Generate PDF report"
        ? "Requires loaded extension popup; complete manually."
        : `Verified manually for ${scenario}.`,
    }))
  );

  expect(errorMessage).toMatch(/incomplete Manual Chrome QA evidence/i);
  expect(errorMessage).toContain("Generate PDF report");
}, 30000);

export {};
