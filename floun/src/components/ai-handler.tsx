import {
  AnalysisModuleResult,
  buildFindingGroupLabels,
  buildFindingGroups,
} from "./analysisModules";
import { generateChatMessage, hasDeepseekApiKey } from "./reportgen/deepseekService";
import {
  FindingGroups,
  ReportSections,
  buildPromptFindingsText,
  buildReportContent,
  countFindingsBySeverity,
  countVulnerableFindings,
  fallbackSections,
  flattenFindingGroups,
  reportSectionPrompts,
} from "./reportgen/reportDocument";

async function buildReportSections(groups: FindingGroups): Promise<ReportSections> {
  const findingsText = buildPromptFindingsText(groups);
  const allFindings = flattenFindingGroups(groups);
  const vulnerableCount = countVulnerableFindings(allFindings);
  const reviewCount = countFindingsBySeverity(allFindings, "Review");

  if (!hasDeepseekApiKey()) {
    return fallbackSections(findingsText, vulnerableCount, reviewCount);
  }

  const prompts = reportSectionPrompts(findingsText);
  const [
    introduction,
    executiveSummary,
    vulnerabilityAnalysis,
    riskAssessment,
    recommendations,
    nextStep,
    conclusion,
  ] = await Promise.all([
    generateChatMessage(prompts.introduction),
    generateChatMessage(prompts.executiveSummary),
    generateChatMessage(prompts.vulnerabilityAnalysis),
    generateChatMessage(prompts.riskAssessment),
    generateChatMessage(prompts.recommendations),
    generateChatMessage(prompts.nextStep),
    generateChatMessage(prompts.conclusion),
  ]);

  return {
    introduction,
    executiveSummary,
    vulnerabilityAnalysis,
    riskAssessment,
    recommendations,
    nextStep,
    conclusion,
  };
}

export async function createReport(
  moduleResults: AnalysisModuleResult[]
) {
  const groups = buildFindingGroups(moduleResults);
  const groupLabels = buildFindingGroupLabels(moduleResults);
  const sections = await buildReportSections(groups);
  const { generatePDFReport } = await import("./reportgen/pdfService");

  await generatePDFReport({
    title: "Quantum Safe Cryptography Report",
    subtitle: "Reviewing Crypto-Readiness and Migration Signals",
    date: new Date().toLocaleDateString(),
    confidentialityNotice: "Confidential - For Internal Use Only",
  }, buildReportContent(groups, sections, groupLabels));
}
