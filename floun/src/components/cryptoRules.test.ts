import {
  CRYPTO_RULESET_VERSION,
  CERTIFICATE_SIGNATURE_RULES,
  TLS_CIPHER_SUITE_RULES,
  classifyCertificateSignature,
  classifyTlsCipher,
  getJavaScriptCryptoRules,
} from "./cryptoRules";

test("exposes a versioned crypto ruleset", () => {
  expect(CRYPTO_RULESET_VERSION).toMatch(/^\d{4}\.\d{2}$/);
  expect(getJavaScriptCryptoRules().some(rule => rule.id === "js-md5")).toBe(true);
});

test("ships required metadata on every crypto rule", () => {
  const allRules = [
    ...getJavaScriptCryptoRules(),
    ...TLS_CIPHER_SUITE_RULES,
    ...CERTIFICATE_SIGNATURE_RULES,
  ];

  allRules.forEach(rule => {
    expect(rule.standardStatus).toBeTruthy();
    expect(rule.references.length).toBeGreaterThan(0);
    expect(rule.rationale).toBeTruthy();
    expect(rule.limitations).toBeTruthy();
    expect(rule.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

test("classifies ML-KEM-family TLS cipher suites and Kyber aliases", () => {
  expect(classifyTlsCipher("X25519MLKEM768")).toMatchObject({
    id: "tls-ml-kem-family",
    severity: "Safe",
    standardStatus: "standardized",
  });
  expect(classifyTlsCipher("TLS_KYBER768")).toMatchObject({
    id: "tls-ml-kem-family",
    severity: "Safe",
  });
});

test("classifies unlisted TLS cipher suites as review migration signals", () => {
  expect(classifyTlsCipher("TLS_AES_128_GCM_SHA256")).toMatchObject({
    id: "tls-classical-or-unclassified-cipher",
    severity: "Review",
  });
});

test("classifies certificate signature strings by normalized algorithm names and severity", () => {
  expect(classifyCertificateSignature("sha256WithRSAEncryption")).toMatchObject({
    id: "cert-classical-signature",
    severity: "Review",
  });
  expect(classifyCertificateSignature("sha1WithRSAEncryption")).toMatchObject({
    id: "cert-deprecated-signature",
    severity: "Vulnerable",
  });
  expect(classifyCertificateSignature("Dilithium3")).toMatchObject({
    id: "cert-post-quantum-signature",
    severity: "Safe",
  });
  expect(classifyCertificateSignature("SLH-DSA")).toMatchObject({
    id: "cert-post-quantum-signature",
    severity: "Safe",
  });
});

test("keeps finalized PQC JavaScript names and aliases in the rule catalogue", () => {
  const rulesById = new Map(getJavaScriptCryptoRules().map(rule => [rule.id, rule]));
  const matches = (ruleId: string, text: string) => {
    const rule = rulesById.get(ruleId);
    const regex = rule ? new RegExp(rule.regex.source, rule.regex.flags) : null;

    return Boolean(regex?.test(text));
  };

  expect(matches("js-ml-kem", "const kem = ML-KEM-768;")).toBe(true);
  expect(matches("js-ml-kem", "const kem = Kyber768;")).toBe(true);
  expect(matches("js-ml-dsa", "const sig = ML-DSA-65;")).toBe(true);
  expect(matches("js-ml-dsa", "const sig = Dilithium3;")).toBe(true);
  expect(matches("js-slh-dsa", "const sig = SPHINCS+;")).toBe(true);
});
