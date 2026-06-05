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
  });
  expect(findings[0].recommendation).toContain("Remove MD5");
});

