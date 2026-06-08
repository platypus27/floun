import { entropy } from './utils/entropy';
import type { LegacyTokenCheckResult, SingleTokenData } from "./tokenCheck";

const EntropyTest = ({ tokenData }: { tokenData: SingleTokenData }): LegacyTokenCheckResult => {
  const runTest = (): LegacyTokenCheckResult => {
    const token = tokenData.token;

    if (!token || token === "No tokens found") {
      return {
        passed: false,
        message: "No tokens found"
      };
    }

    const actualEntropy = entropy(token);
    const maxPossibleEntropy = Math.log2(new Set(token).size);
    const pass = actualEntropy > (maxPossibleEntropy * 0.95);

    return {
      passed: pass,
      message: pass
        ? `Actual: ${actualEntropy.toFixed(2)}, Max Possible: ${maxPossibleEntropy.toFixed(2)}`
        : `Actual: ${actualEntropy.toFixed(2)}, Max Possible: ${maxPossibleEntropy.toFixed(2)}`
    };
  };

  return runTest();
};

export default EntropyTest;
