import {
  SCAN_WEBSITE_ACTION,
  buildScanTarget,
  scanActiveTab,
} from "./scanClient";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

test("builds a scan target from a URL", () => {
  expect(buildScanTarget("https://example.com/path?query=1", 7)).toEqual({
    tabId: 7,
    protocol: "https:",
    hostname: "example.com",
    pageOrigin: "https://example.com",
    url: "https://example.com/path",
  });
});

test("rejects non-web scan targets", () => {
  expect(() => buildScanTarget("file:///C:/tmp/page.html", 7)).toThrow(
    "Floun can scan HTTP and HTTPS tabs only."
  );
});

test("requests scans directly from the background service worker", async () => {
  const sendMessage = vi.fn((message, callback) => {
    callback({
      status: "success",
      data: {
        tokens: [],
        jsScripts: [],
        headers: {},
        TLS: null,
        certificates: null,
        scanMeta: {
          page: { status: "complete" },
          tls: { status: "unavailable", message: "TLS unavailable." },
          certificates: { status: "unavailable", message: "Certificate unavailable." },
          warnings: [
            "TLS scan unavailable: TLS unavailable.",
            "Certificate scan unavailable: Certificate unavailable.",
          ],
        },
      },
    });
  });
  const tabsSendMessage = vi.fn();

  vi.stubGlobal("chrome", {
    tabs: {
      query: vi.fn((_query, callback) => {
        callback([{ id: 7, url: "https://example.com/path?query=1" }]);
      }),
      sendMessage: tabsSendMessage,
    },
    runtime: {
      lastError: undefined,
      sendMessage,
    },
  });

  const payload = await scanActiveTab();

  expect(sendMessage).toHaveBeenCalledWith({
    action: SCAN_WEBSITE_ACTION,
    target: {
      tabId: 7,
      protocol: "https:",
      hostname: "example.com",
      pageOrigin: "https://example.com",
      url: "https://example.com/path",
    },
  }, expect.any(Function));
  expect(tabsSendMessage).not.toHaveBeenCalled();
  expect(payload.scanMeta.warnings).toHaveLength(2);
});

test("rejects malformed background responses", async () => {
  vi.stubGlobal("chrome", {
    tabs: {
      query: vi.fn((_query, callback) => {
        callback([{ id: 7, url: "https://example.com/path?query=1" }]);
      }),
    },
    runtime: {
      lastError: undefined,
      sendMessage: vi.fn((_message, callback) => callback({ status: "success", data: {} })),
    },
  });

  await expect(scanActiveTab()).rejects.toThrow("Scan failed.");
});

test("rejects tab query runtime errors with the Chrome error message", async () => {
  vi.stubGlobal("chrome", {
    tabs: {
      query: vi.fn((_query, callback) => {
        callback([]);
      }),
    },
    runtime: {
      lastError: { message: "Cannot access active tab." },
      sendMessage: vi.fn(),
    },
  });

  await expect(scanActiveTab()).rejects.toThrow("Cannot access active tab.");
});

test("rejects background runtime errors with the Chrome error message", async () => {
  vi.stubGlobal("chrome", {
    tabs: {
      query: vi.fn((_query, callback) => {
        callback([{ id: 7, url: "https://example.com/path?query=1" }]);
      }),
    },
    runtime: {
      lastError: undefined as chrome.runtime.LastError | undefined,
      sendMessage: vi.fn((_message, callback) => {
        chrome.runtime.lastError = { message: "Background worker is unavailable." };
        callback(undefined);
      }),
    },
  });

  await expect(scanActiveTab()).rejects.toThrow("Background worker is unavailable.");
});
