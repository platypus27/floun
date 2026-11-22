import { PDFFont } from "pdf-lib";

export interface PdfFontSet {
  regular: PDFFont;
  bold: PDFFont;
}

export type LayoutFont = keyof PdfFontSet;

export type LineColor =
  | "primary"
  | "body"
  | "muted"
  | "white"
  | "severityVulnerable"
  | "severityReview"
  | "severitySafe"
  | "severityInfo";

export type RectFill =
  | "zebra"
  | "rule"
  | "pillVulnerable"
  | "pillReview"
  | "pillSafe"
  | "pillInfo";

export type LineKind =
  | "sectionHeading"
  | "subHeading"
  | "body"
  | "label"
  | "value"
  | "findingTitle"
  | "findingLocation"
  | "tableHeader"
  | "tableCell"
  | "pill";

export interface LayoutLine {
  pageIndex: number;
  x: number;
  y: number;
  width: number;
  size: number;
  font: LayoutFont;
  color: LineColor;
  kind: LineKind;
  text: string;
}

export interface LayoutRect {
  pageIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
  fill: RectFill;
}

export interface SectionLayoutInfo {
  heading: string;
  startPageIndex: number;
}

export interface ReportLayout {
  pageCount: number;
  lines: LayoutLine[];
  rects: LayoutRect[];
  sections: SectionLayoutInfo[];
}

export interface FieldSpec {
  label: string;
  value: string;
}

export interface FindingBlockSpec {
  title: string;
  severity: string;
  location?: string;
  confidence?: string;
  fields: FieldSpec[];
}

export interface AppendixGroupSpec {
  heading: string;
  entries: Array<{ title: string; extras: FieldSpec[] }>;
}

export interface StatusCountSpec {
  vulnerable: number;
  review: number;
  safe: number;
  informational: number;
}

export type SectionPlan =
  | { heading: string; type: "prose"; text: string }
  | {
      heading: string;
      type: "analysis";
      intro: string;
      counts: StatusCountSpec;
      findings: FindingBlockSpec[];
    }
  | { heading: string; type: "appendix"; groups: AppendixGroupSpec[] };

export interface TableColumn {
  header: string;
  width: number;
}

export const pageSize: [number, number] = [600, 800];
export const marginX = 50;
export const marginTop = 56;
export const marginBottom = 64;
export const contentWidth = pageSize[0] - marginX * 2;

export const bodyFontSize = 11;
export const headingFontSize = 16;
export const subHeadingFontSize = 12;

export const lineHeightFactor = 1.45;
export const paragraphGapFactor = 0.55;
export const sectionGap = 10;

export const sectionDefinitions: Array<[string, string]> = [
  ["1. Introduction", "introduction"],
  ["2. Executive Summary", "executiveSummary"],
  ["3. Readiness Analysis", "vulnerabilityAnalysis"],
  ["4. Risk Assessment", "riskAssessment"],
  ["5. Recommendations", "recommendations"],
  ["6. Next Steps", "nextStep"],
  ["7. Conclusion", "conclusion"],
];

const severityOrder = ["Vulnerable", "Review", "Safe", "Info"];

const severityMeta: Record<string, { color: LineColor; pillFill: RectFill }> = {
  Vulnerable: { color: "severityVulnerable", pillFill: "pillVulnerable" },
  Review: { color: "severityReview", pillFill: "pillReview" },
  Safe: { color: "severitySafe", pillFill: "pillSafe" },
  Info: { color: "severityInfo", pillFill: "pillInfo" },
};

const tableFontSize = 9.5;
const tableLineHeight = 12.5;
const tableCellPadding = 4;
const smallLineFactor = 1.35;

const findingTitleSize = 11.5;
const findingGridLabelWidth = 100;
const findingGridIndent = 12;
const pillHeight = 12;
const pillTextSize = 8;
const blockRuleGap = 6;

const preferredBreakCharacters = new Set(["/", "-", ".", "?", "&", "=", "_", "+", ":", "#", "%", "~"]);

function findPreferredBreak(chunk: string, minimumIndex: number): number {
  for (let index = chunk.length - 1; index >= minimumIndex; index -= 1) {
    if (preferredBreakCharacters.has(chunk[index])) {
      return index + 1;
    }
  }

  return -1;
}

function breakLongWord(word: string, font: PDFFont, fontSize: number, maxWidth: number): string[] {
  const chunks: string[] = [];
  let chunk = "";

  for (const character of word) {
    if (chunk && font.widthOfTextAtSize(chunk + character, fontSize) > maxWidth) {
      const minimumIndex = Math.max(0, Math.floor(chunk.length * 0.4) - 1);
      const breakAt = findPreferredBreak(chunk, minimumIndex);

      if (breakAt > 0 && breakAt < chunk.length) {
        chunks.push(chunk.slice(0, breakAt));
        chunk = chunk.slice(breakAt) + character;
      } else {
        chunks.push(chunk);
        chunk = character;
      }
    } else {
      chunk += character;
    }
  }

  if (chunk) {
    chunks.push(chunk);
  }

  return chunks;
}

function splitToBudget(
  word: string,
  font: PDFFont,
  fontSize: number,
  budget: number
): { head: string; rest: string } {
  let cut = 0;

  for (let index = 1; index <= word.length; index += 1) {
    if (font.widthOfTextAtSize(word.slice(0, index), fontSize) <= budget) {
      cut = index;
    } else {
      break;
    }
  }

  if (cut === 0) {
    return { head: "", rest: word };
  }

  const minimumIndex = Math.max(0, Math.floor(cut * 0.4) - 1);
  const breakAt = findPreferredBreak(word.slice(0, cut), minimumIndex);

  if (breakAt > 0) {
    return { head: word.slice(0, breakAt), rest: word.slice(breakAt) };
  }

  return { head: word.slice(0, cut), rest: word.slice(cut) };
}

function hyphenHead(
  word: string,
  budget: number,
  font: PDFFont,
  fontSize: number
): string | null {
  if (budget <= 0) {
    return null;
  }

  let head: string | null = null;

  for (let index = 3; index <= word.length - 4; index += 1) {
    if (word[index] !== "-") {
      continue;
    }

    const candidate = word.slice(0, index + 1);

    if (font.widthOfTextAtSize(candidate, fontSize) <= budget) {
      head = candidate;
    } else {
      break;
    }
  }

  return head;
}

export function wrapLineToWidth(
  text: string,
  font: PDFFont,
  fontSize: number,
  maxWidth: number
): string[] {
  const spaceWidth = font.widthOfTextAtSize(" ", fontSize);
  const words = text.split(" ").filter(Boolean);
  const lines: string[] = [];
  let currentLine = "";

  const pushCurrentLine = (): void => {
    if (currentLine) {
      lines.push(currentLine);
      currentLine = "";
    }
  };

  for (let word of words) {
    const candidate = currentLine ? `${currentLine} ${word}` : word;

    if (font.widthOfTextAtSize(candidate, fontSize) <= maxWidth) {
      currentLine = candidate;
      continue;
    }

    if (font.widthOfTextAtSize(word, fontSize) <= maxWidth) {
      if (currentLine) {
        const spaceLeft = maxWidth - font.widthOfTextAtSize(currentLine, fontSize) - spaceWidth;
        const head = hyphenHead(word, spaceLeft, font, fontSize);

        if (head) {
          lines.push(`${currentLine} ${head}`);
          currentLine = "";
          word = word.slice(head.length);
        }
      }

      pushCurrentLine();
      currentLine = word;
      continue;
    }

    if (currentLine) {
      const budget = maxWidth - font.widthOfTextAtSize(currentLine, fontSize) - spaceWidth;
      const { head, rest } = splitToBudget(word, font, fontSize, budget);

      if (head) {
        lines.push(`${currentLine} ${head}`);
        word = rest;
      } else {
        pushCurrentLine();
      }
    }

    const chunks = breakLongWord(word, font, fontSize, maxWidth);
    lines.push(...chunks.slice(0, -1));
    currentLine = chunks.length ? chunks[chunks.length - 1] : "";
  }

  pushCurrentLine();

  return lines;
}

interface LayoutState {
  pageIndex: number;
  cursorY: number;
  lines: LayoutLine[];
  rects: LayoutRect[];
  sections: SectionLayoutInfo[];
}

function pushLine(state: LayoutState, line: Omit<LayoutLine, "pageIndex">): void {
  state.lines.push({
    pageIndex: state.pageIndex,
    ...line,
  });
}

function pushRect(state: LayoutState, rect: Omit<LayoutRect, "pageIndex">): void {
  state.rects.push({ pageIndex: state.pageIndex, ...rect });
}

function createState(): LayoutState {
  return {
    pageIndex: 0,
    cursorY: pageSize[1] - marginTop,
    lines: [],
    rects: [],
    sections: [],
  };
}

function smallLineHeight(size: number): number {
  return size * smallLineFactor;
}

function layoutProse(state: LayoutState, fonts: PdfFontSet, text: string): void {
  const bodyLineHeight = bodyFontSize * lineHeightFactor;
  const paragraphGap = bodyLineHeight * paragraphGapFactor;
  let pendingGap = 0;

  String(text).split("\n").forEach(rawLine => {
    if (rawLine.trim() === "") {
      pendingGap += paragraphGap;
      return;
    }

    const wrappedLines = wrapLineToWidth(rawLine, fonts.regular, bodyFontSize, contentWidth);

    state.cursorY -= pendingGap;
    pendingGap = 0;

    wrappedLines.forEach(wrappedLine => {
      if (state.cursorY - bodyLineHeight < marginBottom) {
        state.pageIndex += 1;
        state.cursorY = pageSize[1] - marginTop;
      }

      pushLine(state, {
        x: marginX,
        y: state.cursorY - bodyFontSize,
        width: fonts.regular.widthOfTextAtSize(wrappedLine, bodyFontSize),
        size: bodyFontSize,
        font: "regular",
        color: "body",
        kind: "body",
        text: wrappedLine,
      });
      state.cursorY -= bodyLineHeight;
    });
  });
}

function layoutSectionHeading(state: LayoutState, fonts: PdfFontSet, heading: string): void {
  const bodyLineHeight = bodyFontSize * lineHeightFactor;
  const headingLineHeight = headingFontSize * lineHeightFactor;
  const paragraphGap = bodyLineHeight * paragraphGapFactor;

  if (state.cursorY - (headingLineHeight + paragraphGap + bodyLineHeight * 2) < marginBottom) {
    state.pageIndex += 1;
    state.cursorY = pageSize[1] - marginTop;
  }

  state.sections.push({ heading, startPageIndex: state.pageIndex });
  pushLine(state, {
    x: marginX,
    y: state.cursorY - headingFontSize,
    width: fonts.bold.widthOfTextAtSize(heading, headingFontSize),
    size: headingFontSize,
    font: "bold",
    color: "primary",
    kind: "sectionHeading",
    text: heading,
  });
  state.cursorY -= headingLineHeight + paragraphGap;
}

function layoutSubHeading(state: LayoutState, fonts: PdfFontSet, text: string): void {
  const lineHeight = smallLineHeight(subHeadingFontSize);

  if (state.cursorY - lineHeight < marginBottom) {
    state.pageIndex += 1;
    state.cursorY = pageSize[1] - marginTop;
  }

  pushLine(state, {
    x: marginX,
    y: state.cursorY - subHeadingFontSize,
    width: fonts.bold.widthOfTextAtSize(text, subHeadingFontSize),
    size: subHeadingFontSize,
    font: "bold",
    color: "primary",
    kind: "subHeading",
    text,
  });
  state.cursorY -= lineHeight + 4;
}

function wrapCell(text: string, font: PDFFont, width: number): string[] {
  return wrapLineToWidth(text, font, tableFontSize, Math.max(width, tableFontSize * 2));
}

function layoutTable(
  state: LayoutState,
  fonts: PdfFontSet,
  columns: TableColumn[],
  rows: string[][],
  options: { zebra?: boolean; cellColor?: (rowIndex: number, columnIndex: number) => LineColor } = {}
): void {
  if (!rows.length) {
    return;
  }

  const columnXs: number[] = [];
  let columnX = marginX;
  columns.forEach(column => {
    columnXs.push(columnX);
    columnX += column.width;
  });

  const headerLines = columns.map(column => wrapCell(column.header, fonts.bold, column.width));
  const headerHeight = Math.max(...headerLines.map(lines => lines.length)) * tableLineHeight + tableCellPadding * 2;

  const emitHeader = (): void => {
    pushRect(state, {
      x: marginX,
      y: state.cursorY - headerHeight,
      width: contentWidth,
      height: 1,
      fill: "rule",
    });

    headerLines.forEach((lines, columnIndex) => {
      lines.forEach((line, lineIndex) => {
        pushLine(state, {
          x: columnXs[columnIndex] + tableCellPadding,
          y: state.cursorY - tableCellPadding - tableFontSize - lineIndex * tableLineHeight,
          width: fonts.bold.widthOfTextAtSize(line, tableFontSize),
          size: tableFontSize,
          font: "bold",
          color: "primary",
          kind: "tableHeader",
          text: line,
        });
      });
    });

    state.cursorY -= headerHeight;
  };

  if (state.cursorY - headerHeight < marginBottom) {
    state.pageIndex += 1;
    state.cursorY = pageSize[1] - marginTop;
  }
  emitHeader();

  rows.forEach((row, rowIndex) => {
    const cellLines = row.map((cell, columnIndex) => wrapCell(cell, fonts.regular, columns[columnIndex].width));
    const rowHeight = Math.max(...cellLines.map(lines => lines.length)) * tableLineHeight + tableCellPadding * 2;

    if (state.cursorY - rowHeight < marginBottom) {
      state.pageIndex += 1;
      state.cursorY = pageSize[1] - marginTop;
      emitHeader();
    }

    if (options.zebra && rowIndex % 2 === 1) {
      pushRect(state, {
        x: marginX,
        y: state.cursorY - rowHeight,
        width: contentWidth,
        height: rowHeight,
        fill: "zebra",
      });
    }

    cellLines.forEach((lines, columnIndex) => {
      const color = options.cellColor?.(rowIndex, columnIndex) || "body";

      lines.forEach((line, lineIndex) => {
        pushLine(state, {
          x: columnXs[columnIndex] + tableCellPadding,
          y: state.cursorY - tableCellPadding - tableFontSize - lineIndex * tableLineHeight,
          width: fonts.regular.widthOfTextAtSize(line, tableFontSize),
          size: tableFontSize,
          font: "regular",
          color,
          kind: "tableCell",
          text: line,
        });
      });
    });

    state.cursorY -= rowHeight;
  });

  pushRect(state, {
    x: marginX,
    y: state.cursorY,
    width: contentWidth,
    height: 1,
    fill: "rule",
  });
  state.cursorY -= sectionGap;
}

function layoutFieldGrid(
  state: LayoutState,
  fonts: PdfFontSet,
  fields: FieldSpec[],
  labelWidth: number,
  indent: number
): void {
  const labelX = marginX + indent;
  const valueX = labelX + labelWidth + 10;
  const valueWidth = pageSize[0] - marginX - valueX;
  const lineHeight = smallLineHeight(tableFontSize);

  fields.forEach(field => {
    const valueLines = wrapLineToWidth(field.value, fonts.regular, tableFontSize, Math.max(valueWidth, tableFontSize * 2));
    const rowHeight = Math.max(valueLines.length, 1) * lineHeight + 3;

    if (state.cursorY - rowHeight < marginBottom) {
      state.pageIndex += 1;
      state.cursorY = pageSize[1] - marginTop;
    }

    pushLine(state, {
      x: labelX,
      y: state.cursorY - tableFontSize,
      width: fonts.bold.widthOfTextAtSize(field.label, tableFontSize),
      size: tableFontSize,
      font: "bold",
      color: "muted",
      kind: "label",
      text: field.label,
    });

    valueLines.forEach((line, lineIndex) => {
      pushLine(state, {
        x: valueX,
        y: state.cursorY - tableFontSize - lineIndex * lineHeight,
        width: fonts.regular.widthOfTextAtSize(line, tableFontSize),
        size: tableFontSize,
        font: "regular",
        color: "body",
        kind: "value",
        text: line,
      });
    });

    state.cursorY -= rowHeight;
  });
}

function measureFieldGridHeight(fonts: PdfFontSet, fields: FieldSpec[], count: number): number {
  const valueX = marginX + findingGridIndent + findingGridLabelWidth + 10;
  const valueWidth = pageSize[0] - marginX - valueX;
  const lineHeight = smallLineHeight(tableFontSize);

  return fields.slice(0, count).reduce((height, field) => {
    const valueLines = wrapLineToWidth(field.value, fonts.regular, tableFontSize, Math.max(valueWidth, tableFontSize * 2));
    return height + Math.max(valueLines.length, 1) * lineHeight + 3;
  }, 0);
}

function layoutFindingBlock(
  state: LayoutState,
  fonts: PdfFontSet,
  finding: FindingBlockSpec,
  index: number,
  total: number
): void {
  const titleLineHeight = smallLineHeight(findingTitleSize);
  const locationLineHeight = smallLineHeight(tableFontSize);
  const meta = severityMeta[finding.severity] || severityMeta.Info;
  const locationLines = finding.location
    ? wrapLineToWidth(finding.location, fonts.regular, tableFontSize, contentWidth)
    : [];
  const firstRowsHeight = measureFieldGridHeight(fonts, finding.fields, 3);
  const keepHeight =
    titleLineHeight +
    (locationLines.length ? locationLines.length * locationLineHeight + 4 : 0) +
    firstRowsHeight +
    8;

  if (state.cursorY - keepHeight < marginBottom) {
    state.pageIndex += 1;
    state.cursorY = pageSize[1] - marginTop;
  }

  const titleWidth = fonts.bold.widthOfTextAtSize(finding.title, findingTitleSize);
  pushLine(state, {
    x: marginX,
    y: state.cursorY - findingTitleSize,
    width: titleWidth,
    size: findingTitleSize,
    font: "bold",
    color: "body",
    kind: "findingTitle",
    text: finding.title,
  });

  const severityLabel = finding.severity;
  const pillWidth = fonts.bold.widthOfTextAtSize(severityLabel, pillTextSize) + 12;
  const pillX = marginX + titleWidth + 8;
  pushRect(state, {
    x: pillX,
    y: state.cursorY - findingTitleSize - 2,
    width: pillWidth,
    height: pillHeight,
    fill: meta.pillFill,
  });
  pushLine(state, {
    x: pillX + 6,
    y: state.cursorY - findingTitleSize + 1.5,
    width: fonts.bold.widthOfTextAtSize(severityLabel, pillTextSize),
    size: pillTextSize,
    font: "bold",
    color: "white",
    kind: "pill",
    text: severityLabel,
  });
  state.cursorY -= titleLineHeight + 3;

  locationLines.forEach(line => {
    pushLine(state, {
      x: marginX,
      y: state.cursorY - tableFontSize,
      width: fonts.regular.widthOfTextAtSize(line, tableFontSize),
      size: tableFontSize,
      font: "regular",
      color: "muted",
      kind: "findingLocation",
      text: line,
    });
    state.cursorY -= locationLineHeight;
  });

  if (locationLines.length) {
    state.cursorY -= 4;
  }

  layoutFieldGrid(state, fonts, finding.fields, findingGridLabelWidth, findingGridIndent);

  if (index < total - 1) {
    state.cursorY -= blockRuleGap;
    pushRect(state, {
      x: marginX,
      y: state.cursorY,
      width: contentWidth,
      height: 0.75,
      fill: "rule",
    });
    state.cursorY -= blockRuleGap;
  }
}

function layoutAnalysisSection(state: LayoutState, fonts: PdfFontSet, plan: Extract<SectionPlan, { type: "analysis" }>): void {
  layoutProse(state, fonts, plan.intro);

  const countsColumns: TableColumn[] = severityOrder.map(severity => ({
    header: severity,
    width: contentWidth / severityOrder.length,
  }));
  const countsRow = [
    String(plan.counts.vulnerable),
    String(plan.counts.review),
    String(plan.counts.safe),
    String(plan.counts.informational),
  ];
  layoutTable(state, fonts, countsColumns, [countsRow], {
    cellColor: (_rowIndex, columnIndex) => severityMeta[severityOrder[columnIndex]].color,
  });

  if (!plan.findings.length) {
    return;
  }

  const indexColumns: TableColumn[] = [
    { header: "Title", width: 150 },
    { header: "Status", width: 72 },
    { header: "Location", width: 184 },
    { header: "Confidence", width: 94 },
  ];
  const indexRows = plan.findings.map(finding => [
    finding.title,
    finding.severity,
    finding.location || "",
    finding.confidence || "",
  ]);
  layoutTable(state, fonts, indexColumns, indexRows, {
    zebra: true,
    cellColor: (rowIndex, columnIndex) => (
      columnIndex === 1 ? severityMeta[plan.findings[rowIndex].severity]?.color || "body" : "body"
    ),
  });

  plan.findings.forEach((finding, index) => {
    layoutFindingBlock(state, fonts, finding, index, plan.findings.length);
  });
}

function layoutAppendixSection(state: LayoutState, fonts: PdfFontSet, plan: Extract<SectionPlan, { type: "appendix" }>): void {
  const entryTitleSize = 10.5;
  const entryTitleLineHeight = smallLineHeight(entryTitleSize);

  plan.groups.forEach(group => {
    layoutSubHeading(state, fonts, group.heading);

    group.entries.forEach(entry => {
      if (state.cursorY - entryTitleLineHeight < marginBottom) {
        state.pageIndex += 1;
        state.cursorY = pageSize[1] - marginTop;
      }

      pushLine(state, {
        x: marginX,
        y: state.cursorY - entryTitleSize,
        width: fonts.bold.widthOfTextAtSize(entry.title, entryTitleSize),
        size: entryTitleSize,
        font: "bold",
        color: "body",
        kind: "findingTitle",
        text: entry.title,
      });
      state.cursorY -= entryTitleLineHeight + 2;

      layoutFieldGrid(state, fonts, entry.extras, 90, 10);
      state.cursorY -= 6;
    });
  });
}

export function layoutReport(fonts: PdfFontSet, plan: SectionPlan[]): ReportLayout {
  const state = createState();

  plan.forEach(section => {
    layoutSectionHeading(state, fonts, section.heading);

    if (section.type === "prose") {
      layoutProse(state, fonts, section.text);
    } else if (section.type === "analysis") {
      layoutAnalysisSection(state, fonts, section);
    } else {
      layoutAppendixSection(state, fonts, section);
    }

    state.cursorY -= sectionGap;
  });

  return {
    pageCount: state.pageIndex + 1,
    lines: state.lines,
    rects: state.rects,
    sections: state.sections,
  };
}
