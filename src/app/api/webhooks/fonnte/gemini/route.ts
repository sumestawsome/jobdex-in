import { NextResponse, type NextRequest } from "next/server";
import crypto from "crypto";
import { normalizeFonnteWebhookPayload } from "@/lib/server/fonnte-webhook-parser";
import { executeWhatsAppWebhook } from "@/lib/server/whatsapp/command-handler";
import { getAdminDb, FieldValue } from "@/lib/server/firebase-admin";
import {
  isBotSelfEchoMessage,
  isAudioVoiceNote,
  getWhatsAppTaskDraft,
} from "@/lib/server/voice-task-processor";

export const runtime = "nodejs";
export const maxDuration = 60;

// In-memory dedupe lock cache (TTL 15 detik) untuk mencegah retry berulang dari network Fonnte
const inMemoryDedupeLocks = new Map<string, number>();
const DEDUPE_TTL_SECONDS = 15;
const DEDUPE_TTL_MS = DEDUPE_TTL_SECONDS * 1000;

function pruneExpiredMemoryLocks(now: number) {
  for (const [key, expiresAt] of inMemoryDedupeLocks.entries()) {
    if (now > expiresAt) {
      inMemoryDedupeLocks.delete(key);
    }
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    provider: "fonnte",
    message: "FONNTE webhook endpoint is active",
  });
}

export async function POST(request: NextRequest) {
  // Check if FONNTE Webhook is enabled
  if (process.env.FONNTE_WEBHOOK_ENABLED === "false") {
    return NextResponse.json({ error: "FONNTE Webhook is disabled." }, { status: 403 });
  }

  // Parse request body
  let payload: unknown;
  try {
    const text = await request.text();
    if (!text) {
      return NextResponse.json({ error: "Empty request body" }, { status: 400 });
    }
    payload = JSON.parse(text);
  } catch (err) {
    console.error("Failed to parse Fonnte webhook payload:", err);
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const payloadObj = typeof payload === "object" && payload !== null ? (payload as Record<string, unknown>) : {};

  // Securely log payload structure (keys only, no values to avoid printing tokens or phone numbers)
  const choices = Array.isArray(payloadObj.choices) ? payloadObj.choices : null;
  const firstChoice = choices && choices[0] && typeof choices[0] === "object" ? (choices[0] as Record<string, unknown>) : null;

  console.log("[fonnte webhook] payload summary", {
    keys: Object.keys(payloadObj),
    choicesType: choices ? "array" : typeof payloadObj.choices,
    choicesLength: choices ? choices.length : null,
    firstChoiceKeys: firstChoice ? Object.keys(firstChoice) : null,
    device: payloadObj.device ? "***" : null,
    extension: payloadObj.extension ? "***" : null,
  });

  if (firstChoice) {
    console.log("[fonnte webhook] first choice summary", {
      keys: Object.keys(firstChoice),
      hasMessage: Boolean(firstChoice.message || firstChoice.text || firstChoice.body || firstChoice.pesan),
      hasSender: Boolean(firstChoice.sender || firstChoice.from || firstChoice.member || firstChoice.pengirim),
      hasGroup: Boolean(firstChoice.group || firstChoice.group_id || firstChoice.remoteJid || firstChoice.sender),
    });
  }

  // Validate Secret Key if configured in env
  const configuredSecret = process.env.FONNTE_WEBHOOK_SECRET ?? "";
  if (configuredSecret) {
    const tokenFromPayload = typeof payloadObj.token === "string" ? payloadObj.token : "";
    const secretFromPayload = typeof payloadObj.secret === "string" ? payloadObj.secret : "";

    const incomingToken = request.headers.get("Authorization") || 
                          request.headers.get("token") || 
                          request.headers.get("x-fonnte-token") ||
                          request.headers.get("x-fonnte-secret") ||
                          tokenFromPayload || 
                          secretFromPayload || 
                          "";

    if (incomingToken !== configuredSecret) {
      return NextResponse.json({ error: "Unauthorized webhook." }, { status: 401 });
    }
  }

  // Normalize Fonnte payload
  const incoming = normalizeFonnteWebhookPayload(payload);
  if (!incoming) {
    return NextResponse.json({
      ok: true,
      ignored: true,
      reason: "invalid_or_non_message_payload",
    });
  }

  // Normalisasi Pengirim Fonnte untuk Pesan Grup
  let rawSender = (payloadObj.sender as string) || incoming.sender;
  const isGroup =
    payloadObj.isgroup === true ||
    payloadObj.isGroup === true ||
    String(payloadObj.sender || "").includes("@g.us") ||
    String(payloadObj.sender || "").startsWith("1203") ||
    incoming.isGroup;

  if (isGroup) {
    incoming.isGroup = true;

    // Jika pesan berasal dari grup, ambil dari pengirim/member
    if (payloadObj.pengirim || payloadObj.member) {
      rawSender = (payloadObj.pengirim || payloadObj.member) as string;
    }

    // Pastikan groupId tetap mencatat ID grup WhatsApp aslinya (120363...)
    if (!incoming.groupId) {
      const candidateGroup = String(
        payloadObj.group_id ||
        payloadObj.groupId ||
        payloadObj.group ||
        payloadObj.remoteJid ||
        (String(payloadObj.sender || "").includes("@g.us") || String(payloadObj.sender || "").startsWith("1203") ? payloadObj.sender : "") ||
        ""
      );
      if (candidateGroup) {
        incoming.groupId = candidateGroup.endsWith("@g.us") ? candidateGroup : `${candidateGroup}@g.us`;
      }
    }
  }

  // Sanitasi Nomor: Bersihkan dari @s.whatsapp.net, @c.us, spasi, -, +, non-digit (contoh: 6285119459703)
  if (rawSender) {
    incoming.sender = String(rawSender)
      .replace(/@s\.whatsapp\.net$/i, "")
      .replace(/@c\.us$/i, "")
      .replace(/[\s\-\+\(\)]/g, "")
      .replace(/\D/g, "")
      .replace(/^0/, "62")
      .replace(/^8/, "628");
  }

  console.log("[fonnte webhook] request received", {
    timestamp: incoming.timestamp || "",
    groupId: incoming.groupId || "personal",
    sender: incoming.sender ? `${incoming.sender.slice(0, 4)}***` : null,
    messagePreview: incoming.message?.slice(0, 40),
  });

  console.log("[fonnte webhook] normalized", {
    isGroup: incoming.isGroup,
    groupId: incoming.groupId,
    hasSender: Boolean(incoming.sender),
    messagePreview: incoming.message.slice(0, 30),
  });

  // Guard against malformed messages
  if (!incoming.message || !incoming.sender) {
    return NextResponse.json({
      ok: true,
      ignored: true,
      reason: "missing_message_or_sender",
    });
  }

  // 1. Filter Self-Echo & Pesan Bot Sendiri
  if (isBotSelfEchoMessage(incoming.message)) {
    console.log("[fonnte webhook] Fast exit - ignored bot self-echo output message:", incoming.message.slice(0, 50));
    return NextResponse.json({ status: "ignored_bot_output" }, { status: 200 });
  }

  // 2. Batasi Peran Webhook Fonnte (One-Way Separation)
  // Sesuai arsitektur JobDex.in: Green-API adalah gateway utama untuk interaksi 2 arah & pembuatan tugas.
  // Fonnte khusus broadcast satu arah. Abaikan voice note, task command, dan interaksi draf.

  // A. Abaikan Voice Note / Audio
  const audioCheck = isAudioVoiceNote(incoming, payload);
  if (audioCheck.isAudio) {
    console.log("[fonnte webhook] Ignored voice note - handled exclusively by Green-API gateway");
    return NextResponse.json({
      status: "ignored_fonnte_voice_note_handled_by_green_api",
      ignored: true,
    }, { status: 200 });
  }

  // B. Abaikan Perintah Task & Interaksi Draf (ACC, Batal, Revisi, dsb.)
  const strippedText = (incoming.message || "")
    .trim()
    .replace(/^[*_~`]+|[*_~`]+$/g, "")
    .trim();

  const isTaskCommand = /^(?:[!/]tugas\b|[!/]acc\b|acc\b|[!/]batal\b|batal\b)/i.test(strippedText);
  const activeDraft = await getWhatsAppTaskDraft(incoming.sender);

  if (isTaskCommand || activeDraft) {
    console.log("[fonnte webhook] Ignored task command / draft interaction (handled by Green-API):", {
      sender: incoming.sender,
      isTaskCommand,
      hasActiveDraft: Boolean(activeDraft),
      textPreview: strippedText.slice(0, 40),
    });
    return NextResponse.json({
      status: "ignored_fonnte_task_command_handled_by_green_api",
      ignored: true,
      reason: isTaskCommand ? "task_command_handled_by_green_api" : "active_draft_revision_handled_by_green_api",
    }, { status: 200 });
  }

  // --- Route-Level Atomic Deduplication (Fase 27A.2.6) ---
  // Masukkan ID unik pesan (inboxid/id non-0) ATAU timestamp detik pesan
  const rawId = incoming.rawMessageId && incoming.rawMessageId !== "0" ? incoming.rawMessageId : null;
  const messageTimestamp = incoming.timestamp ? String(incoming.timestamp) : String(Math.floor(Date.now() / 1000));
  const uniqueMessageIdentifier = rawId ? `id:${rawId}` : `ts:${messageTimestamp}`;

  const dedupeKeySource = [
    incoming.provider,
    incoming.groupId || "personal",
    incoming.sender || "unknown",
    uniqueMessageIdentifier,
    incoming.message || "",
  ].join("|");

  const dedupeKey = crypto
    .createHash("sha256")
    .update(dedupeKeySource)
    .digest("hex");

  const now = Date.now();
  pruneExpiredMemoryLocks(now);

  // 1. Cek in-memory lock (15s TTL)
  const memExpiresAt = inMemoryDedupeLocks.get(dedupeKey);
  if (memExpiresAt && now <= memExpiresAt) {
    console.log("[whatsapp inbound dedupe] in-memory duplicate ignored (<15s)", {
      dedupeKeyPreview: dedupeKey.slice(0, 32),
      uniqueMessageIdentifier,
    });
    return NextResponse.json({
      ok: true,
      deduped: true,
    });
  }
  inMemoryDedupeLocks.set(dedupeKey, now + DEDUPE_TTL_MS);

  // 2. Cek Firestore distributed lock (15s TTL)
  const db = getAdminDb();
  const docRef = db.collection("whatsapp_inbound_logs").doc(dedupeKey);
  let isDuplicate = false;

  try {
    // Atomic create lock
    await docRef.create({
      dedupe_key: dedupeKey,
      provider: incoming.provider,
      group_id: incoming.groupId || "",
      sender: incoming.sender || "",
      unique_identifier: uniqueMessageIdentifier,
      message_preview: incoming.message.slice(0, 80),
      status: "processing",
      created_at: FieldValue.serverTimestamp(),
      created_at_ms: now,
      expires_at_ms: now + DEDUPE_TTL_MS,
    });
    console.log("[whatsapp inbound dedupe] lock created", {
      dedupeKeyPreview: dedupeKey.slice(0, 32),
      uniqueMessageIdentifier,
      ttlSeconds: DEDUPE_TTL_SECONDS,
    });
  } catch (error: unknown) {
    const errObj = error as Record<string, unknown> | null;
    if (errObj && (errObj.code === 6 || (typeof errObj.message === "string" && errObj.message.includes("already exists")))) {
      // Periksa apakah dokumen lock sudah kedaluwarsa (> 15 detik)
      const existingDoc = await docRef.get();
      if (existingDoc.exists) {
        const data = existingDoc.data();
        let docCreatedAtMs = typeof data?.created_at_ms === "number" ? data.created_at_ms : 0;
        if (!docCreatedAtMs && data?.created_at?.toMillis) {
          docCreatedAtMs = data.created_at.toMillis();
        } else if (!docCreatedAtMs && typeof data?.created_at?._seconds === "number") {
          docCreatedAtMs = data.created_at._seconds * 1000;
        }

        const ageMs = docCreatedAtMs > 0 ? (now - docCreatedAtMs) : Infinity;

        // Jika lock sudah kedaluwarsa (> 15 detik), perbarui lock dan izinkan pesan diproses
        if (ageMs > DEDUPE_TTL_MS) {
          console.log("[whatsapp inbound dedupe] expired lock found (>15s), renewing lock and allowing message", {
            dedupeKeyPreview: dedupeKey.slice(0, 32),
            ageSeconds: Math.round(ageMs / 1000),
          });
          await docRef.set({
            dedupe_key: dedupeKey,
            provider: incoming.provider,
            group_id: incoming.groupId || "",
            sender: incoming.sender || "",
            unique_identifier: uniqueMessageIdentifier,
            message_preview: incoming.message.slice(0, 80),
            status: "processing",
            created_at: FieldValue.serverTimestamp(),
            created_at_ms: now,
            expires_at_ms: now + DEDUPE_TTL_MS,
          }, { merge: true });
        } else {
          // Lock masih aktif dan di bawah 15 detik -> retry murni dari Fonnte
          console.log("[whatsapp inbound dedupe] duplicate ignored (active lock <15s)", {
            dedupeKeyPreview: dedupeKey.slice(0, 32),
            ageSeconds: Math.round(ageMs / 1000),
          });
          isDuplicate = true;
        }
      }
    } else {
      console.error("Deduplication error:", error);
    }
  }

  if (isDuplicate) {
    return NextResponse.json({
      ok: true,
      deduped: true,
    });
  }

  // Forward to shared command execution engine and await result so Vercel runtime does not freeze before completion
  try {
    const response = await executeWhatsAppWebhook(incoming, payload);
    try {
      await docRef.update({
        status: response.ok ? "processed" : "failed",
        processed_at: FieldValue.serverTimestamp(),
        reply_provider: incoming.provider,
        reply_target: incoming.groupId || incoming.sender,
        error: response.ok ? null : `Status ${response.status}`,
      });
    } catch (updateErr) {
      console.error("[fonnte webhook] Failed to update dedupe log status:", updateErr);
    }
    return response;
  } catch (err: unknown) {
    console.error("[fonnte webhook] Error executing command:", err);
    try {
      await docRef.update({
        status: "failed",
        processed_at: FieldValue.serverTimestamp(),
        reply_provider: incoming.provider,
        reply_target: incoming.groupId || incoming.sender,
        error: err instanceof Error ? err.message : String(err),
      });
    } catch {
      // ignore update error
    }
    return NextResponse.json({
      ok: false,
      error: err instanceof Error ? err.message : "Internal command execution error",
    }, { status: 500 });
  }
}
