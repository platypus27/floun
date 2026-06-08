import { AnalysisFinding, redactValue } from './analysisFinding';
import {
  runBatchTokenChecks,
  runSingleTokenChecks,
} from './sessiontokenanalysis/tokenCheckRegistry';
import type { TokenCheckConfidence, TokenCheckResult } from './sessiontokenanalysis/tokenCheck';

const missingTokenValues = new Set(["No tokens found", "No token found"]);
const tokenHeuristicRationale = "Browser-visible token shape, entropy, repetition, and format checks can highlight suspicious session-token signals.";
const tokenHeuristicLimitations = "These browser-visible checks only inspect token values available to the extension; they do not validate server-side session storage, rotation, revocation, cookie flags, or authentication policy.";
const tokenHeuristicRecommendation = "Validate token generation and session controls with the application owner, especially for tokens that fail format, entropy, pattern, or frequency checks.";

const normalizeTokenInput = (tokens: unknown): string[] => {
  if (!Array.isArray(tokens)) {
    return [];
  }

  return tokens.filter((token): token is string => (
    typeof token === "string" &&
    token.trim().length > 0 &&
    !missingTokenValues.has(token)
  ));
};

const formatCheckDetails = (result: TokenCheckResult): string => (
  `${result.checkId}:${result.status}:${result.confidence}:${result.evidencePolicy} (${result.details})`
);

const summarizeCheckResults = (results: TokenCheckResult[]): string => {
  const failedChecks = results.filter(result => result.status === "fail");

  if (failedChecks.length > 0) {
    return `Failed checks: ${failedChecks.map(formatCheckDetails).join(", ")}.`;
  }

  return `All applicable heuristic checks passed. Checks: ${results.map(formatCheckDetails).join(", ")}.`;
};

const confidenceRank: Record<TokenCheckConfidence, number> = {
  Low: 0,
  Medium: 1,
  High: 2,
};

const resolveFindingConfidence = (results: TokenCheckResult[]): TokenCheckConfidence => {
  const failedChecks = results.filter(result => result.status === "fail");
  const confidenceSource = failedChecks.length > 0 ? failedChecks : results;

  return confidenceSource.reduce<TokenCheckConfidence>((highest, result) => (
    confidenceRank[result.confidence] > confidenceRank[highest] ? result.confidence : highest
  ), "Low");
};

export const analyzeTokens = (tokens: unknown): AnalysisFinding[] => {
  const tokenList = normalizeTokenInput(tokens);

  if (tokenList.length === 0) {
    return [{
      source: "Tokens",
      severity: "Info",
      title: "No session tokens found",
      details: "No cookie, localStorage, or sessionStorage values matched the session-token patterns.",
    }];
  }

  const batchCheckResults = runBatchTokenChecks(tokenList);

  return tokenList.map(token => {
    const checkResults = [
      ...runSingleTokenChecks(token),
      ...batchCheckResults,
    ];
    const hasFailedChecks = checkResults.some(result => result.status === "fail");

    return {
      source: "Tokens",
      severity: hasFailedChecks ? "Vulnerable" : "Safe",
      confidence: resolveFindingConfidence(checkResults),
      title: hasFailedChecks ? "Session token may be weak" : "Session token passed heuristic checks",
      location: "Tokens",
      evidence: redactValue("token", token),
      details: summarizeCheckResults(checkResults),
      standardStatus: "heuristic",
      rationale: tokenHeuristicRationale,
      limitations: tokenHeuristicLimitations,
      recommendation: hasFailedChecks
        ? tokenHeuristicRecommendation
        : "Keep validating token generation, rotation, storage flags, and server-side session controls outside this browser-visible heuristic.",
      sensitive: true,
    };
  });
};
