import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { generateChatMessage, hasDeepseekApiKey } from "./deepseekService";

const ORIGINAL_ENV = import.meta.env.VITE_DEEPSEEK_API_KEY;

function setKey(value: string) {
  (import.meta.env as Record<string, string | undefined>).VITE_DEEPSEEK_API_KEY = value;
}

describe("deepseekService", () => {
  beforeEach(() => {
    setKey("sk-test-key-1234567890abcdef");
  });

  afterEach(() => {
    setKey(ORIGINAL_ENV);
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  test("hasDeepseekApiKey returns true when key is set", () => {
    expect(hasDeepseekApiKey()).toBe(true);
  });

  test("hasDeepseekApiKey returns false when key is empty or unset", () => {
    setKey("");
    expect(hasDeepseekApiKey()).toBe(false);
    delete (import.meta.env as Record<string, string | undefined>).VITE_DEEPSEEK_API_KEY;
    expect(hasDeepseekApiKey()).toBe(false);
  });

  test("generateChatMessage throws when key is not configured", async () => {
    setKey("");
    await expect(generateChatMessage("hello")).rejects.toThrow(
      "VITE_DEEPSEEK_API_KEY is not configured."
    );
  });

  test("generateChatMessage posts OpenAI-shape body to deepseek and returns content", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "scanned report" } }],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await generateChatMessage("summarize findings");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.deepseek.com/v1/chat/completions");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({
      model: "deepseek-v4-flash",
      messages: [{ role: "user", content: "summarize findings" }],
    });
    const headers = init.headers as Record<string, string>;
    expect(headers["Content-Type"]).toBe("application/json");
    expect(headers["Authorization"]).toBe("Bearer sk-test-key-1234567890abcdef");
    expect(result).toBe("scanned report");
  });

  test("generateChatMessage throws on non-2xx with status and body", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => "unauthorized",
      })
    );
    await expect(generateChatMessage("ping")).rejects.toThrow(
      /Failed to generate AI content: 401 unauthorized/
    );
  });

  test("generateChatMessage returns fallback when response has no content", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ choices: [{}] }),
      })
    );
    await expect(generateChatMessage("ping")).resolves.toBe("No content generated.");
  });
});
