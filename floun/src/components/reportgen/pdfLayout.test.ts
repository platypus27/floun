import { PDFDocument, StandardFonts } from "pdf-lib";
import {
  bodyFontSize,
  contentWidth,
  findingIndexColumns,
  layoutReport,
  marginBottom,
  marginX,
  pageSize,
  tableCellPadding,
  wrapLineToWidth,
  type PdfFontSet,
  type SectionPlan,
} from "./pdfLayout";

async function createFonts(): Promise<PdfFontSet> {
  const pdfDoc = await PDFDocument.create();

  return {
    regular: await pdfDoc.embedFont(StandardFonts.Helvetica),
    bold: await pdfDoc.embedFont(StandardFonts.HelveticaBold),
  };
}

function prosePlan(texts: string[]): SectionPlan[] {
  return texts.map((text, index) => ({
    heading: `${index + 1}. Section`,
    type: "prose",
    text,
  }));
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

  test("keeps a See-prefixed URL that fits on one line unbroken", async () => {
    const fonts = await createFonts();
    const longUrl = "https://example.com/very/deep/path?with=query&parameters=that&are=quite&long=indeed";
    const lines = wrapLineToWidth(`See ${longUrl}`, fonts.regular, bodyFontSize, contentWidth);

    expect(lines).toEqual([`See ${longUrl}`]);

    for (const line of lines) {
      expect(fonts.regular.widthOfTextAtSize(line, bodyFontSize)).toBeLessThanOrEqual(contentWidth);
    }
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

  test("fills lines by breaking after hyphens instead of dropping the word", async () => {
    const fonts = await createFonts();
    const text = "Review findings indicate migration-planning signals, while deprecated algorithms indicate higher-priority remediation risk.";
    const lines = wrapLineToWidth(text, fonts.regular, bodyFontSize, contentWidth);

    expect(lines[0].endsWith("higher-")).toBe(true);
    expect(lines[1].startsWith("priority remediation risk.")).toBe(true);

    for (const line of lines) {
      expect(fonts.regular.widthOfTextAtSize(line, bodyFontSize)).toBeLessThanOrEqual(contentWidth);
    }
  });
});

describe("layoutReport", () => {
  test("keeps every text line inside the page margins", async () => {
    const fonts = await createFonts();
    const longUrl = "https://example.com/" + "segment/".repeat(20);
    const layout = layoutReport(fonts, [
      { heading: "1. Introduction", type: "prose", text: "Short intro." },
      {
        heading: "2. Analysis", type: "analysis",
        intro: "Intro prose.",
        counts: { vulnerable: 1, review: 0, safe: 1, informational: 0 },
        findings: [
          {
            title: "Weak Crypto",
            severity: "Vulnerable",
            location: `inline script (inline) ${longUrl}`,
            confidence: "High",
            fields: [
              { label: "Rationale", value: `Weak because of ${longUrl}` },
              { label: "Recommendation", value: "Rotate keys." },
            ],
          },
        ],
      },
      {
        heading: "3. Appendices", type: "appendix",
        groups: [
          {
            heading: "Tokens Results:",
            entries: [
              {
                title: "Session token may be weak",
                extras: [{ label: "Details", value: `Failed checks: ${longUrl}` }],
              },
            ],
          },
        ],
      },
    ]);

    expectLayoutWithinMargins(layout);
  });

  test("records every planned section with a monotonic start page", async () => {
    const fonts = await createFonts();
    const layout = layoutReport(fonts, prosePlan(["one two three", "four five six", "seven eight nine"]));

    expect(layout.sections.map(section => section.heading)).toEqual(["1. Section", "2. Section", "3. Section"]);

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

    const layout = layoutReport(fonts, prosePlan([block, "one two three four five six"]));

    expect(layout.sections[1].startPageIndex).toBe(1);

    const headingLine = layout.lines.find(line => line.text === "2. Section");
    expect(headingLine).toBeDefined();

    const bodyLinesOnHeadingPage = layout.lines.filter(line => (
      line.pageIndex === headingLine?.pageIndex && line.kind === "body"
    ));

    expect(bodyLinesOnHeadingPage.length).toBeGreaterThan(0);
  });

  test("preserves blank-line paragraph breaks in the vertical rhythm", async () => {
    const fonts = await createFonts();
    const single = layoutReport(fonts, prosePlan(["one two three four five six seven"]));
    const spaced = layoutReport(fonts, prosePlan(["one two three four five six seven\n\neight nine ten eleven twelve"]));

    const lastLineOf = (layout: typeof single) => Math.min(...layout.lines.map(line => line.y));
    expect(lastLineOf(spaced)).toBeLessThan(lastLineOf(single));
  });

  test("repeats the table header when the index splits across a page", async () => {
    const fonts = await createFonts();
    const findings = Array.from({ length: 40 }, (_, index) => ({
      title: `Finding ${index} with a descriptive title`,
      severity: index % 3 === 0 ? "Vulnerable" : "Review",
      location: `https://example.com/assets/module-${index}/bundle.min.js`,
      confidence: "High",
      fields: [{ label: "Rationale", value: `Rationale ${index}` }],
    }));

    const layout = layoutReport(fonts, [
      {
        heading: "1. Analysis", type: "analysis",
        intro: "",
        counts: { vulnerable: 14, review: 26, safe: 0, informational: 0 },
        findings,
      },
    ]);

    const headerPages = new Set(
      layout.lines
        .filter(line => line.kind === "tableHeader" && line.text === "Confidence")
        .map(line => line.pageIndex)
    );

    expect(headerPages.size).toBeGreaterThanOrEqual(2);
  });

  test("keeps every table cell line inside its column minus padding", async () => {
    const fonts = await createFonts();
    const layout = layoutReport(fonts, [
      {
        heading: "1. Analysis", type: "analysis",
        intro: "",
        counts: { vulnerable: 1, review: 1, safe: 0, informational: 0 },
        findings: [
          {
            title: "A very long finding title that definitely wraps across multiple index cell lines",
            severity: "Vulnerable",
            location: `https://example.com/assets/a-rather-long-path/that/wraps?cachebust=${"abc123".repeat(8)}`,
            confidence: "High",
            fields: [{ label: "Rationale", value: "Rationale one." }],
          },
          {
            title: "Short",
            severity: "Review",
            location: "inline script (inline)",
            confidence: "",
            fields: [{ label: "Rationale", value: "Rationale two." }],
          },
        ],
      },
    ]);

    const columnStarts: number[] = [];
    let columnX = marginX;
    findingIndexColumns.forEach(column => {
      columnStarts.push(columnX);
      columnX += column.width;
    });

    const tableLines = layout.lines.filter(line => (
      (line.kind === "tableCell" || line.kind === "tableHeader") &&
      columnStarts.some(start => line.x === start + tableCellPadding)
    ));
    expect(tableLines.length).toBeGreaterThan(0);

    tableLines.forEach(line => {
      const columnIndex = columnStarts.findIndex(start => line.x === start + tableCellPadding);

      expect(columnIndex).toBeGreaterThanOrEqual(0);
      expect(line.x + line.width).toBeLessThanOrEqual(
        columnStarts[columnIndex] + findingIndexColumns[columnIndex].width - tableCellPadding
      );
    });
  });

  test("renders Not rated in muted text for findings without a confidence", async () => {
    const fonts = await createFonts();
    const layout = layoutReport(fonts, [
      {
        heading: "1. Analysis", type: "analysis",
        intro: "",
        counts: { vulnerable: 0, review: 1, safe: 0, informational: 1 },
        findings: [
          {
            title: "Rated finding",
            severity: "Review",
            location: "inline script (inline)",
            confidence: "Medium",
            fields: [],
          },
          {
            title: "Unrated finding",
            severity: "Info",
            location: "SSL Header",
            confidence: "",
            fields: [],
          },
        ],
      },
    ]);

    const notRated = layout.lines.find(line => line.kind === "tableCell" && line.text === "Not rated");
    expect(notRated).toBeDefined();
    expect(notRated?.color).toBe("muted");

    const rated = layout.lines.find(line => line.kind === "tableCell" && line.text === "Medium");
    expect(rated?.color).toBe("body");
  });

  test("keeps a finding title with at least its first three grid rows", async () => {
    const fonts = await createFonts();
    const fillLine = "alpha bravo charlie delta echo foxtrot golf hotel india juliett";
    const block = Array.from({ length: 33 }, () => fillLine).join("\n");

    const layout = layoutReport(fonts, [
      { heading: "1. Prose", type: "prose", text: block },
      {
        heading: "2. Analysis", type: "analysis",
        intro: "",
        counts: { vulnerable: 1, review: 0, safe: 0, informational: 0 },
        findings: [
          {
            title: "Lonely Finding",
            severity: "Vulnerable",
            location: "inline script (inline)",
            confidence: "High",
            fields: [
              { label: "Rationale", value: "Rationale one." },
              { label: "Limitations", value: "Limitations one." },
              { label: "Recommendation", value: "Recommendation one." },
            ],
          },
        ],
      },
    ]);

    const titleLine = layout.lines.find(line => line.text === "Lonely Finding");
    expect(titleLine).toBeDefined();

    const titlePage = titleLine?.pageIndex;
    const rowsOnPage = layout.lines.filter(line => (
      line.pageIndex === titlePage && (line.kind === "label" || line.kind === "value")
    ));

    expect(rowsOnPage.length).toBeGreaterThanOrEqual(3);
  });
});
