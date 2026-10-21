import { NextResponse, type NextRequest } from "next/server";
import { parseWablasIncomingPayload } from "@/lib/server/wablas-webhook-parser";
import { executeWhatsAppWebhook } from "@/lib/server/whatsapp/command-handler";
import type { NormalizedIncomingWhatsAppMessage } from "@/types";

export const runtime = "nodejs";
export const maxDuration = 60;

async function parseRequestBody(request: NextRequest) {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return request.json();
  }

  if (
    contentType.includes("application/x-www-form-urlencoded") ||
    contentType.includes("multipart/form-data")
  ) {
    const formData = await request.formData();
    return Object.fromEntries(formData.entries());
  }

  const text = await request.text();

  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    return { body: text };
  }
}

function getWebhookSecret() {
  return process.env.WABLAS_WEBHOOK_SECRET ?? "";
}

export async function POST(request: NextRequest) {
  const configuredSecret = getWebhookSecret();
  const requestSecret = request.nextUrl.searchParams.get("secret") ?? "";

  if (!configuredSecret || requestSecret !== configuredSecret) {
    return NextResponse.json({ error: "Unauthorized webhook." }, { status: 401 });
  }

  const payload = await parseRequestBody(request);

  if (payload && typeof payload === "object" && ("device" in payload || "member" in payload)) {
    console.log("[wablas webhook] ignored fonnte payload on wablas route");
    return NextResponse.json({
      ok: true,
      ignored: true,
      reason: "fonnte_payload_on_wablas_route"
    });
  }

  const incoming = parseWablasIncomingPayload(payload);

  const normalizedIncoming: NormalizedIncomingWhatsAppMessage = {
    provider: "wablas",
    message: incoming.message || "",
    sender: incoming.sender || "",
    senderName: incoming.senderName || undefined,
    groupId: incoming.groupId || undefined,
    isGroup: incoming.isGroup,
  };

  return executeWhatsAppWebhook(normalizedIncoming, payload);
}
