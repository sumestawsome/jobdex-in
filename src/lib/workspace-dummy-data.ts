import type { Campus, Ormawa, ActiveWorkspace } from "@/types/workspace";

export const DUMMY_CAMPUSES: Campus[] = [
  {
    id: "univ-undiksha",
    name: "Universitas Pendidikan Ganesha",
    code: "UNDIKSHA",
    city: "Singaraja, Bali",
    ormawa_count: 4,
  },
];

export const DUMMY_ORMAWAS: Ormawa[] = [
  {
    id: "org-undiksha-forkom-kip",
    campus_id: "univ-undiksha",
    name: "Forum Komunikasi KIP-Kuliah Undiksha",
    short_name: "Forkom KIP Undiksha",
    type: "UKM",
    description: "Organisasi kemahasiswaan penerima KIP-Kuliah di lingkungan Universitas Pendidikan Ganesha.",
    member_count: 120,
    active_event_count: 4,
    active_task_count: 26,
    is_active: true,
  },
  {
    id: "org-undiksha-bem",
    campus_id: "univ-undiksha",
    name: "BEM REMA Undiksha",
    short_name: "BEM Undiksha",
    type: "BEM",
    description: "Badan Eksekutif Mahasiswa Republik Mahasiswa Undiksha koordinator kegiatan mahasiswa dan publikasi kampus.",
    member_count: 145,
    active_event_count: 5,
    active_task_count: 32,
    is_active: true,
  },
  {
    id: "org-undiksha-hmj-ti",
    campus_id: "univ-undiksha",
    name: "HMJ Teknik Informatika Undiksha",
    short_name: "HMJ TI Undiksha",
    type: "HMJ",
    description: "Himpunan Mahasiswa Jurusan Teknik Informatika Fakultas Teknik dan Kejuruan Undiksha.",
    member_count: 95,
    active_event_count: 4,
    active_task_count: 24,
    is_active: true,
  },
  {
    id: "org-undiksha-dpm",
    campus_id: "univ-undiksha",
    name: "Dewan Perwakilan Mahasiswa Undiksha",
    short_name: "DPM Undiksha",
    type: "DPM",
    description: "Lembaga legislatif mahasiswa di lingkungan Universitas Pendidikan Ganesha.",
    member_count: 45,
    active_event_count: 2,
    active_task_count: 10,
    is_active: true,
  },
];

export const DEFAULT_ACTIVE_WORKSPACE: ActiveWorkspace = {
  campus_id: "univ-undiksha",
  campusId: "univ-undiksha",
  univ_id: "univ-undiksha",
  univId: "univ-undiksha",
  campus_name: "Universitas Pendidikan Ganesha",
  campus_code: "UNDIKSHA",
  org_id: "org-undiksha-forkom-kip",
  orgId: "org-undiksha-forkom-kip",
  org_name: "Forkom KIP-Kuliah Undiksha",
  org_type: "UKM",
};

export interface DummyWorkspaceTask {
  id: string;
  campus_id: string;
  univ_id?: string;
  org_id: string;
  organization_id?: string;
  name: string;
  type: "acara" | "divisi";
  status: "todo" | "in_progress" | "review" | "done";
  priority: "low" | "medium" | "high";
  pic_name: string;
  division_name: string;
  deadline: string;
}

export interface DummyWorkspaceEvent {
  id: string;
  campus_id: string;
  univ_id?: string;
  org_id: string;
  organization_id?: string;
  name: string;
  description: string;
  status: "persiapan" | "berlangsung" | "selesai";
  event_date: string;
  progress_percentage: number;
}

export const DUMMY_WORKSPACE_TASKS: DummyWorkspaceTask[] = [
  // Forkom KIP-Kuliah Undiksha Tasks
  {
    id: "dummy-task-forkom-1",
    campus_id: "univ-undiksha",
    univ_id: "univ-undiksha",
    org_id: "org-undiksha-forkom-kip",
    organization_id: "org-undiksha-forkom-kip",
    name: "Desain Feed Instagram Pembukaan PDK 2026",
    type: "acara",
    status: "in_progress",
    priority: "high",
    pic_name: "Putu Agus",
    division_name: "Humas & Media Kreatif",
    deadline: "2026-06-10",
  },
  {
    id: "dummy-task-forkom-2",
    campus_id: "univ-undiksha",
    univ_id: "univ-undiksha",
    org_id: "org-undiksha-forkom-kip",
    organization_id: "org-undiksha-forkom-kip",
    name: "Dokumentasi & Live Report Kegiatan PDK 2026",
    type: "acara",
    status: "todo",
    priority: "medium",
    pic_name: "Kadek Widi",
    division_name: "Humas & Media Kreatif",
    deadline: "2026-06-12",
  },
  {
    id: "dummy-task-forkom-3",
    campus_id: "univ-undiksha",
    univ_id: "univ-undiksha",
    org_id: "org-undiksha-forkom-kip",
    organization_id: "org-undiksha-forkom-kip",
    name: "Publikasi Press Release Kegiatan Bakti Sosial KIP-K",
    type: "divisi",
    status: "review",
    priority: "high",
    pic_name: "Komang Ayu",
    division_name: "Humas & Media Kreatif",
    deadline: "2026-09-12",
  },
  {
    id: "dummy-task-forkom-4",
    campus_id: "univ-undiksha",
    univ_id: "univ-undiksha",
    org_id: "org-undiksha-forkom-kip",
    organization_id: "org-undiksha-forkom-kip",
    name: "Penyusunan Jadwal Konten Media Sosial Forkom KIP Undiksha",
    type: "divisi",
    status: "done",
    priority: "medium",
    pic_name: "Ketut Artana",
    division_name: "Humas & Media Kreatif",
    deadline: "2026-09-08",
  },
  // BEM REMA Undiksha Tasks
  {
    id: "dummy-task-undiksha-1",
    campus_id: "univ-undiksha",
    univ_id: "univ-undiksha",
    org_id: "org-undiksha-bem",
    organization_id: "org-undiksha-bem",
    name: "Desain Konten Feed Instagram Dies Natalis Undiksha",
    type: "acara",
    status: "in_progress",
    priority: "high",
    pic_name: "Putu Agus",
    division_name: "Humas & Media Kreatif",
    deadline: "2026-09-15",
  },
  {
    id: "dummy-task-undiksha-2",
    campus_id: "univ-undiksha",
    univ_id: "univ-undiksha",
    org_id: "org-undiksha-bem",
    organization_id: "org-undiksha-bem",
    name: "Dokumentasi & Live Report Seminar Nasional Undiksha",
    type: "acara",
    status: "todo",
    priority: "medium",
    pic_name: "Kadek Widi",
    division_name: "Humas & Media Kreatif",
    deadline: "2026-09-18",
  },
];

export const DUMMY_WORKSPACE_EVENTS: DummyWorkspaceEvent[] = [
  // Forkom KIP Undiksha Events
  {
    id: "twjhgyZkUWYFqkApU6lR",
    campus_id: "univ-undiksha",
    univ_id: "univ-undiksha",
    org_id: "org-undiksha-forkom-kip",
    organization_id: "org-undiksha-forkom-kip",
    name: "PDK 2026",
    description: "Pelatihan Dasar Kepemimpinan (PDK) Forum Komunikasi KIP-Kuliah Undiksha.",
    status: "persiapan",
    event_date: "2026-06-12",
    progress_percentage: 0,
  },
  {
    id: "dummy-event-forkom-2",
    campus_id: "univ-undiksha",
    univ_id: "univ-undiksha",
    org_id: "org-undiksha-forkom-kip",
    organization_id: "org-undiksha-forkom-kip",
    name: "Bakti Sosial & Temu Keakraban KIP-K Undiksha",
    description: "Program bakti sosial dan silaturahmi mahasiswa penerima KIP-Kuliah se-Undiksha.",
    status: "berlangsung",
    event_date: "2026-09-25",
    progress_percentage: 60,
  },
  // BEM REMA Undiksha Events
  {
    id: "dummy-event-undiksha-1",
    campus_id: "univ-undiksha",
    univ_id: "univ-undiksha",
    org_id: "org-undiksha-bem",
    organization_id: "org-undiksha-bem",
    name: "Dies Natalis & Ganesha Festival Undiksha",
    description: "Perayaan Dies Natalis Universitas Pendidikan Ganesha dengan panggung seni dan lomba nasional.",
    status: "berlangsung",
    event_date: "2026-09-25",
    progress_percentage: 70,
  },
  {
    id: "dummy-event-undiksha-2",
    campus_id: "univ-undiksha",
    univ_id: "univ-undiksha",
    org_id: "org-undiksha-bem",
    organization_id: "org-undiksha-bem",
    name: "Undiksha Mengabdi & Bakti Sosial",
    description: "Program pengabdian sosial kemahasiswaan terpadu di desa binaan Kabupaten Buleleng.",
    status: "persiapan",
    event_date: "2026-10-15",
    progress_percentage: 40,
  },
];

/**
 * Filter list of dummy items by active workspace campus and organization
 */
export function filterDummyDataByWorkspace<T extends { campus_id?: string; campusId?: string; univ_id?: string; univId?: string; org_id?: string; orgId?: string; organization_id?: string }>(
  items: T[],
  activeWorkspace: ActiveWorkspace
): T[] {
  return items.filter((item) => {
    const itemCampus = item.campus_id || item.campusId || item.univ_id || item.univId;
    const itemOrg = item.org_id || item.orgId || item.organization_id;

    const targetCampus = activeWorkspace.campus_id || activeWorkspace.campusId || activeWorkspace.univ_id || activeWorkspace.univId;
    const targetOrg = activeWorkspace.org_id || activeWorkspace.orgId;

    const matchesCampus = !itemCampus || itemCampus === targetCampus || itemCampus === "univ-undiksha" || itemCampus === "ui";
    const matchesOrg = !itemOrg || itemOrg === targetOrg ||
      ((itemOrg === "main_org" || itemOrg === "org-undiksha-forkom-kip" || itemOrg === "org-undiksha-bem") &&
       (targetOrg === "org-undiksha-forkom-kip" || targetOrg === "org-undiksha-bem" || targetOrg === "main_org"));

    return matchesCampus && matchesOrg;
  });
}

/**
 * Get dummy tasks for a specific active workspace
 */
export function getDummyTasksForWorkspace(activeWorkspace: ActiveWorkspace): DummyWorkspaceTask[] {
  return filterDummyDataByWorkspace(DUMMY_WORKSPACE_TASKS, activeWorkspace);
}

/**
 * Get dummy events for a specific active workspace
 */
export function getDummyEventsForWorkspace(activeWorkspace: ActiveWorkspace): DummyWorkspaceEvent[] {
  return filterDummyDataByWorkspace(DUMMY_WORKSPACE_EVENTS, activeWorkspace);
}
