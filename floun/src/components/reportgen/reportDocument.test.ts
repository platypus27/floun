import { AnalysisFinding } from "../analysisFinding";
import { omittedEvidenceNotice } from "./findingSerializers";
import {
  FindingGroups,
  buildPromptFindingsText,
  buildReportContent,
  fallbackSections,
} from "./reportDocument";

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

const reviewFinding: AnalysisFinding = {
  ruleId: "tls-classical-or-unclassified-cipher",
  source: "SSL Header",
  severity: "Review",
  confidence: "Medium",
  title: "TLS cipher needs migration review",
  location: "SSL Header",
  standardStatus: "unclassified",
  rationale: "Classical TLS suites are migration inventory signals.",
  limitations: "TLS API responses may omit negotiated group details.",
  recommendation: "Review negotiated TLS behavior manually.",
  references: ["https://www.cisa.gov/resources-tools/resources/quantum-readiness-migration-post-quantum-cryptography"],
  updatedAt: "2026-06-05",
};

const groups: FindingGroups = {
  JavaScript: [],
  Tokens: [secretFinding],
  TLS: [reviewFinding],
  Certificates: [],
};

const groupLabels = {
  JavaScript: "JS",
  Tokens: "Tokens",
  TLS: "TLS",
  Certificates: "Certificates",
};

test("buildPromptFindingsText uses report-owned evidence policy", () => {
  const findingsText = buildPromptFindingsText(groups);

  expect(findingsText).toContain("Session token may be weak");
  expect(findingsText).toContain(`Evidence: ${omittedEvidenceNotice}`);
  expect(findingsText).not.toContain("secret-token-value");
});

test("buildReportContent omits raw evidence from appendices", () => {
  const sections = fallbackSections(buildPromptFindingsText(groups), 1, 1);
  const content = buildReportContent(groups, sections, groupLabels);

  expect(content.appendix).toContain("Tokens Results");
  expect(content.appendix).toContain("TLS Results");
  expect(content.appendix).not.toContain("Headers Results");
  expect(content.appendix).toContain("Rationale: Classical TLS suites are migration inventory signals.");
  expect(content.appendix).toContain("Limitations: TLS API responses may omit negotiated group details.");
  expect(content.appendix).toContain("Recommendation: Review negotiated TLS behavior manually.");
  expect(content.appendix).toContain("References: https://www.cisa.gov/resources-tools/resources/quantum-readiness-migration-post-quantum-cryptography");
  expect(content.appendix).toContain(`Evidence: ${omittedEvidenceNotice}`);
  expect(content.appendix).not.toContain("secret-token-value");
  expect(content.reviewMethodsCount).toBe(1);
  expect(content.reviewMethodsBreakdown).toBe("JS: 0, Tokens: 0, TLS: 1, Certificates: 0");
  expect(content.vulnerableMethodsCount).toBe(1);
  expect(content.vulnerableMethodsBreakdown).toBe("JS: 0, Tokens: 1, TLS: 0, Certificates: 0");
});
