import { saveAs } from "file-saver";
import {
  generatePDFReport,
  resolveDefaultReportLogoAssetUrl,
  resolveReportAssetUrl,
} from "./pdfService";

vi.mock("file-saver", () => ({
  saveAs: vi.fn(),
}));

const reportContent = {
  introduction: "intro",
  executiveSummary: "summary",
  vulnerabilityAnalysis: "analysis",
  riskAssessment: "risk",
  recommendations: "recommendations",
  nextStep: "next",
  conclusion: "conclusion",
  appendix: "appendix",
  reviewMethodsCount: 0,
  reviewMethodsBreakdown: "none",
  vulnerableMethodsCount: 0,
  vulnerableMethodsBreakdown: "none",
};

test("resolveReportAssetUrl uses chrome runtime URLs when available", () => {
  const chromeApi = {
    runtime: {
      getURL: (assetPath: string) => `chrome-extension://floun/${assetPath}`,
    },
  };

  expect(resolveReportAssetUrl("icons/floun.png", chromeApi)).toBe(
    "chrome-extension://floun/icons/floun.png"
  );
});

test("resolveReportAssetUrl falls back to the relative asset path outside Chrome", () => {
  expect(resolveReportAssetUrl("icons/floun.png", undefined)).toBe("icons/floun.png");
});

test("resolveDefaultReportLogoAssetUrl uses the packaged PNG icon", () => {
  const chromeApi = {
    runtime: {
      getURL: (assetPath: string) => `chrome-extension://floun/${assetPath}`,
    },
  };

  expect(resolveDefaultReportLogoAssetUrl(chromeApi)).toBe(
    "chrome-extension://floun/icons/icon_128.png"
  );
});

test("generatePDFReport skips invalid logo data instead of aborting the report", async () => {
  await expect(generatePDFReport({
    title: "QA Report",
    subtitle: "Probe",
    date: "2026-06-08",
    logoBase64: "data:image/png;base64,/9j/4AAQSkZJRgABAQEA",
  }, reportContent)).resolves.toBeUndefined();

  expect(saveAs).toHaveBeenCalledWith(expect.any(Blob), "Quantum_Safe_Cryptography_Report.pdf");
});
