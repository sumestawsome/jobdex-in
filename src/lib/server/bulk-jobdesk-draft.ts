import "server-only";

import { NextResponse } from "next/server";
import { FieldValue, getAdminDb } from "@/lib/server/firebase-admin";
import { Timestamp } from "firebase-admin/firestore";
import {
  parseBulkJobdeskText,
  parseConversationalDeadlines,
  type ParsedJobdeskTask,
  type SkippedJobdeskTask,
} from "@/lib/server/ai-bulk-jobdesk-parser";
import { getChecklistByTaskName } from "@/lib/server/whatsapp-command-preview";
import { findEventByGroupId } from "@/lib/server/group-routing";
import {
  formatWhatsAppText,
  sendWhatsAppMessage as baseSendWhatsAppMessage,
  getWhatsAppRecipient as getDefaultGroupId,
  isGroupRecipient,
} from "@/lib/server/whatsapp";
import type { Event, NormalizedIncomingWhatsAppMessage, UserProfile } from "@/types";

// ============================================================================
// Types & Constants
// ============================================================================

export interface BulkJobdeskDraft {
  sender: string; // phone number e.g. "6285942520570"
  sender_id?: string;
  sender_name?: string;
  event_id: string;
  event_name: string;
  whatsapp_group_id?: string;
  tasks: ParsedJobdeskTask[];
  skipped_tasks: SkippedJobdeskTask[];
  missing_deadlines_summary?: string;
  coordinator_id?: string;
  coordinator_name?: string;
  coordinator_phone?: string;
  secretary_id?: string;
  secretary_name?: string;
  secretary_phone?: string;
  reply_target: string;
  is_group_target: boolean;
  provider?: string;
  created_at_ms: number;
  expires_at_ms: number;
}

export const BULK_DRAFT_TTL_MS = 15 * 60 * 1000; // 15 menit

const inMemoryBulkDraftMap = new Map<string, BulkJobdeskDraft>();

// ============================================================================
// Phone Normalization Helper
// ============================================================================

export function normalizePhone(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .replace(/@s\.whatsapp\.net$/i, "")
    .replace(/@c\.us$/i, "")
    .replace(/[\s\-\+\(\)]/g, "")
    .replace(/\D/g, "")
    .replace(/^0/, "62")
    .replace(/^8/, "628");
}

// ============================================================================
// Draft Storage Helpers (In-Memory + Firestore)
// ============================================================================

export async function getBulkJobdeskDraft(sender: string): Promise<BulkJobdeskDraft | null> {
  const cleanSender = normalizePhone(sender);
  if (!cleanSender) return null;

  const now = Date.now();

  // 1. Cek cache in-memory
  const memDraft = inMemoryBulkDraftMap.get(cleanSender);
  if (memDraft) {
    if (now > memDraft.expires_at_ms) {
      inMemoryBulkDraftMap.delete(cleanSender);
    } else {
      return memDraft;
    }
  }

  // 2. Cek Firestore collection "whatsapp_bulk_drafts"
  try {
    const db = getAdminDb();
    const docRef = db.collection("whatsapp_bulk_drafts").doc(cleanSender);
    const snap = await docRef.get();
    if (!snap.exists) return null;

    const data = snap.data() as BulkJobdeskDraft;
    if (data.expires_at_ms && now > data.expires_at_ms) {
      await docRef.delete().catch(() => {});
      return null;
    }

    inMemoryBulkDraftMap.set(cleanSender, data);
    return data;
  } catch (err) {
    console.error("[BulkJobdeskDraft] Gagal mengambil draf dari Firestore:", err);
    return null;
  }
}

export async function saveBulkJobdeskDraft(draft: BulkJobdeskDraft): Promise<void> {
  const cleanSender = normalizePhone(draft.sender);
  if (!cleanSender) return;

  draft.expires_at_ms = Date.now() + BULK_DRAFT_TTL_MS;
  inMemoryBulkDraftMap.set(cleanSender, draft);

  try {
    const db = getAdminDb();
    await db.collection("whatsapp_bulk_drafts").doc(cleanSender).set({
      ...draft,
      updated_at: FieldValue.serverTimestamp(),
    });
    console.log(`[BulkJobdeskDraft] Draf berhasil disimpan untuk ${cleanSender}:`, {
      event: draft.event_name,
      total_tasks: draft.tasks.length,
      expires_at: new Date(draft.expires_at_ms).toISOString(),
    });
  } catch (err) {
    console.error("[BulkJobdeskDraft] Gagal menyimpan draf ke Firestore:", err);
  }
}

export async function deleteBulkJobdeskDraft(sender: string): Promise<void> {
  const cleanSender = normalizePhone(sender);
  if (!cleanSender) return;

  inMemoryBulkDraftMap.delete(cleanSender);

  try {
    const db = getAdminDb();
    await db.collection("whatsapp_bulk_drafts").doc(cleanSender).delete().catch(() => {});
    console.log(`[BulkJobdeskDraft] Draf dihapus untuk ${cleanSender}`);
  } catch (err) {
    console.error("[BulkJobdeskDraft] Gagal menghapus draf dari Firestore:", err);
  }
}

/**
 * Mencari draf aktif berdasarkan event ID atau WhatsApp group ID
 * (berguna jika anggota lain dalam kepanitiaan menyetujui draf acara di grup)
 */
export async function findActiveDraftForEventOrGroup(
  eventId?: string,
  groupId?: string
): Promise<BulkJobdeskDraft | null> {
  const now = Date.now();

  // Cek di memory map
  for (const draft of inMemoryBulkDraftMap.values()) {
    if (now <= draft.expires_at_ms) {
      if (eventId && draft.event_id === eventId) return draft;
      if (groupId && draft.whatsapp_group_id === groupId) return draft;
    }
  }

  // Cek di Firestore
  try {
    const db = getAdminDb();
    let queryRef: FirebaseFirestore.Query = db.collection("whatsapp_bulk_drafts");

    if (eventId) {
      queryRef = queryRef.where("event_id", "==", eventId);
    } else if (groupId) {
      queryRef = queryRef.where("whatsapp_group_id", "==", groupId);
    } else {
      return null;
    }

    const snap = await queryRef.limit(1).get();
    if (!snap.empty) {
      const data = snap.docs[0].data() as BulkJobdeskDraft;
      if (data.expires_at_ms && now <= data.expires_at_ms) {
        return data;
      }
    }
  } catch (err) {
    console.warn("[BulkJobdeskDraft] Error querying draft by event/group:", err);
  }

  return null;
}

// ============================================================================
// Event & Context Resolution
// ============================================================================

export async function resolveEventForBulkJobdesk(
  incoming: NormalizedIncomingWhatsAppMessage,
  rawText: string
): Promise<{ event: Event | null; reason?: string }> {
  const db = getAdminDb();

  // A. Jika dikirim di dalam Grup WhatsApp: Cocokkan groupId ke events
  if (incoming.isGroup && incoming.groupId) {
    const matchedEvent = await findEventByGroupId(incoming.groupId);
    if (matchedEvent) {
      console.log(
        `[BulkJobdeskDraft] Event matched by WhatsApp group ${incoming.groupId}:`,
        matchedEvent.name
      );
      return { event: matchedEvent };
    }
  }

  // B. Jika di DM atau grup belum tertaut: periksa teks untuk penyebutan nama acara
  const lowerText = rawText.toLowerCase();

  const eventsSnap = await db
    .collection("events")
    .where("status", "in", ["persiapan", "berlangsung"])
    .get();

  const activeEvents: Event[] = [];
  eventsSnap.forEach((doc) => {
    activeEvents.push({ id: doc.id, ...doc.data() } as Event);
  });

  // Alias / akronim umum acara
  const EVENT_ACRONYMS: Record<string, string[]> = {
    fgs: ["forkom goes to school", "fgs"],
    raker: ["rapat kerja", "raker"],
    pdk: ["pelatihan dasar kepemimpinan", "pdk"],
    mision: ["mision", "misi"],
    stdi: ["stdi"],
    mkmb: ["mkmb"],
  };

  // 1. Cek apakah ada nama acara spesifik atau akronim di dalam teks
  for (const ev of activeEvents) {
    const evName = ev.name.toLowerCase();
    if (lowerText.includes(evName)) {
      return { event: ev };
    }

    // Cek akronim
    for (const [acronym, keywords] of Object.entries(EVENT_ACRONYMS)) {
      if (evName.includes(acronym) || keywords.some((k) => evName.includes(k))) {
        if (keywords.some((k) => lowerText.includes(k))) {
          return { event: ev };
        }
      }
    }
  }

  // 2. Jika tidak disebutkan di teks, gunakan acara terdekat yang berstatus "persiapan"
  const persiapanEvents = activeEvents.filter((e) => e.status === "persiapan");
  if (persiapanEvents.length > 0) {
    // Ambil yang pertama (acara aktif persiapan utama)
    return { event: persiapanEvents[0] };
  }

  if (activeEvents.length > 0) {
    return { event: activeEvents[0] };
  }

  return {
    event: null,
    reason:
      "⚠️ Acara tidak ditemukan. Pastikan Anda mengirim perintah di dalam grup acara atau sebutkan nama acara pada pesan (contoh: *FGS* atau *Forkom Goes to School*).",
  };
}

// ============================================================================
// Authorization Verification
// ============================================================================

export async function verifyBulkJobdeskAuthorization(
  senderPhone: string,
  event: Event
): Promise<{
  authorized: boolean;
  senderProfile?: UserProfile;
  coordinatorProfile?: UserProfile | null;
  secretaryProfile?: UserProfile | null;
  errorMessage?: string;
}> {
  const db = getAdminDb();
  const cleanSender = normalizePhone(senderPhone);

  // 1. Ambil profil user pengirim dari Firestore
  const usersSnap = await db.collection("users").get();
  let senderProfile: UserProfile | null = null;
  let coordinatorProfile: UserProfile | null = null;
  let secretaryProfile: UserProfile | null = null;

  usersSnap.forEach((doc) => {
    const u = { id: doc.id, ...doc.data() } as UserProfile;
    const uPhone = normalizePhone(u.whatsapp_number);

    if (
      uPhone &&
      (uPhone === cleanSender ||
        (cleanSender.length >= 9 && uPhone.endsWith(cleanSender.slice(-9))) ||
        (uPhone.length >= 9 && cleanSender.endsWith(uPhone.slice(-9))))
    ) {
      senderProfile = u;
    }

    if (event.coordinator_id && u.id === event.coordinator_id) {
      coordinatorProfile = u;
    }

    if (event.secretary_id && u.id === event.secretary_id) {
      secretaryProfile = u;
    }
  });

  if (!senderProfile) {
    return {
      authorized: false,
      errorMessage: `⚠️ Nomor WhatsApp Anda (*${cleanSender}*) belum terdaftar sebagai anggota resmi di JobDex.in.`,
    };
  }

  const senderUser = senderProfile as UserProfile;

  if (senderUser.is_active === false) {
    return {
      authorized: false,
      senderProfile: senderUser,
      errorMessage: "⚠️ Akun Anda dinonaktifkan di sistem JobDex.in.",
    };
  }

  // Jika sekretaris belum ditemukan dari field event.secretary_id, cari di subcollection event_members
  if (!secretaryProfile && event.id) {
    try {
      const emSnap = await db
        .collection("events")
        .doc(event.id)
        .collection("event_members")
        .get();

      for (const emDoc of emSnap.docs) {
        const emData = emDoc.data();
        const roleInEvent = (emData.role_in_event || "").toLowerCase();
        if (roleInEvent.includes("sekretaris")) {
          const secUserId = emData.user_id || emDoc.id;
          const secSnap = await db.collection("users").doc(secUserId).get();
          if (secSnap.exists) {
            secretaryProfile = { id: secSnap.id, ...secSnap.data() } as UserProfile;
            break;
          }
        }
      }
    } catch (err) {
      console.warn("[BulkJobdeskDraft] Gagal mencari sekretaris di event_members:", err);
    }
  }

  // 2. Validasi Otorisasi: Super Admin, Koordinator Acara, atau Sekretaris Acara
  const isSuperAdmin = senderUser.role === "super_admin";
  const isCoordinator =
    Boolean(event.coordinator_id && senderUser.id === event.coordinator_id) ||
    senderUser.role === "koordinator_acara";
  const isSecretary =
    Boolean(event.secretary_id && senderUser.id === event.secretary_id);

  let isMemberSecretary = false;
  if (!isSuperAdmin && !isCoordinator && !isSecretary && event.id) {
    try {
      const memberDoc = await db
        .collection("events")
        .doc(event.id)
        .collection("event_members")
        .doc(senderUser.id)
        .get();

      if (memberDoc.exists) {
        const role = (memberDoc.data()?.role_in_event || "").toLowerCase();
        if (role.includes("sekretaris") || role.includes("koordinator")) {
          isMemberSecretary = true;
        }
      }
    } catch {
      // ignore
    }
  }

  const isAuthorized = isSuperAdmin || isCoordinator || isSecretary || isMemberSecretary;

  if (!isAuthorized) {
    return {
      authorized: false,
      senderProfile: senderUser,
      coordinatorProfile,
      secretaryProfile,
      errorMessage: `⛔ *Akses Ditolak*\nPerintah pembuatan bulk jobdesk hanya dapat dijalankan oleh *Super Admin*, *Koordinator Acara*, atau *Sekretaris Acara* (*${event.name}*).`,
    };
  }

  return {
    authorized: true,
    senderProfile: senderUser,
    coordinatorProfile,
    secretaryProfile,
  };
}

// ============================================================================
// Message Formatting Helpers
// ============================================================================

/**
 * Menghasilkan kartu pratinjau draf WhatsApp sesuai SOP AGENT_RULES.md
 */
export function formatBulkJobdeskPreviewMessage(draft: BulkJobdeskDraft): string {
  const lines: string[] = [];

  // 1. Header
  lines.push(`📋 *DRAF JOBDESK ACARA: ${draft.event_name}*`);
  lines.push(`Ditemukan *${draft.tasks.length} jobdesk* yang siap dimasukkan:\n`);

  // 2. Daftar Tugas
  draft.tasks.forEach((t, idx) => {
    const picDisplay =
      t.pic_names && t.pic_names.length > 0
        ? t.pic_names.join(", ")
        : "⚠️ Belum ditentukan";
    const deadlineDisplay = t.deadline ? t.deadline : "⚠️ Belum ditentukan";
    const priorityDisplay = t.priority || "sedang";

    lines.push(`${idx + 1}. *${t.name}*`);
    lines.push(`   👤 PIC: ${picDisplay}`);
    lines.push(`   ⚡ Prioritas: ${priorityDisplay}`);
    lines.push(`   ⏰ Tenggat: ${deadlineDisplay}\n`);
  });

  // 3. Tugas Hari H (Operasional yang Dilewati)
  if (draft.skipped_tasks && draft.skipped_tasks.length > 0) {
    lines.push("ℹ️ *Tugas Hari H (Tidak masuk checklist deadline):*");
    draft.skipped_tasks.forEach((s) => {
      lines.push(`- ${s.raw_text} (${s.reason || "Dijalankan saat hari H"})`);
    });
    lines.push("");
  }

  // 4. Tagging Koordinator & Sekretaris jika Deadline Kosong
  const hasMissingDeadline = draft.tasks.some((t) => !t.deadline || t.requires_deadline);

  if (hasMissingDeadline) {
    const koorPhoneClean = normalizePhone(draft.coordinator_phone);
    const sekrePhoneClean = normalizePhone(draft.secretary_phone);

    const koorMention = koorPhoneClean ? `@${koorPhoneClean}` : "Koordinator";
    const sekreMention = sekrePhoneClean ? `@${sekrePhoneClean}` : "Sekretaris";
    const koorName = draft.coordinator_name || "Koordinator";
    const sekreName = draft.secretary_name || "Sekretaris";

    lines.push("⚠️ *Perhatian Koordinator & Sekretaris:*");
    lines.push(
      `Halo ${koorMention} (${koorName}) & ${sekreMention} (${sekreName}), daftar tugas di atas belum memiliki tenggat waktu!`
    );
    lines.push("Silakan balas chat ini untuk mengisi tenggat (contoh: *1 tenggat 5 Nov 20:00, 2 tenggat 8 Nov*).\n");
    lines.push("👉 Ketik *!jobdesk acc* untuk menerbitkan semua tugas (wajib ada deadline).");
    lines.push("👉 Ketik *!jobdesk acc paksa* jika ingin tetap menerbitkan tanpa deadline.");
    lines.push("👉 Ketik *!jobdesk batal* untuk membatalkan draf.");
  } else {
    // 5. Action Call (Semua tugas sudah ada deadline)
    lines.push("👉 Ketik *!jobdesk acc* untuk langsung menerbitkan semua tugas ini ke JobDex.");
    lines.push("👉 Ketik *!jobdesk batal* untuk membatalkan draf.");
  }

  return formatWhatsAppText(lines.join("\n"));
}

// ============================================================================
// Command Handlers: !jobdesk tambah, !jobdesk acc, !jobdesk batal
// ============================================================================

/**
 * Mengekstrak teks daftar jobdesk setelah perintah !jobdesk tambah / input
 */
export function extractBulkJobdeskText(commandMessage: string): string {
  const clean = commandMessage.trim();
  const match = clean.match(
    /^(?:[!/])?(?:jobde[xs]|jobdesk|jobdes)\s+(?:tambah|input)[\s:\r\n]*([\s\S]*)$/i
  );
  if (match && match[1]) {
    return match[1].trim();
  }
  return "";
}

/**
 * Handler utama untuk perintah !jobdesk tambah <teks>
 */
export async function handleBulkJobdeskTambahCommand(
  incoming: NormalizedIncomingWhatsAppMessage,
  commandText: string
): Promise<NextResponse> {
  const replyTarget = incoming.isGroup
    ? incoming.groupId || getDefaultGroupId()
    : incoming.sender || incoming.groupId || getDefaultGroupId();
  const isGroupTarget = incoming.isGroup || isGroupRecipient(replyTarget);

  // 1. Ekstrak multiline teks
  const rawJobdeskText = extractBulkJobdeskText(commandText);

  if (!rawJobdeskText) {
    const helpMsg = [
      "ℹ️ *Format Perintah Jobdesk Tambah*",
      "Ketik *!jobdesk tambah* diikuti daftar tugas panitia (bisa copy-paste langsung dari pengumuman grup).\n",
      "*Contoh:*",
      "!jobdesk tambah",
      "1. Membuat pamflet FGS (Kak Wardana)",
      "2. Menyusun rancangan anggaran biaya kegiatan (Kak Darma, Kak agus)",
      "3. Mengoperasikan peralatan teknis saat kegiatan (Ipang)",
      "4. Mendesain virtual background dan piagam (Kak Cici)",
      "5. Edit video recap dokumentasi setelah acara selesai (Kak Sila, Anin)",
    ].join("\n");

    await baseSendWhatsAppMessage({
      target: replyTarget,
      message: formatWhatsAppText(helpMsg),
      type: isGroupTarget ? "group" : "phone",
      provider: incoming.provider,
    });

    return NextResponse.json({ ok: true, status: "help_message_sent" });
  }

  // 2. Resolusi Acara & Konteks
  const eventResolution = await resolveEventForBulkJobdesk(incoming, rawJobdeskText);
  if (!eventResolution.event) {
    const errorMsg =
      eventResolution.reason ||
      "⚠️ Acara tidak dapat ditemukan. Pastikan Anda mengirim perintah di dalam grup acara atau sebutkan nama acara pada teks.";

    await baseSendWhatsAppMessage({
      target: replyTarget,
      message: formatWhatsAppText(errorMsg),
      type: isGroupTarget ? "group" : "phone",
      provider: incoming.provider,
    });

    return NextResponse.json({ ok: true, status: "event_not_found" });
  }

  const event = eventResolution.event;

  // 3. Validasi Otorisasi
  const authResult = await verifyBulkJobdeskAuthorization(incoming.sender, event);
  if (!authResult.authorized) {
    const rejectMsg =
      authResult.errorMessage ||
      `⛔ *Akses Ditolak*\nAnda tidak memiliki izin mengelola kepanitiaan acara *${event.name}*.`;

    await baseSendWhatsAppMessage({
      target: replyTarget,
      message: formatWhatsAppText(rejectMsg),
      type: isGroupTarget ? "group" : "phone",
      provider: incoming.provider,
    });

    return NextResponse.json({ ok: true, status: "unauthorized" });
  }

  // 4. Parsing menggunakan AI Bulk Jobdesk Parser
  let parseResult;
  try {
    parseResult = await parseBulkJobdeskText(rawJobdeskText, event.id, event.division_id);
  } catch (parseErr) {
    console.error("[BulkJobdeskDraft] Gagal parseBulkJobdeskText:", parseErr);
    await baseSendWhatsAppMessage({
      target: replyTarget,
      message: formatWhatsAppText(
        "⚠️ Terjadi kendala saat memproses daftar tugas dengan AI. Coba periksa kembali format teks tugas."
      ),
      type: isGroupTarget ? "group" : "phone",
      provider: incoming.provider,
    });
    return NextResponse.json({ ok: false, error: "ai_parser_error" });
  }

  if (parseResult.tasks.length === 0) {
    const noTasksMsg = [
      `⚠️ *Tidak Ada Jobdesk Pra/Pasca Acara yang Terdeteksi*`,
      `Seluruh poin tugas yang diberikan terdeteksi sebagai operasional hari H atau tidak teridentifikasi.`,
      parseResult.skipped_tasks.length > 0
        ? `\n*Tugas hari H yang dilewati:*\n` +
          parseResult.skipped_tasks.map((s) => `- ${s.raw_text}`).join("\n")
        : "",
    ].join("\n");

    await baseSendWhatsAppMessage({
      target: replyTarget,
      message: formatWhatsAppText(noTasksMsg),
      type: isGroupTarget ? "group" : "phone",
      provider: incoming.provider,
    });

    return NextResponse.json({ ok: true, status: "zero_tasks_extracted" });
  }

  // 5. Simpan Draf Massal ke Firestore whatsapp_bulk_drafts/{senderNumber}
  const cleanSenderPhone = normalizePhone(incoming.sender);
  const draft: BulkJobdeskDraft = {
    sender: cleanSenderPhone,
    sender_id: authResult.senderProfile?.id,
    sender_name: authResult.senderProfile?.name || "Panitia",
    event_id: event.id,
    event_name: event.name,
    whatsapp_group_id: event.whatsapp_group_id || incoming.groupId || "",
    tasks: parseResult.tasks,
    skipped_tasks: parseResult.skipped_tasks,
    missing_deadlines_summary: parseResult.missing_deadlines_summary,
    coordinator_id: event.coordinator_id,
    coordinator_name: authResult.coordinatorProfile?.name || "",
    coordinator_phone: authResult.coordinatorProfile?.whatsapp_number || "",
    secretary_id: event.secretary_id,
    secretary_name: authResult.secretaryProfile?.name || "",
    secretary_phone: authResult.secretaryProfile?.whatsapp_number || "",
    reply_target: replyTarget,
    is_group_target: isGroupTarget,
    provider: incoming.provider,
    created_at_ms: Date.now(),
    expires_at_ms: Date.now() + BULK_DRAFT_TTL_MS,
  };

  await saveBulkJobdeskDraft(draft);

  // 6. Kirim Kartu Pratinjau (Preview Card)
  const previewCardMessage = formatBulkJobdeskPreviewMessage(draft);

  await baseSendWhatsAppMessage({
    target: replyTarget,
    message: previewCardMessage,
    type: isGroupTarget ? "group" : "phone",
    provider: incoming.provider,
  });

  return NextResponse.json({
    ok: true,
    status: "bulk_draft_created",
    total_extracted: parseResult.total_extracted,
  });
}

/**
 * Handler utama untuk eksekusi persetujuan draf: !jobdesk acc
 */
export async function handleBulkJobdeskAccCommand(
  incoming: NormalizedIncomingWhatsAppMessage,
  isForceAcc = false
): Promise<NextResponse> {
  const replyTarget = incoming.isGroup
    ? incoming.groupId || getDefaultGroupId()
    : incoming.sender || incoming.groupId || getDefaultGroupId();
  const isGroupTarget = incoming.isGroup || isGroupRecipient(replyTarget);

  const cleanSender = normalizePhone(incoming.sender);

  // 1. Ambil draf aktif pengirim (atau draf aktif grup/acara jika dikirim di grup)
  let activeDraft = await getBulkJobdeskDraft(cleanSender);
  if (!activeDraft && incoming.isGroup && incoming.groupId) {
    activeDraft = await findActiveDraftForEventOrGroup(undefined, incoming.groupId);
  }

  if (!activeDraft) {
    await baseSendWhatsAppMessage({
      target: replyTarget,
      message: formatWhatsAppText(
        "⚠️ Tidak ada draf jobdesk acara yang sedang menunggu persetujuan. Kirim *!jobdesk tambah <teks>* untuk membuat draf baru."
      ),
      type: isGroupTarget ? "group" : "phone",
      provider: incoming.provider,
    });
    return NextResponse.json({ ok: true, status: "no_active_draft" });
  }

  // 2. Proteksi ACC Tanpa Tenggat Waktu (Kecuali jika ACC Paksa)
  const hasMissingDeadline = activeDraft.tasks.some(
    (t) => !t.deadline || t.deadline.trim() === "" || t.requires_deadline
  );

  if (hasMissingDeadline && !isForceAcc) {
    const warningLines = [
      "⚠️ *Jobdesk Belum Memiliki Tenggat Waktu!*",
      "",
      `Masih terdapat tugas dalam draf *${activeDraft.event_name}* yang belum ditentukan tenggat waktunya. Koordinator atau Sekretaris wajib menentukan deadline agar tugas terpantau oleh sistem pengingat otomatis.`,
      "",
      "💡 *Cara mengisi deadline susulan:*",
      "Balas chat ini dengan format nomor tugas dan tenggatnya, contoh:",
      "*1 tenggat 5 Nov 20:00, 2 tenggat 8 Nov*",
      "",
      "👉 Atau jika memang ingin menerbitkan tugas tanpa deadline sekarang, ketik:",
      "*!jobdesk acc paksa*",
    ];

    await baseSendWhatsAppMessage({
      target: replyTarget,
      message: formatWhatsAppText(warningLines.join("\n")),
      type: isGroupTarget ? "group" : "phone",
      provider: incoming.provider,
    });

    return NextResponse.json({
      ok: true,
      status: "blocked_missing_deadlines",
      message: "ACC ditolak karena masih ada tugas tanpa deadline. Gunakan acc paksa untuk override.",
    });
  }

  const db = getAdminDb();

  // 3. Ambil data acara terbaru untuk memastikan penanda organisasi & kampus
  let eventData: Event | null = null;
  try {
    const eventSnap = await db.collection("events").doc(activeDraft.event_id).get();
    if (eventSnap.exists) {
      eventData = { id: eventSnap.id, ...eventSnap.data() } as Event;
    }
  } catch (err) {
    console.warn("[BulkJobdeskDraft] Gagal mengambil data acara saat ACC:", err);
  }

  // 4. Kumpulkan profil user untuk nomor WhatsApp mention PIC
  const allPicIds = Array.from(new Set(activeDraft.tasks.flatMap((t) => t.pic_ids || [])));
  const picUserMap = new Map<string, UserProfile>();
  if (allPicIds.length > 0) {
    try {
      const usersSnap = await db.collection("users").get();
      usersSnap.forEach((uDoc) => {
        if (allPicIds.includes(uDoc.id)) {
          picUserMap.set(uDoc.id, { id: uDoc.id, ...uDoc.data() } as UserProfile);
        }
      });
    } catch (err) {
      console.warn("[BulkJobdeskDraft] Gagal mengambil profil PIC:", err);
    }
  }

  const mentionedPhones = new Set<string>();

  // 5. Batch Write: Buat dokumen tugas secara massal di koleksi "tasks"
  const batch = db.batch();
  const createdTaskSummaries: Array<{ name: string; pic: string; deadline: string }> = [];

  for (const t of activeDraft.tasks) {
    const taskRef = db.collection("tasks").doc();
    const primaryPicId = t.pic_ids && t.pic_ids.length > 0 ? t.pic_ids[0] : "";

    const picDisplays: string[] = [];
    if (t.pic_ids && t.pic_ids.length > 0) {
      for (const pId of t.pic_ids) {
        const u = picUserMap.get(pId);
        const cleanP = normalizePhone(u?.whatsapp_number);
        if (cleanP && cleanP.length > 5) {
          mentionedPhones.add(cleanP);
          picDisplays.push(`@${cleanP} (${u?.name || "PIC"})`);
        } else if (u?.name) {
          picDisplays.push(u.name);
        }
      }
    }
    if (picDisplays.length === 0 && t.pic_names && t.pic_names.length > 0) {
      picDisplays.push(...t.pic_names);
    }
    const picDisplayStr = picDisplays.length > 0 ? picDisplays.join(", ") : "-";

    let deadlineDate: Date | null = null;
    if (t.deadline) {
      deadlineDate = new Date(`${t.deadline}T23:59:59+08:00`);
      if (isNaN(deadlineDate.getTime())) {
        deadlineDate = new Date(t.deadline);
      }
    }

    const taskPayload = {
      id: taskRef.id,
      organization_id: eventData?.organization_id || "main_org",
      org_id: eventData?.org_id || eventData?.organization_id || "main_org",
      orgId: eventData?.orgId || eventData?.organization_id || "main_org",
      campus_id: eventData?.campus_id || eventData?.univ_id || "",
      campusId: eventData?.campusId || eventData?.campus_id || "",
      univ_id: eventData?.univ_id || eventData?.campus_id || "",
      univId: eventData?.univId || eventData?.univ_id || "",
      type: "acara",
      division_id: eventData?.division_id || "",
      event_id: activeDraft.event_id,
      name: t.name,
      title: t.name,
      description: "",
      pic_id: primaryPicId,
      pic_ids: t.pic_ids,
      pic_names: t.pic_names,
      coordinator_id: eventData?.coordinator_id || activeDraft.sender_id || "",
      deadline: deadlineDate ? Timestamp.fromDate(deadlineDate) : null,
      status: "belum_dimulai",
      priority: t.priority || "sedang",
      stage: t.stage || "pra_acara",
      copywriting: "",
      copywriting_docs_url: "",
      design_reference_url: "",
      drive_reference_url: "",
      color_palette: [],
      visual_direction: "",
      revision_notes: "",
      stuck_notes: "",
      result_design_url: "",
      approval_status: "pending",
      is_archived: false,
      created_by: activeDraft.sender_id || activeDraft.sender,
      created_at: FieldValue.serverTimestamp(),
      updated_at: FieldValue.serverTimestamp(),
      checklist_items: getChecklistByTaskName(t.name),
    };

    batch.set(taskRef, taskPayload);

    // Initial status log
    const logRef = taskRef.collection("status_logs").doc();
    batch.set(logRef, {
      id: logRef.id,
      task_id: taskRef.id,
      previous_status: null,
      new_status: "belum_dimulai",
      notes: "Tugas diterbitkan melalui WhatsApp AI Bulk Jobdesk",
      changed_by: activeDraft.sender_id || activeDraft.sender,
      changed_at: FieldValue.serverTimestamp(),
    });

    createdTaskSummaries.push({
      name: t.name,
      pic: picDisplayStr,
      deadline: t.deadline || "Belum ditentukan",
    });
  }

  // 6. Eksekusi Batch Firestore
  await batch.commit();

  // 7. Hapus Draf setelah Berhasil Diterbitkan
  await deleteBulkJobdeskDraft(activeDraft.sender);

  // 8. Format Siaran / Notifikasi Pengumuman Resmi ke Grup Acara
  const celebrationMessageLines = [
    `🚀 *JOBDESK ACARA RESMI DITERBITKAN: ${activeDraft.event_name.toUpperCase()}*`,
    `Telah diterbitkan *${createdTaskSummaries.length} tugas kepanitiaan baru* oleh *${activeDraft.sender_name || "Admin"}*:\n`,
    ...createdTaskSummaries.map(
      (item, idx) =>
        `${idx + 1}. *${item.name}*\n   👤 PIC: ${item.pic}\n   ⏰ Tenggat: ${item.deadline}`
    ),
    "",
    "🙌 *Semangat bertugas rekan-rekan panitia!*",
    "Mari bersama-sama mengawal persiapan acara ini agar berjalan sukses dan lancar.",
    "",
    "👉 Pantau dan perbarui progres tugas di:",
    "https://jobdexin.sumestawsome.xyz/dashboard/tasks",
    "",
    "Ketik *!jobdesk summary* untuk memantau detail tugas via WhatsApp.",
  ];

  const celebrationMessage = formatWhatsAppText(celebrationMessageLines.join("\n"));
  const mentionsList = Array.from(mentionedPhones);
  const eventGroupId = activeDraft.whatsapp_group_id || eventData?.whatsapp_group_id;

  if (isGroupTarget) {
    // A. Perintah dijalankan di grup WhatsApp
    await baseSendWhatsAppMessage({
      target: replyTarget,
      message: celebrationMessage,
      type: "group",
      mentions: mentionsList,
      provider: incoming.provider,
    });
  } else {
    // B. Perintah dijalankan di DM
    const dmReply = [
      `✅ *${createdTaskSummaries.length} Jobdesk Acara Berhasil Diterbitkan!*`,
      `Seluruh tugas untuk *${activeDraft.event_name}* kini telah tersimpan aktif di JobDex.in dan disiarkan ke grup panitia.`,
      "",
      "👉 Cek dashboard: https://jobdexin.sumestawsome.xyz/dashboard/tasks",
    ].join("\n");

    await baseSendWhatsAppMessage({
      target: replyTarget,
      message: formatWhatsAppText(dmReply),
      type: "phone",
      provider: incoming.provider,
    });

    if (eventGroupId) {
      try {
        await baseSendWhatsAppMessage({
          target: eventGroupId,
          message: celebrationMessage,
          type: "group",
          mentions: mentionsList,
          provider: incoming.provider,
        });
      } catch (broadcastErr) {
        console.warn("[BulkJobdeskDraft] Gagal menyiarkan ke grup acara:", broadcastErr);
      }
    }
  }

  return NextResponse.json({
    ok: true,
    status: "bulk_tasks_published",
    count: createdTaskSummaries.length,
  });
}

/**
 * Handler pesan balasan/susulan tenggat waktu dari koordinator/sekretaris
 */
export async function handleBulkJobdeskDeadlineFollowUp(
  incoming: NormalizedIncomingWhatsAppMessage,
  rawText: string,
  activeDraft: BulkJobdeskDraft
): Promise<NextResponse | null> {
  const replyTarget = incoming.isGroup
    ? incoming.groupId || getDefaultGroupId()
    : incoming.sender || incoming.groupId || getDefaultGroupId();
  const isGroupTarget = incoming.isGroup || isGroupRecipient(replyTarget);

  const updates = await parseConversationalDeadlines(rawText, activeDraft.tasks);

  if (updates.length === 0) {
    if (incoming.isGroup) {
      return null;
    }

    const lower = rawText.toLowerCase();
    if (
      lower.includes("tenggat") ||
      lower.includes("deadline") ||
      lower.includes("tgl") ||
      lower.includes("tanggal")
    ) {
      const hintMsg = [
        "⚠️ *Format Tenggat Waktu Belum Terbaca*",
        "Silakan balas dengan format nomor tugas dan tanggal tenggatnya.",
        "",
        "*Contoh:*",
        "1 tenggat 5 Nov 20:00, 2 tenggat 8 Nov",
        "",
        "Atau jika ingin menetapkan tanggal yang sama untuk semua tugas:",
        "semua tenggat 10 Nov",
      ].join("\n");

      await baseSendWhatsAppMessage({
        target: replyTarget,
        message: formatWhatsAppText(hintMsg),
        type: "phone",
        provider: incoming.provider,
      });

      return NextResponse.json({ ok: true, status: "deadline_format_hint_sent" });
    }

    return null;
  }

  // Terapkan update deadline ke draf
  for (const up of updates) {
    const taskIdx = up.task_index - 1;
    if (taskIdx >= 0 && taskIdx < activeDraft.tasks.length) {
      activeDraft.tasks[taskIdx].deadline = up.deadline;
      activeDraft.tasks[taskIdx].requires_deadline = false;
    }
  }

  const missingCount = activeDraft.tasks.filter((t) => !t.deadline).length;
  if (missingCount === 0) {
    activeDraft.missing_deadlines_summary = "Seluruh tugas telah memiliki tenggat waktu.";
  } else {
    activeDraft.missing_deadlines_summary = `Terdapat ${missingCount} tugas yang belum memiliki tenggat waktu.`;
  }

  await saveBulkJobdeskDraft(activeDraft);

  const updatedPreview = formatBulkJobdeskPreviewMessage(activeDraft);
  const responseMsg = [
    `✅ *Tenggat Waktu Berhasil Diperbarui!*`,
    `Berhasil memperbarui deadline untuk *${updates.length} tugas*.\n`,
    updatedPreview,
  ].join("\n");

  await baseSendWhatsAppMessage({
    target: replyTarget,
    message: responseMsg,
    type: isGroupTarget ? "group" : "phone",
    provider: incoming.provider,
  });

  return NextResponse.json({
    ok: true,
    status: "bulk_draft_deadlines_updated",
    updated_count: updates.length,
  });
}

/**
 * Handler utama untuk pembatalan draf: !jobdesk batal
 */
export async function handleBulkJobdeskBatalCommand(
  incoming: NormalizedIncomingWhatsAppMessage
): Promise<NextResponse> {
  const replyTarget = incoming.isGroup
    ? incoming.groupId || getDefaultGroupId()
    : incoming.sender || incoming.groupId || getDefaultGroupId();
  const isGroupTarget = incoming.isGroup || isGroupRecipient(replyTarget);

  const cleanSender = normalizePhone(incoming.sender);

  let activeDraft = await getBulkJobdeskDraft(cleanSender);
  if (!activeDraft && incoming.isGroup && incoming.groupId) {
    activeDraft = await findActiveDraftForEventOrGroup(undefined, incoming.groupId);
  }

  if (activeDraft) {
    await deleteBulkJobdeskDraft(activeDraft.sender);
    await baseSendWhatsAppMessage({
      target: replyTarget,
      message: formatWhatsAppText("🗑️ Draf jobdesk acara berhasil dibatalkan dan dihapus."),
      type: isGroupTarget ? "group" : "phone",
      provider: incoming.provider,
    });
    return NextResponse.json({ ok: true, status: "bulk_draft_cancelled" });
  }

  await baseSendWhatsAppMessage({
    target: replyTarget,
    message: formatWhatsAppText("ℹ️ Tidak ada draf jobdesk acara yang aktif untuk dibatalkan."),
    type: isGroupTarget ? "group" : "phone",
    provider: incoming.provider,
  });

  return NextResponse.json({ ok: true, status: "no_draft_to_cancel" });
}
