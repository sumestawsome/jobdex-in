import "server-only";

import { getAdminDb } from "@/lib/server/firebase-admin";

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface ParsedJobdeskTask {
  name: string;
  pic_ids: string[];
  pic_names: string[];
  priority: "rendah" | "sedang" | "tinggi";
  stage: "pra_acara" | "pasca_acara";
  deadline: string | null; // format YYYY-MM-DD atau null jika belum ada
  requires_deadline: boolean;
}

export interface SkippedJobdeskTask {
  raw_text: string;
  reason: string;
}

export interface BulkJobdeskParseResult {
  event_name: string;
  total_extracted: number;
  tasks: ParsedJobdeskTask[];
  skipped_tasks: SkippedJobdeskTask[];
  missing_deadlines_summary: string;
}

export interface TaskDeadlineUpdate {
  task_index: number; // 1-based index
  deadline: string; // format YYYY-MM-DD atau YYYY-MM-DDTHH:mm
}

export interface MemberCandidate {
  id: string;
  name: string;
  nickname?: string;
  aliases?: string[];
  phone_number?: string;
  role?: string;
  division_id?: string;
  role_in_event?: string;
  is_active?: boolean;
}

// ============================================================================
// Known Canonical Nickname Mappings & Aliases
// ============================================================================

const KNOWN_NICKNAMES: Record<string, string[]> = {
  cici: ["cheentya"],
  kakcici: ["cheentya"],
  ipang: ["ipang nih boss", "irfan"],
  kakipang: ["ipang nih boss", "irfan"],
  irfan: ["ipang nih boss"],
  sila: ["putu srisila brata", "srisila"],
  kaksila: ["putu srisila brata"],
  darma: ["made darma tanaya"],
  kakdarma: ["made darma tanaya"],
  agus: ["putu agus sumerta yasa", "sumesta c"],
  kakagus: ["putu agus sumerta yasa"],
  saya: ["putu agus sumerta yasa"],
  wardana: ["gede suma wardana", "suma"],
  suma: ["gede suma wardana"],
  kakwardana: ["gede suma wardana"],
  anin: ["ni putu ayu anin dianary"],
  kakanin: ["ni putu ayu anin dianary"],
  nizam: ["haerul nizam"],
  haerul: ["haerul nizam"],
};

const TITLE_PREFIX_REGEX = /^(kak|bli|mbok|pak|bu|dek|bang|mas)\s+/i;

/**
 * Membersihkan nama atau query string pencarian anggota
 */
export function normalizeQueryName(query: string): string {
  if (!query) return "";
  let clean = query.trim().toLowerCase();
  clean = clean.replace(TITLE_PREFIX_REGEX, "");
  // Hapus karakter kurung atau tanda baca umum
  clean = clean.replace(/[\(\)\[\]\{\}\:\,\-\.]/g, " ").trim();
  return clean.replace(/\s+/g, " ");
}

/**
 * Mencocokkan sebuah nama / inisial ke salah satu kandidat anggota
 */
export function matchMemberCandidate(
  rawQuery: string,
  candidates: MemberCandidate[]
): MemberCandidate | null {
  const clean = normalizeQueryName(rawQuery);
  if (!clean) return null;

  // 1. Exact match pada ID
  const idMatch = candidates.find((c) => c.id.toLowerCase() === rawQuery.trim().toLowerCase());
  if (idMatch) return idMatch;

  // 2. Exact match pada target alias kanonikal
  const canonicalTargets = KNOWN_NICKNAMES[clean] || KNOWN_NICKNAMES[clean.replace(/\s+/g, "")];
  if (canonicalTargets && canonicalTargets.length > 0) {
    for (const target of canonicalTargets) {
      const match = candidates.find(
        (c) =>
          c.name.toLowerCase().includes(target) ||
          c.nickname?.toLowerCase() === target ||
          (c.aliases && c.aliases.some((a) => a.toLowerCase().includes(target)))
      );
      if (match) return match;
    }
  }

  // 3. Exact match pada nickname kandidat
  const nicknameMatch = candidates.find((c) => c.nickname?.toLowerCase().trim() === clean);
  if (nicknameMatch) return nicknameMatch;

  // 4. Exact match pada salah satu aliases kandidat
  const aliasMatch = candidates.find(
    (c) =>
      c.aliases &&
      Array.isArray(c.aliases) &&
      c.aliases.some((a) => a.toLowerCase().trim() === clean)
  );
  if (aliasMatch) return aliasMatch;

  // 5. Exact match pada nama lengkap
  const exactNameMatch = candidates.find((c) => c.name.toLowerCase().trim() === clean);
  if (exactNameMatch) return exactNameMatch;

  // 6. Substring match: nama user mengandung clean query
  const subNameMatch = candidates.find((c) => c.name.toLowerCase().includes(clean));
  if (subNameMatch) return subNameMatch;

  // 7. Substring match: clean query mengandung kata dari nama user (panjang kata >= 3)
  const words = clean.split(" ").filter((w) => w.length >= 3);
  for (const w of words) {
    const wordMatch = candidates.find((c) => c.name.toLowerCase().includes(w));
    if (wordMatch) return wordMatch;
  }

  // 8. Pencocokan nomor telepon jika angka
  const digits = rawQuery.replace(/[^\d]/g, "");
  if (digits.length >= 7) {
    const normPhone = digits.replace(/^0/, "62");
    const phoneMatch = candidates.find((c) => {
      const cPhone = (c.phone_number || "").replace(/[^\d]/g, "").replace(/^0/, "62");
      return cPhone.endsWith(normPhone) || normPhone.endsWith(cPhone);
    });
    if (phoneMatch) return phoneMatch;
  }

  return null;
}

/**
 * Mengurai string nama PIC (bisa koma, 'dan', '&') dan mengembalikan daftar PIC terverifikasi
 */
export function resolveMemberCandidates(
  picString: string,
  candidates: MemberCandidate[]
): { pic_ids: string[]; pic_names: string[] } {
  if (!picString || !picString.trim()) {
    return { pic_ids: [], pic_names: [] };
  }

  // Ekstrak teks dalam kurung jika seluruh teks berformat misal "(Kak Darma, Kak Agus)"
  let text = picString.trim();
  const parenMatch = text.match(/\(([^)]+)\)/);
  if (parenMatch && parenMatch[1]) {
    text = parenMatch[1];
  }

  // Pisahkan berdasarkan koma, 'dan', '&', atau '/'
  const tokens = text
    .split(/[,&/]|(\s+dan\s+)/i)
    .map((t) => (t || "").trim())
    .filter((t) => t && !/^(dan|&|\/)$/i.test(t));

  const resolvedIds = new Set<string>();
  const resolvedNames: string[] = [];

  for (const token of tokens) {
    const match = matchMemberCandidate(token, candidates);
    if (match && !resolvedIds.has(match.id)) {
      resolvedIds.add(match.id);
      resolvedNames.push(match.name);
    }
  }

  return {
    pic_ids: Array.from(resolvedIds),
    pic_names: resolvedNames,
  };
}

// ============================================================================
// Gemini API Caller with Strict JSON Format
// ============================================================================

async function callGeminiBulkParser(
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY belum dikonfigurasi pada environment server.");
  }

  const configuredModel = process.env.GEMINI_MODEL?.trim();
  const modelsToTry = [
    configuredModel && !configuredModel.includes("1.5") ? configuredModel : null,
    "gemini-3.8-flash",
    "gemini-3.5-flash-lite",
  ].filter(Boolean) as string[];

  const uniqueModels = [...new Set(modelsToTry)];
  let lastError: Error | null = null;

  for (const model of uniqueModels) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          signal: AbortSignal.timeout(25000),
          body: JSON.stringify({
            system_instruction: {
              parts: [{ text: systemPrompt }],
            },
            contents: [
              {
                role: "user",
                parts: [{ text: userPrompt }],
              },
            ],
            generationConfig: {
              temperature: 0.1,
              response_mime_type: "application/json",
            },
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        const errorMsg = data.error?.message || `Status HTTP ${response.status}`;
        throw new Error(`Gemini (${model}) gagal: ${errorMsg}`);
      }

      const text = data.candidates?.[0]?.content?.parts
        ?.map((part: { text?: string }) => part.text ?? "")
        .join("")
        .trim();

      if (text) {
        return text;
      }
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.warn(
        `[AI Bulk Jobdesk Parser] Panggilan model ${model} gagal:`,
        lastError.message
      );
    }
  }

  throw lastError || new Error("Semua model Gemini gagal mengekstrak data jobdesk.");
}

/**
 * Parser JSON aman yang membersihkan markdown backtick jika ada
 */
function parseJsonSafely(raw: string): Record<string, unknown> {
  let clean = raw.trim();
  if (clean.startsWith("```json")) {
    clean = clean.slice(7);
  } else if (clean.startsWith("```")) {
    clean = clean.slice(3);
  }
  if (clean.endsWith("```")) {
    clean = clean.slice(0, -3);
  }
  clean = clean.trim();
  return JSON.parse(clean);
}

// ============================================================================
// Heuristic Fallback Parser (Ketika Gemini Tidak Dapat Diakses)
// ============================================================================

function fallbackParseJobdesk(
  rawText: string,
  eventName: string,
  candidates: MemberCandidate[]
): BulkJobdeskParseResult {
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const tasks: ParsedJobdeskTask[] = [];
  const skippedTasks: SkippedJobdeskTask[] = [];

  const OPERATIONAL_HARI_H_KEYWORDS = [
    "saat kegiatan",
    "saat hari h",
    "hari h",
    "keliling saat",
    "mengoperasikan peralatan",
    "mengoperasikan alat",
    "operator saat",
    "operator acara",
    "koordinasi umum",
    "membuka acara",
    "menutup acara",
    "memandu acara",
    "menjadi mc",
    "menjadi moderator",
    "menjaga presensi saat",
  ];

  for (const line of lines) {
    const lower = line.toLowerCase();
    const isOperational = OPERATIONAL_HARI_H_KEYWORDS.some((kw) => lower.includes(kw));

    if (isOperational) {
      skippedTasks.push({
        raw_text: line,
        reason: "Tugas operasional hari H",
      });
      continue;
    }

    // Ekstrak PIC dari kurung (...) atau di akhir kalimat
    let picRaw = "";
    const parenMatch = line.match(/\(([^)]+)\)/);
    if (parenMatch) {
      picRaw = parenMatch[1];
    } else {
      const colonSplit = line.split(/[:\-]/);
      if (colonSplit.length > 1) {
        picRaw = colonSplit[colonSplit.length - 1].trim();
      }
    }

    const { pic_ids, pic_names } = resolveMemberCandidates(picRaw, candidates);

    // Bersihkan nama tugas dari bullet & kurung PIC
    let cleanName = line
      .replace(/^(\d+[\.\)]|[\-\*\•])\s*/, "")
      .replace(/\s*\([^)]*\)\s*$/, "")
      .trim();

    // Tentukan stage
    const isPasca =
      lower.includes("video recap") ||
      lower.includes("recap") ||
      lower.includes("aftermovie") ||
      lower.includes("lpj") ||
      lower.includes("arsip") ||
      lower.includes("laporan pertanggungjawaban");
    const stage: "pra_acara" | "pasca_acara" = isPasca ? "pasca_acara" : "pra_acara";

    // Tentukan priority
    let priority: "rendah" | "sedang" | "tinggi" = "sedang";
    if (lower.includes("pamflet") || lower.includes("rab") || lower.includes("proposal")) {
      priority = "tinggi";
    } else if (lower.includes("arsip") || lower.includes("berkas")) {
      priority = "rendah";
    }

    // Cek deadline tanggal (format YYYY-MM-DD atau DD/MM/YYYY)
    let deadline: string | null = null;
    const dateMatch = line.match(/\b(20\d{2}[-\/]\d{1,2}[-\/]\d{1,2})\b/);
    if (dateMatch) {
      deadline = dateMatch[1].replace(/\//g, "-");
    }

    tasks.push({
      name: cleanName || line,
      pic_ids,
      pic_names,
      priority,
      stage,
      deadline,
      requires_deadline: deadline === null,
    });
  }

  const missingDeadlines = tasks.filter((t) => t.requires_deadline);
  let summary = "Seluruh tugas telah memiliki tenggat waktu.";
  if (missingDeadlines.length > 0) {
    const names = missingDeadlines.slice(0, 3).map((t) => t.name.split(" ")[0]);
    summary = `Terdapat ${missingDeadlines.length} tugas yang belum memiliki tenggat waktu (contoh: ${names.join(", ")}).`;
  }

  return {
    event_name: eventName,
    total_extracted: tasks.length,
    tasks,
    skipped_tasks: skippedTasks,
    missing_deadlines_summary: summary,
  };
}

// ============================================================================
// Main Exported Service: parseBulkJobdeskText
// ============================================================================

/**
 * Mengurai teks mentah jobdesk panitia menjadi struktur tugas terverifikasi
 * dengan AI Gemini Flash dan Fuzzy Member Matcher.
 */
export async function parseBulkJobdeskText(
  rawText: string,
  eventId?: string,
  divisionId?: string
): Promise<BulkJobdeskParseResult> {
  const db = getAdminDb();

  // 1. Ambil data acara & anggota terkait dari Firestore
  let eventName = "Acara";
  const eventMemberIds = new Set<string>();

  if (eventId) {
    try {
      const eventDoc = await db.collection("events").doc(eventId).get();
      if (eventDoc.exists) {
        const evData = eventDoc.data();
        if (evData?.name) {
          eventName = evData.name;
        }
        if (evData?.coordinator_id) {
          eventMemberIds.add(evData.coordinator_id);
        }
        if (evData?.secretary_id) {
          eventMemberIds.add(evData.secretary_id);
        }
      }

      // Ambil subcollection event_members
      const membersSnap = await db
        .collection("events")
        .doc(eventId)
        .collection("event_members")
        .get();

      membersSnap.forEach((docSnap) => {
        const d = docSnap.data();
        const uid = d.user_id || docSnap.id;
        if (uid) eventMemberIds.add(uid);
      });
    } catch (err) {
      console.warn(`[AI Bulk Jobdesk Parser] Gagal mengambil detail event ${eventId}:`, err);
    }
  }

  // 2. Ambil seluruh data pengguna untuk pencocokan anggota
  const allCandidates: MemberCandidate[] = [];
  const prioritizedCandidates: MemberCandidate[] = [];

  try {
    const usersSnap = await db.collection("users").get();
    usersSnap.forEach((docSnap) => {
      const u = docSnap.data();
      const candidate: MemberCandidate = {
        id: docSnap.id,
        name: u.name || "",
        nickname: u.nickname || "",
        aliases: Array.isArray(u.aliases) ? u.aliases : [],
        phone_number: u.whatsapp_number || u.phone_number || "",
        role: u.role || "anggota",
        division_id: u.division_id || "",
        is_active: u.is_active !== false,
      };

      // Hanya masukkan anggota aktif atau yang terdaftar resmi di kepanitiaan acara
      if (candidate.is_active || eventMemberIds.has(candidate.id)) {
        allCandidates.push(candidate);

        const isEventMember = eventId ? eventMemberIds.has(candidate.id) : false;
        const isDivMember = divisionId ? candidate.division_id === divisionId : false;

        if (isEventMember || isDivMember) {
          prioritizedCandidates.push(candidate);
        }
      }
    });
  } catch (err) {
    console.error("[AI Bulk Jobdesk Parser] Gagal mengambil users dari Firestore:", err);
  }

  // Gunakan prioritizedCandidates jika ada, atau fallback ke allCandidates
  const activeCandidates = prioritizedCandidates.length > 0 ? prioritizedCandidates : allCandidates;

  // Siapkan teks daftar anggota untuk prompt Gemini
  const memberListText = activeCandidates
    .map((c) => {
      const aliasesStr = [c.nickname, ...(c.aliases || [])].filter(Boolean).join(", ");
      return `- ID: "${c.id}" | Nama Lengkap: "${c.name}" | Panggilan/Alias: [${aliasesStr || "tidak ada"}] | Divisi: "${c.division_id || "-"}"`;
    })
    .join("\n");

  // 3. Susun Prompt Gemini dengan Aturan Baku yang Ketat
  const systemPrompt = `Kamu adalah asisten AI JobDex.in (Sistem Manajemen Job Desk dan Kepanitiaan Ormawa Forkom KIP Undiksha).
Tugasmu adalah membaca teks mentah berisi daftar job desk panitia dan mengekstraknya ke dalam format JSON murni.

DAFTAR ANGGOTA TERSEDIA SAAT INI:
${memberListText || "(Daftar anggota kosong)"}

ATURAN PENYARINGAN KETAT (STRICT FILTERING):
1. TUGAS OPERASIONAL HARI H WAJIB DIABAIKAN:
   - Contoh: 'mengoperasikan peralatan teknis saat kegiatan', 'mendokumentasikan kegiatan keliling saat hari H', 'koordinasi umum saat hari H', 'menjadi MC/operator saat acara berlangsung'.
   - Masukkan tugas-tugas operasional hari H ini ke array "skipped_tasks" dengan "reason": "Tugas operasional hari H".

2. TUGAS PRA-ACARA & PASCA-ACARA WAJIB DIMASUKKAN:
   - Pra-acara: Desain pamflet/poster/banner, penyusunan RAB, proposal kegiatan, persiapan teknis virtual background/link Zoom, pendataan list alat/perlengkapan, surat menyurat.
   - Pasca-acara: Editing video recap/dokumentasi, penyusunan LPJ, pengarsipan berkas.

3. PENCAPAIAN ANGGOTA (MEMBER RESOLVER & FUZZY MATCHING):
   - Cocokkan nama panggilan/inisial di dalam kurung atau teks ke daftar anggota yang disediakan.
   - PENTING! Aturan alias panggilan khusus:
     * 'Kak cici' / 'cici' -> Cocokkan ke 'Cheentya'
     * 'Kak ipang' / 'ipang' / 'irfan' -> Cocokkan ke 'IPANG NIH BOSS'
     * 'Kak sila' / 'sila' -> Cocokkan ke 'Putu Srisila Brata'
     * 'Kak Darma' / 'darma' -> Cocokkan ke 'Made Darma Tanaya'
     * 'Kak Agus' / 'saya' -> Cocokkan ke 'Putu Agus Sumerta Yasa'
     * 'Wardana' / 'suma' -> Cocokkan ke 'Gede Suma Wardana'
     * 'Anin' -> Cocokkan ke 'Ni Putu Ayu Anin Dianary'
   - Jika PIC lebih dari satu (contoh: '(Kak Darma, Kak agus)'), hasilkan semua ID di array "pic_ids" dan nama lengkap di array "pic_names".
   - Jika PIC tidak dikenali atau tidak ada, kosongkan array "pic_ids": [] dan "pic_names": [].

4. ESTIMASI TAHAP & PRIORITAS:
   - Pamflet publikasi & RAB -> priority: 'tinggi', stage: 'pra_acara'
   - Desain piagam, virtual background, list alat -> priority: 'sedang', stage: 'pra_acara'
   - Edit video recap, LPJ, arsip -> priority: 'sedang' atau 'rendah', stage: 'pasca_acara'
   - Default priority adalah 'sedang'.

5. TENGGAT WAKTU (DEADLINE):
   - Jika ada tanggal deadline pada teks, format ke YYYY-MM-DD dan set requires_deadline: false.
   - Jika belum ada deadline pada teks, set deadline: null dan requires_deadline: true.

6. FORMAT OUTPUT JSON WAJIB VALID:
{
  "event_name": "${eventName}",
  "total_extracted": 0,
  "tasks": [
    {
      "name": "Nama tugas bersih tanpa penomoran atau kurung PIC",
      "pic_ids": ["id_user"],
      "pic_names": ["Nama Lengkap User"],
      "priority": "tinggi" | "sedang" | "rendah",
      "stage": "pra_acara" | "pasca_acara",
      "deadline": "YYYY-MM-DD" | null,
      "requires_deadline": true | false
    }
  ],
  "skipped_tasks": [
    {
      "raw_text": "Teks asli tugas yang diabaikan",
      "reason": "Tugas operasional hari H"
    }
  ],
  "missing_deadlines_summary": "Rangkuman dalam Bahasa Indonesia tugas mana saja yang belum memiliki tenggat waktu"
}`;

  const userPrompt = `Nama Acara Terkait: ${eventName}

Berikut adalah teks mentah jobdesk panitia:
---
${rawText}
---

Silakan ekstrak seluruh tugas pra-acara dan pasca-acara serta kecualikan tugas operasional hari H sesuai instruksi.`;

  // 4. Eksekusi Panggilan AI dengan Fallback Aman
  let rawJson = "";
  try {
    rawJson = await callGeminiBulkParser(systemPrompt, userPrompt);
  } catch (aiErr) {
    console.warn(
      "[AI Bulk Jobdesk Parser] Gemini API gagal, beralih ke Fallback Heuristic Parser:",
      aiErr
    );
    return fallbackParseJobdesk(rawText, eventName, activeCandidates);
  }

  // 5. Normalisasi & Validasi Output AI
  try {
    const parsed = parseJsonSafely(rawJson);

    const rawTasks = Array.isArray(parsed.tasks) ? parsed.tasks : [];
    const rawSkipped = Array.isArray(parsed.skipped_tasks) ? parsed.skipped_tasks : [];

    const tasks: ParsedJobdeskTask[] = [];

    for (const item of rawTasks) {
      if (!item || typeof item !== "object") continue;

      let name = typeof item.name === "string" ? item.name.trim() : "";
      if (!name) continue;

      // Bersihkan bullet nomor jika AI masih menyisakan
      name = name
        .replace(/^(\d+[\.\)]|[\-\*\•])\s*/, "")
        .replace(/\s*\([^)]*\)\s*$/, "")
        .trim();

      // Sinkronkan PIC menggunakan Fuzzy Matcher TypeScript untuk proteksi ekstra
      let picIds: string[] = Array.isArray(item.pic_ids) ? item.pic_ids.filter(Boolean) : [];
      let picNames: string[] = Array.isArray(item.pic_names) ? item.pic_names.filter(Boolean) : [];

      // Validasi apakah PIC IDs cocok dengan data kandidat yang nyata
      const validIds: string[] = [];
      const validNames: string[] = [];

      for (const id of picIds) {
        const found = allCandidates.find((c) => c.id === id);
        if (found) {
          validIds.push(found.id);
          validNames.push(found.name);
        }
      }

      // Jika picIds dari AI kosong atau tidak valid, coba cari dari picNames atau teks nama tugas
      if (validIds.length === 0) {
        const queryStrings = [...picNames, item.name];
        for (const qs of queryStrings) {
          const resolved = resolveMemberCandidates(qs, activeCandidates);
          if (resolved.pic_ids.length > 0) {
            for (let i = 0; i < resolved.pic_ids.length; i++) {
              if (!validIds.includes(resolved.pic_ids[i])) {
                validIds.push(resolved.pic_ids[i]);
                validNames.push(resolved.pic_names[i]);
              }
            }
            break;
          }
        }
      }

      picIds = validIds;
      picNames = validNames;

      // Validasi prioritas
      let priority: "rendah" | "sedang" | "tinggi" = "sedang";
      if (item.priority === "tinggi" || item.priority === "rendah" || item.priority === "sedang") {
        priority = item.priority;
      }

      // Validasi stage
      let stage: "pra_acara" | "pasca_acara" = "pra_acara";
      if (item.stage === "pasca_acara" || item.stage === "pra_acara") {
        stage = item.stage;
      }

      // Validasi deadline
      let deadline: string | null = null;
      if (typeof item.deadline === "string" && /^\d{4}-\d{2}-\d{2}$/.test(item.deadline.trim())) {
        deadline = item.deadline.trim();
      }

      const requiresDeadline = Boolean(item.requires_deadline || deadline === null);

      tasks.push({
        name,
        pic_ids: picIds,
        pic_names: picNames,
        priority,
        stage,
        deadline,
        requires_deadline: requiresDeadline,
      });
    }

    const skippedTasks: SkippedJobdeskTask[] = rawSkipped.map((s: any) => ({
      raw_text: String(s?.raw_text || s?.text || "").trim(),
      reason: String(s?.reason || "Tugas operasional hari H").trim(),
    }));

    // Missing deadlines summary
    let missingDeadlinesSummary =
      typeof parsed.missing_deadlines_summary === "string" && parsed.missing_deadlines_summary.trim()
        ? parsed.missing_deadlines_summary.trim()
        : "";

    if (!missingDeadlinesSummary) {
      const missingCount = tasks.filter((t) => t.requires_deadline).length;
      if (missingCount === 0) {
        missingDeadlinesSummary = "Seluruh tugas telah memiliki tenggat waktu.";
      } else {
        missingDeadlinesSummary = `Terdapat ${missingCount} tugas yang belum memiliki tenggat waktu.`;
      }
    }

    return {
      event_name: typeof parsed.event_name === "string" ? parsed.event_name : eventName,
      total_extracted: tasks.length,
      tasks,
      skipped_tasks: skippedTasks,
      missing_deadlines_summary: missingDeadlinesSummary,
    };
  } catch (parseErr) {
    console.warn(
      "[AI Bulk Jobdesk Parser] Gagal parsing JSON Gemini, beralih ke Fallback:",
      parseErr
    );
    return fallbackParseJobdesk(rawText, eventName, activeCandidates);
  }
}

// ============================================================================
// Conversational Deadline Follow-up Parser (Gemini 3.8 Flash + Heuristic)
// ============================================================================

const INDO_MONTH_NAMES: Record<string, string> = {
  jan: "01",
  januari: "01",
  january: "01",
  feb: "02",
  februari: "02",
  february: "02",
  mar: "03",
  maret: "03",
  march: "03",
  apr: "04",
  april: "04",
  mei: "05",
  may: "05",
  jun: "06",
  juni: "06",
  june: "06",
  jul: "07",
  juli: "07",
  july: "07",
  agu: "08",
  ags: "08",
  agustus: "08",
  aug: "08",
  august: "08",
  sep: "09",
  september: "09",
  okt: "10",
  oct: "10",
  oktober: "10",
  october: "10",
  nov: "11",
  november: "11",
  des: "12",
  dec: "12",
  desember: "12",
  december: "12",
};

/**
 * Heuristic regex fallback untuk mengekstrak tenggat dari teks seperti:
 * "1 tenggat 5 Nov 20:00, 2 tenggat 8 Nov" atau "tugas 1 deadline 5 nov"
 */
export function heuristicParseDeadlines(
  rawText: string,
  totalTasks: number
): TaskDeadlineUpdate[] {
  const updates: TaskDeadlineUpdate[] = [];
  if (!rawText.trim() || totalTasks <= 0) return updates;

  const currentYear = new Date().getFullYear(); // e.g. 2026
  const clean = rawText.trim().toLowerCase();

  // Cek apakah perintah berlaku untuk SEMUA tugas, misal: "semua tenggat 10 nov"
  const allMatch = clean.match(
    /(?:semua|all|seluruh)\s+(?:tugas\s+)?(?:tenggat|deadline|tgl|tanggal)\s+(\d{1,2})\s+([a-z]+)(?:\s+(\d{1,2}[:.]\d{2}))?/i
  );
  if (allMatch) {
    const day = allMatch[1].padStart(2, "0");
    const monthKey = allMatch[2].toLowerCase();
    const month = INDO_MONTH_NAMES[monthKey];
    const timeStr = allMatch[3] ? allMatch[3].replace(".", ":") : "";
    if (month) {
      const deadline = timeStr ? `${currentYear}-${month}-${day}T${timeStr}` : `${currentYear}-${month}-${day}`;
      for (let i = 1; i <= totalTasks; i++) {
        updates.push({ task_index: i, deadline });
      }
      return updates;
    }
  }

  // Pecah berdasarkan koma, titik koma, baris baru, atau kata penghubung "dan"
  const segments = clean.split(/[,;\n]|\s+dan\s+/);

  for (const seg of segments) {
    const s = seg.trim();
    if (!s) continue;

    // Pola 1: "1 tenggat 5 Nov 20:00" atau "no 1: 5 nov" atau "tugas 2 deadline 8 nov"
    const pattern =
      /(?:(?:no|nomor|tugas)\s*)?(\d+)[\s:\-.]*(?:tenggat|deadline|tgl|tanggal)?[\s:\-]*(\d{1,2})\s+([a-z]+)(?:\s+(\d{1,2}[:.]\d{2}))?/i;
    const m = s.match(pattern);

    if (m) {
      const taskIndex = parseInt(m[1], 10);
      if (taskIndex >= 1 && taskIndex <= totalTasks) {
        const day = m[2].padStart(2, "0");
        const monthKey = m[3].toLowerCase();
        const month = INDO_MONTH_NAMES[monthKey];
        const timeStr = m[4] ? m[4].replace(".", ":") : "";

        if (month) {
          const deadline = timeStr ? `${currentYear}-${month}-${day}T${timeStr}` : `${currentYear}-${month}-${day}`;
          updates.push({ task_index: taskIndex, deadline });
          continue;
        }
      }
    }

    // Pola 2: Format ISO standar "1: 2026-11-05" atau "1 deadline 2026-11-05 20:00"
    const isoPattern =
      /(?:(?:no|nomor|tugas)\s*)?(\d+)[\s:\-.]*(?:tenggat|deadline|tgl|tanggal)?[\s:\-]*(\d{4}[-\/]\d{1,2}[-\/]\d{1,2})(?:[\sT]+(\d{1,2}[:.]\d{2}))?/i;
    const isoM = s.match(isoPattern);
    if (isoM) {
      const taskIndex = parseInt(isoM[1], 10);
      if (taskIndex >= 1 && taskIndex <= totalTasks) {
        const datePart = isoM[2].replace(/\//g, "-");
        const timeStr = isoM[3] ? isoM[3].replace(".", ":") : "";
        const deadline = timeStr ? `${datePart}T${timeStr}` : datePart;
        updates.push({ task_index: taskIndex, deadline });
      }
    }
  }

  return updates;
}

/**
 * Mengekstrak pemetaan deadline tugas dari pesan percakapan koordinator/sekretaris.
 * Menggunakan Gemini 3.8 Flash dengan fallback ke Heuristic Regex Parser.
 */
export async function parseConversationalDeadlines(
  rawText: string,
  currentTasks: ParsedJobdeskTask[]
): Promise<TaskDeadlineUpdate[]> {
  if (!rawText.trim() || currentTasks.length === 0) {
    return [];
  }

  // Ringkas daftar tugas yang ada
  const taskDescriptions = currentTasks
    .map(
      (t, idx) =>
        `${idx + 1}. ${t.name} (PIC: ${t.pic_names.join(", ") || "-"}, Deadline: ${t.deadline || "Belum ada"})`
    )
    .join("\n");

  const today = new Date();
  const currentYear = today.getFullYear();
  const todayStr = today.toISOString().slice(0, 10);

  const systemPrompt = `Kamu adalah asisten AI JobDex.in yang bertugas memetakan penetapan tenggat waktu (deadline) dari pesan koordinator/sekretaris acara ke dalam tugas-tugas draf panitia.

INFORMASI WAKTU:
Tahun saat ini: ${currentYear}
Tanggal hari ini: ${todayStr}

DAFTAR TUGAS DALAM DRAF:
${taskDescriptions}

ATURAN UTAMA:
1. Cocokkan nomor tugas (1-based index) atau nama tugas yang dirujuk pengguna.
2. Ekstrak tanggal target (dan jam jika ada):
   - Format deadline HARUS: 'YYYY-MM-DD' atau 'YYYY-MM-DDTHH:mm' (ISO string).
   - Contoh: '5 Nov 20:00' -> '${currentYear}-11-05T20:00'.
   - Contoh: '8 Nov' -> '${currentYear}-11-08'.
   - Jika pengguna menyebutkan 'semua tenggat 10 nov', berikan update untuk SEMUA tugas dari 1 hingga ${currentTasks.length}.
3. Kembalikan HANYA format JSON valid berikut tanpa teks pendahuluan:
{
  "updates": [
    {
      "task_index": 1,
      "deadline": "${currentYear}-11-05T20:00"
    }
  ]
}
Jika teks tidak berkaitan dengan penetapan tenggat waktu tugas, kembalikan:
{
  "updates": []
}`;

  const userPrompt = `Pesan Pengguna:
---
${rawText}
---

Silakan ekstrak pemetaan deadline untuk tugas di atas.`;

  try {
    const rawJson = await callGeminiBulkParser(systemPrompt, userPrompt);
    const parsed = parseJsonSafely(rawJson);
    const rawUpdates = Array.isArray(parsed.updates) ? parsed.updates : [];

    const validUpdates: TaskDeadlineUpdate[] = [];
    for (const item of rawUpdates) {
      if (!item || typeof item !== "object") continue;
      const idx = typeof item.task_index === "number" ? item.task_index : parseInt(item.task_index, 10);
      const dl = typeof item.deadline === "string" ? item.deadline.trim() : "";

      if (idx >= 1 && idx <= currentTasks.length && dl.match(/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2})?)?$/)) {
        validUpdates.push({ task_index: idx, deadline: dl });
      }
    }

    if (validUpdates.length > 0) {
      return validUpdates;
    }
  } catch (err) {
    console.warn(
      "[AI Bulk Jobdesk Parser] Gemini gagal memproses conversational deadline, beralih ke Heuristic:",
      err
    );
  }

  // Fallback Heuristic
  return heuristicParseDeadlines(rawText, currentTasks.length);
}
