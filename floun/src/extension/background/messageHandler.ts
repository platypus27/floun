import { getErrorMessage } from "./errors";
import { runWebsiteScan } from "./orchestrator";
import type {
  ScanErrorResponse,
  ScanPayload,
  ScanSuccessResponse,
  ScanTarget,
} from "../scanTypes";

const SCAN_WEBSITE_ACTION = "scanWebsite";

const successResponse = (data: ScanPayload): ScanSuccessResponse => ({ status: "success", data });
const errorResponse = (message: string): ScanErrorResponse => ({ status: "error", message });

export type SendResponse = (response: ScanSuccessResponse | ScanErrorResponse) => void;
export type RunScan = (target: ScanTarget) => Promise<ScanPayload>;

export function handleScanMessage(
  message: unknown,
  sendResponse: SendResponse,
  runScan: RunScan = runWebsiteScan
): boolean {
  const scanMessage = message as { action?: string; target?: ScanTarget } | null;

  if (scanMessage?.action !== SCAN_WEBSITE_ACTION) {
    return false;
  }

  runScan(scanMessage.target as ScanTarget)
    .then((data) => sendResponse(successResponse(data)))
    .catch((error) => sendResponse(errorResponse(getErrorMessage(error))));

  return true;
}

export function registerBackgroundMessageHandler(): void {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    return handleScanMessage(message, sendResponse);
  });
}
