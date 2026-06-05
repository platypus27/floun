import { AnalysisFinding } from "../analysisFinding";
import {
  FindingGroups,
  buildFindingsText,
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

const groups: FindingGroups = {
  JavaScript: [],
  Tokens: [secretFinding],
  Headers: [],
  Certificates: [],
};

test("buildFindingsText omits raw evidence", () => {
  const findingsText = buildFindingsText(groups);

  expect(findingsText).toContain("Session token may be weak");
  expect(findingsText).not.toContain("secret-token-value");
});

test("buildReportContent omits raw evidence from appendices", () => {
  const sections = fallbackSections(buildFindingsText(groups), 1);
  const content = buildReportContent(groups, sections);

  expect(content.appendix).toContain("Tokens Results");
  expect(content.appendix).not.toContain("secret-token-value");
  expect(content.vulnerableMethodsCount).toBe(1);
  expect(content.vulnerableMethodsBreakdown).toBe("JS: 0, Tokens: 1, Headers: 0, Certificates: 0");
});

