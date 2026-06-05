import { AnalysisFinding, formatFindingsForReport } from "../analysisFinding";

export interface FindingGroups {
  JavaScript: AnalysisFinding[];
  Tokens: AnalysisFinding[];
  Headers: AnalysisFinding[];
  Certificates: AnalysisFinding[];
}

export interface ReportSections {
  introduction: string;
  executiveSummary: string;
  vulnerabilityAnalysis: string;
  riskAssessment: string;
  recommendations: string;
  nextStep: string;
  conclusion: string;
}

export interface ReportContent extends ReportSections {
  appendix: string;
  vulnerableMethodsCount: number;
  vulnerableMethodsBreakdown: string;
}

export const emptyFindingGroups = (): FindingGroups => ({
  JavaScript: [],
  Tokens: [],
  Headers: [],
  Certificates: [],
});

export function reportSectionPrompts(findingsText: string): Record<keyof ReportSections, string> {
  return {
    introduction: "Write a concise introduction for a quantum-safe cryptography report for web security. Cover purpose, scope, and audience.",
    executiveSummary: `Write a concise executive summary based on these redacted findings. Do not invent unobserved findings.\n${findingsText}`,
    vulnerabilityAnalysis: `Analyze the quantum cryptographic vulnerabilities in these redacted findings. Do not output secrets, tokens, hashes, or certificates.\n${findingsText}`,
    riskAssessment: `Write a risk assessment based on these redacted findings. Focus on business and technical impact.\n${findingsText}`,
    recommendations: `Provide short-term and long-term recommendations for mitigating these findings.\n${findingsText}`,
    nextStep: `Write practical next steps for implementing quantum-safe cryptography based on these findings.\n${findingsText}`,
    conclusion: `Write a concise conclusion summarizing the key findings and recommendations.\n${findingsText}`,
  };
}

export function sanitizeReportText(text: string): string {
  return text
    .replace(/[^\u0020-\u007E]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function flattenFindingGroups(groups: FindingGroups): AnalysisFinding[] {
  return Object.values(groups).flat();
}

export function countVulnerableFindings(findings: AnalysisFinding[]): number {
  return findings.filter(finding => finding.severity === "Vulnerable").length;
}

export function buildFindingsText(groups: FindingGroups): string {
  return formatFindingsForReport(flattenFindingGroups(groups));
}

export function fallbackSections(findingsText: string, vulnerableCount: number): ReportSections {
  const vulnerabilityLine = vulnerableCount === 1
    ? "The scan found 1 vulnerable item."
    : `The scan found ${vulnerableCount} vulnerable items.`;

  return {
    introduction: "This report summarizes browser-extension scan results for quantum-safe web cryptography readiness.",
    executiveSummary: `${vulnerabilityLine} Findings were redacted before report generation to avoid exposing sensitive values.`,
    vulnerabilityAnalysis: findingsText,
    riskAssessment: "Classical asymmetric cryptography and weak legacy algorithms may create migration risk as quantum capabilities mature.",
    recommendations: "Prioritize TLS modernization, remove legacy cryptographic primitives, and plan migration toward standardized post-quantum algorithms.",
    nextStep: "Validate findings with infrastructure owners, confirm supported cipher suites, and create a staged remediation plan.",
    conclusion: "The scan provides a starting point for quantum-safe cryptography planning and should be paired with deeper infrastructure review.",
  };
}

export function buildReportContent(groups: FindingGroups, sections: ReportSections): ReportContent {
  const allFindings = flattenFindingGroups(groups);

  return {
    introduction: sanitizeReportText(sections.introduction),
    executiveSummary: sanitizeReportText(sections.executiveSummary),
    vulnerabilityAnalysis: sanitizeReportText(sections.vulnerabilityAnalysis),
    riskAssessment: sanitizeReportText(sections.riskAssessment),
    recommendations: sanitizeReportText(sections.recommendations),
    nextStep: sanitizeReportText(sections.nextStep),
    conclusion: sanitizeReportText(sections.conclusion),
    appendix: buildAppendix(groups),
    vulnerableMethodsCount: countVulnerableFindings(allFindings),
    vulnerableMethodsBreakdown: [
      `JS: ${countVulnerableFindings(groups.JavaScript)}`,
      `Tokens: ${countVulnerableFindings(groups.Tokens)}`,
      `Headers: ${countVulnerableFindings(groups.Headers)}`,
      `Certificates: ${countVulnerableFindings(groups.Certificates)}`,
    ].join(", "),
  };
}

function buildAppendix(groups: FindingGroups): string {
  return Object.entries(groups)
    .map(([group, findings]) => `${group} Results:\n${formatFindingsForReport(findings)}`)
    .join("\n\n");
}

