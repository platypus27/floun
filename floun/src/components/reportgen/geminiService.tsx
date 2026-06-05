const API_KEY = process.env.REACT_APP_GEMINI_API_KEY?.trim() || "";
const API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
}

export function hasGeminiApiKey(): boolean {
  return API_KEY.length > 0;
}

export async function generateChatMessage(prompt: string): Promise<string> {
  if (!hasGeminiApiKey()) {
    throw new Error("REACT_APP_GEMINI_API_KEY is not configured.");
  }

  const response = await fetch(`${API_URL}?key=${encodeURIComponent(API_KEY)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          parts: [{ text: prompt }],
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Failed to generate AI content: ${response.status} ${errorBody}`);
  }

  const data = await response.json() as GeminiResponse;
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "No content generated.";
}

