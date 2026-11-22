import { spawn, execFileSync } from "node:child_process";
import { createServer } from "node:http";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
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
const defaultExtensionPath = join(projectRoot, "build");
const fixtureRoot = join(projectRoot, "fixtures");

const requiredScenarioIds = ["fixture", "https", "http", "unsupported", "pdf", "byok"];

const fixtureRawTokens = [
  ["0123456789abcdef", "0123456789abcdef"].join(""),
  ["abcdefghijklmnopqr", "stuvwxyzABCDEFGHIJKL"].join(""),
  ["eyJhbGciOiJIUzI1NiJ9", "eyJzdWIiOiJmbG91biJ9", "c2lnbmF0dXJl"].join("."),
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

  async waitForEvent(method, timeoutMs = 30_000) {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      const eventIndex = this.events.findIndex((event) => event.method === method);

      if (eventIndex >= 0) {
        return this.events.splice(eventIndex, 1)[0];
      }

      await sleep(25);
    }

    throw new Error(`${method} event timed out.`);
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
  const existingPopupTargets = (await fetchJson(`http://127.0.0.1:${port}/json/list`))
    .filter(isFlounPopupTarget(extensionId));
  for (const target of existingPopupTargets) {
    await browserClient.send("Target.closeTarget", { targetId: target.id });
  }
  if (existingPopupTargets.length) await sleep(100);
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

  let popupTarget = await waitForTarget(port, (target) => (
    isFlounPopupTarget(extensionId)(target)
  ), 5_000);

  if (!popupTarget) {
    popupTarget = await waitForTarget(port, isFlounPopupTarget(extensionId), 2_000);
  }

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
      error: Boolean(document.querySelector('[data-scan-error="true"]')),
      warnings: Array.from(document.querySelectorAll('.scan-warnings li')).map((item) => item.textContent),
      total: document.querySelector('.total-occurrences')?.textContent.replace(/[^0-9]/g, '') || '',
      sections: Array.from(document.querySelectorAll('.module-title > span:first-child')).map((item) => item.textContent + ' Results'),
    })`);
    snapshot = snapshotResult.result.value;

    if (snapshot.generate || snapshot.error) {
      break;
    }
  }

  if (snapshot?.generate && !snapshot.error) {
    await evaluateTarget(popupTarget, `(() => {
      document.querySelectorAll('.module-title').forEach((item) => {
        const trigger = item.closest('button');
        if (trigger?.getAttribute('aria-expanded') === 'false') trigger.click();
      });
      return true;
    })()`);
    await sleep(250);
    const expandedSnapshot = await evaluateTarget(popupTarget, `({
        text: document.body.innerText,
        generate: Boolean(document.getElementById('generateReportBtn')),
        error: Boolean(document.querySelector('[data-scan-error="true"]')),
        warnings: Array.from(document.querySelectorAll('.scan-warnings li')).map((item) => item.textContent),
        total: document.querySelector('.total-occurrences')?.textContent.replace(/[^0-9]/g, '') || '',
        sections: Array.from(document.querySelectorAll('.module-title > span:first-child')).map((item) => item.textContent + ' Results'),
      })`);
    snapshot = expandedSnapshot.result.value;
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

export function validateHttpsScan(snapshot) {
  const hasUnavailableTransportWarning = snapshot.warnings.some((warning) => (
    warning.includes("TLS scan unavailable") || warning.includes("Certificate scan unavailable")
  ));
  const hasCertificateEvidence = snapshot.text.includes("Certificate uses ");
  const passed = Boolean(snapshot.generate) &&
    !snapshot.error &&
    snapshot.sections.includes("TLS Results") &&
    snapshot.sections.includes("Certificates Results") &&
    !hasUnavailableTransportWarning &&
    hasCertificateEvidence;

  return buildScenarioResult(
    "https",
    "Known HTTPS scan",
    passed,
    `total=${snapshot.total}; warnings=${snapshot.warnings.join(" | ") || "none"}; text=${snapshot.text.replace(/\s+/g, " ").trim().slice(0, 300)}`
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

function findDownloadedPdfs(downloadDir) {
  return readdirSync(downloadDir)
    .filter((name) => name.toLowerCase().endsWith(".pdf"))
    .map((name) => join(downloadDir, name))
    .filter((path) => statSync(path).size > 0);
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

async function capturePopupScreenshot(popupTarget, outputPath) {
  const client = new CdpClient(popupTarget.webSocketDebuggerUrl);
  await client.open();

  try {
    await client.send("Page.enable");
    // Optional: FLOUN_COLOR_SCHEME=light|dark pins prefers-color-scheme so artwork does not depend on the OS theme.
    if (["light", "dark"].includes(process.env.FLOUN_COLOR_SCHEME)) {
      await client.send("Emulation.setEmulatedMedia", {
        features: [{ name: "prefers-color-scheme", value: process.env.FLOUN_COLOR_SCHEME }],
      });
      // Let color transitions finish so the capture is not mid-animation.
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 1_000));
    }
    const metrics = await client.send("Page.getLayoutMetrics");
    const viewport = metrics.cssVisualViewport || metrics.visualViewport;
    const screenshot = await client.send("Page.captureScreenshot", {
      format: "png",
      captureBeyondViewport: false,
      clip: {
        x: 0,
        y: 0,
        width: Math.min(viewport.clientWidth, 800),
        height: Math.min(viewport.clientHeight, 800),
        scale: 1,
      },
    });
    writeFileSync(outputPath, Buffer.from(screenshot.data, "base64"));
  } finally {
    client.close();
  }
}

async function verifyByokDrafting({
  browserClient,
  downloadDir,
  extensionId,
  fixtureUrl,
  popupTarget,
  port,
}) {
  let client = new CdpClient(popupTarget.webSocketDebuggerUrl);
  const initialPdfs = new Map(findDownloadedPdfs(downloadDir).map((path) => [
    path,
    statSync(path).mtimeMs,
  ]));
  const fakeApiKey = "sk-floun-browser-qa";
  const requests = [];
  await client.open();

  try {
    await client.send("Runtime.evaluate", {
      expression: "document.querySelector('button[aria-label=\"AI drafting\"]').click()",
      userGesture: true,
    });
    await sleep(250);
    await client.send("Runtime.evaluate", {
      expression: `(() => {
        const keyInput = document.getElementById('deepseekApiKey');
        const consentInput = document.getElementById('deepseekConsent');
        const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
        valueSetter.call(keyInput, '${fakeApiKey}');
        keyInput.dispatchEvent(new Event('input', { bubbles: true }));
        consentInput.click();
        return true;
      })()`,
      awaitPromise: true,
      returnByValue: true,
      userGesture: true,
    });
    await sleep(100);
    await client.send("Runtime.evaluate", {
      expression: "Array.from(document.querySelectorAll('button')).find((item) => item.textContent.trim() === 'Save AI Settings').click()",
      userGesture: true,
    });
    await sleep(250);
    const savedSettings = await client.send("Runtime.evaluate", {
      expression: "(async () => (await chrome.storage.local.get('floun.reportDrafting.deepseek.v2'))['floun.reportDrafting.deepseek.v2'])()",
      awaitPromise: true,
      returnByValue: true,
    });

    if (savedSettings.result.value?.apiKey !== fakeApiKey || savedSettings.result.value?.consented !== true) {
      throw new Error("DeepSeek BYOK settings were not saved through the consent UI.");
    }

    client.close();
    const reopenedScan = await scanUrl({
      browserClient,
      extensionId,
      label: "Persisted DeepSeek BYOK fixture scan",
      port,
      url: fixtureUrl,
      waitMs: 90_000,
    });
    client = new CdpClient(reopenedScan.popupTarget.webSocketDebuggerUrl);
    await client.open();
    await client.send("Runtime.evaluate", {
      expression: "document.querySelector('button[aria-label=\"AI drafting\"]').click()",
      userGesture: true,
    });
    await sleep(250);
    const reopenedSettings = await client.send("Runtime.evaluate", {
      expression: `({
        text: document.body.innerText,
        hasKeyInput: Boolean(document.getElementById('deepseekApiKey')),
        hasFullKey: document.body.innerText.includes('${fakeApiKey}'),
      })`,
      returnByValue: true,
    });
    if (
      !reopenedSettings.result.value?.text.includes("Saved on this device") ||
      !reopenedSettings.result.value?.text.includes(`Key ending in ${fakeApiKey.slice(-4)}`) ||
      reopenedSettings.result.value?.hasKeyInput ||
      reopenedSettings.result.value?.hasFullKey
    ) {
      throw new Error("DeepSeek BYOK settings did not reopen as masked persisted status.");
    }
    if (process.env.FLOUN_BYOK_SCREENSHOT) {
      await capturePopupScreenshot(
        reopenedScan.popupTarget,
        resolve(process.env.FLOUN_BYOK_SCREENSHOT)
      );
    }

    await client.send("Fetch.enable", {
      patterns: [{ urlPattern: "https://api.deepseek.com/*", requestStage: "Request" }],
    });
    await client.send("Runtime.evaluate", {
      expression: "Array.from(document.querySelectorAll('button')).find((item) => item.textContent.trim() === 'Generate Report').click()",
      userGesture: true,
    });

    for (let index = 0; index < 7; index += 1) {
      const event = await client.waitForEvent("Fetch.requestPaused", 30_000);
      const request = event.params.request;
      const authorization = Object.entries(request.headers)
        .find(([name]) => name.toLowerCase() === "authorization")?.[1];

      if (authorization !== `Bearer ${fakeApiKey}`) {
        throw new Error("DeepSeek BYOK request did not use the user-owned API key.");
      }
      const leakedTokens = fixtureRawTokens.filter((token) => request.postData?.includes(token));
      if (leakedTokens.length) {
        throw new Error(`DeepSeek BYOK request leaked raw fixture tokens: ${leakedTokens.join(", ")}`);
      }
      requests.push(request);
      await client.send("Fetch.fulfillRequest", {
        requestId: event.params.requestId,
        responseCode: 200,
        responseHeaders: [{ name: "Content-Type", value: "application/json" }],
        body: Buffer.from(JSON.stringify({
          choices: [{ message: { content: `Verified redacted section ${index + 1}.` } }],
        })).toString("base64"),
      });
    }

    let generatedPdf = "";
    for (let attempt = 0; attempt < 160; attempt += 1) {
      await sleep(500);
      generatedPdf = findDownloadedPdfs(downloadDir).find((path) => (
        !initialPdfs.has(path) || statSync(path).mtimeMs > initialPdfs.get(path)
      )) || "";
      if (generatedPdf) break;
    }
    if (!generatedPdf) throw new Error("DeepSeek BYOK report PDF was not downloaded.");

    const rawTokenLeaks = findRawTokenLeaks(readFileSync(generatedPdf));
    if (rawTokenLeaks.length) {
      throw new Error(`DeepSeek BYOK PDF leaked raw fixture tokens: ${rawTokenLeaks.join(", ")}`);
    }

    await client.send("Runtime.evaluate", {
      expression: "Array.from(document.querySelectorAll('button')).find((item) => item.textContent.trim() === 'Remove Key').click()",
      userGesture: true,
    });
    await sleep(250);
    const removedSettings = await client.send("Runtime.evaluate", {
      expression: `(async () => ({
        saved: (await chrome.storage.local.get('floun.reportDrafting.deepseek.v2'))['floun.reportDrafting.deepseek.v2'],
        savedStatus: (await chrome.storage.local.get('floun.reportDrafting.deepseek.status.v2'))['floun.reportDrafting.deepseek.status.v2'],
        deleted: (await chrome.storage.local.get('floun.reportDrafting.deepseek.deleted.v2'))['floun.reportDrafting.deepseek.deleted.v2'],
        hasKeyInput: Boolean(document.getElementById('deepseekApiKey')),
      }))()`,
      awaitPromise: true,
      returnByValue: true,
    });
    if (
      removedSettings.result.value?.saved !== undefined ||
      removedSettings.result.value?.savedStatus !== undefined ||
      removedSettings.result.value?.deleted !== true ||
      !removedSettings.result.value?.hasKeyInput
    ) {
      throw new Error("DeepSeek BYOK settings were not removed through the persisted settings UI.");
    }

    return buildScenarioResult(
      "byok",
      "Persistent DeepSeek BYOK consent",
      requests.length === 7,
      `persistedAfterReopen=true; removedThroughUi=true; redactedRequests=${requests.length}; rawTokenLeaks=${rawTokenLeaks.length}`
    );
  } finally {
    try {
      await client.send("Runtime.evaluate", {
        expression: "chrome.storage.local.remove(['floun.reportDrafting.deepseek.v2', 'floun.reportDrafting.deepseek.status.v2', 'floun.reportDrafting.deepseek.deleted.v2'])",
        awaitPromise: true,
      });
    } catch {
      // Best-effort cleanup of the isolated QA profile.
    }
    client.close();
  }
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
    if (process.env.FLOUN_POPUP_SCREENSHOT) {
      await capturePopupScreenshot(httpsScan.popupTarget, resolve(process.env.FLOUN_POPUP_SCREENSHOT));
    }

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

    const byokFixtureScan = await scanUrl({
      browserClient,
      extensionId: flounExtension.id,
      label: "DeepSeek BYOK fixture scan",
      port,
      url: fixtureUrl,
      waitMs: 90_000,
    });
    results.push(await verifyByokDrafting({
      browserClient,
      downloadDir,
      extensionId: flounExtension.id,
      fixtureUrl,
      popupTarget: byokFixtureScan.popupTarget,
      port,
    }));

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
