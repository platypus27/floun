import {
  AnalysisModuleResult,
  buildFindingGroupLabels,
  buildFindingGroups,
} from "./analysisModules";
import { generateChatMessage, hasGeminiApiKey } from "./reportgen/geminiService";
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

  if (!hasGeminiApiKey()) {
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
    subtitle: "Identifying and Mitigating Cryptographic Vulnerabilities",
    date: new Date().toLocaleDateString(),
    confidentialityNotice: "Confidential - For Internal Use Only",
  }, buildReportContent(groups, sections, groupLabels));
}
