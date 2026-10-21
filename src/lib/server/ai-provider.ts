import "server-only";

import { getAdminDb, FieldValue } from "@/lib/server/firebase-admin";
import { askGemini, GEMINI_MODEL, GEMINI_EMPTY_ANSWER_FALLBACK } from "@/lib/server/gemini";
import { getCachedResponse, setCachedResponse } from "@/lib/server/ai-cache";

// ─── Types ───────────────────────────────────────────────────────────────────

export type AIProviderName = "deepseek" | "gemini" | "mock";

export interface AIProviderParams {
  prompt: string;
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
  feature: string; // for logging and cache key
  useCache?: boolean;
  modelTier?: "fast" | "pro";
  provider?: AIProviderName;
  responseFormat?: { type: "json_object" };
}

export interface AIProviderResult {
  text: string;
  provider: AIProviderName;
  model: string;
  inputChars: number;
  outputChars: number;
  estimatedTokens: number;
  cacheHit: boolean;
}

// ─── Config Helpers ──────────────────────────────────────────────────────────

function getProvider(): AIProviderName {
  // 1. Prioritaskan DeepSeek jika DEEPSEEK_API_KEY tersedia
  if (process.env.DEEPSEEK_API_KEY?.trim()) {
    return "deepseek";
  }

  const explicit = (
    process.env.DEFAULT_AI_PROVIDER ||
    process.env.AI_PROVIDER ||
    ""
  ).toLowerCase();

  if (explicit === "deepseek") return "deepseek";
  if (explicit === "gemini" && process.env.GEMINI_API_KEY?.trim()) return "gemini";
  if (explicit === "mock") return "mock";

  // 2. Jika ada GEMINI_API_KEY, gunakan gemini
  if (process.env.GEMINI_API_KEY?.trim()) {
    return "gemini";
  }

  // 3. Default aman ke deepseek
  return "deepseek";
}

function getDeepSeekConfig(tier: "fast" | "pro" = "fast") {
  return {
    apiKey: process.env.DEEPSEEK_API_KEY || "",
    baseUrl: (process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com").replace(/\/+$/, ""),
    model:
      tier === "pro"
        ? process.env.DEEPSEEK_MODEL_PRO || "deepseek-chat"
        : process.env.DEEPSEEK_MODEL_FAST || "deepseek-chat",
    maxTokens:
      tier === "pro"
        ? parseInt(process.env.DEEPSEEK_MAX_TOKENS_PRO || "1000", 10)
        : parseInt(process.env.DEEPSEEK_MAX_TOKENS_FAST || "600", 10),
    temperature: parseFloat(process.env.DEEPSEEK_TEMPERATURE || "0.2"),
  };
}

function getMaxContextChars(): number {
  return parseInt(process.env.AI_MAX_CONTEXT_CHARS || "12000", 10);
}

function truncateContext(text: string): string {
  const max = getMaxContextChars();
  if (text.length <= max) return text;
  return text.substring(0, max) + "\n\n[...context truncated...]";
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// ─── DeepSeek Provider ───────────────────────────────────────────────────────

interface DeepSeekResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  error?: {
    message?: string;
    type?: string;
    code?: string | number;
  };
}

async function callDeepSeek(params: AIProviderParams): Promise<AIProviderResult> {
  const config = getDeepSeekConfig(params.modelTier || "fast");

  if (!config.apiKey) {
    throw new Error("DEEPSEEK_API_KEY belum dikonfigurasi.");
  }

  const truncatedPrompt = truncateContext(params.prompt);
  const maxTokens = params.maxTokens ?? config.maxTokens;
  const temperature = params.temperature ?? config.temperature;

  const messages: Array<{ role: string; content: string }> = [];

  if (params.systemPrompt) {
    messages.push({ role: "system", content: params.systemPrompt });
  }

  messages.push({ role: "user", content: truncatedPrompt });

  // Handle both https://api.deepseek.com and https://api.deepseek.com/v1 gracefully
  const endpoint = config.baseUrl.endsWith("/v1")
    ? `${config.baseUrl}/chat/completions`
    : `${config.baseUrl}/chat/completions`;

  console.info(`[AI Provider: DeepSeek] Requesting model "${config.model}" at ${endpoint}...`);

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages,
      max_tokens: maxTokens,
      temperature,
      stream: false,
      response_format: params.responseFormat,
    }),
  });

  const data = (await response.json()) as DeepSeekResponse;

  if (!response.ok || data.error) {
    const errorMsg = data.error?.message || `DeepSeek API error status ${response.status}`;
    console.error(`[AI Provider: DeepSeek] API Error (${response.status}):`, data.error || errorMsg);
    throw new Error(errorMsg);
  }

  const text = data.choices?.[0]?.message?.content?.trim() || "";

  if (!text) {
    throw new Error("DeepSeek mengembalikan respon kosong.");
  }

  return {
    text,
    provider: "deepseek",
    model: config.model,
    inputChars: truncatedPrompt.length + (params.systemPrompt?.length || 0),
    outputChars: text.length,
    estimatedTokens: data.usage?.total_tokens ?? estimateTokens(truncatedPrompt + text),
    cacheHit: false,
  };
}

// ─── Gemini Provider ─────────────────────────────────────────────────────────

async function callGemini(params: AIProviderParams): Promise<AIProviderResult> {
  const truncatedPrompt = truncateContext(params.prompt);

  console.info(`[AI Provider: Gemini] Requesting Gemini with model "${GEMINI_MODEL}"...`);

  const text = await askGemini({
    systemPrompt: params.systemPrompt || "",
    prompt: truncatedPrompt,
  });

  if (!text || text === GEMINI_EMPTY_ANSWER_FALLBACK) {
    throw new Error("Gemini mengembalikan jawaban kosong.");
  }

  return {
    text,
    provider: "gemini",
    model: GEMINI_MODEL,
    inputChars: truncatedPrompt.length + (params.systemPrompt?.length || 0),
    outputChars: text.length,
    estimatedTokens: estimateTokens(truncatedPrompt + text),
    cacheHit: false,
  };
}

// ─── Mock Provider ───────────────────────────────────────────────────────────

function callMock(params: AIProviderParams): AIProviderResult {
  const text = `[AI Mock Response] Feature: ${params.feature}. Prompt received (${params.prompt.length} chars). No AI provider configured.`;

  return {
    text,
    provider: "mock",
    model: "mock-v1",
    inputChars: params.prompt.length,
    outputChars: text.length,
    estimatedTokens: 0,
    cacheHit: false,
  };
}

// ─── Usage Logging ───────────────────────────────────────────────────────────

async function logAIUsage(
  result: AIProviderResult,
  feature: string,
  status: "success" | "error" | "cache_hit",
  errorMessage?: string
) {
  try {
    const db = getAdminDb();
    const logRef = db.collection("ai_usage_logs").doc();
    await logRef.set({
      id: logRef.id,
      provider: result.provider,
      model: result.model,
      feature,
      input_chars: result.inputChars,
      output_chars: result.outputChars,
      estimated_tokens: result.estimatedTokens,
      cache_hit: result.cacheHit,
      status,
      error_message: errorMessage || null,
      created_at: FieldValue.serverTimestamp(),
    });
  } catch (err) {
    console.error("[AI Usage Log] Failed to log usage:", err);
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Generate text using configured AI provider with seamless bidirectional fallback:
 * Primary (DeepSeek / Gemini) -> Secondary (Gemini / DeepSeek) -> Safe Log
 */
export async function generateText(params: AIProviderParams): Promise<AIProviderResult> {
  const useCache = params.useCache !== false;
  const resolvedProvider = params.provider ?? getProvider();

  // 1. Check cache first
  if (useCache) {
    const cached = await getCachedResponse(params.prompt, params.feature);
    if (cached) {
      const result: AIProviderResult = {
        text: cached,
        provider: resolvedProvider,
        model: "cache",
        inputChars: params.prompt.length,
        outputChars: cached.length,
        estimatedTokens: 0,
        cacheHit: true,
      };
      await logAIUsage(result, params.feature, "cache_hit");
      return result;
    }
  }

  let result: AIProviderResult | null = null;
  let primaryError: Error | null = null;

  // 2. Try Primary Provider
  if (resolvedProvider === "deepseek") {
    try {
      result = await callDeepSeek(params);
    } catch (err) {
      primaryError = err instanceof Error ? err : new Error(String(err));
      console.warn("[AI Provider] Primary provider DeepSeek failed:", primaryError.message);

      // Jangan paksa memanggil Gemini jika kunci Gemini tidak ada
      const hasGeminiKey = Boolean(process.env.GEMINI_API_KEY?.trim());
      if (hasGeminiKey) {
        console.info("[AI Provider] Attempting automatic fallback to Gemini...");
        try {
          result = await callGemini(params);
          console.info("[AI Provider] Fallback to Gemini SUCCESS.");
        } catch (geminiErr) {
          const gErr = geminiErr instanceof Error ? geminiErr.message : String(geminiErr);
          console.error("[AI Provider] Both DeepSeek & Gemini failed:", {
            deepseek: primaryError.message,
            gemini: gErr,
          });
        }
      } else {
        console.warn("[AI Provider] GEMINI_API_KEY tidak dikonfigurasi, melewati fallback Gemini.");
      }
    }
  } else if (resolvedProvider === "gemini") {
    const hasGeminiKey = Boolean(process.env.GEMINI_API_KEY?.trim());
    if (hasGeminiKey) {
      try {
        result = await callGemini(params);
      } catch (err) {
        primaryError = err instanceof Error ? err : new Error(String(err));
        console.warn("[AI Provider] Primary provider Gemini failed:", primaryError.message);

        const hasDeepSeekKey = Boolean(process.env.DEEPSEEK_API_KEY?.trim());
        if (hasDeepSeekKey) {
          console.info("[AI Provider] Attempting automatic fallback to DeepSeek...");
          try {
            result = await callDeepSeek(params);
            console.info("[AI Provider] Fallback to DeepSeek SUCCESS.");
          } catch (deepseekErr) {
            const dErr = deepseekErr instanceof Error ? deepseekErr.message : String(deepseekErr);
            console.error("[AI Provider] Both Gemini & DeepSeek failed:", {
              gemini: primaryError.message,
              deepseek: dErr,
            });
          }
        }
      }
    } else {
      // Gemini requested but no key, use DeepSeek directly
      const hasDeepSeekKey = Boolean(process.env.DEEPSEEK_API_KEY?.trim());
      if (hasDeepSeekKey) {
        console.info("[AI Provider] GEMINI_API_KEY tidak ada, langsung beralih ke DeepSeek...");
        try {
          result = await callDeepSeek(params);
        } catch (deepseekErr) {
          primaryError = deepseekErr instanceof Error ? deepseekErr : new Error(String(deepseekErr));
        }
      } else {
        console.warn("[AI Provider] Tidak ada API key AI yang tersedia (Gemini & DeepSeek tidak terkonfigurasi).");
      }
    }
  } else {
    result = callMock(params);
  }

  // 3. Handle success or final fallback
  if (result && result.text) {
    if (useCache && !result.cacheHit) {
      await setCachedResponse(params.prompt, params.feature, result.text);
    }
    await logAIUsage(result, params.feature, "success");
    return result;
  }

  // If all providers failed, construct actionable fallback
  const lastErrorMessage = primaryError?.message || "Semua AI Provider (DeepSeek & Gemini) gagal merespons.";
  const safePanitiaReply = "Waduh, koneksi ke asisten AI lagi bermasalah nih. Tapi kamu tetep bisa pakai perintah biasa kayak `!jobdex tugas saya` ya! ✌️";
  const fallbackResult: AIProviderResult = {
    text: safePanitiaReply,
    provider: "mock",
    model: "fallback",
    inputChars: params.prompt.length,
    outputChars: safePanitiaReply.length,
    estimatedTokens: 0,
    cacheHit: false,
  };

  await logAIUsage(fallbackResult, params.feature, "error", lastErrorMessage);
  return fallbackResult;
}

/**
 * Generate a short summary of text using AI (with small token budget)
 */
export async function summarize(
  text: string,
  maxLength = 300,
  feature = "summarize"
): Promise<AIProviderResult> {
  const truncated = text.substring(0, 2000);
  return generateText({
    prompt: `Ringkas teks berikut dalam ${maxLength} karakter atau kurang, dalam Bahasa Indonesia:\n\n${truncated}`,
    systemPrompt: "Kamu adalah asisten ringkasan. Jawab singkat dan padat.",
    maxTokens: 200,
    feature,
  });
}
