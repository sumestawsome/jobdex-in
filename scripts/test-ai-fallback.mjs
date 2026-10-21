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

async function testDeepSeekDirectly() {
  console.log("=== 1. TEST DIRECT DEEPSEEK API ===");
  const apiKey = process.env.DEEPSEEK_API_KEY;
  console.log("API Key exists:", Boolean(apiKey), apiKey ? `(${apiKey.slice(0, 8)}...)` : "");

  if (!apiKey) {
    console.warn("DEEPSEEK_API_KEY is not set.");
    return;
  }

  const res = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: [
        {
          role: "system",
          content:
            "Kamu adalah asisten bot WhatsApp internal untuk ormawa Forkom KIP Undiksha. Gaya bicaramu ramah, santai, solutif, khas mahasiswa aktif, tidak kaku, dan langsung ke inti.",
        },
        { role: "user", content: "Halo bot, tugas apa yang lagi jalan sekarang?" },
      ],
      max_tokens: 150,
      temperature: 0.6,
    }),
  });

  console.log("DeepSeek HTTP Status:", res.status, res.statusText);
  if (res.ok) {
    const data = await res.json();
    console.log("DeepSeek Reply Text:\n", data.choices?.[0]?.message?.content);
  } else {
    console.error("DeepSeek Error:", await res.text());
  }
}

async function testDailyRateLimiter() {
  console.log("\n=== 2. TEST AI DAILY USAGE RATE LIMITER IN FIRESTORE ===");
  const testPhone = "6289999999999";
  const today = new Date().toISOString().slice(0, 10);
  const docId = `${testPhone}_${today}`;
  const docRef = db.collection("ai_daily_usage").doc(docId);

  // Set usage to 5
  await docRef.set({
    phone: testPhone,
    date: today,
    count: 5,
    last_used: new Date(),
  });
  console.log(`Set ${docId} usage to 5.`);

  // Verify
  const snap = await docRef.get();
  console.log("Current count in Firestore:", snap.data()?.count);
  console.log("Rate limiter check: count >= 5 is", snap.data()?.count >= 5);

  // Cleanup test doc
  await docRef.delete();
  console.log("Cleaned up test document.");
}

async function run() {
  await testDeepSeekDirectly();
  await testDailyRateLimiter();
}

run().catch(console.error);
