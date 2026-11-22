declare const process: {
  cwd: () => string;
  env: Record<string, string | undefined>;
};
declare function require(moduleName: string): any;

const { createHash } = require("crypto");
const {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} = require("fs");
const { strFromU8, unzipSync } = require("fflate");
const { tmpdir } = require("os");
const { join } = require("path");
const { pathToFileURL } = require("url");

const packageModuleUrl = pathToFileURL(
  join(process.cwd(), "scripts", "package-extension.mjs"),
).href;

test("packaging the same extension twice produces byte-identical versioned artifacts", async () => {
  const { packageExtension } = await import(packageModuleUrl);
  const tempDir = mkdtempSync(join(tmpdir(), "floun-package-"));
  const buildDir = join(tempDir, "build");
  const releaseDir = join(tempDir, "release");

  try {
    mkdirSync(join(buildDir, "assets"), { recursive: true });
    writeFileSync(join(buildDir, "manifest.json"), '{"version":"2.1.0"}');
    writeFileSync(join(buildDir, "index.html"), "<main>Floun</main>");
    writeFileSync(join(buildDir, "background.js"), "export {};");
    writeFileSync(join(buildDir, "assets", "app.js"), "console.info('floun');");

    const first = packageExtension({ buildDir, releaseDir, version: "2.1.0" });
    const firstHash = createHash("sha256")
      .update(readFileSync(first.canonicalPath))
      .digest("hex");
    const second = packageExtension({ buildDir, releaseDir, version: "2.1.0" });
    const secondHash = createHash("sha256")
      .update(readFileSync(second.canonicalPath))
      .digest("hex");

    expect(secondHash).toBe(firstHash);
    expect(readFileSync(second.aliasPath)).toEqual(
      readFileSync(second.canonicalPath),
    );
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("packaging is byte-identical across runtime timezones", async () => {
  const { packageExtension } = await import(packageModuleUrl);
  const tempDir = mkdtempSync(join(tmpdir(), "floun-timezone-package-"));
  const buildDir = join(tempDir, "build");
  const releaseDir = join(tempDir, "release");
  const originalTimezone = process.env.TZ;

  try {
    mkdirSync(buildDir, { recursive: true });
    writeFileSync(join(buildDir, "manifest.json"), '{"version":"3.0.0"}');
    writeFileSync(join(buildDir, "index.html"), "<main>Floun</main>");
    writeFileSync(join(buildDir, "background.js"), "export {};");

    process.env.TZ = "UTC";
    const utc = packageExtension({ buildDir, releaseDir, version: "3.0.0" });
    const utcArchive = readFileSync(utc.canonicalPath);

    process.env.TZ = "Asia/Singapore";
    const singapore = packageExtension({
      buildDir,
      releaseDir,
      version: "3.0.0",
    });

    expect(readFileSync(singapore.canonicalPath)).toEqual(utcArchive);
  } finally {
    if (originalTimezone === undefined) {
      delete process.env.TZ;
    } else {
      process.env.TZ = originalTimezone;
    }
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("the packaged extension includes its open-source license and notice", async () => {
  const { packageExtension } = await import(packageModuleUrl);
  const tempDir = mkdtempSync(join(tmpdir(), "floun-license-package-"));
  const buildDir = join(tempDir, "build");
  const releaseDir = join(tempDir, "release");
  const licensePath = join(tempDir, "LICENSE");
  const noticePath = join(tempDir, "NOTICE");

  try {
    mkdirSync(buildDir, { recursive: true });
    writeFileSync(join(buildDir, "manifest.json"), '{"version":"3.0.0"}');
    writeFileSync(join(buildDir, "index.html"), "<main>Floun</main>");
    writeFileSync(join(buildDir, "background.js"), "export {};");
    writeFileSync(licensePath, "Apache License Version 2.0");
    writeFileSync(noticePath, "Floun Copyright 2026 Kryv Labs");

    const result = packageExtension({
      buildDir,
      releaseDir,
      version: "3.0.0",
      legalFiles: [
        { sourcePath: licensePath, entryName: "LICENSE.txt" },
        { sourcePath: noticePath, entryName: "NOTICE.txt" },
      ],
    });
    const archive = unzipSync(
      new Uint8Array(readFileSync(result.canonicalPath)),
    );

    expect(strFromU8(archive["LICENSE.txt"])).toBe(
      "Apache License Version 2.0",
    );
    expect(strFromU8(archive["NOTICE.txt"])).toBe(
      "Floun Copyright 2026 Kryv Labs",
    );
    expect(strFromU8(archive["THIRD_PARTY_NOTICES.txt"])).toContain(
      "@kryv/teal@1.2.0",
    );
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

export {};
