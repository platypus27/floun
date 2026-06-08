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
  expect(buildScanTarget("https://user:pass@example.com/path?query=1", 7)).toEqual({
    tabId: 7,
    protocol: "https:",
    hostname: "example.com",
    pageOrigin: "https://example.com",
    url: "https://example.com/path?query=1",
  });

  expect(isValidScanTarget(target)).toBe(true);
  expect(isValidScanTarget({ ...target, url: "" })).toBe(false);
  expect(isValidScanTarget({ ...target, url: "https://user:pass@example.com/path" })).toBe(false);
  expect(isValidScanTarget({ ...target, hostname: "other.example" })).toBe(false);
  expect(isValidScanTarget({ ...target, pageOrigin: "https://other.example" })).toBe(false);
  expect(isValidScanTarget({ ...target, protocol: "http:" })).toBe(false);
  expect(isValidScanTarget({ ...target, tabId: -1 })).toBe(false);
  expect(() => buildScanTarget("https://example.com/path", -1)).toThrow(
    "Floun can scan HTTP and HTTPS tabs only."
  );
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
  expect(isScanRequest({ action: SCAN_WEBSITE_ACTION, target: { ...target, tabId: -1 } })).toBe(false);
  expect(() => buildScanRequest({ ...target, hostname: "" })).toThrow(INVALID_SCAN_TARGET_MESSAGE);
  expect(() => buildScanRequest({ ...target, tabId: -1 })).toThrow(INVALID_SCAN_TARGET_MESSAGE);
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

test("rejects malformed normalized scan facts in success responses", () => {
  expect(isScanSuccessResponse({
    status: "success",
    data: {
      ...payload,
      TLS: { provider: "ssl-labs", endpoints: [{ protocolVersions: ["TLS 1.3"], cipherSuites: [7] }] },
    },
  })).toBe(false);

  expect(isScanSuccessResponse({
    status: "success",
    data: {
      ...payload,
      certificates: { provider: "ssl-checker", signatureAlgorithm: "" },
    },
  })).toBe(false);

  expect(isScanSuccessResponse({
    status: "success",
    data: {
      ...payload,
      certificates: { provider: "other-provider", signatureAlgorithm: "sha256" },
    },
  })).toBe(false);
});

test("rejects malformed page header facts in success responses", () => {
  expect(isScanSuccessResponse({
    status: "success",
    data: {
      ...payload,
      headers: { "Content-Type": 7 },
    },
  })).toBe(false);

  expect(isScanSuccessResponse({
    status: "success",
    data: {
      ...payload,
      headers: { "": "text/html" },
    },
  })).toBe(false);
});

test("rejects malformed scan metadata in success responses", () => {
  expect(isScanSuccessResponse({
    status: "success",
    data: {
      ...payload,
      scanMeta: {
        page: { status: "done" },
        tls: { status: "complete" },
        certificates: { status: "complete" },
        warnings: [],
      },
    },
  })).toBe(false);

  expect(isScanSuccessResponse({
    status: "success",
    data: {
      ...payload,
      scanMeta: {
        page: { status: "complete" },
        tls: { status: "complete", message: 42 },
        certificates: { status: "complete" },
        warnings: [],
      },
    },
  })).toBe(false);

  expect(isScanSuccessResponse({
    status: "success",
    data: {
      ...payload,
      scanMeta: {
        page: { status: "complete" },
        tls: { status: "complete" },
        certificates: { status: "complete" },
        warnings: [7],
      },
    },
  })).toBe(false);
});
