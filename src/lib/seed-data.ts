import type { Division, Organization } from "@/types";

export const DEFAULT_ORGANIZATION_ID = "main_org";
export const DEFAULT_ORMAWA_ID = "main_org";
export const DEFAULT_DIVISION_ID = "humas_media_kreatif";

export const defaultOrganization: Omit<
  Organization,
  "created_at" | "updated_at"
> = {
  id: DEFAULT_ORGANIZATION_ID,
  name: "JobDex.in Organization",
  slug: "jobdex-main",
  whatsapp_group_id: "",
  logo_url: "",
};

export const defaultDivision: Omit<Division, "created_at" | "updated_at"> = {
  id: DEFAULT_DIVISION_ID,
  organization_id: DEFAULT_ORGANIZATION_ID,
  name: "Humas dan Media Kreatif",
  description: "Divisi publikasi, dokumentasi, desain, dan media kreatif.",
  slug: "humas_media_kreatif",
  is_active: true,
  coordinator_id: "",
};
