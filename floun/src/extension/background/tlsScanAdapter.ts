import { getErrorMessage } from "./errors";
import { completeMeta, partialMeta, unavailableMeta } from "./scanMeta";
import type { ScanAdapterResult, ScanTarget } from "../scanTypes";

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

const delay = (ms: number): Promise<void> => (
  new Promise((resolve) => setTimeout(resolve, ms))
);

export async function fetchTlsScan(
  target: ScanTarget,
  {
    fetchImpl = fetch,
    maxAttempts = TLS_SCAN.maxAttempts,
    pollDelayMs = TLS_SCAN.pollDelayMs,
    delayFn = delay,
  }: TlsScanOptions = {}
): Promise<ScanAdapterResult<unknown | null>> {
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

      const data = await response.json() as { status?: string; statusMessage?: string };

      if (data.status === "READY") {
        return { data, meta: completeMeta() };
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
