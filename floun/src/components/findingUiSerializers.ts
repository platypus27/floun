import type { AnalysisFinding } from "./analysisFinding";

export type UiEvidencePolicy = "include-existing";

export interface UiFindingSerializer {
  target: "summary";
  evidencePolicy: UiEvidencePolicy;
  serializeFinding: (finding: AnalysisFinding) => string;
}

export const summaryFindingSerializer: UiFindingSerializer = {
  target: "summary",
  evidencePolicy: "include-existing",
  serializeFinding: finding => {
    const location = finding.location ? ` in ${finding.location}` : "";
    const evidence = finding.evidence ? ` Evidence: ${finding.evidence}` : "";
    const details = finding.details ? ` ${finding.details}` : "";

    return `${finding.title} [${finding.severity}]${location}.${evidence}${details}`.trim();
  },
};
