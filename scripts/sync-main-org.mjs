import fs from "fs";
import path from "path";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

// Load .env.local
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
  console.error("❌ Konfigurasi Firebase Admin tidak lengkap!");
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

async function syncMainOrg() {
  console.log("⏳ Memperbarui dokumen organizations/main_org...");
  const orgRef = db.collection("organizations").doc("main_org");
  const docSnap = await orgRef.get();

  const updateData = {
    name: "Forum Komunikasi KIP-Kuliah Undiksha",
    slug: "forkom-kip-undiksha",
    campus_id: "univ-undiksha",
    campus_name: "Universitas Pendidikan Ganesha",
    updated_at: Timestamp.now(),
  };

  if (!docSnap.exists) {
    await orgRef.set({
      id: "main_org",
      ...updateData,
      created_at: Timestamp.now(),
    });
    console.log("✅ Dokumen organizations/main_org baru berhasil dibuat!");
  } else {
    await orgRef.update(updateData);
    console.log("✅ Dokumen organizations/main_org berhasil diperbarui!");
  }

  const updatedSnap = await orgRef.get();
  console.log("Hasil dokumen:", updatedSnap.data());
}

syncMainOrg().catch(err => {
  console.error("❌ Error saat update organizations/main_org:", err);
  process.exit(1);
});
