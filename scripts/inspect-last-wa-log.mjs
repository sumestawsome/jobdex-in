import fs from "fs";
import path from "path";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

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
let privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");

if (!getApps().length) {
  initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
  });
}
const db = getFirestore();

async function inspect() {
  const snap = await db.collection("whatsapp_logs").orderBy("created_at", "desc").limit(1).get();
  if (snap.empty) {
    console.log("No logs found");
    return;
  }
  const data = snap.docs[0].data();
  console.log("=== LATEST WHATSAPP DISPATCH LOG ===");
  console.log("ID       :", snap.docs[0].id);
  console.log("Target   :", data.recipient);
  console.log("Status   :", data.status);
  console.log("--- MESSAGE CONTENT ---");
  console.log(data.message_content);
  console.log("-----------------------");
}

inspect().catch(console.error);
