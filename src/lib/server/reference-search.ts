import { getAdminDb } from "./firebase-admin";
import type { DesignReference, TaskUpload } from "@/types";
import { isTaskReferenceEligible, mapTaskSubcategoryToDesignType } from "@/lib/reference-utils";
import { generateText } from "./ai-provider";
import { WA_LABEL } from "./whatsapp-labels";

// ─── Synonym Map ─────────────────────────────────────────────────────────────

export const DESIGN_ASSET_SYNONYMS: Record<string, string[]> = {
  pamflet: ["pamflet", "poster", "flyer", "feed", "publikasi", "desain publikasi", "poster acara", "poster kegiatan"],
  poster: ["poster", "pamflet", "flyer", "feed", "publikasi", "desain publikasi", "poster acara", "poster kegiatan"],
  flyer: ["flyer", "pamflet", "poster", "publikasi", "desain publikasi"],
  feed: ["feed", "instagram", "post instagram", "publikasi", "poster"],
  spanduk: ["spanduk", "banner", "backdrop"],
  nametag: [
    "nametag", "name tag", "name-tag", "id card", "idcard",
    "kartu panitia", "kartu peserta", "badge panitia", "tanda pengenal"
  ],
  baju: ["baju", "kaos", "t-shirt", "seragam"],
  photobooth: ["photobooth", "photo booth", "frame foto"],
  buku_panduan: ["buku panduan", "guidebook", "manual book", "cover buku"],
  sertifikat: ["sertifikat", "piagam"],
  logo: ["logo", "brand", "identity", "identitas visual"],
  header_form: ["header g-form", "header form", "google form", "gform"],
};

const ASSET_TYPE_GROUPS: Record<string, { synonyms: string[]; excludes: string[] }> = {
  pamflet: {
    synonyms: ["pamflet", "poster", "flyer", "feed", "publikasi", "desain publikasi", "poster acara", "poster kegiatan"],
    excludes: ["baju", "kaos", "photobooth", "photo booth", "buku panduan", "guidebook", "manual book", "header g-form", "header form", "gform", "nametag", "name tag", "id card"]
  },
  poster: {
    synonyms: ["poster", "pamflet", "flyer", "feed", "publikasi", "desain publikasi", "poster acara", "poster kegiatan"],
    excludes: ["baju", "kaos", "photobooth", "photo booth", "buku panduan", "guidebook", "manual book", "header g-form", "header form", "gform", "nametag", "name tag", "id card"]
  },
  flyer: {
    synonyms: ["flyer", "pamflet", "poster", "publikasi", "desain publikasi"],
    excludes: ["baju", "kaos", "photobooth", "photo booth", "buku panduan", "guidebook", "manual book", "header g-form", "header form", "gform", "nametag", "name tag", "id card"]
  },
  feed: {
    synonyms: ["feed", "instagram", "post instagram", "publikasi", "poster"],
    excludes: ["baju", "kaos", "photobooth", "photo booth", "buku panduan", "guidebook", "manual book", "header g-form", "header form", "gform", "nametag", "name tag", "id card"]
  },
  spanduk: {
    synonyms: ["spanduk", "banner", "backdrop"],
    excludes: ["baju", "kaos", "nametag", "name tag", "id card", "buku panduan", "guidebook", "logo", "sertifikat"]
  },
  nametag: {
    synonyms: ["nametag", "name tag", "name-tag", "id card", "idcard", "kartu panitia", "kartu peserta", "badge panitia", "tanda pengenal"],
    excludes: ["pamflet", "poster", "flyer", "feed", "baju", "kaos", "photobooth", "photo booth", "buku panduan", "logo", "cue card", "cover proposal", "kuppon", "frame story"]
  },
  baju: {
    synonyms: ["baju", "kaos", "t-shirt", "seragam"],
    excludes: ["pamflet", "poster", "flyer", "feed", "photobooth", "photo booth", "buku panduan", "logo", "sertifikat", "nametag", "name tag", "id card"]
  },
  photobooth: {
    synonyms: ["photobooth", "photo booth", "frame foto"],
    excludes: ["pamflet", "poster", "flyer", "feed", "baju", "kaos", "buku panduan", "logo", "sertifikat", "nametag", "name tag", "id card"]
  },
  buku_panduan: {
    synonyms: ["buku panduan", "guidebook", "manual book", "cover buku"],
    excludes: ["pamflet", "poster", "flyer", "feed", "baju", "kaos", "photobooth", "photo booth", "nametag", "name tag", "id card", "logo"]
  },
  sertifikat: {
    synonyms: ["sertifikat", "piagam"],
    excludes: ["baju", "kaos", "photobooth", "photo booth", "buku panduan", "logo", "nametag", "name tag", "id card"]
  },
  logo: {
    synonyms: ["logo", "brand", "identity", "identitas visual"],
    excludes: ["baju", "kaos", "photobooth", "photo booth", "buku panduan", "sertifikat", "nametag", "name tag", "id card"]
  },
  header_form: {
    synonyms: ["header g-form", "header form", "google form", "gform"],
    excludes: ["baju", "kaos", "photobooth", "photo booth", "buku panduan", "sertifikat", "nametag", "name tag", "id card"]
  },
};

// Specific asset types that activate "exact mode" — only show matched files, no random fallback
const EXACT_ASSET_TYPES = new Set([
  "nametag", "baju", "photobooth", "sertifikat", "spanduk", "logo", "header_form", "buku_panduan"
]);

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SearchIntent {
  intent: "reference_search" | "general";
  subtype?: "design_reference_search";
  assetType: string | null;
  expandedAssetTypes: string[];
  excludedAssetTypes: string[];
  year: number | null;
  eventKeyword: string | null;
  isExactMode: boolean; // true when searching specific asset types
}

export type MatchedFile = {
  name: string;
  url: string;
  mime_type?: string;
  score: number;
  reason: string;
};

export type ScoredReference = {
  ref: DesignReference;
  score: number;
  reason: string;
  matchScope: "title" | "file" | "design_type" | "general" | "none";
  matchedFiles: MatchedFile[]; // only files that actually match the query
  hasTitleMatch: boolean;
  hasFileMatch: boolean;
};

// ─── Intent Detection ─────────────────────────────────────────────────────────

export function isReferenceSearchQuestion(text: string): boolean {
  const clean = text.toLowerCase().trim();

  if (
    clean.startsWith("tambah jobdesk") ||
    clean.startsWith("tambah acara") ||
    clean.startsWith("tambah banyak jobdesk") ||
    clean.startsWith("approve task") ||
    clean.startsWith("konfirmasi") ||
    clean.startsWith("batal")
  ) {
    return false;
  }

  const keywords = [
    "referensi", "arsip", "link drive", "drive", "canva", "poster", "pamflet", "flyer",
    "feed", "nametag", "name tag", "id card", "perlengkapan", "audio", "sound", "video",
    "file", "desain", "cari", "contoh", "logo", "sertifikat", "baju", "kaos", "photobooth",
    "spanduk", "banner", "backdrop", "guidebook", "panduan", "g-form", "gform", "google form",
    "kartu panitia", "kartu peserta", "badge", "seragam", "piagam",
  ];

  return keywords.some((kw) => clean.includes(kw));
}

function detectAssetType(cleanQuery: string): string | null {
  const keys = Object.keys(DESIGN_ASSET_SYNONYMS);

  // Check exact keys first
  for (const key of keys) {
    if (cleanQuery.includes(key.replace("_", " "))) {
      return key;
    }
  }

  // Then check synonyms
  for (const key of keys) {
    const synonyms = DESIGN_ASSET_SYNONYMS[key];
    for (const syn of synonyms) {
      if (cleanQuery.includes(syn)) {
        return key;
      }
    }
  }

  return null;
}

function extractEventKeyword(cleanQuery: string, assetType: string | null): string | null {
  let text = cleanQuery.replace(/\b(20\d{2})\b/g, "");

  const triggers = [
    "carikan saya", "carikan", "cari", "contoh", "referensi", "arsip", "link drive",
    "drive", "canva", "desain", "aset", "file", "umum"
  ];
  for (const trigger of triggers) {
    text = text.replace(new RegExp(`\\b${trigger}\\b`, "g"), "");
  }

  if (assetType) {
    const synonyms = DESIGN_ASSET_SYNONYMS[assetType] || [];
    const allRemovals = [assetType.replace("_", " "), ...synonyms];
    for (const syn of allRemovals) {
      text = text.replace(new RegExp(`\\b${syn}\\b`, "g"), "");
    }
  }

  const words = text.split(/\s+/).map(w => w.trim()).filter(w => w.length > 2);
  const stopWords = ["saya", "yang", "dan", "untuk", "dari", "dengan", "atau", "pada", "bisa", "ada"];
  const filtered = words.filter(w => !stopWords.includes(w));

  return filtered.length > 0 ? filtered[0] : null;
}

export function detectSearchIntent(question: string): SearchIntent {
  const clean = question.toLowerCase().trim();
  const assetType = detectAssetType(clean);

  let expandedAssetTypes: string[] = [];
  let excludedAssetTypes: string[] = [];

  if (assetType && ASSET_TYPE_GROUPS[assetType]) {
    expandedAssetTypes = ASSET_TYPE_GROUPS[assetType].synonyms;
    excludedAssetTypes = ASSET_TYPE_GROUPS[assetType].excludes;
  }

  const yearMatch = clean.match(/\b(20\d{2})\b/);
  const year = yearMatch ? parseInt(yearMatch[1], 10) : null;
  const eventKeyword = extractEventKeyword(clean, assetType);
  const isRefQuestion = isReferenceSearchQuestion(question);
  const isExactMode = assetType !== null && EXACT_ASSET_TYPES.has(assetType);

  return {
    intent: isRefQuestion ? "reference_search" : "general",
    subtype: isRefQuestion ? "design_reference_search" : undefined,
    assetType,
    expandedAssetTypes,
    excludedAssetTypes,
    year,
    eventKeyword,
    isExactMode,
  };
}

// ─── File-Level Matching ──────────────────────────────────────────────────────

/**
 * Score a single file against the query synonyms.
 * Returns score > 0 only if the file is actually relevant to the query.
 */
function scoreFile(
  file: { name: string; url: string; mime_type?: string; type?: string },
  synonyms: string[],
  excludedTerms: string[],
  assetType: string | null,
): { score: number; reason: string } {
  if (!file.url) return { score: 0, reason: "" };
  if (file.type === "folder") return { score: 0, reason: "" }; // skip sub-folders

  const nameLower = (file.name || "").toLowerCase();

  // Hard exclusion: if file name contains any excluded term, skip it
  for (const excl of excludedTerms) {
    if (nameLower.includes(excl)) {
      return { score: 0, reason: "" };
    }
  }

  let fileScore = 0;
  let reason = "";

  // Exact key match in file name (e.g., file name literally contains "nametag")
  if (assetType) {
    const keyTerm = assetType.replace("_", " ");
    if (nameLower.includes(keyTerm)) {
      fileScore += 120;
      reason = `Nama file mengandung "${keyTerm}".`;
    }
  }

  // Synonym match in file name
  for (const syn of synonyms) {
    if (nameLower.includes(syn)) {
      if (fileScore === 0) {
        fileScore += 90;
        reason = `Nama file mengandung "${syn}".`;
      } else {
        fileScore += 10; // bonus for multiple matches
      }
    }
  }

  return { score: fileScore, reason };
}

/**
 * Extract only the files from a reference that actually match the query.
 * For specific asset searches, filters strictly. For general searches, returns top visual files.
 */
function getMatchedFiles(
  ref: DesignReference,
  intent: SearchIntent,
): MatchedFile[] {
  const inventory = ref.file_inventory;
  if (!inventory || inventory.length === 0) return [];

  const synonyms = intent.expandedAssetTypes;
  const excludedTerms = intent.isExactMode ? intent.excludedAssetTypes : [];

  // Score every file
  const scored: MatchedFile[] = [];
  for (const file of inventory) {
    if (!file.url || file.type === "folder") continue;

    if (intent.assetType && intent.isExactMode) {
      // Strict: only include files that explicitly match
      const { score, reason } = scoreFile(file, synonyms, excludedTerms, intent.assetType);
      if (score > 0) {
        scored.push({ name: file.name, url: file.url, mime_type: file.mime_type, score, reason });
      }
    } else {
      // General mode: prefer visual files, then pdf, then docs
      const mime = (file.mime_type || "").toLowerCase();
      const nameLow = file.name.toLowerCase();
      let score = 0;
      let reason = "File referensi.";

      if (mime.startsWith("image/") || nameLow.endsWith(".png") || nameLow.endsWith(".jpg") || nameLow.endsWith(".jpeg")) {
        score = 50;
        reason = "File gambar/desain.";
      } else if (mime === "application/pdf" || nameLow.endsWith(".pdf")) {
        score = 30;
        reason = "File PDF.";
      } else if (mime.includes("document") || nameLow.endsWith(".docx")) {
        score = 20;
        reason = "File dokumen.";
      } else if (file.url) {
        score = 10;
        reason = "File referensi.";
      }

      // Bonus if file name also matches intent
      if (intent.assetType) {
        const { score: fileMatchScore } = scoreFile(file, synonyms, [], intent.assetType);
        if (fileMatchScore > 0) {
          score += 30;
          reason = `File relevan dengan ${intent.assetType.replace("_", " ")}.`;
        }
      }

      if (score > 0) {
        scored.push({ name: file.name, url: file.url, mime_type: file.mime_type, score, reason });
      }
    }
  }

  // Sort by score descending, take max 3
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 3);
}

// ─── Reference-Level Scoring ──────────────────────────────────────────────────

/**
 * Calculate score for a reference against the search intent.
 * Also identifies matched files and scope.
 */
export function scoreReference(ref: DesignReference, intent: SearchIntent): ScoredReference {
  let score = 0;
  let reason = "";
  let matchScope: ScoredReference["matchScope"] = "none";
  let hasTitleMatch = false;
  let hasFileMatch = false;

  const titleLower = ref.title.toLowerCase();
  const eventLower = (ref.event_name || "").toLowerCase();
  const designTypeLower = (ref.design_type || "").toLowerCase();
  const styleLower = (ref.style_notes || "").toLowerCase();

  // ── General search (no specific asset type) ───────────────────────────────
  if (!intent.assetType || intent.assetType === "desain") {
    score = 50;
    matchScope = "general";
    reason = "Referensi desain umum.";

    if (intent.eventKeyword) {
      const ekLower = intent.eventKeyword.toLowerCase();
      if (titleLower.includes(ekLower) || eventLower.includes(ekLower)) {
        score += 40;
        reason = `Judul/kegiatan mengandung kata kunci "${intent.eventKeyword}".`;
      }
    }
    if (intent.year && ref.year === intent.year) {
      score += 30;
    }
    if (ref.year >= 2025) score += 10;

    const matchedFiles = getMatchedFiles(ref, intent);
    return { ref, score, reason, matchScope, matchedFiles, hasTitleMatch: false, hasFileMatch: false };
  }

  const synonyms = intent.expandedAssetTypes;

  // ── Title/design_type match (strong signal) ───────────────────────────────
  const titleHitSyn = synonyms.find(syn => titleLower.includes(syn));
  const designTypeHitSyn = synonyms.find(syn => designTypeLower.includes(syn));
  const styleHitSyn = synonyms.find(syn => styleLower.includes(syn));
  const eventHitSyn = synonyms.find(syn => eventLower.includes(syn));

  if (titleHitSyn) {
    score += 120;
    reason = `Judul referensi mengandung "${titleHitSyn}".`;
    matchScope = "title";
    hasTitleMatch = true;
  } else if (designTypeHitSyn) {
    score += 100;
    reason = `Tipe desain referensi adalah "${designTypeHitSyn}".`;
    matchScope = "design_type";
    hasTitleMatch = true;
  } else if (styleHitSyn) {
    score += 80;
    reason = `Catatan style referensi mengandung "${styleHitSyn}".`;
    matchScope = "title";
    hasTitleMatch = true;
  } else if (eventHitSyn) {
    score += 40;
    reason = `Nama kegiatan mengandung "${eventHitSyn}".`;
    matchScope = "title";
    hasTitleMatch = true;
  }

  // ── File-level matching (secondary signal) ────────────────────────────────
  const matchedFiles = getMatchedFiles(ref, intent);

  if (matchedFiles.length > 0) {
    hasFileMatch = true;
    if (!hasTitleMatch) {
      score += 80;
      reason = `Ditemukan ${matchedFiles.length} file yang mengandung ${intent.assetType.replace("_", " ")} di dalam folder ini.`;
      matchScope = "file";
    } else {
      score += 20; // bonus for having matching files too
    }
  }

  // ── In exact mode: if neither title nor file match → disqualify ───────────
  if (intent.isExactMode && !hasTitleMatch && !hasFileMatch) {
    score = 0;
    reason = "";
    matchScope = "none";
    return { ref, score, reason, matchScope, matchedFiles: [], hasTitleMatch, hasFileMatch };
  }

  // ── Event keyword bonus ───────────────────────────────────────────────────
  if (intent.eventKeyword) {
    const ekLower = intent.eventKeyword.toLowerCase();
    if (titleLower.includes(ekLower) || eventLower.includes(ekLower)) {
      score += 40;
    }
  }

  // ── Year bonus ────────────────────────────────────────────────────────────
  if (intent.year && ref.year === intent.year) {
    score += 30;
  }
  if (ref.year >= 2025) score += 10;

  // ── Exclusion penalty ─────────────────────────────────────────────────────
  const excludedHit = intent.excludedAssetTypes.some(excl => {
    const exclSyns = DESIGN_ASSET_SYNONYMS[excl] || [excl];
    return exclSyns.some(syn => titleLower.includes(syn) || designTypeLower.includes(syn));
  });
  if (excludedHit && !hasTitleMatch) {
    score -= 80;
  }

  return { ref, score, reason, matchScope, matchedFiles, hasTitleMatch, hasFileMatch };
}

// Backward-compatible export for existing callers
export function calculateReferenceScore(ref: DesignReference, intent: SearchIntent): number {
  return scoreReference(ref, intent).score;
}

// ─── Reranker ─────────────────────────────────────────────────────────────────

function parseJsonFromText(text: string) {
  try {
    return JSON.parse(text.trim());
  } catch {
    const match = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/```\s*([\s\S]*?)\s*```/);
    if (match?.[1]) {
      try {
        return JSON.parse(match[1].trim());
      } catch (err) {
        throw new Error("Failed to parse extracted JSON content: " + (err as Error).message);
      }
    }
    throw new Error("Could not find valid JSON block in response");
  }
}

async function rerankWithDeepSeek(
  question: string,
  candidates: ScoredReference[],
  intent: SearchIntent,
): Promise<{
  ranked_results: Array<{ id: string; score: number; reason: string; matched_file_names: string[] }>;
  excluded_results: Array<{ id: string; reason: string }>;
}> {
  const candidateList = candidates.map(c => ({
    id: c.ref.id,
    title: c.ref.title,
    event_name: c.ref.event_name || null,
    design_type: c.ref.design_type,
    year: c.ref.year,
    style_notes: c.ref.style_notes || null,
    // Only pass files that are pre-filtered as potentially relevant
    files: (c.ref.file_inventory || [])
      .filter(f => f.type !== "folder" && !!f.url)
      .map(f => f.name)
      .slice(0, 20), // cap to prevent huge prompts
    rule_matched_files: c.matchedFiles.map(f => f.name), // pre-scored matched files
    rule_score: c.score,
    has_title_match: c.hasTitleMatch,
    has_file_match: c.hasFileMatch,
  }));

  const isExactMode = intent.isExactMode;
  const assetTypeName = intent.assetType?.replace("_", " ") ?? "desain";

  const systemPrompt = `You are a precise AI reference reranker for JobDex.in, a task and asset management system for Indonesian student organizations.

Your job: rerank and filter candidate design references based on the user's search query.

CRITICAL RULES:
1. Only choose from the provided candidates. Do NOT hallucinate references or files.
2. The user is looking for SPECIFIC asset type: "${assetTypeName}". Be strict.
3. A candidate is relevant ONLY IF:
   a. Its title/design_type directly contains a synonym of "${assetTypeName}", OR
   b. It has pre-scored matched files (see rule_matched_files field) that contain the asset name.
4. Do NOT select a candidate just because its folder contains many files. The files must actually match.
5. Do NOT write vague reasons like "Sesuai pencarian". Reason must cite evidence: title, design_type, or specific file name.
6. If a candidate's title doesn't match AND rule_matched_files is empty, EXCLUDE it.
7. ${isExactMode ? "EXACT MODE ACTIVE: Only return candidates with clear evidence. It is OK to return only 1 result if only 1 truly matches. Do NOT force 3 results." : "Return up to 3 most relevant results."}
8. For each ranked result, list only the matched_file_names from rule_matched_files (or files you verified contain the asset name). Max 3 files per result.
9. Return valid JSON only.

SYNONYMS for "${assetTypeName}": ${JSON.stringify(intent.expandedAssetTypes)}
EXCLUDED types (do not show files from these): ${JSON.stringify(intent.excludedAssetTypes)}`;

  const userPrompt = `USER QUERY: "${question}"
DETECTED ASSET TYPE: "${intent.assetType || "desain"}"
EXACT MODE: ${isExactMode}

CANDIDATES:
${JSON.stringify(candidateList, null, 2)}

Return JSON in this exact format:
{
  "asset_type": "${assetTypeName}",
  "exact_match_count": <number>,
  "ranked_results": [
    {
      "id": "<reference_id>",
      "score": <0-100>,
      "reason": "<specific reason in Indonesian citing evidence>",
      "matched_file_names": ["<only files that are relevant to ${assetTypeName}>"]
    }
  ],
  "excluded_results": [
    {
      "id": "<reference_id>",
      "reason": "<reason for exclusion in Indonesian>"
    }
  ]
}`;

  const aiResult = await generateText({
    systemPrompt,
    prompt: userPrompt,
    feature: "reference_rerank",
    provider: "deepseek",
    useCache: false,
    responseFormat: { type: "json_object" },
    temperature: 0.05,
  });

  const parsed = parseJsonFromText(aiResult.text);
  if (!parsed || typeof parsed !== "object") {
    throw new Error("Invalid response format");
  }

  return {
    ranked_results: Array.isArray(parsed.ranked_results) ? parsed.ranked_results : [],
    excluded_results: Array.isArray(parsed.excluded_results) ? parsed.excluded_results : [],
  };
}

// ─── Build Answer Text ────────────────────────────────────────────────────────

function buildAnswerText(
  displayReferences: ScoredReference[],
  intent: SearchIntent,
  question: string,
): string {
  const assetDisplayName = intent.assetType ? intent.assetType.replace("_", " ") : "desain";

  if (displayReferences.length === 0) {
    const lines = [
      WA_LABEL.referensi,
      "",
      `Saya belum menemukan referensi yang cukup relevan untuk "${intent.assetType ? assetDisplayName : question}".`,
      "",
      intent.isExactMode
        ? `Tidak ada referensi dengan judul atau file yang benar-benar mengandung "${assetDisplayName}".`
        : "Coba tambahkan referensi ke dashboard Referensi agar bisa saya cari kembali.",
    ];
    return lines.join("\n");
  }

  const exactCount = displayReferences.filter(r => r.hasTitleMatch || r.hasFileMatch).length;
  const headerIntro = intent.assetType
    ? (exactCount > 0
        ? `Saya menemukan ${exactCount} referensi yang benar-benar relevan dengan "${assetDisplayName}":`
        : `Tidak ada referensi yang spesifik "${assetDisplayName}", namun ini yang paling mendekati:`)
    : `Saya menemukan ${displayReferences.length} referensi desain:`;

  const resultLines: string[] = [
    WA_LABEL.referensi,
    "",
    headerIntro,
    "",
  ];

  displayReferences.forEach((item, index) => {
    const ref = item.ref;
    const isApprovedTask = ref.id.startsWith("task_");

    if (isApprovedTask) {
      resultLines.push(`${index + 1}. Ditemukan dari jobdesk approved:`);
      resultLines.push(`   ${ref.title} - ${ref.event_name || "-"}`);
    } else {
      resultLines.push(`${index + 1}. ${ref.title}`);
      resultLines.push(`   Kegiatan: ${ref.event_name || "-"}`);
    }
    resultLines.push(`   Tahun: ${ref.year}`);

    // Honest reason
    if (item.reason) {
      resultLines.push(`   Alasan relevan: ${item.reason}`);
    }

    // Show matched files only
    if (item.matchedFiles.length > 0) {
      resultLines.push("   File cocok:");
      item.matchedFiles.forEach(f => {
        resultLines.push(`   - ${f.name}`);
        if (f.mime_type) resultLines.push(`     Type: ${f.mime_type}`);
        if (f.url) resultLines.push(`     Link: ${f.url}`);
      });
    } else if (ref.drive_url) {
      // Title matched but no specific files — show folder link
      resultLines.push(`   Folder: ${ref.drive_url}`);
    } else if (ref.drive_links && ref.drive_links.length > 0) {
      resultLines.push(`   Folder: ${ref.drive_links[0]}`);
    }

    resultLines.push("");
  });

  // Honest note for exact mode
  if (intent.isExactMode) {
    resultLines.push("Catatan:");
    resultLines.push(
      `Saya hanya menampilkan referensi yang benar-benar mengandung ${assetDisplayName} pada judul atau file.`
    );
    resultLines.push("Untuk melihat semua referensi, buka dashboard Referensi.");
  }

  return resultLines.join("\n").trim();
}

export { mapTaskSubcategoryToDesignType } from "@/lib/reference-utils";

// ─── Main Search Function ─────────────────────────────────────────────────────

export async function searchDesignReferencesDetailed(
  question: string,
  workspaceFilter?: { org_id?: string; campus_id?: string }
): Promise<{
  answer: string;
  intent: SearchIntent;
  candidateCount: number;
  rerankerProvider: string;
  finalResultCount: number;
  fallbackUsed: boolean;
}> {
  const cleanQuestion = question.toLowerCase().trim();
  const intent = detectSearchIntent(cleanQuestion);

  const targetOrgId = workspaceFilter?.org_id;
  const targetCampusId = workspaceFilter?.campus_id;

  const db = getAdminDb();
  const snapshot = await db
    .collection("design_references")
    .where("is_archived", "==", false)
    .get();

  const allReferences: DesignReference[] = [];
  snapshot.forEach((doc) => {
    const data = doc.data() as Record<string, unknown>;
    if (targetOrgId) {
      const docOrg = data.organization_id || data.org_id || data.orgId || "main_org";
      if (docOrg !== targetOrgId) return;
    }
    if (targetCampusId) {
      const docCampus = data.campus_id || data.campusId || data.univ_id || data.univId || "ui";
      if (docCampus !== targetCampusId) return;
    }
    allReferences.push({ id: doc.id, ...data } as DesignReference);
  });

  // Fetch tasks candidate for reference
  const tasksSnapshot = await db
    .collection("tasks")
    .where("status", "==", "approved")
    .get();

  const allEventsSnap = await db.collection("events").get();
  const eventsMap = new Map<string, string>();
  allEventsSnap.forEach((doc) => {
    const eData = doc.data();
    if (targetOrgId) {
      const eOrg = eData.organization_id || eData.org_id || eData.orgId || "main_org";
      if (eOrg !== targetOrgId) return;
    }
    eventsMap.set(doc.id, eData.name || "");
  });

  const taskPromises: Promise<{
    taskId: string;
    taskData: Record<string, unknown>;
    uploads: TaskUpload[];
  }>[] = [];
  tasksSnapshot.forEach((doc) => {
    const taskData = doc.data() as Record<string, unknown>;
    if (targetOrgId) {
      const tOrg = taskData.organization_id || taskData.org_id || taskData.orgId || "main_org";
      if (tOrg !== targetOrgId) return;
    }
    if (targetCampusId) {
      const tCampus = taskData.campus_id || taskData.campusId || taskData.univ_id || taskData.univId || "ui";
      if (tCampus !== targetCampusId) return;
    }
    const taskId = doc.id;
    const promise = doc.ref.collection("uploads").orderBy("version_number", "desc").get().then((uploadsSnap) => {
      const uploads: TaskUpload[] = [];
      uploadsSnap.forEach((uDoc) => {
        uploads.push({ id: uDoc.id, ...uDoc.data() } as TaskUpload);
      });
      return { taskId, taskData, uploads };
    });
    taskPromises.push(promise);
  });

  const taskUploadsResults = await Promise.all(taskPromises);

  taskUploadsResults.forEach(({ taskId, taskData, uploads }) => {
    if (!isTaskReferenceEligible(taskData, uploads.length)) return;

    if (taskData.data_sensitivity === "sensitive") return;

    const isArchiveMatch = !taskData.is_archived || (taskData.is_archived && taskData.archive_enabled);
    if (!isArchiveMatch) return;

    const finalUpload = uploads.find((u) => u.is_final_candidate) || uploads[0];

    let taskYear = new Date().getFullYear();
    if (taskData.deadline) {
      const deadline = taskData.deadline as { toDate?: () => Date } | Date | string | number;
      const d = (typeof deadline === "object" && deadline && "toDate" in deadline && typeof deadline.toDate === "function")
        ? deadline.toDate()
        : new Date(deadline as string | number | Date);
      if (!isNaN(d.getTime())) {
        taskYear = d.getFullYear();
      }
    }

    const visualType = mapTaskSubcategoryToDesignType(taskData.subcategory_key as string);
    const fileUrl = (finalUpload?.upload_url || taskData.result_design_url || "") as string;
    const thumbnailUrl = (finalUpload?.thumbnail_url || (fileUrl && fileUrl.match(/\.(jpeg|jpg|gif|png|webp)/i) ? fileUrl : "")) as string;
    const sourceLink = (finalUpload?.source_link || taskData.source_link || "") as string;

    const refItem: DesignReference = {
      id: `task_${taskId}`,
      organization_id: (taskData.organization_id || "main_org") as string,
      title: taskData.name as string,
      event_name: taskData.event_id ? (eventsMap.get(taskData.event_id as string) || "") : "",
      design_type: visualType,
      year: taskYear,
      drive_url: fileUrl,
      thumbnail_url: thumbnailUrl,
      style_notes: (taskData.visual_direction || taskData.description || "") as string,
      color_palette: (taskData.color_palette || []) as string[],
      notes: (taskData.description || "") as string,
      is_archived: (taskData.is_archived || false) as boolean,
      created_by: (taskData.pic_id || taskData.created_by || "") as string,
      scope: taskData.type as "divisi" | "acara",
      category: taskData.category_key as unknown as "divisi" | "acara" | "canva" | "drive" | "video" | "dokumen" | "lainnya",
      event_id: (taskData.event_id || "") as string,
      drive_links: [taskData.drive_reference_url].filter(Boolean) as string[],
      canva_links: sourceLink.includes("canva.com") ? [sourceLink] : [],
      doc_links: (sourceLink.includes("docs.google.com") || sourceLink.includes("drive.google.com")) ? [sourceLink] : [],
      other_links: (!sourceLink.includes("canva.com") && !sourceLink.includes("google.com")) ? [sourceLink] : [],
      file_inventory: uploads.map((u) => ({
        name: u.file_name || `Hasil pengerjaan - v${u.version_number}`,
        url: u.upload_url || u.source_link || "",
        type: "file" as const,
        mime_type: u.file_type || "",
      })),
      file_inventory_notes: finalUpload?.upload_note || "",
    };

    allReferences.push(refItem);
  });

  // ── Step 1: Score all references with file-level analysis ────────────────
  const scoredAll = allReferences.map(ref => scoreReference(ref, intent));

  // ── Step 2: Filter candidates ────────────────────────────────────────────
  let candidates: ScoredReference[];

  if (intent.isExactMode) {
    // Exact mode: only keep references that have title-match OR file-match
    candidates = scoredAll
      .filter(s => s.score > 0 && (s.hasTitleMatch || s.hasFileMatch))
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
  } else {
    // General mode: keep positive-score candidates
    const positive = scoredAll.filter(s => s.score > 0);
    candidates = (positive.length > 0 ? positive : scoredAll)
      .sort((a, b) => b.score - a.score)
      .slice(0, 20);
  }

  let finalReferences: ScoredReference[] = [];
  let rerankerProvider = "rule-based";
  let fallbackUsed = false;

  const hasDeepSeekKey = !!process.env.DEEPSEEK_API_KEY;

  // ── Step 3: AI Reranker (if available) ──────────────────────────────────
  if (hasDeepSeekKey && candidates.length > 0) {
    try {
      const rerankResult = await rerankWithDeepSeek(question, candidates, intent);
      const candidatesMap = new Map(candidates.map(c => [c.ref.id, c]));

      for (const item of rerankResult.ranked_results) {
        const scored = candidatesMap.get(item.id);
        if (!scored) continue;

        // Build final matched files: use AI-provided matched file names to filter
        let finalMatchedFiles = scored.matchedFiles;
        if (item.matched_file_names && item.matched_file_names.length > 0) {
          const aiMatchedNames = new Set(item.matched_file_names.map((n: string) => n.toLowerCase()));
          const fromInventory = (scored.ref.file_inventory || [])
            .filter(f => f.url && f.type !== "folder" && aiMatchedNames.has(f.name.toLowerCase()))
            .map(f => ({
              name: f.name,
              url: f.url,
              mime_type: f.mime_type,
              score: 100,
              reason: item.reason,
            }))
            .slice(0, 3);

          // If AI gave us matched names but they aren't in inventory, fall back to rule-based
          finalMatchedFiles = fromInventory.length > 0 ? fromInventory : scored.matchedFiles;
        }

        finalReferences.push({
          ...scored,
          score: item.score,
          reason: item.reason || scored.reason,
          matchedFiles: finalMatchedFiles,
        });
      }

      rerankerProvider = "deepseek";
    } catch (err) {
      console.error("[Reference Search] DeepSeek reranker failed, falling back to rule-based:", err);
      fallbackUsed = true;
      rerankerProvider = "rule-based";
    }
  }

  // ── Step 4: Rule-based fallback ──────────────────────────────────────────
  if (rerankerProvider !== "deepseek" || finalReferences.length === 0) {
    fallbackUsed = rerankerProvider === "deepseek";
    rerankerProvider = "rule-based";

    // In exact mode: strict — only title or file matches
    // In general mode: top 3 by score
    const MAX_RESULTS = 3;
    finalReferences = candidates.slice(0, MAX_RESULTS);
  }

  // ── Step 5: Limit results ────────────────────────────────────────────────
  const displayReferences = finalReferences.slice(0, 3);

  const answer = buildAnswerText(displayReferences, intent, question);

  return {
    answer,
    intent,
    candidateCount: allReferences.length,
    rerankerProvider,
    finalResultCount: displayReferences.length,
    fallbackUsed,
  };
}

export async function searchDesignReferencesFromQuestion(question: string): Promise<string> {
  const result = await searchDesignReferencesDetailed(question);
  return result.answer;
}

// ─── Backward-compatible exports ──────────────────────────────────────────────

export function matchesAssetType(ref: DesignReference, typeKey: string): boolean {
  const synonyms = DESIGN_ASSET_SYNONYMS[typeKey] || [typeKey.replace("_", " ")];
  const titleLower = ref.title.toLowerCase();
  const eventLower = (ref.event_name || "").toLowerCase();
  const designTypeLower = (ref.design_type || "").toLowerCase();
  const styleLower = (ref.style_notes || "").toLowerCase();

  if (synonyms.some(syn => titleLower.includes(syn) || designTypeLower.includes(syn) || styleLower.includes(syn) || eventLower.includes(syn))) {
    return true;
  }

  if (ref.file_inventory && Array.isArray(ref.file_inventory)) {
    for (const file of ref.file_inventory) {
      const fileNameLower = (file.name || "").toLowerCase();
      if (synonyms.some(syn => fileNameLower.includes(syn))) {
        return true;
      }
    }
  }

  return false;
}
