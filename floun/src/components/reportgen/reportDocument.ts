import { AnalysisFinding, FindingSeverity } from "../analysisFinding";
import {
  pdfFindingSerializer,
  promptFindingSerializer,
} from "./findingSerializers";

export type FindingGroups = Record<string, AnalysisFinding[]>;

export type FindingGroupLabels = Record<string, string>;

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
  reviewMethodsCount: number;
  reviewMethodsBreakdown: string;
  vulnerableMethodsCount: number;
  vulnerableMethodsBreakdown: string;
}

export const emptyFindingGroups = (): FindingGroups => ({});

export function reportSectionPrompts(findingsText: string): Record<keyof ReportSections, string> {
  return {
    introduction: "Write a concise introduction for a quantum-safe cryptography report for web security. Cover purpose, scope, and audience.",
    executiveSummary: `Write a concise executive summary based on these redacted findings. Do not invent unobserved findings.\n${findingsText}`,
    vulnerabilityAnalysis: `Analyze these crypto-readiness findings. Distinguish review items from confirmed weak or deprecated findings. Do not output secrets, tokens, hashes, or certificates.\n${findingsText}`,
    riskAssessment: `Write a risk assessment based on these redacted findings. Focus on business and technical impact.\n${findingsText}`,
    recommendations: `Provide short-term and long-term recommendations for validating and remediating these findings.\n${findingsText}`,
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
  return countFindingsBySeverity(findings, "Vulnerable");
}

export function countFindingsBySeverity(
  findings: AnalysisFinding[],
  severity: FindingSeverity
): number {
  return findings.filter(finding => finding.severity === severity).length;
}

export function buildPromptFindingsText(groups: FindingGroups): string {
  return promptFindingSerializer.serializeFindings(flattenFindingGroups(groups));
}

export function fallbackSections(
  findingsText: string,
  vulnerableCount: number,
  reviewCount = 0
): ReportSections {
  const vulnerabilityLine = vulnerableCount === 1
    ? "The scan found 1 vulnerable item."
    : `The scan found ${vulnerableCount} vulnerable items.`;
  const reviewLine = reviewCount === 1
    ? " It also found 1 item that needs migration review."
    : reviewCount > 0
      ? ` It also found ${reviewCount} items that need migration review.`
      : "";

  return {
    introduction: "This report summarizes browser-extension scan results for quantum-safe web cryptography readiness.",
    executiveSummary: `${vulnerabilityLine}${reviewLine} Findings were redacted before report generation to avoid exposing sensitive values.`,
    vulnerabilityAnalysis: findingsText,
    riskAssessment: "Review findings indicate migration-planning signals, while deprecated algorithms indicate higher-priority remediation risk.",
    recommendations: "Prioritize TLS modernization, remove legacy cryptographic primitives, and plan migration toward standardized post-quantum algorithms.",
    nextStep: "Validate findings with infrastructure owners, confirm supported cipher suites, and create a staged remediation plan.",
    conclusion: "The scan provides a starting point for quantum-safe cryptography planning and should be paired with deeper infrastructure review.",
  };
}

export function buildReportContent(
  groups: FindingGroups,
  sections: ReportSections,
  groupLabels: FindingGroupLabels = {}
): ReportContent {
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
    reviewMethodsCount: countFindingsBySeverity(allFindings, "Review"),
    reviewMethodsBreakdown: buildSeverityBreakdown(groups, "Review", groupLabels),
    vulnerableMethodsCount: countVulnerableFindings(allFindings),
    vulnerableMethodsBreakdown: buildSeverityBreakdown(groups, "Vulnerable", groupLabels),
  };
}

function buildSeverityBreakdown(
  groups: FindingGroups,
  severity: FindingSeverity,
  groupLabels: FindingGroupLabels
): string {
  return Object.entries(groups)
    .map(([group, findings]) => {
      const label = groupLabels[group] || group;
      return `${label}: ${countFindingsBySeverity(findings, severity)}`;
    })
    .join(", ");
}

function buildAppendix(groups: FindingGroups): string {
  return Object.entries(groups)
    .map(([group, findings]) => `${group} Results:\n${pdfFindingSerializer.serializeFindings(findings)}`)
    .join("\n\n");
}
