import type { Campus, CampusInput, Ormawa, OrmawaInput, OrmawaType, DivisionInput, CoreDivision } from "@/types/workspace";
import type { Division } from "@/types";

export const ORMAWA_TYPES: readonly OrmawaType[] = [
  "BEM",
  "DPM",
  "HMJ",
  "UKM",
  "LAINNYA",
] as const;

export function isOrmawaType(val: unknown): val is OrmawaType {
  return typeof val === "string" && ORMAWA_TYPES.includes(val as OrmawaType);
}

export function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export interface ValidationResult<T> {
  valid: boolean;
  errors: string[];
  data?: T;
}

/**
 * Validasi skema input untuk data Kampus / Universitas.
 */
export function validateCampusInput(input: unknown): ValidationResult<CampusInput> {
  const errors: string[] = [];

  if (!input || typeof input !== "object") {
    return { valid: false, errors: ["Data kampus harus berupa object."] };
  }

  const raw = input as Record<string, unknown>;

  const name = typeof raw.name === "string" ? raw.name.trim() : "";
  const code = typeof raw.code === "string" ? raw.code.trim().toUpperCase() : "";
  const city = typeof raw.city === "string" ? raw.city.trim() : "";

  if (!name) {
    errors.push("Nama kampus wajib diisi.");
  } else if (name.length < 3 || name.length > 100) {
    errors.push("Nama kampus harus antara 3 hingga 100 karakter.");
  }

  if (!code) {
    errors.push("Kode/singkatan kampus wajib diisi (misal: UI, ITB, UNUD).");
  } else if (code.length < 2 || code.length > 20) {
    errors.push("Kode kampus harus antara 2 hingga 20 karakter.");
  }

  if (!city) {
    errors.push("Kota kampus wajib diisi.");
  } else if (city.length < 2 || city.length > 100) {
    errors.push("Kota kampus harus antara 2 hingga 100 karakter.");
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  const slug = typeof raw.slug === "string" && raw.slug.trim()
    ? generateSlug(raw.slug.trim())
    : generateSlug(name);

  const cleanData: CampusInput = {
    name,
    code,
    slug,
    city,
    province: typeof raw.province === "string" ? raw.province.trim() : undefined,
    address: typeof raw.address === "string" ? raw.address.trim() : undefined,
    website: typeof raw.website === "string" ? raw.website.trim() : undefined,
    logo_url: typeof raw.logo_url === "string" ? raw.logo_url.trim() : undefined,
    is_active: typeof raw.is_active === "boolean" ? raw.is_active : true,
  };

  return { valid: true, errors: [], data: cleanData };
}

/**
 * Validasi skema input untuk data Organisasi Mahasiswa (Ormawa).
 */
export function validateOrmawaInput(input: unknown): ValidationResult<OrmawaInput> {
  const errors: string[] = [];

  if (!input || typeof input !== "object") {
    return { valid: false, errors: ["Data ormawa harus berupa object."] };
  }

  const raw = input as Record<string, unknown>;

  const campusId =
    typeof raw.campus_id === "string" && raw.campus_id.trim()
      ? raw.campus_id.trim()
      : typeof raw.univ_id === "string" && raw.univ_id.trim()
      ? raw.univ_id.trim()
      : "";

  const name = typeof raw.name === "string" ? raw.name.trim() : "";
  const shortName = typeof raw.short_name === "string" ? raw.short_name.trim() : "";
  const type = raw.type;

  if (!campusId) {
    errors.push("ID Kampus (campus_id / univ_id) wajib diisi.");
  }

  if (!name) {
    errors.push("Nama ormawa wajib diisi.");
  } else if (name.length < 3 || name.length > 150) {
    errors.push("Nama ormawa harus antara 3 hingga 150 karakter.");
  }

  if (!shortName) {
    errors.push("Singkatan/nama pendek ormawa wajib diisi (misal: BEM FT, HIMASIF).");
  } else if (shortName.length < 2 || shortName.length > 50) {
    errors.push("Nama pendek ormawa harus antara 2 hingga 50 karakter.");
  }

  if (!isOrmawaType(type)) {
    errors.push(`Tipe ormawa tidak valid. Pilihan yang valid: ${ORMAWA_TYPES.join(", ")}.`);
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  const slug = typeof raw.slug === "string" && raw.slug.trim()
    ? generateSlug(raw.slug.trim())
    : generateSlug(shortName || name);

  const cleanData: OrmawaInput = {
    campus_id: campusId,
    univ_id: campusId,
    name,
    short_name: shortName,
    slug,
    type: type as OrmawaType,
    faculty: typeof raw.faculty === "string" ? raw.faculty.trim() : undefined,
    description: typeof raw.description === "string" ? raw.description.trim() : "",
    logo_url: typeof raw.logo_url === "string" ? raw.logo_url.trim() : undefined,
    is_active: typeof raw.is_active === "boolean" ? raw.is_active : true,
    contact_email: typeof raw.contact_email === "string" ? raw.contact_email.trim() : undefined,
    contact_whatsapp: typeof raw.contact_whatsapp === "string" ? raw.contact_whatsapp.trim() : undefined,
    whatsapp_group_id: typeof raw.whatsapp_group_id === "string" ? raw.whatsapp_group_id.trim() : undefined,
  };

  return { valid: true, errors: [], data: cleanData };
}

/**
 * Normalisasi dokumen Kampus sebelum disimpan ke database.
 */
export function buildCampusDoc(
  input: CampusInput,
  id: string
): Omit<Campus, "created_at" | "updated_at"> {
  return {
    id,
    name: input.name,
    code: input.code,
    slug: input.slug || generateSlug(input.name),
    city: input.city,
    province: input.province,
    address: input.address,
    website: input.website,
    logo_url: input.logo_url,
    ormawa_count: 0,
    is_active: input.is_active ?? true,
    univ_id: id,
    univId: id,
  };
}

/**
 * Normalisasi dokumen Ormawa sebelum disimpan ke database.
 */
export function buildOrmawaDoc(
  input: OrmawaInput,
  id: string
): Omit<Ormawa, "created_at" | "updated_at"> {
  const campusId = input.campus_id || input.univ_id || (input as any).campusId || (input as any).univId || "";
  return {
    id,
    campus_id: campusId,
    campusId: campusId,
    univ_id: campusId,
    univId: campusId,
    org_id: id,
    orgId: id,
    name: input.name,
    short_name: input.short_name,
    slug: input.slug || generateSlug(input.short_name || input.name),
    type: input.type,
    faculty: input.faculty,
    description: input.description || "",
    member_count: 0,
    active_event_count: 0,
    active_task_count: 0,
    logo_url: input.logo_url,
    is_active: input.is_active ?? true,
    contact_email: input.contact_email,
    contact_whatsapp: input.contact_whatsapp,
    whatsapp_group_id: input.whatsapp_group_id,
  };
}

export const DEFAULT_CORE_DIVISIONS: ReadonlyArray<{
  name: string;
  slug: string;
  description: string;
}> = [
  {
    name: "Humas & Media Kreatif",
    slug: "humas-media-kreatif",
    description: "Pengelolaan publikasi visual, media sosial, hubungan eksternal, dan dokumentasi kegiatan.",
  },
  {
    name: "Acara & Kepanitiaan",
    slug: "acara-kepanitiaan",
    description: "Penyusunan konsep kegiatan, susunan acara, rundown teknis lapangan, dan koordinasi pengisi acara.",
  },
  {
    name: "Logistik & Perlengkapan",
    slug: "logistik-perlengkapan",
    description: "Pengadaan sarana prasarana, perlengkapan teknis, konsumsi, dan pengelolaan tempat kegiatan.",
  },
  {
    name: "Kemitraan & Dana Usaha",
    slug: "kemitraan-dana-usaha",
    description: "Eksplorasi kemitraan sponsor, donatur, kerja sama media partner, dan inisiatif pendanaan mandiri.",
  },
  {
    name: "Administrasi & Kesekretariatan",
    slug: "administrasi-kesekretariatan",
    description: "Surat menyurat, notulensi rapat, arsip proposal, laporan pertanggungjawaban, dan perizinan birokrasi.",
  },
] as const;

/**
 * Validasi skema input untuk data Divisi Pokok.
 */
export function validateDivisionInput(input: unknown): ValidationResult<DivisionInput> {
  const errors: string[] = [];

  if (!input || typeof input !== "object") {
    return { valid: false, errors: ["Data divisi harus berupa object."] };
  }

  const raw = input as Record<string, unknown>;
  const name = typeof raw.name === "string" ? raw.name.trim() : "";
  const orgId =
    typeof raw.org_id === "string" && raw.org_id.trim()
      ? raw.org_id.trim()
      : typeof raw.organization_id === "string" && raw.organization_id.trim()
      ? raw.organization_id.trim()
      : typeof raw.orgId === "string" && raw.orgId.trim()
      ? raw.orgId.trim()
      : "";

  if (!orgId) {
    errors.push("ID Ormawa (org_id / organization_id) wajib diisi.");
  }

  if (!name) {
    errors.push("Nama divisi wajib diisi.");
  } else if (name.length < 2 || name.length > 100) {
    errors.push("Nama divisi harus antara 2 hingga 100 karakter.");
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  const slug =
    typeof raw.slug === "string" && raw.slug.trim()
      ? generateSlug(raw.slug.trim())
      : generateSlug(name);

  const cleanData: DivisionInput = {
    name,
    org_id: orgId,
    organization_id: orgId,
    campus_id:
      typeof raw.campus_id === "string" && raw.campus_id.trim()
        ? raw.campus_id.trim()
        : typeof raw.univ_id === "string" && raw.univ_id.trim()
        ? raw.univ_id.trim()
        : undefined,
    univ_id:
      typeof raw.univ_id === "string" && raw.univ_id.trim()
        ? raw.univ_id.trim()
        : typeof raw.campus_id === "string" && raw.campus_id.trim()
        ? raw.campus_id.trim()
        : undefined,
    description: typeof raw.description === "string" ? raw.description.trim() : "",
    slug,
    is_core: typeof raw.is_core === "boolean" ? raw.is_core : true,
    is_active: typeof raw.is_active === "boolean" ? raw.is_active : true,
    coordinator_id:
      typeof raw.coordinator_id === "string" ? raw.coordinator_id.trim() : undefined,
  };

  return { valid: true, errors: [], data: cleanData };
}

/**
 * Normalisasi dokumen Divisi sebelum disimpan ke database.
 */
export function buildDivisionDoc(
  input: DivisionInput,
  id: string,
): Omit<Division, "created_at" | "updated_at"> {
  const orgId = input.org_id || input.organization_id || "";
  const campusId = input.campus_id || input.univ_id || "";

  return {
    id,
    name: input.name,
    description: input.description || "",
    slug: input.slug || generateSlug(input.name),
    organization_id: orgId,
    org_id: orgId,
    orgId: orgId,
    campus_id: campusId,
    campusId: campusId,
    univ_id: campusId,
    univId: campusId,
    is_core: input.is_core ?? true,
    is_active: input.is_active ?? true,
    coordinator_id: input.coordinator_id || "",
    design_kit_color_palette: [],
    design_kit_visual_direction: "",
    design_kit_supergraphic_notes: "",
    design_kit_design_reference_links: [],
    design_kit_drive_reference_links: [],
    design_kit_archive_drive_links: [],
    design_kit_notes_for_members: "",
  };
}

/**
 * Helper keunikan nama dan kode kampus.
 */
export function isUniqueCampusName(
  name: string,
  existing: Campus[],
  ignoreId?: string,
): boolean {
  const norm = name.trim().toLowerCase();
  return !existing.some(
    (c) => c.id !== ignoreId && c.name.trim().toLowerCase() === norm,
  );
}

export function isUniqueCampusCode(
  code: string,
  existing: Campus[],
  ignoreId?: string,
): boolean {
  const norm = code.trim().toUpperCase();
  return !existing.some(
    (c) => c.id !== ignoreId && c.code.trim().toUpperCase() === norm,
  );
}

/**
 * Helper keunikan ormawa dalam satu kampus (tidak boleh duplikat nama atau short_name pada kampus yang sama).
 */
export function isUniqueOrmawaInCampus(
  nameOrShortName: string,
  campusId: string,
  existing: Ormawa[],
  ignoreId?: string,
): boolean {
  const norm = nameOrShortName.trim().toLowerCase();
  return !existing.some((o) => {
    if (o.id === ignoreId) return false;
    const sameCampus = o.campus_id === campusId || o.univ_id === campusId;
    if (!sameCampus) return false;
    return (
      o.name.trim().toLowerCase() === norm ||
      o.short_name.trim().toLowerCase() === norm
    );
  });
}

/**
 * Helper keunikan nama divisi dalam satu ormawa.
 */
export function isUniqueDivisionInOrmawa(
  name: string,
  orgId: string,
  existing: Array<{ id?: string; name: string; org_id?: string; organization_id?: string }>,
  ignoreId?: string,
): boolean {
  const norm = name.trim().toLowerCase();
  return !existing.some((d) => {
    if (d.id && d.id === ignoreId) return false;
    const sameOrg = d.org_id === orgId || d.organization_id === orgId;
    if (!sameOrg) return false;
    return d.name.trim().toLowerCase() === norm;
  });
}

