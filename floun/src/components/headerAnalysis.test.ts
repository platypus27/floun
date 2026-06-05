import { HeaderSecurityCheck } from "./headerAnalysis";

test("returns an informational finding when TLS data is missing", () => {
  expect(HeaderSecurityCheck(null)[0]).toMatchObject({
    source: "SSL Header",
    severity: "Info",
  });
});

test("classifies post-quantum TLS cipher suites as safe", () => {
  const findings = HeaderSecurityCheck({
    endpoints: [{
      details: {
        protocols: [{ id: 772, name: "TLS", version: "1.3" }],
        suites: [{ protocol: 772, list: [{ name: "TLS_KYBER768" }] }],
      },
    }],
  });

  expect(findings[0]).toMatchObject({
    ruleId: "tls-kyber-family",
    severity: "Safe",
    confidence: "Medium",
  });
});

test("classifies unlisted TLS cipher suites as vulnerable migration risks", () => {
  const findings = HeaderSecurityCheck({
    endpoints: [{
      details: {
        protocols: [{ id: 772, name: "TLS", version: "1.3" }],
        suites: [{ protocol: 772, list: [{ name: "TLS_AES_128_GCM_SHA256" }] }],
      },
    }],
  });

  expect(findings[0]).toMatchObject({
    ruleId: "tls-classical-or-unclassified-cipher",
    severity: "Vulnerable",
  });
});

