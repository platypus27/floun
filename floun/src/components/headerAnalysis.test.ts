import { HeaderSecurityCheck } from "./headerAnalysis";

test("returns an informational finding when TLS data is missing", () => {
  expect(HeaderSecurityCheck(null)[0]).toMatchObject({
    source: "SSL Header",
    severity: "Info",
  });
});

test("classifies post-quantum TLS cipher suites as safe", () => {
  const findings = HeaderSecurityCheck({
    provider: "ssl-labs",
    endpoints: [{
      protocolVersions: ["1.3"],
      cipherSuites: ["TLS_KYBER768"],
    }],
  });

  expect(findings[0]).toMatchObject({
    ruleId: "tls-ml-kem-family",
    severity: "Safe",
    confidence: "Medium",
    standardStatus: "standardized",
  });
  expect(findings[0].rationale).toContain("ML-KEM");
  expect(findings[0].limitations).toContain("TLS naming");
  expect(findings[0].references?.length).toBeGreaterThan(0);
});

test("classifies unlisted TLS cipher suites as review migration signals", () => {
  const findings = HeaderSecurityCheck({
    provider: "ssl-labs",
    endpoints: [{
      protocolVersions: ["1.3"],
      cipherSuites: ["TLS_AES_128_GCM_SHA256"],
    }],
  });

  expect(findings[0]).toMatchObject({
    ruleId: "tls-classical-or-unclassified-cipher",
    severity: "Review",
    standardStatus: "unclassified",
  });
  expect(findings[0].rationale).toContain("migration inventory");
});
