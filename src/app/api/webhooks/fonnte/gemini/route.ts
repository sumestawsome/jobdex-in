import { NextResponse, type NextRequest } from "next/server";
import crypto from "crypto";
import { normalizeFonnteWebhookPayload } from "@/lib/server/fonnte-webhook-parser";
import { executeWhatsAppWebhook } from "@/lib/server/whatsapp/command-handler";
import { getAdminDb, FieldValue } from "@/lib/server/firebase-admin";

export const runtime = "nodejs";

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

  // --- Route-Level Atomic Deduplication (Fase 27A.2.6) ---
  const dedupeKeySource = [
    incoming.provider,
    incoming.groupId || "personal",
    incoming.sender || "unknown",
    incoming.timestamp || "",
    incoming.message || "",
  ].join("|");

  const dedupeKey = crypto
    .createHash("sha256")
    .update(dedupeKeySource)
    .digest("hex");

  const db = getAdminDb();
  const docRef = db.collection("whatsapp_inbound_logs").doc(dedupeKey);

  try {
    // Atomic create
    await docRef.create({
      dedupe_key: dedupeKey,
      provider: incoming.provider,
      group_id: incoming.groupId || "",
      sender: incoming.sender || "",
      message_preview: incoming.message.slice(0, 80),
      status: "processing",
      created_at: FieldValue.serverTimestamp(),
    });
    console.log("[whatsapp inbound dedupe] lock created", {
      dedupeKeyPreview: dedupeKey.slice(0, 32),
    });
  } catch (error: unknown) {
    const errObj = error as Record<string, unknown> | null;
    if (errObj && (errObj.code === 6 || (typeof errObj.message === "string" && errObj.message.includes("already exists")))) {
      console.log("[whatsapp inbound dedupe] duplicate ignored", {
        dedupeKeyPreview: dedupeKey.slice(0, 32),
      });
      return NextResponse.json({
        ok: true,
        deduped: true,
      });
    }
    console.error("Deduplication error:", error);
  }

  // Forward to shared command execution engine asynchronously in background
  // Respon HTTP 200 OK segera dikembalikan ke server Fonnte agar koneksi tidak timeout
  executeWhatsAppWebhook(incoming, payload)
    .then(async (response) => {
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
    })
    .catch(async (err: unknown) => {
      console.error("[fonnte webhook] Error executing command in background:", err);
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
    });

  return NextResponse.json({
    ok: true,
    status: "processing",
    message: "Webhook Fonnte berhasil diterima dan sedang diproses.",
  });
}
