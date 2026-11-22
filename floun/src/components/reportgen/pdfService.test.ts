import { PDFDocument, StandardFonts } from "pdf-lib";
import { saveAs } from "file-saver";
import {
  generatePDFReport,
  resolveDefaultReportLogoAssetUrl,
  resolveReportAssetUrl,
} from "./pdfService";
import {
  layoutReport,
  marginBottom,
  marginX,
  pageSize,
  sectionDefinitions,
  type PdfFontSet,
} from "./pdfLayout";
import {
  buildPromptFindingsText,
  buildReportContent,
  countFindingsBySeverity,
  countVulnerableFindings,
  fallbackSections,
  flattenFindingGroups,
  FindingGroups,
  ReportContent,
} from "./reportDocument";
import {
  largeFindingGroups,
  smallFindingGroups,
} from "./reportContent.fixture";

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

async function createFontSet(): Promise<PdfFontSet> {
  const pdfDoc = await PDFDocument.create();

  return {
    regular: await pdfDoc.embedFont(StandardFonts.Helvetica),
    bold: await pdfDoc.embedFont(StandardFonts.HelveticaBold),
  };
}

function buildFixtureContent(groups: FindingGroups): ReportContent {
  const findingsText = buildPromptFindingsText(groups);
  const allFindings = flattenFindingGroups(groups);

  return buildReportContent(
    groups,
    fallbackSections(
      findingsText,
      countVulnerableFindings(allFindings),
      countFindingsBySeverity(allFindings, "Review")
    )
  );
}

function sectionTextsOf(content: ReportContent): Array<[string, string]> {
  return sectionDefinitions.map(([heading, key]) => [heading, String(content[key as keyof ReportContent])]);
}

async function savedPdfBytes(): Promise<Uint8Array> {
  const blob = vi.mocked(saveAs).mock.calls.at(-1)?.[0] as Blob;
  expect(blob).toBeTruthy();

  return new Uint8Array(await blob.arrayBuffer());
}

function expectLayoutWithinMargins(layout: ReturnType<typeof layoutReport>, fonts: PdfFontSet): void {
  for (const line of layout.lines) {
    expect(line.x).toBeGreaterThanOrEqual(marginX);
    expect(line.x).toBeLessThanOrEqual(pageSize[0] - marginX);
    expect(line.x + line.width).toBeLessThanOrEqual(pageSize[0] - marginX);
    expect(line.y - line.size * 0.3).toBeGreaterThanOrEqual(marginBottom);
    expect(line.y).toBeLessThanOrEqual(pageSize[1] - marginX + line.size);
  }

  void fonts;
}

test("regression: small-scan report stays compact and renders every section", async () => {
  const fonts = await createFontSet();
  const content = buildFixtureContent(smallFindingGroups);

  await generatePDFReport({
    title: "Quantum Safe Cryptography Report",
    subtitle: "Reviewing Crypto-Readiness and Migration Signals",
    date: "2026-06-08",
    confidentialityNotice: "Confidential - For Internal Use Only",
  }, content);

  const bytes = await savedPdfBytes();
  const pdfDoc = await PDFDocument.load(bytes);
  const pageCount = pdfDoc.getPageCount();

  expect(pageCount).toBeGreaterThanOrEqual(2);
  expect(pageCount).toBeLessThanOrEqual(6);

  const layout = layoutReport(fonts, sectionTextsOf(content));
  expect(layout.pageCount + 1).toBe(pageCount);
  expectLayoutWithinMargins(layout, fonts);

  const drawnHeadings = layout.lines
    .filter(line => line.kind === "sectionHeading")
    .map(line => line.text);
  expect(drawnHeadings).toEqual(sectionDefinitions.map(([heading]) => heading));
}, 60_000);

test("regression: large-scan report with long URLs keeps every line inside the margins", async () => {
  const fonts = await createFontSet();
  const content = buildFixtureContent(largeFindingGroups);

  await generatePDFReport({
    title: "Quantum Safe Cryptography Report",
    subtitle: "Reviewing Crypto-Readiness and Migration Signals",
    date: "2026-06-08",
    confidentialityNotice: "Confidential - For Internal Use Only",
  }, content);

  const bytes = await savedPdfBytes();
  const pdfDoc = await PDFDocument.load(bytes);
  const pageCount = pdfDoc.getPageCount();

  expect(pageCount).toBeGreaterThanOrEqual(2);
  expect(pageCount).toBeLessThanOrEqual(60);

  const layout = layoutReport(fonts, sectionTextsOf(content));
  expect(layout.pageCount + 1).toBe(pageCount);
  expectLayoutWithinMargins(layout, fonts);
}, 60_000);
