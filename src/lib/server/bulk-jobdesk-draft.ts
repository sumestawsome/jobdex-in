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
import type { Event, NormalizedIncomingWhatsAppMessage, UserProfile, Task } from "@/types";

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
  const matchedUsers: UserProfile[] = [];
  let coordinatorProfile: UserProfile | null = null;
  let secretaryProfile: UserProfile | null = null;

  usersSnap.forEach((doc) => {
    const uAny = doc.data() as Record<string, unknown>;
    const u = { id: doc.id, ...uAny } as UserProfile;
    const phonesToCheck = [
      u.whatsapp_number,
      uAny.whatsapp,
      uAny.phone,
      uAny.phone_number,
    ]
      .filter(Boolean)
      .map((p) => normalizePhone(String(p)));

    const isMatch = phonesToCheck.some(
      (p) =>
        p === cleanSender ||
        (cleanSender.length >= 9 && p.endsWith(cleanSender.slice(-9))) ||
        (p.length >= 9 && cleanSender.endsWith(p.slice(-9)))
    );

    if (isMatch) {
      matchedUsers.push(u);
    }

    if (event.coordinator_id && u.id === event.coordinator_id) {
      coordinatorProfile = u;
    }

    if (event.secretary_id && u.id === event.secretary_id) {
      secretaryProfile = u;
    }
  });

  const superAdminUser = matchedUsers.find((u) => {
    const uAny = u as Record<string, unknown>;
    const role = (u.role || "").toString().toLowerCase().trim();
    return (
      role === "super_admin" ||
      role === "superadmin" ||
      role === "admin" ||
      uAny.is_super_admin === true
    );
  });
  const isSuperAdmin = Boolean(superAdminUser);

  console.log("[BulkJobdesk Auth]", {
    senderPhone,
    matchedCount: matchedUsers.length,
    isSuperAdmin,
  });

  if (matchedUsers.length === 0) {
    return {
      authorized: false,
      errorMessage: `⚠️ Nomor WhatsApp Anda (*${cleanSender}*) belum terdaftar sebagai anggota resmi di JobDex.in.`,
    };
  }

  // Jika salah satu profil yang cocok adalah Super Admin, langsung berikan izin (bypass otorisasi)
  if (isSuperAdmin && superAdminUser) {
    if (superAdminUser.is_active === false) {
      return {
        authorized: false,
        senderProfile: superAdminUser,
        errorMessage: "⚠️ Akun Anda dinonaktifkan di sistem JobDex.in.",
      };
    }
    return {
      authorized: true,
      senderProfile: superAdminUser,
      coordinatorProfile,
      secretaryProfile,
    };
  }

  const activeMatchedUsers = matchedUsers.filter((u) => u.is_active !== false);
  if (activeMatchedUsers.length === 0) {
    return {
      authorized: false,
      senderProfile: matchedUsers[0],
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

  // 2. Validasi Otorisasi jika bukan Super Admin: Koordinator Acara atau Sekretaris Acara
  let authorizedProfile: UserProfile | null = null;

  for (const senderUser of activeMatchedUsers) {
    const isCoordinator =
      Boolean(event.coordinator_id && senderUser.id === event.coordinator_id) ||
      senderUser.role === "koordinator_acara";
    const isSecretary =
      Boolean(event.secretary_id && senderUser.id === event.secretary_id);

    if (isCoordinator || isSecretary) {
      authorizedProfile = senderUser;
      break;
    }

    if (event.id) {
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
            authorizedProfile = senderUser;
            break;
          }
        }
      } catch {
        // ignore
      }
    }
  }

  if (authorizedProfile) {
    return {
      authorized: true,
      senderProfile: authorizedProfile,
      coordinatorProfile,
      secretaryProfile,
    };
  }

  return {
    authorized: false,
    senderProfile: activeMatchedUsers[0],
    coordinatorProfile,
    secretaryProfile,
    errorMessage: `⛔ *Akses Ditolak*\nPerintah pembuatan bulk jobdesk hanya dapat dijalankan oleh *Super Admin*, *Koordinator Acara*, atau *Sekretaris Acara* (*${event.name}*).`,
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
    lines.push("Silakan balas chat ini untuk mengisi tenggat (format: *[nomor] tenggat [tanggal/jam]*).\n");
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

  // 5. Direct Save: Buat dokumen tugas secara massal di koleksi "tasks" (Tanpa Draf)
  const db = getAdminDb();
  const allPicIds = Array.from(new Set(parseResult.tasks.flatMap((t) => t.pic_ids || [])));
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
  const batch = db.batch();
  const createdTasksSummary: Array<{
    name: string;
    picDisplay: string;
    deadlineDisplay: string;
    checklistCount: number;
    hasDeadline: boolean;
  }> = [];

  for (const t of parseResult.tasks) {
    const taskRef = db.collection("tasks").doc();
    const primaryPicId = t.pic_ids && t.pic_ids.length > 0 ? t.pic_ids[0] : "";

    const picDisplays: string[] = [];
    if (t.pic_ids && t.pic_ids.length > 0) {
      for (const pId of t.pic_ids) {
        const u = picUserMap.get(pId);
        const uAny = u as Record<string, unknown> | undefined;
        const cleanP = normalizePhone(
          u?.whatsapp_number || (uAny?.whatsapp as string) || (uAny?.phone as string)
        );
        if (cleanP && cleanP.length > 5) {
          mentionedPhones.add(cleanP);
          picDisplays.push(`@${cleanP}${u?.name ? ` (${u.name})` : ""}`);
        } else if (u?.name) {
          picDisplays.push(u.name);
        }
      }
    }
    if (picDisplays.length === 0 && t.pic_names && t.pic_names.length > 0) {
      picDisplays.push(...t.pic_names);
    }
    const picDisplayStr = picDisplays.length > 0 ? picDisplays.join(", ") : "Belum ditentukan";

    let deadlineTimestamp: Timestamp | null = null;
    let deadlineDisplay = "⚠️ Belum ditentukan";
    let hasDeadline = false;

    if (t.deadline && t.deadline.trim()) {
      let deadlineDate: Date | null = null;
      if (t.deadline.includes("T")) {
        deadlineDate = new Date(t.deadline);
      } else if (t.deadline.includes(" ")) {
        deadlineDate = new Date(t.deadline.replace(" ", "T") + "+08:00");
      } else {
        deadlineDate = new Date(`${t.deadline}T23:59:59+08:00`);
      }

      if (isNaN(deadlineDate.getTime())) {
        deadlineDate = new Date(t.deadline);
      }

      if (!isNaN(deadlineDate.getTime())) {
        deadlineTimestamp = Timestamp.fromDate(deadlineDate);
        const formatted = formatDeadlineDisplay(t.deadline);
        deadlineDisplay = formatted === "Belum ditentukan" ? "Belum ditentukan" : `${formatted} WITA`;
        hasDeadline = true;
      }
    }

    const checklistItems = getChecklistByTaskName(t.name);

    const taskPayload = {
      id: taskRef.id,
      organization_id: event.organization_id || "main_org",
      org_id: event.org_id || event.organization_id || "main_org",
      orgId: event.orgId || event.organization_id || "main_org",
      campus_id: event.campus_id || event.univ_id || "",
      campusId: event.campusId || event.campus_id || "",
      univ_id: event.univ_id || event.campus_id || "",
      univId: event.univId || event.univ_id || "",
      type: "acara",
      division_id: event.division_id || "",
      event_id: event.id,
      name: t.name,
      title: t.name,
      description: "",
      pic_id: primaryPicId,
      pic_ids: t.pic_ids || [],
      pic_names: t.pic_names || [],
      coordinator_id: event.coordinator_id || authResult.senderProfile?.id || "",
      deadline: deadlineTimestamp,
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
      created_by: authResult.senderProfile?.id || incoming.sender,
      created_at: FieldValue.serverTimestamp(),
      updated_at: FieldValue.serverTimestamp(),
      checklist_items: checklistItems,
    };

    batch.set(taskRef, taskPayload);

    // Initial status log
    const logRef = taskRef.collection("status_logs").doc();
    batch.set(logRef, {
      id: logRef.id,
      task_id: taskRef.id,
      previous_status: null,
      new_status: "belum_dimulai",
      notes: "Tugas diterbitkan otomatis melalui WhatsApp AI Bulk Jobdesk (Direct Save)",
      changed_by: authResult.senderProfile?.id || incoming.sender,
      changed_at: FieldValue.serverTimestamp(),
    });

    createdTasksSummary.push({
      name: t.name,
      picDisplay: picDisplayStr,
      deadlineDisplay,
      checklistCount: checklistItems.length,
      hasDeadline,
    });
  }

  // Bersihkan draf lama jika ada
  await deleteBulkJobdeskDraft(incoming.sender);

  // Commit batch ke Firestore
  await batch.commit();

  // 6. Format Siaran Resmi Jobdesk ke Grup Acara
  const broadcastLines = [
    `🚀 *JOBDESK ACARA RESMI DITERBITKAN: ${event.name.toUpperCase()}*`,
    `Telah diterbitkan *${createdTasksSummary.length} tugas kepanitiaan baru* oleh *${authResult.senderProfile?.name || "Admin"}*:\n`,
    ...createdTasksSummary.map(
      (item, idx) =>
        `${idx + 1}. *${item.name}*\n   👤 PIC: ${item.picDisplay}\n   ⏰ Tenggat: ${item.deadlineDisplay}${
          item.checklistCount > 0 ? `\n   📋 Checklist: ${item.checklistCount} butir standar` : ""
        }`
    ),
    "",
  ];

  // Tugas Hari H (Operasional yang Dilewati)
  if (parseResult.skipped_tasks && parseResult.skipped_tasks.length > 0) {
    broadcastLines.push("ℹ️ *Tugas Hari H (Tidak masuk checklist deadline):*");
    parseResult.skipped_tasks.forEach((s) => {
      broadcastLines.push(`- ${s.raw_text} (${s.reason || "Dijalankan saat hari H"})`);
    });
    broadcastLines.push("");
  }

  // Pengingat jika ada tugas yang belum memiliki tenggat
  const missingDeadlines = createdTasksSummary.filter((t) => !t.hasDeadline);
  if (missingDeadlines.length > 0) {
    const koorPhone = normalizePhone(authResult.coordinatorProfile?.whatsapp_number);
    const sekrePhone = normalizePhone(authResult.secretaryProfile?.whatsapp_number);

    if (koorPhone) mentionedPhones.add(koorPhone);
    if (sekrePhone) mentionedPhones.add(sekrePhone);

    const koorDisplay = koorPhone
      ? `@${koorPhone} (${authResult.coordinatorProfile?.name || "Koordinator"})`
      : authResult.coordinatorProfile?.name || "Koordinator";
    const sekreDisplay = sekrePhone
      ? `@${sekrePhone} (${authResult.secretaryProfile?.name || "Sekretaris"})`
      : authResult.secretaryProfile?.name || "Sekretaris";

    broadcastLines.push("⚠️ *Perhatian Koordinator & Sekretaris:*");
    broadcastLines.push(
      `Halo ${koorDisplay} & ${sekreDisplay}, terdapat *${missingDeadlines.length} tugas* di atas yang belum memiliki tenggat waktu.`
    );
    broadcastLines.push(
      "Ketik: *[nomor] tenggat [tanggal/jam]* di grup ini untuk menentukan batas pengerjaan.\n"
    );
  }

  broadcastLines.push(
    "🙌 *Semangat bertugas rekan-rekan panitia!*",
    "Mari bersama-sama mengawal persiapan acara ini agar berjalan sukses dan lancar.",
    "",
    "👉 Pantau dan perbarui progres tugas di:",
    "https://jobdexin.sumestawsome.xyz/dashboard/tasks"
  );

  const broadcastMessage = formatWhatsAppText(broadcastLines.join("\n"));
  const mentionsList = Array.from(mentionedPhones);
  const eventGroupId = event.whatsapp_group_id || (incoming.isGroup ? incoming.groupId : "");

  if (isGroupTarget) {
    await baseSendWhatsAppMessage({
      target: replyTarget,
      message: broadcastMessage,
      type: "group",
      mentions: mentionsList,
      provider: incoming.provider,
    });
  } else {
    // Di DM
    const dmReply = [
      `✅ *${createdTasksSummary.length} Jobdesk Acara Berhasil Diterbitkan!*`,
      `Seluruh tugas untuk *${event.name}* kini telah tersimpan aktif di JobDex.in dan disiarkan ke grup panitia.`,
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
          message: broadcastMessage,
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
    count: createdTasksSummary.length,
  });
}

/**
 * Handler pesan purna-tugas: perintah ACC dipensiunkan dengan penjelasan ramah
 */
export async function handleBulkJobdeskAccCommand(
  incoming: NormalizedIncomingWhatsAppMessage,
  _isForceAcc = false
): Promise<NextResponse> {
  void _isForceAcc;
  const replyTarget = incoming.isGroup
    ? incoming.groupId || getDefaultGroupId()
    : incoming.sender || incoming.groupId || getDefaultGroupId();
  const isGroupTarget = incoming.isGroup || isGroupRecipient(replyTarget);

  const retiredMessage =
    "ℹ️ *Alur draf telah disederhanakan!*\nTugas kini langsung tersimpan otomatis ke sistem tanpa perlu konfirmasi '!jobdesk acc'. Untuk mengubah tenggat atau detail tugas, Anda dapat langsung mengetik nomor tugas dan tenggatnya di grup atau melalui web JobDex.in.";

  await baseSendWhatsAppMessage({
    target: replyTarget,
    message: formatWhatsAppText(retiredMessage),
    type: isGroupTarget ? "group" : "phone",
    provider: incoming.provider,
  });

  return NextResponse.json({ ok: true, status: "bulk_jobdesk_acc_retired" });
}

/**
 * Handler pesan purna-tugas: perintah BATAL dipensiunkan dengan penjelasan ramah
 */
export async function handleBulkJobdeskBatalCommand(
  incoming: NormalizedIncomingWhatsAppMessage
): Promise<NextResponse> {
  const replyTarget = incoming.isGroup
    ? incoming.groupId || getDefaultGroupId()
    : incoming.sender || incoming.groupId || getDefaultGroupId();
  const isGroupTarget = incoming.isGroup || isGroupRecipient(replyTarget);

  const retiredMessage =
    "ℹ️ *Alur draf telah disederhanakan!*\nTugas langsung tersimpan otomatis saat perintah '!jobdesk tambah' dikirimkan. Jika ingin membatalkan atau menghapus tugas yang sudah terlanjur dibuat, Anda dapat mengelolanya langsung melalui dashboard web JobDex.in.";

  await baseSendWhatsAppMessage({
    target: replyTarget,
    message: formatWhatsAppText(retiredMessage),
    type: isGroupTarget ? "group" : "phone",
    provider: incoming.provider,
  });

  return NextResponse.json({ ok: true, status: "bulk_jobdesk_batal_retired" });
}

/**
 * Helper untuk memformat tampilan tenggat waktu ke zona WITA
 */
function formatDeadlineDisplay(deadlineStr: string | null | undefined): string {
  if (!deadlineStr || !deadlineStr.trim()) return "Belum ditentukan";
  const clean = deadlineStr.trim().replace(/\s*WITA$/i, "");
  const isoFormatted = clean.includes("T") ? clean : clean.replace(" ", "T");
  const withTz = isoFormatted.match(/[Zz]|[+-]\d{2}:?\d{2}$/)
    ? isoFormatted
    : (isoFormatted.length === 10 ? `${isoFormatted}T23:59:00+08:00` : `${isoFormatted}+08:00`);
  const dateObj = new Date(withTz);
  if (isNaN(dateObj.getTime())) {
    return clean;
  }
  const hasTime = clean.includes(":");
  try {
    const formatted = new Intl.DateTimeFormat("id-ID", {
      timeZone: "Asia/Makassar",
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      ...(hasTime ? { hour: "2-digit", minute: "2-digit" } : {}),
    }).format(dateObj);
    return formatted;
  } catch {
    return clean;
  }
}

/**
 * Handler pembaruan tenggat waktu konversasional langsung ke tugas aktif di Firestore
 */
export async function handleConversationalDeadlineUpdate(
  incoming: NormalizedIncomingWhatsAppMessage,
  rawText: string
): Promise<NextResponse | null> {
  const replyTarget = incoming.isGroup
    ? incoming.groupId || getDefaultGroupId()
    : incoming.sender || incoming.groupId || getDefaultGroupId();
  const isGroupTarget = incoming.isGroup || isGroupRecipient(replyTarget);

  // 1. Resolusi Acara
  let event: Event | null = null;
  if (incoming.isGroup && incoming.groupId) {
    event = await findEventByGroupId(incoming.groupId);
  }
  if (!event) {
    const res = await resolveEventForBulkJobdesk(incoming, rawText);
    event = res.event;
  }
  if (!event) {
    return null;
  }

  // 2. Ambil seluruh tugas aktif untuk acara terkait dari Firestore
  const db = getAdminDb();
  const tasksSnap = await db
    .collection("tasks")
    .where("event_id", "==", event.id)
    .where("is_archived", "==", false)
    .get();

  if (tasksSnap.empty) {
    return null;
  }

  const activeTasks: Task[] = [];
  tasksSnap.forEach((doc) => {
    activeTasks.push({ id: doc.id, ...doc.data() } as Task);
  });

  // Urutkan tugas berdasarkan created_at ascending
  activeTasks.sort((a, b) => {
    const aMs =
      a.created_at && typeof a.created_at === "object" && "toMillis" in a.created_at
        ? (a.created_at as { toMillis: () => number }).toMillis()
        : a.created_at instanceof Date
        ? a.created_at.getTime()
        : 0;
    const bMs =
      b.created_at && typeof b.created_at === "object" && "toMillis" in b.created_at
        ? (b.created_at as { toMillis: () => number }).toMillis()
        : b.created_at instanceof Date
        ? b.created_at.getTime()
        : 0;
    return aMs - bMs;
  });

  // 3. Format kandidat tugas untuk AI / Regex conversational deadline parser
  const candidateTasks: ParsedJobdeskTask[] = activeTasks.map((t) => {
    let deadlineStr = "";
    if (t.deadline) {
      if (typeof t.deadline === "object" && "toDate" in t.deadline) {
        deadlineStr = (t.deadline as { toDate: () => Date }).toDate().toISOString().slice(0, 10);
      } else if (t.deadline instanceof Date) {
        deadlineStr = t.deadline.toISOString().slice(0, 10);
      } else {
        deadlineStr = String(t.deadline);
      }
    }
    return {
      name: t.name || (t as { title?: string }).title || "Tugas",
      pic_names: t.pic_names || [],
      pic_ids: t.pic_ids || (t.pic_id ? [t.pic_id] : []),
      priority: (t.priority === "kritis" ? "tinggi" : t.priority || "sedang") as "rendah" | "sedang" | "tinggi",
      stage: (t as unknown as { stage?: "pra_acara" | "pasca_acara" }).stage || "pra_acara",
      deadline: deadlineStr,
      requires_deadline: !t.deadline,
    };
  });

  // 4. Parse conversational deadlines
  const updates = await parseConversationalDeadlines(rawText, candidateTasks);
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
        "👉 *Format:* *[nomor] tenggat [tanggal/jam]* (contoh: *1 tenggat 5 nov 20:00*)",
        "👉 Atau untuk seluruh tugas sekaligus: *semua tenggat [tanggal]*",
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

  // 5. Terapkan pembaruan langsung ke dokumen tugas Firestore menggunakan Timestamp
  const batch = db.batch();
  const updatedTasks: Array<{
    taskIndex: number;
    task: Task;
    deadlineStr: string;
    deadlineTimestamp: Timestamp;
  }> = [];

  for (const up of updates) {
    const taskIdx = up.task_index - 1;
    if (taskIdx >= 0 && taskIdx < activeTasks.length) {
      const targetTask = activeTasks[taskIdx];
      const parsedDeadlineStr = up.deadline;

      let deadlineDate: Date | null = null;
      if (parsedDeadlineStr.includes("T")) {
        deadlineDate = new Date(parsedDeadlineStr);
      } else if (parsedDeadlineStr.includes(" ")) {
        deadlineDate = new Date(parsedDeadlineStr.replace(" ", "T") + "+08:00");
      } else {
        deadlineDate = new Date(`${parsedDeadlineStr}T23:59:59+08:00`);
      }

      if (isNaN(deadlineDate.getTime())) {
        deadlineDate = new Date(parsedDeadlineStr);
      }

      const deadlineTimestamp = Timestamp.fromDate(deadlineDate);
      const taskRef = db.collection("tasks").doc(targetTask.id);

      batch.update(taskRef, {
        deadline: deadlineTimestamp,
        updated_at: FieldValue.serverTimestamp(),
      });

      // Status / update log
      const logRef = taskRef.collection("status_logs").doc();
      batch.set(logRef, {
        id: logRef.id,
        task_id: targetTask.id,
        previous_status: targetTask.status || "belum_dimulai",
        new_status: targetTask.status || "belum_dimulai",
        notes: `Tenggat waktu diperbarui menjadi ${parsedDeadlineStr} via WhatsApp`,
        changed_by: incoming.sender,
        changed_at: FieldValue.serverTimestamp(),
      });

      updatedTasks.push({
        taskIndex: up.task_index,
        task: targetTask,
        deadlineStr: parsedDeadlineStr,
        deadlineTimestamp,
      });
    }
  }

  if (updatedTasks.length === 0) {
    return null;
  }

  await batch.commit();

  // 6. Ambil profil user PIC untuk mention WhatsApp
  const allUpdatedPicIds = Array.from(
    new Set(
      updatedTasks.flatMap((ut) =>
        ut.task.pic_ids && ut.task.pic_ids.length > 0
          ? ut.task.pic_ids
          : ut.task.pic_id
          ? [ut.task.pic_id]
          : []
      )
    )
  );

  const picUserMap = new Map<string, UserProfile>();
  if (allUpdatedPicIds.length > 0) {
    try {
      const usersSnap = await db.collection("users").get();
      usersSnap.forEach((uDoc) => {
        if (allUpdatedPicIds.includes(uDoc.id)) {
          picUserMap.set(uDoc.id, { id: uDoc.id, ...uDoc.data() } as UserProfile);
        }
      });
    } catch (err) {
      console.warn("[BulkJobdeskDraft] Gagal mengambil profil PIC untuk deadline update:", err);
    }
  }

  const mentionedPhones = new Set<string>();

  // Format pesan konfirmasi terfokus (Hanya tugas yang baru saja diperbarui)
  const taskBlocks = updatedTasks.map(({ taskIndex, task, deadlineStr }) => {
    const picDisplays: string[] = [];
    const picIds =
      task.pic_ids && task.pic_ids.length > 0
        ? task.pic_ids
        : task.pic_id
        ? [task.pic_id]
        : [];

    if (picIds.length > 0) {
      for (const pId of picIds) {
        const u = picUserMap.get(pId);
        const uAny = u as Record<string, unknown> | undefined;
        const cleanP = normalizePhone(
          u?.whatsapp_number || (uAny?.whatsapp as string) || (uAny?.phone as string)
        );
        if (cleanP && cleanP.length > 5) {
          mentionedPhones.add(cleanP);
          picDisplays.push(`@${cleanP}${u?.name ? ` (${u.name})` : ""}`);
        } else if (u?.name) {
          picDisplays.push(u.name);
        }
      }
    }
    if (picDisplays.length === 0) {
      if (task.pic_names && task.pic_names.length > 0) {
        picDisplays.push(...task.pic_names);
      } else {
        picDisplays.push("Belum ditentukan");
      }
    }

    const formattedDeadline = formatDeadlineDisplay(deadlineStr);
    const deadlineOutput =
      formattedDeadline === "Belum ditentukan"
        ? "Belum ditentukan"
        : `${formattedDeadline} WITA`;

    return [
      `📌 *Nomor ${taskIndex}: ${task.name}*`,
      `⏰ *Tenggat:* ${deadlineOutput}`,
      `👥 *PIC:* ${picDisplays.join(", ")}`,
    ].join("\n");
  });

  const responseLines = [
    `✅ *Tenggat Jobdesk Berhasil Diperbarui!*\n`,
    taskBlocks.join("\n\n"),
    "",
    "Halo rekan-rekan PIC, tugas di atas sudah ditentukan tenggatnya ya! Minta tolong mulai dipersiapkan dan dicicil pengerjaannya, jangan sampai lewat dari batas waktu. Semangat! 💪🔥",
    "",
    "👉 Pantau progres di:",
    "https://jobdexin.sumestawsome.xyz/dashboard/tasks",
  ];

  await baseSendWhatsAppMessage({
    target: replyTarget,
    message: formatWhatsAppText(responseLines.join("\n")),
    type: isGroupTarget ? "group" : "phone",
    mentions: Array.from(mentionedPhones),
    provider: incoming.provider,
  });

  return NextResponse.json({
    ok: true,
    status: "tasks_deadlines_updated",
    updated_count: updatedTasks.length,
  });
}

/**
 * Alias untuk kompatibilitas
 */
export const handleBulkJobdeskDeadlineFollowUp = handleConversationalDeadlineUpdate;

