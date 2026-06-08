import { PageCollectorResult, collectPageScan } from "./pageCollector";
import { completeMeta, partialMeta, unavailableMeta } from "./scanMeta";
import type { PageScanData, ScanAdapterResult } from "../scanTypes";

const emptyPageScan = (): PageScanData => ({ tokens: [], headers: {}, jsScripts: [] });
const malformedPageDataMessage = "Page collector returned malformed data.";

interface NormalizedPageScanResult {
  data: PageScanData;
  malformed: boolean;
}

const isPageCollectorError = (result: PageCollectorResult): result is { error: string } => (
  "error" in result
);

const isRecord = (value: unknown): value is Record<string, unknown> => (
  Boolean(value) && typeof value === "object" && !Array.isArray(value)
);

const normalizeTokens = (tokens: unknown): { values: string[]; malformed: boolean } => {
  if (!Array.isArray(tokens)) {
    return { values: [], malformed: true };
  }

  let malformed = false;
  const values = tokens
    .flatMap(token => {
      if (typeof token !== "string") {
        malformed = true;
        return [];
      }

      const normalizedToken = token.trim();

      if (normalizedToken !== token || normalizedToken.length === 0) {
        malformed = true;
      }

      return normalizedToken.length > 0 ? [normalizedToken] : [];
    });

  return { values, malformed };
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

const normalizeScripts = (scripts: unknown): { values: unknown[]; malformed: boolean } => {
  if (!Array.isArray(scripts)) {
    return { values: [], malformed: true };
  }

  let malformed = false;
  const values = scripts.flatMap(script => {
    if (!isRecord(script) || typeof script.content !== "string") {
      malformed = true;
      return [];
    }

    return [{
      type: typeof script.type === "string" ? script.type : undefined,
      src: typeof script.src === "string" ? script.src : undefined,
      content: script.content,
    }];
  });

  return { values, malformed };
};

function normalizePageScanResult(result: unknown): NormalizedPageScanResult {
  if (!isRecord(result)) {
    return { data: emptyPageScan(), malformed: true };
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

        if (scanResult && isPageCollectorError(scanResult)) {
          resolve({
            data: emptyPageScan(),
            meta: partialMeta(scanResult.error),
          });
          return;
        }

        const normalizedResult = normalizePageScanResult(scanResult);

        resolve({
          data: normalizedResult.data,
          meta: normalizedResult.malformed
            ? partialMeta(malformedPageDataMessage)
            : completeMeta(),
        });
      }
    );
  });
}
