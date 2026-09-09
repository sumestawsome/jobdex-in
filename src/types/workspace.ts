export type OrmawaType = "BEM" | "DPM" | "HMJ" | "UKM" | "LAINNYA";

export interface Campus {
  id: string;
  name: string;
  code: string;
  slug?: string;
  city: string;
  province?: string;
  address?: string;
  website?: string;
  logo_url?: string;
  ormawa_count?: number;
  is_active?: boolean;
  created_at?: unknown;
  updated_at?: unknown;
  univ_id?: string;
  univId?: string;
}

export interface CampusInput {
  name: string;
  code: string;
  slug?: string;
  city: string;
  province?: string;
  address?: string;
  website?: string;
  logo_url?: string;
  is_active?: boolean;
  univ_id?: string;
  univId?: string;
}

export interface Ormawa {
  id: string;
  campus_id: string;
  campusId?: string;
  univ_id?: string; // Standardized multi-tenant identifier (alias of campus_id)
  univId?: string;
  org_id?: string;
  orgId?: string;
  name: string;
  short_name: string;
  slug?: string;
  type: OrmawaType;
  faculty?: string;
  description: string;
  member_count: number;
  active_event_count: number;
  active_task_count: number;
  logo_url?: string;
  is_active: boolean;
  contact_email?: string;
  contact_whatsapp?: string;
  whatsapp_group_id?: string;
  created_at?: unknown;
  updated_at?: unknown;
}

export interface OrmawaInput {
  campus_id: string;
  campusId?: string;
  univ_id?: string;
  univId?: string;
  org_id?: string;
  orgId?: string;
  name: string;
  short_name: string;
  slug?: string;
  type: OrmawaType;
  faculty?: string;
  description?: string;
  logo_url?: string;
  is_active?: boolean;
  contact_email?: string;
  contact_whatsapp?: string;
  whatsapp_group_id?: string;
}

export interface ActiveWorkspace {
  campus_id: string;
  campus_name: string;
  campus_code: string;
  org_id: string;
  org_name: string;
  org_type: OrmawaType;
  campusId?: string;
  univ_id?: string;
  univId?: string;
  orgId?: string;
}

export interface WorkspaceHierarchy {
  campus: Campus;
  ormawa: Ormawa;
  divisions?: Array<{
    id: string;
    name: string;
    slug: string;
    is_core?: boolean;
  }>;
}

export interface UserOrmawaMembership {
  id: string;
  user_id: string;
  campus_id: string;
  campusId?: string;
  univ_id?: string;
  univId?: string;
  ormawa_id: string;
  org_id?: string;
  orgId?: string;
  role: string;
  division_id?: string;
  is_active: boolean;
  joined_at?: unknown;
  updated_at?: unknown;
}

export interface DivisionInput {
  name: string;
  description?: string;
  slug?: string;
  org_id: string;
  organization_id?: string;
  campus_id?: string;
  univ_id?: string;
  is_core?: boolean;
  is_active?: boolean;
  coordinator_id?: string;
}

export interface CoreDivision {
  id: string;
  name: string;
  description: string;
  slug: string;
  org_id: string;
  organization_id?: string;
  campus_id?: string;
  univ_id?: string;
  is_core: boolean;
  is_active: boolean;
  coordinator_id?: string;
  created_at?: unknown;
  updated_at?: unknown;
}


