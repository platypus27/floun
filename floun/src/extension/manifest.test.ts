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

test("declares a strict extension page content security policy", () => {
  const manifestData = manifest as Record<string, unknown>;
  const csp = manifestData.content_security_policy as Record<string, unknown> | undefined;
  const extensionPagesCsp = csp?.extension_pages;

  expect(extensionPagesCsp).toBe("script-src 'self'; object-src 'self';");
  expect(extensionPagesCsp).not.toContain("'unsafe-inline'");
  expect(extensionPagesCsp).not.toContain("'unsafe-eval'");
  expect(extensionPagesCsp).not.toMatch(/https?:\/\//);
});
