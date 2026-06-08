import { resolveReportAssetUrl } from "./pdfService";

test("resolveReportAssetUrl uses chrome runtime URLs when available", () => {
  const chromeApi = {
    runtime: {
      getURL: (assetPath: string) => `chrome-extension://floun/${assetPath}`,
    },
  };

  expect(resolveReportAssetUrl("icons/floun.png", chromeApi)).toBe(
    "chrome-extension://floun/icons/floun.png"
  );
});

test("resolveReportAssetUrl falls back to the relative asset path outside Chrome", () => {
  expect(resolveReportAssetUrl("icons/floun.png", undefined)).toBe("icons/floun.png");
});

