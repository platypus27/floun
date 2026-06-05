import { AnalysisFinding } from './analysisFinding';
import { classifyCertificateSignature } from './cryptoRules';

interface CertificateScanResult {
  result?: {
    cert_alg?: unknown;
  };
  cert_alg?: unknown;
}

const getCertificateAlgorithm = (certificate: unknown): string | null => {
  if (!certificate || typeof certificate !== "object") {
    return null;
  }

  const certificateData = certificate as CertificateScanResult;
  const algorithm = certificateData.result?.cert_alg ?? certificateData.cert_alg;

  return typeof algorithm === "string" && algorithm.trim().length > 0
    ? algorithm
    : null;
};

export const analyzeCertificate = (certificate: unknown): AnalysisFinding[] => {
  const certificateAlgorithm = getCertificateAlgorithm(certificate);

  if (!certificateAlgorithm) {
    return [{
      source: "Certificate",
      severity: "Info",
      title: "No certificate signature algorithm found",
      location: "Certificate",
      details: "The certificate scan did not return a cert_alg value.",
    }];
  }

  const rule = classifyCertificateSignature(certificateAlgorithm);

  return [{
    ruleId: rule.id,
    source: "Certificate",
    severity: rule.severity,
    confidence: rule.confidence,
    title: `Certificate uses ${certificateAlgorithm}`,
    location: "Certificate",
    recommendation: rule.recommendation,
  }];
};
