import { PDFDocument, StandardFonts } from "pdf-lib";
import {
  bodyFontSize,
  contentWidth,
  layoutReport,
  marginBottom,
  marginX,
  pageSize,
  sectionDefinitions,
  wrapLineToWidth,
  type PdfFontSet,
} from "./pdfLayout";

async function createFonts(): Promise<PdfFontSet> {
  const pdfDoc = await PDFDocument.create();

  return {
    regular: await pdfDoc.embedFont(StandardFonts.Helvetica),
    bold: await pdfDoc.embedFont(StandardFonts.HelveticaBold),
  };
}

describe("wrapLineToWidth", () => {
  test("wraps words within the available width without losing text", async () => {
    const fonts = await createFonts();
    const text = "The quick brown fox jumps over the lazy dog and keeps running";
    const lines = wrapLineToWidth(text, fonts.regular, bodyFontSize, 200);

    expect(lines.length).toBeGreaterThan(1);

    for (const line of lines) {
      expect(fonts.regular.widthOfTextAtSize(line, bodyFontSize)).toBeLessThanOrEqual(200);
    }

    expect(lines.join(" ")).toBe(text);
  });

  test("character-breaks long URLs so no line exceeds the width", async () => {
    const fonts = await createFonts();
    const longUrl = "https://example.com/very/deep/path?with=query&parameters=that&are=quite&long=indeed";
    const lines = wrapLineToWidth(`See ${longUrl} for details`, fonts.regular, bodyFontSize, contentWidth);

    expect(lines.length).toBeGreaterThan(1);

    for (const line of lines) {
      expect(fonts.regular.widthOfTextAtSize(line, bodyFontSize)).toBeLessThanOrEqual(contentWidth);
    }

    expect(lines.join("").replace(/\s+/g, "")).toContain(longUrl);
  });

  test("character-breaks long hashes and base64 values", async () => {
    const fonts = await createFonts();
    const longHash = "a3f1c8e92b47d06f5c31e8a94d72b06c5f1e3a98b47d206f5c31e8a94d72b06c";
    const lines = wrapLineToWidth(`Hash: ${longHash}`, fonts.regular, bodyFontSize, contentWidth);

    for (const line of lines) {
      expect(fonts.regular.widthOfTextAtSize(line, bodyFontSize)).toBeLessThanOrEqual(contentWidth);
    }

    expect(lines.join("").replace(/\s+/g, "")).toContain(`Hash:${longHash}`);
  });

  test("breaks long URLs after path punctuation instead of mid-word", async () => {
    const fonts = await createFonts();
    const url = "https://example.com/" + "segment/".repeat(14);
    const lines = wrapLineToWidth(`See ${url}`, fonts.regular, bodyFontSize, contentWidth);
    const nonFinalLines = lines.slice(0, -1);

    expect(nonFinalLines.length).toBeGreaterThan(0);

    for (const line of nonFinalLines) {
      expect("/-.".includes(line[line.length - 1])).toBe(true);
    }
  });
});

describe("layoutReport", () => {
  test("keeps every text line inside the page margins", async () => {
    const fonts = await createFonts();
    const longUrl = "https://example.com/" + "segment/".repeat(20);
    const layout = layoutReport(fonts, [
      ["1. Introduction", "Short intro."],
      ["8. Appendices", [
        "JavaScript Results:",
        "Found Weak Crypto [Vulnerable] in inline script (inline). Rule ID: js-weak-crypto",
        `References: ${longUrl}`,
        "",
        "Tokens Results:",
        "No findings were produced by this scan.",
      ].join("\n")],
    ]);

    for (const line of layout.lines) {
      expect(line.x).toBeGreaterThanOrEqual(marginX);
      expect(line.x + line.width).toBeLessThanOrEqual(pageSize[0] - marginX);
      expect(line.y).toBeGreaterThanOrEqual(marginBottom);
      expect(line.y).toBeLessThanOrEqual(pageSize[1] - marginX + line.size);
    }
  });

  test("records every section heading with a monotonic start page", async () => {
    const fonts = await createFonts();
    const layout = layoutReport(fonts, sectionDefinitions.map(([heading]) => [heading, `${heading} body text.`] as [string, string]));

    expect(layout.sections.map(section => section.heading)).toEqual(sectionDefinitions.map(([heading]) => heading));

    layout.sections.forEach((section, index) => {
      expect(section.startPageIndex).toBeGreaterThanOrEqual(0);

      if (index > 0) {
        expect(section.startPageIndex).toBeGreaterThanOrEqual(layout.sections[index - 1].startPageIndex);
      }
    });
  });

  test("moves a section heading to the next page instead of orphaning it", async () => {
    const fonts = await createFonts();
    const fillLine = "alpha bravo charlie delta echo foxtrot golf hotel india juliett";
    const block = Array.from({ length: 37 }, () => fillLine).join("\n");

    const layout = layoutReport(fonts, [
      ["1. Introduction", block],
      ["2. Executive Summary", "one two three four five six"],
    ]);

    expect(layout.sections[1].startPageIndex).toBe(1);

    const headingLine = layout.lines.find(line => line.text === "2. Executive Summary");
    expect(headingLine).toBeDefined();

    const bodyLinesOnHeadingPage = layout.lines.filter(line => (
      line.pageIndex === headingLine?.pageIndex && line.kind === "body"
    ));

    expect(bodyLinesOnHeadingPage.length).toBeGreaterThan(0);
  });

  test("preserves blank-line paragraph breaks in the vertical rhythm", async () => {
    const fonts = await createFonts();
    const single = layoutReport(fonts, [["1. Introduction", "one two three four five six seven"]]);
    const spaced = layoutReport(fonts, [["1. Introduction", "one two three four five six seven\n\neight nine ten eleven twelve"]]);

    const lastLineOf = (layout: typeof single) => Math.min(...layout.lines.map(line => line.y));
    expect(lastLineOf(spaced)).toBeLessThan(lastLineOf(single));
  });
});
