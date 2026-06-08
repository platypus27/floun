import { analyzeCertificate } from "./certificateanalysis";

test("returns an informational finding when certificate data is missing", () => {
  expect(analyzeCertificate(null)[0]).toMatchObject({
    source: "Certificate",
    severity: "Info",
  });
});

test("classifies classical certificate signatures as review findings", () => {
  expect(analyzeCertificate({ provider: "ssl-checker", signatureAlgorithm: "sha256WithRSAEncryption" })[0]).toMatchObject({
    ruleId: "cert-classical-signature",
    severity: "Review",
    standardStatus: "classical",
  });
});

test("classifies deprecated certificate signatures as vulnerable", () => {
  expect(analyzeCertificate({ provider: "ssl-checker", signatureAlgorithm: "sha1WithRSAEncryption" })[0]).toMatchObject({
    ruleId: "cert-deprecated-signature",
    severity: "Vulnerable",
    standardStatus: "deprecated",
  });
});

test("classifies post-quantum certificate signatures as safe", () => {
  const finding = analyzeCertificate({ provider: "ssl-checker", signatureAlgorithm: "Dilithium3" })[0];

  expect(finding).toMatchObject({
    ruleId: "cert-post-quantum-signature",
    severity: "Safe",
    standardStatus: "standardized",
  });
  expect(finding.rationale).toContain("ML-DSA");
  expect(finding.limitations).toContain("client compatibility");
  expect(finding.references?.length).toBeGreaterThan(0);
});
