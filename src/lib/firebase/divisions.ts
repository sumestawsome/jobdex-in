import {
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { defaultDivision } from "@/lib/seed-data";
import type { Division, ReferenceLink, UserProfile } from "@/types";

export async function createDefaultDivision() {
  await setDoc(
    doc(db, "divisions", defaultDivision.id),
    {
      ...defaultDivision,
      created_at: serverTimestamp(),
      updated_at: serverTimestamp(),
    },
    { merge: true },
  );
}

/**
 * Tambah divisi baru.
 */
export async function createDivision(
  id: string,
  input: {
    name: string;
    description: string;
    slug: string;
    coordinator_id: string;
    is_active: boolean;
    organization_id?: string;
    org_id?: string;
    orgId?: string;
    campus_id?: string;
    campusId?: string;
    univ_id?: string;
    univId?: string;
  }
) {
  let orgId = input.organization_id || input.org_id || input.orgId;
  let campusId = input.campus_id || input.campusId || input.univ_id || input.univId || "";

  // Otomatis isi univId dan orgId dari profil koordinator jika belum terisi
  if ((!orgId || !campusId) && input.coordinator_id) {
    try {
      const userSnap = await getDoc(doc(db, "users", input.coordinator_id));
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
    throw new Error("Ruang kerja aktif (organisasi / ormawa) wajib dipilih sebelum membuat divisi.");
  }

  await setDoc(doc(db, "divisions", id), {
    id,
    organization_id: orgId,
    org_id: orgId,
    orgId: orgId,
    campus_id: campusId,
    campusId: campusId,
    univ_id: campusId,
    univId: campusId,
    name: input.name,
    description: input.description,
    slug: input.slug,
    coordinator_id: input.coordinator_id || "",
    is_active: input.is_active,
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
    design_kit_color_palette: [],
    design_kit_visual_direction: "",
    design_kit_supergraphic_notes: "",
    design_kit_design_reference_links: [],
    design_kit_drive_reference_links: [],
    design_kit_archive_drive_links: [],
    design_kit_notes_for_members: "",
  });

  if (input.coordinator_id) {
    await updateDoc(doc(db, "users", input.coordinator_id), {
      role: "koordinator_divisi",
      division_id: id,
      updated_at: serverTimestamp(),
    });
  }
}

/**
 * Edit divisi.
 */
export async function updateDivision(
  id: string,
  input: {
    name: string;
    description: string;
    slug: string;
    coordinator_id: string;
    is_active: boolean;
  },
  workspaceFilter?: { org_id?: string; campus_id?: string }
) {
  const divRef = doc(db, "divisions", id);
  const divSnap = await getDoc(divRef);

  if (divSnap.exists()) {
    const dData = divSnap.data() as Record<string, unknown>;
    const existingOrg = dData.organization_id || dData.org_id || dData.orgId;
    const existingCampus = dData.campus_id || dData.univ_id || dData.univId || dData.campusId;
    if (workspaceFilter?.org_id && existingOrg && workspaceFilter.org_id !== existingOrg) {
      throw new Error("Akses ditolak: Tidak dapat memodifikasi divisi milik organisasi/ormawa lain.");
    }
    if (workspaceFilter?.campus_id && existingCampus && workspaceFilter.campus_id !== existingCampus) {
      throw new Error("Akses ditolak: Tidak dapat memodifikasi divisi milik kampus lain.");
    }
  }

  const oldCoordinatorId = divSnap.exists() ? divSnap.data().coordinator_id : "";

  await updateDoc(divRef, {
    name: input.name,
    description: input.description,
    slug: input.slug,
    coordinator_id: input.coordinator_id || "",
    is_active: input.is_active,
    updated_at: serverTimestamp(),
  });

  const newCoordinatorId = input.coordinator_id || "";
  if (oldCoordinatorId && oldCoordinatorId !== newCoordinatorId) {
    await updateDoc(doc(db, "users", oldCoordinatorId), {
      role: "anggota",
      updated_at: serverTimestamp(),
    });
  }

  if (newCoordinatorId) {
    await updateDoc(doc(db, "users", newCoordinatorId), {
      role: "koordinator_divisi",
      division_id: id,
      updated_at: serverTimestamp(),
    });
  }
}

/**
 * Aktif/nonaktifkan divisi.
 */
export async function toggleDivisionActive(
  id: string,
  isActive: boolean,
  workspaceFilter?: { org_id?: string; campus_id?: string }
) {
  const divRef = doc(db, "divisions", id);
  const divSnap = await getDoc(divRef);

  if (divSnap.exists()) {
    const dData = divSnap.data() as Record<string, unknown>;
    const existingOrg = dData.organization_id || dData.org_id || dData.orgId;
    const existingCampus = dData.campus_id || dData.univ_id || dData.univId || dData.campusId;
    if (workspaceFilter?.org_id && existingOrg && workspaceFilter.org_id !== existingOrg) {
      throw new Error("Akses ditolak: Tidak dapat memodifikasi status divisi milik organisasi/ormawa lain.");
    }
    if (workspaceFilter?.campus_id && existingCampus && workspaceFilter.campus_id !== existingCampus) {
      throw new Error("Akses ditolak: Tidak dapat memodifikasi status divisi milik kampus lain.");
    }
  }

  await updateDoc(divRef, {
    is_active: isActive,
    updated_at: serverTimestamp(),
  });
}

/**
 * Ambil divisi dari Firestore, mendukung filter organisasi dan kampus ruang kerja.
 */
export async function getDivisions(
  organizationId?: string,
  campusId?: string
): Promise<Division[]> {
  const snap = await getDocs(collection(db, "divisions"));
  let divisions = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Division);

  if (organizationId) {
    divisions = divisions.filter((d) => {
      const divOrg =
        d.organization_id ||
        d.org_id ||
        (d as unknown as Record<string, unknown>).orgId ||
        "main_org";
      return divOrg === organizationId;
    });
  }

  if (campusId) {
    divisions = divisions.filter((d) => {
      const divCampus =
        d.campus_id ||
        (d as unknown as Record<string, unknown>).campusId ||
        d.univ_id ||
        (d as unknown as Record<string, unknown>).univId ||
        "ui";
      return divCampus === campusId;
    });
  }

  return divisions;
}

/**
 * Ambil satu divisi berdasarkan ID.
 */
export async function getDivisionById(
  divisionId: string,
  workspaceFilter?: { org_id?: string; campus_id?: string }
): Promise<Division | null> {
  const snap = await getDoc(doc(db, "divisions", divisionId));
  if (!snap.exists()) return null;
  const division = { id: snap.id, ...snap.data() } as Division;

  if (workspaceFilter?.org_id) {
    const divOrg =
      division.organization_id ||
      division.org_id ||
      (division as unknown as Record<string, unknown>).orgId ||
      "main_org";
    if (divOrg !== workspaceFilter.org_id) {
      return null;
    }
  }

  if (workspaceFilter?.campus_id) {
    const divCampus =
      division.campus_id ||
      (division as unknown as Record<string, unknown>).campusId ||
      division.univ_id ||
      (division as unknown as Record<string, unknown>).univId ||
      "ui";
    if (divCampus !== workspaceFilter.campus_id) {
      return null;
    }
  }

  return division;
}

/**
 * Update Design Kit divisi.
 * - super_admin bisa update semua divisi.
 * - koordinator_divisi hanya bisa update divisinya sendiri (divalidasi di rules + sisi klien).
 */
export async function updateDivisionDesignKit(
  divisionId: string,
  kit: {
    color_palette?: string[];
    visual_direction?: string;
    supergraphic_notes?: string;
    design_reference_links?: ReferenceLink[];
    drive_reference_links?: ReferenceLink[];
    archive_drive_links?: ReferenceLink[];
    notes_for_members?: string;
  },
  workspaceFilter?: { org_id?: string; campus_id?: string }
) {
  if (workspaceFilter?.org_id || workspaceFilter?.campus_id) {
    const snap = await getDoc(doc(db, "divisions", divisionId));
    if (snap.exists()) {
      const dData = snap.data() as Record<string, unknown>;
      const existingOrg = dData.organization_id || dData.org_id || dData.orgId;
      const existingCampus = dData.campus_id || dData.univ_id || dData.univId || dData.campusId;
      if (workspaceFilter.org_id && existingOrg && workspaceFilter.org_id !== existingOrg) {
        throw new Error("Akses ditolak: Tidak dapat memodifikasi Design Kit divisi milik organisasi/ormawa lain.");
      }
      if (workspaceFilter.campus_id && existingCampus && workspaceFilter.campus_id !== existingCampus) {
        throw new Error("Akses ditolak: Tidak dapat memodifikasi Design Kit divisi milik kampus lain.");
      }
    }
  }

  await updateDoc(doc(db, "divisions", divisionId), {
    design_kit_color_palette: kit.color_palette ?? [],
    design_kit_visual_direction: kit.visual_direction ?? "",
    design_kit_supergraphic_notes: kit.supergraphic_notes ?? "",
    design_kit_design_reference_links: kit.design_reference_links ?? [],
    design_kit_drive_reference_links: kit.drive_reference_links ?? [],
    design_kit_archive_drive_links: kit.archive_drive_links ?? [],
    design_kit_notes_for_members: kit.notes_for_members ?? "",
    updated_at: serverTimestamp(),
  });
}

/**
 * Cek apakah user boleh edit Design Kit divisi.
 * - super_admin: bisa semua.
 * - koordinator_divisi: hanya divisinya sendiri.
 * - lainnya: tidak bisa.
 */
export function canEditDivisionDesignKit(
  profile: UserProfile | null,
  divisionId: string,
): boolean {
  if (!profile) return false;
  if (profile.role === "super_admin") return true;
  if (profile.role === "koordinator_divisi") {
    return profile.division_id === divisionId;
  }
  return false;
}
