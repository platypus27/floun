function readApiKey(): string {
  return (((import.meta.env.VITE_DEEPSEEK_API_KEY as string | undefined) || "")).trim();
}

const API_URL = "https://api.deepseek.com/v1/chat/completions";
const MODEL = "deepseek-v4-flash";

interface DeepseekResponse {
  choices?: Array<{
    message?: { content?: string };
  }>;
}

export function hasDeepseekApiKey(): boolean {
  return readApiKey().length > 0;
}

export async function generateChatMessage(prompt: string): Promise<string> {
  if (!hasDeepseekApiKey()) {
    throw new Error("VITE_DEEPSEEK_API_KEY is not configured.");
  }

  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${readApiKey()}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Failed to generate AI content: ${response.status} ${errorBody}`);
  }

  const data = (await response.json()) as DeepseekResponse;
  return data.choices?.[0]?.message?.content || "No content generated.";
}
