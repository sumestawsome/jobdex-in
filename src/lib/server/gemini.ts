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
    code?: number;
    message?: string;
    status?: string;
  };
};

/**
 * Mengumpulkan seluruh API Key Gemini yang tersedia di environment
 * (GEMINI_API_KEY, GEMINI_API_KEY1, GEMINI_API_KEY2, GEMINI_API_KEY3, GEMINI_API_KEY4).
 */
export function getGeminiApiKeyPool(): string[] {
  const envKeys = [
    process.env.GEMINI_API_KEY,
    process.env.GEMINI_API_KEY1,
    process.env.GEMINI_API_KEY2,
    process.env.GEMINI_API_KEY3,
    process.env.GEMINI_API_KEY4,
  ];

  const validKeys: string[] = [];
  for (const k of envKeys) {
    const trimmed = k?.trim();
    if (trimmed && trimmed.length > 0 && !validKeys.includes(trimmed)) {
      validKeys.push(trimmed);
    }
  }

  return validKeys;
}

// Global round-robin pointer
let nextKeyIndex = 0;

/**
 * Mengambil API key berikutnya menggunakan algoritma Round-Robin.
 */
export function getRoundRobinGeminiApiKey(): { apiKey: string; keyIndex: number } {
  const pool = getGeminiApiKeyPool();
  if (pool.length === 0) {
    throw new Error("Tidak ada GEMINI_API_KEY yang tersedia di environment server.");
  }
  const index = nextKeyIndex % pool.length;
  nextKeyIndex = (nextKeyIndex + 1) % pool.length;
  return { apiKey: pool[index], keyIndex: index };
}

/**
 * Memeriksa apakah suatu error merupakan error kuota, rate limit, atau timeout
 */
export function isGeminiQuotaOrTransientError(err: unknown): boolean {
  if (!err) return false;
  const msg = err instanceof Error ? err.message : String(err);
  const lower = msg.toLowerCase();
  return (
    msg.includes("429") ||
    msg.includes("RESOURCE_EXHAUSTED") ||
    lower.includes("quota") ||
    lower.includes("rate limit") ||
    lower.includes("rate-limit") ||
    lower.includes("timeout") ||
    msg.includes("AbortError") ||
    msg.includes("ABORT_ERR")
  );
}

export type GeminiPoolExecutor<T> = (apiKey: string, keyIndex: number) => Promise<T>;

/**
 * Mengeksekusi request Gemini dengan Round-Robin & Auto-Failover di seluruh API Key Pool.
 * Jika terjadi error kuota (429, RESOURCE_EXHAUSTED) atau timeout, otomatis beralih ke key berikutnya.
 */
export async function executeWithGeminiKeyPool<T>(
  executor: GeminiPoolExecutor<T>,
  contextName = "Gemini Operation"
): Promise<T> {
  const pool = getGeminiApiKeyPool();
  if (pool.length === 0) {
    throw new Error("Tidak ada GEMINI_API_KEY yang dikonfigurasi di environment server.");
  }

  const poolSize = pool.length;
  const startRotation = nextKeyIndex % poolSize;
  // Geser pointer global untuk pemanggilan berikutnya
  nextKeyIndex = (nextKeyIndex + 1) % poolSize;

  let lastError: unknown = null;

  for (let attempt = 0; attempt < poolSize; attempt++) {
    const activeIndex = (startRotation + attempt) % poolSize;
    const apiKey = pool[activeIndex];

    try {
      return await executor(apiKey, activeIndex);
    } catch (err: unknown) {
      lastError = err;
      const isQuotaOrTimeout = isGeminiQuotaOrTransientError(err);
      const nextIndex = (activeIndex + 1) % poolSize;

      if (isQuotaOrTimeout && attempt < poolSize - 1) {
        console.warn(
          `[Gemini Pool] Key index ${activeIndex} exhausted/error, switching to key index ${nextIndex} for ${contextName}.`
        );
        continue;
      }

      // Jika ada error lain dan masih ada key berikutnya, coba failover
      if (attempt < poolSize - 1) {
        console.warn(
          `[Gemini Pool] Key index ${activeIndex} error, switching to key index ${nextIndex} for ${contextName}. Error:`,
          err instanceof Error ? err.message : String(err)
        );
        continue;
      }

      console.error(
        `[Gemini Pool] All ${poolSize} keys exhausted or failed for ${contextName}. Last error:`,
        err instanceof Error ? err.message : String(err)
      );
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`Semua (${poolSize}) API Key Gemini di dalam pool gagal atau kehabisan kuota.`);
}

export async function askGemini({
  systemPrompt,
  prompt,
}: {
  systemPrompt: string;
  prompt: string;
}) {
  const modelsToTry = [
    process.env.GEMINI_MODEL,
    "gemini-3.8-flash",
    "gemini-3.5-flash-lite",
    "gemini-3.8-pro",
  ].filter(Boolean) as string[];

  const uniqueModels = [...new Set(modelsToTry)];

  return executeWithGeminiKeyPool(async (apiKey, keyIndex) => {
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
          const errMsg = data.error?.message
            ? `Gemini (${modelName}) gagal: ${data.error.message}`
            : `Gemini (${modelName}) gagal status ${response.status}`;

          if (
            response.status === 429 ||
            errMsg.includes("RESOURCE_EXHAUSTED") ||
            errMsg.toLowerCase().includes("quota")
          ) {
            throw new Error(`HTTP 429 RESOURCE_EXHAUSTED: ${errMsg}`);
          }

          throw new Error(errMsg);
        }

        const answer = data.candidates?.[0]?.content?.parts
          ?.map((part) => part.text ?? "")
          .join("")
          .trim();

        return answer || GEMINI_EMPTY_ANSWER_FALLBACK;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (isGeminiQuotaOrTransientError(lastError)) {
          throw lastError; // Failover ke key berikutnya di dalam pool
        }
        console.warn(
          `[Gemini API] (Key index ${keyIndex}) Model ${modelName} error:`,
          lastError.message
        );
      }
    }

    throw lastError || new Error("Semua model Gemini gagal menjawab.");
  }, "askGemini");
}
