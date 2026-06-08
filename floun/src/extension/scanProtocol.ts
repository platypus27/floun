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

const isValidTabId = (value: unknown): value is number => (
  typeof value === "number" && Number.isInteger(value) && value >= 0
);

const isStringArray = (value: unknown): value is string[] => (
  Array.isArray(value) && value.every(item => typeof item === "string")
);

const isStringRecord = (value: unknown): value is Record<string, string> => (
  isRecord(value) &&
  Object.entries(value).every(([key, item]) => key.trim().length > 0 && typeof item === "string")
);

const isScanAdapterMeta = (value: unknown): boolean => (
  isRecord(value) &&
  ["complete", "partial", "unavailable"].includes(value.status as string) &&
  (value.message === undefined || typeof value.message === "string")
);

const isScanMeta = (value: unknown): boolean => (
  isRecord(value) &&
  isScanAdapterMeta(value.page) &&
  isScanAdapterMeta(value.tls) &&
  isScanAdapterMeta(value.certificates) &&
  isStringArray(value.warnings)
);

const isTlsScanData = (value: unknown): boolean => (
  value === null ||
  (
    isRecord(value) &&
    value.provider === "ssl-labs" &&
    Array.isArray(value.endpoints) &&
    value.endpoints.every(endpoint => (
      isRecord(endpoint) &&
      isStringArray(endpoint.protocolVersions) &&
      isStringArray(endpoint.cipherSuites)
    ))
  )
);

const isCertificateScanData = (value: unknown): boolean => (
  value === null ||
  (
    isRecord(value) &&
    value.provider === "ssl-checker" &&
    typeof value.signatureAlgorithm === "string" &&
    value.signatureAlgorithm.trim().length > 0
  )
);

const parseUrl = (value: unknown): URL | null => {
  if (typeof value !== "string" || value.length === 0) {
    return null;
  }

  try {
    return new URL(value);
  } catch {
    return null;
  }
};

const minimizeUrlForScanTarget = (url: URL): URL => {
  const sanitizedUrl = new URL(url.href);
  sanitizedUrl.username = "";
  sanitizedUrl.password = "";
  sanitizedUrl.pathname = "/";
  sanitizedUrl.search = "";
  sanitizedUrl.hash = "";

  return sanitizedUrl;
};

const isScanPayload = (value: unknown): value is ScanPayload => {
  if (!isRecord(value)) {
    return false;
  }

  return Array.isArray(value.jsScripts) &&
    isStringRecord(value.headers) &&
    isStringArray(value.tokens) &&
    isTlsScanData(value.TLS) &&
    isCertificateScanData(value.certificates) &&
    isScanMeta(value.scanMeta);
};

export function buildScanTarget(url: string, tabId: number): ScanTarget {
  const parsedUrl = new URL(url);
  const sanitizedUrl = minimizeUrlForScanTarget(parsedUrl);

  if (!isValidTabId(tabId) || !["http:", "https:"].includes(parsedUrl.protocol) || !parsedUrl.hostname) {
    throw new Error("Floun can scan HTTP and HTTPS tabs only.");
  }

  return {
    tabId,
    protocol: sanitizedUrl.protocol,
    hostname: sanitizedUrl.hostname,
    pageOrigin: sanitizedUrl.origin,
    url: sanitizedUrl.href,
  };
}

export function isValidScanTarget(target: unknown): target is ScanTarget {
  const candidate = target as ScanTarget | null;

  if (
    !candidate ||
    !isValidTabId(candidate.tabId) ||
    typeof candidate.protocol !== "string" ||
    typeof candidate.hostname !== "string"
  ) {
    return false;
  }

  const parsedUrl = parseUrl(candidate.url);
  const parsedOrigin = parseUrl(candidate.pageOrigin);

  return Boolean(
    parsedUrl &&
    parsedOrigin &&
    ["http:", "https:"].includes(candidate.protocol) &&
    parsedUrl.username === "" &&
    parsedUrl.password === "" &&
    parsedUrl.pathname === "/" &&
    parsedUrl.search === "" &&
    parsedUrl.hash === "" &&
    candidate.protocol === parsedUrl.protocol &&
    candidate.protocol === parsedOrigin.protocol &&
    candidate.hostname.length > 0 &&
    candidate.hostname === parsedUrl.hostname &&
    candidate.hostname === parsedOrigin.hostname &&
    candidate.pageOrigin === parsedUrl.origin &&
    candidate.pageOrigin === parsedOrigin.origin
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
