import { analyzeCertificate } from "./certificateanalysis";
import { HeaderSecurityCheck } from "./headerAnalysis";
import { analyzeCryptoInJavascript } from "./javascriptanalysis";
import { analyzeTokens } from "./tokenAnalysis";

const ruleIds = (findings: Array<{ ruleId?: string }>) => new Set(findings.map(finding => finding.ruleId));

test("calibrates fixture-style JavaScript weak, review, and readiness signals", () => {
  const findings = analyzeCryptoInJavascript([
    {
      type: "inline",
      src: "fixture",
      content: `
        const md5Digest = MD5(input);
        const sha1Digest = SHA1(input);
        const legacyDes = DES.encrypt(payload);
        const legacyTripleDes = "Triple DES.encrypt(payload)";
        const legacyRc4 = RC4.encrypt(payload);
        const rsaInventory = RSA.generateKeyPair(2048);
        const readiness = ["ML-KEM-768", "Kyber768", "ML-DSA-65", "Dilithium3", "SLH-DSA-SHA2-128f", "SPHINCS+"];
      `,
    },
  ]);

  const ids = ruleIds(findings);

  expect(ids).toContain("js-md5");
  expect(ids).toContain("js-sha1");
  expect(ids).toContain("js-des");
  expect(ids).toContain("js-triple-des");
  expect(ids).toContain("js-rc4");
  expect(ids).toContain("js-rsa-key-generation");
  expect(ids).toContain("js-ml-kem");
  expect(ids).toContain("js-ml-dsa");
  expect(ids).toContain("js-slh-dsa");

  expect(findings.filter(finding => finding.severity === "Vulnerable").length).toBeGreaterThanOrEqual(5);
  expect(findings.find(finding => finding.ruleId === "js-rsa-key-generation")).toMatchObject({
    severity: "Review",
    standardStatus: "classical",
  });
  expect(findings.find(finding => finding.ruleId === "js-ml-kem")).toMatchObject({
    severity: "Safe",
    standardStatus: "standardized",
  });
});

test("ignores obvious JavaScript comment-only crypto mentions", () => {
  const findings = analyzeCryptoInJavascript([
    {
      type: "inline",
      content: `
        // MD5(input) was removed from production.
        /*
          DES.encrypt(payload)
          RC4.encrypt(payload)
        */
        const realDigest = SHA1(input);
      `,
    },
  ]);

  expect(ruleIds(findings)).toEqual(new Set(["js-sha1"]));
});

test("calibrates normalized TLS facts into readiness and review findings", () => {
  const findings = HeaderSecurityCheck({
    provider: "ssl-labs",
    endpoints: [
      {
        protocolVersions: ["1.3"],
        cipherSuites: ["TLS_KYBER768", "TLS_AES_128_GCM_SHA256"],
      },
    ],
  });

  expect(findings).toEqual(expect.arrayContaining([
    expect.objectContaining({
      ruleId: "tls-ml-kem-family",
      severity: "Safe",
      standardStatus: "standardized",
    }),
    expect.objectContaining({
      ruleId: "tls-classical-or-unclassified-cipher",
      severity: "Review",
      standardStatus: "unclassified",
    }),
  ]));
});

test("calibrates certificate signature facts across deprecated, classical, and PQC names", () => {
  expect(analyzeCertificate({ provider: "ssl-checker", signatureAlgorithm: "sha1WithRSAEncryption" })[0]).toMatchObject({
    ruleId: "cert-deprecated-signature",
    severity: "Vulnerable",
  });
  expect(analyzeCertificate({ provider: "ssl-checker", signatureAlgorithm: "sha256WithRSAEncryption" })[0]).toMatchObject({
    ruleId: "cert-classical-signature",
    severity: "Review",
  });
  expect(analyzeCertificate({ provider: "ssl-checker", signatureAlgorithm: "ML-DSA-65" })[0]).toMatchObject({
    ruleId: "cert-post-quantum-signature",
    severity: "Safe",
  });
});

test("keeps fixture token values redacted while preserving batch-check findings", () => {
  const sharedPrefix = "aZ7qLm9PQr4xVn2Ty8Bc0Kd6Se3FgH";
  const fixtureTokens = [
    "0123456789abcdef0123456789abcdef",
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKL",
    "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJmbG91biJ9.c2lnbmF0dXJl",
  ];
  const batchTokens = [`${sharedPrefix}A`, `${sharedPrefix}B`];

  const findings = analyzeTokens(fixtureTokens);
  const serializedFindings = JSON.stringify(findings);
  const batchFindings = JSON.stringify(analyzeTokens(batchTokens));

  expect(findings).toHaveLength(fixtureTokens.length);
  expect(serializedFindings).toContain("[redacted token");
  fixtureTokens.forEach(token => {
    expect(serializedFindings).not.toContain(token);
  });
  expect(batchFindings).toContain("token-batch-pattern:fail:Medium:redacted");
  expect(batchFindings).not.toContain(sharedPrefix);
});
