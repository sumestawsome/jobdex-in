import fs from 'fs';
import path from 'path';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

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

// 2. Inisialisasi Firebase Admin
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

const db = getFirestore();

async function resetAiUsage() {
  console.log("==================================================");
  console.log("🔄 RESET KUOTA AI HARIAN (TESTING SUPER ADMIN)");
  console.log("==================================================");

  const targetPhone = "6285119459703";
  const tz = process.env.APP_TIMEZONE || "Asia/Jakarta";

  let currentDate = new Date().toISOString().slice(0, 10);
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date());
    const v = Object.fromEntries(parts.map((p) => [p.type, p.value]));
    currentDate = `${v.year}-${v.month}-${v.day}`;
  } catch (err) {
    console.warn("Timezone calculation fallback:", err);
  }

  const docIdToday = `${targetPhone}_${currentDate}`;
  console.log(`📌 Target Nomor : ${targetPhone}`);
  console.log(`📌 Tanggal      : ${currentDate} (${tz})`);
  console.log(`📌 Target Doc ID: ${docIdToday}`);

  const docRef = db.collection("ai_daily_usage").doc(docIdToday);
  const doc = await docRef.get();

  if (doc.exists) {
    console.log("📄 Data sebelum reset:", doc.data());
    await docRef.delete();
    console.log(`✅ Dokumen '${docIdToday}' berhasil dihapus dari Firestore.`);
  } else {
    console.log(`ℹ️ Dokumen '${docIdToday}' belum ada di Firestore (counter sudah 0).`);
  }

  // Scan dokumen lain dengan awalan targetPhone untuk memastikan reset bersih
  const snap = await db.collection("ai_daily_usage").get();
  let resetOtherCount = 0;
  for (const d of snap.docs) {
    if (d.id.startsWith(targetPhone) && d.id !== docIdToday) {
      console.log(`🧹 Membersihkan riwayat lama: ${d.id}`);
      await d.ref.delete();
      resetOtherCount++;
    }
  }

  if (resetOtherCount > 0) {
    console.log(`✅ ${resetOtherCount} dokumen riwayat lama Super Admin lainnya berhasil dibersihkan.`);
  }

  console.log("==================================================");
  console.log("🎉 Reset kuota AI berhasil! Interaksi berikutnya akan memicu 'First Impression Wow'.");
  console.log("==================================================");
}

resetAiUsage().catch((err) => {
  console.error("❌ Gagal reset kuota AI:", err);
  process.exit(1);
});
