import { AnalysisFinding, summarizeFindings } from "./analysisFinding";

test("summarizes review findings separately from vulnerabilities", () => {
  const findings: AnalysisFinding[] = [
    { source: "SSL Header", severity: "Review", title: "Classical TLS cipher" },
    { source: "JavaScript", severity: "Vulnerable", title: "MD5 Hashing" },
    { source: "Certificate", severity: "Safe", title: "ML-DSA certificate" },
    { source: "Tokens", severity: "Info", title: "No tokens found" },
  ];

  const summary = summarizeFindings(findings);

  expect(summary.total).toBe(4);
  expect(summary.review).toBe(1);
  expect(summary.vulnerable).toBe(1);
  expect(summary.reviewDetails[0]).toContain("[Review]");
  expect(summary.vulnerableDetails[0]).toContain("[Vulnerable]");
});
