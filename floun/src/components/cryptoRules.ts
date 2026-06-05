import { FindingSeverity } from "./analysisFinding";

export const CRYPTO_RULESET_VERSION = "2026.06";

export type RuleCategory = "javascript-pattern" | "tls-cipher-suite" | "certificate-signature";

export type RuleConfidence = "High" | "Medium" | "Low";

export type RuleStandardStatus =
  | "standardized"
  | "draft"
  | "classical"
  | "deprecated"
  | "legacy-candidate"
  | "unclassified";

interface BaseCryptoRule {
  id: string;
  category: RuleCategory;
  name: string;
  severity: FindingSeverity;
  confidence: RuleConfidence;
  recommendation: string;
  standardStatus: RuleStandardStatus;
  references: string[];
  rationale: string;
  limitations: string;
  updatedAt: string;
}

export interface JavaScriptCryptoRule extends BaseCryptoRule {
  category: "javascript-pattern";
  regex: RegExp;
}

export interface NamedCryptoRule extends BaseCryptoRule {
  category: "tls-cipher-suite" | "certificate-signature";
  aliases: string[];
}

const UPDATED_AT = "2026-06-05";
const REFERENCES = Object.freeze({
  cisaMigration: "https://www.cisa.gov/resources-tools/resources/quantum-readiness-migration-post-quantum-cryptography",
  nistPqcStandards: "https://www.nist.gov/news-events/news/2024/08/nist-releases-first-3-finalized-post-quantum-encryption-standards",
  fips203: "https://csrc.nist.gov/pubs/fips/203/final",
  fips204: "https://csrc.nist.gov/pubs/fips/204/final",
  fips205: "https://csrc.nist.gov/pubs/fips/205/final",
  nistPqcProject: "https://csrc.nist.gov/projects/post-quantum-cryptography",
});

function metadata(
  standardStatus: RuleStandardStatus,
  references: string[],
  rationale: string,
  limitations: string
) {
  return {
    standardStatus,
    references,
    rationale,
    limitations,
    updatedAt: UPDATED_AT,
  };
}

const inventoryLimitations = "This scanner identifies migration signals from visible names and API responses; it does not validate implementation correctness, key sizes, certificate chains, or server-side policy.";
const pqcReferences = [REFERENCES.nistPqcStandards, REFERENCES.cisaMigration];

export const JAVASCRIPT_CRYPTO_RULES: JavaScriptCryptoRule[] = [
  {
    id: "js-aes-encrypt",
    category: "javascript-pattern",
    name: "AES Encryption",
    regex: /\bAES\b\s*\.\s*encrypt\s*\([^)]*\)/gi,
    severity: "Safe",
    confidence: "Medium",
    recommendation: "Confirm key management, mode, nonce handling, and authentication rather than treating AES usage alone as sufficient.",
    ...metadata(
      "classical",
      [REFERENCES.cisaMigration],
      "AES is not a public-key algorithm targeted by Shor-style migration planning, but visible usage should still be inventoried.",
      "A regex match cannot confirm key length, authenticated mode, nonce uniqueness, or whether the call protects sensitive data."
    ),
  },
  {
    id: "js-rsa-key-generation",
    category: "javascript-pattern",
    name: "RSA Key Generation",
    regex: /\bRSA\b\s*\.\s*generate(?:KeyPair|Key)\s*\(\s*\d+\s*\)/gi,
    severity: "Review",
    confidence: "Medium",
    recommendation: "Plan migration away from RSA for long-term quantum resistance and prefer standardized post-quantum key establishment where supported.",
    ...metadata(
      "classical",
      [REFERENCES.cisaMigration],
      "RSA is a quantum-vulnerable public-key family, so new key-generation signals belong in a readiness inventory.",
      "The presence of RSA key generation does not prove an immediately exploitable weakness without context, exposure, and data lifetime analysis."
    ),
  },
  {
    id: "js-triple-des",
    category: "javascript-pattern",
    name: "Triple DES Encryption",
    regex: /\b(?:Triple\s+DES|3DES)\b\s*\.\s*encrypt\s*\([^)]*\)/gi,
    severity: "Vulnerable",
    confidence: "High",
    recommendation: "Remove 3DES and replace it with authenticated modern encryption.",
    ...metadata(
      "deprecated",
      [REFERENCES.cisaMigration],
      "3DES is a known legacy cipher and should be treated as a concrete weak-crypto finding rather than only a migration signal.",
      "The match only proves a visible 3DES call pattern; confirm execution paths before remediation."
    ),
  },
  {
    id: "js-des",
    category: "javascript-pattern",
    name: "DES Encryption",
    regex: /\bDES\b\s*\.\s*encrypt\s*\([^)]*\)/gi,
    severity: "Vulnerable",
    confidence: "High",
    recommendation: "Remove DES and replace it with authenticated modern encryption.",
    ...metadata(
      "deprecated",
      [REFERENCES.cisaMigration],
      "DES is a known legacy cipher and should be treated as a concrete weak-crypto finding.",
      "The match only proves a visible DES call pattern; confirm execution paths before remediation."
    ),
  },
  {
    id: "js-rc4",
    category: "javascript-pattern",
    name: "RC4 Encryption",
    regex: /\bRC4\b\s*\.\s*encrypt\s*\([^)]*\)/gi,
    severity: "Vulnerable",
    confidence: "High",
    recommendation: "Remove RC4 and replace it with authenticated modern encryption.",
    ...metadata(
      "deprecated",
      [REFERENCES.cisaMigration],
      "RC4 is a known legacy stream cipher and should be treated as a concrete weak-crypto finding.",
      "The match only proves a visible RC4 call pattern; confirm execution paths before remediation."
    ),
  },
  {
    id: "js-cryptojs",
    category: "javascript-pattern",
    name: "CryptoJS Usage",
    regex: /\bCryptoJS\b/gi,
    severity: "Info",
    confidence: "Low",
    recommendation: "Review CryptoJS usage manually; the library name alone does not prove whether the implementation is safe.",
    ...metadata(
      "unclassified",
      [REFERENCES.cisaMigration],
      "Library presence can help build inventory, but the library name alone does not identify a safe or unsafe algorithm.",
      "This signal should not be used as a vulnerability finding without matching the specific primitive, mode, and usage."
    ),
  },
  {
    id: "js-ml-kem",
    category: "javascript-pattern",
    name: "ML-KEM Key Encapsulation",
    regex: /\b(?:ML[-_ ]?KEM|MLKEM|Kyber)(?:[-_ ]?(?:512|768|1024))?\b/gi,
    severity: "Safe",
    confidence: "Medium",
    recommendation: "Confirm the implementation, parameter set, and protocol integration match FIPS 203 and current ecosystem guidance.",
    ...metadata(
      "standardized",
      [REFERENCES.fips203, ...pqcReferences],
      "ML-KEM is the standardized NIST key-encapsulation mechanism based on CRYSTALS-Kyber.",
      "A name match cannot prove a FIPS-validated implementation, correct parameter selection, or safe protocol binding."
    ),
  },
  {
    id: "js-ml-dsa",
    category: "javascript-pattern",
    name: "ML-DSA Signature",
    regex: /\b(?:ML[-_ ]?DSA|MLDSA|Dilithium)(?:[-_ ]?\d+)?\b/gi,
    severity: "Safe",
    confidence: "Medium",
    recommendation: "Confirm the implementation, parameter set, and signature workflow match FIPS 204 and current ecosystem guidance.",
    ...metadata(
      "standardized",
      [REFERENCES.fips204, ...pqcReferences],
      "ML-DSA is the standardized NIST digital signature algorithm based on CRYSTALS-Dilithium.",
      "A name match cannot prove a FIPS-validated implementation, correct parameter selection, or trustworthy key management."
    ),
  },
  {
    id: "js-slh-dsa",
    category: "javascript-pattern",
    name: "SLH-DSA Signature",
    regex: /\b(?:SLH[-_ ]?DSA|SLHDSA|SPHINCS\+?)(?:[-_ ]?(?:128|192|256)[fs]?)?\b/gi,
    severity: "Safe",
    confidence: "Medium",
    recommendation: "Confirm the implementation, parameter set, and signing workflow match FIPS 205 and current ecosystem guidance.",
    ...metadata(
      "standardized",
      [REFERENCES.fips205, ...pqcReferences],
      "SLH-DSA is the standardized NIST stateless hash-based digital signature algorithm based on SPHINCS+.",
      "A name match cannot prove a FIPS-validated implementation, correct parameter selection, or trustworthy key management."
    ),
  },
  {
    id: "js-ntru",
    category: "javascript-pattern",
    name: "NTRU Encryption",
    regex: /\bNTRUEncrypt\b\s*\([^)]*\)/gi,
    severity: "Review",
    confidence: "Medium",
    recommendation: "Confirm the implementation and parameters match current post-quantum guidance.",
    ...metadata(
      "legacy-candidate",
      [REFERENCES.nistPqcProject, REFERENCES.cisaMigration],
      "NTRU-family names are useful readiness signals, but they are not one of the three finalized NIST baseline standards in this scanner.",
      inventoryLimitations
    ),
  },
  {
    id: "js-frodokem",
    category: "javascript-pattern",
    name: "FrodoKEM Encryption",
    regex: /\bFrodoKEM\b\s*\([^)]*\)/gi,
    severity: "Review",
    confidence: "Medium",
    recommendation: "Confirm the implementation and parameters match current post-quantum guidance.",
    ...metadata(
      "legacy-candidate",
      [REFERENCES.nistPqcProject, REFERENCES.cisaMigration],
      "FrodoKEM is a post-quantum candidate-family signal, not a finalized NIST baseline standard in this scanner.",
      inventoryLimitations
    ),
  },
  {
    id: "js-mceliece",
    category: "javascript-pattern",
    name: "McEliece Encryption",
    regex: /\bMcEliece\b\s*\([^)]*\)/gi,
    severity: "Review",
    confidence: "Medium",
    recommendation: "Confirm the implementation and parameters match current post-quantum guidance.",
    ...metadata(
      "legacy-candidate",
      [REFERENCES.nistPqcProject, REFERENCES.cisaMigration],
      "McEliece-family names are useful readiness signals, but they require manual status and deployment review.",
      inventoryLimitations
    ),
  },
  {
    id: "js-saber",
    category: "javascript-pattern",
    name: "SABER Encryption",
    regex: /\bSABER\b\s*\([^)]*\)/gi,
    severity: "Review",
    confidence: "Low",
    recommendation: "Confirm whether this legacy post-quantum candidate is appropriate for the environment.",
    ...metadata(
      "legacy-candidate",
      [REFERENCES.nistPqcProject, REFERENCES.cisaMigration],
      "SABER is a legacy post-quantum candidate-family signal that should be reviewed rather than treated as a finalized readiness win.",
      inventoryLimitations
    ),
  },
  {
    id: "js-md5",
    category: "javascript-pattern",
    name: "MD5 Hashing",
    regex: /\bMD5\b\s*\(/gi,
    severity: "Vulnerable",
    confidence: "High",
    recommendation: "Remove MD5 from security-sensitive paths and replace it with modern hash or signature schemes.",
    ...metadata(
      "deprecated",
      [REFERENCES.cisaMigration],
      "MD5 is a known deprecated hash and should be treated as a concrete weak-crypto finding.",
      "The match does not determine whether usage is security-sensitive; remediation should confirm context."
    ),
  },
  {
    id: "js-sha1",
    category: "javascript-pattern",
    name: "SHA-1 Hashing",
    regex: /\bSHA-?1\b\s*\(/gi,
    severity: "Vulnerable",
    confidence: "High",
    recommendation: "Remove SHA-1 from security-sensitive paths and replace it with modern hash or signature schemes.",
    ...metadata(
      "deprecated",
      [REFERENCES.cisaMigration],
      "SHA-1 is deprecated for collision-resistant security use and should be treated as a concrete weak-crypto finding.",
      "The match does not determine whether usage is security-sensitive; remediation should confirm context."
    ),
  },
];

export const TLS_CIPHER_SUITE_RULES: NamedCryptoRule[] = [
  {
    id: "tls-ml-kem-family",
    category: "tls-cipher-suite",
    name: "ML-KEM-family TLS signal",
    aliases: [
      "TLS_MLKEM768",
      "TLS_ML_KEM_768",
      "X25519MLKEM768",
      "X25519_MLKEM768",
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
    ...metadata(
      "standardized",
      [REFERENCES.fips203, ...pqcReferences],
      "ML-KEM-family TLS names are positive crypto-readiness signals for post-quantum key establishment.",
      "TLS naming is still ecosystem-dependent; verify negotiated groups, implementation status, fallback behavior, and client compatibility."
    ),
  },
];

export const CERTIFICATE_SIGNATURE_RULES: NamedCryptoRule[] = [
  {
    id: "cert-deprecated-signature",
    category: "certificate-signature",
    name: "Deprecated certificate signature",
    aliases: ["MD5", "SHA-1", "SHA1"],
    severity: "Vulnerable",
    confidence: "High",
    recommendation: "Replace certificates signed with deprecated hash algorithms and confirm the full trust chain is modern.",
    ...metadata(
      "deprecated",
      [REFERENCES.cisaMigration],
      "MD5 and SHA-1 certificate signature signals are concrete weak-crypto findings.",
      "Certificate lookup data may summarize only the leaf certificate; validate the full chain before closing remediation."
    ),
  },
  {
    id: "cert-post-quantum-signature",
    category: "certificate-signature",
    name: "Post-quantum certificate signature",
    aliases: ["ML-DSA", "MLDSA", "Dilithium", "SLH-DSA", "SLHDSA", "Sphincs+", "SPHINCSPLUS"],
    severity: "Safe",
    confidence: "Medium",
    recommendation: "Confirm the certificate chain and client ecosystem support the selected post-quantum signature scheme.",
    ...metadata(
      "standardized",
      [REFERENCES.fips204, REFERENCES.fips205, ...pqcReferences],
      "ML-DSA and SLH-DSA are finalized NIST post-quantum signature standards; Dilithium and SPHINCS+ are retained as aliases.",
      "A signature-algorithm string does not prove Web PKI availability, chain policy, implementation validation, or client compatibility."
    ),
  },
  {
    id: "cert-pq-draft-or-legacy-signature",
    category: "certificate-signature",
    name: "Draft or legacy post-quantum certificate signature",
    aliases: ["FN-DSA", "FNDSA", "Falcon", "XMSS", "Rainbow", "SIDH"],
    severity: "Review",
    confidence: "Medium",
    recommendation: "Review the algorithm status and ecosystem support before treating this as a standardized certificate-readiness signal.",
    ...metadata(
      "draft",
      [REFERENCES.nistPqcProject, REFERENCES.cisaMigration],
      "Some post-quantum signature names are selected, draft, experimental, or legacy signals rather than finalized deployment evidence.",
      "This rule preserves inventory value but intentionally avoids calling the finding safe or vulnerable without manual review."
    ),
  },
  {
    id: "cert-classical-signature",
    category: "certificate-signature",
    name: "Classical certificate signature",
    aliases: ["RSA", "DSA", "ECDSA", "Diffie-Hellman", "ElGamal", "SHA-256", "SHA-384", "SHA-512"],
    severity: "Review",
    confidence: "Medium",
    recommendation: "Plan certificate and trust-chain migration for quantum-safe readiness.",
    ...metadata(
      "classical",
      [REFERENCES.cisaMigration],
      "Classical public-key certificate signatures should be inventoried for migration planning, but they are not automatically weak/deprecated findings.",
      "The scanner cannot determine certificate criticality, data lifetime, chain constraints, or migration priority from the algorithm string alone."
    ),
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
    severity: "Review",
    confidence: "Medium",
    recommendation: "Review the cipher suite and prefer current TLS 1.3 plus standardized post-quantum migration options where available.",
    ...metadata(
      "unclassified",
      [REFERENCES.cisaMigration],
      "Classical or unrecognized TLS suites are migration inventory signals rather than automatic vulnerabilities.",
      "TLS API responses may omit negotiated group details; validate live server behavior and client compatibility before prioritizing remediation."
    ),
  };
}

export function classifyCertificateSignature(algorithm: string): NamedCryptoRule {
  return findNamedRule(CERTIFICATE_SIGNATURE_RULES, algorithm, true) || {
    id: "cert-unclassified-signature",
    category: "certificate-signature",
    name: "Unclassified certificate signature",
    aliases: [algorithm],
    severity: "Review",
    confidence: "Low",
    recommendation: "Review the certificate signature algorithm manually and classify it in the rule catalogue.",
    ...metadata(
      "unclassified",
      [REFERENCES.cisaMigration],
      "Unclassified certificate algorithms need human review before being labeled safe or vulnerable.",
      "Certificate lookup data may normalize or omit details; validate against the full certificate chain."
    ),
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
