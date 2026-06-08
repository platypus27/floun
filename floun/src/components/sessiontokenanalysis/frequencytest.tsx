import type { LegacyTokenCheckResult, SingleTokenData } from "./tokenCheck";

const FrequencyTest = ({ tokenData }: { tokenData: SingleTokenData }): LegacyTokenCheckResult => {
    const runTest = (): LegacyTokenCheckResult => {
        const token = tokenData.token;

        if (!token || token === "No tokens found") {
            return {
                passed: false,
                message: "No tokens found",
            };
        }

        const frequencies: { [char: string]: number } = {};
        for (const char of token) {
            frequencies[char] = (frequencies[char] || 0) + 1;
        }

        const totalChars = token.length;
        const threshold = totalChars < 32 ? 0.2 : totalChars < 64 ? 0.15 : 0.1; 

        let anomalyDetected = false;
        let anomalyMessage = "";

        for (const char in frequencies) {
            const frequency = frequencies[char] / totalChars;
            if (frequency > threshold) {
                anomalyDetected = true;
                anomalyMessage += `Character '${char}' appears too frequently (${(frequency * 100).toFixed(2)}%). `;
            }
        }

        const pass = !anomalyDetected; // Pass if no anomalies are detected

        return {
            passed: pass,
            message: pass
                ? "Character distribution appears reasonably uniform."
                : `${anomalyMessage}`,
            details: anomalyDetected ? "Frequency Anomaly" : "Uniform Distribution",
            frequencyAnalysis: frequencies, // Return the frequency analysis data
        };
    };

    return runTest();
};

export default FrequencyTest;
