import { executePageScan } from "./pageScanAdapter";

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubChromeWithResult(result: unknown, lastError?: { message?: string }) {
  vi.stubGlobal("chrome", {
    runtime: { lastError },
    scripting: {
      executeScript: vi.fn((_details, callback) => {
        callback([{ result }]);
      }),
    },
  });
}

test("returns complete page scan data when injection succeeds", async () => {
  stubChromeWithResult({
    tokens: ["token"],
    headers: { "Content-Type": "text/html" },
    jsScripts: [{ type: "inline", content: "MD5(input)" }],
  });

  await expect(executePageScan(7, "https://example.com")).resolves.toMatchObject({
    data: {
      tokens: ["token"],
      headers: { "Content-Type": "text/html" },
      jsScripts: [{ type: "inline", content: "MD5(input)" }],
    },
    meta: { status: "complete" },
  });
});

test("returns unavailable metadata for scripting runtime errors", async () => {
  stubChromeWithResult(undefined, { message: "Cannot access tab" });

  await expect(executePageScan(7, "https://example.com")).resolves.toMatchObject({
    data: { tokens: [], headers: {}, jsScripts: [] },
    meta: { status: "unavailable", message: "Cannot access tab" },
  });
});

test("returns partial metadata for page collector errors", async () => {
  stubChromeWithResult({ error: "Storage blocked" });

  await expect(executePageScan(7, "https://example.com")).resolves.toMatchObject({
    data: { tokens: [], headers: {}, jsScripts: [] },
    meta: { status: "partial", message: "Storage blocked" },
  });
});

test("returns partial metadata when injection produces no collector payload", async () => {
  stubChromeWithResult(undefined);

  await expect(executePageScan(7, "https://example.com")).resolves.toMatchObject({
    data: { tokens: [], headers: {}, jsScripts: [] },
    meta: { status: "partial", message: "Page collector returned malformed data." },
  });
});

test("normalizes malformed page collector data instead of leaking invalid payloads", async () => {
  stubChromeWithResult({
    tokens: [" usable-token ", 42, ""],
    headers: { "Content-Type": "text/html", "Bad-Header": 7 },
    jsScripts: [{ type: "inline", content: "MD5(input)" }, "bad-script"],
  });

  await expect(executePageScan(7, "https://example.com")).resolves.toMatchObject({
    data: {
      tokens: ["usable-token"],
      headers: { "Content-Type": "text/html" },
      jsScripts: [{ type: "inline", content: "MD5(input)" }],
    },
    meta: { status: "partial", message: "Page collector returned malformed data." },
  });
});
