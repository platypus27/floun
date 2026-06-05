import { entropy } from './utils/entropy';

interface TokenData {
  token: string;
  timestamp?: number;
  source?: string;
  cookieName?: string;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: string;
  headerName?: string;
}

interface TestResult {
  passed: boolean;
  message: string;
  vulnerabilities?: string[];
}

const EntropyTest = ({ tokenData }: { tokenData: TokenData }): TestResult => {
  const runTest = (): TestResult => {
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
