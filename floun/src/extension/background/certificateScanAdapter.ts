import { getErrorMessage } from "./errors";
import { completeMeta, unavailableMeta } from "./scanMeta";
import type { ScanAdapterResult, ScanTarget } from "../scanTypes";

type FetchLike = typeof fetch;

interface CertificateScanOptions {
  fetchImpl?: FetchLike;
}

export async function fetchCertificateScan(
  target: ScanTarget,
  { fetchImpl = fetch }: CertificateScanOptions = {}
): Promise<ScanAdapterResult<unknown | null>> {
  if (target.protocol !== "https:") {
    return {
      data: null,
      meta: unavailableMeta("Certificate scan requires an HTTPS page."),
    };
  }

  try {
    const response = await fetchImpl(
      `https://ssl-checker.io/api/v1/check/${encodeURIComponent(target.hostname)}`
    );

    if (!response.ok) {
      return {
        data: null,
        meta: unavailableMeta(`Certificate lookup returned HTTP ${response.status}.`),
      };
    }

    const data = await response.json() as Record<string, unknown>;
    const hasCertificateData = data && Object.keys(data).length > 0;

    return {
      data: hasCertificateData ? data : null,
      meta: hasCertificateData
        ? completeMeta()
        : unavailableMeta("Certificate lookup returned no usable data."),
    };
  } catch (error) {
    return {
      data: null,
      meta: unavailableMeta(getErrorMessage(error)),
    };
  }
}
