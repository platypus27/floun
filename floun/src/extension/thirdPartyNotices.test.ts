declare const process: { cwd: () => string };
declare function require(moduleName: string): any;

const { join } = require("path");
const { pathToFileURL } = require("url");

const generatorUrl = pathToFileURL(
  join(process.cwd(), "scripts", "generate-third-party-notices.mjs"),
).href;

test("third-party notices cover production dependencies and exclude development tooling", async () => {
  const { generateThirdPartyNotices } = await import(generatorUrl);
  const notices = generateThirdPartyNotices({ projectRoot: process.cwd() });

  expect(notices).toContain("GENERATED FILE - DO NOT EDIT");
  expect(notices).toMatch(/@kryv\/teal@\d+\.\d+\.\d+/);
  expect(notices).toMatch(/lucide-react@\d+\.\d+\.\d+/);
  expect(notices).toMatch(/react@18\.\d+\.\d+/);
  expect(notices).toContain("MIT License");
  expect(notices).not.toContain("vitest@");
});

export {};
