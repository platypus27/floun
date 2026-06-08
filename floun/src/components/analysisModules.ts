import {
  AnalysisFinding,
  AnalysisSummary,
  summarizeFindings,
} from "./analysisFinding";
import { analyzeCertificate } from "./certificateanalysis";
import { HeaderSecurityCheck } from "./headerAnalysis";
import { analyzeCryptoInJavascript } from "./javascriptanalysis";
import { analyzeTokens } from "./tokenAnalysis";
import type { ScanPayload } from "../extension/scanTypes";
import type { FindingGroups, FindingGroupLabels } from "./reportgen/reportDocument";

export type AnalysisModuleId = "javascript" | "tokens" | "tls" | "certificates";

export interface AnalysisModuleDefinition<TInput = unknown> {
  id: AnalysisModuleId;
  label: string;
  reportGroupLabel: string;
  breakdownLabel: string;
  selectPayload: (scanPayload: ScanPayload) => TInput;
  analyze: (input: TInput) => AnalysisFinding[];
}

export interface AnalysisModuleResult {
  id: AnalysisModuleId;
  label: string;
  reportGroupLabel: string;
  breakdownLabel: string;
  findings: AnalysisFinding[];
  summary: AnalysisSummary;
}

function defineAnalysisModule<TInput>(
  definition: AnalysisModuleDefinition<TInput>
): AnalysisModuleDefinition<TInput> {
  return definition;
}

export const analysisModules = [
  defineAnalysisModule({
    id: "javascript",
    label: "JavaScript",
    reportGroupLabel: "JavaScript",
    breakdownLabel: "JS",
    selectPayload: scanPayload => scanPayload.jsScripts,
    analyze: analyzeCryptoInJavascript,
  }),
  defineAnalysisModule({
    id: "tokens",
    label: "Tokens",
    reportGroupLabel: "Tokens",
    breakdownLabel: "Tokens",
    selectPayload: scanPayload => scanPayload.tokens,
    analyze: analyzeTokens,
  }),
  defineAnalysisModule({
    id: "tls",
    label: "TLS",
    reportGroupLabel: "TLS",
    breakdownLabel: "TLS",
    selectPayload: scanPayload => scanPayload.TLS,
    analyze: HeaderSecurityCheck,
  }),
  defineAnalysisModule({
    id: "certificates",
    label: "Certificates",
    reportGroupLabel: "Certificates",
    breakdownLabel: "Certificates",
    selectPayload: scanPayload => scanPayload.certificates,
    analyze: analyzeCertificate,
  }),
] as const;

export function runAnalysisModules(scanPayload: ScanPayload): AnalysisModuleResult[] {
  return analysisModules.map(moduleDefinition => {
    const selectedPayload = moduleDefinition.selectPayload(scanPayload);
    // The registry tuple preserves each select/analyze pair, but TypeScript loses that correlation while mapping.
    const findings = moduleDefinition.analyze(selectedPayload as never);

    return {
      id: moduleDefinition.id,
      label: moduleDefinition.label,
      reportGroupLabel: moduleDefinition.reportGroupLabel,
      breakdownLabel: moduleDefinition.breakdownLabel,
      findings,
      summary: summarizeFindings(findings),
    };
  });
}

export function buildFindingGroups(moduleResults: AnalysisModuleResult[]): FindingGroups {
  return Object.fromEntries(
    moduleResults.map(moduleResult => [moduleResult.reportGroupLabel, moduleResult.findings])
  );
}

export function buildFindingGroupLabels(moduleResults: AnalysisModuleResult[]): FindingGroupLabels {
  return Object.fromEntries(
    moduleResults.map(moduleResult => [moduleResult.reportGroupLabel, moduleResult.breakdownLabel])
  );
}
