import { AnalysisFinding } from './analysisFinding';
import { classifyCertificateSignature } from './cryptoRules';
import type { CertificateScanData } from '../extension/scanTypes';

export const analyzeCertificate = (certificate: CertificateScanData | null): AnalysisFinding[] => {
  if (!certificate) {
    return [{
      source: "Certificate",
      severity: "Info",
      title: "No certificate signature algorithm found",
      location: "Certificate",
      details: "The certificate scan did not return a signature algorithm.",
    }];
  }

  const certificateAlgorithm = certificate.signatureAlgorithm;
  const rule = classifyCertificateSignature(certificateAlgorithm);

  return [{
    ruleId: rule.id,
    source: "Certificate",
    severity: rule.severity,
    confidence: rule.confidence,
    title: `Certificate uses ${certificateAlgorithm}`,
    location: "Certificate",
    rationale: rule.rationale,
    limitations: rule.limitations,
    references: rule.references,
    standardStatus: rule.standardStatus,
    updatedAt: rule.updatedAt,
    recommendation: rule.recommendation,
  }];
};
