import type { LegacyTokenCheckResult, SingleTokenData } from "./tokenCheck";

const getErrorMessage = (error: unknown): string => (
    error instanceof Error ? error.message : "Unknown parsing error"
);

const FormatTest = ({ tokenData }: { tokenData: SingleTokenData }): LegacyTokenCheckResult => {
    const runTest = (): LegacyTokenCheckResult => {
        const { token } = tokenData;

        if (!token || token === "No tokens found") {
            return { passed: false, message: "No tokens found", details: "Missing" };
        }

        // Base64URL decoding function
        const base64urlDecode = (str: string) => {
            str = str.replace(/-/g, '+').replace(/_/g, '/');
            while (str.length % 4) {
                str += '=';
            }
            try {
                return atob(str);
            } catch {
                return null;
            }
        };


        // 0. Short Token Check
        const minLength = 32;

        if (token.length < minLength) { //Adjust this value
            return {
                passed: false,
                message: `Token is too short (${token.length} characters, minimum ${minLength} recommended) and may be vulnerable to brute-force attacks.`,
                details: "Short Token",
                format: "short",
            };
        }

        // 1. JWT Check with Vulnerability Analysis
        const parts = token.split('.');
        if (parts.length === 3) {
            const [headerB64u, payloadB64u] = parts;
            const jwtHeader = base64urlDecode(headerB64u);
            const jwtPayload = base64urlDecode(payloadB64u);

            if (jwtHeader && jwtPayload) {
                let jwtAlgorithm: string | undefined;
                let jwtExp: number | undefined;
                const vulnerabilities: string[] = [];

                try {
                    const parsedHeader = JSON.parse(jwtHeader);
                    jwtAlgorithm = parsedHeader.alg;

                    // Check for "alg" property existence.
                    if (!("alg" in parsedHeader)) {
                       vulnerabilities.push("JWT does not have an 'alg' claim, which is insecure.");
                    }

                    // Check for "none" algorithm (major vulnerability)
                    if (jwtAlgorithm === "none") {
                        vulnerabilities.push("JWT uses 'none' algorithm, which is insecure.");
                    }

                    // Check for weak algorithms.
                    if (jwtAlgorithm === "HS256" && token.length < 100) {
                        vulnerabilities.push("JWT uses 'HS256' algorithm with a short length, which is weak.");
                    }

                    // Check for missing "kid" (optional but important for key rotation)
                    if (!parsedHeader.kid) {
                        vulnerabilities.push("JWT does not have a 'kid' claim, which may be insecure for key rotation.");
                    }
                } catch (headerParseError: unknown) {
                    jwtAlgorithm = undefined;
                     vulnerabilities.push(`Error parsing JWT header: ${getErrorMessage(headerParseError)}`);
                }

                try {
                    const parsedPayload = JSON.parse(jwtPayload);
                    jwtExp = parsedPayload.exp;

                    // Check if expiration is missing or very short-lived
                    if (typeof jwtExp !== 'number') {
                        vulnerabilities.push("JWT 'exp' claim is missing or not a number.");
                    } else {
                        const expTime = new Date(jwtExp * 1000);
                        if (expTime < new Date()) {
                            vulnerabilities.push("JWT is expired.");
                        }
                    }
                } catch (payloadParseError: unknown) {
                    vulnerabilities.push(`Error parsing JWT payload: ${getErrorMessage(payloadParseError)}`);
                }

                return {
                    passed: vulnerabilities.length === 0,
                    message: vulnerabilities.length === 0 ? "Token appears to be a valid JWT." : "JWT has potential vulnerabilities!",
                    details: "jwt",
                    format: "jwt",
                    jwtHeader,
                    jwtPayload,
                    jwtAlgorithm,
                    vulnerabilities,
                };
            }
        }


        // 2. Hexadecimal Token Check
        if (token.length >= 32 && /^[a-f0-9]+$/i.test(token)) {
            return {
                passed: true,
                message: "Token likely matches hex format.",
                format: "hex",
                details: "hex",
            };
        }

        // 3. UUID + Alphanumeric Check
        if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-[a-zA-Z0-9]+$/.test(token)) {
            return {
                passed: true,
                message: "Token likely matches UUID + alphanumeric format.",
                format: "uuid_alphanumeric",
                details: "uuid_alphanumeric",
            };
        }

        // 4. Base64URL Check
        if (/^[A-Za-z0-9_-]+$/.test(token) && token.length % 4 !== 1) {
            const decoded = base64urlDecode(token);
            if (decoded) {
                return {
                    passed: true,
                    message: "Token likely matches base64url format.",
                    format: "base64url",
                    details: "base64url",
                };
            }
        }

        // 5. Structured Opaque Token Check
        if (/^(v\d+_).+/.test(token) || token.includes("_")) {
            return {
                passed: true,
                message: "Token likely matches structured opaque format.",
                format: "opaque_structured",
                details: "opaque_structured",
            };
        }

        // 6. General Opaque Token Check (last fallback)
        if (token.length >= 16) {
            return {
                passed: true,
                message: "Token does not match known formats and is likely an opaque token.",
                details: "opaque",
                format: "opaque",
            };
        }

        // 7. Fallback: Unknown
        return {
            passed: false,
            message: "Token format could not be determined (too short).",
            details: "Unknown Format",
        };
    };

    return runTest();
};

export default FormatTest;
