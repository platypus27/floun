import { PageCollectorResult, collectPageScan } from "./pageCollector";
import { completeMeta, partialMeta, unavailableMeta } from "./scanMeta";
import type { PageScanData, ScanAdapterResult } from "../scanTypes";

const emptyPageScan = (): PageScanData => ({ tokens: [], headers: {}, jsScripts: [] });

const isPageCollectorError = (result: PageCollectorResult): result is { error: string } => (
  "error" in result
);

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

        resolve({
          data: scanResult || emptyPageScan(),
          meta: completeMeta(),
        });
      }
    );
  });
}
