import {
  analysisModules,
  buildFindingGroupLabels,
  buildFindingGroups,
  runAnalysisModules,
} from "./analysisModules";
import type { ScanPayload } from "../extension/scanTypes";

const scanPayload: ScanPayload = {
  jsScripts: [{ type: "inline", content: "const digest = MD5(input);" }],
  tokens: ["secretRawToken"],
  headers: {},
  TLS: {
    provider: "ssl-labs",
    endpoints: [{
      protocolVersions: ["1.3"],
      cipherSuites: ["TLS_AES_128_GCM_SHA256"],
    }],
  },
  certificates: {
    provider: "ssl-checker",
    signatureAlgorithm: "sha256WithRSAEncryption",
  },
  scanMeta: {
    page: { status: "complete" },
    tls: { status: "complete" },
    certificates: { status: "complete" },
    warnings: [],
  },
};

test("keeps analysis module order stable", () => {
  expect(analysisModules.map(moduleDefinition => moduleDefinition.id)).toEqual([
    "javascript",
    "tokens",
    "tls",
    "certificates",
  ]);
  expect(analysisModules.map(moduleDefinition => moduleDefinition.label)).toEqual([
    "JavaScript",
    "Tokens",
    "TLS",
    "Certificates",
  ]);
});

test("selects the expected scan payload fields", () => {
  const selectedPayloads = new Map(
    analysisModules.map(moduleDefinition => [
      moduleDefinition.id,
      moduleDefinition.selectPayload(scanPayload),
    ])
  );

  expect(selectedPayloads.get("javascript")).toBe(scanPayload.jsScripts);
  expect(selectedPayloads.get("tokens")).toBe(scanPayload.tokens);
  expect(selectedPayloads.get("tls")).toBe(scanPayload.TLS);
  expect(selectedPayloads.get("certificates")).toBe(scanPayload.certificates);
});

test("runs modules and summarizes their findings", () => {
  const moduleResults = runAnalysisModules(scanPayload);

  expect(moduleResults).toHaveLength(4);
  expect(moduleResults.map(moduleResult => moduleResult.id)).toEqual([
    "javascript",
    "tokens",
    "tls",
    "certificates",
  ]);
  expect(moduleResults.every(moduleResult => moduleResult.findings.length > 0)).toBe(true);
  expect(moduleResults.every(moduleResult => moduleResult.summary.total === moduleResult.findings.length)).toBe(true);
});

test("derives report groups and breakdown labels from module results", () => {
  const moduleResults = runAnalysisModules(scanPayload);
  const groups = buildFindingGroups(moduleResults);
  const groupLabels = buildFindingGroupLabels(moduleResults);

  expect(Object.keys(groups)).toEqual(["JavaScript", "Tokens", "TLS", "Certificates"]);
  expect(groupLabels).toEqual({
    JavaScript: "JS",
    Tokens: "Tokens",
    TLS: "TLS",
    Certificates: "Certificates",
  });
});
