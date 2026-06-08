import { AnalysisFinding } from './analysisFinding';
import { classifyTlsCipher } from './cryptoRules';
import type { TlsScanData } from '../extension/scanTypes';

export const HeaderSecurityCheck = (tlsData: TlsScanData | null): AnalysisFinding[] => {
  if (!tlsData) {
    return [{
      source: "SSL Header",
      severity: "Info",
      title: "No TLS endpoint data found",
      location: "SSL Header",
      details: "The TLS scan did not return endpoint data.",
    }];
  }

  const findings: AnalysisFinding[] = [];

  tlsData.endpoints.forEach((endpoint) => {
    let tlsVersion = "<Unknown>";
    const reviewCiphers: string[] = [];

    const tls13Supported = endpoint.protocolVersions.some(protocolVersion => protocolVersion === "1.3");
    tlsVersion = endpoint.protocolVersions.length > 0
      ? tls13Supported ? "1.3" : "<1.2 or Lower>"
      : "<Unknown>";

    endpoint.cipherSuites.forEach((cipher) => {
      const rule = classifyTlsCipher(cipher);

      if (rule.severity === "Safe") {
        findings.push({
          ruleId: rule.id,
          source: "SSL Header",
          severity: rule.severity,
          confidence: rule.confidence,
          title: `TLS ${tlsVersion} reports ${rule.name} ${cipher}`,
          location: "SSL Header",
          rationale: rule.rationale,
          limitations: rule.limitations,
          references: rule.references,
          standardStatus: rule.standardStatus,
          updatedAt: rule.updatedAt,
          recommendation: rule.recommendation,
        });
      } else {
        reviewCiphers.push(cipher);
      }
    });

    reviewCiphers.forEach(cipher => {
      const rule = classifyTlsCipher(cipher);
      findings.push({
        ruleId: rule.id,
        source: "SSL Header",
        severity: rule.severity,
        confidence: rule.confidence,
        title: `TLS ${tlsVersion} cipher needs migration review: ${cipher}`,
        location: "SSL Header",
        rationale: rule.rationale,
        limitations: rule.limitations,
        references: rule.references,
        standardStatus: rule.standardStatus,
        updatedAt: rule.updatedAt,
        recommendation: rule.recommendation,
      });
    });
  });

  return findings.length > 0
    ? findings
    : [{
      source: "SSL Header",
      severity: "Info",
      title: "No valid cipher suites found",
      location: "SSL Header",
      details: "The TLS scan completed, but no cipher suite entries were available to analyze.",
    }];
};
