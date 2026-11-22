declare const process: { cwd: () => string };
declare function require(moduleName: string): any;

const { readdirSync, readFileSync, statSync } = require("fs");
const { join } = require("path");

const projectRoot = process.cwd();

function listCssFiles(directory: string): string[] {
  return (readdirSync(directory) as string[]).flatMap((entry) => {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) {
      return listCssFiles(path);
    }
    return path.endsWith(".css") ? [path] : [];
  });
}

function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

function readCss(files: string[]): string {
  return files.map((file) => stripComments(readFileSync(file, "utf8"))).join("\n");
}

function definedProperties(css: string): Set<string> {
  return new Set([...css.matchAll(/(--[\w-]+)\s*:/g)].map((match) => match[1]));
}

// var(--name) without a fallback; a var() with a fallback is an explicit choice.
function usedProperties(css: string): Set<string> {
  return new Set([...css.matchAll(/var\(\s*(--[\w-]+)\s*\)/g)].map((match) => match[1]));
}

describe("extension CSS custom properties", () => {
  const extensionFiles = listCssFiles(join(projectRoot, "src"));
  const tealFiles = listCssFiles(join(projectRoot, "node_modules/@kryv/teal/dist"));
  const extensionCss = readCss(extensionFiles);

  it("finds the stylesheets it is meant to guard", () => {
    expect(extensionFiles.length).toBeGreaterThan(0);
    expect(tealFiles.length).toBeGreaterThan(0);
    expect(definedProperties(readCss(tealFiles)).has("--teal-color-background")).toBe(true);
  });

  it("defines every var(--...) the extension CSS uses", () => {
    const defined = new Set([
      ...definedProperties(extensionCss),
      ...definedProperties(readCss(tealFiles)),
    ]);
    const undefinedProperties = [...usedProperties(extensionCss)].filter((name) => !defined.has(name));

    expect(undefinedProperties).toEqual([]);
  });

  it("does not use the retired rgb(var(--color-*)) channel convention", () => {
    expect(extensionCss).not.toMatch(/rgb\(\s*var\(--color-/);
  });
});
