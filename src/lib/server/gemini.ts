import "server-only";

export const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.8-flash";
export const GEMINI_EMPTY_ANSWER_FALLBACK =
  "Maaf, AI belum bisa menjawab pertanyaan itu. Coba tanyakan tentang progress task, acara, atau status anggota.";

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
  error?: {
    message?: string;
  };
};

function getGeminiApiKey() {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY belum dikonfigurasi.");
  }

  return apiKey;
}

export async function askGemini({
  systemPrompt,
  prompt,
}: {
  systemPrompt: string;
  prompt: string;
}) {
  const apiKey = getGeminiApiKey();
  const modelsToTry = [
    process.env.GEMINI_MODEL,
    "gemini-3.8-flash",
    "gemini-3.5-flash-lite",
    "gemini-3.8-pro",
  ].filter(Boolean) as string[];

  const uniqueModels = [...new Set(modelsToTry)];
  let lastError: Error | null = null;

  for (const modelName of uniqueModels) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey,
          },
          signal: AbortSignal.timeout(15000),
          body: JSON.stringify({
            system_instruction: {
              parts: [{ text: systemPrompt }],
            },
            contents: [
              {
                role: "user",
                parts: [{ text: prompt }],
              },
            ],
            generationConfig: {
              temperature: 0.2,
              topP: 0.9,
            },
          }),
        },
      );
      const data = (await response.json()) as GeminiResponse;

      if (!response.ok) {
        throw new Error(
          data.error?.message
            ? `Gemini (${modelName}) gagal: ${data.error.message}`
            : `Gemini (${modelName}) gagal status ${response.status}`,
        );
      }

      const answer = data.candidates?.[0]?.content?.parts
        ?.map((part) => part.text ?? "")
        .join("")
        .trim();

      return answer || GEMINI_EMPTY_ANSWER_FALLBACK;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.warn(`[Gemini API] Error calling model ${modelName}:`, lastError.message);
    }
  }

  throw lastError || new Error("Semua model Gemini gagal menjawab.");
}
