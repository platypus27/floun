import { getErrorMessage } from "./errors";
import { runWebsiteScan } from "./orchestrator";
import type {
  ScanPayload,
  ScanTarget,
} from "../scanTypes";
import {
  INVALID_SCAN_TARGET_MESSAGE,
  buildScanErrorResponse,
  buildScanSuccessResponse,
  isScanActionMessage,
  isScanRequest,
  type ScanErrorResponse,
  type ScanSuccessResponse,
} from "../scanProtocol";

export type SendResponse = (response: ScanSuccessResponse | ScanErrorResponse) => void;
export type RunScan = (target: ScanTarget) => Promise<ScanPayload>;

export function handleScanMessage(
  message: unknown,
  sendResponse: SendResponse,
  runScan: RunScan = runWebsiteScan
): boolean {
  if (!isScanActionMessage(message)) {
    return false;
  }

  if (!isScanRequest(message)) {
    sendResponse(buildScanErrorResponse(INVALID_SCAN_TARGET_MESSAGE));
    return true;
  }

  runScan(message.target)
    .then((data) => sendResponse(buildScanSuccessResponse(data)))
    .catch((error) => sendResponse(buildScanErrorResponse(getErrorMessage(error))));

  return true;
}

export function registerBackgroundMessageHandler(): void {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    return handleScanMessage(message, sendResponse);
  });
}
