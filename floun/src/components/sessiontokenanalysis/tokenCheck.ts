import type { AnalysisFinding } from "../analysisFinding";

export type TokenCheckId =
  | "token-format"
  | "token-entropy"
  | "token-pattern"
  | "token-frequency"
  | "token-batch-pattern";

export type TokenCheckScope = "single-token" | "batch";
export type TokenCheckStatus = "pass" | "fail" | "skipped";
export type TokenEvidencePolicy = "redacted" | "none";
export type TokenCheckConfidence = NonNullable<AnalysisFinding["confidence"]>;

export interface SingleTokenData {
  token: string;
  timestamp?: number;
  source?: string;
  cookieName?: string;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: string;
  headerName?: string;
  storageKey?: string;
}

export interface BatchTokenData {
  token: string | string[];
}

export interface LegacyTokenCheckResult {
  passed: boolean;
  message: string;
  details?: string;
  format?: string;
  jwtHeader?: string;
  jwtPayload?: string;
  jwtAlgorithm?: string;
  pattern?: string;
  vulnerabilities?: string[];
  frequencyAnalysis?: Record<string, number>;
}

interface BaseTokenCheck {
  id: TokenCheckId;
  label: string;
  confidence: TokenCheckConfidence;
  evidencePolicy: TokenEvidencePolicy;
}

export interface SingleTokenCheck extends BaseTokenCheck {
  scope: "single-token";
  run: (token: string) => TokenCheckResult;
}

export interface BatchTokenCheck extends BaseTokenCheck {
  scope: "batch";
  run: (tokens: string[]) => TokenCheckResult;
}

export type TokenCheck = SingleTokenCheck | BatchTokenCheck;

export interface TokenCheckResult {
  checkId: TokenCheckId;
  label: string;
  scope: TokenCheckScope;
  status: TokenCheckStatus;
  confidence: TokenCheckConfidence;
  evidencePolicy: TokenEvidencePolicy;
  details: string;
}

export function adaptLegacyResult(
  check: BaseTokenCheck & { scope: TokenCheckScope },
  result: LegacyTokenCheckResult
): TokenCheckResult {
  return {
    checkId: check.id,
    label: check.label,
    scope: check.scope,
    status: result.passed ? "pass" : "fail",
    confidence: check.confidence,
    evidencePolicy: check.evidencePolicy,
    details: result.details || result.format || check.label,
  };
}

export function skippedCheckResult(
  check: BaseTokenCheck & { scope: TokenCheckScope },
  details: string
): TokenCheckResult {
  return {
    checkId: check.id,
    label: check.label,
    scope: check.scope,
    status: "skipped",
    confidence: check.confidence,
    evidencePolicy: check.evidencePolicy,
    details,
  };
}
