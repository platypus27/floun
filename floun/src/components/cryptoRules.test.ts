import {
  CRYPTO_RULESET_VERSION,
  classifyCertificateSignature,
  classifyTlsCipher,
  getJavaScriptCryptoRules,
} from "./cryptoRules";

test("exposes a versioned crypto ruleset", () => {
  expect(CRYPTO_RULESET_VERSION).toMatch(/^\d{4}\.\d{2}$/);
  expect(getJavaScriptCryptoRules().some(rule => rule.id === "js-md5")).toBe(true);
});

test("classifies known post-quantum TLS cipher suites", () => {
  expect(classifyTlsCipher("TLS_KYBER768")).toMatchObject({
    id: "tls-kyber-family",
    severity: "Safe",
  });
});

test("classifies unlisted TLS cipher suites as migration risks", () => {
  expect(classifyTlsCipher("TLS_AES_128_GCM_SHA256")).toMatchObject({
    id: "tls-classical-or-unclassified-cipher",
    severity: "Vulnerable",
  });
});

test("classifies certificate signature strings by normalized algorithm names", () => {
  expect(classifyCertificateSignature("sha256WithRSAEncryption")).toMatchObject({
    id: "cert-classical-signature",
    severity: "Vulnerable",
  });
  expect(classifyCertificateSignature("Dilithium3")).toMatchObject({
    id: "cert-post-quantum-signature",
    severity: "Safe",
  });
});

