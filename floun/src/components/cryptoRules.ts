import { FindingSeverity } from "./analysisFinding";

export const CRYPTO_RULESET_VERSION = "2026.06";

export type RuleCategory = "javascript-pattern" | "tls-cipher-suite" | "certificate-signature";

export type RuleConfidence = "High" | "Medium" | "Low";

interface BaseCryptoRule {
  id: string;
  category: RuleCategory;
  name: string;
  severity: FindingSeverity;
  confidence: RuleConfidence;
  recommendation: string;
  reference?: string;
}

export interface JavaScriptCryptoRule extends BaseCryptoRule {
  category: "javascript-pattern";
  regex: RegExp;
}

export interface NamedCryptoRule extends BaseCryptoRule {
  category: "tls-cipher-suite" | "certificate-signature";
  aliases: string[];
}

export const JAVASCRIPT_CRYPTO_RULES: JavaScriptCryptoRule[] = [
  {
    id: "js-aes-encrypt",
    category: "javascript-pattern",
    name: "AES Encryption",
    regex: /\bAES\b\s*\.\s*encrypt\s*\([^)]*\)/gi,
    severity: "Safe",
    confidence: "Medium",
    recommendation: "Confirm key management, mode, nonce handling, and authentication rather than treating AES usage alone as sufficient.",
  },
  {
    id: "js-rsa-key-generation",
    category: "javascript-pattern",
    name: "RSA Key Generation",
    regex: /\bRSA\b\s*\.\s*generate(?:KeyPair|Key)\s*\(\s*\d+\s*\)/gi,
    severity: "Vulnerable",
    confidence: "Medium",
    recommendation: "Plan migration away from RSA for long-term quantum resistance and prefer standardized post-quantum key establishment where supported.",
  },
  {
    id: "js-triple-des",
    category: "javascript-pattern",
    name: "Triple DES Encryption",
    regex: /\b(?:Triple\s+DES|3DES)\b\s*\.\s*encrypt\s*\([^)]*\)/gi,
    severity: "Vulnerable",
    confidence: "High",
    recommendation: "Remove 3DES and replace it with authenticated modern encryption.",
  },
  {
    id: "js-des",
    category: "javascript-pattern",
    name: "DES Encryption",
    regex: /\bDES\b\s*\.\s*encrypt\s*\([^)]*\)/gi,
    severity: "Vulnerable",
    confidence: "High",
    recommendation: "Remove DES and replace it with authenticated modern encryption.",
  },
  {
    id: "js-rc4",
    category: "javascript-pattern",
    name: "RC4 Encryption",
    regex: /\bRC4\b\s*\.\s*encrypt\s*\([^)]*\)/gi,
    severity: "Vulnerable",
    confidence: "High",
    recommendation: "Remove RC4 and replace it with authenticated modern encryption.",
  },
  {
    id: "js-cryptojs",
    category: "javascript-pattern",
    name: "CryptoJS Usage",
    regex: /\bCryptoJS\b/gi,
    severity: "Info",
    confidence: "Low",
    recommendation: "Review CryptoJS usage manually; the library name alone does not prove whether the implementation is safe.",
  },
  {
    id: "js-ntru",
    category: "javascript-pattern",
    name: "NTRU Encryption",
    regex: /\bNTRUEncrypt\b\s*\([^)]*\)/gi,
    severity: "Safe",
    confidence: "Medium",
    recommendation: "Confirm the implementation and parameters match current post-quantum guidance.",
  },
  {
    id: "js-frodokem",
    category: "javascript-pattern",
    name: "FrodoKEM Encryption",
    regex: /\bFrodoKEM\b\s*\([^)]*\)/gi,
    severity: "Safe",
    confidence: "Medium",
    recommendation: "Confirm the implementation and parameters match current post-quantum guidance.",
  },
  {
    id: "js-kyber",
    category: "javascript-pattern",
    name: "Kyber Encryption",
    regex: /\bKyber\b\s*\([^)]*\)/gi,
    severity: "Safe",
    confidence: "Medium",
    recommendation: "Confirm the implementation and parameters match current ML-KEM guidance.",
  },
  {
    id: "js-mceliece",
    category: "javascript-pattern",
    name: "McEliece Encryption",
    regex: /\bMcEliece\b\s*\([^)]*\)/gi,
    severity: "Safe",
    confidence: "Medium",
    recommendation: "Confirm the implementation and parameters match current post-quantum guidance.",
  },
  {
    id: "js-saber",
    category: "javascript-pattern",
    name: "SABER Encryption",
    regex: /\bSABER\b\s*\([^)]*\)/gi,
    severity: "Safe",
    confidence: "Low",
    recommendation: "Confirm whether this legacy post-quantum candidate is appropriate for the environment.",
  },
  {
    id: "js-md5",
    category: "javascript-pattern",
    name: "MD5 Hashing",
    regex: /\bMD5\b\s*\(/gi,
    severity: "Vulnerable",
    confidence: "High",
    recommendation: "Remove MD5 from security-sensitive paths and replace it with modern hash or signature schemes.",
  },
  {
    id: "js-sha1",
    category: "javascript-pattern",
    name: "SHA-1 Hashing",
    regex: /\bSHA-1\b\s*\(/gi,
    severity: "Vulnerable",
    confidence: "High",
    recommendation: "Remove SHA-1 from security-sensitive paths and replace it with modern hash or signature schemes.",
  },
];

export const TLS_CIPHER_SUITE_RULES: NamedCryptoRule[] = [
  {
    id: "tls-kyber-family",
    category: "tls-cipher-suite",
    name: "Post-quantum TLS cipher suite",
    aliases: [
      "ECDHE_KYBER512_RSA_WITH_AES_256_GCM_SHA384",
      "ECDHE_KYBER768_ECDSA_WITH_AES_256_GCM_SHA384",
      "ECDHE_SABER_ECDSA_WITH_AES_256_GCM_SHA384",
      "ECDHE_NTRU_HPS2048509_ECDSA_WITH_AES_256_GCM_SHA384",
      "ECDHE_BIKE1_L1_ECDSA_WITH_CHACHA20_POLY1305_SHA256",
      "ECDHE_HQC_128_ECDSA_WITH_AES_256_GCM_SHA384",
      "TLS_KYBER512",
      "TLS_KYBER768",
      "TLS_KYBER1024",
    ],
    severity: "Safe",
    confidence: "Medium",
    recommendation: "Confirm browser and server support for current standardized post-quantum TLS options.",
  },
];

export const CERTIFICATE_SIGNATURE_RULES: NamedCryptoRule[] = [
  {
    id: "cert-post-quantum-signature",
    category: "certificate-signature",
    name: "Post-quantum certificate signature",
    aliases: ["kyber", "NTRU", "FrodoKEM", "McEliece", "SABER", "Dilithium", "Falcon", "Sphincs+", "XMSS", "Rainbow", "SIDH"],
    severity: "Safe",
    confidence: "Medium",
    recommendation: "Confirm the certificate chain and client ecosystem support the selected post-quantum signature scheme.",
  },
  {
    id: "cert-classical-signature",
    category: "certificate-signature",
    name: "Classical certificate signature",
    aliases: ["RSA", "DSA", "ECDSA", "Diffie-Hellman", "ElGamal", "SEED", "RC4", "DES", "3DES", "MD5", "SHA-1", "SHA-256", "SHA-512"],
    severity: "Vulnerable",
    confidence: "Medium",
    recommendation: "Plan certificate and trust-chain migration for quantum-safe readiness.",
  },
];

export function getJavaScriptCryptoRules(): JavaScriptCryptoRule[] {
  return JAVASCRIPT_CRYPTO_RULES.map(rule => ({
    ...rule,
    regex: new RegExp(rule.regex.source, rule.regex.flags),
  }));
}

export function findTlsCipherRule(cipherName: string): NamedCryptoRule | null {
  return findNamedRule(TLS_CIPHER_SUITE_RULES, cipherName, false);
}

export function classifyTlsCipher(cipherName: string): NamedCryptoRule {
  return findTlsCipherRule(cipherName) || {
    id: "tls-classical-or-unclassified-cipher",
    category: "tls-cipher-suite",
    name: "Classical or unclassified TLS cipher suite",
    aliases: [cipherName],
    severity: "Vulnerable",
    confidence: "Medium",
    recommendation: "Review the cipher suite and prefer current TLS 1.3 plus standardized post-quantum migration options where available.",
  };
}

export function classifyCertificateSignature(algorithm: string): NamedCryptoRule {
  return findNamedRule(CERTIFICATE_SIGNATURE_RULES, algorithm, true) || {
    id: "cert-unclassified-signature",
    category: "certificate-signature",
    name: "Unclassified certificate signature",
    aliases: [algorithm],
    severity: "Vulnerable",
    confidence: "Low",
    recommendation: "Review the certificate signature algorithm manually and classify it in the rule catalogue.",
  };
}

function findNamedRule(rules: NamedCryptoRule[], value: string, allowContains: boolean): NamedCryptoRule | null {
  const normalizedValue = normalizeRuleValue(value);

  return rules.find(rule => (
    rule.aliases.some(alias => {
      const normalizedAlias = normalizeRuleValue(alias);
      return allowContains
        ? normalizedValue.includes(normalizedAlias)
        : normalizedAlias === normalizedValue;
    })
  )) || null;
}

function normalizeRuleValue(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9+]/g, "");
}
