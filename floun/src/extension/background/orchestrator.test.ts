import { handleScanMessage } from "./messageHandler";
import { buildScanMeta } from "./scanMeta";
import { runWebsiteScan } from "./orchestrator";
import { SCAN_WEBSITE_ACTION, ScanTarget } from "../scanTypes";

const target: ScanTarget = {
  tabId: 7,
  protocol: "https:",
  hostname: "example.com",
  pageOrigin: "https://example.com",
  url: "https://example.com",
};

test("combines adapter data and warnings into a scan payload", async () => {
  const payload = await runWebsiteScan(target, {
    page: vi.fn().mockResolvedValue({
      data: { tokens: ["token"], headers: {}, jsScripts: [] },
      meta: { status: "complete" },
    }),
    tls: vi.fn().mockResolvedValue({
      data: null,
      meta: { status: "partial", message: "TLS still running" },
    }),
    certificates: vi.fn().mockResolvedValue({
      data: null,
      meta: { status: "unavailable", message: "Certificate API unavailable" },
    }),
  });

  expect(payload).toMatchObject({
    tokens: ["token"],
    TLS: null,
    certificates: null,
    scanMeta: {
      page: { status: "complete" },
      tls: { status: "partial", message: "TLS still running" },
      certificates: { status: "unavailable", message: "Certificate API unavailable" },
      warnings: [
        "TLS scan partial: TLS still running",
        "Certificate scan unavailable: Certificate API unavailable",
      ],
    },
  });
});

test("builds scan warnings for non-complete adapter statuses", () => {
  expect(buildScanMeta(
    { status: "complete" },
    { status: "partial", message: "TLS slow" },
    { status: "unavailable", message: "No certificate data" }
  ).warnings).toEqual([
    "TLS scan partial: TLS slow",
    "Certificate scan unavailable: No certificate data",
  ]);
});

test("returns an error response for invalid scan targets", async () => {
  const response = new Promise((resolve) => {
    const handled = handleScanMessage(
      { action: SCAN_WEBSITE_ACTION, target: {} },
      resolve
    );

    expect(handled).toBe(true);
  });

  await expect(response).resolves.toMatchObject({
    status: "error",
    message: "Scan target is missing tab ID, protocol, hostname, or page origin.",
  });
});

test("ignores unrelated runtime messages", () => {
  expect(handleScanMessage({ action: "other" }, vi.fn())).toBe(false);
});
