import fs from "fs";
import path from "path";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

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
const auth = getAuth();

async function testReferences() {
  console.log("==================================================");
  console.log("🧪 UJI FILTERING & SINKRONISASI API REFERENSI");
  console.log("==================================================");

  // 1. Simulasikan fungsi isMatchingOrg dan isMatchingCampus dari api/references/route.ts
  const safeString = (val, fallback = "") => {
    if (val === null || val === undefined) return fallback;
    return String(val).trim();
  };

  const isMatchingOrg = (docOrg, targetOrg) => {
    if (!targetOrg) return true;
    const orgStr = safeString(docOrg || "main_org");
    const targetStr = safeString(targetOrg);
    if (orgStr === targetStr) return true;
    const isForkomKip = (o) => o === "main_org" || o === "org-undiksha-forkom-kip";
    return isForkomKip(orgStr) && isForkomKip(targetStr);
  };

  const isMatchingCampus = (docCampus, targetCampus) => {
    if (!targetCampus) return true;
    const campusStr = safeString(docCampus);
    if (!campusStr || campusStr === "" || campusStr === "ui") return true;
    if (campusStr === targetCampus) return true;
    const isUndiksha = (c) => c === "univ-undiksha" || c === "undiksha";
    return isUndiksha(campusStr) && isUndiksha(targetCampus);
  };

  const targetOrgId = "org-undiksha-forkom-kip"; // Permintaan dari frontend
  const targetCampusId = "univ-undiksha";         // Permintaan dari frontend

  console.log(`Filter Pengujian Frontend:`);
  console.log(`   org_id    : ${targetOrgId}`);
  console.log(`   campus_id : ${targetCampusId}`);
  console.log("--------------------------------------------------");

  // Ambil semua dokumen design_references
  const snap = await db.collection("design_references").get();
  console.log(`Total dokumen di koleksi design_references Firestore: ${snap.size}`);

  const passedDocs = [];
  snap.forEach((doc) => {
    const data = doc.data();
    const org = data.organization_id || data.org_id || data.orgId;
    if (!isMatchingOrg(org, targetOrgId)) return;

    const campus = data.campus_id || data.campusId || data.univ_id || data.univId;
    if (!isMatchingCampus(campus, targetCampusId)) return;

    passedDocs.push({ id: doc.id, title: data.title });
  });

  console.log(`Dokumen yang lolos filter (sesuai target): ${passedDocs.length} dokumen`);

  if (passedDocs.length === snap.size) {
    console.log(`✅ SEMPURNA: Seluruh ${snap.size} referensi desain lolos filter dan siap disajikan ke frontend!`);
  } else {
    console.log(`⚠️ Ada dokumen yang tidak lolos: ${snap.size - passedDocs.length} dokumen.`);
  }

  // Tampilkan 3 contoh pertama
  console.log("\nContoh 3 referensi pertama yang siap tampil:");
  passedDocs.slice(0, 3).forEach((d, idx) => {
    console.log(`   ${idx + 1}. [${d.id}] ${d.title}`);
  });

  // 2. Sekarang coba request HTTP nyata ke dev server jika aktif
  try {
    console.log("\n--------------------------------------------------");
    console.log("🌐 Menguji HTTP Request ke http://localhost:3000/api/references");
    
    // Dapatkan salah satu user untuk buat custom token
    const usersSnap = await db.collection("users").limit(1).get();
    if (!usersSnap.empty) {
      const uid = usersSnap.docs[0].id;
      const customToken = await auth.createCustomToken(uid);
      
      // Exchange custom token ke ID token via Firebase Auth REST API
      const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
      if (apiKey) {
        const verifyRes = await fetch(
          `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token: customToken, returnSecureToken: true }),
          }
        );
        const tokenData = await verifyRes.json();
        const idToken = tokenData.idToken;

        if (idToken) {
          const apiRes = await fetch(
            `http://localhost:3000/api/references?org_id=${targetOrgId}&campus_id=${targetCampusId}`,
            {
              headers: { Authorization: `Bearer ${idToken}` },
            }
          );
          
          if (apiRes.ok) {
            const apiJson = await apiRes.json();
            console.log(`✅ HTTP Response Status: ${apiRes.status} OK`);
            console.log(`✅ Jumlah referensi dikembalikan API: ${apiJson.references?.length ?? 0} referensi`);
          } else {
            console.log(`HTTP Response Status: ${apiRes.status} - ${await apiRes.text()}`);
          }
        }
      }
    }
  } catch (httpErr) {
    console.log("Catatan: Dev server request test diabaikan jika server tidak aktif:", httpErr.message);
  }

  console.log("==================================================");
}

testReferences().catch(console.error);
