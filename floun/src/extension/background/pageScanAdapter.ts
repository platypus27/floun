import { PageCollectorResult, collectPageScan } from "./pageCollector";
import { completeMeta, partialMeta, unavailableMeta } from "./scanMeta";
import type { PageScanData, ScanAdapterResult } from "../scanTypes";

const emptyPageScan = (): PageScanData => ({ tokens: [], headers: {}, jsScripts: [] });
const malformedPageDataMessage = "Page collector returned malformed data.";
const truncatedPageDataMessage = "Page collector returned truncated page data.";
const maxTokenCount = 50;
const maxTokenLength = 512;
const maxScriptCount = 50;
const maxScriptContentLength = 50_000;

interface NormalizedPageScanResult {
  data: PageScanData;
  malformed: boolean;
  truncated: boolean;
}

const isRecord = (value: unknown): value is Record<string, unknown> => (
  Boolean(value) && typeof value === "object" && !Array.isArray(value)
);

const getPageCollectorError = (result: unknown): string | null => {
  if (!isRecord(result) || typeof result.error !== "string") {
    return null;
  }

  const errorMessage = result.error.trim();

  return errorMessage.length > 0 ? errorMessage : null;
};

const normalizeTokens = (tokens: unknown): { values: string[]; malformed: boolean; truncated: boolean } => {
  if (!Array.isArray(tokens)) {
    return { values: [], malformed: true, truncated: false };
  }

  let malformed = false;
  let truncated = tokens.length > maxTokenCount;
  const values = tokens
    .slice(0, maxTokenCount)
    .flatMap(token => {
      if (typeof token !== "string") {
        malformed = true;
        return [];
      }

      const normalizedToken = token.trim();

      if (normalizedToken !== token || normalizedToken.length === 0) {
        malformed = true;
      }

      if (normalizedToken.length > maxTokenLength) {
        truncated = true;
      }

      return normalizedToken.length > 0 ? [normalizedToken.slice(0, maxTokenLength)] : [];
    });

  return { values, malformed, truncated };
};

const normalizeHeaders = (headers: unknown): { values: Record<string, string>; malformed: boolean } => {
  if (!isRecord(headers)) {
    return { values: {}, malformed: true };
  }

  let malformed = false;
  const values = Object.fromEntries(
    Object.entries(headers).flatMap(([key, value]) => {
      if (typeof value !== "string") {
        malformed = true;
        return [];
      }

      const normalizedKey = key.trim();

      if (normalizedKey !== key || normalizedKey.length === 0) {
        malformed = true;
      }

      return normalizedKey.length > 0 ? [[normalizedKey, value]] : [];
    })
  );

  return { values, malformed };
};

const sanitizeScriptSrc = (src: unknown): string | undefined => {
  if (typeof src !== "string") {
    return undefined;
  }

  try {
    const scriptUrl = new URL(src.trim());
    scriptUrl.username = "";
    scriptUrl.password = "";
    scriptUrl.search = "";
    scriptUrl.hash = "";

    return scriptUrl.href;
  } catch {
    return src.trim() || undefined;
  }
};

const normalizeScripts = (scripts: unknown): { values: unknown[]; malformed: boolean; truncated: boolean } => {
  if (!Array.isArray(scripts)) {
    return { values: [], malformed: true, truncated: false };
  }

  let malformed = false;
  let truncated = scripts.length > maxScriptCount;
  const values = scripts.slice(0, maxScriptCount).flatMap(script => {
    if (!isRecord(script) || typeof script.content !== "string") {
      malformed = true;
      return [];
    }

    const content = script.content.length > maxScriptContentLength
      ? script.content.slice(0, maxScriptContentLength)
      : script.content;

    if (content.length !== script.content.length) {
      truncated = true;
    }

    return [{
      type: typeof script.type === "string" ? script.type : undefined,
      src: sanitizeScriptSrc(script.src),
      content,
    }];
  });

  return { values, malformed, truncated };
};

function normalizePageScanResult(result: unknown): NormalizedPageScanResult {
  if (!isRecord(result)) {
    return { data: emptyPageScan(), malformed: true, truncated: false };
  }

  const tokens = normalizeTokens(result.tokens);
  const headers = normalizeHeaders(result.headers);
  const jsScripts = normalizeScripts(result.jsScripts);

  return {
    data: {
      tokens: tokens.values,
      headers: headers.values,
      jsScripts: jsScripts.values,
    },
    malformed: tokens.malformed || headers.malformed || jsScripts.malformed,
    truncated: result.truncated === true || tokens.truncated || jsScripts.truncated,
  };
}

export function executePageScan(
  tabId: number,
  pageOrigin: string
): Promise<ScanAdapterResult<PageScanData>> {
  return new Promise((resolve) => {
    chrome.scripting.executeScript(
      {
        target: { tabId },
        func: collectPageScan,
        args: [pageOrigin],
      },
      (injectionResults) => {
        const lastError = chrome.runtime.lastError;

        if (lastError) {
          resolve({
            data: emptyPageScan(),
            meta: unavailableMeta(lastError.message || "Script injection failed."),
          });
          return;
        }

        const scanResult = injectionResults?.[0]?.result as PageCollectorResult | undefined;
        const pageCollectorError = getPageCollectorError(scanResult);

        if (pageCollectorError) {
          resolve({
            data: emptyPageScan(),
            meta: partialMeta(pageCollectorError),
          });
          return;
        }

        const normalizedResult = normalizePageScanResult(scanResult);

        resolve({
          data: normalizedResult.data,
          meta: normalizedResult.malformed
            ? partialMeta(malformedPageDataMessage)
            : normalizedResult.truncated
              ? partialMeta(truncatedPageDataMessage)
              : completeMeta(),
        });
      }
    );
  });
}
