import { PDFDocument, PDFPage, RGB, StandardFonts, rgb } from "pdf-lib";
import { saveAs } from "file-saver";
import type { ReportContent } from "./reportDocument";
import {
  contentWidth,
  layoutReport,
  marginBottom,
  marginX,
  marginTop,
  pageSize,
  sectionDefinitions,
  wrapLineToWidth,
  type PdfFontSet,
  type ReportLayout,
} from "./pdfLayout";

interface CoverDetails {
  title: string;
  subtitle: string;
  logoBase64?: string;
  date: string;
  confidentialityNotice?: string;
}

interface ChromeRuntimeAssetApi {
  runtime?: {
    getURL?: (assetPath: string) => string;
  };
}

const defaultReportLogoAssetPath = "icons/icon_128.png";

const reportColors: Record<string, RGB> = {
  primary: rgb(15 / 255, 106 / 255, 108 / 255),
  body: rgb(34 / 255, 66 / 255, 58 / 255),
  muted: rgb(76 / 255, 106 / 255, 96 / 255),
};

const ruleColor = rgb(238 / 255, 226 / 255, 200 / 255);
const footerFontSize = 9;
const footerRuleY = marginBottom - 18;

export async function generatePDFReport(
  coverDetails: CoverDetails,
  content: ReportContent
): Promise<void> {
  const pdfDoc = await PDFDocument.create();
  const fonts: PdfFontSet = {
    regular: await pdfDoc.embedFont(StandardFonts.Helvetica),
    bold: await pdfDoc.embedFont(StandardFonts.HelveticaBold),
  };

  const sectionTexts = sectionDefinitions.map(([heading, key]) => [
    heading,
    String(content[key as keyof ReportContent]),
  ] as [string, string]);
  const layout = layoutReport(fonts, sectionTexts);

  const contentPages: PDFPage[] = [];
  for (let pageIndex = 0; pageIndex < layout.pageCount; pageIndex += 1) {
    contentPages.push(pdfDoc.addPage(pageSize));
  }
  drawLayout(contentPages, layout, fonts);

  const coverPage = pdfDoc.insertPage(0, pageSize);
  await drawCoverPage(pdfDoc, coverPage, coverDetails, layout, fonts);

  stampFooters(pdfDoc, fonts);

  const pdfBytes = await pdfDoc.save();
  const pdfBlobPart = pdfBytes.buffer.slice(
    pdfBytes.byteOffset,
    pdfBytes.byteOffset + pdfBytes.byteLength
  ) as ArrayBuffer;
  const blob = new Blob([pdfBlobPart], { type: "application/pdf" });
  saveAs(blob, "Quantum_Safe_Cryptography_Report.pdf");
}

function drawLayout(pages: PDFPage[], layout: ReportLayout, fonts: PdfFontSet): void {
  layout.lines.forEach(line => {
    pages[line.pageIndex].drawText(line.text, {
      x: line.x,
      y: line.y,
      size: line.size,
      font: fonts[line.font],
      color: reportColors[line.color],
    });
  });
}

async function drawCoverPage(
  pdfDoc: PDFDocument,
  page: PDFPage,
  coverDetails: CoverDetails,
  layout: ReportLayout,
  fonts: PdfFontSet
): Promise<void> {
  let cursorY = page.getHeight() - marginTop;

  const rawLogoData = coverDetails.logoBase64 || await loadDefaultLogoBase64();
  const logoImage = await embedLogo(pdfDoc, rawLogoData);

  if (logoImage) {
    const logoWidth = 120;
    const logoDims = logoImage.scale(logoWidth / logoImage.width);
    page.drawImage(logoImage, {
      x: marginX,
      y: cursorY - logoDims.height,
      width: logoDims.width,
      height: logoDims.height,
    });
    cursorY -= logoDims.height + 32;
  } else {
    cursorY -= 8;
  }

  cursorY = drawCoverText(page, coverDetails.title, {
    fonts,
    cursorY,
    size: 22,
    font: "bold",
    color: reportColors.primary,
    gapAfter: 8,
  });

  cursorY = drawCoverText(page, coverDetails.subtitle, {
    fonts,
    cursorY,
    size: 13,
    font: "regular",
    color: reportColors.body,
    gapAfter: 20,
  });

  page.drawLine({
    start: { x: marginX, y: cursorY },
    end: { x: page.getWidth() - marginX, y: cursorY },
    thickness: 1,
    color: ruleColor,
  });
  cursorY -= 22;

  cursorY = drawCoverText(page, `Date: ${coverDetails.date}`, {
    fonts,
    cursorY,
    size: 11,
    font: "regular",
    color: reportColors.body,
    gapAfter: 6,
  });

  if (coverDetails.confidentialityNotice) {
    cursorY = drawCoverText(page, coverDetails.confidentialityNotice, {
      fonts,
      cursorY,
      size: 11,
      font: "bold",
      color: reportColors.body,
      gapAfter: 28,
    });
  } else {
    cursorY -= 28;
  }

  cursorY = drawCoverText(page, "Table of Contents", {
    fonts,
    cursorY,
    size: 15,
    font: "bold",
    color: reportColors.primary,
    gapAfter: 12,
  });

  sectionDefinitions.forEach(([heading], index) => {
    const pageNumber = layout.sections[index].startPageIndex + 2;
    const numberLabel = String(pageNumber);
    const labelWidth = fonts.regular.widthOfTextAtSize(heading, 11);
    const numberWidth = fonts.regular.widthOfTextAtSize(numberLabel, 11);

    page.drawText(heading, {
      x: marginX,
      y: cursorY,
      size: 11,
      font: fonts.regular,
      color: reportColors.body,
    });
    page.drawText(numberLabel, {
      x: page.getWidth() - marginX - numberWidth,
      y: cursorY,
      size: 11,
      font: fonts.regular,
      color: reportColors.body,
    });

    let dotsX = marginX + labelWidth + 8;
    const dotsEndX = page.getWidth() - marginX - numberWidth - 8;
    const dotAdvance = fonts.regular.widthOfTextAtSize(".", 11) * 2;

    while (dotsX < dotsEndX) {
      page.drawText(".", {
        x: dotsX,
        y: cursorY,
        size: 11,
        font: fonts.regular,
        color: ruleColor,
      });
      dotsX += dotAdvance;
    }

    cursorY -= 18;
  });
}

function drawCoverText(
  page: PDFPage,
  text: string,
  options: {
    fonts: PdfFontSet;
    cursorY: number;
    size: number;
    font: keyof PdfFontSet;
    color: RGB;
    gapAfter: number;
  }
): number {
  const lines = wrapLineToWidth(text, options.fonts[options.font], options.size, contentWidth);
  const lineHeight = options.size * 1.4;
  let cursorY = options.cursorY;

  lines.forEach(line => {
    page.drawText(line, {
      x: marginX,
      y: cursorY,
      size: options.size,
      font: options.fonts[options.font],
      color: options.color,
    });
    cursorY -= lineHeight;
  });

  return cursorY - options.gapAfter;
}

function stampFooters(pdfDoc: PDFDocument, fonts: PdfFontSet): void {
  const pages = pdfDoc.getPages();
  const total = pages.length;

  pages.forEach((page, index) => {
    if (index === 0) {
      return;
    }

    const pageLabel = `Page ${index + 1} of ${total}`;
    const pageLabelWidth = fonts.regular.widthOfTextAtSize(pageLabel, footerFontSize);

    page.drawLine({
      start: { x: marginX, y: footerRuleY },
      end: { x: page.getWidth() - marginX, y: footerRuleY },
      thickness: 1,
      color: ruleColor,
    });
    page.drawText("Quantum Safe Cryptography Report", {
      x: marginX,
      y: footerRuleY - 14,
      size: footerFontSize,
      font: fonts.regular,
      color: reportColors.muted,
    });
    page.drawText(pageLabel, {
      x: page.getWidth() - marginX - pageLabelWidth,
      y: footerRuleY - 14,
      size: footerFontSize,
      font: fonts.regular,
      color: reportColors.muted,
    });
  });
}

async function loadDefaultLogoBase64(): Promise<string | null> {
  try {
    const response = await fetch(resolveDefaultReportLogoAssetUrl());

    if (!response.ok) {
      return null;
    }

    return blobToDataUrl(await response.blob());
  } catch {
    return null;
  }
}

export function resolveDefaultReportLogoAssetUrl(
  chromeApi?: ChromeRuntimeAssetApi
): string {
  return resolveReportAssetUrl(defaultReportLogoAssetPath, chromeApi);
}

export function resolveReportAssetUrl(
  assetPath: string,
  chromeApi: ChromeRuntimeAssetApi | undefined = (globalThis as typeof globalThis & {
    chrome?: ChromeRuntimeAssetApi;
  }).chrome
): string {
  try {
    const resolvedUrl = chromeApi?.runtime?.getURL?.(assetPath);
    return resolvedUrl || assetPath;
  } catch {
    return assetPath;
  }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      resolve(typeof reader.result === "string" ? reader.result : "");
    };
    reader.onerror = () => reject(reader.error || new Error("Logo conversion failed."));
    reader.readAsDataURL(blob);
  });
}

async function embedLogo(pdfDoc: PDFDocument, rawLogoData: string | null) {
  try {
    if (!rawLogoData) {
      return null;
    }

    if (rawLogoData.startsWith("data:image/png;base64,")) {
      return await pdfDoc.embedPng(rawLogoData.split(",")[1]);
    }

    if (rawLogoData.startsWith("data:image/jpeg;base64,")) {
      return await pdfDoc.embedJpg(rawLogoData.split(",")[1]);
    }

    return null;
  } catch {
    return null;
  }
}
