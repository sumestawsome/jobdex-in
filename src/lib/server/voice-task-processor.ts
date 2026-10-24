import "server-only";

import { NextResponse } from "next/server";
import { getAdminDb, FieldValue } from "@/lib/server/firebase-admin";
import { sendWhatsAppMessage } from "@/lib/server/whatsapp";
import {
  DEFAULT_CLASS_WORKSPACE_ID,
  DEFAULT_CLASS_GROUP_ID,
  DEFAULT_CLASS_DISCUSSION_GROUP_ID,
  handleAcademicTaskCreated,
} from "@/lib/server/academic-broadcast";
import {
  verifyAdminKomunitas,
  parseAcademicDeadline,
} from "@/lib/server/whatsapp-academic-task-creator";
import type { NormalizedIncomingWhatsAppMessage } from "@/types";

export interface ExtractedVoiceTask {
  course_name?: string;
  title?: string;
  description?: string;
  deadline?: string;
  submission_url?: string;
  error?: string;
}

const AUDIO_EXT_REGEX = /\.(ogg|opus|oga|mp3|m4a|wav|aac|wma|webm|flac)(\?.*)?$/i;

/**
 * Checks if incoming WhatsApp message is an audio file or voice note.
 * Inspects url, mediaUrl, filename, messageType/filetype, and raw payload.
 */
export function isAudioVoiceNote(
  incoming: NormalizedIncomingWhatsAppMessage,
  payload?: unknown
): { isAudio: boolean; audioUrl: string | null; mimeType?: string } {
  const root = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
  const firstChoice =
    Array.isArray(root.choices) && root.choices[0] && typeof root.choices[0] === "object"
      ? (root.choices[0] as Record<string, unknown>)
      : {};

  const pickCandidate = (...vals: unknown[]): string => {
    for (const v of vals) {
      if (typeof v === "string" && v.trim()) return v.trim();
    }
    return "";
  };

  const candidateUrl = pickCandidate(
    incoming.url,
    incoming.mediaUrl,
    firstChoice.url,
    firstChoice.file,
    firstChoice.media,
    firstChoice.audio,
    root.url,
    root.file,
    root.media,
    root.audio
  );

  const candidateFilename = pickCandidate(
    incoming.filename,
    firstChoice.filename,
    firstChoice.name_file,
    root.filename,
    root.name_file
  );

  const candidateType = pickCandidate(
    incoming.filetype,
    incoming.messageType,
    firstChoice.filetype,
    firstChoice.type,
    root.filetype,
    root.type
  );

  // 1. Check direct URL extension
  if (candidateUrl && AUDIO_EXT_REGEX.test(candidateUrl)) {
    return { isAudio: true, audioUrl: candidateUrl };
  }

  // 2. Check filename extension
  if (candidateFilename && AUDIO_EXT_REGEX.test(candidateFilename) && candidateUrl) {
    return { isAudio: true, audioUrl: candidateUrl };
  }

  // 3. Check MIME type or messageType (audio / voice / ptt)
  const isAudioType = /(audio|voice|ptt)/i.test(candidateType);
  if (isAudioType && candidateUrl) {
    return { isAudio: true, audioUrl: candidateUrl };
  }

  // 4. Check if message itself is an audio URL
  const trimmedMsg = (incoming.message || "").trim();
  if (/^https?:\/\/[^\s]+$/i.test(trimmedMsg) && AUDIO_EXT_REGEX.test(trimmedMsg)) {
    return { isAudio: true, audioUrl: trimmedMsg };
  }

  return { isAudio: false, audioUrl: null };
}

/**
 * Strips markdown code fences from JSON output.
 */
function cleanJsonMarkdown(raw: string): string {
  let clean = raw.trim();
  if (clean.startsWith("```json")) {
    clean = clean.replace(/^```json\s*/i, "").replace(/```$/, "").trim();
  } else if (clean.startsWith("```")) {
    clean = clean.replace(/^```\s*/, "").replace(/```$/, "").trim();
  }
  return clean;
}

/**
 * Formats a Date object in WITA timezone:
 * Example: "Minggu, 25 Oktober 2026 pukul 23:59"
 */
export function formatVoiceDeadlineWita(dateObj: Date): string {
  const days = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  const months = [
    "Januari",
    "Februari",
    "Maret",
    "April",
    "Mei",
    "Juni",
    "Juli",
    "Agustus",
    "September",
    "Oktober",
    "November",
    "Desember",
  ];

  const utc = dateObj.getTime() + dateObj.getTimezoneOffset() * 60000;
  const witaDate = new Date(utc + 3600000 * 8);

  const dayName = days[witaDate.getDay()];
  const dateNum = witaDate.getDate();
  const monthName = months[witaDate.getMonth()];
  const year = witaDate.getFullYear();
  const hours = String(witaDate.getHours()).padStart(2, "0");
  const minutes = String(witaDate.getMinutes()).padStart(2, "0");

  return `${dayName}, ${dateNum} ${monthName} ${year} pukul ${hours}:${minutes}`;
}

/**
 * Resolves appropriate MIME type for audio buffer.
 */
function resolveAudioMimeType(audioUrl: string, headerType?: string | null): string {
  let mime = (headerType || "").split(";")[0].trim().toLowerCase();
  if (mime && mime.startsWith("audio/") && mime !== "audio/octet-stream") {
    return mime;
  }

  const cleanUrl = audioUrl.toLowerCase();
  if (cleanUrl.includes(".ogg") || cleanUrl.includes(".opus")) return "audio/ogg";
  if (cleanUrl.includes(".mp3")) return "audio/mp3";
  if (cleanUrl.includes(".m4a")) return "audio/m4a";
  if (cleanUrl.includes(".wav")) return "audio/wav";
  if (cleanUrl.includes(".aac")) return "audio/aac";
  if (cleanUrl.includes(".webm")) return "audio/webm";
  if (cleanUrl.includes(".flac")) return "audio/flac";

  // Default fallback for WhatsApp Voice Notes / PTT
  return "audio/ogg";
}

/**
 * Transcribes audio via Gemini Flash API and extracts academic task JSON.
 */
export async function extractTaskFromVoiceNote(audioUrl: string): Promise<ExtractedVoiceTask> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured in environment variables.");
  }

  // 1. Fetch audio buffer
  console.log(`[VoiceTaskProcessor] Fetching audio from URL: ${audioUrl.slice(0, 60)}...`);
  const audioRes = await fetch(audioUrl, {
    headers: {
      "User-Agent": "JobDex-In-VoiceProcessor/1.0",
    },
  });

  if (!audioRes.ok) {
    throw new Error(`Failed to download audio file: HTTP status ${audioRes.status}`);
  }

  const contentTypeHeader = audioRes.headers.get("content-type");
  const mimeType = resolveAudioMimeType(audioUrl, contentTypeHeader);
  const arrayBuffer = await audioRes.arrayBuffer();
  const base64Audio = Buffer.from(arrayBuffer).toString("base64");

  console.log(`[VoiceTaskProcessor] Audio downloaded successfully (${arrayBuffer.byteLength} bytes, MIME: ${mimeType})`);

  // 2. Call Gemini 1.5 Flash API
  const systemPrompt = `Kamu adalah asisten pencatat tugas akademik Ilkom B Undiksha. Tugasmu adalah mendengarkan pesan suara berikut dan mengekstrak informasi tugas kuliah ke dalam format JSON murni.
Tahun dasar saat ini adalah 2026. Tanggal hari ini adalah 25 Oktober 2026.
Output WAJIB berupa JSON valid dengan skema:
{
  "course_name": "Nama mata kuliah",
  "title": "Judul atau intisari tugas",
  "description": "Ketentuan pengerjaan atau detail yang disebutkan",
  "deadline": "Format YYYY-MM-DD HH:mm (WITA)",
  "submission_url": "Tempat pengumpulan (default: 'E-Learning Undiksha' jika tidak disebutkan)"
}`;

  const userInstruction = `Dengarkan rekaman suara ini dan ekstrak informasi tugas kuliah sesuai format JSON yang ditentukan.
Jika rekaman suara tidak jelas, terlalu bising, atau bukan berisi tentang tugas kuliah, kembalikan objek JSON dengan field "error": "not_a_task".`;

  const modelsToTry = [
    process.env.GEMINI_MODEL,
    "gemini-1.5-flash",
    "gemini-2.0-flash",
    "gemini-1.5-pro",
  ].filter(Boolean) as string[];
  const uniqueModels = [...new Set(modelsToTry)];

  let rawJsonText = "";
  let lastError: Error | null = null;

  for (const model of uniqueModels) {
    try {
      console.log(`[VoiceTaskProcessor] Sending multimodal audio request to Gemini model: ${model}`);
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

      const geminiRes = await fetch(geminiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          system_instruction: {
            parts: [{ text: systemPrompt }],
          },
          contents: [
            {
              role: "user",
              parts: [
                {
                  inline_data: {
                    mime_type: mimeType,
                    data: base64Audio,
                  },
                },
                {
                  text: userInstruction,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            response_mime_type: "application/json",
          },
        }),
      });

      const responseData = (await geminiRes.json()) as {
        candidates?: Array<{
          content?: {
            parts?: Array<{ text?: string }>;
          };
        }>;
        error?: { message?: string };
      };

      if (!geminiRes.ok) {
        throw new Error(
          responseData.error?.message
            ? `Gemini (${model}) error: ${responseData.error.message}`
            : `Gemini (${model}) failed with HTTP status ${geminiRes.status}`
        );
      }

      const answerText = responseData.candidates?.[0]?.content?.parts
        ?.map((p) => p.text ?? "")
        .join("")
        .trim();

      if (answerText) {
        rawJsonText = answerText;
        break;
      }
    } catch (modelErr) {
      lastError = modelErr instanceof Error ? modelErr : new Error(String(modelErr));
      console.warn(`[VoiceTaskProcessor] Model ${model} failed:`, lastError.message);
    }
  }

  if (!rawJsonText) {
    throw lastError || new Error("Gemini API failed to return text candidate.");
  }

  const cleaned = cleanJsonMarkdown(rawJsonText);
  const parsed = JSON.parse(cleaned) as ExtractedVoiceTask;
  return parsed;
}

/**
 * Main handler for WhatsApp Voice Notes / Audio messages.
 * Verifies access, extracts task info via Gemini Flash, saves to Firestore,
 * triggers instant broadcast if diffDays <= 3, and sends friendly reply.
 */
export async function handleWhatsAppVoiceTask(
  incoming: NormalizedIncomingWhatsAppMessage,
  audioUrl: string
): Promise<NextResponse> {
  const db = getAdminDb();
  const workspaceId = DEFAULT_CLASS_WORKSPACE_ID;
  const ANNOUNCEMENT_GROUP_ID = DEFAULT_CLASS_GROUP_ID; // 120363411033795051@g.us
  const DISCUSSION_GROUP_ID = DEFAULT_CLASS_DISCUSSION_GROUP_ID; // 120363432766465224@g.us

  // 1. Verifikasi Jalur Pengiriman:
  // - Grup pengumuman komunitas: BLOKIR TOTAL
  const cleanIncomingGroup = incoming.groupId ? incoming.groupId.replace(/\D/g, "") : "";
  const cleanAnnouncementGroup = ANNOUNCEMENT_GROUP_ID.replace(/\D/g, "");
  const cleanDiscussionGroup = DISCUSSION_GROUP_ID.replace(/\D/g, "");

  if (incoming.isGroup && cleanIncomingGroup === cleanAnnouncementGroup) {
    console.log("[VoiceTaskProcessor] Blocked voice note in announcement group");
    return NextResponse.json({
      ok: true,
      ignored: true,
      reason: "voice_note_blocked_in_announcement_group",
    });
  }

  // - Jika audio dikirim di grup lain selain grup diskusi kelas: abaikan
  if (incoming.isGroup && cleanIncomingGroup !== cleanDiscussionGroup) {
    console.log("[VoiceTaskProcessor] Ignored voice note in non-class group:", incoming.groupId);
    return NextResponse.json({
      ok: true,
      ignored: true,
      reason: "voice_note_only_allowed_in_class_discussion_or_direct_chat",
    });
  }

  // 2. Validasi Hak Akses Admin Komunitas / Super Admin
  const { isAdmin, adminUser, replyTarget, isGroupTarget } = await verifyAdminKomunitas(incoming, db);

  if (!isAdmin || !adminUser) {
    console.warn(`[VoiceTaskProcessor] Unauthorized voice note attempt from sender: ${incoming.sender}`);
    const deniedMsg = [
      "⛔ *Akses Ditolak*",
      "Maaf, fitur pencatatan tugas otomatis via Voice Note hanya dapat digunakan oleh *Admin Komunitas* atau *Super Admin*.",
    ].join("\n");

    await sendWhatsAppMessage({
      target: replyTarget,
      message: deniedMsg,
      type: isGroupTarget ? "group" : "phone",
      org_id: workspaceId,
    });

    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 403 });
  }

  // Fallback error message jika audio tidak dapat dikenali
  const fallbackErrorMsg =
    "⚠️ Maaf, bot tidak dapat mengenali detail tugas dari pesan suara tersebut. Pastikan suara terdengar jelas dan menyebutkan mata kuliah serta tenggat waktunya.";

  try {
    // 3. Ekstraksi Multimodal menggunakan Gemini Flash API
    const extracted = await extractTaskFromVoiceNote(audioUrl);
    console.log("[VoiceTaskProcessor] Extracted task result:", extracted);

    if (
      extracted.error === "not_a_task" ||
      !extracted.course_name?.trim() ||
      !extracted.title?.trim() ||
      !extracted.deadline?.trim()
    ) {
      console.warn("[VoiceTaskProcessor] Voice note was not recognized as a valid academic task");
      await sendWhatsAppMessage({
        target: replyTarget,
        message: fallbackErrorMsg,
        type: isGroupTarget ? "group" : "phone",
        org_id: workspaceId,
      });

      return NextResponse.json({ ok: false, error: "unrecognized_voice_note" });
    }

    const courseName = extracted.course_name.trim();
    const taskTitle = extracted.title.trim();
    const description =
      extracted.description?.trim() ||
      `Tugas mata kuliah ${courseName}. Selesaikan dan kumpulkan sesuai instruksi dosen pengampu.`;
    const submissionUrl = extracted.submission_url?.trim() || "E-Learning Undiksha";

    // 4. Parsing Tanggal Tenggat
    // Hapus suffix "(WITA)" jika dikembalikan oleh model
    const cleanDeadlinStr = extracted.deadline.replace(/\(wita\)/i, "").trim();
    const deadlineDate = parseAcademicDeadline(cleanDeadlinStr);

    if (!deadlineDate || isNaN(deadlineDate.getTime())) {
      console.warn(`[VoiceTaskProcessor] Failed to parse deadline from voice note: "${extracted.deadline}"`);
      await sendWhatsAppMessage({
        target: replyTarget,
        message: fallbackErrorMsg,
        type: isGroupTarget ? "group" : "phone",
        org_id: workspaceId,
      });

      return NextResponse.json({ ok: false, error: "invalid_deadline_date" });
    }

    // 5. Simpan Tugas ke Firestore (koleksi `tasks` ruang kelas `ws_ilkom_2024`)
    const newTaskRef = db.collection("tasks").doc();
    const taskData: Record<string, unknown> = {
      id: newTaskRef.id,
      workspace_id: workspaceId,
      organization_id: workspaceId,
      org_id: workspaceId,
      orgId: workspaceId,
      campus_id: "univ-undiksha",
      campusId: "univ-undiksha",
      univ_id: "univ-undiksha",
      univId: "univ-undiksha",
      type: "tugas_kuliah",
      name: taskTitle,
      title: taskTitle,
      course_name: courseName,
      subject_name: courseName,
      description,
      submission_url: submissionUrl,
      submission_link: submissionUrl,
      deadline: deadlineDate.toISOString(),
      status: "belum_dimulai",
      priority: "sedang",
      pic_id: adminUser.id,
      coordinator_id: adminUser.id,
      created_by: adminUser.id,
      created_via: "voice_note",
      voice_audio_url: audioUrl,
      reminders_sent: [],
      notification_tracker: {
        instant_broadcast_sent: false,
        edit_count: 0,
      },
      is_archived: false,
      created_at: FieldValue.serverTimestamp(),
      updated_at: FieldValue.serverTimestamp(),
    };

    await newTaskRef.set(taskData);
    console.log(`[VoiceTaskProcessor] Successfully created task ${newTaskRef.id} from voice note!`);

    // 6. Broadcast Instan jika tenggat mepet (<= 3 hari) ke Grup Pengumuman
    let broadcastResult = null;
    try {
      broadcastResult = await handleAcademicTaskCreated(newTaskRef.id, adminUser.id, db);
      console.log("[VoiceTaskProcessor] Broadcast trigger result:", broadcastResult);
    } catch (bcErr) {
      console.error("[VoiceTaskProcessor] Error triggering instant broadcast:", bcErr);
    }

    // 7. Kirim Pesan Konfirmasi ke Pengirim (Japri / Grup Diskusi)
    const formattedDeadline = formatVoiceDeadlineWita(deadlineDate);
    const confirmationMsg = [
      "🎤 *Tugas dari Voice Note Berhasil Dicatat!*",
      "",
      `📚 *Mata Kuliah:* ${courseName}`,
      `📝 *Tugas:* ${taskTitle}`,
      `⏰ *Tenggat:* ${formattedDeadline} WITA`,
      `📌 *Ketentuan:* ${description}`,
      `🔗 *Pengumpulan:* ${submissionUrl}`,
      "",
      "Tugas sudah masuk ke jadwal kelas.",
    ].join("\n");

    await sendWhatsAppMessage({
      target: replyTarget,
      message: confirmationMsg,
      type: isGroupTarget ? "group" : "phone",
      org_id: workspaceId,
    });

    return NextResponse.json({
      ok: true,
      taskId: newTaskRef.id,
      courseName,
      taskTitle,
      deadline: deadlineDate.toISOString(),
      broadcastResult,
    });
  } catch (err) {
    console.error("[VoiceTaskProcessor] Error processing voice task:", err);

    await sendWhatsAppMessage({
      target: replyTarget,
      message: fallbackErrorMsg,
      type: isGroupTarget ? "group" : "phone",
      org_id: workspaceId,
    });

    return NextResponse.json({
      ok: false,
      error: err instanceof Error ? err.message : "voice_processing_failed",
    });
  }
}
