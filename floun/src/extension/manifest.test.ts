import manifest from "../../public/manifest.json";

test("keeps extension permissions scoped to active scans and API hosts", () => {
  const manifestData = manifest as Record<string, unknown>;
  const hostPermissions = manifest.host_permissions ?? [];

  expect(manifest.permissions).toEqual(["activeTab", "scripting"]);
  expect(hostPermissions).toEqual([
    "https://api.ssllabs.com/*",
    "https://ssl-checker.io/*",
  ]);
  expect(hostPermissions).not.toContain("<all_urls>");
  expect(hostPermissions).not.toContain("file://*/*");
  expect(manifestData.content_scripts).toBeUndefined();
});
