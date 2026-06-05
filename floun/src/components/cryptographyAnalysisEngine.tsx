import {
  CERTIFICATE_SIGNATURE_RULES,
  getJavaScriptCryptoRules,
  JavaScriptCryptoRule,
} from "./cryptoRules";

export type EncryptionPattern = Pick<JavaScriptCryptoRule, "name" | "regex"> & {
  safety: JavaScriptCryptoRule["severity"];
};

export const getEncryptionPatterns = (): EncryptionPattern[] => (
  getJavaScriptCryptoRules().map(rule => ({
    name: rule.name,
    regex: rule.regex,
    safety: rule.severity,
  }))
);

export const CERTIFICATE_SIGNATURES = {
  safe: CERTIFICATE_SIGNATURE_RULES
    .filter(rule => rule.severity === "Safe")
    .flatMap(rule => rule.aliases),
  vulnerable: CERTIFICATE_SIGNATURE_RULES
    .filter(rule => rule.severity === "Vulnerable")
    .flatMap(rule => rule.aliases),
};

