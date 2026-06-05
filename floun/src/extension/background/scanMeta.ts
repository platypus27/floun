import type { ScanAdapterMeta, ScanMeta } from "../scanTypes";

export const completeMeta = (): ScanAdapterMeta => ({ status: "complete" });

export const partialMeta = (message: string): ScanAdapterMeta => ({
  status: "partial",
  message,
});

export const unavailableMeta = (message: string): ScanAdapterMeta => ({
  status: "unavailable",
  message,
});

export function buildScanMeta(
  page: ScanAdapterMeta,
  tls: ScanAdapterMeta,
  certificates: ScanAdapterMeta
): ScanMeta {
  const scanMeta: ScanMeta = {
    page,
    tls,
    certificates,
    warnings: [],
  };
  const labels: Record<keyof Omit<ScanMeta, "warnings">, string> = {
    page: "Page scan",
    tls: "TLS scan",
    certificates: "Certificate scan",
  };

  Object.entries(labels).forEach(([key, label]) => {
    const meta = scanMeta[key as keyof Omit<ScanMeta, "warnings">];

    if (meta.status !== "complete") {
      const message = meta.message ? `: ${meta.message}` : "";
      scanMeta.warnings.push(`${label} ${meta.status}${message}`);
    }
  });

  return scanMeta;
}
