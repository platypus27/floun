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

interface FormatFindingOptions {
  includeEvidence?: boolean;
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
      summary.reviewDetails.push(formatFinding(finding));
    } else if (finding.severity === "Vulnerable") {
      summary.vulnerable += 1;
      summary.vulnerableDetails.push(formatFinding(finding));
    } else {
      summary.informational += 1;
    }

    return summary;
  }, emptyAnalysisSummary());
}

export function formatFinding(
  finding: AnalysisFinding,
  { includeEvidence = true }: FormatFindingOptions = {}
): string {
  const location = finding.location ? ` in ${finding.location}` : "";
  const evidence = includeEvidence && finding.evidence ? ` Evidence: ${finding.evidence}` : "";
  const details = finding.details ? ` ${finding.details}` : "";

  return `${finding.title} [${finding.severity}]${location}.${evidence}${details}`.trim();
}

export function formatFindingsForReport(findings: AnalysisFinding[]): string {
  if (findings.length === 0) {
    return "No findings were produced by this scan.";
  }

  return findings
    .map(formatFindingForReport)
    .join("\n");
}

export function formatFindingForReport(finding: AnalysisFinding): string {
  const location = finding.location ? ` in ${finding.location}` : "";
  const lines = [
    `${finding.title} [${finding.severity}]${location}.`,
    finding.ruleId ? `Rule ID: ${finding.ruleId}` : "",
    finding.confidence ? `Confidence: ${finding.confidence}` : "",
    finding.standardStatus ? `Standard status: ${finding.standardStatus}` : "",
    finding.rationale ? `Rationale: ${finding.rationale}` : "",
    finding.details ? `Details: ${finding.details}` : "",
    finding.limitations ? `Limitations: ${finding.limitations}` : "",
    finding.recommendation ? `Recommendation: ${finding.recommendation}` : "",
    finding.references?.length ? `References: ${finding.references.join(", ")}` : "",
    finding.updatedAt ? `Updated: ${finding.updatedAt}` : "",
  ].filter(Boolean);

  return lines.join("\n");
}

export function redactValue(label: string, value: string): string {
  const normalizedLabel = label.trim() || "value";
  return `[redacted ${normalizedLabel}, ${value.length} characters]`;
}
