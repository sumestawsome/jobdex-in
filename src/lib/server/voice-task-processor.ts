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
  status?: "ready" | "needs_clarification";
  course_name?: string | null;
  name?: string | null;
  title?: string | null;
  description?: string | null;
  deadline?: string | null;
  submission_url?: string | null;
  missing_fields?: string[];
  clarification_question?: string | null;
  error?: string;
}

export interface TaskDraft {
  sender: string;
  status?: "awaiting_approval" | "needs_clarification";
  course_name?: string | null;
  name?: string | null;
  title?: string | null;
  description?: string | null;
  deadline?: string | null;
  submission_url?: string | null;
  missing_fields?: string[];
  clarification_question?: string | null;
  audio_url?: string | null;
  group_id?: string | null;
  reply_target?: string;
  is_group_target?: boolean;
  provider?: string;
  created_at_ms: number;
  expires_at_ms: number;
}

const AUDIO_EXT_REGEX = /\.(ogg|opus|oga|mp3|m4a|wav|aac|wma|webm|flac)(\?.*)?$/i;
const AUDIO_FORMAT_REGEX = /^(ogg|opus|oga|mp3|m4a|wav|aac|wma|webm|flac)$/i;

/**
 * Checks if incoming WhatsApp message is an audio file or voice note.
 * Inspects url, mediaUrl, attachment, filename, messageType/filetype, extension, and raw payload.
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

  const messageData =
    root.messageData && typeof root.messageData === "object"
      ? (root.messageData as Record<string, unknown>)
      : {};
  const fileMessageData =
    messageData.fileMessageData && typeof messageData.fileMessageData === "object"
      ? (messageData.fileMessageData as Record<string, unknown>)
      : {};

  const pickCandidate = (...vals: unknown[]): string => {
    for (const v of vals) {
      if (typeof v === "string" && v.trim()) return v.trim();
      if (typeof v === "number") return String(v).trim();
    }
    return "";
  };

  const candidateUrl = pickCandidate(
    incoming.url,
    incoming.mediaUrl,
    incoming.attachment,
    fileMessageData.downloadUrl,
    fileMessageData.urlFile,
    messageData.downloadUrl,
    messageData.urlFile,
    firstChoice.url,
    firstChoice.file,
    firstChoice.attachment,
    firstChoice.media,
    firstChoice.audio,
    firstChoice.voice,
    firstChoice.link,
    root.url,
    root.file,
    root.attachment,
    root.media,
    root.audio,
    root.voice,
    root.link
  );

  const candidateFilename = pickCandidate(
    incoming.filename,
    fileMessageData.fileName,
    messageData.fileName,
    firstChoice.filename,
    firstChoice.name_file,
    firstChoice.fileName,
    root.filename,
    root.name_file,
    root.fileName
  );

  const candidateType = pickCandidate(
    incoming.filetype,
    incoming.messageType,
    fileMessageData.mimeType,
    messageData.typeMessage,
    messageData.mimeType,
    firstChoice.filetype,
    firstChoice.type,
    firstChoice.fileType,
    firstChoice.mime,
    firstChoice.mimetype,
    root.filetype,
    root.type,
    root.fileType,
    root.mime,
    root.mimetype
  );

  const candidateExt = pickCandidate(
    incoming.extension,
    firstChoice.extension,
    firstChoice.ext,
    root.extension,
    root.ext
  );

  const messageText = (incoming.message || pickCandidate(firstChoice.message, root.message) || "").trim();
  const isNonTextMessage =
    messageText.toLowerCase() === "non-text message" ||
    messageText.toLowerCase().includes("non-text message");

  // 1. Check direct URL extension (.ogg, .opus, .mp3, .m4a, .wav, etc.)
  if (candidateUrl && AUDIO_EXT_REGEX.test(candidateUrl)) {
    return { isAudio: true, audioUrl: candidateUrl };
  }

  // 2. Check filename extension
  if (candidateFilename && AUDIO_EXT_REGEX.test(candidateFilename) && candidateUrl) {
    return { isAudio: true, audioUrl: candidateUrl };
  }

  // 3. Check extension field
  if (candidateExt && (AUDIO_FORMAT_REGEX.test(candidateExt) || AUDIO_EXT_REGEX.test(candidateExt)) && candidateUrl) {
    return { isAudio: true, audioUrl: candidateUrl };
  }

  // 4. Check MIME type or messageType (audio / voice / ptt)
  const isAudioType = /(audio|voice|ptt)/i.test(candidateType);
  if (isAudioType && candidateUrl) {
    return { isAudio: true, audioUrl: candidateUrl };
  }

  // 5. Check if message itself is 'non-text message' and has a media URL payload
  if (isNonTextMessage && candidateUrl) {
    return { isAudio: true, audioUrl: candidateUrl };
  }

  // 6. Check if message itself is an audio URL
  if (/^https?:\/\/[^\s]+$/i.test(messageText) && AUDIO_EXT_REGEX.test(messageText)) {
    return { isAudio: true, audioUrl: messageText };
  }

  return { isAudio: false, audioUrl: candidateUrl || null };
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
 * Accepts either an audio download URL (string) or raw audio Buffer directly.
 */
export async function extractTaskFromVoiceNote(
  audioSource: string | Buffer,
  mimeTypeOverride?: string
): Promise<ExtractedVoiceTask> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured in environment variables.");
  }

  let base64Audio = "";
  let mimeType = mimeTypeOverride || "audio/ogg";

  if (Buffer.isBuffer(audioSource)) {
    console.log(`[VoiceTaskProcessor] Processing raw audio buffer directly (${audioSource.byteLength} bytes)`);
    base64Audio = audioSource.toString("base64");
  } else {
    // 1. Fetch audio buffer from URL
    console.log(`[VoiceTaskProcessor] Fetching audio from URL: ${audioSource.slice(0, 60)}...`);
    const audioRes = await fetch(audioSource, {
      headers: {
        "User-Agent": "JobDex-In-VoiceProcessor/1.0",
      },
    });

    if (!audioRes.ok) {
      throw new Error(`Failed to download audio file: HTTP status ${audioRes.status}`);
    }

    const contentTypeHeader = audioRes.headers.get("content-type");
    mimeType = mimeTypeOverride || resolveAudioMimeType(audioSource, contentTypeHeader);
    const arrayBuffer = await audioRes.arrayBuffer();
    base64Audio = Buffer.from(arrayBuffer).toString("base64");
    console.log(`[VoiceTaskProcessor] Audio downloaded successfully (${arrayBuffer.byteLength} bytes, MIME: ${mimeType})`);
  }

  // 2. Call Gemini 2.5 Flash API with Flexible Extraction Schema
  const systemPrompt = `Kamu adalah asisten pencatat tugas akademik Ilkom B Undiksha. Tugasmu adalah mendengarkan pesan suara berikut dan mengekstrak informasi tugas kuliah ke dalam format JSON murni.
Tahun dasar saat ini adalah 2026. Tanggal hari ini adalah 25 Oktober 2026.

Entitas Inti yang Diperlukan:
1. course_name: Nama mata kuliah
2. name: Judul spesifik tugas kuliah
3. deadline: Format YYYY-MM-DD HH:mm (WITA)

Aturan Status & Kelengkapan:
- Jika ketiga entitas inti (course_name, name/title, dan deadline) terdeteksi lengkap, set "status": "ready" dan "missing_fields": [].
- Jika ada satu atau lebih entitas inti yang belum lengkap, set "status": "needs_clarification", isi field yang belum ada dengan null, sebutkan di "missing_fields" (misal: ["deadline"]), dan buatkan "clarification_question" yang ramah dan spesifik menanyakan informasi yang kurang (misal: 'Tugas RPL sudah dicatat, tapi kapan tenggat waktunya ya?').

Format JSON WAJIB valid:
{
  "status": "ready" | "needs_clarification",
  "course_name": "Nama mata kuliah atau null jika tidak disebutkan",
  "name": "Judul tugas atau null jika tidak disebutkan",
  "title": "Sama dengan name (alias)",
  "description": "Ketentuan pengerjaan atau detail yang disebutkan (default: '')",
  "deadline": "Format YYYY-MM-DD HH:mm (WITA) atau null jika tidak disebutkan",
  "submission_url": "Tempat pengumpulan (default: 'E-Learning Undiksha')",
  "missing_fields": ["deadline"],
  "clarification_question": "Pertanyaan ramah dan spesifik menanyakan bagian yang kurang atau null jika status ready"
}`;

  const userInstruction = `Dengarkan rekaman suara ini dan ekstrak informasi tugas kuliah sesuai format JSON yang ditentukan.
Jika rekaman suara tidak jelas, terlalu bising, atau bukan berisi tentang tugas kuliah, kembalikan objek JSON dengan field "error": "not_a_task".`;

  const modelsToTry = [
    process.env.GEMINI_MODEL,
    "gemini-2.5-flash",
    "gemini-flash-latest",
    "gemini-2.5-flash-lite",
    "gemini-2.5-pro",
    "gemini-pro-latest",
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
  const parsed = JSON.parse(cleaned) as Record<string, unknown>;

  const courseName = parsed.course_name ? String(parsed.course_name).trim() : null;
  const name = parsed.name ? String(parsed.name).trim() : (parsed.title ? String(parsed.title).trim() : null);
  const deadline = parsed.deadline ? String(parsed.deadline).trim() : null;
  const description = parsed.description ? String(parsed.description).trim() : "";
  const submissionUrl = parsed.submission_url ? String(parsed.submission_url).trim() : "E-Learning Undiksha";

  const missing: string[] = [];
  if (!courseName) missing.push("course_name");
  if (!name) missing.push("name");
  if (!deadline) missing.push("deadline");

  const status: "ready" | "needs_clarification" =
    missing.length === 0 && parsed.status !== "needs_clarification"
      ? "ready"
      : "needs_clarification";

  return {
    status,
    course_name: courseName,
    name,
    title: name,
    description,
    deadline,
    submission_url: submissionUrl,
    missing_fields: missing.length > 0 ? missing : (Array.isArray(parsed.missing_fields) ? (parsed.missing_fields as string[]) : []),
    clarification_question: parsed.clarification_question
      ? String(parsed.clarification_question).trim()
      : null,
    error: parsed.error ? String(parsed.error).trim() : undefined,
  };
}

/**
 * Helper to extract task from raw audio Buffer directly.
 */
export async function extractTaskFromAudioBuffer(
  audioBuffer: Buffer,
  mimeType: string = "audio/ogg"
): Promise<ExtractedVoiceTask> {
  return extractTaskFromVoiceNote(audioBuffer, mimeType);
}

// ============================================================================
// DRAFT SESSION STORAGE (10-Minute TTL + Firestore + In-Memory Map)
// ============================================================================
const DRAFT_TTL_MS = 10 * 60 * 1000; // 10 menit
const inMemoryDraftMap = new Map<string, TaskDraft>();

export function normalizeDraftSenderKey(sender: string): string {
  return sender.replace(/\D/g, "");
}

export async function getWhatsAppTaskDraft(sender: string): Promise<TaskDraft | null> {
  const cleanSender = normalizeDraftSenderKey(sender);
  if (!cleanSender) return null;

  const now = Date.now();

  // 1. Check in-memory map
  const memDraft = inMemoryDraftMap.get(cleanSender);
  if (memDraft) {
    if (memDraft.expires_at_ms && now > memDraft.expires_at_ms) {
      inMemoryDraftMap.delete(cleanSender);
    } else {
      return memDraft;
    }
  }

  // 2. Check Firestore collection "whatsapp_drafts"
  try {
    const db = getAdminDb();
    const docRef = db.collection("whatsapp_drafts").doc(cleanSender);
    const snap = await docRef.get();
    if (!snap.exists) return null;

    const data = snap.data() as TaskDraft;
    if (data.expires_at_ms && now > data.expires_at_ms) {
      await docRef.delete().catch(() => {});
      return null;
    }

    inMemoryDraftMap.set(cleanSender, data);
    return data;
  } catch (err) {
    console.error("[VoiceTaskProcessor] Error fetching draft from Firestore:", err);
    return null;
  }
}

export async function saveWhatsAppTaskDraft(draft: TaskDraft): Promise<void> {
  const cleanSender = normalizeDraftSenderKey(draft.sender);
  if (!cleanSender) return;

  draft.expires_at_ms = Date.now() + DRAFT_TTL_MS;
  inMemoryDraftMap.set(cleanSender, draft);

  try {
    const db = getAdminDb();
    await db.collection("whatsapp_drafts").doc(cleanSender).set({
      ...draft,
      updated_at: FieldValue.serverTimestamp(),
    });
    console.log(`[VoiceTaskProcessor] Draft saved for ${cleanSender}:`, {
      course: draft.course_name,
      name: draft.name,
      deadline: draft.deadline,
      missing: draft.missing_fields,
    });
  } catch (err) {
    console.error("[VoiceTaskProcessor] Error saving draft to Firestore:", err);
  }
}

export async function deleteWhatsAppTaskDraft(sender: string): Promise<void> {
  const cleanSender = normalizeDraftSenderKey(sender);
  if (!cleanSender) return;

  inMemoryDraftMap.delete(cleanSender);

  try {
    const db = getAdminDb();
    await db.collection("whatsapp_drafts").doc(cleanSender).delete().catch(() => {});
    console.log(`[VoiceTaskProcessor] Draft deleted for ${cleanSender}`);
  } catch (err) {
    console.error("[VoiceTaskProcessor] Error deleting draft from Firestore:", err);
  }
}

/**
 * Merges an existing active draft with a new voice note revision.
 * Transcribes and analyzes the audio directly with Gemini Flash while providing full context of the existing draft.
 * Preserves all already valid fields (course_name, deadline, name, submission_url, description)
 * unless the voice note explicitly changes them.
 * Never resets deadline or triggers deadline clarification questions if the previous draft deadline was valid.
 */
export async function mergeVoiceNoteCorrectionWithDraft(
  existingDraft: TaskDraft,
  audioSource: string | Buffer,
  mimeTypeOverride?: string
): Promise<ExtractedVoiceTask> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY belum dikonfigurasi.");
  }

  let base64Audio = "";
  let mimeType = mimeTypeOverride || "audio/ogg";

  if (Buffer.isBuffer(audioSource)) {
    console.log(`[VoiceTaskProcessor] Processing raw revision audio buffer (${audioSource.byteLength} bytes)`);
    base64Audio = audioSource.toString("base64");
  } else {
    console.log(`[VoiceTaskProcessor] Fetching revision audio from URL: ${audioSource.slice(0, 60)}...`);
    const audioRes = await fetch(audioSource, {
      headers: { "User-Agent": "JobDex-In-VoiceProcessor/1.0" },
    });
    if (!audioRes.ok) {
      throw new Error(`Failed to download audio file: HTTP status ${audioRes.status}`);
    }
    const contentTypeHeader = audioRes.headers.get("content-type");
    mimeType = mimeTypeOverride || resolveAudioMimeType(audioSource, contentTypeHeader);
    const arrayBuffer = await audioRes.arrayBuffer();
    base64Audio = Buffer.from(arrayBuffer).toString("base64");
  }

  const systemPrompt = `Kamu adalah asisten pengelola tugas akademik Ilkom B Undiksha yang sangat teliti.
Pengguna saat ini SUDAH memiliki draf tugas aktif yang tersimpan di sistem:
- Mata Kuliah: ${existingDraft.course_name || "Belum disebutkan (null)"}
- Nama/Judul Tugas: ${existingDraft.name || existingDraft.title || "Belum disebutkan (null)"}
- Tenggat Waktu (Deadline): ${existingDraft.deadline || "Belum disebutkan (null)"}
- Tempat Pengumpulan: ${existingDraft.submission_url || "E-Learning Undiksha"}
- Deskripsi/Ketentuan: ${existingDraft.description || "Belum ada (null)"}

Basis Waktu: Hari ini adalah Minggu, 25 Oktober 2026.

Pesan suara berikut adalah KOREKSI / TAMBAHAN / REVISI PARSIAL untuk draf tugas di atas.
Tugasmu:
1. Dengarkan rekaman suara koreksi ini dengan saksama.
2. Perbarui HANYA informasi yang secara eksplisit dikoreksi, diubah, atau ditambahkan oleh pengguna (misal link baru, judul baru, ketentuan baru, atau deadline baru jika disebutkan).
3. WAJIB PERTAHANKAN seluruh informasi lama yang sudah valid di atas (${existingDraft.course_name ? "course_name: '" + existingDraft.course_name + "', " : ""}${existingDraft.name ? "name: '" + existingDraft.name + "', " : ""}${existingDraft.deadline ? "deadline: '" + existingDraft.deadline + "'" : ""}).
4. JANGAN PERNAH mereset deadline menjadi null atau memicu pertanyaan tenggat jika deadline di draf lama (${existingDraft.deadline || "tidak ada"}) sudah valid dan pengguna tidak mengoreksinya!
5. Jika draf lama sudah memiliki course_name, name, dan deadline yang valid, maka status AKHIR WAJIB "ready", missing_fields WAJIB [], dan clarification_question WAJIB null.

Format JSON WAJIB valid tanpa markdown:
{
  "status": "ready" | "needs_clarification",
  "course_name": "Nama mata kuliah yang dipertahankan atau diperbarui",
  "name": "Judul tugas yang dipertahankan atau diperbarui",
  "title": "Sama dengan name (alias)",
  "description": "Deskripsi atau ketentuan pengerjaan",
  "deadline": "Format YYYY-MM-DD HH:mm (WITA) yang dipertahankan atau diperbarui",
  "submission_url": "Tempat pengumpulan (default: 'E-Learning Undiksha' atau dipertahankan dari draf)",
  "missing_fields": [],
  "clarification_question": null
}`;

  const userInstruction = `Dengarkan rekaman suara koreksi ini dan gabungkan dengan draf yang sudah ada sesuai format JSON yang ditentukan.`;

  const modelsToTry = [
    process.env.GEMINI_MODEL,
    "gemini-2.5-flash",
    "gemini-flash-latest",
    "gemini-2.5-flash-lite",
    "gemini-2.5-pro",
    "gemini-pro-latest",
  ].filter(Boolean) as string[];
  const uniqueModels = [...new Set(modelsToTry)];

  let rawJsonText = "";
  let lastError: Error | null = null;

  for (const model of uniqueModels) {
    try {
      console.log(`[VoiceTaskProcessor] Sending multimodal revision audio request to Gemini model: ${model}`);
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

      const geminiRes = await fetch(geminiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
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
                { text: userInstruction },
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
      console.warn(`[VoiceTaskProcessor] Model ${model} failed revision:`, lastError.message);
    }
  }

  if (!rawJsonText) {
    throw lastError || new Error("Gemini API failed to return text candidate during revision merge.");
  }

  const cleaned = cleanJsonMarkdown(rawJsonText);
  const parsed = JSON.parse(cleaned) as Record<string, unknown>;

  // Programmatic preservation of existing draft fields
  const courseName: string | null = parsed.course_name ? String(parsed.course_name).trim() : (existingDraft.course_name || null);
  const name: string | null = parsed.name
    ? String(parsed.name).trim()
    : parsed.title
    ? String(parsed.title).trim()
    : (existingDraft.name || existingDraft.title || null);
  const deadline: string | null = parsed.deadline ? String(parsed.deadline).trim() : (existingDraft.deadline || null);
  const description: string = parsed.description ? String(parsed.description).trim() : (existingDraft.description || "");
  const submissionUrl: string = parsed.submission_url ? String(parsed.submission_url).trim() : (existingDraft.submission_url || "E-Learning Undiksha");

  const missing: string[] = [];
  if (!courseName) missing.push("course_name");
  if (!name) missing.push("name");
  if (!deadline) missing.push("deadline");

  const status: "ready" | "needs_clarification" = missing.length === 0 ? "ready" : "needs_clarification";

  return {
    status,
    course_name: courseName,
    name,
    title: name,
    description,
    deadline,
    submission_url: submissionUrl,
    missing_fields: missing,
    clarification_question: status === "ready" ? null : (parsed.clarification_question ? String(parsed.clarification_question).trim() : null),
  };
}

/**
 * Merges an existing draft with a follow-up user clarification text via Gemini.
 */
export async function mergeTaskDraftWithFollowUp(
  existingDraft: TaskDraft,
  followUpText: string
): Promise<ExtractedVoiceTask> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY belum dikonfigurasi.");
  }

  const systemPrompt = `Kamu adalah asisten pengelola tugas kuliah mahasiswa Ilkom Undiksha yang sangat teliti.
Pengguna sebelumnya telah memulai pencatatan tugas kuliah, dan tersimpan sebagai draf:
- Mata Kuliah: ${existingDraft.course_name || "Belum disebutkan (null)"}
- Nama/Judul Tugas: ${existingDraft.name || existingDraft.title || "Belum disebutkan (null)"}
- Deskripsi: ${existingDraft.description || "Belum ada (null)"}
- Tenggat Waktu (Deadline): ${existingDraft.deadline || "Belum disebutkan (null)"}
- Tempat Pengumpulan: ${existingDraft.submission_url || "E-Learning Undiksha"}
- Field yang masih kurang: ${JSON.stringify(existingDraft.missing_fields || [])}

Basis Waktu: Hari ini adalah Minggu, 25 Oktober 2026.

Sekarang pengguna mengirim pesan susulan untuk melengkapi atau mengoreksi draf ini:
"${followUpText}"

Tugasmu:
1. Gabungkan informasi pada draf lama dengan informasi baru yang diberikan oleh pengguna.
2. Pertahankan informasi lama yang sudah ada dan valid (${existingDraft.course_name ? "course_name: '" + existingDraft.course_name + "', " : ""}${existingDraft.name ? "name: '" + existingDraft.name + "', " : ""}${existingDraft.deadline ? "deadline: '" + existingDraft.deadline + "'" : ""}), kecuali jika pesan baru pengguna secara jelas mengoreksi atau mengubahnya.
3. JANGAN PERNAH mereset deadline menjadi null jika deadline di draf lama (${existingDraft.deadline || "tidak ada"}) sudah valid dan pengguna tidak mengubahnya!
4. Buang kata filler/basa-basi santai.

Aturan Status & Kelengkapan:
- Jika ketiga entitas inti (course_name, name, dan deadline) sekarang lengkap (baik dari pesan baru maupun dipertahankan dari draf lama), set "status": "ready", "missing_fields": [], dan "clarification_question": null.
- Jika masih ada entitas inti yang belum lengkap, set "status": "needs_clarification", isi field yang belum ada dengan null, sebutkan di "missing_fields" (misal: ["deadline"]), dan buatkan "clarification_question" yang ramah dan spesifik menanyakan informasi yang masih kurang.

Format JSON WAJIB murni tanpa markdown:
{
  "status": "ready" | "needs_clarification",
  "course_name": "Nama mata kuliah atau null jika belum ada",
  "name": "Judul tugas atau null jika belum ada",
  "title": "Sama dengan name (alias)",
  "description": "Deskripsi atau ketentuan pengerjaan",
  "deadline": "Format YYYY-MM-DD HH:mm (WITA) atau null jika belum ada",
  "submission_url": "Tempat pengumpulan (default: 'E-Learning Undiksha')",
  "missing_fields": [],
  "clarification_question": null
}`;

  const modelsToTry = [
    process.env.GEMINI_MODEL,
    "gemini-2.5-flash",
    "gemini-flash-latest",
    "gemini-2.5-flash-lite",
    "gemini-2.5-pro",
    "gemini-pro-latest",
  ].filter(Boolean) as string[];
  const uniqueModels = [...new Set(modelsToTry)];

  let rawJsonText = "";
  let lastError: Error | null = null;

  for (const model of uniqueModels) {
    try {
      console.log(`[VoiceTaskProcessor] Merging draft using Gemini model: ${model}`);
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
              parts: [{ text: `Lengkapi draf tugas dengan pesan ini: "${followUpText}"` }],
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
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.warn(`[VoiceTaskProcessor] Model ${model} failed to merge draft:`, lastError.message);
    }
  }

  if (!rawJsonText) {
    throw lastError || new Error("Gemini API failed to return text candidate during draft merge.");
  }

  const cleaned = cleanJsonMarkdown(rawJsonText);
  const parsed = JSON.parse(cleaned) as Record<string, unknown>;

  const courseName: string | null = parsed.course_name ? String(parsed.course_name).trim() : (existingDraft.course_name || null);
  const name: string | null = parsed.name
    ? String(parsed.name).trim()
    : parsed.title
    ? String(parsed.title).trim()
    : (existingDraft.name || existingDraft.title || null);
  const deadline: string | null = parsed.deadline ? String(parsed.deadline).trim() : (existingDraft.deadline || null);
  const description: string = parsed.description ? String(parsed.description).trim() : (existingDraft.description || "");
  const submissionUrl: string = parsed.submission_url ? String(parsed.submission_url).trim() : (existingDraft.submission_url || "E-Learning Undiksha");

  const missing: string[] = [];
  if (!courseName) missing.push("course_name");
  if (!name) missing.push("name");
  if (!deadline) missing.push("deadline");

  const status: "ready" | "needs_clarification" = missing.length === 0 ? "ready" : "needs_clarification";

  return {
    status,
    course_name: courseName,
    name,
    title: name,
    description,
    deadline,
    submission_url: submissionUrl,
    missing_fields: missing,
    clarification_question: status === "ready" ? null : (parsed.clarification_question ? String(parsed.clarification_question).trim() : null),
  };
}

/**
 * Builds the standard WhatsApp preview card for a task draft awaiting approval.
 */
export function buildDraftPreviewCard(
  courseName: string,
  name: string,
  formattedDeadline: string,
  description: string,
  submissionUrl: string
): string {
  return [
    "📋 *Draf Tugas Kuliah (Menunggu Persetujuan)*",
    "",
    `📚 *Mata Kuliah:* ${courseName}`,
    `📝 *Judul Tugas:* ${name}`,
    `⏰ *Tenggat:* ${formattedDeadline} WITA`,
    `📌 *Ketentuan:* ${description}`,
    `🔗 *Pengumpulan:* ${submissionUrl}`,
    "",
    "--------------------------------------",
    "Periksa draf di atas. Jika data sudah benar:",
    "👉 Ketik *!tugas acc* (atau *acc*) untuk mempublikasikan.",
    "👉 Ketik *!tugas batal* (atau *batal*) untuk membuang draf.",
    '👉 Atau kirim pesan/VN perbaikan jika ada kata yang salah (contoh: "ganti judulnya jadi Latihan 9").',
    "👉 Cek dashboard: https://jobdexin.sumestawsome.xyz/dashboard/tasks",
  ].join("\n");
}

/**
 * Approves and officially publishes an active task draft to Firestore `tasks`,
 * triggers instant broadcast if deadline <= 3 days, and cleans up the draft session.
 */
export async function approveAndPublishTaskDraft(
  incoming: NormalizedIncomingWhatsAppMessage,
  activeDraft: TaskDraft
): Promise<NextResponse> {
  const db = getAdminDb();
  const workspaceId = DEFAULT_CLASS_WORKSPACE_ID;
  const { adminUser, replyTarget, isGroupTarget } = await verifyAdminKomunitas(incoming, db);

  const effectiveReplyTarget = replyTarget || activeDraft.reply_target || incoming.sender;
  const effectiveIsGroup = isGroupTarget ?? activeDraft.is_group_target ?? false;

  // 1. Periksa kelengkapan entitas utama (course_name, name, deadline)
  const isMissingCore =
    !activeDraft.course_name?.trim() ||
    !(activeDraft.name || activeDraft.title)?.trim() ||
    !activeDraft.deadline?.trim();

  if (isMissingCore) {
    const missingMsg = [
      "⚠️ *Draf Tugas Belum Lengkap*",
      "",
      "Data tugas belum lengkap untuk dipublikasikan:",
      `📚 *Mata Kuliah:* ${activeDraft.course_name || "Belum ada"}`,
      `📝 *Judul Tugas:* ${activeDraft.name || activeDraft.title || "Belum ada"}`,
      `⏰ *Tenggat:* ${activeDraft.deadline || "Belum ada"}`,
      "",
      "Silakan lengkapi bagian yang kurang terlebih dahulu (contoh balas: 'Besok jam 23:59').",
    ].join("\n");

    await sendWhatsAppMessage({
      target: effectiveReplyTarget,
      message: missingMsg,
      type: effectiveIsGroup ? "group" : "phone",
      org_id: workspaceId,
      provider: incoming.provider,
    });

    return NextResponse.json({
      ok: true,
      status: "needs_clarification",
      stopFurtherProcessing: true,
    });
  }

  // 2. Parse deadline
  const cleanDeadlineStr = activeDraft.deadline!.replace(/\(wita\)/i, "").trim();
  const deadlineDate = parseAcademicDeadline(cleanDeadlineStr);

  if (!deadlineDate || isNaN(deadlineDate.getTime())) {
    console.warn(`[VoiceTaskProcessor] Failed to parse deadline from draft: "${activeDraft.deadline}"`);
    const invalidDeadlineMsg = [
      "⚠️ *Format Tenggat Belum Valid*",
      `📚 *Mata Kuliah:* ${activeDraft.course_name}`,
      `📌 *Judul Tugas:* ${activeDraft.name || activeDraft.title}`,
      "",
      "❓ Kapan tenggat waktu pengumpulan tugas ini?",
      "*(Contoh: 'Besok jam 23:59' atau '28 Oktober 2026 jam 18:00')*",
    ].join("\n");

    await sendWhatsAppMessage({
      target: effectiveReplyTarget,
      message: invalidDeadlineMsg,
      type: effectiveIsGroup ? "group" : "phone",
      org_id: workspaceId,
      provider: incoming.provider,
    });

    return NextResponse.json({
      ok: true,
      status: "needs_clarification",
      stopFurtherProcessing: true,
    });
  }

  const courseName = activeDraft.course_name!.trim();
  const taskTitle = (activeDraft.name || activeDraft.title)!.trim();
  const description =
    activeDraft.description?.trim() ||
    `Tugas mata kuliah ${courseName}. Selesaikan dan kumpulkan sesuai instruksi dosen pengampu.`;
  const submissionUrl = activeDraft.submission_url?.trim() || "E-Learning Undiksha";

  // 3. Simpan tugas secara resmi ke koleksi Firestore tasks pada workspace ws_ilkom_2024
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
    pic_id: adminUser?.id || "system",
    coordinator_id: adminUser?.id || "system",
    created_by: adminUser?.id || "system",
    created_via: "voice_note_approved",
    voice_audio_url: activeDraft.audio_url || incoming.url || incoming.mediaUrl || "",
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
  console.log(`[VoiceTaskProcessor] Draft approved & published! Created task ${newTaskRef.id}: "${taskTitle}" (${courseName})`);

  // 4. Jika sisa tenggat <= 3 hari, picu siaran pengumuman ke grup komunitas (120363411033795051@g.us)
  let broadcastResult = null;
  try {
    broadcastResult = await handleAcademicTaskCreated(newTaskRef.id, adminUser?.id || "system", db);
    console.log("[VoiceTaskProcessor] Broadcast trigger result for approved draft:", broadcastResult);
  } catch (bcErr) {
    console.error("[VoiceTaskProcessor] Error triggering broadcast for draft:", bcErr);
  }

  // 5. Hapus draf sesi
  await deleteWhatsAppTaskDraft(incoming.sender);

  // 6. Kirim pesan konfirmasi sukses
  const formattedDeadline = formatVoiceDeadlineWita(deadlineDate);
  const confirmationMsg = [
    "✅ *Tugas Berhasil Disetujui & Diterbitkan!*",
    "",
    `📚 *Mata Kuliah:* ${courseName}`,
    `📝 *Tugas:* ${taskTitle}`,
    `⏰ *Tenggat:* ${formattedDeadline} WITA`,
    "",
    "Tugas telah tersimpan di JobDex dan disiarkan ke kelas.",
    "👉 Cek dashboard: https://jobdexin.sumestawsome.xyz/dashboard/tasks",
  ].join("\n");

  await sendWhatsAppMessage({
    target: effectiveReplyTarget,
    message: confirmationMsg,
    type: effectiveIsGroup ? "group" : "phone",
    org_id: workspaceId,
    provider: incoming.provider,
  });

  return NextResponse.json({
    ok: true,
    stopFurtherProcessing: true,
    taskId: newTaskRef.id,
    courseName,
    taskTitle,
    deadline: deadlineDate.toISOString(),
    broadcastResult,
  });
}

/**
 * Handles incoming follow-up message when sender has an active task draft.
 * Supports ACC approval, cancellation, and fast natural revision via Gemini.
 */
export async function handleDraftFollowUpMessage(
  incoming: NormalizedIncomingWhatsAppMessage,
  activeDraft: TaskDraft,
  followUpText: string
): Promise<NextResponse> {
  const db = getAdminDb();
  const workspaceId = DEFAULT_CLASS_WORKSPACE_ID;
  const { replyTarget, isGroupTarget } = await verifyAdminKomunitas(incoming, db);

  const effectiveReplyTarget = replyTarget || activeDraft.reply_target || incoming.sender;
  const effectiveIsGroup = isGroupTarget ?? activeDraft.is_group_target ?? false;

  const cleanText = followUpText.trim().toLowerCase();

  // 1. Cek perintah ACC (!tugas acc / !acc / acc)
  if (/^(?:[!/]tugas\s+acc|[!/]acc|acc)$/i.test(cleanText)) {
    return await approveAndPublishTaskDraft(incoming, activeDraft);
  }

  // 2. Cek perintah pembatalan (!tugas batal / !batal / batal)
  const isCancel =
    /^(?:[!/]tugas\s+batal|[!/]batal|batal|cancel|hapus draf|tidak jadi|reset draf)$/i.test(cleanText);

  if (isCancel) {
    await deleteWhatsAppTaskDraft(incoming.sender);
    const cancelMsg = "🗑️ Draf tugas berhasil dibatalkan dan dihapus.";
    await sendWhatsAppMessage({
      target: effectiveReplyTarget,
      message: cancelMsg,
      type: effectiveIsGroup ? "group" : "phone",
      org_id: workspaceId,
      provider: incoming.provider,
    });
    return NextResponse.json({
      ok: true,
      stopFurtherProcessing: true,
      reason: "draft_cancelled",
    });
  }

  // 3. Revisi Cepat menggunakan Gemini
  try {
    const merged = await mergeTaskDraftWithFollowUp(activeDraft, followUpText);
    console.log("[VoiceTaskProcessor] Merged draft result:", merged);

    const isMissingCore =
      !merged.course_name?.trim() ||
      !(merged.name || merged.title)?.trim() ||
      !merged.deadline?.trim();

    if (merged.status === "needs_clarification" || isMissingCore) {
      activeDraft.course_name = merged.course_name || activeDraft.course_name;
      activeDraft.name = merged.name || merged.title || activeDraft.name;
      activeDraft.title = activeDraft.name;
      activeDraft.description = merged.description || activeDraft.description;
      activeDraft.deadline = merged.deadline || activeDraft.deadline;
      activeDraft.submission_url = merged.submission_url || activeDraft.submission_url;
      activeDraft.missing_fields = merged.missing_fields;
      activeDraft.clarification_question = merged.clarification_question;
      activeDraft.status = "needs_clarification";
      activeDraft.reply_target = effectiveReplyTarget;
      activeDraft.is_group_target = effectiveIsGroup;

      await saveWhatsAppTaskDraft(activeDraft);

      const clarifMsg = [
        "📝 *Draf Tugas Diperbarui!*",
        "",
        `📚 *Mata Kuliah:* ${activeDraft.course_name || "Belum disebutkan"}`,
        `📌 *Tugas:* ${activeDraft.name || "Belum disebutkan"}`,
        ...(activeDraft.deadline ? [`⏰ *Tenggat:* ${activeDraft.deadline}`] : []),
        "",
        `❓ ${merged.clarification_question || "Mohon lengkapi bagian yang masih kurang."}`,
        "*(Balas chat ini langsung dengan detailnya, atau ketik 'batal' untuk membatalkan)*",
      ].join("\n");

      await sendWhatsAppMessage({
        target: effectiveReplyTarget,
        message: clarifMsg,
        type: effectiveIsGroup ? "group" : "phone",
        org_id: workspaceId,
        provider: incoming.provider,
      });

      return NextResponse.json({
        ok: true,
        status: "needs_clarification",
        stopFurtherProcessing: true,
      });
    }

    // Jika entitas inti sudah lengkap:
    // Parse tanggal tenggat dan perbarui draf dengan status "awaiting_approval"
    const cleanDeadlineStr = merged.deadline!.replace(/\(wita\)/i, "").trim();
    const deadlineDate = parseAcademicDeadline(cleanDeadlineStr);

    if (!deadlineDate || isNaN(deadlineDate.getTime())) {
      console.warn(`[VoiceTaskProcessor] Failed to parse deadline from merged draft: "${merged.deadline}"`);
      activeDraft.course_name = merged.course_name;
      activeDraft.name = merged.name;
      activeDraft.title = merged.name;
      activeDraft.description = merged.description;
      activeDraft.missing_fields = ["deadline"];
      activeDraft.status = "needs_clarification";
      await saveWhatsAppTaskDraft(activeDraft);

      const invalidDeadlineMsg = [
        "⚠️ Format tanggal/waktu tenggat tidak dikenali.",
        `📚 *Mata Kuliah:* ${merged.course_name}`,
        `📌 *Tugas:* ${merged.name}`,
        "",
        "❓ Kapan tenggat waktu pengumpulan tugas ini?",
        "*(Contoh: 'Besok jam 23:59' atau '28 Oktober 2026 jam 18:00')*",
      ].join("\n");

      await sendWhatsAppMessage({
        target: effectiveReplyTarget,
        message: invalidDeadlineMsg,
        type: effectiveIsGroup ? "group" : "phone",
        org_id: workspaceId,
        provider: incoming.provider,
      });

      return NextResponse.json({
        ok: true,
        status: "needs_clarification",
        stopFurtherProcessing: true,
      });
    }

    const courseName = merged.course_name!.trim();
    const taskTitle = (merged.name || merged.title)!.trim();
    const description =
      merged.description?.trim() ||
      `Tugas mata kuliah ${courseName}. Selesaikan dan kumpulkan sesuai instruksi dosen pengampu.`;
    const submissionUrl = merged.submission_url?.trim() || "E-Learning Undiksha";
    const formattedDeadline = formatVoiceDeadlineWita(deadlineDate);

    activeDraft.course_name = courseName;
    activeDraft.name = taskTitle;
    activeDraft.title = taskTitle;
    activeDraft.description = description;
    activeDraft.deadline = merged.deadline!.trim();
    activeDraft.submission_url = submissionUrl;
    activeDraft.missing_fields = [];
    activeDraft.clarification_question = null;
    activeDraft.status = "awaiting_approval";
    activeDraft.reply_target = effectiveReplyTarget;
    activeDraft.is_group_target = effectiveIsGroup;

    await saveWhatsAppTaskDraft(activeDraft);

    // Kirim ulang kartu pratinjau yang sudah diperbarui dengan format yang sama
    const previewMsg = buildDraftPreviewCard(
      courseName,
      taskTitle,
      formattedDeadline,
      description,
      submissionUrl
    );

    await sendWhatsAppMessage({
      target: effectiveReplyTarget,
      message: previewMsg,
      type: effectiveIsGroup ? "group" : "phone",
      org_id: workspaceId,
      provider: incoming.provider,
    });

    return NextResponse.json({
      ok: true,
      status: "awaiting_approval",
      stopFurtherProcessing: true,
      draft: activeDraft,
    });
  } catch (err) {
    console.error("[VoiceTaskProcessor] Error handling draft follow-up:", err);
    const errorMsg =
      "⚠️ Terjadi kendala saat memperbarui draf tugas. Silakan ulangi kembali atau ketik 'batal' untuk membatalkan.";
    await sendWhatsAppMessage({
      target: effectiveReplyTarget,
      message: errorMsg,
      type: effectiveIsGroup ? "group" : "phone",
      org_id: workspaceId,
      provider: incoming.provider,
    });
    return NextResponse.json({
      ok: false,
      stopFurtherProcessing: true,
      error: err instanceof Error ? err.message : "draft_followup_failed",
    });
  }
}

/**
 * Main handler for WhatsApp Voice Notes / Audio messages.
 * Verifies access, extracts task info via Gemini Flash, saves as draft review (awaiting_approval),
 * and sends preview card. Does NOT directly write to `tasks` or trigger broadcast until ACC.
 */
export async function handleWhatsAppVoiceTask(
  incoming: NormalizedIncomingWhatsAppMessage,
  audioSource: string | Buffer,
  audioMimeType?: string
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
      provider: incoming.provider,
    });

    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 403 });
  }

  // Fallback error message jika audio tidak dapat dikenali
  const fallbackErrorMsg =
    "⚠️ Maaf, bot tidak dapat mengenali detail tugas dari pesan suara tersebut. Pastikan suara terdengar jelas dan menyebutkan mata kuliah serta tenggat waktunya.";

  try {
    // 3. Cek apakah pengirim sudah memiliki draf aktif (KOREKSI/TAMBAHAN DRAF PARSIAL)
    const existingDraft = await getWhatsAppTaskDraft(incoming.sender);
    if (existingDraft) {
      console.log("[VoiceTaskProcessor] Active draft exists for sender, processing voice note as partial revision:", {
        sender: incoming.sender,
        status: existingDraft.status,
        course: existingDraft.course_name,
        name: existingDraft.name,
        deadline: existingDraft.deadline,
      });

      // Proses VN baru sebagai KOREKSI / TAMBAHAN / REVISI PARSIAL draf yang sudah ada
      const merged = await mergeVoiceNoteCorrectionWithDraft(existingDraft, audioSource, audioMimeType);
      console.log("[VoiceTaskProcessor] Merged voice revision result:", merged);

      // Pastikan seluruh field lama yang sudah valid dipertahankan jika tidak diubah
      const courseName: string | null = merged.course_name ? merged.course_name.trim() : (existingDraft.course_name || null);
      const taskTitle: string | null = (merged.name || merged.title)
        ? (merged.name || merged.title)!.trim()
        : (existingDraft.name || existingDraft.title || null);
      const rawDeadline: string | null = merged.deadline ? merged.deadline.trim() : (existingDraft.deadline || null);
      const description: string = merged.description
        ? merged.description.trim()
        : (existingDraft.description || `Tugas mata kuliah ${courseName || ""}. Selesaikan dan kumpulkan sesuai instruksi dosen pengampu.`);
      const submissionUrl: string = merged.submission_url
        ? merged.submission_url.trim()
        : (existingDraft.submission_url || "E-Learning Undiksha");

      const hasCore = Boolean(courseName && taskTitle && rawDeadline);

      if (hasCore) {
        const cleanDeadlineStr = rawDeadline!.replace(/\(wita\)/i, "").trim();
        const deadlineDate = parseAcademicDeadline(cleanDeadlineStr);

        if (deadlineDate && !isNaN(deadlineDate.getTime())) {
          const formattedDeadline = formatVoiceDeadlineWita(deadlineDate);

          existingDraft.course_name = courseName!;
          existingDraft.name = taskTitle!;
          existingDraft.title = taskTitle!;
          existingDraft.description = description;
          existingDraft.deadline = rawDeadline!.trim();
          existingDraft.submission_url = submissionUrl;
          existingDraft.missing_fields = [];
          existingDraft.clarification_question = null;
          existingDraft.status = "awaiting_approval";
          existingDraft.reply_target = replyTarget;
          existingDraft.is_group_target = isGroupTarget;
          existingDraft.expires_at_ms = Date.now() + DRAFT_TTL_MS;

          await saveWhatsAppTaskDraft(existingDraft);

          // Kirim HANYA 1 pesan balasan pratinjau draf yang telah diperbarui
          const previewMsg = buildDraftPreviewCard(
            courseName!,
            taskTitle!,
            formattedDeadline,
            description,
            submissionUrl
          );

          await sendWhatsAppMessage({
            target: replyTarget,
            message: previewMsg,
            type: isGroupTarget ? "group" : "phone",
            org_id: workspaceId,
            provider: incoming.provider,
          });

          return NextResponse.json({
            ok: true,
            status: "awaiting_approval",
            stopFurtherProcessing: true,
            draft: existingDraft,
          });
        }
      }

      // Jika field inti memang belum lengkap sejak awal (misal belum ada mata kuliah atau deadline):
      existingDraft.course_name = courseName;
      existingDraft.name = taskTitle;
      existingDraft.title = taskTitle;
      existingDraft.description = description;
      existingDraft.deadline = rawDeadline;
      existingDraft.submission_url = submissionUrl;
      existingDraft.missing_fields = merged.missing_fields;
      existingDraft.status = "needs_clarification";
      existingDraft.reply_target = replyTarget;
      existingDraft.is_group_target = isGroupTarget;

      await saveWhatsAppTaskDraft(existingDraft);

      const clarifMsg = [
        "📝 *Draf Tugas Diperbarui!*",
        "",
        `📚 *Mata Kuliah:* ${existingDraft.course_name || "Belum disebutkan"}`,
        `📌 *Tugas:* ${existingDraft.name || "Belum disebutkan"}`,
        ...(existingDraft.deadline ? [`⏰ *Tenggat:* ${existingDraft.deadline}`] : []),
        "",
        `❓ ${merged.clarification_question || "Mohon lengkapi bagian yang masih kurang."}`,
        "*(Balas chat ini langsung dengan detailnya, atau ketik 'batal' untuk membatalkan)*",
      ].join("\n");

      await sendWhatsAppMessage({
        target: replyTarget,
        message: clarifMsg,
        type: isGroupTarget ? "group" : "phone",
        org_id: workspaceId,
        provider: incoming.provider,
      });

      return NextResponse.json({
        ok: true,
        status: "needs_clarification",
        stopFurtherProcessing: true,
        draft: existingDraft,
      });
    }

    // 4. Ekstraksi Multimodal menggunakan Gemini Flash API
    const extracted = await extractTaskFromVoiceNote(audioSource, audioMimeType);
    console.log("[VoiceTaskProcessor] Extracted task result:", extracted);

    const hasAnyField = Boolean(
      extracted.course_name?.trim() ||
      (extracted.name || extracted.title)?.trim() ||
      extracted.deadline?.trim()
    );

    if (extracted.error === "not_a_task" || !hasAnyField) {
      console.warn("[VoiceTaskProcessor] Voice note was not recognized as a valid academic task");
      await sendWhatsAppMessage({
        target: replyTarget,
        message: fallbackErrorMsg,
        type: isGroupTarget ? "group" : "phone",
        org_id: workspaceId,
        provider: incoming.provider,
      });

      return NextResponse.json({ ok: false, error: "unrecognized_voice_note" });
    }

    // 5. Cek apakah data belum lengkap (status === "needs_clarification" atau entitas inti kurang)
    const isMissingCore =
      !extracted.course_name?.trim() ||
      !(extracted.name || extracted.title)?.trim() ||
      !extracted.deadline?.trim();

    if (extracted.status === "needs_clarification" || isMissingCore) {
      console.log("[VoiceTaskProcessor] Incomplete task extracted, creating draft session for conversational clarification");
      const draft: TaskDraft = {
        sender: incoming.sender,
        status: "needs_clarification",
        course_name: extracted.course_name?.trim() || null,
        name: (extracted.name || extracted.title)?.trim() || null,
        title: (extracted.name || extracted.title)?.trim() || null,
        description: extracted.description?.trim() || null,
        deadline: extracted.deadline?.trim() || null,
        submission_url: extracted.submission_url?.trim() || "E-Learning Undiksha",
        missing_fields: extracted.missing_fields || [],
        clarification_question: extracted.clarification_question?.trim() || null,
        audio_url: typeof audioSource === "string" ? audioSource : incoming.url || incoming.mediaUrl || null,
        group_id: incoming.groupId || null,
        reply_target: replyTarget,
        is_group_target: isGroupTarget,
        provider: incoming.provider,
        created_at_ms: Date.now(),
        expires_at_ms: Date.now() + DRAFT_TTL_MS,
      };

      await saveWhatsAppTaskDraft(draft);

      const clarifQuestion =
        draft.clarification_question ||
        (!draft.deadline
          ? `Tugas ${draft.name || draft.course_name || ""} sudah dicatat, tapi kapan tenggat waktunya ya?`
          : !draft.course_name
          ? "Ini tugas untuk mata kuliah apa ya?"
          : "Apa nama atau detail tugasnya ya?");

      const draftMsg = [
        "📝 *Draf Tugas Tersimpan!*",
        "",
        `📚 *Mata Kuliah:* ${draft.course_name || "Belum disebutkan"}`,
        `📌 *Tugas:* ${draft.name || "Belum disebutkan"}`,
        "",
        `❓ ${clarifQuestion}`,
        "*(Balas chat ini langsung dengan detailnya, contoh: 'Besok jam 23:59')*",
      ].join("\n");

      await sendWhatsAppMessage({
        target: replyTarget,
        message: draftMsg,
        type: isGroupTarget ? "group" : "phone",
        org_id: workspaceId,
        provider: incoming.provider,
      });

      return NextResponse.json({
        ok: true,
        status: "needs_clarification",
        stopFurtherProcessing: true,
        draft,
      });
    }

    // 6. Entitas Lengkap: Simpan sebagai Draf Pratinjau (Menunggu Persetujuan / ACC)
    // JANGAN langsung membuat dokumen di koleksi tasks!
    // JANGAN memicu siaran broadcast ke grup kelas!
    const courseName = extracted.course_name!.trim();
    const taskTitle = (extracted.name || extracted.title)!.trim();
    const description =
      extracted.description?.trim() ||
      `Tugas mata kuliah ${courseName}. Selesaikan dan kumpulkan sesuai instruksi dosen pengampu.`;
    const submissionUrl = extracted.submission_url?.trim() || "E-Learning Undiksha";

    // Parsing Tanggal Tenggat
    const cleanDeadlinStr = extracted.deadline!.replace(/\(wita\)/i, "").trim();
    const deadlineDate = parseAcademicDeadline(cleanDeadlinStr);

    if (!deadlineDate || isNaN(deadlineDate.getTime())) {
      console.warn(`[VoiceTaskProcessor] Failed to parse deadline from voice note: "${extracted.deadline}"`);
      await sendWhatsAppMessage({
        target: replyTarget,
        message: fallbackErrorMsg,
        type: isGroupTarget ? "group" : "phone",
        org_id: workspaceId,
        provider: incoming.provider,
      });

      return NextResponse.json({ ok: false, error: "invalid_deadline_date" });
    }

    const formattedDeadline = formatVoiceDeadlineWita(deadlineDate);

    // Simpan seluruh hasil ekstraksi ke draf sesi admin (whatsapp_drafts/{senderNumber})
    const draft: TaskDraft = {
      sender: incoming.sender,
      status: "awaiting_approval",
      course_name: courseName,
      name: taskTitle,
      title: taskTitle,
      description,
      deadline: extracted.deadline!.trim(),
      submission_url: submissionUrl,
      missing_fields: [],
      clarification_question: null,
      audio_url: typeof audioSource === "string" ? audioSource : incoming.url || incoming.mediaUrl || null,
      group_id: incoming.groupId || null,
      reply_target: replyTarget,
      is_group_target: isGroupTarget,
      provider: incoming.provider,
      created_at_ms: Date.now(),
      expires_at_ms: Date.now() + DRAFT_TTL_MS,
    };

    await saveWhatsAppTaskDraft(draft);
    console.log(`[VoiceTaskProcessor] Draft saved with status awaiting_approval for ${incoming.sender}`);

    // Balas pesan WhatsApp ke admin dengan format pratinjau (preview card) yang rapi
    const previewMsg = buildDraftPreviewCard(
      courseName,
      taskTitle,
      formattedDeadline,
      description,
      submissionUrl
    );

    await sendWhatsAppMessage({
      target: replyTarget,
      message: previewMsg,
      type: isGroupTarget ? "group" : "phone",
      org_id: workspaceId,
      provider: incoming.provider,
    });

    return NextResponse.json({
      ok: true,
      status: "awaiting_approval",
      stopFurtherProcessing: true,
      draft,
    });
  } catch (err) {
    console.error("[VoiceTaskProcessor] Error processing voice task:", err);

    await sendWhatsAppMessage({
      target: replyTarget,
      message: fallbackErrorMsg,
      type: isGroupTarget ? "group" : "phone",
      org_id: workspaceId,
      provider: incoming.provider,
    });

    return NextResponse.json({
      ok: false,
      stopFurtherProcessing: true,
      error: err instanceof Error ? err.message : "voice_processing_failed",
    });
  }
}

/**
 * Alias exported as requested for voice task processor.
 */
export const processVoiceNoteAcademicTask = handleWhatsAppVoiceTask;

