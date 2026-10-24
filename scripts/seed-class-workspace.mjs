import fs from "fs";
import path from "path";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

// 1. Load .env.local
const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      process.env[key] = val;
    }
  }
}

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, "\n"),
    }),
  });
}

const db = getFirestore();

async function main() {
  console.log("==================================================");
  console.log("🚀 PENDAFTARAN & PEMETAAN RUANG KERJA KELAS ILKOM 2024");
  console.log("==================================================");

  const workspaceId = "ws_ilkom_2024";
  const announcementGroupId = "120363411033795051@g.us"; // Coba JobdexIn (Broadcast Only)
  const discussionGroupId = "120363432766465224@g.us";   // CONTOH KELAS (Grup Diskusi & Command)

  const admin1Email = "agus.sumerta@student.undiksha.ac.id";
  const admin2Email = "cdnzidarma@gmail.com";

  // 1. Cari user Admin 1 (Putu Agus Sumerta Yasa)
  const usersSnap1 = await db.collection("users").where("email", "==", admin1Email).limit(1).get();
  let admin1Id = "ls25IoTMA7dMP4NNb04XWeDxNAL2";
  let admin1Name = "Putu Agus Sumerta Yasa";
  if (!usersSnap1.empty) {
    admin1Id = usersSnap1.docs[0].id;
    admin1Name = usersSnap1.docs[0].data().name || admin1Name;
    console.log(`✅ Ditemukan Akun Admin 1: ${admin1Name} (${admin1Id})`);
  }

  // 2. Cari user Admin 2 (Made Darma Tanaya)
  const usersSnap2 = await db.collection("users").where("email", "==", admin2Email).limit(1).get();
  let admin2Id = "iTR4JpIAn0WMjDtKIOi72VU2zO33";
  let admin2Name = "Made Darma Tanaya";
  if (!usersSnap2.empty) {
    admin2Id = usersSnap2.docs[0].id;
    admin2Name = usersSnap2.docs[0].data().name || admin2Name;
    console.log(`✅ Ditemukan Akun Admin 2: ${admin2Name} (${admin2Id})`);
  }

  // 3. Simpan ke koleksi `workspaces`
  const workspaceData = {
    id: workspaceId,
    name: "Ilmu Komputer Undiksha 2024",
    short_name: "ILKOM 24",
    institution: "Universitas Pendidikan Ganesha",
    campus_id: "univ-undiksha",
    campus_code: "UNDIKSHA",
    type: "kelas",
    status: "aktif",
    whatsapp_group_id: announcementGroupId,
    whatsapp_announcement_group_id: announcementGroupId,
    whatsapp_discussion_group_id: discussionGroupId,
    whatsapp_settings: {
      group_id: announcementGroupId,
      announcement_group_id: announcementGroupId,
      discussion_group_id: discussionGroupId,
      channel_type: "community_announcement",
      enabled: true,
    },
    reminder_rules: {
      milestones_days: [5, 3, 1],
      urgent_threshold_days: 3,
      cron_hour_wita: 12,
    },
    created_at: new Date().toISOString(),
    created_by: admin1Id,
    admin_komunitas_ids: [admin1Id, admin2Id],
    korti_id: admin1Id,
    korti_name: admin1Name,
    korti_email: admin1Email,
    updated_at: new Date().toISOString(),
  };

  await db.collection("workspaces").doc(workspaceId).set(workspaceData, { merge: true });
  console.log(`✅ Tersimpan di koleksi 'workspaces/${workspaceId}'`);

  // 4. Simpan ke koleksi `ormawas` & `organizations`
  const ormawaData = {
    id: workspaceId,
    campus_id: "univ-undiksha",
    campusId: "univ-undiksha",
    univ_id: "univ-undiksha",
    univId: "univ-undiksha",
    org_id: workspaceId,
    orgId: workspaceId,
    name: "Ilmu Komputer Undiksha 2024",
    short_name: "ILKOM 24",
    slug: "ilkom-undiksha-2024",
    type: "KELAS",
    workspace_type: "kelas",
    faculty: "Fakultas Teknik dan Kejuruan",
    description: "Ruang kerja akademik dan siaran pengumuman tugas kuliah Kelas Ilmu Komputer 2024.",
    member_count: 36,
    active_event_count: 0,
    active_task_count: 0,
    is_active: true,
    whatsapp_group_id: announcementGroupId,
    whatsapp_announcement_group_id: announcementGroupId,
    whatsapp_discussion_group_id: discussionGroupId,
    whatsapp_settings: {
      group_id: announcementGroupId,
      announcement_group_id: announcementGroupId,
      discussion_group_id: discussionGroupId,
      channel_type: "community_announcement",
      enabled: true,
    },
    reminder_rules: {
      milestones_days: [5, 3, 1],
      urgent_threshold_days: 3,
      cron_hour_wita: 12,
    },
    updated_at: FieldValue.serverTimestamp(),
  };

  await db.collection("ormawas").doc(workspaceId).set(ormawaData, { merge: true });
  console.log(`✅ Tersimpan di koleksi 'ormawas/${workspaceId}'`);

  await db.collection("organizations").doc(workspaceId).set({
    id: workspaceId,
    name: "Ilmu Komputer Undiksha 2024",
    short_name: "ILKOM 24",
    slug: "ilkom-undiksha-2024",
    campus_id: "univ-undiksha",
    type: "KELAS",
    workspace_type: "kelas",
    whatsapp_group_id: announcementGroupId,
    whatsapp_announcement_group_id: announcementGroupId,
    whatsapp_discussion_group_id: discussionGroupId,
    is_active: true,
    updated_at: FieldValue.serverTimestamp(),
  }, { merge: true });
  console.log(`✅ Tersimpan di koleksi 'organizations/${workspaceId}'`);

  // 5. Update user Admin 1 (Putu Agus Sumerta Yasa)
  const user1Ref = db.collection("users").doc(admin1Id);
  const user1Doc = await user1Ref.get();
  if (user1Doc.exists) {
    const roles = user1Doc.data().workspace_roles || {};
    await user1Ref.update({
      is_active: true,
      workspace_roles: {
        ...roles,
        [workspaceId]: "admin_komunitas",
      },
      workspaces: FieldValue.arrayUnion(workspaceId),
      updated_at: FieldValue.serverTimestamp(),
    });
    console.log(`✅ Admin Komunitas terpasang pada user: ${admin1Name} (${admin1Id})`);
  }

  // 6. Update user Admin 2 (Made Darma Tanaya)
  const user2Ref = db.collection("users").doc(admin2Id);
  const user2Doc = await user2Ref.get();
  if (user2Doc.exists) {
    const roles = user2Doc.data().workspace_roles || {};
    await user2Ref.update({
      is_active: true,
      workspace_roles: {
        ...roles,
        [workspaceId]: "admin_komunitas",
      },
      workspaces: FieldValue.arrayUnion(workspaceId),
      updated_at: FieldValue.serverTimestamp(),
    });
    console.log(`✅ Admin Komunitas terpasang pada user: ${admin2Name} (${admin2Id})`);
  }

  // 7. Update user Super Admin (Sumesta C)
  const superAdminId = "FWPlF693yff4Oee11vQm36tDqXW2";
  const saRef = db.collection("users").doc(superAdminId);
  const saDoc = await saRef.get();
  if (saDoc.exists) {
    const saRoles = saDoc.data().workspace_roles || {};
    await saRef.update({
      workspace_roles: {
        ...saRoles,
        [workspaceId]: "super_admin",
      },
      workspaces: FieldValue.arrayUnion(workspaceId),
      updated_at: FieldValue.serverTimestamp(),
    });
    console.log(`✅ Role Super Admin terpasang pada user: Sumesta C (${superAdminId})`);
  }

  console.log("==================================================");
  console.log("🎉 Berhasil memperbarui konfigurasi 2 grup dan anggota ILKOM 2024!");
  console.log("==================================================");
}

main().catch((err) => {
  console.error("❌ Gagal memperbarui ruang kerja kelas:", err);
  process.exit(1);
});
