import type { BatchTokenData, LegacyTokenCheckResult } from "./tokenCheck";

const PatternTest = ({
    tokenData,
    mode = "single",
}: {
    tokenData: BatchTokenData;
    mode?: "single" | "batch";
}): LegacyTokenCheckResult => {
    const runTest = (): LegacyTokenCheckResult => {
        const { token } = tokenData;

        // Convert `token` to an array if it's a string
        const tokenArray: string[] = Array.isArray(token) ? token : [token];

        if (tokenArray.length === 0 || tokenArray[0] === "No token found" || tokenArray[0] === "No tokens found") {
            return { passed: false, message: "No tokens found", details: "Missing" };
        }

        if (mode === "batch") {
            if (tokenArray.length < 2) {
                return { passed: true, message: "Batch token pattern check requires multiple tokens.", details: "Needs Multiple Tokens" };
            }

            const prefixSuffix = checkForCommonPrefixSuffix(tokenArray);
            if (prefixSuffix) {
                return prefixSuffix;
            }

            return {
                passed: true,
                message: "No cross-token prefix or suffix pattern detected.",
                details: "No Batch Patterns",
            };
        }

        for (let singleToken of tokenArray) {
            const tokenParts = singleToken.split(".");
            if (tokenParts.length === 3) {
                try {
                    singleToken = atob(tokenParts[1].replace(/_/g, "/").replace(/-/g, "+")); // Decode Base64 safely
                } catch {
                    return { passed: false, message: "Failed to decode JWT payload.", details: "Decoding Error" };
                }
            }
            const sequentialResult = checkForSequentialPatterns(singleToken);
            if (sequentialResult) return sequentialResult;

            const repetitiveResult = checkForRepetitivePatterns(singleToken);
            if (repetitiveResult) return repetitiveResult;
        }

        return {
            passed: true,
            message: "No obvious patterns detected in the token.",
            details: "No patterns",
        };
    };

    // Improved check for sequential patterns
    function checkForSequentialPatterns(token: string): LegacyTokenCheckResult | null {
        const sequenceLength = 5;

        for (let i = 0; i <= token.length - sequenceLength; i++) {
            const sequence = token.substring(i, i + sequenceLength);

            if (isSequential(sequence)) {
                return {
                    passed: false,
                    message: `Token contains sequential pattern: ${sequence}`,
                    details: "Sequential Pattern",
                    pattern: sequence,
                };
            }
        }
        return null;
    }

    function isSequential(sequence: string): boolean {
        if (sequence.length < 5) return false; // Only flag sequences 5+ characters long

        let increasing = true;
        let decreasing = true;

        for (let i = 1; i < sequence.length; i++) {
            if (sequence.charCodeAt(i) !== sequence.charCodeAt(i - 1) + 1) {
                increasing = false;
            }
            if (sequence.charCodeAt(i) !== sequence.charCodeAt(i - 1) - 1) {
                decreasing = false;
            }
        }

        return increasing || decreasing;
    }

    // Improved repetitive pattern check
    function checkForRepetitivePatterns(token: string): LegacyTokenCheckResult | null {
        const patternLength = 5; // Adjust if needed

        for (let i = 0; i <= token.length - 2 * patternLength; i++) {
            const pattern = token.substring(i, i + patternLength);

            if (token.slice(i + patternLength).includes(pattern)) {
                return {
                    passed: false,
                    message: `Token contains repeating pattern: ${pattern}`,
                    details: "Repeating Pattern",
                    pattern: pattern,
                };
            }
        }
        return null;
    }

    // Multiple token checks remain unchanged
    function checkForCommonPrefixSuffix(tokens: string[]): LegacyTokenCheckResult | null {
        const tokenLengthThreshold = 0.8; // Adjust as needed

        let commonPrefix = "";
        if (tokens.length > 0) {
            const firstToken = tokens[0];
            for (let i = 0; i < firstToken.length; i++) {
                const char = firstToken[i];
                if (tokens.every(token => token[i] === char)) {
                    commonPrefix += char;
                } else {
                    break;
                }
            }
        }

        if (commonPrefix.length > 0 && commonPrefix.length / tokens[0].length > tokenLengthThreshold) {
            return {
                passed: false,
                message: `Tokens share a nearly identical common prefix: "${commonPrefix}"`,
                details: "Nearly Identical Common Prefix",
                pattern: commonPrefix,
            };
        }

        let commonSuffix = "";
        if (tokens.length > 0) {
            const firstToken = tokens[0];
            for (let i = 0; i < firstToken.length; i++) {
                const char = firstToken[firstToken.length - 1 - i];
                if (tokens.every(token => token[token.length - 1 - i] === char)) {
                    commonSuffix = char + commonSuffix;
                } else {
                    break;
                }
            }
        }

        if (commonSuffix.length > 0 && commonSuffix.length / tokens[0].length > tokenLengthThreshold) {
            return {
                passed: false,
                message: `Tokens share a nearly identical common suffix: "${commonSuffix}"`,
                details: "Nearly Identical Common Suffix",
                pattern: commonSuffix,
            };
        }

        return null;
    }

    return runTest();
};

export default PatternTest;
