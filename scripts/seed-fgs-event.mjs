import fs from 'fs';
import path from 'path';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp, FieldValue } from 'firebase-admin/firestore';

// 1. Muat Environment Variables dari .env.local
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      process.env[key] = val;
    }
  }
}

const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
let privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  });
}

const auth = getAuth();
const db = getFirestore();

async function seed() {
  console.log("==================================================");
  console.log("🚀 PENDAFTARAN ANGGOTA BARU & PEMBUATAN ACARA FGS");
  console.log("==================================================");

  // 1. Pendaftaran Anggota Baru: Putu Srisila Brata
  console.log("⏳ 1. Mendaftarkan akun Putu Srisila Brata...");
  const newMemberEmail = "sila@gmail.com";
  const newMemberPhone = "6287842247411";
  const newMemberName = "Putu Srisila Brata";
  const defaultPassword = "SILA123";

  let silaUid = "";
  try {
    const existingAuthUser = await auth.getUserByEmail(newMemberEmail);
    silaUid = existingAuthUser.uid;
    console.log(`ℹ️ User sudah terdaftar di Firebase Auth (UID: ${silaUid})`);
  } catch (err) {
    const newAuthUser = await auth.createUser({
      email: newMemberEmail,
      password: defaultPassword,
      displayName: newMemberName,
    });
    silaUid = newAuthUser.uid;
    console.log(`✅ User berhasil dibuat di Firebase Auth (UID: ${silaUid})`);
  }

  // Simpan data profil ke Firestore
  const userProfileData = {
    id: silaUid,
    uid: silaUid,
    name: newMemberName,
    email: newMemberEmail,
    whatsapp_number: newMemberPhone,
    role: "anggota",
    division_id: "humas_media_kreatif",
    division_name: "Humas dan Media Kreatif",
    organization_id: "main_org",
    org_id: "main_org",
    orgId: "main_org",
    campus_id: "univ-undiksha",
    univ_id: "univ-undiksha",
    univId: "univ-undiksha",
    is_active: true,
    avatar_url: "",
    updated_at: FieldValue.serverTimestamp(),
  };

  await db.collection("users").doc(silaUid).set(userProfileData, { merge: true });
  await auth.setCustomUserClaims(silaUid, {
    role: "anggota",
    org_id: "main_org",
    univ_id: "univ-undiksha",
    division_id: "humas_media_kreatif",
  });
  console.log("✅ Profil Firestore & Custom Claims Putu Srisila Brata tersimpan!");

  // 2. Buat Acara Baru: Forkom Goes To School (FGS)
  console.log("\n⏳ 2. Membuat/memperbarui Acara: Forkom Goes To School (FGS)...");
  const eventName = "Forkom Goes To School (FGS)";
  const eventGroupId = "120363431421318562@g.us";

  let eventId = "";
  const existingEventsSnap = await db
    .collection("events")
    .where("name", "==", eventName)
    .limit(1)
    .get();

  if (!existingEventsSnap.empty) {
    eventId = existingEventsSnap.docs[0].id;
    console.log(`ℹ️ Acara '${eventName}' sudah ada (ID: ${eventId})`);
  } else {
    // Cari apakah ada FGS dengan WhatsApp group yang sama
    const existingGroupSnap = await db
      .collection("events")
      .where("whatsapp_group_id", "==", eventGroupId)
      .limit(1)
      .get();

    if (!existingGroupSnap.empty) {
      eventId = existingGroupSnap.docs[0].id;
      console.log(`ℹ️ Acara dengan WhatsApp Group ${eventGroupId} ditemukan (ID: ${eventId})`);
    } else {
      const newEventRef = db.collection("events").doc();
      eventId = newEventRef.id;
      console.log(`✨ Membuat dokumen acara baru (ID: ${eventId})`);
    }
  }

  // ID Pengurus dari data yang ada di Firestore:
  const coordId = "xHGSZHJJVhZKW9MYiPLOpOLdRi43"; // Gede Suma Wardana (wardana@humediktif.jaya / 6285942520570)
  const secId = "RiNzSKXEttXHgNJlrrzNu9iwatB2";   // Ni Putu Ayu Anin Dianary (anin@humediktif.jaya / 6285157786754)
  const creatorId = "FWPlF693yff4Oee11vQm36tDqXW2"; // Sumesta C (Super Admin)

  const eventPayload = {
    id: eventId,
    name: eventName,
    description: "Kegiatan sosialisasi dan pengabdian Forkom KIP Undiksha ke sekolah-sekolah.",
    event_date: Timestamp.fromDate(new Date("2026-11-20T00:00:00.000Z")),
    coordinator_id: coordId,
    secretary_id: secId,
    status: "persiapan",
    progress_percentage: 0,
    whatsapp_group_id: eventGroupId,
    whatsapp_group_name: eventName,
    whatsapp_group_verified: true,
    whatsapp_group_source: "admin_input",
    organization_id: "main_org",
    org_id: "main_org",
    orgId: "main_org",
    campus_id: "univ-undiksha",
    univ_id: "univ-undiksha",
    univId: "univ-undiksha",
    division_id: "humas_media_kreatif",
    design_kit_color_palette: [], // Kosongkan / status menyusul
    design_kit_visual_direction: "Menyusul",
    design_kit_notes_for_team: "Identitas visual dan arahan desain menyusul setelah rapat kepanitiaan pertama.",
    created_by: creatorId,
    updated_at: FieldValue.serverTimestamp(),
  };

  await db.collection("events").doc(eventId).set(eventPayload, { merge: true });
  console.log(`✅ Dokumen Acara '${eventName}' tersimpan di Firestore!`);

  // 3. Susunan Kepanitiaan (Sie Publikasi dan Dokumentasi)
  console.log("\n⏳ 3. Menautkan susunan panitia ke subkoleksi event_members...");
  const committeeMembers = [
    {
      userId: coordId,
      name: "Gede Suma Wardana",
      email: "wardana@humediktif.jaya",
      phone: "6285942520570",
      role: "Koordinator Acara",
    },
    {
      userId: secId,
      name: "Ni Putu Ayu Anin Dianary",
      email: "anin@humediktif.jaya",
      phone: "6285157786754",
      role: "Sekretaris Acara",
    },
    {
      userId: "ls25IoTMA7dMP4NNb04XWeDxNAL2",
      name: "Putu Agus Sumerta Yasa",
      email: "agus.sumerta@student.undiksha.ac.id",
      phone: "6285119459703",
      role: "Anggota Sie Publikasi dan Dokumentasi",
    },
    {
      userId: "TbuItDnC2pRew3sUTUGpg9sOUT82",
      name: "Irfan Dwi Prasetyo",
      email: "irfan.dwi@student.undiksha.ac.id",
      phone: "62895804212826",
      role: "Anggota Sie Publikasi dan Dokumentasi",
    },
    {
      userId: "iTR4JpIAn0WMjDtKIOi72VU2zO33",
      name: "Made Darma Tanaya",
      email: "cdnzidarma@gmail.com",
      phone: "628814878194",
      role: "Anggota Sie Publikasi dan Dokumentasi",
    },
    {
      userId: "jMD4pA8vGJeAcTaVMrz9zeQcfTO2",
      name: "Kadek Cheentya Wangi",
      email: "cici@humediktif.jaya",
      phone: "6287839040717",
      role: "Anggota Sie Publikasi dan Dokumentasi",
    },
    {
      userId: silaUid,
      name: newMemberName,
      email: newMemberEmail,
      phone: newMemberPhone,
      role: "Anggota Sie Publikasi dan Dokumentasi",
    },
  ];

  for (const m of committeeMembers) {
    const memberDocRef = db.collection("events").doc(eventId).collection("event_members").doc(m.userId);
    await memberDocRef.set({
      id: m.userId,
      event_id: eventId,
      user_id: m.userId,
      organization_id: "main_org",
      org_id: "main_org",
      orgId: "main_org",
      campus_id: "univ-undiksha",
      campusId: "univ-undiksha",
      univ_id: "univ-undiksha",
      univId: "univ-undiksha",
      role_in_event: m.role,
      added_by: creatorId,
      added_at: FieldValue.serverTimestamp(),
    }, { merge: true });

    console.log(`   👤 ${m.name} -> ${m.role}`);
  }

  console.log("==================================================");
  console.log("🎉 SELURUH DATA KEPANITIAAN FGS BERHASIL DIDAFTARKAN!");
  console.log("==================================================");
}

seed().catch((err) => {
  console.error("❌ Gagal seed FGS event & users:", err);
  process.exit(1);
});
