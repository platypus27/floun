import { analyzeCryptoInJavascript } from "./javascriptanalysis";

test("emits rule metadata for JavaScript crypto matches", () => {
  const findings = analyzeCryptoInJavascript([
    {
      type: "inline",
      content: "const digest = MD5(input);",
    },
  ]);

  expect(findings[0]).toMatchObject({
    ruleId: "js-md5",
    source: "JavaScript",
    severity: "Vulnerable",
    confidence: "High",
    standardStatus: "deprecated",
  });
  expect(findings[0].rationale).toContain("MD5");
  expect(findings[0].limitations).toContain("security-sensitive");
  expect(findings[0].references?.length).toBeGreaterThan(0);
  expect(findings[0].recommendation).toContain("Remove MD5");
});
