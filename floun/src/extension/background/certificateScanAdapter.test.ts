import { fetchCertificateScan } from "./certificateScanAdapter";
import { ScanTarget } from "../scanTypes";

const httpsTarget: ScanTarget = {
  tabId: 7,
  protocol: "https:",
  hostname: "example.com",
  pageOrigin: "https://example.com",
  url: "https://example.com",
};

const httpTarget: ScanTarget = {
  ...httpsTarget,
  protocol: "http:",
  pageOrigin: "http://example.com",
  url: "http://example.com",
};

const jsonResponse = (
  body: unknown,
  { ok = true, status = 200 }: { ok?: boolean; status?: number } = {}
) => ({
  ok,
  status,
  json: vi.fn().mockResolvedValue(body),
}) as unknown as Response;

test("returns unavailable metadata for non-HTTPS targets", async () => {
  const fetchMock = vi.fn();

  await expect(fetchCertificateScan(httpTarget, { fetchImpl: fetchMock as unknown as typeof fetch })).resolves.toMatchObject({
    data: null,
    meta: { status: "unavailable", message: "Certificate scan requires an HTTPS page." },
  });
  expect(fetchMock).not.toHaveBeenCalled();
});

test("returns complete metadata for certificate lookup data", async () => {
  const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ result: { cert_alg: "sha256WithRSAEncryption" } }));

  await expect(fetchCertificateScan(httpsTarget, { fetchImpl: fetchMock as unknown as typeof fetch })).resolves.toMatchObject({
    data: { result: { cert_alg: "sha256WithRSAEncryption" } },
    meta: { status: "complete" },
  });
});

test("returns unavailable metadata for empty, HTTP-failed, and thrown certificate lookups", async () => {
  const emptyFetch = vi.fn().mockResolvedValue(jsonResponse({}));
  const httpFetch = vi.fn().mockResolvedValue(jsonResponse({}, { ok: false, status: 500 }));
  const thrownFetch = vi.fn().mockRejectedValue(new Error("Certificate API unavailable"));

  await expect(fetchCertificateScan(httpsTarget, { fetchImpl: emptyFetch as unknown as typeof fetch })).resolves.toMatchObject({
    data: null,
    meta: { status: "unavailable", message: "Certificate lookup returned no usable data." },
  });
  await expect(fetchCertificateScan(httpsTarget, { fetchImpl: httpFetch as unknown as typeof fetch })).resolves.toMatchObject({
    data: null,
    meta: { status: "unavailable", message: "Certificate lookup returned HTTP 500." },
  });
  await expect(fetchCertificateScan(httpsTarget, { fetchImpl: thrownFetch as unknown as typeof fetch })).resolves.toMatchObject({
    data: null,
    meta: { status: "unavailable", message: "Certificate API unavailable" },
  });
});
