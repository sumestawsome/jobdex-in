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

    // 4. Native REST call to Gemini 1.5 Flash
    const systemInstruction = `Kamu adalah parser teks tugas kuliah yang sangat teliti untuk mahasiswa Ilkom Undiksha.
Tugasmu adalah menganalisis teks transkrip percakapan suara santai dan mengekstrak entitas tugas kuliah.
Buang semua kata filler, sapaan, atau basa-basi (seperti 'tes tes', 'tolong buatkan', 'apa namanya', 'gess', 'halo').

Basis Waktu: Hari ini adalah Minggu, 25 Oktober 2026.

Format JSON WAJIB murni tanpa markdown:
{
  "course_name": "Nama mata kuliah yang disebutkan (contoh: Basis Data, Pemrograman Web)",
  "name": "Judul spesifik tugas (contoh: Tugas Latihan 8, Resume Jurnal)",
  "description": "Instruksi/ketentuan pengerjaan bersih tanpa kata filler (contoh: Kerjakan di double folio, upload di e-learning Undiksha)",
  "deadline": "Format string input datetime-local: YYYY-MM-DDTHH:mm. Jika jam tidak disebutkan, gunakan pukul 23:59",
  "submission_url": "Tempat atau platform pengumpulan (default: 'E-Learning Undiksha')"
}`;

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    const geminiRes = await fetch(geminiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
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

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error("[parse-voice-text] Gemini API error:", geminiRes.status, errText);
      return NextResponse.json(
        { error: `Gemini API error (Status ${geminiRes.status}): ${errText}` },
        { status: 502 }
      );
    }

    const geminiData = await geminiRes.json();
    const rawText =
      geminiData?.candidates?.[0]?.content?.parts
        ?.map((part: { text?: string }) => part.text ?? "")
        .join("")
        .trim() || "";

    const cleanedText = cleanJsonMarkdown(rawText);
    const parsed = JSON.parse(cleanedText);

    const extracted = {
      course_name: String(parsed.course_name || "").trim(),
      name: String(parsed.name || "").trim(),
      description: String(parsed.description || "").trim(),
      deadline: String(parsed.deadline || "").trim(),
      submission_url: String(parsed.submission_url || "E-Learning Undiksha").trim(),
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
