import type { AnalysisFinding } from "../analysisFinding";
import type { FindingGroups } from "./reportDocument";

export const fixtureLongReferenceUrl =
  "https://example.com/very/deep/path/to/a/quantum-readiness/resource/that/keeps/going?with=query&parameters=that&are=quite&long=indeed&utm_source=newsletter-campaign-2026";

export const fixtureLongHash =
  "a3f1c8e92b47d06f5c31e8a94d72b06c5f1e3a98b47d206f5c31e8a94d72b06c";

const reviewFinding: AnalysisFinding = {
  ruleId: "tls-classical-or-unclassified-cipher",
  source: "SSL Header",
  severity: "Review",
  confidence: "Medium",
  title: "TLS cipher needs migration review",
  location: "SSL Header",
  standardStatus: "unclassified",
  rationale: "Classical TLS suites are migration inventory signals.",
  limitations: "TLS API responses may omit negotiated group details.",
  recommendation: "Review negotiated TLS behavior manually.",
  references: [fixtureLongReferenceUrl],
  updatedAt: "2026-06-05",
};

const vulnerableFinding: AnalysisFinding = {
  ruleId: "js-triple-des",
  source: "JavaScript",
  severity: "Vulnerable",
  confidence: "High",
  title: "Triple DES Encryption",
  location: "inline script (inline)",
  standardStatus: "deprecated",
  rationale: "3DES is a known legacy cipher and should be treated as a concrete weak-crypto finding rather than only a migration signal.",
  recommendation: "Remove 3DES and replace it with authenticated modern encryption.",
  references: [fixtureLongReferenceUrl],
  updatedAt: "2026-06-05",
};

const safeFinding: AnalysisFinding = {
  ruleId: "js-ml-kem",
  source: "JavaScript",
  severity: "Safe",
  confidence: "Medium",
  title: "ML-KEM Key Encapsulation",
  location: "inline script (inline)",
  standardStatus: "standardized",
  rationale: "ML-KEM is the standardized NIST key-encapsulation mechanism based on CRYSTALS-Kyber.",
  updatedAt: "2026-06-05",
};

export const smallFindingGroups: FindingGroups = {
  JavaScript: [vulnerableFinding, safeFinding],
  Tokens: [],
  TLS: [reviewFinding],
  Certificates: [],
};

function makeLargeFinding(index: number): AnalysisFinding {
  return {
    ruleId: `crypto-weakness-rule-${index}-with-a-rather-long-identifier`,
    source: index % 2 === 0 ? "JavaScript" : "Tokens",
    severity: index % 3 === 0 ? "Vulnerable" : "Review",
    confidence: "High",
    title: `Finding number ${index} with a descriptive multi word title`,
    location: `https://example.com/assets/module-${index}/bundle.min.js?cachebust=${fixtureLongHash.slice(0, 24)}`,
    standardStatus: "deprecated",
    rationale: `Rationale text for finding ${index}. `.repeat(4),
    limitations: `Limitations text for finding ${index}. `.repeat(3),
    recommendation: `Recommendation text for finding ${index}. `.repeat(3),
    references: [fixtureLongReferenceUrl, "https://csrc.nist.gov/publications"],
    updatedAt: "2026-06-05",
  };
}

export const largeFindingGroups: FindingGroups = {
  JavaScript: Array.from({ length: 18 }, (_, index) => makeLargeFinding(index)),
  Tokens: Array.from({ length: 18 }, (_, index) => makeLargeFinding(index + 18)),
  TLS: Array.from({ length: 12 }, (_, index) => makeLargeFinding(index + 36)),
  Certificates: Array.from({ length: 12 }, (_, index) => makeLargeFinding(index + 48)),
};
