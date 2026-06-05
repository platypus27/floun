import { analyzeCertificate } from "./certificateanalysis";

test("returns an informational finding when certificate data is missing", () => {
  expect(analyzeCertificate(null)[0]).toMatchObject({
    source: "Certificate",
    severity: "Info",
  });
});

test("classifies classical certificate signatures as review findings", () => {
  expect(analyzeCertificate({ result: { cert_alg: "sha256WithRSAEncryption" } })[0]).toMatchObject({
    ruleId: "cert-classical-signature",
    severity: "Review",
  });
});

test("classifies deprecated certificate signatures as vulnerable", () => {
  expect(analyzeCertificate({ result: { cert_alg: "sha1WithRSAEncryption" } })[0]).toMatchObject({
    ruleId: "cert-deprecated-signature",
    severity: "Vulnerable",
  });
});

test("classifies post-quantum certificate signatures as safe", () => {
  expect(analyzeCertificate({ result: { cert_alg: "Dilithium3" } })[0]).toMatchObject({
    ruleId: "cert-post-quantum-signature",
    severity: "Safe",
  });
});
