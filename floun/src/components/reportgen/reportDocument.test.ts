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

test("buildReportContent keeps only non-duplicated detail in appendices", () => {
  const sections = fallbackSections(buildPromptFindingsText(groups), 1, 1);
  const content = buildReportContent(groups, sections, groupLabels);

  const headings = content.appendix.map(group => group.heading);
  expect(headings).toContain("Tokens Results:");
  expect(headings).toContain("TLS Results:");
  expect(headings).not.toContain("JavaScript Results:");
  expect(headings).not.toContain("Certificates Results:");
  expect(headings).not.toContain("Headers Results:");

  const tokensEntry = content.appendix.find(group => group.heading === "Tokens Results:")?.entries[0];
  expect(tokensEntry?.title).toBe("Session token may be weak");
  expect(tokensEntry?.extras).toContainEqual({ label: "Rule ID", value: "token-test" });
  expect(tokensEntry?.extras).toContainEqual({ label: "Details", value: "Failed checks: Short Token." });

  const tlsEntry = content.appendix.find(group => group.heading === "TLS Results:")?.entries[0];
  expect(tlsEntry?.title).toBe("TLS cipher needs migration review");
  expect(tlsEntry?.extras).toContainEqual({
    label: "References",
    value: "https://www.cisa.gov/resources-tools/resources/quantum-readiness-migration-post-quantum-cryptography",
  });
  expect(tlsEntry?.extras).toContainEqual({ label: "Updated", value: "2026-06-05" });

  const appendixText = JSON.stringify(content.appendix);
  expect(appendixText).not.toContain("Rationale:");
  expect(appendixText).not.toContain("Limitations:");
  expect(appendixText).not.toContain("Recommendation:");
  expect(appendixText).not.toContain("Standard status:");
  expect(appendixText).not.toContain("Confidence:");
  expect(appendixText).not.toContain("Evidence:");
  expect(appendixText).not.toContain("secret-token-value");

  expect(content.statusCounts).toEqual({ vulnerable: 1, review: 1, safe: 0, informational: 0 });
  expect(content.findingDisplays.length).toBe(2);
  expect(content.findingDisplays[1].fields).toContainEqual({
    label: "Rationale",
    value: "Classical TLS suites are migration inventory signals.",
  });
  expect(content.findingDisplays[0].fields).toContainEqual({
    label: "Evidence",
    value: omittedEvidenceNotice,
  });

  expect(content.reviewMethodsCount).toBe(1);
  expect(content.reviewMethodsBreakdown).toBe("JS: 0, Tokens: 0, TLS: 1, Certificates: 0");
  expect(content.vulnerableMethodsCount).toBe(1);
  expect(content.vulnerableMethodsBreakdown).toBe("JS: 0, Tokens: 1, TLS: 0, Certificates: 0");
});
