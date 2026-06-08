import type { ScanPayload, ScanTarget } from "./scanTypes";

export const SCAN_WEBSITE_ACTION = "scanWebsite";

export const INVALID_SCAN_TARGET_MESSAGE = "Scan target is missing tab ID, protocol, hostname, page origin, or URL.";

export interface ScanRequest {
  action: typeof SCAN_WEBSITE_ACTION;
  target: ScanTarget;
}

export interface ScanSuccessResponse {
  status: "success";
  data: ScanPayload;
}

export interface ScanErrorResponse {
  status: "error";
  message?: string;
}

export type ScanResponse = ScanSuccessResponse | ScanErrorResponse | undefined;

const isRecord = (value: unknown): value is Record<string, unknown> => (
  Boolean(value) && typeof value === "object" && !Array.isArray(value)
);

const isScanPayload = (value: unknown): value is ScanPayload => {
  if (!isRecord(value)) {
    return false;
  }

  return Array.isArray(value.jsScripts) &&
    isRecord(value.headers) &&
    Array.isArray(value.tokens) &&
    "TLS" in value &&
    "certificates" in value &&
    isRecord(value.scanMeta);
};

export function buildScanTarget(url: string, tabId: number): ScanTarget {
  const parsedUrl = new URL(url);

  if (!Number.isInteger(tabId) || !["http:", "https:"].includes(parsedUrl.protocol) || !parsedUrl.hostname) {
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

export function isValidScanTarget(target: unknown): target is ScanTarget {
  const candidate = target as ScanTarget | null;

  return Boolean(
    candidate &&
    Number.isInteger(candidate.tabId) &&
    ["http:", "https:"].includes(candidate.protocol) &&
    typeof candidate.hostname === "string" &&
    candidate.hostname.length > 0 &&
    typeof candidate.pageOrigin === "string" &&
    candidate.pageOrigin.length > 0 &&
    typeof candidate.url === "string" &&
    candidate.url.length > 0
  );
}

export function buildScanRequest(target: ScanTarget): ScanRequest {
  if (!isValidScanTarget(target)) {
    throw new Error(INVALID_SCAN_TARGET_MESSAGE);
  }

  return {
    action: SCAN_WEBSITE_ACTION,
    target,
  };
}

export function isScanActionMessage(message: unknown): boolean {
  return isRecord(message) && message.action === SCAN_WEBSITE_ACTION;
}

export function isScanRequest(message: unknown): message is ScanRequest {
  return isRecord(message) &&
    message.action === SCAN_WEBSITE_ACTION &&
    isValidScanTarget(message.target);
}

export const buildScanSuccessResponse = (data: ScanPayload): ScanSuccessResponse => ({
  status: "success",
  data,
});

export const buildScanErrorResponse = (message: string): ScanErrorResponse => ({
  status: "error",
  message,
});

export function isScanSuccessResponse(response: unknown): response is ScanSuccessResponse {
  return isRecord(response) &&
    response.status === "success" &&
    isScanPayload(response.data);
}

export function isScanErrorResponse(response: unknown): response is ScanErrorResponse {
  return isRecord(response) &&
    response.status === "error" &&
    (response.message === undefined || typeof response.message === "string");
}

export function getScanResponseErrorMessage(response: unknown, fallbackMessage = "Scan failed."): string {
  return isScanErrorResponse(response)
    ? response.message || fallbackMessage
    : fallbackMessage;
}
