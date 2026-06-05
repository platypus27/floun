import FormatTest from './sessiontokenanalysis/formattest';
import EntropyTest from './sessiontokenanalysis/entropytest';
import PatternTest from './sessiontokenanalysis/patterntest';
import FrequencyTest from './sessiontokenanalysis/frequencytest';
import { AnalysisFinding, redactValue } from './analysisFinding';

interface TokenTestResult {
  passed: boolean;
  message: string;
  details?: string;
}

const missingTokenValues = new Set(["No tokens found", "No token found"]);

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

const summarizeFailedChecks = (results: TokenTestResult[]): string => {
  const failedChecks = results
    .filter(result => !result.passed)
    .map(result => result.details || result.message)
    .filter(Boolean);

  if (failedChecks.length === 0) {
    return "All heuristic checks passed.";
  }

  return `Failed checks: ${failedChecks.join(", ")}.`;
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

  const results: AnalysisFinding[] = [];

  tokenList.forEach(token => {
    if (token.trim() === "") {
      return;
    }

    const formatTestResult = FormatTest({ tokenData: { token } });
    const entropyTestResult = EntropyTest({ tokenData: { token } });
    const patternTestResult = PatternTest({ tokenData: { token } });
    const frequencyTestResult = FrequencyTest({ tokenData: { token } });

    if (
      formatTestResult.passed &&
      entropyTestResult.passed &&
      patternTestResult.passed &&
      frequencyTestResult.passed
    ) {
      results.push({
        source: "Tokens",
        severity: "Safe",
        title: "Session token passed heuristic checks",
        location: "Tokens",
        evidence: redactValue("token", token),
        details: summarizeFailedChecks([
          formatTestResult,
          entropyTestResult,
          patternTestResult,
          frequencyTestResult,
        ]),
        sensitive: true,
      });
    } else {
      results.push({
        source: "Tokens",
        severity: "Vulnerable",
        title: "Session token may be weak",
        location: "Tokens",
        evidence: redactValue("token", token),
        details: summarizeFailedChecks([
          formatTestResult,
          entropyTestResult,
          patternTestResult,
          frequencyTestResult,
        ]),
        sensitive: true,
      });
    }
  });

  return results;
};
