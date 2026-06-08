declare const process: { cwd: () => string };
declare function require(moduleName: string): any;

const { execFileSync } = require("child_process");
const { join } = require("path");

const publishReadinessScript = join(process.cwd(), "scripts", "check-publish-readiness.ps1");

test("publish readiness check rejects blocked manual Chrome QA", () => {
  let errorMessage = "";

  try {
    execFileSync("powershell", [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      publishReadinessScript,
    ], {
      encoding: "utf8",
      stdio: "pipe",
    });
  } catch (error) {
    errorMessage = String(error);
  }

  expect(errorMessage).toMatch(/Manual Chrome QA/i);
  expect(errorMessage).toMatch(/Load `floun\/build\/` in Chrome\s+extensions=Blocked/);
  expect(errorMessage).not.toContain("Scenario=Result");
}, 30000);

export {};
