export * from "./workspace";

export type DashboardNavItem = {
  label: string;
  href: string;
};

// =============================================
// Design Kit — Multi-link types
// =============================================

export type ReferenceLinkType =
  | "google_docs"
  | "google_sheets"
  | "google_drive"
  | "canva"
  | "figma"
  | "pinterest"
  | "website"
  | "youtube"
  | "other";

export type ReferenceLink = {
  id: string;
  label?: string;
  url: string;
  type: ReferenceLinkType;
};

export type UserRole =
  | "super_admin"
  | "koordinator_divisi"
  | "koordinator_acara"
  | "anggota";

export type UserProfile = {
  id: string;
  organization_id: string;
  org_id?: string;
  orgId?: string;
  univ_id?: string;
  univId?: string;
  campus_id?: string;
  campusId?: string;
  name: string;
  email: string;
  whatsapp_number: string;
  role: UserRole;
  division_id: string;
  avatar_url: string;
  is_active: boolean;
  created_at?: unknown;
  updated_at?: unknown;
  whatsapp_command_pin?: string;
  aliases?: string[];
  nickname?: string;
};

export type EventStatus =
  | "persiapan"
  | "berlangsung"
  | "selesai"
  | "dibatalkan";

export type Event = {
  id: string;
  organization_id: string;
  org_id?: string;
  orgId?: string;
  univ_id?: string;
  univId?: string;
  campus_id?: string;
  campusId?: string;
  name: string;
  description: string;
  event_date: unknown;
  coordinator_id: string;
  status: EventStatus;
  progress_percentage: number;
  created_by: string;
  created_at?: unknown;
  updated_at?: unknown;
  // Fase 19C/20C: Event-specific WhatsApp group routing
  whatsapp_group_id?: string;
  whatsapp_group_name?: string;
  whatsapp_group_verified?: boolean;
  whatsapp_group_linked_at?: unknown;
  whatsapp_group_linked_by?: string;
  whatsapp_group_updated_at?: unknown;
  whatsapp_group_updated_by?: string;
  whatsapp_group_source?: "manual" | "webhook_detected" | "admin_input";
  // Fase 26A: Event Design Kit
  design_kit_color_palette?: string[];
  design_kit_visual_direction?: string;
  design_kit_supergraphic_notes?: string;
  design_kit_redaction_links?: ReferenceLink[];
  design_kit_design_reference_links?: ReferenceLink[];
  design_kit_drive_reference_links?: ReferenceLink[];
  design_kit_previous_event_refs?: string[];
  design_kit_notes_for_team?: string;
  // Fase 26B: Multi-division event host
  division_id?: string;
};

export type EventMember = {
  id: string;
  event_id: string;
  user_id: string;
  organization_id?: string;
  org_id?: string;
  orgId?: string;
  campus_id?: string;
  campusId?: string;
  univ_id?: string;
  univId?: string;
  role_in_event: string;
  added_by: string;
  added_at?: unknown;
};

export type EventInput = {
  organization_id?: string;
  org_id?: string;
  orgId?: string;
  campus_id?: string;
  campusId?: string;
  univ_id?: string;
  univId?: string;
  name: string;
  description: string;
  event_date: string;
  coordinator_id: string;
  status: EventStatus;
  // Fase 19C: Event-specific WhatsApp group
  whatsapp_group_id?: string;
  whatsapp_group_name?: string;
  secretary_id?: string;
  initial_member_ids?: string[];
  // Fase 26A: Event Design Kit
  design_kit_color_palette?: string[];
  design_kit_visual_direction?: string;
  design_kit_supergraphic_notes?: string;
  design_kit_redaction_links?: ReferenceLink[];
  design_kit_design_reference_links?: ReferenceLink[];
  design_kit_drive_reference_links?: ReferenceLink[];
  design_kit_previous_event_refs?: string[];
  design_kit_notes_for_team?: string;
  // Fase 26B: Multi-division event host
  division_id?: string;
};

export type TaskType = "divisi" | "acara";

export type TaskStatus =
  | "belum_dimulai"
  | "sedang_dikerjakan"
  | "butuh_bantuan"
  | "stuck"
  | "menunggu_materi"
  | "draft_selesai"
  | "perlu_revisi"
  | "revisi_dikerjakan"
  | "menunggu_approval"
  | "approved"
  | "ditunda";

export type TaskPriority = "rendah" | "sedang" | "tinggi" | "kritis";

export type ApprovalStatus = "pending" | "approved" | "need_revision";

export type Task = {
  id: string;
  organization_id: string;
  org_id?: string;
  orgId?: string;
  univ_id?: string;
  univId?: string;
  campus_id?: string;
  campusId?: string;
  type: TaskType;
  division_id?: string;
  event_id?: string;
  name: string;
  description: string;
  pic_id: string;
  coordinator_id: string;
  deadline: unknown;
  status: TaskStatus;
  priority: TaskPriority;
  copywriting: string;
  // Legacy single-URL fields (dipertahankan untuk backward compat)
  copywriting_docs_url: string;
  design_reference_url: string;
  drive_reference_url: string;
  color_palette: string[];
  visual_direction: string;
  revision_notes: string;
  stuck_notes: string;
  result_design_url: string;
  approval_status: ApprovalStatus;
  approved_by?: string;
  approved_by_name?: string;
  approved_by_role?: string;
  approved_at?: unknown;
  is_archived: boolean;
  checklist_items?: Array<{
    id: string;
    label: string;
    is_done: boolean;
    done_at?: unknown;
    done_by?: string;
    done_by_name?: string;
  }>;
  created_by: string;
  created_at?: unknown;
  updated_at?: unknown;
  category_key?: string;
  category_label?: string;
  subcategory_key?: string;
  subcategory_label?: string;
  output_types?: string[];
  archive_enabled?: boolean;
  reference_candidate_enabled?: boolean;
  requires_file?: boolean;
  requires_source_link?: boolean;
  source_link?: string;
  archive_notes?: string;
  data_sensitivity?: "normal" | "internal" | "sensitive";
  // Fase 26A: Multi-link fields (additive)
  redaction_links?: ReferenceLink[];
  design_ref_links?: ReferenceLink[];
  drive_ref_links?: ReferenceLink[];
  design_kit_source?: "event" | "division" | "manual" | null;
};

export type TaskStatusLog = {
  id: string;
  task_id: string;
  organization_id?: string;
  org_id?: string;
  orgId?: string;
  campus_id?: string;
  campusId?: string;
  univ_id?: string;
  univId?: string;
  from_status: TaskStatus;
  to_status: TaskStatus;
  changed_by: string;
  changed_by_name?: string;
  changed_by_role?: string;
  source?: "whatsapp_command" | "web" | "system";
  note: string;
  created_at?: unknown;
};

export type TaskUpload = {
  id: string;
  task_id: string;
  organization_id?: string;
  org_id?: string;
  orgId?: string;
  campus_id?: string;
  campusId?: string;
  univ_id?: string;
  univId?: string;
  upload_url: string;
  thumbnail_url: string;
  public_id: string;
  file_name: string;
  file_size: number;
  file_type: string;
  version_number: number;
  uploaded_by: string;
  uploaded_at?: unknown;
  source_link?: string;
  source_link_type?: "canva" | "figma" | "google_docs" | "google_sheets" | "google_drive" | "other";
  upload_note?: string;
  output_type?: string;
  is_final_candidate?: boolean;
};

export type DesignType =
  | "poster"
  | "name_tag"
  | "twibbon"
  | "feed_ig"
  | "story_ig"
  | "banner"
  | "sertifikat"
  | "dokumentasi"
  | "animasi"
  | "merchandise"
  | "lainnya";

export type DesignReference = {
  id: string;
  organization_id: string;
  org_id?: string;
  orgId?: string;
  campus_id?: string;
  campusId?: string;
  univ_id?: string;
  univId?: string;
  title: string;
  event_name: string;
  design_type: DesignType;
  year: number;
  drive_url: string;
  thumbnail_url: string;
  style_notes: string;
  color_palette: string[];
  notes: string;
  is_archived: boolean;
  created_by: string;
  created_at?: unknown;
  updated_at?: unknown;

  // New expanded fields
  scope?: "divisi" | "acara";
  category?: "divisi" | "acara" | "canva" | "drive" | "video" | "dokumen" | "lainnya";
  event_id?: string;
  division_id?: string; // Fase 26B
  drive_links?: string[];
  canva_links?: string[];
  doc_links?: string[];
  other_links?: string[];
  summary_notes?: string;
  file_inventory_notes?: string;
  file_inventory?: Array<{
    name: string;
    url: string;
    type: "file" | "folder";
    mime_type?: string;
    level?: number;
    parent_folder?: string;
  }>;
};

export type ReferenceListItem = {
  id: string;
  source_type: "manual_reference" | "approved_task";
  organization_id?: string;
  org_id?: string;
  orgId?: string;
  campus_id?: string;
  campusId?: string;
  univ_id?: string;
  univId?: string;
  title: string;
  event_name?: string;
  year?: string | number;
  scope?: string;
  visual_type?: string;
  category_label?: string;
  subcategory_label?: string;
  thumbnail_url?: string;
  file_url?: string;
  source_link?: string;
  source_link_type?: string;
  notes?: string;
  status?: "active" | "archived";
  created_at?: unknown;
  updated_at?: unknown;
  task_id?: string;
  event_id?: string;
  division_id?: string;
  color_palette?: string[];
  file_inventory?: Array<{
    name: string;
    url: string;
    type: "file" | "folder";
    mime_type?: string;
  }>;
  file_inventory_notes?: string;
  created_by: string;
};

export type DesignReferenceInput = {
  organization_id?: string;
  org_id?: string;
  orgId?: string;
  campus_id?: string;
  campusId?: string;
  univ_id?: string;
  univId?: string;
  title: string;
  event_name: string;
  design_type: DesignType;
  year: number;
  drive_url: string;
  thumbnail_url: string;
  style_notes: string;
  color_palette: string[];
  notes: string;

  // New expanded fields
  scope?: "divisi" | "acara";
  category?: "divisi" | "acara" | "canva" | "drive" | "video" | "dokumen" | "lainnya";
  event_id?: string;
  division_id?: string; // Fase 26B
  drive_links?: string[];
  canva_links?: string[];
  doc_links?: string[];
  other_links?: string[];
  summary_notes?: string;
  file_inventory_notes?: string;
  file_inventory?: Array<{
    name: string;
    url: string;
    type: "file" | "folder";
    mime_type?: string;
    level?: number;
    parent_folder?: string;
  }>;
};

export type WhatsAppLogStatus = "sent" | "failed" | "pending" | "skipped";

export type WhatsAppLog = {
  id: string;
  organization_id: string;
  org_id?: string;
  orgId?: string;
  campus_id?: string;
  campusId?: string;
  univ_id?: string;
  univId?: string;
  task_id?: string;
  event_type: string;
  message_content: string;
  recipient: string;
  recipient_type?: "group" | "personal";
  is_group?: boolean;
  status: WhatsAppLogStatus;
  wablas_response?: string;
  error_message?: string;
  retry_count: number;
  created_at?: unknown;
  provider?: string;
  target_type?: "group" | "phone";
};

export type AILog = {
  id: string;
  organization_id: string;
  org_id?: string;
  orgId?: string;
  campus_id?: string;
  campusId?: string;
  univ_id?: string;
  univId?: string;
  asked_by: string;
  question: string;
  context_summary: string;
  answer: string;
  model_used: string;
  source?: "web" | "whatsapp";
  whatsapp_sender?: string;
  whatsapp_group_id?: string;
  created_at?: unknown;
};

export type TaskInput = {
  organization_id?: string;
  org_id?: string;
  orgId?: string;
  campus_id?: string;
  campusId?: string;
  univ_id?: string;
  univId?: string;
  type: TaskType;
  event_id: string;
  division_id?: string;
  name: string;
  description: string;
  pic_id: string;
  coordinator_id: string;
  deadline: string;
  status: TaskStatus;
  priority: TaskPriority;
  copywriting: string;
  // Legacy single-URL fields
  copywriting_docs_url: string;
  design_reference_url: string;
  drive_reference_url: string;
  color_palette: string[];
  visual_direction: string;
  category_key?: string;
  category_label?: string;
  subcategory_key?: string;
  subcategory_label?: string;
  output_types?: string[];
  archive_enabled?: boolean;
  reference_candidate_enabled?: boolean;
  requires_file?: boolean;
  requires_source_link?: boolean;
  source_link?: string;
  archive_notes?: string;
  data_sensitivity?: "normal" | "internal" | "sensitive";
  // Fase 26A: Multi-link fields (additive)
  redaction_links?: ReferenceLink[];
  design_ref_links?: ReferenceLink[];
  drive_ref_links?: ReferenceLink[];
  design_kit_source?: "event" | "division" | "manual" | null;
};

export type Organization = {
  id: string;
  name: string;
  slug: string;
  campus_id?: string;
  campusId?: string;
  univ_id?: string;
  univId?: string;
  org_id?: string;
  orgId?: string;
  short_name?: string;
  type?: string;
  whatsapp_group_id: string;
  logo_url: string;
  created_at?: unknown;
  updated_at?: unknown;
};

export type Division = {
  id: string;
  organization_id: string;
  org_id?: string;
  orgId?: string;
  univ_id?: string;
  univId?: string;
  campus_id?: string;
  campusId?: string;
  name: string;
  description: string;
  slug: string; // Fase 26B
  is_active: boolean; // Fase 26B
  is_core?: boolean; // Menandai divisi pokok standar ormawa
  coordinator_id: string;
  created_at?: unknown;
  updated_at?: unknown;
  // Fase 26A: Division Design Kit
  design_kit_color_palette?: string[];
  design_kit_visual_direction?: string;
  design_kit_supergraphic_notes?: string;
  design_kit_design_reference_links?: ReferenceLink[];
  design_kit_drive_reference_links?: ReferenceLink[];
  design_kit_archive_drive_links?: ReferenceLink[];
  design_kit_notes_for_members?: string;
};

export type NewUserProfileInput = Pick<
  UserProfile,
  "id" | "name" | "email" | "whatsapp_number"
> & {
  organization_id?: string;
  org_id?: string;
  orgId?: string;
  campus_id?: string;
  campusId?: string;
  univ_id?: string;
  univId?: string;
  division_id?: string;
};


export type RegisterInput = {
  name: string;
  email: string;
  password: string;
  whatsapp_number: string;
};

export type MemberUpdateInput = {
  name: string;
  whatsapp_number: string;
  role?: UserRole;
  division_id: string;
  is_active: boolean;
  whatsapp_command_pin?: string;
};

export type AuthContextValue = {
  user: import("firebase/auth").User | null;
  userProfile: UserProfile | null;
  profile: UserProfile | null;
  loading: boolean;
  profileLoading: boolean;
  isAuthenticated: boolean;
  reloadUserProfile: () => Promise<UserProfile | null>;
};

export type TaskCandidate = {
  id: string;
  code: string;
  task_id: string;
  task_title: string;
  command_type: "approve" | "update_status" | "edit" | "archive" | "checklist";
  created_at: unknown;
  expires_at: unknown;
  status: "pending" | "used" | "expired";
  requested_by_user_id?: string;
  payload?: Record<string, unknown> | null;
};

export type TaskEditPreview = {
  id: string;
  code: string;
  task_id: string;
  task_title: string;
  action_type: "edit_task" | "archive_task";
  changes: Record<string, unknown>;
  old_values: Record<string, unknown>;
  requested_by: string;
  requested_by_name: string;
  created_at: unknown;
  expires_at: unknown;
  status: "pending" | "confirmed" | "cancelled" | "expired";
  raw_message_sanitized: string;
};

export type NormalizedIncomingWhatsAppMessage = {
  provider: "fonnte" | "wablas";
  message: string;
  sender: string;
  senderName?: string;
  groupId?: string;
  isGroup: boolean;
  rawMessageId?: string;
  timestamp?: string | number;
};

export interface WhatsAppSystemSettings {
  isTestMode: boolean;
  sandbox_mode?: boolean;
  testGroupId: string;
  sandbox_group_id?: string;
  updatedAt?: unknown;
  updatedBy?: string;
  updatedByName?: string;
}


