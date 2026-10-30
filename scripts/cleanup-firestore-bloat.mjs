import fs from "fs";
import path from "path";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

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

/**
 * Helper hapus dokumen dalam query secara batch (maks 400 op per batch)
 */
async function deleteQueryBatch(query, batchSize = 400) {
  let totalDeleted = 0;
  while (true) {
    const snapshot = await query.limit(batchSize).get();
    if (snapshot.empty) break;

    const batch = db.batch();
    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });
    await batch.commit();

    totalDeleted += snapshot.size;
    if (snapshot.size < batchSize) break;
  }
  return totalDeleted;
}

/**
 * Helper hapus array dokumen secara batch
 */
async function deleteDocRefsBatch(docRefs, batchSize = 400) {
  let totalDeleted = 0;
  for (let i = 0; i < docRefs.length; i += batchSize) {
    const chunk = docRefs.slice(i, i + batchSize);
    const batch = db.batch();
    chunk.forEach((ref) => batch.delete(ref));
    await batch.commit();
    totalDeleted += chunk.length;
  }
  return totalDeleted;
}

async function runCleanup() {
  console.log("==================================================");
  console.log("🧹 MEMULAI PEMBERSIHAN DOKUMEN & BLOAT FIRESTORE");
  console.log("==================================================");

  const summary = {};
  const now = new Date();
  const oneDayAgoMs = Date.now() - 24 * 60 * 60 * 1000;
  const twoDaysAgoDateStr = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  // 0. Pastikan ormawas/main_org sudah ada jika organizations/main_org ada
  console.log("⏳ 0. Memeriksa migrasi ormawas/main_org...");
  try {
    const mainOrmawaRef = db.collection("ormawas").doc("main_org");
    const mainOrmawaSnap = await mainOrmawaRef.get();
    if (!mainOrmawaSnap.exists) {
      const mainOrgSnap = await db.collection("organizations").doc("main_org").get();
      const orgData = mainOrgSnap.exists ? mainOrgSnap.data() : {};
      await mainOrmawaRef.set({
        id: "main_org",
        campus_id: orgData.campus_id || "univ-undiksha",
        name: orgData.name || "Forum Komunikasi KIP-Kuliah Undiksha",
        short_name: "Forkom KIP Undiksha",
        type: "UKM",
        workspace_type: "ormawa",
        description: orgData.description || "Organisasi kemahasiswaan penerima KIP-Kuliah di lingkungan Universitas Pendidikan Ganesha.",
        member_count: 48,
        is_active: true,
        created_at: Timestamp.now(),
        updated_at: Timestamp.now(),
      });
      console.log("   ✅ Dokumen ormawas/main_org berhasil disinkronkan.");
    } else {
      console.log("   ✅ Dokumen ormawas/main_org sudah aktif.");
    }
  } catch (err) {
    console.warn("   ⚠️ Gagal sinkronisasi ormawas/main_org:", err.message);
  }

  // --------------------------------------------------------------------------
  // KATEGORI A: Hapus Koleksi Residu (0 Risiko)
  // --------------------------------------------------------------------------
  console.log("\n--- KATEGORI A: PENGHAPUSAN KOLEKSI RESIDU (0 RISIKO) ---");

  // 1. reminder_digest_logs
  console.log("⏳ Menghapus koleksi 'reminder_digest_logs'...");
  summary["reminder_digest_logs"] = await deleteQueryBatch(db.collection("reminder_digest_logs"));
  console.log(`   ✅ Dihapus: ${summary["reminder_digest_logs"]} dokumen.`);

  // 2. notifications_log
  console.log("⏳ Menghapus koleksi 'notifications_log'...");
  summary["notifications_log"] = await deleteQueryBatch(db.collection("notifications_log"));
  console.log(`   ✅ Dihapus: ${summary["notifications_log"]} dokumen.`);

  // 3. wablas_incoming_debug
  console.log("⏳ Menghapus koleksi 'wablas_incoming_debug'...");
  summary["wablas_incoming_debug"] = await deleteQueryBatch(db.collection("wablas_incoming_debug"));
  console.log(`   ✅ Dihapus: ${summary["wablas_incoming_debug"]} dokumen.`);

  // --------------------------------------------------------------------------
  // KATEGORI B: Pruning Dokumen Kedaluwarsa & Telemetri Lama
  // --------------------------------------------------------------------------
  console.log("\n--- KATEGORI B: PRUNING DOKUMEN KEDALUWARSA & TELEMETRI LAMA ---");

  // 4. ai_cache (expires_at <= now)
  console.log("⏳ Memeriksa 'ai_cache' untuk dokumen kedaluwarsa...");
  const aiCacheSnap = await db.collection("ai_cache").get();
  const expiredCacheRefs = [];
  aiCacheSnap.forEach((doc) => {
    const data = doc.data();
    if (data.expires_at) {
      const expDate = data.expires_at.toDate ? data.expires_at.toDate() : new Date(data.expires_at);
      if (expDate.getTime() <= now.getTime()) {
        expiredCacheRefs.push(doc.ref);
      }
    }
  });
  summary["ai_cache (expired)"] = await deleteDocRefsBatch(expiredCacheRefs);
  console.log(`   ✅ Dihapus: ${summary["ai_cache (expired)"]} dokumen expired.`);

  // 5. whatsapp_inbound_logs (> 1 hari)
  console.log("⏳ Memeriksa 'whatsapp_inbound_logs' (> 1 hari)...");
  const inboundLogsSnap = await db.collection("whatsapp_inbound_logs").get();
  const expiredInboundRefs = [];
  inboundLogsSnap.forEach((doc) => {
    const data = doc.data();
    let createdMs = 0;
    if (typeof data.created_at_ms === "number") {
      createdMs = data.created_at_ms;
    } else if (data.created_at?.toMillis) {
      createdMs = data.created_at.toMillis();
    }
    if (createdMs > 0 && createdMs < oneDayAgoMs) {
      expiredInboundRefs.push(doc.ref);
    }
  });
  summary["whatsapp_inbound_logs (>1d)"] = await deleteDocRefsBatch(expiredInboundRefs);
  console.log(`   ✅ Dihapus: ${summary["whatsapp_inbound_logs (>1d)"]} dokumen lama.`);

  // 6. green_api_dedupe (> 1 hari)
  console.log("⏳ Memeriksa 'green_api_dedupe' (> 1 hari)...");
  const greenDedupeSnap = await db.collection("green_api_dedupe").get();
  const expiredGreenRefs = [];
  greenDedupeSnap.forEach((doc) => {
    const data = doc.data();
    const procMs = typeof data.processed_at_ms === "number" ? data.processed_at_ms : 0;
    if (procMs > 0 && procMs < oneDayAgoMs) {
      expiredGreenRefs.push(doc.ref);
    }
  });
  summary["green_api_dedupe (>1d)"] = await deleteDocRefsBatch(expiredGreenRefs);
  console.log(`   ✅ Dihapus: ${summary["green_api_dedupe (>1d)"]} dokumen lama.`);

  // 7. ai_daily_usage (> 2 hari lalu)
  console.log("⏳ Memeriksa 'ai_daily_usage' (> 2 hari lalu)...");
  const dailyUsageSnap = await db.collection("ai_daily_usage").get();
  const expiredDailyRefs = [];
  dailyUsageSnap.forEach((doc) => {
    const id = doc.id;
    // Format id: {phone}_{YYYY-MM-DD}
    const parts = id.split("_");
    const dateStr = parts[parts.length - 1];
    if (dateStr && dateStr.length === 10 && dateStr < twoDaysAgoDateStr) {
      expiredDailyRefs.push(doc.ref);
    }
  });
  summary["ai_daily_usage (>2d)"] = await deleteDocRefsBatch(expiredDailyRefs);
  console.log(`   ✅ Dihapus: ${summary["ai_daily_usage (>2d)"]} dokumen lama.`);

  // 8. ai_command_previews (confirmed / cancelled / expired)
  console.log("⏳ Memeriksa 'ai_command_previews' (confirmed/cancelled/expired)...");
  const previewsSnap = await db.collection("ai_command_previews").get();
  const prunePreviewRefs = [];
  previewsSnap.forEach((doc) => {
    const data = doc.data();
    if (["confirmed", "cancelled"].includes(data.status)) {
      prunePreviewRefs.push(doc.ref);
    } else if (data.expires_at) {
      const expDate = data.expires_at.toDate ? data.expires_at.toDate() : new Date(data.expires_at);
      if (expDate.getTime() <= now.getTime()) {
        prunePreviewRefs.push(doc.ref);
      }
    }
  });
  summary["ai_command_previews (pruned)"] = await deleteDocRefsBatch(prunePreviewRefs);
  console.log(`   ✅ Dihapus: ${summary["ai_command_previews (pruned)"]} dokumen tidak aktif.`);

  // 9. ai_usage_logs (telemetri lama > 7 hari)
  console.log("⏳ Memeriksa 'ai_usage_logs' (telemetri lama > 7 hari)...");
  const usageLogsSnap = await db.collection("ai_usage_logs").where("created_at", "<=", sevenDaysAgo).get();
  summary["ai_usage_logs (>7d)"] = await deleteDocRefsBatch(usageLogsSnap.docs.map((d) => d.ref));
  console.log(`   ✅ Dihapus: ${summary["ai_usage_logs (>7d)"]} dokumen telemetri lama.`);

  // --------------------------------------------------------------------------
  // RINGKASAN AKHIR
  // --------------------------------------------------------------------------
  console.log("\n==================================================");
  console.log("📊 RINGKASAN HASIL PEMBERSIHAN FIRESTORE");
  console.log("==================================================");
  let totalDocsDeleted = 0;
  for (const [key, count] of Object.entries(summary)) {
    console.log(` • ${key.padEnd(35)}: ${count} dokumen`);
    totalDocsDeleted += count;
  }
  console.log("--------------------------------------------------");
  console.log(`🎉 TOTAL DOKUMEN BERHASIL DIBERSIHKAN: ${totalDocsDeleted}`);
  console.log("==================================================");

  process.exit(0);
}

runCleanup().catch((err) => {
  console.error("❌ Terjadi kesalahan saat pembersihan:", err);
  process.exit(1);
});

