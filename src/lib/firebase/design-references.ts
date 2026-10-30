import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { db, auth } from "@/lib/firebase/client";
import { isKoordinator, isKoordinatorAcara } from "@/lib/permissions";
import type {
  DesignReference,
  DesignReferenceInput,
  UserProfile,
  ReferenceListItem,
  DesignType,
} from "@/types";

function sortReferences(references: DesignReference[]) {
  return references.sort((a, b) => {
    if (b.year !== a.year) {
      return b.year - a.year;
    }

    return a.title.localeCompare(b.title);
  });
}

export async function getDesignReferencesForProfile(
  profile: UserProfile,
  workspaceFilter?: { org_id?: string; campus_id?: string }
) {
  const referencesRef = collection(db, "design_references");
  const referencesQuery = isKoordinator(profile)
    ? query(referencesRef)
    : query(
        referencesRef,
        where("is_archived", "==", false),
      );

  const snapshot = await getDocs(referencesQuery);
  const references = snapshot.docs.map((item) => ({
    id: item.id,
    ...item.data(),
  })) as DesignReference[];

  const targetOrgId = workspaceFilter?.org_id || profile.organization_id || profile.org_id;
  const targetCampusId = workspaceFilter?.campus_id || profile.campus_id || profile.univ_id;

  let filtered = isKoordinator(profile)
    ? references
    : references.filter((reference) => !reference.is_archived);

  const isMatchingOrg = (docOrg: unknown, target: unknown) => {
    if (!target) return true;
    const docStr = String(docOrg || "main_org").trim();
    const targetStr = String(target).trim();
    if (docStr === targetStr) return true;
    const isForkom = (x: string) => x === "main_org" || x === "org-undiksha-forkom-kip";
    return isForkom(docStr) && isForkom(targetStr);
  };

  const isMatchingCampus = (docCampus: unknown, target: unknown) => {
    if (!target) return true;
    const docStr = docCampus ? String(docCampus).trim() : "";
    if (!docStr || docStr === "ui") return true;
    const targetStr = String(target).trim();
    if (docStr === targetStr) return true;
    const isUndiksha = (x: string) => x === "univ-undiksha" || x === "undiksha";
    return isUndiksha(docStr) && isUndiksha(targetStr);
  };

  if (targetOrgId) {
    filtered = filtered.filter((r) => {
      const rOrg =
        r.organization_id ||
        r.org_id ||
        (r as unknown as Record<string, unknown>).orgId ||
        "main_org";
      return isMatchingOrg(rOrg, targetOrgId);
    });
  }

  if (targetCampusId) {
    filtered = filtered.filter((r) => {
      const rCampus =
        r.campus_id ||
        (r as unknown as Record<string, unknown>).campusId ||
        r.univ_id ||
        (r as unknown as Record<string, unknown>).univId;
      return isMatchingCampus(rCampus, targetCampusId);
    });
  }

  return sortReferences(filtered);
}

export async function createDesignReference(
  input: DesignReferenceInput,
  createdBy: string,
) {
  const referenceRef = doc(collection(db, "design_references"));
  let orgId = input.organization_id || input.org_id || input.orgId;
  let campusId = input.campus_id || input.campusId || input.univ_id || input.univId || "";

  // Otomatis isi univId dan orgId dari profil pembuat jika belum terisi
  if ((!orgId || !campusId) && createdBy) {
    try {
      const userSnap = await getDoc(doc(db, "users", createdBy));
      if (userSnap.exists()) {
        const uData = userSnap.data() as Record<string, unknown>;
        orgId = orgId || (uData.orgId as string) || (uData.org_id as string) || (uData.organization_id as string);
        campusId = campusId || (uData.univId as string) || (uData.univ_id as string) || (uData.campusId as string) || (uData.campus_id as string) || "";
      }
    } catch {
      // ignore
    }
  }

  if (!orgId) {
    throw new Error("Ruang kerja aktif (organisasi / ormawa) wajib dipilih sebelum menambahkan referensi desain.");
  }

  await setDoc(referenceRef, {
    id: referenceRef.id,
    organization_id: orgId,
    org_id: orgId,
    orgId: orgId,
    campus_id: campusId,
    campusId: campusId,
    univ_id: campusId,
    univId: campusId,
    title: input.title,
    event_name: input.event_name,
    design_type: input.design_type,
    year: input.year,
    drive_url: input.drive_url,
    thumbnail_url: input.thumbnail_url,
    style_notes: input.style_notes,
    color_palette: input.color_palette,
    notes: input.notes,
    is_archived: false,
    created_by: createdBy,
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
    
    // New fields
    scope: input.scope || "divisi",
    category: input.category || "lainnya",
    event_id: input.event_id || "",
    drive_links: input.drive_links || [],
    canva_links: input.canva_links || [],
    doc_links: input.doc_links || [],
    other_links: input.other_links || [],
    summary_notes: input.summary_notes || "",
    file_inventory_notes: input.file_inventory_notes || "",
    file_inventory: input.file_inventory || [],
  });

  return referenceRef.id;
}

export async function updateDesignReference(
  referenceId: string,
  input: DesignReferenceInput,
  workspaceFilter?: { org_id?: string; campus_id?: string }
) {
  const refDoc = await getDoc(doc(db, "design_references", referenceId));
  if (refDoc.exists()) {
    const existing = refDoc.data() as Record<string, unknown>;
    const existingOrg = existing.organization_id || existing.org_id || existing.orgId;
    const existingCampus = existing.campus_id || existing.univ_id || existing.univId || existing.campusId;

    if (workspaceFilter?.org_id && existingOrg && workspaceFilter.org_id !== existingOrg) {
      throw new Error("Akses ditolak: Tidak dapat memodifikasi referensi desain milik organisasi/ormawa lain.");
    }
    if (workspaceFilter?.campus_id && existingCampus && workspaceFilter.campus_id !== existingCampus) {
      throw new Error("Akses ditolak: Tidak dapat memodifikasi referensi desain milik kampus lain.");
    }

    const inputOrg = input.organization_id || input.org_id || input.orgId;
    if (inputOrg && existingOrg && inputOrg !== existingOrg) {
      throw new Error("Dilarang mengubah penanda kepemilikan ormawa/organisasi pada pembaruan referensi desain.");
    }

    const inputCampus = input.campus_id || input.univ_id || input.univId || input.campusId;
    if (inputCampus && existingCampus && inputCampus !== existingCampus) {
      throw new Error("Dilarang mengubah penanda kepemilikan kampus pada pembaruan referensi desain.");
    }
  }

  await updateDoc(doc(db, "design_references", referenceId), {
    title: input.title,
    event_name: input.event_name,
    design_type: input.design_type,
    year: input.year,
    drive_url: input.drive_url,
    thumbnail_url: input.thumbnail_url,
    style_notes: input.style_notes,
    color_palette: input.color_palette,
    notes: input.notes,
    updated_at: serverTimestamp(),

    // New fields
    scope: input.scope || "divisi",
    category: input.category || "lainnya",
    event_id: input.event_id || "",
    drive_links: input.drive_links || [],
    canva_links: input.canva_links || [],
    doc_links: input.doc_links || [],
    other_links: input.other_links || [],
    summary_notes: input.summary_notes || "",
    file_inventory_notes: input.file_inventory_notes || "",
    file_inventory: input.file_inventory || [],
  });
}

export async function archiveDesignReference(
  referenceId: string,
  workspaceFilter?: { org_id?: string; campus_id?: string }
) {
  const refDoc = await getDoc(doc(db, "design_references", referenceId));
  if (refDoc.exists()) {
    const existing = refDoc.data() as Record<string, unknown>;
    const existingOrg = existing.organization_id || existing.org_id || existing.orgId;
    const existingCampus = existing.campus_id || existing.univ_id || existing.univId || existing.campusId;

    if (workspaceFilter?.org_id && existingOrg && workspaceFilter.org_id !== existingOrg) {
      throw new Error("Akses ditolak: Tidak dapat mengarsipkan referensi desain milik organisasi/ormawa lain.");
    }
    if (workspaceFilter?.campus_id && existingCampus && workspaceFilter.campus_id !== existingCampus) {
      throw new Error("Akses ditolak: Tidak dapat mengarsipkan referensi desain milik kampus lain.");
    }
  }

  await updateDoc(doc(db, "design_references", referenceId), {
    is_archived: true,
    updated_at: serverTimestamp(),
  });
}

export function canCreateDesignReference(profile: UserProfile | null) {
  return isKoordinator(profile);
}

export function canEditDesignReference(
  profile: UserProfile | null,
  reference: DesignReference | null,
) {
  if (!profile || !reference) {
    return false;
  }

  if (profile.role === "super_admin" || profile.role === "koordinator_divisi") {
    return true;
  }

  return isKoordinatorAcara(profile) && reference.created_by === profile.id;
}

export function mapTaskSubcategoryToDesignType(subcategoryKey?: string): DesignType {
  if (!subcategoryKey) return "lainnya";
  const key = subcategoryKey.toLowerCase();
  if (key === "poster") return "poster";
  if (key === "name_tag" || key === "id_card" || key === "kartu_panitia" || key === "badge_peserta") return "name_tag";
  if (key === "twibbon") return "twibbon";
  if (key.includes("feed")) return "feed_ig";
  if (key.includes("story")) return "story_ig";
  if (key.includes("banner") || key.includes("spanduk") || key.includes("backdrop") || key.includes("baliho")) return "banner";
  if (key === "sertifikat" || key === "piagam") return "sertifikat";
  if (key.includes("foto") || key.includes("dokumentasi")) return "dokumentasi";
  if (key.includes("video") || key.includes("animasi")) return "animasi";
  if (key.includes("merchandise") || key.includes("kaos") || key.includes("baju") || key.includes("plakat")) return "merchandise";
  return "lainnya";
}

export async function getCombinedReferencesForDashboard(
  profile: UserProfile,
  workspaceFilter?: { org_id?: string; campus_id?: string }
): Promise<ReferenceListItem[]> {
  if (!profile) return [];
  const currentUser = auth.currentUser;
  const token = currentUser ? await currentUser.getIdToken() : "";

  const headers: HeadersInit = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const queryParams = new URLSearchParams();
  const orgId = workspaceFilter?.org_id || profile.organization_id || profile.org_id;
  const campusId = workspaceFilter?.campus_id || profile.campus_id || profile.univ_id;
  if (orgId) queryParams.set("org_id", orgId);
  if (campusId) queryParams.set("campus_id", campusId);

  const url = queryParams.toString() ? `/api/references?${queryParams.toString()}` : "/api/references";
  const res = await fetch(url, { headers });
  if (!res.ok) {
    const err = new Error(`Gagal mengambil referensi. (Status ${res.status})`) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }

  const data = await res.json();
  return data.references || [];
}
