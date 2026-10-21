import fs from "fs";
import path from "path";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

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
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      process.env[key] = val;
    }
  }
}

const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
let privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;

if (!projectId || !clientEmail || !privateKey) {
  console.error("❌ Konfigurasi Firebase Admin tidak lengkap di .env.local!");
  process.exit(1);
}

privateKey = privateKey.replace(/\\n/g, "\n");

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

async function runCheck() {
  console.log("==================================================");
  console.log("🔍 AUDIT KONEKSI & DATABASE FIRESTORE JOBDEX.IN");
  console.log("==================================================");
  console.log(`📌 Project ID   : ${projectId}`);
  console.log(`📌 Client Email : ${clientEmail}`);
  console.log("--------------------------------------------------");

  try {
    // a. Ping / List Collections
    console.log("⏳ 1. Mengetes koneksi Firestore (listCollections)...");
    const collections = await db.listCollections();
    const colNames = collections.map((c) => c.id);
    console.log(`✅ Berhasil terhubung ke Firestore!`);
    console.log(`📂 Koleksi yang ditemukan di root: ${colNames.join(", ") || "(tidak ada koleksi)"}\n`);

    // b. Hitung dokumen di koleksi
    const targetCollections = [
      "users",
      "tasks",
      "events",
      "design_references",
      "references",
      "campuses",
      "ormawas",
      "organizations",
      "divisions",
    ];

    console.log("⏳ 2. Menghitung jumlah dokumen per koleksi:");
    for (const colName of targetCollections) {
      try {
        const countSnap = await db.collection(colName).count().get();
        const count = countSnap.data().count;
        console.log(`   - [${colName}]: ${count} dokumen`);
      } catch (err) {
        console.log(`   - [${colName}]: Error saat menghitung (${err.message})`);
      }
    }
    console.log("");

    // c. Sampel dokumen design_references (atau references)
    console.log("⏳ 3. Mengambil sampel 1 dokumen dari 'design_references':");
    const refSnap = await db.collection("design_references").limit(1).get();
    if (!refSnap.empty) {
      const doc = refSnap.docs[0];
      const data = doc.data();
      console.log(`   ID Dokumen: ${doc.id}`);
      console.log(`   Field organization_id: ${JSON.stringify(data.organization_id)}`);
      console.log(`   Field campus_id      : ${JSON.stringify(data.campus_id)}`);
      console.log(`   Field title / name   : ${JSON.stringify(data.title || data.name)}`);
      console.log(`   Field category       : ${JSON.stringify(data.category)}`);
      console.log(`   Field created_at     : ${JSON.stringify(data.created_at || data.createdAt)}`);
      console.log(`   Semua keys dokumen   : ${Object.keys(data).join(", ")}`);
    } else {
      console.log("   ⚠️ Koleksi 'design_references' KOSONG!");
      // Coba cek 'references' jika ada
      const altRefSnap = await db.collection("references").limit(1).get();
      if (!altRefSnap.empty) {
        const doc = altRefSnap.docs[0];
        const data = doc.data();
        console.log(`   (Ditemukan di koleksi 'references'! ID: ${doc.id})`);
        console.log(`   Field organization_id: ${JSON.stringify(data.organization_id)}`);
        console.log(`   Field campus_id      : ${JSON.stringify(data.campus_id)}`);
        console.log(`   Semua keys dokumen   : ${Object.keys(data).join(", ")}`);
      } else {
        console.log("   ⚠️ Koleksi 'references' juga KOSONG!");
      }
    }
    console.log("");

    // d. Sampel dokumen tasks
    console.log("⏳ 4. Mengambil sampel 1 dokumen dari 'tasks':");
    const taskSnap = await db.collection("tasks").limit(1).get();
    if (!taskSnap.empty) {
      const doc = taskSnap.docs[0];
      const data = doc.data();
      console.log(`   ID Dokumen: ${doc.id}`);
      console.log(`   Field organization_id: ${JSON.stringify(data.organization_id)}`);
      console.log(`   Field campus_id      : ${JSON.stringify(data.campus_id)}`);
      console.log(`   Field title          : ${JSON.stringify(data.title)}`);
      console.log(`   Field event_id       : ${JSON.stringify(data.event_id)}`);
      console.log(`   Field division_id    : ${JSON.stringify(data.division_id)}`);
      console.log(`   Field status         : ${JSON.stringify(data.status)}`);
      console.log(`   Semua keys dokumen   : ${Object.keys(data).join(", ")}`);
    } else {
      console.log("   ⚠️ Koleksi 'tasks' KOSONG!");
    }
    console.log("");

    // e. Sampel dokumen users, campuses, ormawas
    console.log("⏳ 5. Cek sampel data organisasi / kampus / ormawa:");
    const campusSnap = await db.collection("campuses").limit(1).get();
    if (!campusSnap.empty) {
      console.log(`   Contoh Campus ID: ${campusSnap.docs[0].id} => name: "${campusSnap.docs[0].data().name}"`);
    }
    const ormawaSnap = await db.collection("ormawas").limit(1).get();
    if (!ormawaSnap.empty) {
      const ormData = ormawaSnap.docs[0].data();
      console.log(`   Contoh Ormawa ID: ${ormawaSnap.docs[0].id} => name: "${ormData.name}", campus_id: "${ormData.campus_id}"`);
    }

    console.log("==================================================");
    console.log("✅ Audit selesai dijalankan.");
    console.log("==================================================");
  } catch (err) {
    console.error("❌ Terjadi kesalahan saat audit:", err);
  }
}

runCheck();
