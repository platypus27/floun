import {
  INVALID_SCAN_TARGET_MESSAGE,
  SCAN_WEBSITE_ACTION,
  buildScanErrorResponse,
  buildScanRequest,
  buildScanSuccessResponse,
  buildScanTarget,
  getScanResponseErrorMessage,
  isScanActionMessage,
  isScanErrorResponse,
  isScanRequest,
  isScanSuccessResponse,
  isValidScanTarget,
} from "./scanProtocol";
import type { ScanPayload, ScanTarget } from "./scanTypes";

const target: ScanTarget = {
  tabId: 7,
  protocol: "https:",
  hostname: "example.com",
  pageOrigin: "https://example.com",
  url: "https://example.com/path",
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

test("builds and validates scan targets from web URLs", () => {
  expect(buildScanTarget("https://example.com/path?query=1", 7)).toEqual({
    tabId: 7,
    protocol: "https:",
    hostname: "example.com",
    pageOrigin: "https://example.com",
    url: "https://example.com/path?query=1",
  });

  expect(isValidScanTarget(target)).toBe(true);
  expect(isValidScanTarget({ ...target, url: "" })).toBe(false);
  expect(() => buildScanTarget("file:///C:/tmp/page.html", 7)).toThrow(
    "Floun can scan HTTP and HTTPS tabs only."
  );
});

test("builds scan requests and rejects invalid target shapes", () => {
  expect(buildScanRequest(target)).toEqual({
    action: SCAN_WEBSITE_ACTION,
    target,
  });
  expect(isScanActionMessage({ action: SCAN_WEBSITE_ACTION, target: {} })).toBe(true);
  expect(isScanRequest({ action: SCAN_WEBSITE_ACTION, target })).toBe(true);
  expect(isScanRequest({ action: SCAN_WEBSITE_ACTION, target: {} })).toBe(false);
  expect(() => buildScanRequest({ ...target, hostname: "" })).toThrow(INVALID_SCAN_TARGET_MESSAGE);
});

test("builds and validates scan responses", () => {
  const successResponse = buildScanSuccessResponse(payload);
  const errorResponse = buildScanErrorResponse("Scan failed.");

  expect(isScanSuccessResponse(successResponse)).toBe(true);
  expect(isScanSuccessResponse({ status: "success" })).toBe(false);
  expect(isScanSuccessResponse({ status: "success", data: {} })).toBe(false);
  expect(isScanErrorResponse(errorResponse)).toBe(true);
  expect(getScanResponseErrorMessage(errorResponse)).toBe("Scan failed.");
  expect(getScanResponseErrorMessage({ status: "unknown" })).toBe("Scan failed.");
});
