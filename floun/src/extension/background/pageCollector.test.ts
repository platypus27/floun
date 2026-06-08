import { collectPageScan } from "./pageCollector";

afterEach(() => {
  document.body.innerHTML = "";
  window.localStorage.clear();
  window.sessionStorage.clear();
  vi.unstubAllGlobals();
});

test("caps inline script count and content before returning page scan data", async () => {
  document.body.innerHTML = Array.from({ length: 55 }, (_value, index) => (
    `<script>${"A".repeat(60_000)}MD5(${index})</script>`
  )).join("");

  const result = await collectPageScan(window.location.origin);

  expect("error" in result).toBe(false);

  if ("error" in result) {
    throw new Error(result.error);
  }

  expect(result.jsScripts).toHaveLength(50);
  expect(result.truncated).toBe(true);
  expect((result.jsScripts[0] as { content: string }).content).toHaveLength(50_000);
  expect((result.jsScripts[0] as { content: string }).content).not.toContain("MD5(0)");
});

test("caps token count and token length before returning page scan data", async () => {
  Array.from({ length: 55 }, (_value, index) => {
    window.localStorage.setItem(`token-${index}`, "A".repeat(600));
  });

  const result = await collectPageScan(window.location.origin);

  expect("error" in result).toBe(false);

  if ("error" in result) {
    throw new Error(result.error);
  }

  expect(result.tokens).toHaveLength(50);
  expect(result.tokens[0]).toHaveLength(512);
  expect(result.truncated).toBe(true);
});
