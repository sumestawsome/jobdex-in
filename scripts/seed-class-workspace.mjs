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
  console.log("🚀 PENDAFTARAN RUANG KERJA KELAS ILMU KOMPUTER 2024");
  console.log("==================================================");

  const workspaceId = "ws_ilkom_2024";
  const kortiEmail = "agus.sumerta@student.undiksha.ac.id";
  const targetGroupId = "120363411033795051@g.us";

  // 1. Cari user Korti
  const usersSnap = await db
    .collection("users")
    .where("email", "==", kortiEmail)
    .limit(1)
    .get();

  let kortiUserId = "ls25IoTMA7dMP4NNb04XWeDxNAL2";
  let kortiName = "Putu Agus Sumerta Yasa";

  if (!usersSnap.empty) {
    const uDoc = usersSnap.docs[0];
    kortiUserId = uDoc.id;
    kortiName = uDoc.data().name || kortiName;
    console.log(`✅ Ditemukan akun Korti: ${kortiName} (${kortiUserId})`);
  } else {
    console.log(`ℹ️ Menggunakan fallback ID Korti: ${kortiUserId}`);
  }

  // 2. Simpan ke koleksi `workspaces` (Blueprint Baru)
  const workspaceData = {
    id: workspaceId,
    name: "Ilmu Komputer Undiksha 2024",
    short_name: "ILKOM 24",
    institution: "Universitas Pendidikan Ganesha",
    campus_id: "univ-undiksha",
    campus_code: "UNDIKSHA",
    type: "kelas",
    status: "aktif",
    whatsapp_settings: {
      group_id: targetGroupId,
      channel_type: "community_announcement",
      enabled: true,
    },
    reminder_rules: {
      milestones_days: [5, 3, 1],
      urgent_threshold_days: 3,
      cron_hour_wita: 12,
    },
    created_at: new Date().toISOString(),
    created_by: kortiUserId,
    korti_id: kortiUserId,
    korti_name: kortiName,
    korti_email: kortiEmail,
    updated_at: new Date().toISOString(),
  };

  await db.collection("workspaces").doc(workspaceId).set(workspaceData, { merge: true });
  console.log(`✅ Tersimpan di koleksi 'workspaces/${workspaceId}'`);

  // 3. Simpan ke koleksi `ormawas` & `organizations` agar kompatibel penuh dengan dropdown & switcher
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
    whatsapp_group_id: targetGroupId,
    whatsapp_settings: {
      group_id: targetGroupId,
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
    whatsapp_group_id: targetGroupId,
    is_active: true,
    updated_at: FieldValue.serverTimestamp(),
  }, { merge: true });
  console.log(`✅ Tersimpan di koleksi 'organizations/${workspaceId}'`);

  // 4. Update role Korti di dokumen user
  const kortiRef = db.collection("users").doc(kortiUserId);
  const kortiDoc = await kortiRef.get();
  if (kortiDoc.exists) {
    const existingRoles = kortiDoc.data().workspace_roles || {};
    await kortiRef.update({
      workspace_roles: {
        ...existingRoles,
        [workspaceId]: "korti",
      },
      updated_at: FieldValue.serverTimestamp(),
    });
    console.log(`✅ Role Korti terpasang pada user ${kortiName} (${kortiUserId})`);
  }

  // 5. Update role Super Admin untuk user Sumesta C
  const superAdminId = "FWPlF693yff4Oee11vQm36tDqXW2";
  const superAdminRef = db.collection("users").doc(superAdminId);
  const saDoc = await superAdminRef.get();
  if (saDoc.exists) {
    const saRoles = saDoc.data().workspace_roles || {};
    await superAdminRef.update({
      workspace_roles: {
        ...saRoles,
        [workspaceId]: "super_admin",
      },
      updated_at: FieldValue.serverTimestamp(),
    });
    console.log(`✅ Role Super Admin terpasang pada user Sumesta C (${superAdminId})`);
  }

  console.log("==================================================");
  console.log("🎉 Berhasil mendaftarkan Ruang Kerja Kelas Ilmu Komputer 2024!");
  console.log("==================================================");
}

main().catch((err) => {
  console.error("❌ Gagal mendaftarkan ruang kerja kelas:", err);
  process.exit(1);
});
