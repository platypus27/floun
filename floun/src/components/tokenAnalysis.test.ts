import { analyzeTokens } from "./tokenAnalysis";

const sharedPrefix = "aZ7qLm9PQr4xVn2Ty8Bc0Kd6Se3FgH";

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
    confidence: "Medium",
    evidence: "[redacted token, 3 characters]",
    standardStatus: "heuristic",
    sensitive: true,
  });
  expect(findings[0].details).toContain("token-format:fail:Medium:redacted (Short Token)");
  expect(findings[0].limitations).toContain("browser-visible");
  expect(findings[0].recommendation).toContain("Validate token generation");
  expect(findings[0].evidence).not.toContain("abc");
});

test("runs batch token checks without exposing shared token substrings", () => {
  const firstToken = `${sharedPrefix}A`;
  const secondToken = `${sharedPrefix}B`;
  const findings = analyzeTokens([firstToken, secondToken]);

  expect(findings).toHaveLength(2);
  expect(findings[0]).toMatchObject({
    source: "Tokens",
    severity: "Vulnerable",
    evidence: `[redacted token, ${firstToken.length} characters]`,
    sensitive: true,
  });
  expect(findings[0].details).toContain("token-batch-pattern:fail:Medium:redacted (Nearly Identical Common Prefix)");
  expect(findings[1].details).toContain("token-batch-pattern:fail:Medium:redacted (Nearly Identical Common Prefix)");
  expect(findings.map(finding => finding.details).join(" ")).not.toContain(sharedPrefix);
  expect(findings.map(finding => finding.evidence).join(" ")).not.toContain(sharedPrefix);
});
