import { summaryFindingSerializer } from "./findingUiSerializers";

export type FindingSeverity = "Safe" | "Review" | "Vulnerable" | "Info";

export type FindingSource = "JavaScript" | "Tokens" | "SSL Header" | "Certificate";

export type FindingStandardStatus =
  | "standardized"
  | "draft"
  | "classical"
  | "deprecated"
  | "legacy-candidate"
  | "unclassified"
  | "heuristic"
  | "not-applicable";

export interface AnalysisFinding {
  ruleId?: string;
  source: FindingSource;
  severity: FindingSeverity;
  confidence?: "High" | "Medium" | "Low";
  title: string;
  location?: string;
  evidence?: string;
  details?: string;
  recommendation?: string;
  standardStatus?: FindingStandardStatus;
  rationale?: string;
  limitations?: string;
  references?: string[];
  updatedAt?: string;
  sensitive?: boolean;
}

export interface AnalysisSummary {
  total: number;
  safe: number;
  review: number;
  vulnerable: number;
  informational: number;
  reviewDetails: string[];
  vulnerableDetails: string[];
}

export const emptyAnalysisSummary = (): AnalysisSummary => ({
  total: 0,
  safe: 0,
  review: 0,
  vulnerable: 0,
  informational: 0,
  reviewDetails: [],
  vulnerableDetails: [],
});

export function summarizeFindings(findings: AnalysisFinding[]): AnalysisSummary {
  return findings.reduce<AnalysisSummary>((summary, finding) => {
    summary.total += 1;

    if (finding.severity === "Safe") {
      summary.safe += 1;
    } else if (finding.severity === "Review") {
      summary.review += 1;
      summary.reviewDetails.push(summaryFindingSerializer.serializeFinding(finding));
    } else if (finding.severity === "Vulnerable") {
      summary.vulnerable += 1;
      summary.vulnerableDetails.push(summaryFindingSerializer.serializeFinding(finding));
    } else {
      summary.informational += 1;
    }

    return summary;
  }, emptyAnalysisSummary());
}
