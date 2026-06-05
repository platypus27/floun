import { registerBackgroundMessageHandler } from "./messageHandler";

registerBackgroundMessageHandler();

export { fetchCertificateScan } from "./certificateScanAdapter";
export { handleScanMessage } from "./messageHandler";
export { runWebsiteScan, isValidScanTarget } from "./orchestrator";
export { executePageScan } from "./pageScanAdapter";
export { buildScanMeta } from "./scanMeta";
export { fetchTlsScan } from "./tlsScanAdapter";
