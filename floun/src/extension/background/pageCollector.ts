import type { PageScanData } from "../scanTypes";

export interface PageCollectorError {
  error: string;
}

export interface PageCollectorData extends PageScanData {
  truncated?: boolean;
}

export type PageCollectorResult = PageCollectorData | PageCollectorError;

export function collectPageScan(pageOrigin: string): Promise<PageCollectorResult> {
  const maxTokenCount = 50;
  const maxTokenLength = 512;
  const maxScriptCount = 50;
  const maxScriptContentLength = 50_000;
  const sessionTokenRegex = /^(?:[a-f0-9]{32,}|[a-zA-Z0-9_-]{36,}|eyJ[a-zA-Z0-9_-]+?\.[a-zA-Z0-9_-]+?\.[a-zA-Z0-9_-]+$|v\d+_[a-zA-Z0-9]+|Q[A-Za-z0-9+/=]{20,})$/;
  const getScanErrorMessage = (error: unknown): string => (
    error instanceof Error ? error.message : "Page scan failed."
  );
  let pagePayloadTruncated = false;

  const capToken = (token: string): string => {
    if (token.length <= maxTokenLength) {
      return token;
    }

    pagePayloadTruncated = true;
    return token.slice(0, maxTokenLength);
  };

  const capScriptContent = (content: string): string => {
    if (content.length <= maxScriptContentLength) {
      return content;
    }

    pagePayloadTruncated = true;
    return content.slice(0, maxScriptContentLength);
  };

  const readStorageValues = (
    storage: Storage,
    addCandidate: (value: string | null) => void
  ): void => {
    try {
      for (let i = 0; i < storage.length; i += 1) {
        const key = storage.key(i);
        addCandidate(key ? storage.getItem(key) : null);
      }
    } catch {
      return;
    }
  };

  const getTokens = (): string[] => {
    const tokens: string[] = [];
    const addCandidate = (value: string | null) => {
      const normalizedValue = typeof value === "string" ? value.trim() : "";

      if (!normalizedValue || !sessionTokenRegex.test(normalizedValue)) {
        return;
      }

      if (tokens.length >= maxTokenCount) {
        pagePayloadTruncated = true;
        return;
      }

      tokens.push(capToken(normalizedValue));
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

  const getHeaders = (): Record<string, string> => {
    const headers: Record<string, string> = {};
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

  const getJavaScript = async (): Promise<unknown[]> => {
    const scripts: unknown[] = [];
    const scriptElements = document.getElementsByTagName("script");

    for (let i = 0; i < scriptElements.length; i += 1) {
      if (scripts.length >= maxScriptCount) {
        pagePayloadTruncated = true;
        break;
      }

      const scriptElement = scriptElements[i];

      if (!scriptElement.src) {
        scripts.push({ type: "inline", content: capScriptContent(scriptElement.textContent || "") });
        continue;
      }

      const scriptUrl = new URL(scriptElement.src, document.baseURI);

      if (scriptUrl.origin !== pageOrigin) {
        continue;
      }

      try {
        const response = await fetch(scriptUrl.href);

        const content = response.ok ? await response.text() : "Script fetch failed";

        scripts.push({
          type: "external",
          src: scriptUrl.href,
          content: capScriptContent(content),
        });
      } catch {
        scripts.push({ type: "external", src: scriptUrl.href, content: "Script fetch failed" });
      }
    }

    return scripts;
  };

  return Promise.all([
    Promise.resolve(getTokens()),
    Promise.resolve(getHeaders()),
    getJavaScript(),
  ])
    .then(([tokens, headers, jsScripts]) => ({
      tokens,
      headers,
      jsScripts,
      truncated: pagePayloadTruncated || undefined,
    }))
    .catch((error) => ({ error: getScanErrorMessage(error) }));
}
