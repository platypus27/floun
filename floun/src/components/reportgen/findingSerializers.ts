import type { AnalysisFinding } from "../analysisFinding";

export type ReportEvidencePolicy = "omit";

export type FindingSerializationTarget = "prompt" | "pdf";

export interface FindingSerializer {
  target: FindingSerializationTarget;
  evidencePolicy: ReportEvidencePolicy;
  serializeFinding: (finding: AnalysisFinding) => string;
  serializeFindings: (findings: AnalysisFinding[]) => string;
}

export const omittedEvidenceNotice = "Evidence omitted by report policy.";

function createFindingSerializer(target: FindingSerializationTarget): FindingSerializer {
  const serializer: FindingSerializer = {
    target,
    evidencePolicy: "omit",
    serializeFinding: finding => serializeFinding(finding, serializer.evidencePolicy),
    serializeFindings: findings => serializeFindings(findings, serializer.serializeFinding),
  };

  return serializer;
}

function serializeFindings(
  findings: AnalysisFinding[],
  serializeFinding: (finding: AnalysisFinding) => string
): string {
  if (findings.length === 0) {
    return "No findings were produced by this scan.";
  }

  return findings
    .map(serializeFinding)
    .join("\n");
}

function serializeFinding(
  finding: AnalysisFinding,
  evidencePolicy: ReportEvidencePolicy
): string {
  const location = finding.location ? ` in ${finding.location}` : "";
  const lines = [
    `${finding.title} [${finding.severity}]${location}.`,
    finding.ruleId ? `Rule ID: ${finding.ruleId}` : "",
    finding.confidence ? `Confidence: ${finding.confidence}` : "",
    finding.standardStatus ? `Standard status: ${finding.standardStatus}` : "",
    finding.rationale ? `Rationale: ${finding.rationale}` : "",
    finding.details ? `Details: ${finding.details}` : "",
    finding.evidence && evidencePolicy === "omit" ? `Evidence: ${omittedEvidenceNotice}` : "",
    finding.limitations ? `Limitations: ${finding.limitations}` : "",
    finding.recommendation ? `Recommendation: ${finding.recommendation}` : "",
    finding.references?.length ? `References: ${finding.references.join(", ")}` : "",
    finding.updatedAt ? `Updated: ${finding.updatedAt}` : "",
  ].filter(Boolean);

  return lines.join("\n");
}

export const promptFindingSerializer = createFindingSerializer("prompt");

export const pdfFindingSerializer = createFindingSerializer("pdf");
