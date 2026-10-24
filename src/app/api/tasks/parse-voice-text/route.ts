import { NextResponse, type NextRequest } from "next/server";
import { getServerAuthContext } from "@/lib/server/auth";
import { askGemini } from "@/lib/server/gemini";

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
    const text = typeof body?.text === "string" ? body.text.trim() : "";

    if (!text) {
      return NextResponse.json(
        { error: "Teks transkrip suara wajib diisi." },
        { status: 400 }
      );
    }

    // 3. System prompt for Gemini AI
    const systemPrompt = `Kamu adalah asisten AI pencatat tugas akademik Ilkom B Undiksha.
Tugasmu adalah menganalisis teks transkrip suara pengguna dan mengekstrak informasi tugas kuliah ke dalam objek JSON murni tanpa formatting markdown.

Tahun dasar saat ini adalah 2026. Tanggal hari ini adalah 25 Oktober 2026. Zona waktu: WITA (UTC+8).

Aturan ekstraksi:
1. "course_name": Nama mata kuliah yang disebutkan (contoh: "Pemrograman Web", "Basis Data Lanjut", "Kecerdasan Buatan", "Sistem Terdistribusi"). Jika tidak eksplisit, pilih mata kuliah yang paling mendekati.
2. "name": Judul atau intisari spesifik tugas (contoh: "Praktikum REST API Next.js", "Tugas Normalisasi Database", "Makalah Etika Profesi").
3. "description": Ketentuan pengerjaan, format pengumpulan, atau instruksi yang disebutkan dalam suara.
4. "deadline": Tanggal tenggat pengumpulan dalam format "YYYY-MM-DD" (contoh: "2026-10-31"). Konversikan tanggal relatif (seperti "besok", "lusa", "rabu depan", "minggu depan", "akhir bulan") relatif terhadap tanggal 25 Oktober 2026.
5. "submission_url": Tempat pengumpulan tugas. Jika disebutkan link atau platform (seperti E-Learning Undiksha, Google Classroom, GitHub, Drive), gunakan itu. Jika tidak disebutkan, default-kan ke "E-Learning Undiksha".

Format output WAJIB HANYA berupa JSON valid dengan skema:
{
  "course_name": "Nama mata kuliah",
  "name": "Judul tugas",
  "description": "Ketentuan pengerjaan atau detail tugas",
  "deadline": "YYYY-MM-DD",
  "submission_url": "Tempat pengumpulan"
}`;

    const userPrompt = `Transkrip suara: "${text}"`;

    let extractedData = {
      course_name: "",
      name: text.length > 60 ? `${text.slice(0, 57)}...` : text,
      description: text,
      deadline: "",
      submission_url: "E-Learning Undiksha",
    };

    try {
      const geminiResponse = await askGemini({
        systemPrompt,
        prompt: userPrompt,
      });

      const cleaned = cleanJsonMarkdown(geminiResponse);
      const parsed = JSON.parse(cleaned);

      if (parsed && typeof parsed === "object") {
        extractedData = {
          course_name: String(parsed.course_name || "").trim(),
          name: String(parsed.name || "").trim() || extractedData.name,
          description: String(parsed.description || "").trim() || extractedData.description,
          deadline: String(parsed.deadline || "").trim(),
          submission_url: String(parsed.submission_url || "E-Learning Undiksha").trim(),
        };
      }
    } catch (aiErr) {
      console.warn("[parse-voice-text] Gemini parsing fallback used:", aiErr);
    }

    return NextResponse.json({
      ok: true,
      data: extractedData,
    });
  } catch (err) {
    console.error("[parse-voice-text] Server error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Terjadi kesalahan server." },
      { status: 500 }
    );
  }
}
