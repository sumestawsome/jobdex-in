import { NextResponse, type NextRequest } from "next/server";
import crypto from "crypto";
import { getAdminDb, FieldValue } from "@/lib/server/firebase-admin";
import { sendGreenApiTextMessage } from "@/lib/server/green-api";
import { verifyAdminKomunitas } from "@/lib/server/whatsapp-academic-task-creator";
import { handleWhatsAppVoiceTask, isBotSelfEchoMessage } from "@/lib/server/voice-task-processor";
import { executeWhatsAppWebhook } from "@/lib/server/whatsapp/command-handler";
import type { NormalizedIncomingWhatsAppMessage } from "@/types";

export const runtime = "nodejs";
export const maxDuration = 60;

// In-memory dedupe lock cache (TTL 10 menit) untuk mencegah infinite webhook retry storm dari Green-API
const inMemoryDedupeLocks = new Map<string, number>();
const DEDUPE_TTL_MS = 10 * 60 * 1000; // 10 menit

function pruneExpiredMemoryLocks(now: number) {
  for (const [key, expiresAt] of inMemoryDedupeLocks.entries()) {
    if (now > expiresAt) {
      inMemoryDedupeLocks.delete(key);
    }
  }
}

export async function GET() {
  return NextResponse.json({
    status: "success",
    provider: "green-api",
    message: "Green-API WhatsApp webhook endpoint is active",
  });
}

export async function POST(request: NextRequest) {
  // Parse request body
  let payload: unknown;
  try {
    const text = await request.text();
    if (!text) {
      return NextResponse.json({ status: "success", ignored: true, reason: "empty_body" });
    }
    payload = JSON.parse(text);
  } catch (err) {
    console.error("[green-api webhook] Failed to parse JSON payload:", err);
    return NextResponse.json({ status: "success", ignored: true, error: "invalid_json" });
  }

  if (!payload || typeof payload !== "object") {
    return NextResponse.json({ status: "success", ignored: true });
  }

  const root = payload as Record<string, unknown>;
  const typeWebhook = String(root.typeWebhook || "").trim();

  // 1. Abaikan event jika pesan bukan incomingMessageReceived (misal outgoingMessageReceived, dsb.)
  if (typeWebhook !== "incomingMessageReceived") {
    return NextResponse.json({
      status: "success",
      ignored: true,
      reason: `ignored_webhook_type_${typeWebhook || "unknown"}`,
    });
  }

  const senderData = (root.senderData && typeof root.senderData === "object"
    ? root.senderData
    : {}) as Record<string, unknown>;

  const instanceData = (root.instanceData && typeof root.instanceData === "object"
    ? root.instanceData
    : {}) as Record<string, unknown>;

  const messageData = (root.messageData && typeof root.messageData === "object"
    ? root.messageData
    : {}) as Record<string, unknown>;

  const textMessageData = (messageData.textMessageData && typeof messageData.textMessageData === "object"
    ? messageData.textMessageData
    : {}) as Record<string, unknown>;

  const extendedTextMessageData = (
    messageData.extendedTextMessageData && typeof messageData.extendedTextMessageData === "object"
      ? messageData.extendedTextMessageData
      : {}
  ) as Record<string, unknown>;

  const fileMessageData = (messageData.fileMessageData && typeof messageData.fileMessageData === "object"
    ? messageData.fileMessageData
    : {}) as Record<string, unknown>;

  const textMessage = String(
    textMessageData.textMessage ||
    extendedTextMessageData.text ||
    fileMessageData.caption ||
    messageData.caption ||
    ""
  ).trim();

  // Fast exit: Filter Self-Echo & Pesan Bot Sendiri
  if (isBotSelfEchoMessage(textMessage)) {
    console.log("[green-api webhook] Fast exit - ignored bot self-echo output message:", textMessage.slice(0, 50));
    return NextResponse.json({ status: "ignored_bot_output" }, { status: 200 });
  }

  // Ekstrak target chat dan nomor pengirim dengan safeguard grup
  const rawChatId = String(senderData.chatId || root.chatId || "").trim();
  const isGroup = rawChatId.endsWith("@g.us");
  const groupId = isGroup ? rawChatId : undefined;

  // Di grup WhatsApp, senderData.sender berisi nomor individu peserta (e.g. 6285119459703@c.us),
  // sedangkan senderData.chatId berisi ID grup (e.g. 120363432766465224@g.us).
  const rawSender = String(
    senderData.sender ||
    root.sender ||
    (!isGroup ? rawChatId : "")
  ).trim();

  // Ekstrak nomor murni tanpa @c.us / @g.us / @s.whatsapp.net (contoh: 6285119459703)
  const cleanSender = rawSender
    .replace(/@c\.us$/i, "")
    .replace(/@s\.whatsapp\.net$/i, "")
    .replace(/@g\.us$/i, "")
    .replace(/[^\d]/g, "")
    .replace(/^0/, "62");

  // Deteksi jika pesan dikirim oleh nomor bot sendiri (instanceData.wid / sender)
  const botWid = String(instanceData.wid || "").replace(/[^\d]/g, "");
  if (botWid && cleanSender === botWid) {
    return NextResponse.json({
      status: "success",
      ignored: true,
      reason: "bot_self_message",
    });
  }

  if (!cleanSender) {
    console.warn("[green-api webhook] Warning: Failed to extract valid sender phone number from payload:", {
      idMessage: root.idMessage,
      rawChatId,
      rawSender,
      senderData,
      isGroup,
    });
  }

  const senderName = String(senderData.senderName || senderData.senderContactName || "");

  // Ekstrak idMessage dari payload Green-API
  const idMessage = String(
    root.idMessage ||
    messageData.idMessage ||
    root.id ||
    ""
  ).trim();
  const timestamp = root.timestamp;

  // Deduplikasi menggunakan idMessage atau hash fallback
  const dedupeKey = idMessage || crypto.createHash("sha256").update([
    "green-api",
    rawChatId || "personal",
    cleanSender || "unknown",
    String(timestamp || Date.now()),
  ].join("|")).digest("hex");

  const now = Date.now();
  pruneExpiredMemoryLocks(now);

  // A. Cek cache in-memory: jika sudah diproses dalam 10 menit terakhir, Fast ACK return already_processed
  const memExpiresAt = inMemoryDedupeLocks.get(dedupeKey);
  if (memExpiresAt && now < memExpiresAt) {
    console.log("[green-api webhook] Fast ACK - idMessage already processed (in-memory):", dedupeKey);
    return NextResponse.json({ status: "already_processed" }, { status: 200 });
  }

  // B. Cek cache Firestore
  try {
    const db = getAdminDb();
    const docRef = db.collection("green_api_dedupe").doc(dedupeKey);
    const snap = await docRef.get();
    if (snap.exists) {
      const data = snap.data();
      const expiresAtMs = typeof data?.expires_at_ms === "number" ? data.expires_at_ms : 0;
      if (now < expiresAtMs) {
        console.log("[green-api webhook] Fast ACK - idMessage already processed (firestore):", dedupeKey);
        inMemoryDedupeLocks.set(dedupeKey, expiresAtMs);
        return NextResponse.json({ status: "already_processed" }, { status: 200 });
      }
    }

    // Simpan idMessage ke cache deduplikasi SEBELUM memproses audio atau pesan
    inMemoryDedupeLocks.set(dedupeKey, now + DEDUPE_TTL_MS);
    await docRef.set({
      dedupeKey,
      idMessage: idMessage || null,
      sender: cleanSender || null,
      chatId: rawChatId || null,
      processed_at_ms: now,
      expires_at_ms: now + DEDUPE_TTL_MS,
      created_at: FieldValue.serverTimestamp(),
    }).catch((fsErr) => {
      console.warn("[green-api webhook] Warning: Failed to write Firestore dedupe lock:", fsErr);
    });
  } catch (dbErr) {
    console.warn("[green-api webhook] Firestore dedupe check error, falling back to in-memory lock:", dbErr);
    inMemoryDedupeLocks.set(dedupeKey, now + DEDUPE_TTL_MS);
  }

  // Ekstrak media dan teks pesan
  const typeMessage = String(messageData.typeMessage || "");
  const downloadUrl = String(fileMessageData.downloadUrl || messageData.downloadUrl || "").trim();
  const mimeType = String(fileMessageData.mimeType || messageData.mimeType || "").trim();
  const fileName = String(fileMessageData.fileName || messageData.fileName || "").trim();

  // Deteksi pesan suara / audio attachment
  const isAudio =
    typeMessage === "audioMessage" ||
    typeMessage === "voiceMessage" ||
    (typeMessage === "fileMessage" && (mimeType.toLowerCase().includes("audio") || /\.(ogg|opus|mp3|m4a|wav|aac)(\?.*)?$/i.test(fileName || downloadUrl))) ||
    mimeType.toLowerCase().includes("audio") ||
    /\.(ogg|opus|mp3|m4a|wav|aac)(\?.*)?$/i.test(downloadUrl);

  console.log("[green-api webhook] Inbound event:", {
    idMessage,
    sender: cleanSender,
    rawChatId,
    isGroup,
    typeMessage,
    isAudio,
    hasDownloadUrl: Boolean(downloadUrl),
    textPreview: textMessage.slice(0, 30),
  });

  // ============================================================================
  // 1. PENANGANAN PESAN SUARA / AUDIO ATTACHMENT
  // ============================================================================
  if (isAudio && downloadUrl) {
    const incoming: NormalizedIncomingWhatsAppMessage = {
      provider: "green-api",
      message: textMessage || "non-text message",
      sender: cleanSender,
      senderName: senderName || undefined,
      groupId,
      isGroup,
      rawMessageId: idMessage || undefined,
      timestamp: typeof timestamp === "string" || typeof timestamp === "number" ? timestamp : undefined,
      url: downloadUrl,
      mediaUrl: downloadUrl,
      attachment: downloadUrl,
      filename: fileName || undefined,
      filetype: mimeType || "audio/ogg",
      messageType: typeMessage,
      extension: fileName ? fileName.split(".").pop() : "ogg",
    };

    const db = getAdminDb();
    const { isAdmin, adminUser, isDmAllowed } = await verifyAdminKomunitas(incoming, db);

    if (!incoming.isGroup && isDmAllowed === false) {
      console.warn(`[green-api webhook] Voice note DM slot limit guard triggered for ${cleanSender}`);
      const friendlyDMMsg = [
        "⚠️ *Akses Voice Note Jalur Pribadi Dibatasi*",
        "",
        "Halo! Untuk menjaga efisiensi alur bot dan kuota chat, pembuatan tugas via Voice Note di jalur pesan pribadi hanya dibuka untuk Admin Komunitas (Korti & Wakil Korti).",
        "",
        "Silakan kirimkan rekaman suara Anda di *Grup Diskusi Kelas* agar dapat diproses oleh bot. Terima kasih! 🙏",
      ].join("\n");

      await sendGreenApiTextMessage(rawChatId, friendlyDMMsg);
      return NextResponse.json({ status: "success", reason: "voice_note_dm_restricted" });
    }

    if (!isAdmin || !adminUser) {
      console.warn(`[green-api webhook] Unauthorized voice note attempt from ${cleanSender}`);
      const deniedMsg = [
        "⛔ *Akses Ditolak*",
        "Maaf, fitur pencatatan tugas otomatis via Voice Note hanya dapat digunakan oleh *Admin Komunitas* atau *Super Admin*.",
      ].join("\n");

      await sendGreenApiTextMessage(rawChatId, deniedMsg);
      return NextResponse.json({ status: "success", reason: "unauthorized" });
    }

    try {
      // Download file audio langsung via fetch(downloadUrl) dengan AbortController timeout guard 15 detik
      console.log(`[green-api webhook] Downloading audio file from: ${downloadUrl.slice(0, 60)}...`);
      const audioController = new AbortController();
      const audioTimeoutId = setTimeout(() => audioController.abort(), 15000);

      let audioRes: Response;
      try {
        audioRes = await fetch(downloadUrl, {
          headers: { "User-Agent": "JobDex-In-GreenApi/1.0" },
          signal: audioController.signal,
        });
      } finally {
        clearTimeout(audioTimeoutId);
      }

      if (!audioRes.ok) {
        console.error(`[green-api webhook] Failed to download audio file: HTTP ${audioRes.status}`);
        await sendGreenApiTextMessage(
          rawChatId,
          "⚠️ Maaf, bot gagal mengunduh rekaman suara dari WhatsApp. Silakan kirim ulang voice note Anda."
        );
        return NextResponse.json({ status: "success", reason: "audio_download_failed" });
      }

      const arrayBuffer = await audioRes.arrayBuffer();
      const audioBuffer = Buffer.from(arrayBuffer);

      // Oper data audio ke modul ekstraksi Gemini Flash (handleWhatsAppVoiceTask / voice-task-processor.ts).
      // (handleWhatsAppVoiceTask memvalidasi ruang kelas, mengekstrak data JSON tugas dengan Gemini Flash,
      //  menyimpan tugas ke Firestore, memicu siaran tugas jika tenggat <= 3 hari ke grup pengumuman,
      //  dan mengirim balasan konfirmasi ke pengirim).
      const voiceRes = await handleWhatsAppVoiceTask(incoming, audioBuffer, mimeType || "audio/ogg");
      const voiceData = await voiceRes.json().catch(() => null);

      console.log("[green-api webhook] Voice task processing completed:", voiceData);

      return NextResponse.json({ status: "success", voiceData });
    } catch (audioErr: unknown) {
      const isAbortOrTimeout =
        (audioErr instanceof Error && (audioErr.name === "AbortError" || audioErr.name === "TimeoutError")) ||
        String(audioErr).toLowerCase().includes("abort") ||
        String(audioErr).toLowerCase().includes("timeout");

      console.error("[green-api webhook] Error processing audio task:", isAbortOrTimeout ? "Audio fetch/process timed out (15s limit)" : audioErr);

      await sendGreenApiTextMessage(
        rawChatId,
        isAbortOrTimeout
          ? "⚠️ Gagal memproses audio karena layanan AI sedang tidak merespons, silakan coba lagi sebentar."
          : "⚠️ Terjadi kendala saat memproses rekaman suara tugas kuliah. Silakan coba sesaat lagi."
      ).catch(() => {});

      // Return status 200 agar antrean webhook Green-API tidak menahan koneksi atau retry berulang
      return NextResponse.json({
        status: isAbortOrTimeout ? "timeout" : "error",
        error: isAbortOrTimeout ? "request_aborted_timeout_15s" : String(audioErr),
      }, { status: 200 });
    }
  }

  // ============================================================================
  // 2. PENANGANAN PESAN TEKS PERINTAH
  // ============================================================================
  if (typeMessage === "textMessage" || typeMessage === "extendedTextMessage" || textMessage) {
    const incoming: NormalizedIncomingWhatsAppMessage = {
      provider: "green-api",
      message: textMessage,
      sender: cleanSender,
      senderName: senderName || undefined,
      groupId,
      isGroup,
      rawMessageId: idMessage || undefined,
      timestamp: typeof timestamp === "string" || typeof timestamp === "number" ? timestamp : undefined,
    };

    try {
      console.log("[green-api webhook] Executing text command via executeWhatsAppWebhook:", {
        sender: cleanSender,
        rawChatId,
        textPreview: textMessage.slice(0, 40),
      });

      await executeWhatsAppWebhook(incoming, root);
    } catch (cmdErr) {
      console.error("[green-api webhook] Command execution error:", cmdErr);
      await sendGreenApiTextMessage(
        rawChatId,
        "Waduh, koneksi ke asisten AI lagi bermasalah nih. Tapi kamu tetep bisa pakai perintah biasa ya! ✌️"
      );
    }

    return NextResponse.json({ status: "success" });
  }

  return NextResponse.json({
    status: "success",
    ignored: true,
    reason: `unhandled_message_type_${typeMessage || "unknown"}`,
  });
}
