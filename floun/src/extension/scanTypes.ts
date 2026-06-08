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

export interface PageScanData {
  jsScripts: unknown[];
  headers: Record<string, string>;
  tokens: string[];
}

export interface TlsEndpointScanData {
  protocolVersions: string[];
  cipherSuites: string[];
}

export interface TlsScanData {
  provider: "ssl-labs";
  endpoints: TlsEndpointScanData[];
}

export interface CertificateScanData {
  provider: "ssl-checker";
  signatureAlgorithm: string;
}

export interface ScanPayload extends PageScanData {
  TLS: TlsScanData | null;
  certificates: CertificateScanData | null;
  scanMeta: ScanMeta;
}

export interface ScanAdapterResult<TData> {
  data: TData;
  meta: ScanAdapterMeta;
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

export const emptyScanMeta = (): ScanMeta => ({
  page: { status: "unavailable", message: "Page scan has not run." },
  tls: { status: "unavailable", message: "TLS scan has not run." },
  certificates: { status: "unavailable", message: "Certificate scan has not run." },
  warnings: [],
});
