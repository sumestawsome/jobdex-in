import fs from 'fs';
import path from 'path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

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
let privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;

if (!projectId || !clientEmail || !privateKey) {
  console.error("❌ Error: Firebase Admin credential variables are missing in .env.local");
  process.exit(1);
}

if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
  privateKey = privateKey.slice(1, -1);
}
privateKey = privateKey.replace(/\\n/g, '\n');

initializeApp({
  credential: cert({
    projectId,
    clientEmail,
    privateKey,
  }),
});

const db = getFirestore();

async function seedFaq() {
  console.log("==================================================");
  console.log("🚀 MEMULAI SEED FAQ KNOWLEDGE KE FIRESTORE");
  console.log("==================================================");

  const jsonFilePath = path.resolve(process.cwd(), 'data/faq-knowledge.json');
  if (!fs.existsSync(jsonFilePath)) {
    console.error(`❌ File ${jsonFilePath} tidak ditemukan!`);
    process.exit(1);
  }

  const rawJson = fs.readFileSync(jsonFilePath, 'utf-8');
  const faqs = JSON.parse(rawJson);

  console.log(`📋 Total data FAQ ditemukan: ${faqs.length} dokumen`);

  if (!Array.isArray(faqs) || faqs.length === 0) {
    console.error("❌ Format JSON tidak valid atau kosong.");
    process.exit(1);
  }

  const COLLECTION_NAME = 'faq_knowledge';
  const BATCH_SIZE = 50; // Ukuran batch aman (batas maksimal Firestore 500)
  let processedCount = 0;

  for (let i = 0; i < faqs.length; i += BATCH_SIZE) {
    const chunk = faqs.slice(i, i + BATCH_SIZE);
    const batch = db.batch();

    for (const faq of chunk) {
      const docRef = db.collection(COLLECTION_NAME).doc(faq.id);
      batch.set(docRef, {
        ...faq,
        updated_at: Timestamp.now(),
      }, { merge: true });
    }

    await batch.commit();
    processedCount += chunk.length;
    console.log(`✅ Batch commit sukses: ${processedCount}/${faqs.length} dokumen`);
  }

  console.log("--------------------------------------------------");
  console.log("⏳ Memverifikasi jumlah dokumen tersimpan di Firestore...");
  const snapshot = await db.collection(COLLECTION_NAME).get();
  console.log(`🎉 Total dokumen di koleksi '${COLLECTION_NAME}': ${snapshot.size}`);

  if (snapshot.size >= faqs.length) {
    console.log("✨ Seeding berhasil 100% tanpa kendala!");
  } else {
    console.warn(`⚠️ Peringatan: Dokumen di Firestore (${snapshot.size}) kurang dari data JSON (${faqs.length})`);
  }
  console.log("==================================================");
}

seedFaq().catch((err) => {
  console.error("❌ Gagal melakukan seed FAQ:", err);
  process.exit(1);
});
