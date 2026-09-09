import { NextResponse, type NextRequest } from "next/server";
import { getAdminDb } from "@/lib/server/firebase-admin";
import { getServerAuthContext, AuthRoleError } from "@/lib/server/auth";
import type { DesignReference } from "@/types";

export const dynamic = "force-dynamic";

function expandKeywords(question: string): string[] {
  const clean = question.toLowerCase();
  const words = clean
    .split(/\s+/)
    .map((w) => w.trim())
    .filter(Boolean);
  const expanded = new Set<string>(words);

  const synonymGroups = [
    ["poster", "pamflet", "flyer", "feed", "publikasi"],
    ["nametag", "name tag", "id card", "tanda pengenal"],
    ["audio", "sound", "senam", "mp3", "audio/mpeg"],
    ["video", "mp4", "reels", "animasi"],
    ["perlengkapan", "aset", "peralatan"],
  ];

  for (const word of words) {
    for (const group of synonymGroups) {
      if (group.includes(word)) {
        group.forEach((syn) => expanded.add(syn));
      }
    }
  }

  if (clean.includes("name tag")) {
    expanded.add("nametag");
    expanded.add("name tag");
    expanded.add("id card");
    expanded.add("tanda pengenal");
  }
  if (clean.includes("id card")) {
    expanded.add("nametag");
    expanded.add("name tag");
    expanded.add("tanda pengenal");
  }
  if (clean.includes("tanda pengenal")) {
    expanded.add("nametag");
    expanded.add("name tag");
    expanded.add("id card");
  }

  return Array.from(expanded);
}

function calculateScore(ref: DesignReference, cleanQuestion: string, keywords: string[]): number {
  let score = 0;

  if (ref.title.toLowerCase().trim() === cleanQuestion) {
    score += 8;
  }

  for (const keyword of keywords) {
    if (ref.title.toLowerCase().includes(keyword)) {
      score += 5;
    }
  }

  if (ref.file_inventory && Array.isArray(ref.file_inventory)) {
    for (const file of ref.file_inventory) {
      if (file.name) {
        for (const keyword of keywords) {
          if (file.name.toLowerCase().includes(keyword)) {
            score += 5;
            break;
          }
        }
      }
    }
  }

  if (ref.event_name) {
    for (const keyword of keywords) {
      if (ref.event_name.toLowerCase().includes(keyword)) {
        score += 4;
      }
    }
  }

  const yearMatch = cleanQuestion.match(/\b(20\d{2})\b/);
  if (yearMatch) {
    const yearAsked = parseInt(yearMatch[1], 10);
    if (ref.year === yearAsked) {
      score += 4;
    }
  }

  for (const keyword of keywords) {
    if (
      (ref.category && ref.category.toLowerCase().includes(keyword)) ||
      (ref.design_type && ref.design_type.toLowerCase().includes(keyword))
    ) {
      score += 3;
    }
  }

  for (const keyword of keywords) {
    if (
      (ref.summary_notes && ref.summary_notes.toLowerCase().includes(keyword)) ||
      (ref.notes && ref.notes.toLowerCase().includes(keyword)) ||
      (ref.style_notes && ref.style_notes.toLowerCase().includes(keyword))
    ) {
      score += 2;
    }
  }

  return score;
}

export async function GET(request: NextRequest) {
  try {
    const { profile } = await getServerAuthContext(request);
    const { searchParams } = new URL(request.url);
    const queryText = searchParams.get("q") || "";

    if (!queryText.trim()) {
      return NextResponse.json({ results: [] });
    }

    const userOrgId = profile.organization_id || profile.org_id || ((profile as unknown as Record<string, unknown>).orgId as string) || "";
    const userCampusId = profile.campus_id || profile.univ_id || ((profile as unknown as Record<string, unknown>).campusId as string) || "";
    const requestedOrgId = searchParams.get("org_id");
    const requestedCampusId = searchParams.get("campus_id");

    let orgId = userOrgId;
    let campusId = userCampusId;

    if (profile.role === "super_admin") {
      orgId = requestedOrgId || userOrgId;
      campusId = requestedCampusId || userCampusId;
    } else {
      if (requestedOrgId && userOrgId && requestedOrgId !== userOrgId) {
        return NextResponse.json(
          { error: "Akses ditolak: Anda tidak memiliki izin mengakses data organisasi lain." },
          { status: 403 }
        );
      }
      if (requestedCampusId && userCampusId && requestedCampusId !== userCampusId) {
        return NextResponse.json(
          { error: "Akses ditolak: Anda tidak memiliki izin mengakses data kampus lain." },
          { status: 403 }
        );
      }
    }

    const cleanQuestion = queryText.toLowerCase().trim();
    const keywords = expandKeywords(cleanQuestion);

    const db = getAdminDb();
    const snapshot = await db
      .collection("design_references")
      .where("is_archived", "==", false)
      .get();

    const allReferences: DesignReference[] = [];
    snapshot.forEach((doc) => {
      const data = doc.data() as Record<string, unknown>;
      if (orgId) {
        const docOrg = data.organization_id || data.org_id || data.orgId || "main_org";
        if (docOrg !== orgId) return;
      }
      if (campusId) {
        const docCampus = data.campus_id || data.campusId || data.univ_id || data.univId || "ui";
        if (docCampus !== campusId) return;
      }
      allReferences.push({ id: doc.id, ...data } as DesignReference);
    });

    const scored = allReferences
      .map((ref) => ({
        ref,
        score: calculateScore(ref, cleanQuestion, keywords),
      }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map((item) => item.ref);

    return NextResponse.json({ results: scored });
  } catch (error: unknown) {
    if (error instanceof AuthRoleError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    const message = error instanceof Error ? error.message : "Internal Server Error";
    const status = message.includes("Token") || message.includes("auth") ? 401 : 500;
    console.error("[Search References API] Failed:", error);
    return NextResponse.json({ error: message }, { status });
  }
}
