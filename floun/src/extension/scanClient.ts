/// <reference types="chrome"/>

import {
  ScanPayload,
  ScanTarget,
  emptyScanMeta,
} from "./scanTypes";
import {
  SCAN_WEBSITE_ACTION,
  buildScanErrorResponse,
  buildScanRequest,
  buildScanTarget,
  getScanResponseErrorMessage,
  isScanSuccessResponse,
  type ScanResponse,
} from "./scanProtocol";

export {
  SCAN_WEBSITE_ACTION,
  buildScanTarget,
  emptyScanMeta,
};

export type {
  ScanAdapterMeta,
  ScanAdapterStatus,
  ScanMeta,
  ScanPayload,
  ScanTarget,
} from "./scanTypes";

export async function scanActiveTab(): Promise<ScanPayload> {
  const activeTab = await queryActiveTab();
  const target = buildScanTarget(activeTab.url || "", activeTab.id as number);
  const response = await requestScan(target);

  if (!isScanSuccessResponse(response)) {
    throw new Error(getScanResponseErrorMessage(response));
  }

  return response.data;
}

function queryActiveTab(): Promise<chrome.tabs.Tab> {
  return new Promise((resolve, reject) => {
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
      const lastError = chrome.runtime.lastError;

      if (lastError) {
        reject(new Error(lastError.message || "Unable to query active tab."));
        return;
      }

      const activeTab = tabs[0];

      if (activeTab?.id === undefined || !activeTab.url) {
        reject(new Error("No active tab found."));
        return;
      }

      resolve(activeTab);
    });
  });
}

function requestScan(target: ScanTarget): Promise<ScanResponse> {
  return new Promise(resolve => {
    chrome.runtime.sendMessage(
      buildScanRequest(target),
      response => {
        const lastError = chrome.runtime.lastError;

        if (lastError) {
          resolve(buildScanErrorResponse(lastError.message || "Scan failed."));
          return;
        }

        resolve(response);
      }
    );
  });
}
