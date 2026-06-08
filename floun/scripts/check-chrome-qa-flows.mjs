import { spawn, execFileSync } from "node:child_process";
import { createServer } from "node:http";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
} from "node:fs";
import { tmpdir } from "node:os";
import {
  dirname,
  join,
  resolve,
} from "node:path";
import {
  fileURLToPath,
  pathToFileURL,
} from "node:url";
import { removeDirectoryWithRetries } from "./check-extension-load.mjs";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDir, "..");
const repoRoot = resolve(projectRoot, "..");
const defaultExtensionPath = join(projectRoot, "build");
const fixtureRoot = join(projectRoot, "fixtures");

const requiredScenarioIds = ["fixture", "https", "http", "unsupported", "pdf"];

const fixtureRawTokens = [
  "0123456789abcdef0123456789abcdef",
  "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKL",
  "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJmbG91biJ9.c2lnbmF0dXJl",
  "v1_flounreleasecandidate20260605",
  "QABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890==",
];

const sleep = (ms) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms));

export function findRawTokenLeaks(bytes, tokens = fixtureRawTokens) {
  const latinText = Buffer.from(bytes).toString("latin1");
  const utf8Text = Buffer.from(bytes).toString("utf8");

  return tokens.filter((token) => latinText.includes(token) || utf8Text.includes(token));
}

export function assertRequiredScenarioResults(results) {
  const missingScenarioIds = requiredScenarioIds.filter((scenarioId) => (
    !results.some((result) => result.id === scenarioId)
  ));

  if (missingScenarioIds.length > 0) {
    throw new Error(`Chrome QA is missing required scenarios: ${missingScenarioIds.join(", ")}`);
  }

  const failedScenarios = results.filter((result) => !result.passed);

  if (failedScenarios.length > 0) {
    throw new Error(`Chrome QA failed scenarios: ${
      failedScenarios.map((result) => `${result.label}: ${result.evidence}`).join("; ")
    }`);
  }
}

function findBrowserBinary() {
  const explicitCandidates = [
    process.env.FLOUN_CHROME_BIN,
    process.env.FLOUN_CHROME_FOR_TESTING,
    process.env.FLOUN_CHROMIUM_BIN,
  ].filter(Boolean);

  const localChromeForTestingRoot = join(
    process.env.LOCALAPPDATA || "",
    "Codex",
    "ChromeForTesting"
  );
  const localChromeForTestingCandidates = existsSync(localChromeForTestingRoot)
    ? readdirSync(localChromeForTestingRoot)
      .map((version) => join(localChromeForTestingRoot, version, "chrome-win64", "chrome.exe"))
      .filter((candidate) => existsSync(candidate))
      .sort()
      .reverse()
    : [];

  const commonCandidates = [
    "C:\\Program Files\\Google\\Chrome for Testing\\Application\\chrome.exe",
    "C:\\Program Files\\Chromium\\Application\\chrome.exe",
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  ];

  return [...explicitCandidates, ...localChromeForTestingCandidates, ...commonCandidates]
    .find((candidate) => existsSync(candidate)) || "";
}

async function fetchJson(url) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`${url} returned HTTP ${response.status}`);
  }

  return await response.json();
}

async function waitForBrowser(port) {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    try {
      return await fetchJson(`http://127.0.0.1:${port}/json/version`);
    } catch {
      await sleep(250);
    }
  }

  throw new Error("Timed out waiting for Chrome for Testing.");
}

class CdpClient {
  constructor(webSocketUrl) {
    this.webSocket = new WebSocket(webSocketUrl);
    this.commandId = 0;
    this.pendingCommands = new Map();
    this.events = [];

    this.webSocket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);

      if (message.id && this.pendingCommands.has(message.id)) {
        const pendingCommand = this.pendingCommands.get(message.id);
        this.pendingCommands.delete(message.id);

        if (message.error) {
          pendingCommand.reject(new Error(JSON.stringify(message.error)));
        } else {
          pendingCommand.resolve(message.result);
        }

        return;
      }

      this.events.push(message);
    });
  }

  async open() {
    await new Promise((resolveOpen, rejectOpen) => {
      this.webSocket.addEventListener("open", resolveOpen, { once: true });
      this.webSocket.addEventListener("error", rejectOpen, { once: true });
    });
  }

  send(method, params = {}, timeoutMs = 30_000) {
    const id = ++this.commandId;
    this.webSocket.send(JSON.stringify({ id, method, params }));

    return new Promise((resolveSend, rejectSend) => {
      this.pendingCommands.set(id, { resolve: resolveSend, reject: rejectSend });
      setTimeout(() => {
        if (!this.pendingCommands.has(id)) {
          return;
        }

        this.pendingCommands.delete(id);
        rejectSend(new Error(`${method} timed out.`));
      }, timeoutMs);
    });
  }

  close() {
    try {
      this.webSocket.close();
    } catch {
      // Best-effort cleanup.
    }
  }
}

function startFixtureServer() {
  return new Promise((resolveServer) => {
    const server = createServer((request, response) => {
      const requestUrl = new URL(request.url || "/", "http://127.0.0.1");
      const fixtureName = requestUrl.pathname === "/"
        ? "crypto-readiness.html"
        : requestUrl.pathname.replace(/^\//, "");
      const fixturePath = join(fixtureRoot, fixtureName);

      if (!fixturePath.startsWith(fixtureRoot) || !existsSync(fixturePath)) {
        response.writeHead(404);
        response.end("not found");
        return;
      }

      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      response.end(readFileSync(fixturePath));
    });

    server.listen(0, "127.0.0.1", () => resolveServer(server));
  });
}

async function evaluateTarget(target, expression) {
  const targetClient = new CdpClient(target.webSocketDebuggerUrl);
  await targetClient.open();

  try {
    return await targetClient.send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
      userGesture: true,
    });
  } finally {
    targetClient.close();
  }
}

async function waitForTarget(port, predicate, timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const targets = await fetchJson(`http://127.0.0.1:${port}/json/list`);
    const target = targets.find(predicate);

    if (target) {
      return target;
    }

    await sleep(250);
  }

  return null;
}

function isFlounPopupTarget(extensionId) {
  return (target) => (
    target.url === `chrome-extension://${extensionId}/index.html` ||
    target.url?.startsWith(`chrome-extension://${extensionId}/index.html`)
  );
}

async function scanUrl({
  browserClient,
  extensionId,
  label,
  port,
  url,
  waitMs,
}) {
  const createdTarget = await browserClient.send("Target.createTarget", {
    url,
    forTab: true,
    background: false,
    focus: true,
  });
  await sleep(3_500);
  await browserClient.send("Target.activateTarget", { targetId: createdTarget.targetId });
  await browserClient.send("Extensions.triggerAction", {
    id: extensionId,
    targetId: createdTarget.targetId,
  });
  await sleep(1_000);

  let popupTarget = await waitForTarget(port, isFlounPopupTarget(extensionId), 5_000);

  if (!popupTarget) {
    throw new Error(`${label}: popup target was not created.`);
  }

  await evaluateTarget(popupTarget, "document.getElementById('scanBtn').click();");

  const deadline = Date.now() + waitMs;
  let snapshot = null;

  while (Date.now() < deadline) {
    await sleep(1_000);
    popupTarget = await waitForTarget(port, isFlounPopupTarget(extensionId), 1_000) || popupTarget;

    const snapshotResult = await evaluateTarget(popupTarget, `({
      text: document.body.innerText,
      generate: Boolean(document.getElementById('generateReportBtn')),
      error: /Error:/.test(document.body.innerText),
      warnings: Array.from(document.querySelectorAll('.scan-warnings li')).map((item) => item.textContent),
      total: document.querySelector('.total-occurrences')?.textContent || '',
      sections: Array.from(document.querySelectorAll('.results-dropdown summary')).map((item) => item.textContent),
    })`);
    snapshot = snapshotResult.result.value;

    if (snapshot.generate || snapshot.error) {
      break;
    }
  }

  return { popupTarget, snapshot };
}

function buildScenarioResult(id, label, passed, evidence) {
  return { id, label, passed, evidence };
}

function validateFixtureScan(snapshot) {
  const hasSections = ["JavaScript Results", "Tokens Results", "TLS Results", "Certificates Results"]
    .every((section) => snapshot.sections.includes(section));
  const hasCertificateWarning = snapshot.warnings
    .some((warning) => warning.includes("Certificate scan unavailable"));
  const passed = Boolean(snapshot.generate) &&
    !snapshot.error &&
    Number(snapshot.total) >= 20 &&
    hasSections &&
    hasCertificateWarning;

  return buildScenarioResult(
    "fixture",
    "Local fixture scan",
    passed,
    `total=${snapshot.total}; warnings=${snapshot.warnings.join(" | ")}`
  );
}

function validateHttpsScan(snapshot) {
  const passed = Boolean(snapshot.generate) &&
    !snapshot.error &&
    snapshot.sections.includes("TLS Results") &&
    snapshot.sections.includes("Certificates Results");

  return buildScenarioResult(
    "https",
    "Known HTTPS scan",
    passed,
    `total=${snapshot.total}; warnings=${snapshot.warnings.join(" | ") || "none"}`
  );
}

function validateHttpScan(snapshot) {
  const hasCertificateWarning = snapshot.warnings
    .some((warning) => warning.includes("Certificate scan unavailable"));
  const passed = Boolean(snapshot.generate) && !snapshot.error && hasCertificateWarning;

  return buildScenarioResult(
    "http",
    "HTTP certificate warning",
    passed,
    `total=${snapshot.total}; warnings=${snapshot.warnings.join(" | ")}`
  );
}

function validateUnsupportedScan(snapshot) {
  const expectedError = "Floun can scan HTTP and HTTPS tabs only.";
  const passed = snapshot.error && snapshot.text.includes(expectedError);

  return buildScenarioResult(
    "unsupported",
    "Unsupported page handling",
    passed,
    snapshot.text.replace(/\s+/g, " ").trim()
  );
}

function findDownloadedPdf(downloadDir) {
  return readdirSync(downloadDir)
    .filter((name) => name.toLowerCase().endsWith(".pdf"))
    .map((name) => join(downloadDir, name))
    .find((path) => statSync(path).size > 0) || "";
}

async function generateFixtureReport({
  downloadDir,
  popupTarget,
}) {
  await evaluateTarget(popupTarget, "document.getElementById('generateReportBtn').click();");

  for (let attempt = 0; attempt < 160; attempt += 1) {
    await sleep(500);
    const pdfPath = findDownloadedPdf(downloadDir);

    if (pdfPath) {
      const pdfBytes = readFileSync(pdfPath);
      const leakedTokens = findRawTokenLeaks(pdfBytes);

      return {
        pdfPath,
        pdfBytes,
        leakedTokens,
      };
    }
  }

  throw new Error("PDF report was not downloaded.");
}

function validatePdfReport(pdfResult) {
  const passed = pdfResult.pdfBytes.length > 0 && pdfResult.leakedTokens.length === 0;

  return buildScenarioResult(
    "pdf",
    "PDF redaction",
    passed,
    `file=${pdfResult.pdfPath.split(/[\\/]/).pop()}; size=${pdfResult.pdfBytes.length}; rawTokenLeaks=${pdfResult.leakedTokens.length}`
  );
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

async function runChromeQaFlows({
  browserPath,
  extensionPath,
}) {
  const fixtureServer = await startFixtureServer();
  const fixtureUrl = `http://127.0.0.1:${fixtureServer.address().port}/crypto-readiness.html`;
  const profile = join(tmpdir(), `floun-chrome-qa-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  const downloadDir = join(tmpdir(), `floun-chrome-qa-download-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  const port = 62_000 + Math.floor(Math.random() * 1_500);
  const child = spawn(browserPath, [
    `--user-data-dir=${profile}`,
    `--remote-debugging-port=${port}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-sync",
    "about:blank",
  ], {
    stdio: ["ignore", "ignore", "pipe"],
    windowsHide: true,
  });
  let browserClient = null;

  mkdirSync(downloadDir, { recursive: true });

  try {
    const version = await waitForBrowser(port);
    browserClient = new CdpClient(version.webSocketDebuggerUrl);
    await browserClient.open();
    await browserClient.send("Browser.setDownloadBehavior", {
      behavior: "allow",
      downloadPath: downloadDir,
      eventsEnabled: true,
    });

    const loadResult = await browserClient.send("Extensions.loadUnpacked", {
      path: extensionPath,
    });
    const extensions = await browserClient.send("Extensions.getExtensions");
    const flounExtension = extensions.extensions.find((extension) => extension.id === loadResult.id);

    if (!flounExtension || flounExtension.name !== "Floun") {
      throw new Error(`Loaded extension was not Floun: ${JSON.stringify(flounExtension || loadResult)}`);
    }

    const results = [];
    const fixtureScan = await scanUrl({
      browserClient,
      extensionId: flounExtension.id,
      label: "Local fixture scan",
      port,
      url: fixtureUrl,
      waitMs: 90_000,
    });
    results.push(validateFixtureScan(fixtureScan.snapshot));

    const pdfResult = await generateFixtureReport({
      downloadDir,
      popupTarget: fixtureScan.popupTarget,
    });
    results.push(validatePdfReport(pdfResult));

    const httpsScan = await scanUrl({
      browserClient,
      extensionId: flounExtension.id,
      label: "Known HTTPS scan",
      port,
      url: "https://www.cloudflare.com/",
      waitMs: 150_000,
    });
    results.push(validateHttpsScan(httpsScan.snapshot));

    const httpScan = await scanUrl({
      browserClient,
      extensionId: flounExtension.id,
      label: "HTTP certificate warning",
      port,
      url: "http://example.com/",
      waitMs: 100_000,
    });
    results.push(validateHttpScan(httpScan.snapshot));

    const unsupportedScan = await scanUrl({
      browserClient,
      extensionId: flounExtension.id,
      label: "Unsupported page handling",
      port,
      url: "chrome://extensions/",
      waitMs: 30_000,
    });
    results.push(validateUnsupportedScan(unsupportedScan.snapshot));

    assertRequiredScenarioResults(results);

    return {
      browser: version.Browser,
      extensionId: flounExtension.id,
      extensionVersion: flounExtension.version,
      fixtureUrl,
      results,
    };
  } finally {
    browserClient?.close();
    fixtureServer.close();
    killBrowserProfileProcesses(profile, child);
    await sleep(500);
    await removeDirectoryWithRetries(profile);
    await removeDirectoryWithRetries(downloadDir);
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
    throw new Error("No Chrome for Testing, Chromium, or Chrome binary was found. Set FLOUN_CHROME_BIN to a compatible browser.");
  }

  const result = await runChromeQaFlows({
    browserPath,
    extensionPath,
  });

  console.log("Chrome QA flows verified.");
  console.log(`Browser: ${result.browser}`);
  console.log(`Extension ID: ${result.extensionId}`);
  console.log(`Extension version: ${result.extensionVersion}`);
  console.log(`Fixture URL: ${result.fixtureUrl}`);
  result.results.forEach((scenario) => {
    console.log(` - ${scenario.label}: ${scenario.passed ? "Pass" : "Fail"} (${scenario.evidence})`);
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message || String(error));
    process.exitCode = 1;
  });
}
