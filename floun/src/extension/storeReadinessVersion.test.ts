declare const process: { cwd: () => string };
declare function require(moduleName: string): any;

const { readFileSync } = require("fs");
const { join } = require("path");

const storeReadinessScript = join(process.cwd(), "scripts", "check-store-readiness.ps1");

test("store readiness check derives release evidence path from package version", () => {
  const script = readFileSync(storeReadinessScript, "utf8");

  expect(script).not.toContain('docs\\release\\2.0.0');
  expect(script).toContain("$Package.version");
});

export {};
