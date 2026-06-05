import { fetchTlsScan } from "./tlsScanAdapter";
import { ScanTarget } from "../scanTypes";

const target: ScanTarget = {
  tabId: 7,
  protocol: "https:",
  hostname: "example.com",
  pageOrigin: "https://example.com",
  url: "https://example.com",
};

const jsonResponse = (
  body: unknown,
  { ok = true, status = 200 }: { ok?: boolean; status?: number } = {}
) => ({
  ok,
  status,
  json: vi.fn().mockResolvedValue(body),
}) as unknown as Response;

test("returns complete metadata when SSL Labs is ready", async () => {
  const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ status: "READY", endpoints: [] }));

  await expect(fetchTlsScan(target, { fetchImpl: fetchMock as unknown as typeof fetch })).resolves.toMatchObject({
    data: { status: "READY", endpoints: [] },
    meta: { status: "complete" },
  });
});

test("returns unavailable metadata for SSL Labs errors and HTTP failures", async () => {
  const errorFetch = vi.fn().mockResolvedValue(jsonResponse({ status: "ERROR", statusMessage: "Rejected" }));
  const httpFetch = vi.fn().mockResolvedValue(jsonResponse({}, { ok: false, status: 503 }));

  await expect(fetchTlsScan(target, { fetchImpl: errorFetch as unknown as typeof fetch })).resolves.toMatchObject({
    data: null,
    meta: { status: "unavailable", message: "Rejected" },
  });
  await expect(fetchTlsScan(target, { fetchImpl: httpFetch as unknown as typeof fetch })).resolves.toMatchObject({
    data: null,
    meta: { status: "unavailable", message: "SSL Labs returned HTTP 503." },
  });
});

test("returns partial metadata when SSL Labs polling times out", async () => {
  const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ status: "IN_PROGRESS" }));
  const delayFn = vi.fn().mockResolvedValue(undefined);

  const result = await fetchTlsScan(target, {
    fetchImpl: fetchMock as unknown as typeof fetch,
    maxAttempts: 2,
    pollDelayMs: 0,
    delayFn,
  });

  expect(result).toMatchObject({
    data: null,
    meta: {
      status: "partial",
      message: "SSL Labs did not finish the TLS scan before the polling limit.",
    },
  });
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

test("returns unavailable metadata for SSL Labs fetch exceptions", async () => {
  const fetchMock = vi.fn().mockRejectedValue(new Error("Network down"));

  await expect(fetchTlsScan(target, { fetchImpl: fetchMock as unknown as typeof fetch })).resolves.toMatchObject({
    data: null,
    meta: { status: "unavailable", message: "Network down" },
  });
});
