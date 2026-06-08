import { handleScanMessage } from "./messageHandler";
import {
  INVALID_SCAN_TARGET_MESSAGE,
  SCAN_WEBSITE_ACTION,
  buildScanRequest,
} from "../scanProtocol";
import type { ScanPayload, ScanTarget } from "../scanTypes";

const target: ScanTarget = {
  tabId: 7,
  protocol: "https:",
  hostname: "example.com",
  pageOrigin: "https://example.com",
  url: "https://example.com",
};

const payload: ScanPayload = {
  jsScripts: [],
  headers: {},
  tokens: [],
  TLS: null,
  certificates: null,
  scanMeta: {
    page: { status: "complete" },
    tls: { status: "unavailable" },
    certificates: { status: "unavailable" },
    warnings: [],
  },
};

test("handles valid scan requests with a success response", async () => {
  const runScan = vi.fn().mockResolvedValue(payload);
  const response = new Promise((resolve) => {
    const handled = handleScanMessage(
      buildScanRequest(target),
      resolve,
      runScan
    );

    expect(handled).toBe(true);
  });

  await expect(response).resolves.toMatchObject({
    status: "success",
    data: payload,
  });
  expect(runScan).toHaveBeenCalledWith(target);
});

test("returns an error response for invalid scan requests before running adapters", async () => {
  const runScan = vi.fn().mockResolvedValue(payload);
  const response = new Promise((resolve) => {
    const handled = handleScanMessage(
      { action: SCAN_WEBSITE_ACTION, target: {} },
      resolve,
      runScan
    );

    expect(handled).toBe(true);
  });

  await expect(response).resolves.toMatchObject({
    status: "error",
    message: INVALID_SCAN_TARGET_MESSAGE,
  });
  expect(runScan).not.toHaveBeenCalled();
});

test("ignores unrelated runtime messages", () => {
  expect(handleScanMessage({ action: "other" }, vi.fn())).toBe(false);
});
