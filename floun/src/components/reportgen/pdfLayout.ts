import { PDFFont } from "pdf-lib";

export interface PdfFontSet {
  regular: PDFFont;
  bold: PDFFont;
}

export type LayoutFont = keyof PdfFontSet;

export type LineColor = "primary" | "body" | "muted";

export type LineKind = "sectionHeading" | "subHeading" | "body";

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

export interface SectionLayoutInfo {
  heading: string;
  startPageIndex: number;
}

export interface ReportLayout {
  pageCount: number;
  lines: LayoutLine[];
  sections: SectionLayoutInfo[];
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
  ["8. Appendices", "appendix"],
];

const appendixGroupHeadingPattern = / Results:$/;

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
  sections: SectionLayoutInfo[];
}

function pushLine(state: LayoutState, line: Omit<LayoutLine, "pageIndex" | "x" | "y">): void {
  state.lines.push({
    pageIndex: state.pageIndex,
    x: marginX,
    y: state.cursorY,
    ...line,
  });
}

export function layoutReport(fonts: PdfFontSet, sectionTexts: Array<[string, string]>): ReportLayout {
  const state: LayoutState = {
    pageIndex: 0,
    cursorY: pageSize[1] - marginTop,
    lines: [],
    sections: [],
  };

  const bodyLineHeight = bodyFontSize * lineHeightFactor;
  const headingLineHeight = headingFontSize * lineHeightFactor;
  const paragraphGap = bodyLineHeight * paragraphGapFactor;

  const newPage = (): void => {
    state.pageIndex += 1;
    state.cursorY = pageSize[1] - marginTop;
  };

  const ensureSpace = (height: number): void => {
    if (state.cursorY - height < marginBottom) {
      newPage();
    }
  };

  sectionTexts.forEach(([heading, text]) => {
    ensureSpace(headingLineHeight + paragraphGap + bodyLineHeight * 2);
    state.sections.push({ heading, startPageIndex: state.pageIndex });
    pushLine(state, {
      width: fonts.bold.widthOfTextAtSize(heading, headingFontSize),
      size: headingFontSize,
      font: "bold",
      color: "primary",
      kind: "sectionHeading",
      text: heading,
    });
    state.cursorY -= headingLineHeight + paragraphGap;

    let pendingGap = 0;

    String(text).split("\n").forEach(rawLine => {
      if (rawLine.trim() === "") {
        pendingGap += paragraphGap;
        return;
      }

      const isSubHeading = appendixGroupHeadingPattern.test(rawLine);
      const font: LayoutFont = isSubHeading ? "bold" : "regular";
      const size = isSubHeading ? subHeadingFontSize : bodyFontSize;
      const wrappedLines = wrapLineToWidth(rawLine, fonts[font], size, contentWidth);

      state.cursorY -= pendingGap;
      pendingGap = 0;

      wrappedLines.forEach(wrappedLine => {
        ensureSpace(bodyLineHeight);
        pushLine(state, {
          width: fonts[font].widthOfTextAtSize(wrappedLine, size),
          size,
          font,
          color: isSubHeading ? "primary" : "body",
          kind: isSubHeading ? "subHeading" : "body",
          text: wrappedLine,
        });
        state.cursorY -= bodyLineHeight;
      });
    });

    state.cursorY -= sectionGap + pendingGap;
  });

  return {
    pageCount: state.pageIndex + 1,
    lines: state.lines,
    sections: state.sections,
  };
}
