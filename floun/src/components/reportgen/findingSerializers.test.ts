import { AnalysisFinding } from "../analysisFinding";
import {
  omittedEvidenceNotice,
  pdfFindingSerializer,
  promptFindingSerializer,
} from "./findingSerializers";

const secretFinding: AnalysisFinding = {
  ruleId: "token-test",
  source: "Tokens",
  severity: "Vulnerable",
  confidence: "High",
  title: "Session token may be weak",
  location: "Tokens",
  evidence: "secret-token-value",
  details: "Failed checks: Short Token.",
  sensitive: true,
};

test("prompt serializer owns an explicit omit-evidence policy", () => {
  const serializedFinding = promptFindingSerializer.serializeFinding(secretFinding);

  expect(promptFindingSerializer).toMatchObject({
    target: "prompt",
    evidencePolicy: "omit",
  });
  expect(serializedFinding).toContain(`Evidence: ${omittedEvidenceNotice}`);
  expect(serializedFinding).not.toContain("secret-token-value");
});

test("pdf serializer omits raw evidence while keeping structured fields", () => {
  const serializedFinding = pdfFindingSerializer.serializeFinding({
    ...secretFinding,
    rationale: "Token heuristic rationale.",
    limitations: "Browser-visible only.",
    recommendation: "Validate with the application owner.",
  });

  expect(pdfFindingSerializer).toMatchObject({
    target: "pdf",
    evidencePolicy: "omit",
  });
  expect(serializedFinding).toContain("Rationale: Token heuristic rationale.");
  expect(serializedFinding).toContain(`Evidence: ${omittedEvidenceNotice}`);
  expect(serializedFinding).toContain("Limitations: Browser-visible only.");
  expect(serializedFinding).toContain("Recommendation: Validate with the application owner.");
  expect(serializedFinding).not.toContain("secret-token-value");
});
