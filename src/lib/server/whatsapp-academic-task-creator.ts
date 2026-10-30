import "server-only";

import { NextResponse } from "next/server";
import { getAdminDb, FieldValue } from "@/lib/server/firebase-admin";
import { sendWhatsAppMessage, isGroupRecipient } from "@/lib/server/whatsapp";
import {
  handleAcademicTaskCreated,
  handleAcademicTaskUpdated,
  findClassWorkspaceByContext,
  formatWitaDate,
  resolveSubmissionText,
  DEFAULT_CLASS_GROUP_ID,
  DEFAULT_CLASS_DISCUSSION_GROUP_ID,
  DEFAULT_CLASS_WORKSPACE_ID,
  isAcademicClassTask,
  PUBLIC_CLASS_SCHEDULE_URL,
  type ClassWorkspaceConfig,
} from "@/lib/server/academic-broadcast";
import { getTaskDeadlineDiffDays } from "@/lib/task-risk";
import type { NormalizedIncomingWhatsAppMessage, Task, UserProfile } from "@/types";

/**
 * Normalizes phone numbers to standard Indonesian format (e.g. 628...).
 */
export function normalizePhone(value: string): string {
  return value
    .replace(/@s\.whatsapp\.net$/i, "")
    .replace(/@c\.us$/i, "")
    .replace(/\D/g, "")
    .replace(/^0/, "62")
    .replace(/^8/, "628");
}

/**
 * Parses deadline string in various Indonesian and standard formats.
 * E.g., DD/MM/YYYY HH:mm, YYYY-MM-DD HH:mm, DD/MM/YYYY
 */
export function parseAcademicDeadline(raw: string): Date | null {
  const trimmed = raw.trim();

  // 1. Format DD/MM/YYYY or DD-MM-YYYY (optional HH:mm)
  const dmyMatch = trimmed.match(
    /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(?:\s+(\d{1,2})[:.](\d{2}))?$/
  );
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10) - 1;
    const year = parseInt(dmyMatch[3], 10);
    const hour = dmyMatch[4] !== undefined ? parseInt(dmyMatch[4], 10) : 23;
    const minute = dmyMatch[5] !== undefined ? parseInt(dmyMatch[5], 10) : 59;
    // Local deadline is WITA (UTC+8) -> convert to UTC
    return new Date(Date.UTC(year, month, day, hour - 8, minute, 0));
  }

  // 2. Format YYYY-MM-DD or YYYY/MM/DD (optional HH:mm)
  const ymdMatch = trimmed.match(
    /^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})(?:\s+(\d{1,2})[:.](\d{2}))?$/
  );
  if (ymdMatch) {
    const year = parseInt(ymdMatch[1], 10);
    const month = parseInt(ymdMatch[2], 10) - 1;
    const day = parseInt(ymdMatch[3], 10);
    const hour = ymdMatch[4] !== undefined ? parseInt(ymdMatch[4], 10) : 23;
    const minute = ymdMatch[5] !== undefined ? parseInt(ymdMatch[5], 10) : 59;
    return new Date(Date.UTC(year, month, day, hour - 8, minute, 0));
  }

  // 3. Fallback standard Date.parse
  const fallbackDate = new Date(trimmed);
  if (!isNaN(fallbackDate.getTime())) {
    return fallbackDate;
  }

  return null;
}

/**
 * Validates whether the message sender has Admin Komunitas / Korti / Super Admin privileges.
 * Implements Green-API 3-Chat Limit Guard:
 * - In Personal Chat (DM): Only registered Admin 1 and Admin 2 with allow_voice_note_dm !== false are allowed.
 * - In Discussion Group: Admin 1, Admin 2, and Super Admin are allowed.
 */
export async function verifyAdminKomunitas(
  incoming: NormalizedIncomingWhatsAppMessage,
  db: FirebaseFirestore.Firestore = getAdminDb()
): Promise<{
  isAdmin: boolean;
  adminUser: UserProfile | null;
  replyTarget: string;
  isGroupTarget: boolean;
  workspaceConfig?: ClassWorkspaceConfig;
  isDmAllowed?: boolean;
  dmRestrictionReason?: string;
}> {
  // Cari workspace kelas yang cocok secara dinamis berdasarkan grup atau nomor pengirim
  const wsConfig = await findClassWorkspaceByContext(
    {
      groupId: incoming.groupId,
      sender: incoming.sender,
      isGroup: incoming.isGroup,
    },
    db
  );

  const workspaceId = wsConfig?.id || DEFAULT_CLASS_WORKSPACE_ID;
  const replyTarget = incoming.isGroup
    ? incoming.groupId || wsConfig?.discussionGroupId || DEFAULT_CLASS_DISCUSSION_GROUP_ID
    : incoming.sender || incoming.groupId || wsConfig?.discussionGroupId || DEFAULT_CLASS_DISCUSSION_GROUP_ID;
  const isGroupTarget = incoming.isGroup || isGroupRecipient(replyTarget);

  const senderPhone = normalizePhone(incoming.sender || "");
  let isAdmin = false;
  let adminUser: UserProfile | null = null;
  let isDmAllowed = true;
  let dmRestrictionReason: string | undefined = undefined;

  // 1. Periksa authorized_admins dari konfigurasi workspace kelas
  const admins = wsConfig?.authorized_admins || {};
  const a1 = admins.admin_1;
  const a2 = admins.admin_2;
  const sa = admins.super_admin;

  const a1Phone = a1?.phone ? normalizePhone(a1.phone) : "";
  const a2Phone = a2?.phone ? normalizePhone(a2.phone) : "";
  const saPhone = sa?.phone ? normalizePhone(sa.phone) : "";

  const isA1 = Boolean(a1Phone && a1Phone === senderPhone);
  const isA2 = Boolean(a2Phone && a2Phone === senderPhone);
  const isSA = Boolean((saPhone && saPhone === senderPhone) || senderPhone === "6285119459703");

  if (isA1 || isA2 || isSA) {
    isAdmin = true;

    // Evaluasi 3-Chat Limit Guard untuk jalur Personal Chat (DM)
    if (!incoming.isGroup) {
      if (isA1) {
        isDmAllowed = a1?.allow_voice_note_dm !== false;
      } else if (isA2) {
        isDmAllowed = a2?.allow_voice_note_dm !== false;
      } else if (isSA) {
        // Super Admin dibatasi di DM agar slot 3-chat limit Green-API Instance A tidak terbuang
        isDmAllowed = false;
        dmRestrictionReason = "super_admin_dm_restricted";
      }
    }

    adminUser = {
      id: isSA
        ? "ls25IoTMA7dMP4NNb04XWeDxNAL2"
        : isA1
        ? `admin_1_${workspaceId}`
        : `admin_2_${workspaceId}`,
      name: isSA
        ? "Putu Agus Sumerta Yasa (Super Admin)"
        : isA1
        ? a1?.name || "Admin Komunitas 1"
        : a2?.name || "Admin Komunitas 2",
      email: isSA
        ? "agus.sumerta@student.undiksha.ac.id"
        : `${senderPhone}@jobdexin.sumestawsome.xyz`,
      whatsapp_number: senderPhone,
      role: isSA ? "super_admin" : "admin_komunitas",
      organization_id: workspaceId,
      division_id: "humas_media_kreatif",
      avatar_url: "",
      is_active: true,
    };
  }

  // 2. Jika belum ditemukan di authorized_admins, periksa dokumen users di Firestore
  if (!isAdmin) {
    try {
      const usersSnap = await db.collection("users").get();
      for (const doc of usersSnap.docs) {
        const data = doc.data() as UserProfile;
        const uPhone = normalizePhone(data.whatsapp_number || "");
        if (uPhone && uPhone === senderPhone) {
          const wsRole = data.workspace_roles?.[workspaceId];
          if (
            wsRole === "admin_komunitas" ||
            wsRole === "korti" ||
            wsRole === "super_admin" ||
            data.role === "super_admin" ||
            data.role === "korti" ||
            data.role === "admin_komunitas"
          ) {
            isAdmin = true;
            adminUser = { ...data, id: doc.id };
            if (!incoming.isGroup && (data.role === "super_admin" || wsRole === "super_admin")) {
              isDmAllowed = false;
              dmRestrictionReason = "super_admin_dm_restricted";
            }
            break;
          }
        }
      }
    } catch (err) {
      console.error("[verifyAdminKomunitas] Error querying users:", err);
    }
  }

  // 3. Fallback checks untuk nomor Admin Komunitas bawaan
  if (!isAdmin) {
    if (senderPhone === "6285119459703" || senderPhone === "628814878194") {
      isAdmin = true;
      const isAgus = senderPhone === "6285119459703";
      if (!incoming.isGroup && isAgus) {
        isDmAllowed = false;
        dmRestrictionReason = "super_admin_dm_restricted";
      }
      adminUser = {
        id: isAgus ? "ls25IoTMA7dMP4NNb04XWeDxNAL2" : "iTR4JpIAn0WMjDtKIOi72VU2zO33",
        name: isAgus ? "Putu Agus Sumerta Yasa" : "Made Darma Tanaya",
        email: isAgus ? "agus.sumerta@student.undiksha.ac.id" : "cdnzidarma@gmail.com",
        whatsapp_number: senderPhone,
        role: isAgus ? "super_admin" : "admin_komunitas",
        organization_id: workspaceId,
        division_id: "humas_media_kreatif",
        avatar_url: "",
        is_active: true,
      };
    }
  }

  return {
    isAdmin,
    adminUser,
    replyTarget,
    isGroupTarget,
    workspaceConfig: wsConfig,
    isDmAllowed,
    dmRestrictionReason,
  };
}


/**
 * Searches active tasks by Dual Identifier:
 * 1. Number Index (1, 2, 3...) according to list sorted by deadline ASC
 * 2. Course Name or Task Title (case-insensitive substring match)
 */
export async function findAcademicTaskByIdentifier(
  identifier: string,
  db: FirebaseFirestore.Firestore = getAdminDb()
): Promise<{
  task: Task | null;
  index: number | null;
  totalActive: number;
  error?: string;
}> {
  const snap = await db.collection("tasks").where("is_archived", "==", false).get();
  const activeTasks: Task[] = [];
  snap.forEach((doc) => {
    const t = { id: doc.id, ...doc.data() } as Task;
    if (
      isAcademicClassTask(t) &&
      t.status !== "approved" &&
      (t.status as string) !== "selesai"
    ) {
      activeTasks.push(t);
    }
  });

  // Urutkan berdasarkan deadline terdekat (earliest first)
  activeTasks.sort((a, b) => {
    const timeA = a.deadline ? new Date(a.deadline as string).getTime() : Infinity;
    const timeB = b.deadline ? new Date(b.deadline as string).getTime() : Infinity;
    return timeA - timeB;
  });

  const rawTrimmed = identifier.trim();
  const numericOnly = rawTrimmed.replace(/^[#№\s]+|^no\.?\s*/i, "").trim();

  // 1. Cek apakah identifier adalah Nomor Urut (1, 2, 3...)
  if (/^\d+$/.test(numericOnly)) {
    const idx = parseInt(numericOnly, 10);
    if (idx >= 1 && idx <= activeTasks.length) {
      return {
        task: activeTasks[idx - 1],
        index: idx,
        totalActive: activeTasks.length,
      };
    }
    return {
      task: null,
      index: null,
      totalActive: activeTasks.length,
      error: `Nomor urut tugas #${idx} tidak ditemukan. Saat ini terdapat ${activeTasks.length} tugas aktif.`,
    };
  }

  // 2. Pencarian Nama Matkul / Judul Tugas (case-insensitive substring)
  const queryLower = rawTrimmed.toLowerCase();
  let matchIndex = -1;
  const match = activeTasks.find((t, i) => {
    const course = (t.course_name || t.subject_name || "").toLowerCase();
    const title = (t.name || t.title || "").toLowerCase();
    if (course.includes(queryLower) || title.includes(queryLower)) {
      matchIndex = i;
      return true;
    }
    return false;
  });

  if (match) {
    return {
      task: match,
      index: matchIndex + 1,
      totalActive: activeTasks.length,
    };
  }

  // 3. Fallback pencarian pada deskripsi
  const descMatch = activeTasks.find((t, i) => {
    const desc = (t.description || "").toLowerCase();
    if (desc.includes(queryLower)) {
      matchIndex = i;
      return true;
    }
    return false;
  });

  if (descMatch) {
    return {
      task: descMatch,
      index: matchIndex + 1,
      totalActive: activeTasks.length,
    };
  }

  return {
    task: null,
    index: null,
    totalActive: activeTasks.length,
    error: `Tidak ditemukan tugas aktif dengan kata kunci "${rawTrimmed}". Ketik \`!tugas list\` untuk melihat daftar nomor tugas aktif.`,
  };
}

/**
 * Command: !tugas atau !tugas menu
 * Displays the complete bot command guide for Ilkom B.
 */
export async function handleAcademicTaskMenu(
  incoming: NormalizedIncomingWhatsAppMessage
): Promise<NextResponse> {
  const replyTarget = incoming.isGroup
    ? incoming.groupId || DEFAULT_CLASS_DISCUSSION_GROUP_ID
    : incoming.sender || incoming.groupId || DEFAULT_CLASS_DISCUSSION_GROUP_ID;
  const isGroupTarget = incoming.isGroup || isGroupRecipient(replyTarget);

  const menuMsg = [
    "📚 *PANDUAN BOT TUGAS KELAS ILKOM B* 🤖",
    "",
    "Halo teman-teman *Ilkom B*! Berikut daftar perintah bot yang dapat digunakan:",
    "",
    "*📖 Perintah Umum (Bisa di Grup Diskusi / Japri):*",
    "• `!tugas list` : Menampilkan seluruh tugas aktif urut deadline terdekat.",
    "• `!tugas mepet` : Menampilkan tugas aktif dengan sisa waktu ≤ 3 hari.",
    "• `!tugas menu` : Menampilkan panduan bantuan ini.",
    "",
    "*⚙️ Perintah Khusus Admin Komunitas / Korti:*",
    "• `!tugas tambah [Matkul] | [Judul] | [Deskripsi] | [Tenggat] | [LMS]` : Menambah tugas baru (format 4 atau 5 parameter).",
    "• *Kirim Voice Note (VN)* : Rekam pesan suara berisi detail tugas & tenggat untuk dicatat otomatis oleh AI.",
    "• `!tugas edit [No/Nama] | [tenggat/deskripsi/link/judul] | [Nilai Baru]` : Mengubah data tugas & siarkan revisi.",
    "• `!tugas selesai [No/Nama]` : Menutup & mengarsipkan tugas (pengingat otomatis dinonaktifkan).",
    "• `!tugas arsip [No/Nama]` : Mengarsipkan tugas yang telah selesai.",
    "",
    "🌐 *Kalender & Jadwal Publik Lengkap:*",
    `👉 ${PUBLIC_CLASS_SCHEDULE_URL}`,
  ].join("\n");

  await sendWhatsAppMessage({
    target: replyTarget,
    message: menuMsg,
    type: isGroupTarget ? "group" : "phone",
    org_id: DEFAULT_CLASS_WORKSPACE_ID,
  });

  return NextResponse.json({ ok: true, action: "academic_menu_sent" });
}

/**
 * Command: !tugas list atau !tugas mepet
 * Lists all active class tasks sorted by nearest deadline.
 */
export async function handleAcademicTaskList(
  incoming: NormalizedIncomingWhatsAppMessage,
  filterUrgentOnly: boolean = false
): Promise<NextResponse> {
  const db = getAdminDb();
  const replyTarget = incoming.isGroup
    ? incoming.groupId || DEFAULT_CLASS_DISCUSSION_GROUP_ID
    : incoming.sender || incoming.groupId || DEFAULT_CLASS_DISCUSSION_GROUP_ID;
  const isGroupTarget = incoming.isGroup || isGroupRecipient(replyTarget);

  const snap = await db.collection("tasks").where("is_archived", "==", false).get();
  const activeTasks: Task[] = [];
  snap.forEach((doc) => {
    const t = { id: doc.id, ...doc.data() } as Task;
    if (
      isAcademicClassTask(t) &&
      t.status !== "approved" &&
      (t.status as string) !== "selesai"
    ) {
      activeTasks.push(t);
    }
  });

  activeTasks.sort((a, b) => {
    const timeA = a.deadline ? new Date(a.deadline as string).getTime() : Infinity;
    const timeB = b.deadline ? new Date(b.deadline as string).getTime() : Infinity;
    return timeA - timeB;
  });

  let displayedTasks = activeTasks;
  if (filterUrgentOnly) {
    displayedTasks = activeTasks.filter((t) => {
      const diff = getTaskDeadlineDiffDays(t);
      return diff !== Number.MAX_SAFE_INTEGER && diff <= 3;
    });
  }

  if (displayedTasks.length === 0) {
    const emptyMsg = filterUrgentOnly
      ? [
          "✨ *Aman Guys!*",
          "Tidak ada tugas kuliah yang mepet deadline (≤ 3 hari).",
          "Tetap santai tapi jangan lupa cicil tugas lainnya ya! 🙌",
          "",
          `👉 Cek semua tugas: ${PUBLIC_CLASS_SCHEDULE_URL}`,
        ].join("\n")
      : [
          "🎉 *Hore! Belum ada tugas aktif untuk kelas Ilkom B.*",
          "Semua tugas sudah beres atau belum ada tugas baru yang diinput.",
          "",
          `👉 Cek kalender: ${PUBLIC_CLASS_SCHEDULE_URL}`,
        ].join("\n");

    await sendWhatsAppMessage({
      target: replyTarget,
      message: emptyMsg,
      type: isGroupTarget ? "group" : "phone",
      org_id: DEFAULT_CLASS_WORKSPACE_ID,
    });

    return NextResponse.json({ ok: true, count: 0 });
  }

  const lines: string[] = [];
  if (filterUrgentOnly) {
    lines.push("🚨 *DAFTAR TUGAS DEADLINE MEPET (≤ 3 HARI)* 🔥");
    lines.push("Yuk segera diselesaikan sebelum server LMS penuh!\n");
  } else {
    lines.push("📋 *DAFTAR TUGAS KULIAH ILKOM B* 📚");
    lines.push(`Total: ${activeTasks.length} tugas aktif\n`);
  }

  displayedTasks.forEach((t) => {
    const originalIndex = activeTasks.indexOf(t) + 1;
    const course = t.course_name || t.subject_name || "Mata Kuliah";
    const title = t.name || t.title || "Tugas Kuliah";
    const deadlineStr = formatWitaDate(t.deadline);
    const diff = getTaskDeadlineDiffDays(t);
    let diffStatus = "";
    if (diff === Number.MAX_SAFE_INTEGER) {
      diffStatus = "Tanpa batas waktu";
    } else if (diff < 0) {
      diffStatus = "⚠️ Lewat tenggat";
    } else if (diff === 0) {
      diffStatus = "🔥 HARI INI";
    } else if (diff === 1) {
      diffStatus = "🚨 Besok";
    } else {
      diffStatus = `⏳ ${diff} hari lagi`;
    }

    const lms = resolveSubmissionText(t.submission_url || t.submission_link);

    lines.push(`${originalIndex}. *${course}*`);
    lines.push(`   📝 *Tugas:* ${title}`);
    lines.push(`   ⏰ *Tenggat:* ${deadlineStr} (${diffStatus})`);
    lines.push(`   🔗 *LMS:* ${lms}`);
    lines.push("");
  });

  lines.push(`👉 Kalender & jadwal lengkap: ${PUBLIC_CLASS_SCHEDULE_URL}`);

  await sendWhatsAppMessage({
    target: replyTarget,
    message: lines.join("\n"),
    type: isGroupTarget ? "group" : "phone",
    org_id: DEFAULT_CLASS_WORKSPACE_ID,
  });

  return NextResponse.json({ ok: true, count: displayedTasks.length });
}

/**
 * Command: !tugas edit [Identifier] | [tenggat/deskripsi/link/judul] | [Nilai Baru]
 * Modifies an existing academic task and triggers revision broadcast if deadline or description changed.
 */
export async function handleAcademicTaskEdit(
  incoming: NormalizedIncomingWhatsAppMessage,
  rawText: string
): Promise<NextResponse> {
  const db = getAdminDb();
  const { isAdmin, adminUser, replyTarget, isGroupTarget } = await verifyAdminKomunitas(incoming, db);

  if (!isAdmin || !adminUser) {
    const deniedMsg = [
      "⛔ *Akses Ditolak*",
      "Maaf, hanya *Admin Komunitas* yang memiliki izin untuk mengedit tugas kelas via WhatsApp.",
    ].join("\n");

    await sendWhatsAppMessage({
      target: replyTarget,
      message: deniedMsg,
      type: isGroupTarget ? "group" : "phone",
      org_id: DEFAULT_CLASS_WORKSPACE_ID,
    });

    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 403 });
  }

  const cleanCmd = rawText.replace(/^[!/](?:jobde[xs]\s+)?tugas\s+edit\s*/i, "").trim();
  const parts = cleanCmd.split("|").map((p) => p.trim());

  if (parts.length < 3 || !parts[0] || !parts[1] || !parts[2]) {
    const usageMsg = [
      "⚠️ *Format Perintah Edit Tidak Sesuai*",
      "Gunakan format:",
      "*!tugas edit [Nomor/Nama Matkul] | [tenggat/deskripsi/link/judul] | [Nilai Baru]*",
      "",
      "*Contoh Ubah Tenggat:*",
      "`!tugas edit 1 | tenggat | 31/10/2026 23:59`",
      "",
      "*Contoh Ubah Ketentuan:*",
      "`!tugas edit Basis Data | deskripsi | Tambahkan relasi ERD pada laporan akhir`",
      "",
      "*Contoh Ubah Link Pengumpulan:*",
      "`!tugas edit 2 | link | https://elearning.undiksha.ac.id/mod/assign/view.php?id=123`",
    ].join("\n");

    await sendWhatsAppMessage({
      target: replyTarget,
      message: usageMsg,
      type: isGroupTarget ? "group" : "phone",
      org_id: DEFAULT_CLASS_WORKSPACE_ID,
    });

    return NextResponse.json({ ok: false, error: "invalid_format" });
  }

  const identifier = parts[0];
  const field = parts[1].toLowerCase();
  const newVal = parts.slice(2).join("|").trim();

  const searchResult = await findAcademicTaskByIdentifier(identifier, db);
  if (!searchResult.task) {
    await sendWhatsAppMessage({
      target: replyTarget,
      message: `⚠️ *Tugas Tidak Ditemukan*\n${searchResult.error || "Tugas tidak ditemukan."}`,
      type: isGroupTarget ? "group" : "phone",
      org_id: DEFAULT_CLASS_WORKSPACE_ID,
    });
    return NextResponse.json({ ok: false, error: "task_not_found" });
  }

  const task = searchResult.task;
  const courseName = task.course_name || task.subject_name || "Mata Kuliah";
  const taskTitle = task.name || task.title || "Tugas Kuliah";

  if (field === "tenggat" || field === "deadline" || field === "waktu") {
    const newDeadlineDate = parseAcademicDeadline(newVal);
    if (!newDeadlineDate || isNaN(newDeadlineDate.getTime())) {
      const dateErrMsg = [
        "⚠️ *Format Tenggat Salah*",
        `Tidak dapat mengenali format tanggal: "${newVal}"`,
        "Gunakan format *DD/MM/YYYY HH:mm* (Contoh: `31/10/2026 23:59`).",
      ].join("\n");

      await sendWhatsAppMessage({
        target: replyTarget,
        message: dateErrMsg,
        type: isGroupTarget ? "group" : "phone",
        org_id: DEFAULT_CLASS_WORKSPACE_ID,
      });
      return NextResponse.json({ ok: false, error: "invalid_deadline" });
    }

    const oldDeadline = task.deadline;
    await db.collection("tasks").doc(task.id).update({
      deadline: newDeadlineDate.toISOString(),
      updated_at: FieldValue.serverTimestamp(),
    });

    // Broadcast revisi ke Grup Pengumuman
    try {
      await handleAcademicTaskUpdated(task.id, adminUser.id, {
        deadlineChanged: true,
        oldDeadline,
        newDeadline: newDeadlineDate,
      }, db);
    } catch (bcErr) {
      console.error("[handleAcademicTaskEdit] Error triggering deadline broadcast:", bcErr);
    }

    const confMsg = [
      "✅ *Tenggat Tugas Berhasil Diperbarui!*",
      `Tugas: *${courseName} - ${taskTitle}*`,
      `⏰ *Tenggat Baru:* ${formatWitaDate(newDeadlineDate)}`,
      "",
      "Pesan revisi telah disiarkan ke Grup Pengumuman Ilkom B. 🙌",
    ].join("\n");

    await sendWhatsAppMessage({
      target: replyTarget,
      message: confMsg,
      type: isGroupTarget ? "group" : "phone",
      org_id: DEFAULT_CLASS_WORKSPACE_ID,
    });

    return NextResponse.json({ ok: true, taskId: task.id, field: "deadline" });
  }

  if (field === "deskripsi" || field === "ketentuan" || field === "instruksi") {
    const oldDescription = task.description || "";
    await db.collection("tasks").doc(task.id).update({
      description: newVal,
      updated_at: FieldValue.serverTimestamp(),
    });

    // Broadcast revisi ke Grup Pengumuman
    try {
      await handleAcademicTaskUpdated(task.id, adminUser.id, {
        descriptionChanged: true,
        oldDescription,
        newDescription: newVal,
      }, db);
    } catch (bcErr) {
      console.error("[handleAcademicTaskEdit] Error triggering description broadcast:", bcErr);
    }

    const confMsg = [
      "✅ *Ketentuan Tugas Berhasil Diperbarui!*",
      `Tugas: *${courseName} - ${taskTitle}*`,
      `📌 *Ketentuan Terbaru:*`,
      newVal,
      "",
      "Pesan revisi telah disiarkan ke Grup Pengumuman Ilkom B. 🙌",
    ].join("\n");

    await sendWhatsAppMessage({
      target: replyTarget,
      message: confMsg,
      type: isGroupTarget ? "group" : "phone",
      org_id: DEFAULT_CLASS_WORKSPACE_ID,
    });

    return NextResponse.json({ ok: true, taskId: task.id, field: "description" });
  }

  if (field === "link" || field === "lms" || field === "tempat" || field === "pengumpulan") {
    await db.collection("tasks").doc(task.id).update({
      submission_url: newVal,
      submission_link: newVal,
      updated_at: FieldValue.serverTimestamp(),
    });

    const confMsg = [
      "✅ *Tempat Pengumpulan Berhasil Diperbarui!*",
      `Tugas: *${courseName} - ${taskTitle}*`,
      `🔗 *LMS / Link Terbaru:* ${newVal}`,
    ].join("\n");

    await sendWhatsAppMessage({
      target: replyTarget,
      message: confMsg,
      type: isGroupTarget ? "group" : "phone",
      org_id: DEFAULT_CLASS_WORKSPACE_ID,
    });

    return NextResponse.json({ ok: true, taskId: task.id, field: "submission_url" });
  }

  if (field === "judul" || field === "nama" || field === "tugas") {
    await db.collection("tasks").doc(task.id).update({
      name: newVal,
      title: newVal,
      updated_at: FieldValue.serverTimestamp(),
    });

    const confMsg = [
      "✅ *Judul Tugas Berhasil Diperbarui!*",
      `Mata Kuliah: *${courseName}*`,
      `📝 *Judul Baru:* ${newVal}`,
    ].join("\n");

    await sendWhatsAppMessage({
      target: replyTarget,
      message: confMsg,
      type: isGroupTarget ? "group" : "phone",
      org_id: DEFAULT_CLASS_WORKSPACE_ID,
    });

    return NextResponse.json({ ok: true, taskId: task.id, field: "title" });
  }

  const unknownMsg = [
    `⚠️ *Bidang "${field}" Tidak Dikenali*`,
    "Gunakan salah satu bidang berikut yang dapat diubah:",
    "- `tenggat` : Mengubah tanggal tenggat tugas",
    "- `deskripsi` : Mengubah rincian ketentuan tugas",
    "- `link` : Mengubah tempat pengumpulan / link LMS",
    "- `judul` : Mengubah judul tugas",
  ].join("\n");

  await sendWhatsAppMessage({
    target: replyTarget,
    message: unknownMsg,
    type: isGroupTarget ? "group" : "phone",
    org_id: DEFAULT_CLASS_WORKSPACE_ID,
  });

  return NextResponse.json({ ok: false, error: "unknown_field" });
}

/**
 * Command: !tugas selesai [Identifier] atau !tugas arsip [Identifier]
 * Closes the task and broadcasts celebration/closing announcement to announcement group.
 */
export async function handleAcademicTaskCompleteOrArchive(
  incoming: NormalizedIncomingWhatsAppMessage,
  rawText: string,
  isArchive: boolean = false
): Promise<NextResponse> {
  const db = getAdminDb();
  const { isAdmin, adminUser, replyTarget, isGroupTarget } = await verifyAdminKomunitas(incoming, db);

  if (!isAdmin || !adminUser) {
    const deniedMsg = [
      "⛔ *Akses Ditolak*",
      "Maaf, hanya *Admin Komunitas* yang memiliki izin untuk menutup atau mengarsipkan tugas kelas via WhatsApp.",
    ].join("\n");

    await sendWhatsAppMessage({
      target: replyTarget,
      message: deniedMsg,
      type: isGroupTarget ? "group" : "phone",
      org_id: DEFAULT_CLASS_WORKSPACE_ID,
    });

    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 403 });
  }

  const cleanCmd = rawText
    .replace(/^[!/](?:jobde[xs]\s+)?tugas\s+(?:selesai|arsip|tutup|beres)\s*/i, "")
    .trim();

  if (!cleanCmd) {
    const usageMsg = [
      "⚠️ *Format Perintah Belum Lengkap*",
      `Gunakan format: \`!tugas ${isArchive ? "arsip" : "selesai"} [Nomor Urut / Nama Matkul]\``,
      "",
      `*Contoh:* \`!tugas ${isArchive ? "arsip" : "selesai"} 1\` atau \`!tugas ${isArchive ? "arsip" : "selesai"} Basis Data\``,
    ].join("\n");

    await sendWhatsAppMessage({
      target: replyTarget,
      message: usageMsg,
      type: isGroupTarget ? "group" : "phone",
      org_id: DEFAULT_CLASS_WORKSPACE_ID,
    });

    return NextResponse.json({ ok: false, error: "missing_identifier" });
  }

  const searchResult = await findAcademicTaskByIdentifier(cleanCmd, db);
  if (!searchResult.task) {
    await sendWhatsAppMessage({
      target: replyTarget,
      message: `⚠️ *Tugas Tidak Ditemukan*\n${searchResult.error || "Tugas tidak ditemukan."}`,
      type: isGroupTarget ? "group" : "phone",
      org_id: DEFAULT_CLASS_WORKSPACE_ID,
    });
    return NextResponse.json({ ok: false, error: "task_not_found" });
  }

  const task = searchResult.task;
  const courseName = task.course_name || task.subject_name || "Mata Kuliah";
  const taskTitle = task.name || task.title || "Tugas Kuliah";

  // 1. Update task di Firestore
  await db.collection("tasks").doc(task.id).update({
    status: "approved",
    is_archived: true,
    approved_by: adminUser.id,
    approved_by_name: adminUser.name,
    approved_by_role: "admin_komunitas",
    approved_at: FieldValue.serverTimestamp(),
    updated_at: FieldValue.serverTimestamp(),
  });

  // 2. Kirim konfirmasi singkat HANYA kepada admin pengirim (japri/grup diskusi)
  const confMsg = [
    "✅ *Tugas Ditutup & Diarsipkan*",
    `Tugas *${courseName} - ${taskTitle}* telah selesai/diarsipkan. Pengingat otomatis dinonaktifkan.`,
  ].join("\n");

  await sendWhatsAppMessage({
    target: replyTarget,
    message: confMsg,
    type: isGroupTarget ? "group" : "phone",
    org_id: DEFAULT_CLASS_WORKSPACE_ID,
  });

  return NextResponse.json({
    ok: true,
    taskId: task.id,
    action: isArchive ? "task_archived" : "task_completed",
  });
}

/**
 * Handles creation of academic tasks directly from WhatsApp commands:
 * Format 5 Parameter:
 * !tugas tambah [Matkul] | [Judul Tugas] | [Deskripsi/Ketentuan] | [Tenggat] | [Tempat Pengumpulan]
 * Format 4 Parameter:
 * !tugas tambah [Matkul] | [Judul Tugas] | [Tenggat] | [Tempat Pengumpulan]
 */
export async function handleCreateAcademicTaskFromWhatsApp(
  incoming: NormalizedIncomingWhatsAppMessage,
  rawText: string
): Promise<NextResponse> {
  const db = getAdminDb();
  const workspaceId = DEFAULT_CLASS_WORKSPACE_ID;
  const { isAdmin, adminUser, replyTarget, isGroupTarget } = await verifyAdminKomunitas(incoming, db);

  // 1. Verifikasi Jalur Pengiriman:
  // - Japri pribadi: diizinkan
  // - Grup diskusi kelas (120363432766465224@g.us): diizinkan
  // - Grup pengumuman komunitas (120363411033795051@g.us): BLOKIR / ABAIKAN
  const cleanIncomingGroup = incoming.groupId ? incoming.groupId.replace(/\D/g, "") : "";
  const cleanAnnouncementGroup = DEFAULT_CLASS_GROUP_ID.replace(/\D/g, "");
  const cleanDiscussionGroup = DEFAULT_CLASS_DISCUSSION_GROUP_ID.replace(/\D/g, "");

  if (incoming.isGroup) {
    if (cleanIncomingGroup === cleanAnnouncementGroup) {
      console.log("[AcademicTaskCreator] Blocked command in announcement group");
      return NextResponse.json({
        ok: true,
        ignored: true,
        reason: "announcement_group_is_broadcast_only",
      });
    }

    if (cleanIncomingGroup !== cleanDiscussionGroup) {
      console.log("[AcademicTaskCreator] Ignored command from non-class group:", incoming.groupId);
      return NextResponse.json({
        ok: true,
        ignored: true,
        reason: "command_only_allowed_in_class_discussion_or_private",
      });
    }
  }

  // 2. Validasi Hak Akses:
  if (!isAdmin || !adminUser) {
    const deniedMsg = [
      "⛔ *Akses Ditolak*",
      "Maaf, hanya *Admin Komunitas* yang memiliki izin untuk menambahkan tugas kelas via WhatsApp.",
      "",
      "Pastikan nomor WhatsApp Anda sudah terdaftar di profil JobDex.in.",
    ].join("\n");

    await sendWhatsAppMessage({
      target: replyTarget,
      message: deniedMsg,
      type: isGroupTarget ? "group" : "phone",
      org_id: workspaceId,
    });

    return NextResponse.json({ ok: false, error: "unauthorized_sender" }, { status: 403 });
  }

  // 3. Format Perintah 4 atau 5 parameter
  const cleanCmd = rawText.replace(/^[!/](?:jobde[xs]\s+)?tugas\s+tambah\s*/i, "").trim();
  const parts = cleanCmd.split("|").map((p) => p.trim());

  if (parts.length < 3 || !parts[0] || !parts[1] || !parts[2]) {
    const usageMsg = [
      "⚠️ *Format Perintah Tidak Sesuai*",
      "Gunakan salah satu format berikut:",
      "",
      "*Format 5 Parameter:*",
      "`!tugas tambah [Matkul] | [Judul] | [Deskripsi] | [Tenggat] | [Tempat Pengumpulan]`",
      "",
      "*Format 4 Parameter:*",
      "`!tugas tambah [Matkul] | [Judul] | [Tenggat] | [Tempat Pengumpulan]`",
      "",
      "*Contoh:*",
      "`!tugas tambah Pemrograman Web | REST API Next.js | Buat API CRUD dan push ke repo GitHub | 28/10/2026 23:59 | E-Learning Undiksha`",
    ].join("\n");

    await sendWhatsAppMessage({
      target: replyTarget,
      message: usageMsg,
      type: isGroupTarget ? "group" : "phone",
      org_id: workspaceId,
    });

    return NextResponse.json({ ok: false, error: "invalid_format" });
  }

  let courseName = "";
  let taskTitle = "";
  let description = "";
  let deadlineRaw = "";
  let submissionInput = "";

  if (parts.length >= 5) {
    // 5 Parameter: [Matkul] | [Judul] | [Deskripsi] | [Tenggat] | [Pengumpulan]
    courseName = parts[0];
    taskTitle = parts[1];
    description = parts[2];
    deadlineRaw = parts[3];
    submissionInput = parts[4];
  } else if (parts.length === 4) {
    courseName = parts[0];
    taskTitle = parts[1];
    // Periksa apakah parts[2] adalah tanggal tenggat yang valid
    const dateTry = parseAcademicDeadline(parts[2]);
    if (dateTry && !isNaN(dateTry.getTime())) {
      deadlineRaw = parts[2];
      submissionInput = parts[3];
      description = `Tugas mata kuliah ${courseName}. Selesaikan dan kumpulkan sesuai instruksi dosen pengampu.`;
    } else {
      // parts[2] adalah deskripsi, parts[3] adalah tenggat
      description = parts[2];
      deadlineRaw = parts[3];
      submissionInput = "E-Learning Undiksha";
    }
  } else {
    // 3 Parameter: [Matkul] | [Judul] | [Tenggat]
    courseName = parts[0];
    taskTitle = parts[1];
    deadlineRaw = parts[2];
    description = `Tugas mata kuliah ${courseName}. Selesaikan dan kumpulkan sesuai instruksi dosen pengampu.`;
    submissionInput = "E-Learning Undiksha";
  }

  const submissionUrl = resolveSubmissionText(submissionInput);

  // Parse tenggat
  const deadlineDate = parseAcademicDeadline(deadlineRaw);
  if (!deadlineDate || isNaN(deadlineDate.getTime())) {
    const dateErrMsg = [
      "⚠️ *Format Tanggal/Waktu Salah*",
      `Tidak dapat mengenali format tanggal: "${deadlineRaw}"`,
      "",
      "Gunakan salah satu format berikut:",
      "- *DD/MM/YYYY HH:mm* (Contoh: `28/10/2026 23:59`)",
      "- *YYYY-MM-DD HH:mm* (Contoh: `2026-10-28 23:59`)",
      "- *DD/MM/YYYY* (Tenggat otomatis pukul 23:59 WITA)",
    ].join("\n");

    await sendWhatsAppMessage({
      target: replyTarget,
      message: dateErrMsg,
      type: isGroupTarget ? "group" : "phone",
      org_id: workspaceId,
    });

    return NextResponse.json({ ok: false, error: "invalid_deadline_date" });
  }

  // 4. Simpan ke koleksi `tasks`
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
    description: description,
    submission_url: submissionUrl,
    submission_link: submissionUrl,
    deadline: deadlineDate.toISOString(),
    status: "belum_dimulai",
    priority: "sedang",
    pic_id: adminUser.id,
    coordinator_id: adminUser.id,
    created_by: adminUser.id,
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
  console.log(`[AcademicTaskCreator] Successfully saved task ${newTaskRef.id} for course ${courseName}`);

  // 5. Jika tenggat <= 3 hari, otomatis picu siaran tugas baru ke Grup Pengumuman Komunitas (120363411033795051@g.us)
  let broadcastResult = null;
  try {
    broadcastResult = await handleAcademicTaskCreated(newTaskRef.id, adminUser.id, db);
    console.log("[AcademicTaskCreator] Broadcast result:", broadcastResult);
  } catch (bcErr) {
    console.error("[AcademicTaskCreator] Error triggering broadcast:", bcErr);
  }

  // 6. Kirim pesan balasan konfirmasi ke tempat perintah diketik (japri / grup kelas)
  const confirmationMsg = [
    "✅ *Tugas Berhasil Disimpan!*",
    `Mata Kuliah: *${courseName}*`,
    `📝 *Tugas:* ${taskTitle}`,
    `⏰ *Tenggat:* ${formatWitaDate(deadlineDate)}`,
    `🔗 *Tempat Pengumpulan:* ${submissionUrl}`,
    "",
    `👉 Cek kalender & jadwal lengkap: ${PUBLIC_CLASS_SCHEDULE_URL}`,
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
    broadcastResult,
  });
}
