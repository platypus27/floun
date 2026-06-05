import { AnalysisFinding } from "./analysisFinding";
import { generateChatMessage, hasGeminiApiKey } from "./reportgen/geminiService";
import { logoBase64 } from "./reportgen/logoBase64";
import {
  FindingGroups,
  ReportSections,
  buildFindingsText,
  buildReportContent,
  countVulnerableFindings,
  fallbackSections,
  flattenFindingGroups,
  reportSectionPrompts,
} from "./reportgen/reportDocument";

async function buildReportSections(groups: FindingGroups): Promise<ReportSections> {
  const findingsText = buildFindingsText(groups);
  const vulnerableCount = countVulnerableFindings(flattenFindingGroups(groups));

  if (!hasGeminiApiKey()) {
    return fallbackSections(findingsText, vulnerableCount);
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
  jsResults: AnalysisFinding[],
  tokenResults: AnalysisFinding[],
  headerResults: AnalysisFinding[],
  certResults: AnalysisFinding[]
) {
  const groups: FindingGroups = {
    JavaScript: jsResults,
    Tokens: tokenResults,
    Headers: headerResults,
    Certificates: certResults,
  };
  const sections = await buildReportSections(groups);
  const { generatePDFReport } = await import("./reportgen/pdfService");

  await generatePDFReport({
    title: "Quantum Safe Cryptography Report",
    subtitle: "Identifying and Mitigating Cryptographic Vulnerabilities",
    logoBase64,
    date: new Date().toLocaleDateString(),
    confidentialityNotice: "Confidential - For Internal Use Only",
  }, buildReportContent(groups, sections));
}
