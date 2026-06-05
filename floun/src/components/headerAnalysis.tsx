import { AnalysisFinding } from './analysisFinding';
import { classifyTlsCipher } from './cryptoRules';

interface Cipher {
  name: string;
}

interface Suite {
  protocol: number;
  list: Cipher[];
}

interface Protocol {
  id: number;
  name: string;
  version: string;
}

interface EndpointDetails {
  suites?: Suite[];
  protocols?: Protocol[];
}

interface Endpoint {
  details?: EndpointDetails;
}

interface TlsScanData {
  endpoints: Endpoint[];
}

const isTlsScanData = (value: unknown): value is TlsScanData => (
  Boolean(value) &&
  typeof value === "object" &&
  Array.isArray((value as TlsScanData).endpoints)
);

export const HeaderSecurityCheck = (jsonData: unknown): AnalysisFinding[] => {
  if (!isTlsScanData(jsonData)) {
    return [{
      source: "SSL Header",
      severity: "Info",
      title: "No TLS endpoint data found",
      location: "SSL Header",
      details: "The TLS scan did not return an endpoints array.",
    }];
  }

  const findings: AnalysisFinding[] = [];

  jsonData.endpoints.forEach((endpoint) => {
    if (!endpoint.details) {
      return;
    }

    let tlsVersion = "<Unknown>";
    const nonQuantumSafeCiphers: string[] = [];

    if (Array.isArray(endpoint.details.protocols)) {
      const tls13Supported = endpoint.details.protocols.some(protocol => protocol.version === "1.3");
      tlsVersion = tls13Supported ? "1.3" : "<1.2 or Lower>";
    }

    if (Array.isArray(endpoint.details.suites)) {
      endpoint.details.suites.forEach((suite) => {
        if (!Array.isArray(suite.list)) {
          return;
        }

        suite.list.forEach((cipher) => {
          if (!cipher.name) {
            return;
          }

          const rule = classifyTlsCipher(cipher.name);

          if (rule.severity === "Safe") {
            findings.push({
              ruleId: rule.id,
              source: "SSL Header",
              severity: rule.severity,
              confidence: rule.confidence,
              title: `TLS ${tlsVersion} uses post-quantum cipher ${cipher.name}`,
              location: "SSL Header",
              recommendation: rule.recommendation,
            });
          } else {
            nonQuantumSafeCiphers.push(cipher.name);
          }
        });
      });
    }

    nonQuantumSafeCiphers.forEach(cipher => {
      const rule = classifyTlsCipher(cipher);
      findings.push({
        ruleId: rule.id,
        source: "SSL Header",
        severity: rule.severity,
        confidence: rule.confidence,
        title: `TLS ${tlsVersion} uses non-quantum-safe cipher ${cipher}`,
        location: "SSL Header",
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
