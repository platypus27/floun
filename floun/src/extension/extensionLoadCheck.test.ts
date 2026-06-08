declare const process: { cwd: () => string };
declare function require(moduleName: string): any;

const { join } = require("path");
const { pathToFileURL } = require("url");

const extensionLoadCheckModuleUrl = pathToFileURL(
  join(process.cwd(), "scripts", "check-extension-load.mjs")
).href;

async function loadExtensionCheckModule() {
  return await import(extensionLoadCheckModuleUrl);
}

test("classifies branded Chrome extension flag removal logs", async () => {
  const { classifyLaunchLog } = await loadExtensionCheckModule();

  expect(classifyLaunchLog([
    "--disable-extensions-except is not allowed in Google Chrome, ignoring.",
  ].join("\n"))).toEqual({
    status: "unsupported-branded-chrome",
    message: "Google Chrome ignored command-line extension loading flags.",
  });

  expect(classifyLaunchLog([
    "--load-extension is not allowed in Google Chrome, ignoring.",
  ].join("\n"))).toEqual({
    status: "unsupported-branded-chrome",
    message: "Google Chrome ignored command-line extension loading flags.",
  });
});

test("detects Floun from extension records and inspected worker manifests", async () => {
  const { findLoadedFlounExtension } = await loadExtensionCheckModule();

  expect(findLoadedFlounExtension({
    extensionPath: "C:\\repo\\floun\\build",
    extensionRecords: [
      {
        id: "abcdefghijklmnopabcdefghijklmnop",
        name: "Floun",
        path: "C:\\repo\\floun\\build",
        version: "2.0.0",
      },
    ],
    inspectedTargets: [],
  })).toEqual({
    id: "abcdefghijklmnopabcdefghijklmnop",
    name: "Floun",
    source: "profile-preferences",
    version: "2.0.0",
  });

  expect(findLoadedFlounExtension({
    extensionPath: "C:\\repo\\floun\\build",
    extensionRecords: [],
    inspectedTargets: [
      {
        id: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        manifestName: "Floun",
        manifestVersion: "2.0.0",
        targetType: "service_worker",
        url: "chrome-extension://bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb/background.js",
      },
    ],
  })).toEqual({
    id: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    name: "Floun",
    source: "runtime-manifest",
    version: "2.0.0",
  });
});

test("summarizes unsupported branded Chrome with a concrete next step", async () => {
  const { summarizeLoadFailure } = await loadExtensionCheckModule();

  expect(summarizeLoadFailure({
    browser: "Chrome/148.0.7778.168",
    classification: {
      status: "unsupported-branded-chrome",
      message: "Google Chrome ignored command-line extension loading flags.",
    },
    extensionPath: "C:\\repo\\floun\\build",
    stderrTail: [
      "--disable-extensions-except is not allowed in Google Chrome, ignoring.",
    ],
  })).toContain("Use Chrome for Testing or Chromium for automated extension-load QA, or load the unpacked build manually from chrome://extensions.");
});

test("removeDirectoryWithRetries retries transient Windows cleanup errors", async () => {
  const { removeDirectoryWithRetries } = await loadExtensionCheckModule();
  let attempts = 0;

  await removeDirectoryWithRetries("C:\\temp\\floun-profile", {
    delayFn: async () => undefined,
    rmImpl: () => {
      attempts += 1;

      if (attempts < 3) {
        throw Object.assign(new Error("EPERM"), { code: "EPERM" });
      }
    },
  });

  expect(attempts).toBe(3);
});

export {};
