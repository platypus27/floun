const MESSAGE_ACTIONS = Object.freeze({
  SCAN_WEBSITE: "scanWebsite",
});

const TLS_SCAN = Object.freeze({
  maxAttempts: 15,
  pollDelayMs: 5000,
});

const successResponse = (data) => ({ status: "success", data });
const errorResponse = (message) => ({ status: "error", message });

const getErrorMessage = (error) => (
  error instanceof Error ? error.message : "Unknown error"
);

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.action !== MESSAGE_ACTIONS.SCAN_WEBSITE) {
    return false;
  }

  runWebsiteScan(message.target, sender)
    .then((data) => sendResponse(successResponse(data)))
    .catch((error) => sendResponse(errorResponse(getErrorMessage(error))));

  return true;
});

async function runWebsiteScan(target, sender) {
  const tabId = sender.tab?.id;

  if (tabId === undefined) {
    throw new Error("Tab ID not found.");
  }

  if (!isValidScanTarget(target)) {
    throw new Error("Scan target is missing protocol, hostname, or page origin.");
  }

  const [pageScan, TLS, certificates] = await Promise.all([
    executePageScan(tabId, target.pageOrigin),
    fetchTlsScan(target),
    fetchCertificateScan(target),
  ]);

  return {
    ...pageScan,
    TLS,
    certificates,
  };
}

function isValidScanTarget(target) {
  return Boolean(
    target &&
    typeof target.protocol === "string" &&
    typeof target.hostname === "string" &&
    typeof target.pageOrigin === "string"
  );
}

function executePageScan(tabId, pageOrigin) {
  return new Promise((resolve, reject) => {
    chrome.scripting.executeScript(
      {
        target: { tabId },
        func: collectPageScan,
        args: [pageOrigin],
      },
      (injectionResults) => {
        const lastError = chrome.runtime.lastError;

        if (lastError) {
          reject(new Error(lastError.message || "Script injection failed."));
          return;
        }

        const scanResult = injectionResults?.[0]?.result;

        if (scanResult?.error) {
          reject(new Error(scanResult.error));
          return;
        }

        resolve(scanResult || { tokens: [], headers: {}, jsScripts: [] });
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
        return null;
      }

      const data = await response.json();

      if (data.status === "READY") {
        return data;
      }

      await delay(TLS_SCAN.pollDelayMs);
    }

    return null;
  } catch {
    return null;
  }
}

async function fetchCertificateScan(target) {
  if (target.protocol !== "https:") {
    return null;
  }

  try {
    const response = await fetch(
      `https://ssl-checker.io/api/v1/check/${encodeURIComponent(target.hostname)}`
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data && Object.keys(data).length > 0 ? data : null;
  } catch {
    return null;
  }
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
