declare const process: { cwd: () => string };
declare function require(moduleName: string): any;

const { existsSync, readFileSync } = require("fs");
const { join } = require("path");

const projectRoot = process.cwd();
const repoRoot = join(projectRoot, "..");
const repoFile = (path: string) => join(repoRoot, path);
const readRepoFile = (path: string) => readFileSync(repoFile(path), "utf8");

test("the repository exposes a complete open-source contributor contract", () => {
  const license = readRepoFile("LICENSE");
  const contributing = readRepoFile("CONTRIBUTING.md");
  const security = readRepoFile("SECURITY.md");
  const packageJson = JSON.parse(readRepoFile("floun/package.json"));

  expect(license).toContain("Apache License");
  expect(license).toContain("Version 2.0");
  expect(readRepoFile("TRADEMARKS.md")).toMatch(/Floun.*Kryv Labs/s);
  expect(readRepoFile("TRADEMARKS.md")).toContain("floun/public/icons/");
  expect(readRepoFile("TRADEMARKS.md")).toContain("docs/store/assets/");
  expect(readRepoFile("CODE_OF_CONDUCT.md")).toContain("Contributor Covenant");
  expect(readRepoFile("SUPPORT.md")).toContain("GitHub Discussions");
  expect(readRepoFile("GOVERNANCE.md")).toContain("Maintainers");
  expect(contributing).toContain("npm run release:check");
  expect(contributing).toContain("<action>: <description>");
  expect(security).toContain("ngaoyu27@gmail.com");
  expect(security).toContain(
    "https://github.com/platypus27/floun/security/advisories/new",
  );
  expect(security).toMatch(/do not.*public issue/i);
  expect(packageJson).toMatchObject({
    private: true,
    license: "Apache-2.0",
    repository: {
      type: "git",
      url: "git+https://github.com/platypus27/floun.git",
    },
    bugs: { url: "https://github.com/platypus27/floun/issues" },
    engines: { node: ">=22" },
  });
  expect(readRepoFile(".nvmrc").trim()).toBe("22");
});

test("GitHub contribution and supply-chain automation is present", () => {
  const bugForm = readRepoFile(".github/ISSUE_TEMPLATE/bug_report.yml");
  const cryptoRuleForm = readRepoFile(
    ".github/ISSUE_TEMPLATE/cryptography_rule.yml",
  );
  const pullRequestTemplate = readRepoFile(".github/PULL_REQUEST_TEMPLATE.md");
  const releaseWorkflow = readRepoFile(".github/workflows/release-check.yml");

  expect(bugForm).toContain("Expected behavior");
  expect(readRepoFile(".github/ISSUE_TEMPLATE/feature_request.yml")).toContain(
    "Problem",
  );
  expect(cryptoRuleForm).toContain("Authoritative references");
  expect(cryptoRuleForm).toContain("False-positive analysis");
  expect(pullRequestTemplate).toContain("npm run release:check");
  expect(readRepoFile(".github/CODEOWNERS")).toContain("* @platypus27");
  expect(readRepoFile(".github/dependabot.yml")).toContain("github-actions");
  const codeqlWorkflow = readRepoFile(".github/workflows/codeql.yml");
  expect(codeqlWorkflow).toContain("security-events: write");
  expect(codeqlWorkflow).toContain(
    "github/codeql-action/init@24c54180a607b1449ed407dd24f251e4e9147c8d # v4.38.3",
  );
  expect(codeqlWorkflow).toContain(
    "github/codeql-action/analyze@24c54180a607b1449ed407dd24f251e4e9147c8d # v4.38.3",
  );
  expect(readRepoFile(".github/workflows/dependency-review.yml")).toContain(
    "dependency-review-action",
  );
  expect(readRepoFile(".github/workflows/secret-scan.yml")).toContain(
    "gitleaks-action",
  );
  const publishWorkflow = readRepoFile(".github/workflows/release.yml");
  expect(publishWorkflow).toContain("sha256sum");
  expect(publishWorkflow).toContain("gh release create");
  expect(publishWorkflow).toContain("verification.verified");
  expect(releaseWorkflow).toContain("timeout-minutes:");
  expect(releaseWorkflow).toContain("cancel-in-progress: true");
});

test("release inputs use portable line endings without rewriting binary assets", () => {
  const attributes = readRepoFile(".gitattributes");

  expect(attributes).toContain("* text=auto eol=lf");
  expect(attributes).toContain("*.png binary");
  expect(attributes).toContain("*.ico binary");
  expect(attributes).toContain("*.zip binary");
});

test("the public landing page routes contributors to supported project resources", () => {
  const readme = readRepoFile("README.md");

  expect(readme).toContain(
    "docs/store/assets/floun-store-screenshot-1280x800.png",
  );
  expect(readme).toContain("[Contributing](CONTRIBUTING.md)");
  expect(readme).toContain("[Security](SECURITY.md)");
  expect(readme).toContain("[Apache-2.0](LICENSE)");
  expect(readme).toContain("## Architecture");
  expect(readme).toContain("## Limitations");
  expect(existsSync(repoFile("testpage.html"))).toBe(false);
});

export {};
