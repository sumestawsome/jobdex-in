import "server-only";
import fs from "fs";
import path from "path";
import { FieldValue, getAdminDb } from "@/lib/server/firebase-admin";

export interface FaqItem {
  id: string;
  category: string;
  canonical_question: string;
  patterns: string[];
  keywords: string[];
  answer: string;
  is_active: boolean;
  hit_count: number;
}

export interface FaqMatchResult {
  faq: FaqItem;
  score: number;
  patternMatched: boolean;
  matchedKeywordsCount: number;
}

let cachedFaqs: FaqItem[] | null = null;
let lastCacheTime = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 menit cache in-memory

/**
 * Membersihkan input query:
 * - Menghapus prefix !jobdex atau /jobdex
 * - Menghapus tanda baca (Unicode aware)
 * - Mengubah ke huruf kecil & merapikan spasi
 */
export function cleanFaqInputText(text: string): string {
  if (!text || typeof text !== "string") return "";
  return text
    .replace(/^[!/]jobde[xs]\b/i, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Mengambil daftar 105 FAQ Knowledge dari Firestore (dengan cache in-memory)
 * atau fallback ke file data/faq-knowledge.json.
 */
export async function getFaqKnowledgeList(): Promise<FaqItem[]> {
  const now = Date.now();
  if (cachedFaqs && now - lastCacheTime < CACHE_TTL_MS) {
    return cachedFaqs;
  }

  try {
    const db = getAdminDb();
    const snapshot = await db.collection("faq_knowledge").where("is_active", "==", true).get();
    if (!snapshot.empty) {
      cachedFaqs = snapshot.docs.map((doc) => doc.data() as FaqItem);
      lastCacheTime = now;
      return cachedFaqs;
    }
  } catch (error) {
    console.warn("[FAQ Matcher] Firestore fetch failed or collection empty, fallback to local file:", error);
  }

  try {
    const jsonPath = path.resolve(process.cwd(), "data/faq-knowledge.json");
    if (fs.existsSync(jsonPath)) {
      const raw = fs.readFileSync(jsonPath, "utf-8");
      const list = JSON.parse(raw) as FaqItem[];
      cachedFaqs = list.filter((item) => item.is_active !== false);
      lastCacheTime = now;
      return cachedFaqs;
    }
  } catch (err) {
    console.error("[FAQ Matcher] Local fallback read failed:", err);
  }

  return cachedFaqs || [];
}

/**
 * Mencari kecocokan FAQ berdasarkan aturan:
 * - Cocok dengan salah satu `patterns`
 * - ATAU memiliki minimal 3 kata kunci dari `keywords` yang cocok.
 * Mengembalikan item dengan skor tertinggi.
 */
export async function findFaqMatch(inputText: string): Promise<FaqMatchResult | null> {
  const cleaned = cleanFaqInputText(inputText);
  if (!cleaned) return null;

  const faqs = await getFaqKnowledgeList();
  if (!faqs || faqs.length === 0) return null;

  const queryWords = cleaned.split(/\s+/).filter((w) => w.length > 0);
  const queryWordSet = new Set(queryWords);

  let bestMatch: FaqMatchResult | null = null;
  let highestScore = -1;

  for (const faq of faqs) {
    if (faq.is_active === false) continue;

    let patternScore = 0;
    let patternMatched = false;

    // 1. Pencocokan Patterns
    for (const pat of faq.patterns || []) {
      const cleanPat = cleanFaqInputText(pat);
      if (!cleanPat) continue;

      if (cleaned === cleanPat) {
        patternScore = Math.max(patternScore, 1000);
        patternMatched = true;
      } else if (cleaned.includes(cleanPat)) {
        patternScore = Math.max(patternScore, 500 + cleanPat.length);
        patternMatched = true;
      } else if (cleanPat.includes(cleaned) && cleaned.length >= 6) {
        patternScore = Math.max(patternScore, 300 + cleaned.length);
        patternMatched = true;
      }
    }

    // 2. Pencocokan Keywords
    let matchedKeywordsCount = 0;
    for (const kw of faq.keywords || []) {
      const cleanKw = cleanFaqInputText(kw);
      if (!cleanKw) continue;

      if (cleanKw.includes(" ")) {
        if (cleaned.includes(cleanKw)) {
          matchedKeywordsCount++;
        }
      } else {
        if (
          queryWordSet.has(cleanKw) ||
          queryWords.some(
            (w) => w === cleanKw || (cleanKw.length >= 4 && (w.startsWith(cleanKw) || cleanKw.startsWith(w)))
          )
        ) {
          matchedKeywordsCount++;
        }
      }
    }

    // Syarat: cocok dengan pattern ATAU memiliki minimal 3 keywords cocok
    const keywordCondition = matchedKeywordsCount >= 3;

    if (patternMatched || keywordCondition) {
      const kwScore = keywordCondition
        ? matchedKeywordsCount * 25 + (matchedKeywordsCount / Math.max(faq.keywords.length, 1)) * 10
        : 0;
      const totalScore = patternScore + kwScore;

      if (totalScore > highestScore) {
        highestScore = totalScore;
        bestMatch = {
          faq,
          score: totalScore,
          patternMatched,
          matchedKeywordsCount,
        };
      }
    }
  }

  return bestMatch;
}

/**
 * Menambah hit_count (+1) di Firestore untuk dokumen FAQ yang berhasil dicocokkan
 */
export async function incrementFaqHitCount(faqId: string): Promise<void> {
  try {
    const db = getAdminDb();
    await db.collection("faq_knowledge").doc(faqId).update({
      hit_count: FieldValue.increment(1),
      last_hit_at: FieldValue.serverTimestamp(),
    });
  } catch (err) {
    console.warn(`[FAQ Matcher] Failed to increment hit_count for ${faqId}:`, err);
  }
}
