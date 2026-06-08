import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from "pdf-lib";
import { saveAs } from "file-saver";
import type { ReportContent } from "./reportDocument";

interface CoverDetails {
  title: string;
  subtitle: string;
  logoBase64?: string;
  date: string;
  confidentialityNotice?: string;
}

interface PdfFonts {
  regular: PDFFont;
  bold: PDFFont;
}

interface ChromeRuntimeAssetApi {
  runtime?: {
    getURL?: (assetPath: string) => string;
  };
}

const pageSize: [number, number] = [600, 800];
const margin = 50;
const bodyFontSize = 12;

const sectionDefinitions: Array<[string, keyof ReportContent]> = [
  ["1. Introduction", "introduction"],
  ["2. Executive Summary", "executiveSummary"],
  ["3. Readiness Analysis", "vulnerabilityAnalysis"],
  ["4. Risk Assessment", "riskAssessment"],
  ["5. Recommendations", "recommendations"],
  ["6. Next Steps", "nextStep"],
  ["7. Conclusion", "conclusion"],
  ["8. Appendices", "appendix"],
];

export async function generatePDFReport(
  coverDetails: CoverDetails,
  content: ReportContent
): Promise<void> {
  const pdfDoc = await PDFDocument.create();
  const fonts = {
    regular: await pdfDoc.embedFont(StandardFonts.Helvetica),
    bold: await pdfDoc.embedFont(StandardFonts.HelveticaBold),
  };

  const coverPage = pdfDoc.addPage(pageSize);
  await drawCoverPage(pdfDoc, coverPage, coverDetails, fonts);

  sectionDefinitions.forEach(([heading, key]) => {
    addSection(pdfDoc, heading, String(content[key]), fonts);
  });

  const pdfBytes = await pdfDoc.save();
  const pdfBlobPart = pdfBytes.buffer.slice(
    pdfBytes.byteOffset,
    pdfBytes.byteOffset + pdfBytes.byteLength
  ) as ArrayBuffer;
  const blob = new Blob([pdfBlobPart], { type: "application/pdf" });
  saveAs(blob, "Quantum_Safe_Cryptography_Report.pdf");
}

async function drawCoverPage(
  pdfDoc: PDFDocument,
  page: PDFPage,
  coverDetails: CoverDetails,
  fonts: PdfFonts
): Promise<void> {
  const rawLogoData = coverDetails.logoBase64 || await loadDefaultLogoBase64();
  const logoImage = await embedLogo(pdfDoc, rawLogoData);

  if (logoImage) {
    const logoDims = logoImage.scale(200 / logoImage.width);
    page.drawImage(logoImage, {
      x: margin,
      y: page.getHeight() - logoDims.height - margin,
      width: logoDims.width,
      height: logoDims.height,
    });
  }

  page.drawText(coverDetails.title, {
    x: margin,
    y: page.getHeight() - 200,
    size: 24,
    font: fonts.bold,
    color: rgb(0, 0, 0),
  });
  page.drawText(coverDetails.subtitle, {
    x: margin,
    y: page.getHeight() - 230,
    size: 18,
    font: fonts.regular,
    color: rgb(0, 0, 0),
  });
  page.drawText(`Date: ${coverDetails.date}`, {
    x: margin,
    y: page.getHeight() - 270,
    size: bodyFontSize,
    font: fonts.regular,
    color: rgb(0, 0, 0),
  });

  if (coverDetails.confidentialityNotice) {
    page.drawText(coverDetails.confidentialityNotice, {
      x: margin,
      y: page.getHeight() - 295,
      size: bodyFontSize,
      font: fonts.bold,
      color: rgb(0, 0, 0),
    });
  }

  page.drawText("Table of Contents", {
    x: margin,
    y: page.getHeight() - 350,
    size: 18,
    font: fonts.bold,
    color: rgb(0, 0, 0),
  });

  sectionDefinitions.forEach(([heading], index) => {
    page.drawText(heading, {
      x: margin,
      y: page.getHeight() - 380 - index * 20,
      size: bodyFontSize,
      font: fonts.regular,
      color: rgb(0, 0, 0),
    });
  });
}

async function loadDefaultLogoBase64(): Promise<string | null> {
  try {
    const response = await fetch(resolveReportAssetUrl("icons/floun.png"));

    if (!response.ok) {
      return null;
    }

    return blobToDataUrl(await response.blob());
  } catch {
    return null;
  }
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
  if (!rawLogoData) {
    return null;
  }

  if (rawLogoData.startsWith("data:image/png;base64,")) {
    return pdfDoc.embedPng(rawLogoData.split(",")[1]);
  }

  if (rawLogoData.startsWith("data:image/jpeg;base64,")) {
    return pdfDoc.embedJpg(rawLogoData.split(",")[1]);
  }

  return null;
}

function addSection(pdfDoc: PDFDocument, heading: string, text: string, fonts: PdfFonts): void {
  const page = pdfDoc.addPage(pageSize);
  page.drawText(heading, {
    x: margin,
    y: page.getHeight() - margin,
    size: 18,
    font: fonts.bold,
    color: rgb(0, 0, 0),
  });

  drawWrappedText(pdfDoc, page, text, margin, page.getHeight() - 80, 500, bodyFontSize, fonts.regular);
}

function drawWrappedText(
  pdfDoc: PDFDocument,
  startPage: PDFPage,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  fontSize: number,
  font: PDFFont
): void {
  const lines = wrapText(text, maxWidth, font, fontSize);
  const lineHeight = fontSize * 1.35;
  let page = startPage;
  let cursorY = y;

  lines.forEach(line => {
    if (cursorY < margin) {
      page = pdfDoc.addPage(pageSize);
      cursorY = page.getHeight() - margin;
    }

    page.drawText(line, {
      x,
      y: cursorY,
      size: fontSize,
      font,
      color: rgb(0, 0, 0),
    });
    cursorY -= lineHeight;
  });
}

function wrapText(text: string, maxWidth: number, font: PDFFont, fontSize: number): string[] {
  const words = text.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);

  if (words.length === 0) {
    return [""];
  }

  const lines: string[] = [];
  let currentLine = words[0];

  for (let i = 1; i < words.length; i++) {
    const word = words[i];
    const width = font.widthOfTextAtSize(`${currentLine} ${word}`, fontSize);

    if (width < maxWidth) {
      currentLine += ` ${word}`;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }

  lines.push(currentLine);
  return lines;
}
