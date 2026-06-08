import { getErrorMessage } from "./errors";
import { completeMeta, partialMeta, unavailableMeta } from "./scanMeta";
import type { ScanAdapterResult, ScanTarget, TlsScanData } from "../scanTypes";

const TLS_SCAN = Object.freeze({
  maxAttempts: 15,
  pollDelayMs: 5000,
});

type FetchLike = typeof fetch;

interface TlsScanOptions {
  fetchImpl?: FetchLike;
  maxAttempts?: number;
  pollDelayMs?: number;
  delayFn?: (ms: number) => Promise<void>;
}

interface SslLabsProtocol {
  version?: unknown;
}

interface SslLabsCipher {
  name?: unknown;
}

interface SslLabsSuite {
  list?: unknown;
}

interface SslLabsEndpointDetails {
  protocols?: unknown;
  suites?: unknown;
}

interface SslLabsEndpoint {
  details?: SslLabsEndpointDetails;
}

interface SslLabsResponse {
  status?: string;
  statusMessage?: string;
  endpoints?: unknown;
}

const delay = (ms: number): Promise<void> => (
  new Promise((resolve) => setTimeout(resolve, ms))
);

const normalizeString = (value: unknown): string | null => (
  typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null
);

const normalizeStringList = <TValue>(
  values: unknown,
  selector: (value: TValue) => unknown
): string[] => (
  Array.isArray(values)
    ? values
      .map(value => normalizeString(selector(value as TValue)))
      .filter((value): value is string => Boolean(value))
    : []
);

const asProviderObject = (value: unknown): Record<string, unknown> => (
  value && typeof value === "object" ? value as Record<string, unknown> : {}
);

function normalizeTlsScanData(data: unknown): TlsScanData {
  const response = asProviderObject(data) as SslLabsResponse;
  const endpoints = Array.isArray(response.endpoints) ? response.endpoints : [];

  return {
    provider: "ssl-labs",
    endpoints: endpoints.map(endpoint => {
      const details = (endpoint as SslLabsEndpoint | null)?.details;
      const protocolVersions = normalizeStringList<SslLabsProtocol>(
        details?.protocols,
        protocol => protocol.version
      );
      const cipherSuites = Array.isArray(details?.suites)
        ? details.suites.flatMap(suite => normalizeStringList<SslLabsCipher>(
          (suite as SslLabsSuite).list,
          cipher => cipher.name
        ))
        : [];

      return { protocolVersions, cipherSuites };
    }),
  };
}

export async function fetchTlsScan(
  target: ScanTarget,
  {
    fetchImpl = fetch,
    maxAttempts = TLS_SCAN.maxAttempts,
    pollDelayMs = TLS_SCAN.pollDelayMs,
    delayFn = delay,
  }: TlsScanOptions = {}
): Promise<ScanAdapterResult<TlsScanData | null>> {
  const apiUrl = `https://api.ssllabs.com/api/v3/analyze?host=${encodeURIComponent(target.hostname)}&all=done`;

  try {
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const response = await fetchImpl(apiUrl);

      if (!response.ok) {
        return {
          data: null,
          meta: unavailableMeta(`SSL Labs returned HTTP ${response.status}.`),
        };
      }

      const data = asProviderObject(await response.json()) as SslLabsResponse;

      if (data.status === "READY") {
        return { data: normalizeTlsScanData(data), meta: completeMeta() };
      }

      if (data.status === "ERROR") {
        return {
          data: null,
          meta: unavailableMeta(data.statusMessage || "SSL Labs reported an error."),
        };
      }

      await delayFn(pollDelayMs);
    }

    return {
      data: null,
      meta: partialMeta("SSL Labs did not finish the TLS scan before the polling limit."),
    };
  } catch (error) {
    return {
      data: null,
      meta: unavailableMeta(getErrorMessage(error)),
    };
  }
}
