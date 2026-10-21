import fs from 'fs';
import path from 'path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

const envPath = path.resolve(process.cwd(), '.env.local');
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

initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
    clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n'),
  }),
});

const db = getFirestore();

async function seed() {
  console.log("Seeding and syncing dashboard tasks for October 2026...");

  // 1. Update task asbWULnVdMGh24bBNWaR
  await db.collection('tasks').doc('asbWULnVdMGh24bBNWaR').set({
    name: "Feed IG: Pembukaan Pendaftaran Panitia PDK 2026",
    status: "menunggu_approval",
    priority: "kritis",
    type: "acara",
    event_id: "puFWsJ37Mrk4FVm11ewO",
    event_name: "PDK 2026",
    division_id: "div-humas",
    organization_id: "main_org",
    campus_id: "univ-undiksha",
    pic_id: "TbuItDnC2pRew3sUTUGpg9sOUT82",
    pic_name: "Budi Santoso",
    coordinator_id: "FWPlF693yff4Oee11vQm36tDqXW2",
    deadline: Timestamp.fromDate(new Date("2026-10-21T18:00:00.000Z")), // Today
    created_at: Timestamp.fromDate(new Date("2026-10-18T10:00:00.000Z")),
    updated_at: Timestamp.fromDate(new Date("2026-10-21T14:30:00.000Z")),
    is_archived: false,
    description: "Desain feed Instagram 3 slide carousel pengumuman oprec panitia PDK 2026.",
  }, { merge: true });
  console.log("Updated task asbWULnVdMGh24bBNWaR -> menunggu_approval (Hari Ini)");

  // 2. Update task 0nWOodpgVZDVt7LG99Pq
  await db.collection('tasks').doc('0nWOodpgVZDVt7LG99Pq').set({
    name: "Desain Banner Panggung Utama & Backdrop 4x3m",
    status: "stuck",
    priority: "tinggi",
    type: "acara",
    event_id: "puFWsJ37Mrk4FVm11ewO",
    event_name: "PDK 2026",
    division_id: "div-humas",
    organization_id: "main_org",
    campus_id: "univ-undiksha",
    pic_id: "TbuItDnC2pRew3sUTUGpg9sOUT82",
    pic_name: "Siti Rahma",
    coordinator_id: "FWPlF693yff4Oee11vQm36tDqXW2",
    deadline: Timestamp.fromDate(new Date("2026-10-22T18:00:00.000Z")), // Besok
    created_at: Timestamp.fromDate(new Date("2026-10-17T09:00:00.000Z")),
    updated_at: Timestamp.fromDate(new Date("2026-10-21T11:00:00.000Z")),
    is_archived: false,
    description: "Banner panggung PDK 2026 resolusi tinggi untuk cetak outdoor.",
  }, { merge: true });
  console.log("Updated task 0nWOodpgVZDVt7LG99Pq -> stuck (Besok)");

  // 3. Add / ensure task-approval-sertifikat-pdk
  await db.collection('tasks').doc('task-approval-sertifikat-pdk').set({
    name: "Desain Sertifikat Pemateri & Peserta Terakreditasi",
    status: "menunggu_approval",
    priority: "sedang",
    type: "acara",
    event_id: "puFWsJ37Mrk4FVm11ewO",
    event_name: "PDK 2026",
    division_id: "div-humas",
    organization_id: "main_org",
    campus_id: "univ-undiksha",
    pic_id: "ls25IoTMA7dMP4NNb04XWeDxNAL2",
    pic_name: "Dinda Putri",
    coordinator_id: "FWPlF693yff4Oee11vQm36tDqXW2",
    deadline: Timestamp.fromDate(new Date("2026-10-25T16:00:00.000Z")),
    created_at: Timestamp.fromDate(new Date("2026-10-19T08:00:00.000Z")),
    updated_at: Timestamp.fromDate(new Date("2026-10-21T09:15:00.000Z")),
    is_archived: false,
    description: "Template vector sertifikat PDF pemateri dan peserta terakreditasi.",
  }, { merge: true });
  console.log("Ensured task-approval-sertifikat-pdk -> menunggu_approval (25 Okt)");

  // 4. Add / ensure task-revisi-logo-pdk
  await db.collection('tasks').doc('task-revisi-logo-pdk').set({
    name: "Logo Resmi & Maskot PDK 2026",
    status: "perlu_revisi",
    priority: "sedang",
    type: "acara",
    event_id: "puFWsJ37Mrk4FVm11ewO",
    event_name: "PDK 2026",
    division_id: "div-humas",
    organization_id: "main_org",
    campus_id: "univ-undiksha",
    pic_id: "xHGSZHJJVhZKW9MYiPLOpOLdRi43",
    pic_name: "Rian Wicaksono",
    coordinator_id: "FWPlF693yff4Oee11vQm36tDqXW2",
    deadline: Timestamp.fromDate(new Date("2026-10-23T12:00:00.000Z")),
    created_at: Timestamp.fromDate(new Date("2026-10-18T11:00:00.000Z")),
    updated_at: Timestamp.fromDate(new Date("2026-10-20T17:00:00.000Z")),
    is_archived: false,
    description: "Revisi proporsi warna emas & biru navy pada maskot.",
  }, { merge: true });
  console.log("Ensured task-revisi-logo-pdk -> perlu_revisi (23 Okt)");

  console.log("Seed completed successfully!");
}

seed().catch(err => {
  console.error("Seed error:", err);
  process.exit(1);
});
