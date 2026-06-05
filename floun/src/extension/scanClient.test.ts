import { buildScanTarget } from "./scanClient";

test("builds a scan target from a URL", () => {
  expect(buildScanTarget("https://example.com/path?query=1")).toEqual({
    protocol: "https:",
    hostname: "example.com",
  });
});

