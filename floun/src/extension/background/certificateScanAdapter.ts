import { getErrorMessage } from "./errors";
import { completeMeta, unavailableMeta } from "./scanMeta";
import type { CertificateScanData, ScanAdapterResult, ScanTarget } from "../scanTypes";

type FetchLike = typeof fetch;

interface CertificateScanOptions {
  fetchImpl?: FetchLike;
}

interface CertificateProviderResponse {
  result?: {
    cert_alg?: unknown;
  };
  cert_alg?: unknown;
}

const asProviderObject = (value: unknown): CertificateProviderResponse => (
  value && typeof value === "object" ? value as CertificateProviderResponse : {}
);

function normalizeCertificateScanData(data: unknown): CertificateScanData | null {
  const providerData = asProviderObject(data);
  const signatureAlgorithm = providerData.result?.cert_alg ?? providerData.cert_alg;

  return typeof signatureAlgorithm === "string" && signatureAlgorithm.trim().length > 0
    ? {
      provider: "ssl-checker",
      signatureAlgorithm: signatureAlgorithm.trim(),
    }
    : null;
}

export async function fetchCertificateScan(
  target: ScanTarget,
  { fetchImpl = fetch }: CertificateScanOptions = {}
): Promise<ScanAdapterResult<CertificateScanData | null>> {
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

    const data = await response.json();
    const normalizedData = normalizeCertificateScanData(data);

    return {
      data: normalizedData,
      meta: normalizedData
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
