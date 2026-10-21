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
const fonnteToken = process.env.FONNTE_API_TOKEN;
const fonnteUrl = process.env.FONNTE_API_URL || "https://api.fonnte.com/send";
const cronSecret = process.env.CRON_SECRET || "jobdexin_unsigned";
const SANDBOX_TARGET = "120363406824082148@g.us";

if (!projectId || !clientEmail || !privateKey) {
  console.error("❌ Konfigurasi Firebase Admin tidak lengkap di .env.local");
  process.exit(1);
}

if (!fonnteToken) {
  console.error("❌ FONNTE_API_TOKEN tidak ditemukan di .env.local");
  process.exit(1);
}

if (!getApps().length) {
  initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
  });
}
const db = getFirestore();

function formatIndonesianDate(date) {
  if (!date) return "-";
  const months = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
  ];
  return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
}

async function runCronTest() {
  console.log("=================================================================");
  console.log("🚀 SIMULASI CRON & AUDIT WHATSAPP GATEWAY FONNTE (SANDBOX MODE)");
  console.log("=================================================================");
  console.log(`📌 Target JID Sandbox : ${SANDBOX_TARGET}`);
  console.log(`📌 Provider           : FONNTE (${fonnteUrl})`);
  console.log(`📌 CRON Secret        : ${cronSecret}`);
  console.log("-----------------------------------------------------------------\n");

  // Step 1: Check Sandbox Settings in Firestore
  console.log("⏳ 1. Memeriksa pengaturan Sandbox di Firestore (system_settings/whatsapp)...");
  const settingsDoc = await db.collection("system_settings").doc("whatsapp").get();
  const settingsData = settingsDoc.exists ? settingsDoc.data() : {};
  const isSandboxActive = Boolean(settingsData.isTestMode ?? settingsData.sandbox_mode ?? true);
  console.log(`   - Status Sandbox Firestore : ${isSandboxActive ? "AKTIF ✅" : "NONAKTIF ⚠️"}`);
  console.log(`   - Test Group ID Firestore  : ${settingsData.testGroupId || settingsData.sandbox_group_id || SANDBOX_TARGET}`);

  // Step 2: Fetch tasks, users, events, divisions
  console.log("\n⏳ 2. Mengambil data tugas aktif dari Firestore...");
  const [tasksSnap, usersSnap, eventsSnap, divisionsSnap] = await Promise.all([
    db.collection("tasks").get(),
    db.collection("users").get(),
    db.collection("events").get(),
    db.collection("divisions").get(),
  ]);

  const usersMap = new Map();
  usersSnap.forEach((d) => usersMap.set(d.id, { id: d.id, ...d.data() }));

  const eventsMap = new Map();
  eventsSnap.forEach((d) => eventsMap.set(d.id, { id: d.id, ...d.data() }));

  const divisionsMap = new Map();
  divisionsSnap.forEach((d) => divisionsMap.set(d.id, { id: d.id, ...d.data() }));

  const activeTasks = [];
  tasksSnap.forEach((d) => {
    const data = d.data();
    if (!data.is_archived && data.status !== "approved" && data.status !== "selesai") {
      activeTasks.push({ id: d.id, ...data });
    }
  });

  console.log(`   - Total task terdaftar : ${tasksSnap.size}`);
  console.log(`   - Task aktif berjalan  : ${activeTasks.length}`);

  // Step 3: Format Rekap Pesan Deadline
  console.log("\n⏳ 3. Menyusun rekap pesan notifikasi WhatsApp...");
  const today = new Date();
  const dateString = formatIndonesianDate(today);

  let taskListText = "";
  if (activeTasks.length > 0) {
    taskListText = activeTasks.map((t, idx) => {
      const taskTitle = t.name || t.title || "Tugas Tanpa Judul";
      const pic = t.pic_id ? usersMap.get(t.pic_id) : null;
      const picName = pic?.name || "Belum ada PIC";
      const picPhone = pic?.whatsapp_number ? `@${pic.whatsapp_number.replace(/\D/g, "")}` : "";
      const picDisplay = picPhone ? `${picPhone} (${picName})` : picName;
      
      let parentName = "-";
      if (t.type === "acara" && t.event_id) {
        parentName = eventsMap.get(t.event_id)?.name || "Kepanitiaan Acara";
      } else if (t.division_id) {
        parentName = divisionsMap.get(t.division_id)?.name || "Humas dan Media Kreatif";
      }

      let deadlineStr = "-";
      if (t.deadline) {
        const dDate = t.deadline._seconds ? new Date(t.deadline._seconds * 1000) : (t.deadline.toDate ? t.deadline.toDate() : new Date(t.deadline));
        deadlineStr = formatIndonesianDate(dDate);
      }

      let statusLabel = t.status || "sedang_dikerjakan";
      if (statusLabel === "perlu_revisi") statusLabel = "Perlu Revisi ⚠️";
      else if (statusLabel === "sedang_dikerjakan") statusLabel = "Sedang Dikerjakan ⏳";
      else if (statusLabel === "belum_dimulai") statusLabel = "Belum Dimulai 📋";
      else if (statusLabel === "stuck") statusLabel = "Stuck 🚨";
      else if (statusLabel === "butuh_bantuan") statusLabel = "Butuh Bantuan 🆘";
      else if (statusLabel === "menunggu_materi") statusLabel = "Menunggu Materi 📥";
      else if (statusLabel === "menunggu_approval") statusLabel = "Menunggu Approval 👀";

      return `${idx + 1}. *${taskTitle}*\n   • Acara/Divisi: ${parentName}\n   • PIC: ${picDisplay}\n   • Deadline: ${deadlineStr}\n   • Status: ${statusLabel}`;
    }).join("\n\n");
  } else {
    taskListText = "Tidak ada tugas mendesak atau mendekati deadline hari ini. Semua pengerjaan aman terkendali! 🎉";
  }

  const baseMessage = [
    `📢 *Halo rekan-rekan Forkom KIP!*`,
    `Ini rekap tugas yang lagi jalan dan butuh dicek per siang ini (${dateString}):`,
    "",
    taskListText,
    "",
    "Yuk yang belum update atau mau nyetor draf, bisa langsung setor yaa. Semangat! 🔥",
    "👉 Cek dashboard: https://jobdexin.sumestawsome.xyz/dashboard/tasks",
  ].join("\n");

  // Step 4: Apply Sandbox Interceptor
  let finalMessage = baseMessage;
  let finalTarget = SANDBOX_TARGET;

  if (isSandboxActive) {
    finalTarget = SANDBOX_TARGET;
    finalMessage = [
      `🧪 *[SIMULASI SANDBOX]* (Dialihkan dari: ${settingsData.testGroupId || SANDBOX_TARGET})`,
      "",
      baseMessage,
    ].join("\n");
  }

  console.log(`   - Penerima Efektif : ${finalTarget}`);
  console.log(`   - Panjang Pesan    : ${finalMessage.length} karakter`);

  // Step 5: Send directly via Fonnte API
  console.log("\n⏳ 4. Mengirim pesan rekap ke Fonnte Gateway API...");
  try {
    const postBody = {
      target: finalTarget,
      message: finalMessage,
      countryCode: "62",
    };

    const res = await fetch(fonnteUrl, {
      method: "POST",
      headers: {
        Authorization: fonnteToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(postBody),
    });

    const resText = await res.text();
    let resJson = null;
    try {
      resJson = JSON.parse(resText);
    } catch {
      resJson = null;
    }

    console.log(`   - HTTP Status Code : ${res.status} ${res.statusText}`);
    console.log(`   - Raw Response Text: ${resText}`);
    console.log(`   - Parsed JSON      :`, JSON.stringify(resJson, null, 2));

    const isSuccess = res.ok && (resJson?.status === true || resJson?.status === "true");

    if (isSuccess) {
      console.log("\n✅ [BERHASIL] Pesan WhatsApp Rekap Deadline TERKIRIM via Fonnte!");
      console.log(`   - Fonnte ID   : ${resJson.id || resJson.process || "OK"}`);
      console.log(`   - Target      : ${finalTarget}`);

      // Log into Firestore whatsapp_logs
      const logRef = db.collection("whatsapp_logs").doc();
      await logRef.set({
        id: logRef.id,
        organization_id: "main_org",
        event_type: "cron_deadline_digest_simulation",
        message_content: finalMessage,
        recipient: finalTarget,
        recipient_type: "group",
        is_group: true,
        status: "sent",
        wablas_response: resText,
        provider: "fonnte",
        target_type: "group",
        created_at: FieldValue.serverTimestamp(),
      });
      console.log(`   - Log Firestore tersimpan di whatsapp_logs/${logRef.id}`);
    } else {
      console.error("\n❌ [GAGAL] Fonnte mengembalikan status error!");
      console.error(`   - Detail Error: ${resJson?.reason || resJson?.message || resText}`);
    }

    // Step 6: Test HTTP Cron Endpoint Authorization
    console.log("\n⏳ 5. Menguji Endpoint Vercel Cron via HTTP (Bearer & Query Secret)...");
    const testEndpoints = [
      {
        name: "Bearer Header (Format Resmi Vercel Cron)",
        url: "http://localhost:3000/api/cron/deadline-reminders?dryRun=true",
        headers: { Authorization: `Bearer ${cronSecret}` },
      },
      {
        name: "Query Param (?secret=...)",
        url: `http://localhost:3000/api/cron/deadline-reminders?secret=${cronSecret}&dryRun=true`,
        headers: {},
      },
      {
        name: "Invalid Secret (Harus 401)",
        url: "http://localhost:3000/api/cron/deadline-reminders?secret=wrong_secret",
        headers: {},
      },
    ];

    for (const ep of testEndpoints) {
      try {
        const cronRes = await fetch(ep.url, {
          method: "GET",
          headers: ep.headers,
        });
        const cronJson = await cronRes.json().catch(() => ({}));
        console.log(`   - [${ep.name}] -> HTTP ${cronRes.status}:`, cronJson.ok !== undefined ? `ok: ${cronJson.ok}` : cronJson.error);
      } catch (err) {
        console.log(`   - [${ep.name}] -> Dev server tidak aktif atau error: ${err.message}`);
      }
    }

    console.log("\n=================================================================");
    console.log("🏁 PENGUJIAN SELESAI");
    console.log("=================================================================");
  } catch (netErr) {
    console.error("❌ Terjadi kesalahan jaringan saat memanggil Fonnte:", netErr);
  }
}

runCronTest();
