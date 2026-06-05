import { analyzeTokens } from "./tokenAnalysis";

test("returns an informational finding when no tokens are available", () => {
  expect(analyzeTokens([])[0]).toMatchObject({
    source: "Tokens",
    severity: "Info",
  });
});

test("redacts token evidence in token findings", () => {
  const findings = analyzeTokens(["abc"]);

  expect(findings[0]).toMatchObject({
    source: "Tokens",
    severity: "Vulnerable",
    evidence: "[redacted token, 3 characters]",
    standardStatus: "heuristic",
    sensitive: true,
  });
  expect(findings[0].limitations).toContain("browser-visible");
  expect(findings[0].recommendation).toContain("Validate token generation");
  expect(findings[0].evidence).not.toContain("abc");
});
