import { spawn, execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import {
  dirname,
  join,
  normalize,
  resolve,
} from "node:path";
import {
  fileURLToPath,
  pathToFileURL,
} from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDir, "..");
const defaultExtensionPath = join(projectRoot, "build");

const sleep = (ms) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms));

function normalizePath(value) {
  return normalize(String(value || "")).toLowerCase();
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function extensionIdFromUrl(url) {
  return /^chrome-extension:\/\/([a-p]{32})\//.exec(url || "")?.[1] || "";
}

export function classifyLaunchLog(logText) {
  const normalizedLog = String(logText || "").toLowerCase();

  if (
    normalizedLog.includes("--load-extension is not allowed in google chrome") ||
    normalizedLog.includes("--disable-extensions-except is not allowed in google chrome")
  ) {
    return {
      status: "unsupported-branded-chrome",
      message: "Google Chrome ignored command-line extension loading flags.",
    };
  }

  if (
    normalizedLog.includes("failed to load extension") ||
    normalizedLog.includes("could not load manifest")
  ) {
    return {
      status: "extension-load-error",
      message: "The browser reported an unpacked extension load error.",
    };
  }

  return {
    status: "unknown",
    message: "Floun was not observed in the launched browser profile.",
  };
}

export function findLoadedFlounExtension({
  extensionPath,
  extensionRecords,
  inspectedTargets,
}) {
  const expectedPath = normalizePath(extensionPath);
  const record = extensionRecords.find((candidate) => (
    candidate.name === "Floun" &&
    (!candidate.path || normalizePath(candidate.path) === expectedPath)
  ));

  if (record) {
    return {
      id: record.id,
      name: "Floun",
      source: "profile-preferences",
      version: record.version || "",
    };
  }

  const inspectedTarget = inspectedTargets.find((candidate) => candidate.manifestName === "Floun");

  if (inspectedTarget) {
    return {
      id: inspectedTarget.id,
      name: "Floun",
      source: "runtime-manifest",
      version: inspectedTarget.manifestVersion || "",
    };
  }

  return null;
}

export function summarizeLoadFailure({
  browser,
  classification,
  extensionPath,
  stderrTail,
}) {
  const lines = [
    "Floun extension-load QA did not verify the unpacked build.",
    `Browser: ${browser || "unknown"}`,
    `Extension path: ${extensionPath}`,
    `Reason: ${classification.message}`,
  ];

  if (classification.status === "unsupported-branded-chrome") {
    lines.push(
      "Use Chrome for Testing or Chromium for automated extension-load QA, or load the unpacked build manually from chrome://extensions."
    );
  }

  const relevantLogLines = stderrTail.filter((line) => line.trim().length > 0).slice(-8);

  if (relevantLogLines.length > 0) {
    lines.push("Relevant browser log tail:");
    lines.push(...relevantLogLines.map((line) => `  ${line}`));
  }

  return lines.join("\n");
}

export async function removeDirectoryWithRetries(
  directoryPath,
  {
    attempts = 8,
    delayMs = 250,
    delayFn = sleep,
    rmImpl = rmSync,
  } = {}
) {
  let lastError = null;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      rmImpl(directoryPath, { recursive: true, force: true });
      return;
    } catch (error) {
      lastError = error;
      await delayFn(delayMs);
    }
  }

  throw lastError;
}

function findBrowserBinary() {
  const explicitCandidates = [
    process.env.FLOUN_CHROME_BIN,
    process.env.FLOUN_CHROME_FOR_TESTING,
    process.env.FLOUN_CHROMIUM_BIN,
  ].filter(Boolean);

  const commonCandidates = [
    "C:\\Program Files\\Google\\Chrome for Testing\\Application\\chrome.exe",
    "C:\\Program Files\\Chromium\\Application\\chrome.exe",
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  ];

  return [...explicitCandidates, ...commonCandidates].find((candidate) => existsSync(candidate)) || "";
}

function readExtensionRecords(profile) {
  const preferencesPath = join(profile, "Default", "Preferences");

  if (!existsSync(preferencesPath)) {
    return [];
  }

  const preferences = readJson(preferencesPath);
  const settings = preferences.extensions?.settings || {};

  return Object.entries(settings).map(([id, value]) => ({
    id,
    name: value.manifest?.name || "",
    path: value.path || "",
    version: value.manifest?.version || "",
  }));
}

async function fetchJson(port, path) {
  const response = await fetch(`http://127.0.0.1:${port}${path}`);

  if (!response.ok) {
    throw new Error(`${path} returned HTTP ${response.status}`);
  }

  return await response.json();
}

async function waitForBrowser(port) {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    try {
      return await fetchJson(port, "/json/version");
    } catch {
      await sleep(250);
    }
  }

  throw new Error("Timed out waiting for the browser debugging endpoint.");
}

async function inspectRuntimeManifest(target) {
  if (!target.webSocketDebuggerUrl || typeof WebSocket !== "function") {
    return null;
  }

  return await new Promise((resolveInspect) => {
    const socket = new WebSocket(target.webSocketDebuggerUrl);
    const timeout = setTimeout(() => {
      try {
        socket.close();
      } catch {
        // Ignore cleanup failures while reporting inspection as unavailable.
      }

      resolveInspect(null);
    }, 3000);

    socket.addEventListener("open", () => {
      socket.send(JSON.stringify({
        id: 1,
        method: "Runtime.evaluate",
        params: {
          expression: "chrome.runtime.getManifest()",
          returnByValue: true,
        },
      }));
    });

    socket.addEventListener("message", (event) => {
      const response = JSON.parse(event.data);

      if (response.id !== 1) {
        return;
      }

      clearTimeout(timeout);
      socket.close();

      const manifest = response.result?.result?.value;

      if (!manifest || typeof manifest.name !== "string") {
        resolveInspect(null);
        return;
      }

      resolveInspect({
        id: extensionIdFromUrl(target.url),
        manifestName: manifest.name,
        manifestVersion: manifest.version || "",
        targetType: target.type || "",
        url: target.url || "",
      });
    });

    socket.addEventListener("error", () => {
      clearTimeout(timeout);
      resolveInspect(null);
    });
  });
}

async function inspectExtensionTargets(targets) {
  const extensionTargets = targets.filter((target) => (
    typeof target.url === "string" &&
    target.url.startsWith("chrome-extension://")
  ));

  const inspectedTargets = [];

  for (const target of extensionTargets) {
    const inspectedTarget = await inspectRuntimeManifest(target);

    if (inspectedTarget) {
      inspectedTargets.push(inspectedTarget);
    }
  }

  return inspectedTargets;
}

function killBrowserProfileProcesses(profile, child) {
  try {
    child.kill("SIGKILL");
  } catch {
    // The root process may already have exited.
  }

  try {
    execFileSync("powershell.exe", [
      "-NoProfile",
      "-Command",
      [
        "Get-CimInstance Win32_Process",
        `Where-Object { $_.CommandLine -like '*${profile.replaceAll("'", "''")}*' }`,
        "ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }",
      ].join(" | "),
    ], { stdio: "ignore" });
  } catch {
    // Best-effort cleanup for isolated QA browser processes only.
  }
}

async function runExtensionLoadCheck({
  browserPath,
  extensionPath,
}) {
  const profile = join(tmpdir(), `floun-extension-load-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  const port = 56000 + Math.floor(Math.random() * 1000);

  mkdirSync(profile, { recursive: true });

  const args = [
    `--user-data-dir=${profile}`,
    `--remote-debugging-port=${port}`,
    `--disable-extensions-except=${extensionPath}`,
    `--load-extension=${extensionPath}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-sync",
    "--enable-logging=stderr",
    "--vmodule=*/extensions/*=2,*/extension*/*=2",
    "about:blank",
  ];

  let stderr = "";
  const child = spawn(browserPath, args, {
    stdio: ["ignore", "ignore", "pipe"],
    windowsHide: true,
  });

  child.stderr.on("data", (chunk) => {
    stderr += chunk.toString();
    stderr = stderr.slice(-20000);
  });

  try {
    const version = await waitForBrowser(port);
    await sleep(5000);
    const targets = await fetchJson(port, "/json/list");
    const extensionRecords = readExtensionRecords(profile);
    const inspectedTargets = await inspectExtensionTargets(targets);
    const loadedFloun = findLoadedFlounExtension({
      extensionPath,
      extensionRecords,
      inspectedTargets,
    });

    if (loadedFloun) {
      return {
        browser: version.Browser || "",
        extension: loadedFloun,
      };
    }

    const relevantLogLines = stderr.split(/\r?\n/).filter((line) => (
      /extension|manifest|error|fail|load|not allowed/i.test(line)
    ));
    const priorityLogLines = relevantLogLines.filter((line) => (
      /not allowed|failed to load|could not load manifest/i.test(line)
    ));
    const stderrTail = [...new Set([
      ...priorityLogLines,
      ...relevantLogLines.slice(-8),
    ])];

    throw new Error(summarizeLoadFailure({
      browser: version.Browser || "",
      classification: classifyLaunchLog(stderr),
      extensionPath,
      stderrTail,
    }));
  } finally {
    killBrowserProfileProcesses(profile, child);
    await sleep(500);
    await removeDirectoryWithRetries(profile);
  }
}

async function main() {
  const extensionPath = resolve(process.argv[2] || defaultExtensionPath);
  const manifestPath = join(extensionPath, "manifest.json");

  if (!existsSync(manifestPath)) {
    throw new Error(`Build manifest is missing: ${manifestPath}. Run npm run build first.`);
  }

  const browserPath = findBrowserBinary();

  if (!browserPath) {
    throw new Error("No Chrome, Chrome for Testing, Chromium, or Edge binary was found. Set FLOUN_CHROME_BIN to a compatible browser.");
  }

  const result = await runExtensionLoadCheck({
    browserPath,
    extensionPath,
  });

  console.log("Floun extension-load QA verified the unpacked build.");
  console.log(`Browser: ${result.browser}`);
  console.log(`Extension ID: ${result.extension.id}`);
  console.log(`Extension version: ${result.extension.version}`);
  console.log(`Evidence source: ${result.extension.source}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message || String(error));
    process.exitCode = 1;
  });
}
