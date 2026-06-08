import EntropyTest from "./entropytest";
import FormatTest from "./formattest";
import FrequencyTest from "./frequencytest";
import PatternTest from "./patterntest";
import { adaptLegacyResult, skippedCheckResult } from "./tokenCheck";
import type {
  BatchTokenCheck,
  SingleTokenCheck,
  TokenCheckConfidence,
  TokenCheckId,
  TokenCheck,
  TokenCheckResult,
  TokenEvidencePolicy,
  LegacyTokenCheckResult,
} from "./tokenCheck";

interface TokenCheckMetadata {
  id: TokenCheckId;
  label: string;
  confidence: TokenCheckConfidence;
  evidencePolicy: TokenEvidencePolicy;
}

function defineSingleTokenCheck(
  metadata: TokenCheckMetadata,
  runLegacyCheck: (token: string) => LegacyTokenCheckResult
): SingleTokenCheck {
  const check: SingleTokenCheck = {
    ...metadata,
    scope: "single-token",
    run: token => adaptLegacyResult(check, runLegacyCheck(token)),
  };

  return check;
}

function defineBatchTokenCheck(
  metadata: TokenCheckMetadata,
  runLegacyCheck: (tokens: string[]) => LegacyTokenCheckResult
): BatchTokenCheck {
  const check: BatchTokenCheck = {
    ...metadata,
    scope: "batch",
    run: tokens => {
      if (tokens.length < 2) {
        return skippedCheckResult(check, "Needs Multiple Tokens");
      }

      return adaptLegacyResult(check, runLegacyCheck(tokens));
    },
  };

  return check;
}

export const singleTokenChecks: SingleTokenCheck[] = [
  defineSingleTokenCheck({
    id: "token-format",
    label: "Format",
    confidence: "Medium",
    evidencePolicy: "redacted",
  }, token => FormatTest({ tokenData: { token } })),
  defineSingleTokenCheck({
    id: "token-entropy",
    label: "Entropy",
    confidence: "Medium",
    evidencePolicy: "redacted",
  }, token => EntropyTest({ tokenData: { token } })),
  defineSingleTokenCheck({
    id: "token-pattern",
    label: "Pattern",
    confidence: "Medium",
    evidencePolicy: "redacted",
  }, token => PatternTest({
    tokenData: { token },
    mode: "single",
  })),
  defineSingleTokenCheck({
    id: "token-frequency",
    label: "Frequency",
    confidence: "Low",
    evidencePolicy: "redacted",
  }, token => FrequencyTest({ tokenData: { token } })),
];

export const batchTokenChecks: BatchTokenCheck[] = [
  defineBatchTokenCheck({
    id: "token-batch-pattern",
    label: "Batch Pattern",
    confidence: "Medium",
    evidencePolicy: "redacted",
  }, tokens => PatternTest({
    tokenData: { token: tokens },
    mode: "batch",
  })),
];

export const tokenChecks: TokenCheck[] = [
  ...singleTokenChecks,
  ...batchTokenChecks,
];

export function runSingleTokenChecks(token: string): TokenCheckResult[] {
  return singleTokenChecks.map(check => check.run(token));
}

export function runBatchTokenChecks(tokens: string[]): TokenCheckResult[] {
  return batchTokenChecks.map(check => check.run(tokens));
}
