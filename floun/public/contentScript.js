const MESSAGE_ACTIONS = Object.freeze({
  RUN_SCANS: "runScans",
  SCAN_WEBSITE: "scanWebsite",
});

const successResponse = (data) => ({ status: "success", data });
const errorResponse = (message) => ({ status: "error", message });

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request?.action !== MESSAGE_ACTIONS.RUN_SCANS) {
    return false;
  }

  const target = {
    ...(request.target || {}),
    pageOrigin: window.location.origin,
  };

  chrome.runtime.sendMessage(
    { action: MESSAGE_ACTIONS.SCAN_WEBSITE, target },
    (response) => {
      const lastError = chrome.runtime.lastError;

      if (lastError) {
        sendResponse(errorResponse(lastError.message || "Runtime message failed."));
        return;
      }

      if (response?.status === "success") {
        sendResponse(successResponse(response.data));
        return;
      }

      sendResponse(errorResponse(response?.message || "Unknown scan error."));
    }
  );

  return true;
});

