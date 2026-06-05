/// <reference types="chrome"/>

export const RUN_SCANS_ACTION = "runScans";

export interface ScanTarget {
  protocol: string;
  hostname: string;
}

export interface ScanPayload {
  jsScripts?: unknown;
  TLS?: unknown;
  certificates?: unknown;
  tokens?: unknown;
}

interface ScanSuccessResponse {
  status: "success";
  data: ScanPayload;
}

interface ScanErrorResponse {
  status: "error";
  message?: string;
}

type ScanResponse = ScanSuccessResponse | ScanErrorResponse | undefined;

export function buildScanTarget(url: string): ScanTarget {
  const parsedUrl = new URL(url);

  return {
    protocol: parsedUrl.protocol,
    hostname: parsedUrl.hostname,
  };
}

export async function scanActiveTab(): Promise<ScanPayload> {
  const activeTab = await queryActiveTab();
  const target = buildScanTarget(activeTab.url || "");
  const response = await requestScan(activeTab.id as number, target);

  if (!response || response.status !== "success") {
    throw new Error(response?.message || "Scan failed.");
  }

  return response.data;
}

function queryActiveTab(): Promise<chrome.tabs.Tab> {
  return new Promise((resolve, reject) => {
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
      const activeTab = tabs[0];

      if (activeTab?.id === undefined || !activeTab.url) {
        reject(new Error("No active tab found."));
        return;
      }

      resolve(activeTab);
    });
  });
}

function requestScan(tabId: number, target: ScanTarget): Promise<ScanResponse> {
  return new Promise(resolve => {
    chrome.tabs.sendMessage(
      tabId,
      { action: RUN_SCANS_ACTION, target },
      response => {
        const lastError = chrome.runtime.lastError;

        if (lastError) {
          resolve({ status: "error", message: lastError.message });
          return;
        }

        resolve(response);
      }
    );
  });
}

