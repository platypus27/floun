import { AnalysisFinding } from "./analysisFinding";
import { summaryFindingSerializer } from "./findingUiSerializers";

test("summary serializer keeps existing UI evidence behavior explicit", () => {
  const finding: AnalysisFinding = {
    source: "Tokens",
    severity: "Vulnerable",
    title: "Session token may be weak",
    location: "Tokens",
    evidence: "[redacted token, 12 characters]",
    details: "Failed checks: token-format.",
  };

  expect(summaryFindingSerializer).toMatchObject({
    target: "summary",
    evidencePolicy: "include-existing",
  });
  expect(summaryFindingSerializer.serializeFinding(finding)).toContain("Evidence: [redacted token, 12 characters]");
});
