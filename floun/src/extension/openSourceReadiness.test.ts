declare const process: { cwd: () => string };
declare function require(moduleName: string): any;

const { existsSync, readdirSync, readFileSync } = require("fs");
const { join } = require("path");

const projectRoot = process.cwd();
const repoRoot = join(projectRoot, "..");
const repoFile = (path: string) => join(repoRoot, path);
const readRepoFile = (path: string) => readFileSync(repoFile(path), "utf8");

const PINNED_USES = /^[\w.-]+\/[\w./-]+@[0-9a-f]{40} # v\d+(\.\d+){0,2}\s*$/;

/** Returns every `uses:` line that is not pinned to a 40-hex SHA with a `# vX.Y.Z` comment. */
const findUnpinnedActions = (workflow: string): string[] =>
  workflow
    .split("\n")
    .map((line) => /^\s*(?:-\s+)?uses:\s*(.+)$/.exec(line)?.[1]?.trim())
    .filter(
      (ref): ref is string => ref !== undefined && !PINNED_USES.test(ref),
    );

const SHA = "0123456789abcdef0123456789abcdef01234567";

test("workflow action pinning check flags unpinned or uncommented uses", () => {
  expect(
    findUnpinnedActions(`      - uses: actions/checkout@${SHA} # v7.0.1`),
  ).toEqual([]);
  expect(
    findUnpinnedActions(
      `      - uses: github/codeql-action/init@${SHA} # v9.9.9`,
    ),
  ).toEqual([]);
  expect(findUnpinnedActions("      - uses: actions/checkout@v4")).toHaveLength(
    1,
  );
  expect(
    findUnpinnedActions(`      - uses: actions/checkout@${SHA}`),
  ).toHaveLength(1);
  expect(
    findUnpinnedActions("      - uses: actions/checkout@0123abc # v4.0.0"),
  ).toHaveLength(1);
});

test("every workflow action is pinned to a full commit SHA with a version comment", () => {
  const dir = repoFile(".github/workflows");
  const files = readdirSync(dir).filter((f: string) => /\.ya?ml$/.test(f));
  expect(files.length).toBeGreaterThan(0);
  const used = new Set<string>();
  for (const file of files) {
    const text = readFileSync(join(dir, file), "utf8");
    expect({ file, unpinned: findUnpinnedActions(text) }).toEqual({
      file,
      unpinned: [],
    });
    for (const m of text.matchAll(/uses:\s*([^@\s]+)@/g)) used.add(m[1]);
  }
  for (const action of [
    "actions/checkout",
    "actions/setup-node",
    "actions/dependency-review-action",
    "gitleaks/gitleaks-action",
    "github/codeql-action/init",
    "github/codeql-action/analyze",
  ]) {
    expect(used).toContain(action);
  }
});

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
  expect(codeqlWorkflow).toMatch(/uses: github\/codeql-action\/init@/);
  expect(codeqlWorkflow).toMatch(/uses: github\/codeql-action\/analyze@/);
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
