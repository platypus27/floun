import type { AnalysisModuleResult } from "./analysisModules";
import { createReport } from "./ai-handler";
import { omittedEvidenceNotice } from "./reportgen/findingSerializers";
import { generateChatMessage, hasDeepseekApiKey } from "./reportgen/deepseekService";
import { generatePDFReport } from "./reportgen/pdfService";

vi.mock("./reportgen/deepseekService", () => ({
  generateChatMessage: vi.fn(),
  hasDeepseekApiKey: vi.fn(),
}));

vi.mock("./reportgen/pdfService", () => ({
  generatePDFReport: vi.fn(),
}));

const rawToken = "secret-token-value";

const moduleResults: AnalysisModuleResult[] = [
  {
    id: "tokens",
    label: "Tokens",
    reportGroupLabel: "Tokens",
    breakdownLabel: "Tokens",
    summary: {
      total: 1,
      safe: 0,
      review: 0,
      vulnerable: 1,
      informational: 0,
      reviewDetails: [],
      vulnerableDetails: [],
    },
    findings: [{
      ruleId: "token-format",
      source: "Tokens",
      severity: "Vulnerable",
      confidence: "Medium",
      title: "Session token may be weak",
      location: "Tokens",
      evidence: rawToken,
      details: "Failed checks: token-format.",
      sensitive: true,
      standardStatus: "heuristic",
      rationale: "Token heuristic rationale.",
      limitations: "Browser-visible only.",
      recommendation: "Validate with the application owner.",
    }],
  },
];

beforeEach(() => {
  vi.mocked(generateChatMessage).mockReset();
  vi.mocked(hasDeepseekApiKey).mockReset();
  vi.mocked(generatePDFReport).mockReset();
});

test("createReport passes redacted fallback report content to PDF generation", async () => {
  vi.mocked(hasDeepseekApiKey).mockReturnValue(false);

  await createReport(moduleResults);

  expect(generateChatMessage).not.toHaveBeenCalled();
  expect(generatePDFReport).toHaveBeenCalledTimes(1);

  const [coverDetails, reportContent] = vi.mocked(generatePDFReport).mock.calls[0];
  const serializedContent = JSON.stringify(reportContent);

  expect(coverDetails.subtitle).toBe("Reviewing Crypto-Readiness and Migration Signals");
  expect(serializedContent).toContain(omittedEvidenceNotice);
  expect(serializedContent).toContain("Token heuristic rationale.");
  expect(serializedContent).not.toContain(rawToken);
});

test("createReport sends redacted findings to DeepSeek prompts when local AI drafting is configured", async () => {
  vi.mocked(hasDeepseekApiKey).mockReturnValue(true);
  vi.mocked(generateChatMessage).mockResolvedValue("generated section");

  await createReport(moduleResults);

  expect(generateChatMessage).toHaveBeenCalled();

  const prompts = vi.mocked(generateChatMessage).mock.calls.map(([prompt]) => prompt);

  expect(prompts.some(prompt => prompt.includes(omittedEvidenceNotice))).toBe(true);
  expect(prompts.join("\n")).not.toContain(rawToken);
  expect(generatePDFReport).toHaveBeenCalledTimes(1);
});
