import "server-only";

import { NextResponse } from "next/server";
import { getAdminDb, FieldValue } from "@/lib/server/firebase-admin";
import {
  sendWhatsAppMessage,
  isGroupRecipient,
} from "@/lib/server/whatsapp";
import {
  handleAcademicTaskCreated,
  DEFAULT_CLASS_GROUP_ID,
  DEFAULT_CLASS_DISCUSSION_GROUP_ID,
  DEFAULT_CLASS_WORKSPACE_ID,
} from "@/lib/server/academic-broadcast";
import type { NormalizedIncomingWhatsAppMessage, UserProfile } from "@/types";

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
 * Handles creation of academic tasks directly from WhatsApp commands:
 * !tugas tambah [Mata Kuliah] | [Deskripsi/Ketentuan] | [Tenggat DD/MM/YYYY HH:mm atau YYYY-MM-DD]
 */
export async function handleCreateAcademicTaskFromWhatsApp(
  incoming: NormalizedIncomingWhatsAppMessage,
  rawText: string
): Promise<NextResponse> {
  const db = getAdminDb();
  const workspaceId = DEFAULT_CLASS_WORKSPACE_ID;
  const replyTarget = incoming.isGroup
    ? (incoming.groupId || DEFAULT_CLASS_DISCUSSION_GROUP_ID)
    : (incoming.sender || incoming.groupId || DEFAULT_CLASS_DISCUSSION_GROUP_ID);
  const isGroupTarget = incoming.isGroup || isGroupRecipient(replyTarget);

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

    // Jika dikirim dari grup lain selain grup diskusi kelas
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
  // Cek nomor pengirim: Hanya nomor WhatsApp yang terdaftar sebagai Admin Komunitas di ruang kerja kelas yang boleh menambah tugas.
  const senderPhone = normalizePhone(incoming.sender || "");
  console.log("[AcademicTaskCreator] Verifying admin status for sender:", senderPhone);

  let isAdminKomunitas = false;
  let adminUser: UserProfile | null = null;

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
          isAdminKomunitas = true;
          adminUser = { ...data, id: doc.id };
          break;
        }
      }
    }
  } catch (err) {
    console.error("[AcademicTaskCreator] Error reading users:", err);
  }

  // Fallback checks untuk nomor terdaftar Admin Komunitas
  if (!isAdminKomunitas) {
    if (senderPhone === "6285119459703" || senderPhone === "628814878194") {
      isAdminKomunitas = true;
      adminUser = {
        id: senderPhone === "6285119459703" ? "ls25IoTMA7dMP4NNb04XWeDxNAL2" : "iTR4JpIAn0WMjDtKIOi72VU2zO33",
        name: senderPhone === "6285119459703" ? "Putu Agus Sumerta Yasa" : "Made Darma Tanaya",
        email: senderPhone === "6285119459703" ? "agus.sumerta@student.undiksha.ac.id" : "cdnzidarma@gmail.com",
        whatsapp_number: senderPhone,
        role: "admin_komunitas",
        organization_id: workspaceId,
        division_id: "humas_media_kreatif",
        avatar_url: "",
        is_active: true,
      };
    }
  }

  if (!isAdminKomunitas || !adminUser) {
    console.log("[AcademicTaskCreator] Denied: sender is not Admin Komunitas:", senderPhone);
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

  // 3. Format Perintah:
  // !tugas tambah [Mata Kuliah] | [Deskripsi/Ketentuan] | [Tenggat DD/MM/YYYY HH:mm atau YYYY-MM-DD] | [Link/Tempat Pengumpulan (opsional)]
  const cleanCmd = rawText.replace(/^[!/](?:jobde[xs]\s+)?tugas\s+tambah\s*/i, "").trim();
  const parts = cleanCmd.split("|").map((p) => p.trim());

  if (parts.length < 3 || !parts[0] || !parts[1] || !parts[2]) {
    const usageMsg = [
      "⚠️ *Format Perintah Tidak Sesuai*",
      "Gunakan format berikut:",
      "*!tugas tambah [Mata Kuliah] | [Deskripsi/Ketentuan] | [Tenggat DD/MM/YYYY HH:mm] | [Link/Tempat Pengumpulan (opsional)]*",
      "",
      "*Contoh (dengan tempat pengumpulan):*",
      "`!tugas tambah Pemrograman Web | Bikin REST API Next.js & push ke GitHub | 28/10/2026 23:59 | E-learning Undiksha`",
      "",
      "*Contoh (default E-Learning Undiksha):*",
      "`!tugas tambah Basis Data | Praktikum Query SQL | 29/10/2026 23:59`",
    ].join("\n");

    await sendWhatsAppMessage({
      target: replyTarget,
      message: usageMsg,
      type: isGroupTarget ? "group" : "phone",
      org_id: workspaceId,
    });

    return NextResponse.json({ ok: false, error: "invalid_format" });
  }

  const courseName = parts[0];
  const description = parts[1];
  const deadlineRaw = parts[2];
  const submissionInput = parts[3] ? parts[3].trim() : "";
  const submissionUrl = submissionInput || "E-Learning Undiksha";

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
  const taskTitle = description.split("\n")[0].slice(0, 80) || `Tugas ${courseName}`;

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
    `Tugas *${courseName}* telah dicatat dan dijadwalkan pengingatnya.`,
    `🔗 *Tempat Pengumpulan:* ${submissionUrl}`,
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
    broadcastResult,
  });
}
