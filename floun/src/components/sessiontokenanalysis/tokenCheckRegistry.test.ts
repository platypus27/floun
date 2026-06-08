import {
  batchTokenChecks,
  runBatchTokenChecks,
  runSingleTokenChecks,
  singleTokenChecks,
  tokenChecks,
} from "./tokenCheckRegistry";

const sharedPrefix = "aZ7qLm9PQr4xVn2Ty8Bc0Kd6Se3FgH";

test("keeps token check registry ids and scopes stable", () => {
  expect(singleTokenChecks.map(check => check.id)).toEqual([
    "token-format",
    "token-entropy",
    "token-pattern",
    "token-frequency",
  ]);
  expect(batchTokenChecks.map(check => check.id)).toEqual(["token-batch-pattern"]);
  expect(tokenChecks.map(check => check.scope)).toEqual([
    "single-token",
    "single-token",
    "single-token",
    "single-token",
    "batch",
  ]);
});

test("runs single-token checks with structured status metadata", () => {
  const results = runSingleTokenChecks("abc");

  expect(results[0]).toMatchObject({
    checkId: "token-format",
    scope: "single-token",
    status: "fail",
    confidence: "Medium",
    evidencePolicy: "redacted",
    details: "Short Token",
  });
  expect(results.every(result => result.checkId && result.confidence && result.evidencePolicy)).toBe(true);
});

test("runs batch checks once and redacts raw token details", () => {
  const skippedResult = runBatchTokenChecks([`${sharedPrefix}A`])[0];
  const failedResult = runBatchTokenChecks([`${sharedPrefix}A`, `${sharedPrefix}B`])[0];

  expect(skippedResult).toMatchObject({
    checkId: "token-batch-pattern",
    scope: "batch",
    status: "skipped",
    details: "Needs Multiple Tokens",
  });
  expect(failedResult).toMatchObject({
    checkId: "token-batch-pattern",
    scope: "batch",
    status: "fail",
    confidence: "Medium",
    evidencePolicy: "redacted",
    details: "Nearly Identical Common Prefix",
  });
  expect(JSON.stringify(failedResult)).not.toContain(sharedPrefix);
});
