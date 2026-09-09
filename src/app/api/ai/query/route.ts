import { NextResponse, type NextRequest } from "next/server";
import { AI_SYSTEM_PROMPT } from "@/lib/ai-prompts";
import { canAccessAI } from "@/lib/permissions";
import { buildAIContext } from "@/lib/server/ai-context";
import { generateText } from "@/lib/server/ai-provider";
import { getServerAuthContext } from "@/lib/server/auth";
import { FieldValue, getAdminDb } from "@/lib/server/firebase-admin";
import {
  isReferenceSearchQuestion,
  searchDesignReferencesDetailed,
} from "@/lib/server/reference-search";
import { getCachedResponse, setCachedResponse } from "@/lib/server/ai-cache";

export const runtime = "nodejs";

const DEFAULT_DAILY_LIMIT = 20;

function getDailyLimit() {
  const rawValue = process.env.AI_DAILY_LIMIT;

  if (!rawValue) {
    return DEFAULT_DAILY_LIMIT;
  }

  const parsedValue = Number(rawValue);

  if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
    return DEFAULT_DAILY_LIMIT;
  }

  return parsedValue;
}

function getStartOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

async function countQuestionsToday(userId: string) {
  const snapshot = await getAdminDb()
    .collection("ai_logs")
    .where("asked_by", "==", userId)
    .get();
  const startOfToday = getStartOfToday().getTime();

  return snapshot.docs.filter((item) => {
    const createdAt = item.data().created_at;

    if (!createdAt || typeof createdAt !== "object" || !("toDate" in createdAt)) {
      return false;
    }

    return (createdAt as { toDate: () => Date }).toDate().getTime() >= startOfToday;
  }).length;
}

export async function POST(request: NextRequest) {
  try {
    const { profile } = await getServerAuthContext(request);

    if (!canAccessAI(profile)) {
      return NextResponse.json(
        { error: "Anda tidak punya akses ke AI Assistant." },
        { status: 403 },
      );
    }

    const questionsToday = await countQuestionsToday(profile.id);
    const dailyLimit = getDailyLimit();

    if (questionsToday >= dailyLimit) {
      return NextResponse.json(
        { error: `Batas ${dailyLimit} pertanyaan hari ini sudah tercapai.` },
        { status: 429 },
      );
    }

    let body: {
      question?: string;
      eventId?: string;
    };

    try {
      body = (await request.json()) as {
        question?: string;
        eventId?: string;
      };
    } catch {
      return NextResponse.json(
        { error: "Request body tidak valid." },
        { status: 400 },
      );
    }

    const question = body?.question?.trim() ?? "";

    if (!question) {
      return NextResponse.json(
        { error: "Pertanyaan wajib diisi." },
        { status: 400 },
      );
    }

    if (question.length > 1000) {
      return NextResponse.json(
        { error: "Pertanyaan terlalu panjang. Maksimal 1000 karakter." },
        { status: 400 },
      );
    }

    const userOrgId = profile.organization_id || profile.org_id || ((profile as unknown as Record<string, unknown>).orgId as string) || "main_org";
    const userCampusId = profile.campus_id || profile.univ_id || ((profile as unknown as Record<string, unknown>).campusId as string) || "ui";

    // --- Reference Search Intent Detection ---
    if (isReferenceSearchQuestion(question)) {
      // Check cache first (namespaced by orgId)
      const cacheKey = `${userOrgId}:${question}`;
      const cached = await getCachedResponse(cacheKey, "reference_search");
      if (cached) {
        const logRef = getAdminDb().collection("ai_logs").doc();
        await logRef.set({
          id: logRef.id,
          organization_id: userOrgId,
          org_id: userOrgId,
          orgId: userOrgId,
          campus_id: userCampusId,
          univ_id: userCampusId,
          asked_by: profile.id,
          question,
          context_summary: "Reference search query - Cache Hit",
          answer: cached,
          model_used: "cache-reference-search",
          source: "web",
          created_at: FieldValue.serverTimestamp(),
          detected_intent: "reference_search",
          fallback_used: false,
        });

        return NextResponse.json({
          answer: cached,
          context_summary: "Reference search query - Cache Hit",
        });
      }

      // Perform detailed search scoped to tenant
      const detailedResult = await searchDesignReferencesDetailed(question, {
        org_id: userOrgId,
        campus_id: userCampusId,
      });

      // Save to cache (10 mins TTL)
      await setCachedResponse(cacheKey, "reference_search", detailedResult.answer, 10);

      const logRef = getAdminDb().collection("ai_logs").doc();
      await logRef.set({
        id: logRef.id,
        organization_id: userOrgId,
        org_id: userOrgId,
        orgId: userOrgId,
        campus_id: userCampusId,
        univ_id: userCampusId,
        asked_by: profile.id,
        question,
        context_summary: `Reference search query - Intent: ${detailedResult.intent.intent}, Subtype: ${detailedResult.intent.subtype || "-"}`,
        answer: detailedResult.answer,
        model_used: detailedResult.rerankerProvider,
        source: "web",
        created_at: FieldValue.serverTimestamp(),
        // Rich metadata logging
        detected_intent: detailedResult.intent.intent,
        selected_asset_type: detailedResult.intent.assetType || "desain",
        candidate_count: detailedResult.candidateCount,
        reranker_provider: detailedResult.rerankerProvider,
        final_result_count: detailedResult.finalResultCount,
        fallback_used: detailedResult.fallbackUsed,
      });

      return NextResponse.json({
        answer: detailedResult.answer,
        context_summary: `Reference search query - Intent: ${detailedResult.intent.intent}, Subtype: ${detailedResult.intent.subtype || "-"}`,
      });
    }

    const { contextSummary } = await buildAIContext({
      profile,
      eventId: body.eventId,
    });
    const prompt = [
      "CONTEXT JOBDEX.IN:",
      contextSummary,
      "",
      "PERTANYAAN USER:",
      question,
      "",
      "Instruksi jawaban: jawab ringkas, gunakan bullet bila membantu, dan jangan memakai data di luar context.",
    ].join("\n");
    const aiResult = await generateText({
      systemPrompt: AI_SYSTEM_PROMPT,
      prompt,
      feature: "web_assistant",
      modelTier: "pro",
    });
    const answer = aiResult.text;
    const logRef = getAdminDb().collection("ai_logs").doc();

    await logRef.set({
      id: logRef.id,
      organization_id: profile.organization_id || "main_org",
      asked_by: profile.id,
      question,
      context_summary: contextSummary.slice(0, 12000),
      answer,
      model_used: aiResult.model,
      source: "web",
      created_at: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({
      answer,
      context_summary: contextSummary,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "AI Assistant gagal menjawab.",
      },
      { status: 500 },
    );
  }
}
