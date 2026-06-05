/// <reference types="chrome"/>

export const SCAN_WEBSITE_ACTION = "scanWebsite";

export type ScanAdapterStatus = "complete" | "partial" | "unavailable";

export interface ScanAdapterMeta {
  status: ScanAdapterStatus;
  message?: string;
}

export interface ScanMeta {
  page: ScanAdapterMeta;
  tls: ScanAdapterMeta;
  certificates: ScanAdapterMeta;
  warnings: string[];
}

export interface ScanTarget {
  tabId: number;
  protocol: string;
  hostname: string;
  pageOrigin: string;
  url: string;
}

export interface ScanPayload {
  jsScripts?: unknown;
  TLS?: unknown;
  certificates?: unknown;
  tokens?: unknown;
  scanMeta: ScanMeta;
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

export const emptyScanMeta = (): ScanMeta => ({
  page: { status: "unavailable", message: "Page scan has not run." },
  tls: { status: "unavailable", message: "TLS scan has not run." },
  certificates: { status: "unavailable", message: "Certificate scan has not run." },
  warnings: [],
});

export function buildScanTarget(url: string, tabId: number): ScanTarget {
  const parsedUrl = new URL(url);

  if (!["http:", "https:"].includes(parsedUrl.protocol) || !parsedUrl.hostname) {
    throw new Error("Floun can scan HTTP and HTTPS tabs only.");
  }

  return {
    tabId,
    protocol: parsedUrl.protocol,
    hostname: parsedUrl.hostname,
    pageOrigin: parsedUrl.origin,
    url: parsedUrl.href,
  };
}

export async function scanActiveTab(): Promise<ScanPayload> {
  const activeTab = await queryActiveTab();
  const target = buildScanTarget(activeTab.url || "", activeTab.id as number);
  const response = await requestScan(target);

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

function requestScan(target: ScanTarget): Promise<ScanResponse> {
  return new Promise(resolve => {
    chrome.runtime.sendMessage(
      { action: SCAN_WEBSITE_ACTION, target },
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
