import { NextResponse, type NextRequest } from "next/server";
import { getServerAuthContext } from "@/lib/server/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function cleanJsonMarkdown(raw: string): string {
  let clean = raw.trim();
  if (clean.startsWith("```json")) {
    clean = clean.replace(/^```json\s*/i, "").replace(/```$/, "").trim();
  } else if (clean.startsWith("```")) {
    clean = clean.replace(/^```\s*/, "").replace(/```$/, "").trim();
  }
  return clean;
}

interface GeminiApiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
}

export async function POST(request: NextRequest) {
  try {
    // 1. Verify user authentication
    try {
      await getServerAuthContext(request);
    } catch (authErr) {
      console.warn("[parse-voice-text] Authentication failed:", authErr);
      return NextResponse.json(
        { error: "Unauthorized. Silakan login terlebih dahulu." },
        { status: 401 }
      );
    }

    // 2. Parse request payload
    const body = await request.json();
    const transcript = (
      typeof body?.transcript === "string"
        ? body.transcript
        : typeof body?.text === "string"
        ? body.text
        : ""
    ).trim();

    if (!transcript) {
      return NextResponse.json(
        { error: "Teks transkrip suara wajib diisi." },
        { status: 400 }
      );
    }

    // 3. Verify Gemini API Key
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY belum dikonfigurasi di environment variables." },
        { status: 500 }
      );
    }

    // 4. Sequential Native REST call to Active Gemini Models (gemini-2.5-flash, gemini-flash-latest, etc.)
    const systemInstruction = `Kamu adalah parser teks tugas kuliah yang sangat teliti untuk mahasiswa Ilkom Undiksha.
Tugasmu adalah menganalisis teks transkrip percakapan suara santai dan mengekstrak entitas tugas kuliah.
Buang semua kata filler, sapaan, atau basa-basi (seperti 'tes tes', 'tolong buatkan', 'apa namanya', 'gess', 'halo').

Basis Waktu: Hari ini adalah Minggu, 25 Oktober 2026.

Aturan Status & Kelengkapan:
- Jika ketiga entitas inti (course_name, name, dan deadline) terdeteksi lengkap, set "status": "ready" dan "missing_fields": [].
- Jika ada satu atau lebih entitas inti yang belum lengkap, set "status": "needs_clarification", isi field yang belum ada dengan null, sebutkan di "missing_fields" (misal: ["deadline"]), dan buatkan "clarification_question" yang ramah dan spesifik menanyakan informasi yang kurang (misal: 'Tugas RPL sudah dicatat, tapi kapan tenggat waktunya ya?').

Format JSON WAJIB murni tanpa markdown:
{
  "status": "ready" | "needs_clarification",
  "course_name": "Nama mata kuliah atau null jika tidak disebutkan",
  "name": "Judul tugas atau null jika tidak disebutkan",
  "description": "Instruksi/ketentuan pengerjaan bersih tanpa kata filler (contoh: Kerjakan di double folio, upload di e-learning Undiksha)",
  "deadline": "Format string input datetime-local: YYYY-MM-DDTHH:mm atau null jika tidak disebutkan. Jika jam tidak disebutkan, gunakan pukul 23:59",
  "submission_url": "Tempat pengumpulan (default: 'E-Learning Undiksha')",
  "missing_fields": ["deadline"],
  "clarification_question": "Pertanyaan ramah dan spesifik menanyakan informasi yang kurang (misal: 'Tugas RPL sudah dicatat, tapi kapan tenggat waktunya ya?') atau null jika status ready"
}`;

    const modelsToTry = [
      process.env.GEMINI_MODEL,
      "gemini-3.8-flash",
      "gemini-3.5-flash-lite",
      "gemini-3.8-pro",
    ].filter(Boolean) as string[];
    const uniqueModels = [...new Set(modelsToTry)];

    let geminiData: GeminiApiResponse | null = null;
    let lastError = "";

    for (const model of uniqueModels) {
      try {
        console.log(`[parse-voice-text] Attempting Gemini model: ${model}`);
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

        const geminiRes = await fetch(geminiUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          signal: AbortSignal.timeout(15000),
          body: JSON.stringify({
            system_instruction: {
              parts: [{ text: systemInstruction }],
            },
            contents: [
              {
                role: "user",
                parts: [{ text: transcript }],
              },
            ],
            generationConfig: {
              temperature: 0.1,
              response_mime_type: "application/json",
            },
          }),
        });

        if (geminiRes.ok) {
          geminiData = (await geminiRes.json()) as GeminiApiResponse;
          console.log(`[parse-voice-text] Successfully parsed voice text using model: ${model}`);
          break;
        } else {
          const errText = await geminiRes.text();
          console.warn(`[parse-voice-text] Model ${model} failed (HTTP ${geminiRes.status}):`, errText);
          lastError = `Status ${geminiRes.status}: ${errText}`;
        }
      } catch (callErr) {
        console.warn(`[parse-voice-text] Network error calling ${model}:`, callErr);
        lastError = callErr instanceof Error ? callErr.message : String(callErr);
      }
    }

    if (!geminiData) {
      console.error("[parse-voice-text] All Gemini models failed:", lastError);
      return NextResponse.json(
        { error: `Gemini API error (Seluruh model gagal): ${lastError}` },
        { status: 502 }
      );
    }
    const rawText =
      geminiData?.candidates?.[0]?.content?.parts
        ?.map((part: { text?: string }) => part.text ?? "")
        .join("")
        .trim() || "";

    const cleanedText = cleanJsonMarkdown(rawText);
    const parsed = JSON.parse(cleanedText) as Record<string, unknown>;

    const courseName = parsed.course_name ? String(parsed.course_name).trim() : null;
    const name = parsed.name ? String(parsed.name).trim() : (parsed.title ? String(parsed.title).trim() : null);
    const description = parsed.description ? String(parsed.description).trim() : "";
    const deadline = parsed.deadline ? String(parsed.deadline).trim() : null;
    const submissionUrl = parsed.submission_url ? String(parsed.submission_url).trim() : "E-Learning Undiksha";

    const missing: string[] = [];
    if (!courseName) missing.push("course_name");
    if (!name) missing.push("name");
    if (!deadline) missing.push("deadline");

    const status: "ready" | "needs_clarification" =
      missing.length === 0 && parsed.status !== "needs_clarification"
        ? "ready"
        : "needs_clarification";

    const clarificationQuestion = parsed.clarification_question
      ? String(parsed.clarification_question).trim()
      : null;

    const extracted = {
      status,
      course_name: courseName,
      name,
      description,
      deadline,
      submission_url: submissionUrl,
      missing_fields: missing.length > 0 ? missing : (Array.isArray(parsed.missing_fields) ? (parsed.missing_fields as string[]) : []),
      clarification_question: clarificationQuestion,
    };

    return NextResponse.json({
      ok: true,
      ...extracted,
      data: extracted,
    });
  } catch (err) {
    console.error("[parse-voice-text] Server error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Terjadi kesalahan server saat memproses suara." },
      { status: 500 }
    );
  }
}
