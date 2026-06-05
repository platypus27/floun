const MESSAGE_ACTIONS = Object.freeze({
  SCAN_WEBSITE: "scanWebsite",
});

const TLS_SCAN = Object.freeze({
  maxAttempts: 15,
  pollDelayMs: 5000,
});

const successResponse = (data) => ({ status: "success", data });
const errorResponse = (message) => ({ status: "error", message });
const completeMeta = () => ({ status: "complete" });
const partialMeta = (message) => ({ status: "partial", message });
const unavailableMeta = (message) => ({ status: "unavailable", message });
const emptyPageScan = () => ({ tokens: [], headers: {}, jsScripts: [] });

const getErrorMessage = (error) => (
  error instanceof Error ? error.message : "Unknown error"
);

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.action !== MESSAGE_ACTIONS.SCAN_WEBSITE) {
    return false;
  }

  runWebsiteScan(message.target)
    .then((data) => sendResponse(successResponse(data)))
    .catch((error) => sendResponse(errorResponse(getErrorMessage(error))));

  return true;
});

async function runWebsiteScan(target) {
  if (!isValidScanTarget(target)) {
    throw new Error("Scan target is missing tab ID, protocol, hostname, or page origin.");
  }

  const [pageScan, tlsScan, certificateScan] = await Promise.all([
    executePageScan(target.tabId, target.pageOrigin),
    fetchTlsScan(target),
    fetchCertificateScan(target),
  ]);
  const scanMeta = buildScanMeta(pageScan.meta, tlsScan.meta, certificateScan.meta);

  return {
    ...pageScan.data,
    TLS: tlsScan.data,
    certificates: certificateScan.data,
    scanMeta,
  };
}

function isValidScanTarget(target) {
  return Boolean(
    target &&
    Number.isInteger(target.tabId) &&
    ["http:", "https:"].includes(target.protocol) &&
    typeof target.hostname === "string" &&
    target.hostname.length > 0 &&
    typeof target.pageOrigin === "string" &&
    target.pageOrigin.length > 0
  );
}

function executePageScan(tabId, pageOrigin) {
  return new Promise((resolve) => {
    chrome.scripting.executeScript(
      {
        target: { tabId },
        func: collectPageScan,
        args: [pageOrigin],
      },
      (injectionResults) => {
        const lastError = chrome.runtime.lastError;

        if (lastError) {
          resolve({
            data: emptyPageScan(),
            meta: unavailableMeta(lastError.message || "Script injection failed."),
          });
          return;
        }

        const scanResult = injectionResults?.[0]?.result;

        if (scanResult?.error) {
          resolve({
            data: emptyPageScan(),
            meta: partialMeta(scanResult.error),
          });
          return;
        }

        resolve({
          data: scanResult || emptyPageScan(),
          meta: completeMeta(),
        });
      }
    );
  });
}

async function fetchTlsScan(target) {
  const apiUrl = `https://api.ssllabs.com/api/v3/analyze?host=${encodeURIComponent(target.hostname)}&all=done`;

  try {
    for (let attempt = 0; attempt < TLS_SCAN.maxAttempts; attempt += 1) {
      const response = await fetch(apiUrl);

      if (!response.ok) {
        return {
          data: null,
          meta: unavailableMeta(`SSL Labs returned HTTP ${response.status}.`),
        };
      }

      const data = await response.json();

      if (data.status === "READY") {
        return { data, meta: completeMeta() };
      }

      if (data.status === "ERROR") {
        return {
          data: null,
          meta: unavailableMeta(data.statusMessage || "SSL Labs reported an error."),
        };
      }

      await delay(TLS_SCAN.pollDelayMs);
    }

    return {
      data: null,
      meta: partialMeta("SSL Labs did not finish the TLS scan before the polling limit."),
    };
  } catch (error) {
    return {
      data: null,
      meta: unavailableMeta(getErrorMessage(error)),
    };
  }
}

async function fetchCertificateScan(target) {
  if (target.protocol !== "https:") {
    return {
      data: null,
      meta: unavailableMeta("Certificate scan requires an HTTPS page."),
    };
  }

  try {
    const response = await fetch(
      `https://ssl-checker.io/api/v1/check/${encodeURIComponent(target.hostname)}`
    );

    if (!response.ok) {
      return {
        data: null,
        meta: unavailableMeta(`Certificate lookup returned HTTP ${response.status}.`),
      };
    }

    const data = await response.json();
    const hasCertificateData = data && Object.keys(data).length > 0;

    return {
      data: hasCertificateData ? data : null,
      meta: hasCertificateData
        ? completeMeta()
        : unavailableMeta("Certificate lookup returned no usable data."),
    };
  } catch (error) {
    return {
      data: null,
      meta: unavailableMeta(getErrorMessage(error)),
    };
  }
}

function buildScanMeta(page, tls, certificates) {
  const scanMeta = {
    page,
    tls,
    certificates,
    warnings: [],
  };
  const labels = {
    page: "Page scan",
    tls: "TLS scan",
    certificates: "Certificate scan",
  };

  Object.entries(labels).forEach(([key, label]) => {
    const meta = scanMeta[key];

    if (meta.status !== "complete") {
      const message = meta.message ? `: ${meta.message}` : "";
      scanMeta.warnings.push(`${label} ${meta.status}${message}`);
    }
  });

  return scanMeta;
}

function collectPageScan(pageOrigin) {
  const sessionTokenRegex = /^(?:[a-f0-9]{32,}|[a-zA-Z0-9_-]{36,}|eyJ[a-zA-Z0-9_-]+?\.[a-zA-Z0-9_-]+?\.[a-zA-Z0-9_-]+$|v\d+_[a-zA-Z0-9]+|Q[A-Za-z0-9+/=]{20,})$/;
  const getScanErrorMessage = (error) => (
    error instanceof Error ? error.message : "Page scan failed."
  );

  const getTokens = () => {
    const tokens = [];
    const addCandidate = (value) => {
      if (typeof value === "string" && value.trim() && sessionTokenRegex.test(value.trim())) {
        tokens.push(value.trim());
      }
    };

    document.cookie.split(";").forEach((cookie) => {
      const separatorIndex = cookie.indexOf("=");
      const cookieValue = separatorIndex >= 0 ? cookie.slice(separatorIndex + 1) : "";
      addCandidate(cookieValue);
    });

    readStorageValues(window.localStorage, addCandidate);
    readStorageValues(window.sessionStorage, addCandidate);

    return tokens;
  };

  const getHeaders = () => {
    const headers = {};
    const metaTags = document.getElementsByTagName("meta");

    for (let i = 0; i < metaTags.length; i += 1) {
      const metaTag = metaTags[i];
      const name = metaTag.getAttribute("name") || metaTag.getAttribute("http-equiv");
      const content = metaTag.getAttribute("content");

      if (name && content) {
        headers[name] = content;
      }
    }

    headers["Content-Type"] = document.contentType || "Not available";
    headers["Content-Language"] = document.documentElement.lang || "Not available";

    return headers;
  };

  const getJavaScript = async () => {
    const scripts = [];
    const scriptElements = document.getElementsByTagName("script");

    for (let i = 0; i < scriptElements.length; i += 1) {
      const scriptElement = scriptElements[i];

      if (!scriptElement.src) {
        scripts.push({ type: "inline", content: scriptElement.textContent || "" });
        continue;
      }

      const scriptUrl = new URL(scriptElement.src, document.baseURI);

      if (scriptUrl.origin !== pageOrigin) {
        continue;
      }

      try {
        const response = await fetch(scriptUrl.href);

        scripts.push({
          type: "external",
          src: scriptUrl.href,
          content: response.ok ? await response.text() : "Script fetch failed",
        });
      } catch {
        scripts.push({ type: "external", src: scriptUrl.href, content: "Script fetch failed" });
      }
    }

    return scripts;
  };

  const readStorageValues = (storage, addCandidate) => {
    try {
      for (let i = 0; i < storage.length; i += 1) {
        const key = storage.key(i);
        addCandidate(key ? storage.getItem(key) : null);
      }
    } catch {
      return;
    }
  };

  return Promise.all([
    Promise.resolve(getTokens()),
    Promise.resolve(getHeaders()),
    getJavaScript(),
  ])
    .then(([tokens, headers, jsScripts]) => ({ tokens, headers, jsScripts }))
    .catch((error) => ({ error: getScanErrorMessage(error) }));
}
