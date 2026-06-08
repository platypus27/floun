import { fetchCertificateScan } from "./certificateScanAdapter";
import { executePageScan } from "./pageScanAdapter";
import { buildScanMeta } from "./scanMeta";
import { fetchTlsScan } from "./tlsScanAdapter";
import {
  INVALID_SCAN_TARGET_MESSAGE,
  isValidScanTarget,
} from "../scanProtocol";
import type {
  CertificateScanData,
  PageScanData,
  ScanAdapterResult,
  ScanPayload,
  ScanTarget,
  TlsScanData,
} from "../scanTypes";

export interface ScanAdapters {
  page: (target: ScanTarget) => Promise<ScanAdapterResult<PageScanData>>;
  tls: (target: ScanTarget) => Promise<ScanAdapterResult<TlsScanData | null>>;
  certificates: (target: ScanTarget) => Promise<ScanAdapterResult<CertificateScanData | null>>;
}

export const defaultScanAdapters: ScanAdapters = {
  page: (target) => executePageScan(target.tabId, target.pageOrigin),
  tls: fetchTlsScan,
  certificates: fetchCertificateScan,
};

export async function runWebsiteScan(
  target: ScanTarget,
  adapters: ScanAdapters = defaultScanAdapters
): Promise<ScanPayload> {
  if (!isValidScanTarget(target)) {
    throw new Error(INVALID_SCAN_TARGET_MESSAGE);
  }

  const [pageScan, tlsScan, certificateScan] = await Promise.all([
    adapters.page(target),
    adapters.tls(target),
    adapters.certificates(target),
  ]);
  const scanMeta = buildScanMeta(pageScan.meta, tlsScan.meta, certificateScan.meta);

  return {
    ...pageScan.data,
    TLS: tlsScan.data,
    certificates: certificateScan.data,
    scanMeta,
  };
}

export { isValidScanTarget };
