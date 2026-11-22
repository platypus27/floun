import { PDFDocument, StandardFonts } from "pdf-lib";
import { saveAs } from "file-saver";
import {
  buildSectionPlan,
  generatePDFReport,
  resolveDefaultReportLogoAssetUrl,
  resolveReportAssetUrl,
} from "./pdfService";
import {
  layoutReport,
  marginBottom,
  marginX,
  pageSize,
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
  singleFindingGroups,
  smallFindingGroups,
  zeroFindingGroups,
} from "./reportContent.fixture";

vi.mock("file-saver", () => ({
  saveAs: vi.fn(),
}));

const coverDetails = {
  title: "QA Report",
  subtitle: "Probe",
  date: "2026-06-08",
  confidentialityNotice: "Confidential - For Internal Use Only",
};

const reportContent = {
  introduction: "intro",
  executiveSummary: "summary",
  vulnerabilityAnalysis: "analysis",
  riskAssessment: "risk",
  recommendations: "recommendations",
  nextStep: "next",
  conclusion: "conclusion",
  appendix: [],
  findingDisplays: [],
  statusCounts: { vulnerable: 0, review: 0, safe: 0, informational: 0 },
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

test("resolveDefaultReportLogoAssetUrl uses the packaged high-resolution PNG icon", () => {
  const chromeApi = {
    runtime: {
      getURL: (assetPath: string) => `chrome-extension://floun/${assetPath}`,
    },
  };

  expect(resolveDefaultReportLogoAssetUrl(chromeApi)).toBe(
    "chrome-extension://floun/icons/floun.png"
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

async function savedPdfBytes(): Promise<Uint8Array> {
  const blob = vi.mocked(saveAs).mock.calls.at(-1)?.[0] as Blob;
  expect(blob).toBeTruthy();

  return new Uint8Array(await blob.arrayBuffer());
}

function layoutOf(content: ReportContent, fonts: PdfFontSet) {
  return layoutReport(fonts, buildSectionPlan(content));
}

function expectLayoutWithinMargins(layout: ReturnType<typeof layoutReport>): void {
  for (const line of layout.lines) {
    expect(line.x).toBeGreaterThanOrEqual(marginX);
    expect(line.x).toBeLessThanOrEqual(pageSize[0] - marginX);
    expect(line.x + line.width).toBeLessThanOrEqual(pageSize[0] - marginX);
    expect(line.y - line.size * 0.3).toBeGreaterThanOrEqual(marginBottom);
    expect(line.y).toBeLessThanOrEqual(pageSize[1] - marginX + line.size);
  }
}

test("regression: small-scan report stays compact and renders every section", async () => {
  const fonts = await createFontSet();
  const content = buildFixtureContent(smallFindingGroups);

  await generatePDFReport(coverDetails, content);

  const bytes = await savedPdfBytes();
  const pdfDoc = await PDFDocument.load(bytes);
  const pageCount = pdfDoc.getPageCount();

  expect(pageCount).toBeGreaterThanOrEqual(2);
  expect(pageCount).toBeLessThanOrEqual(6);

  const layout = layoutOf(content, fonts);
  expect(layout.pageCount + 1).toBe(pageCount);
  expectLayoutWithinMargins(layout);

  const drawnHeadings = layout.lines
    .filter(line => line.kind === "sectionHeading")
    .map(line => line.text);
  expect(drawnHeadings).toEqual(layout.sections.map(section => section.heading));
  expect(drawnHeadings).toContain("3. Readiness Analysis");
  expect(drawnHeadings).toContain("8. Appendices");
}, 60_000);

test("regression: large-scan report keeps every line inside the margins and splits the index with repeated headers", async () => {
  const fonts = await createFontSet();
  const content = buildFixtureContent(largeFindingGroups);

  await generatePDFReport(coverDetails, content);

  const bytes = await savedPdfBytes();
  const pdfDoc = await PDFDocument.load(bytes);
  const pageCount = pdfDoc.getPageCount();

  expect(pageCount).toBeGreaterThanOrEqual(2);
  expect(pageCount).toBeLessThanOrEqual(40);

  const layout = layoutOf(content, fonts);
  expect(layout.pageCount + 1).toBe(pageCount);
  expectLayoutWithinMargins(layout);

  const headerPages = new Set(
    layout.lines
      .filter(line => line.kind === "tableHeader" && line.text === "Confidence")
      .map(line => line.pageIndex)
  );
  expect(headerPages.size).toBeGreaterThanOrEqual(2);
}, 60_000);

test("regression: no finding text is duplicated between the analysis and the appendices", async () => {
  const fonts = await createFontSet();
  const content = buildFixtureContent(largeFindingGroups);
  const layout = layoutOf(content, fonts);

  const analysisHeading = layout.lines.find(line => (
    line.kind === "sectionHeading" && line.text === "3. Readiness Analysis"
  ));
  const appendixStart = layout.lines.find(line => line.text === "8. Appendices");
  const firstAnalysisPage = analysisHeading?.pageIndex ?? 0;
  const appendixHeadingIndex = appendixStart ? layout.lines.indexOf(appendixStart) : layout.lines.length;

  const analysisText = layout.lines
    .filter((line, index) => index < appendixHeadingIndex && line.pageIndex >= firstAnalysisPage)
    .map(line => line.text)
    .join(" ");
  const appendixText = layout.lines
    .filter((line, index) => index > appendixHeadingIndex)
    .map(line => line.text)
    .join(" ");

  expect(appendixStart).toBeDefined();
  expect(analysisText.length).toBeGreaterThan(0);
  expect(appendixText.length).toBeGreaterThan(0);

  const sample = flattenFindingGroups(largeFindingGroups)[7];

  expect(sample.rationale).toBeTruthy();
  expect(sample.details).toBeTruthy();
  expect(sample.references?.length).toBeTruthy();
  expect(analysisText).toContain(sample.rationale!.slice(0, 40));
  expect(analysisText).not.toContain(sample.details!.slice(0, 40));
  expect(appendixText).toContain(sample.details!.slice(0, 40));
  expect(appendixText).not.toContain(sample.rationale!.slice(0, 40));
  expect(appendixText).toContain(sample.references![0].slice(0, 40));
  expect(analysisText).not.toContain(sample.references![0].slice(0, 40));
}, 60_000);

test("regression: summary counts match the finding list", async () => {
  const fonts = await createFontSet();
  const content = buildFixtureContent(largeFindingGroups);
  const layout = layoutOf(content, fonts);

  const expectedCounts = content.statusCounts;
  const expectedTotal = expectedCounts.vulnerable + expectedCounts.review + expectedCounts.safe + expectedCounts.informational;
  expect(content.findingDisplays.length).toBe(expectedTotal);

  const countsRow = layout.lines.filter(line => line.kind === "tableCell").slice(0, 4);
  expect(countsRow.map(line => line.text)).toEqual([
    String(expectedCounts.vulnerable),
    String(expectedCounts.review),
    String(expectedCounts.safe),
    String(expectedCounts.informational),
  ]);
});

test("regression: zero-finding scan omits the appendices and stays compact", async () => {
  const fonts = await createFontSet();
  const content = buildFixtureContent(zeroFindingGroups);

  await generatePDFReport(coverDetails, content);

  const bytes = await savedPdfBytes();
  const pdfDoc = await PDFDocument.load(bytes);
  const pageCount = pdfDoc.getPageCount();

  expect(pageCount).toBeGreaterThanOrEqual(2);
  expect(pageCount).toBeLessThanOrEqual(4);

  const layout = layoutOf(content, fonts);
  const drawnHeadings = layout.lines
    .filter(line => line.kind === "sectionHeading")
    .map(line => line.text);

  expect(drawnHeadings).not.toContain("8. Appendices");
  expect(layout.sections.map(section => section.heading)).not.toContain("8. Appendices");
  expectLayoutWithinMargins(layout);
}, 60_000);

test("regression: single-finding scan renders one block, matching counts and an appendix entry", async () => {
  const fonts = await createFontSet();
  const content = buildFixtureContent(singleFindingGroups);

  await generatePDFReport(coverDetails, content);

  const layout = layoutOf(content, fonts);

  expect(content.findingDisplays.length).toBe(1);
  expect(content.appendix.length).toBe(1);
  expect(content.statusCounts.vulnerable).toBe(1);

  const blockTitles = layout.lines.filter(line => line.kind === "findingTitle");
  expect(blockTitles.map(line => line.text)).toContain(content.findingDisplays[0].title);

  const countsRow = layout.lines.filter(line => line.kind === "tableCell").slice(0, 4);
  expect(countsRow.map(line => line.text)).toEqual(["1", "0", "0", "0"]);

  expectLayoutWithinMargins(layout);
}, 60_000);
