import type { Campus, Ormawa, ActiveWorkspace } from "@/types/workspace";

export const DUMMY_CAMPUSES: Campus[] = [
  {
    id: "univ-undiksha",
    name: "Universitas Pendidikan Ganesha",
    code: "UNDIKSHA",
    city: "Singaraja, Bali",
    ormawa_count: 4,
  },
  {
    id: "univ-ui",
    name: "Universitas Indonesia",
    code: "UI",
    city: "Depok, Jawa Barat",
    ormawa_count: 4,
  },
  {
    id: "univ-itb",
    name: "Institut Teknologi Bandung",
    code: "ITB",
    city: "Bandung, Jawa Barat",
    ormawa_count: 3,
  },
  {
    id: "univ-unud",
    name: "Universitas Udayana",
    code: "UNUD",
    city: "Badung, Bali",
    ormawa_count: 3,
  },
  {
    id: "univ-ugm",
    name: "Universitas Gadjah Mada",
    code: "UGM",
    city: "Sleman, D.I. Yogyakarta",
    ormawa_count: 3,
  },
];

export const DUMMY_ORMAWAS: Ormawa[] = [
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
    id: "org-undiksha-forkom-kip",
    campus_id: "univ-undiksha",
    name: "Forum Komunikasi KIP-Kuliah Undiksha",
    short_name: "Forkom KIP Undiksha",
    type: "UKM",
    description: "Organisasi kemahasiswaan penerima KIP-Kuliah di lingkungan Universitas Pendidikan Ganesha.",
    member_count: 110,
    active_event_count: 3,
    active_task_count: 18,
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
  {
    id: "org-ui-bem",
    campus_id: "univ-ui",
    name: "Badan Eksekutif Mahasiswa UI",
    short_name: "BEM UI",
    type: "BEM",
    description: "Lembaga eksekutif mahasiswa tingkat universitas penanggung jawab program kerja terpadu UI.",
    member_count: 142,
    active_event_count: 5,
    active_task_count: 28,
    is_active: true,
  },
  {
    id: "org-ui-dpm",
    campus_id: "univ-ui",
    name: "Dewan Perwakilan Mahasiswa UI",
    short_name: "DPM UI",
    type: "DPM",
    description: "Lembaga legislatif mahasiswa UI yang menaungi pengawasan dan pembentukan regulasi ormawa.",
    member_count: 48,
    active_event_count: 2,
    active_task_count: 11,
    is_active: true,
  },
  {
    id: "org-ui-hmif",
    campus_id: "univ-ui",
    name: "Himpunan Mahasiswa Ilmu Komputer UI",
    short_name: "BEM Fasilkom UI",
    type: "HMJ",
    description: "Organisasi kepengurusan mahasiswa Fakultas Ilmu Komputer Universitas Indonesia.",
    member_count: 85,
    active_event_count: 4,
    active_task_count: 34,
    is_active: true,
  },
  {
    id: "org-ui-paragita",
    campus_id: "univ-ui",
    name: "Paduan Suara Mahasiswa Paragita UI",
    short_name: "PSM Paragita",
    type: "UKM",
    description: "Unit kegiatan mahasiswa bidang seni tarik suara dan konser paduan suara universitas.",
    member_count: 60,
    active_event_count: 1,
    active_task_count: 8,
    is_active: true,
  },
  {
    id: "org-itb-km",
    campus_id: "univ-itb",
    name: "Keluarga Mahasiswa ITB",
    short_name: "KM ITB",
    type: "BEM",
    description: "Organisasi kemahasiswaan pusat Institut Teknologi Bandung pembina kegiatan terpusat kampus.",
    member_count: 180,
    active_event_count: 6,
    active_task_count: 45,
    is_active: true,
  },
  {
    id: "org-itb-hmif",
    campus_id: "univ-itb",
    name: "Himpunan Mahasiswa Informatika ITB",
    short_name: "HMIF ITB",
    type: "HMJ",
    description: "Himpunan mahasiswa program studi Teknik Informatika dan Sistem & Teknologi Informasi ITB.",
    member_count: 110,
    active_event_count: 3,
    active_task_count: 22,
    is_active: true,
  },
  {
    id: "org-itb-uro",
    campus_id: "univ-itb",
    name: "Unit Robotika ITB",
    short_name: "URO ITB",
    type: "UKM",
    description: "Unit kegiatan mahasiswa riset rekayasa sistem otomasi dan robotika kompetisi.",
    member_count: 75,
    active_event_count: 2,
    active_task_count: 15,
    is_active: true,
  },
  {
    id: "org-unud-bem",
    campus_id: "univ-unud",
    name: "BEM Pemerintahan Mahasiswa Universitas Udayana",
    short_name: "BEM PM UNUD",
    type: "BEM",
    description: "Badan eksekutif tertinggi mahasiswa Universitas Udayana penanggung jawab Udayana Mengabdi.",
    member_count: 130,
    active_event_count: 4,
    active_task_count: 31,
    is_active: true,
  },
  {
    id: "org-unud-hmti",
    campus_id: "univ-unud",
    name: "Himpunan Mahasiswa Teknologi Informasi UNUD",
    short_name: "HMTI UNUD",
    type: "HMJ",
    description: "Himpunan jurusan Teknologi Informasi Fakultas Teknik penanggung jawab ITCC & Seminar TI.",
    member_count: 95,
    active_event_count: 3,
    active_task_count: 19,
    is_active: true,
  },
  {
    id: "org-unud-seni",
    campus_id: "univ-unud",
    name: "Unit Kegiatan Mahasiswa Kesenian Udayana",
    short_name: "UKM Kesenian",
    type: "UKM",
    description: "UKM pelestari seni tari dan gamelan kebudayaan tradisional khas Bali mahasiswa Udayana.",
    member_count: 55,
    active_event_count: 2,
    active_task_count: 9,
    is_active: true,
  },
  {
    id: "org-ugm-bem",
    campus_id: "univ-ugm",
    name: "BEM Keluarga Mahasiswa UGM",
    short_name: "BEM KM UGM",
    type: "BEM",
    description: "Lembaga eksekutif mahasiswa UGM koordinator advokasi dan kepanitiaan universitas.",
    member_count: 210,
    active_event_count: 7,
    active_task_count: 50,
    is_active: true,
  },
  {
    id: "org-ugm-komatik",
    campus_id: "univ-ugm",
    name: "Komunitas Mahasiswa TIK UGM",
    short_name: "KOMATIK UGM",
    type: "HMJ",
    description: "Komunitas dan himpunan minat teknologi informasi dan komunikasi mahasiswa UGM.",
    member_count: 88,
    active_event_count: 3,
    active_task_count: 16,
    is_active: true,
  },
  {
    id: "org-ugm-badminton",
    campus_id: "univ-ugm",
    name: "UKM Bulutangkis Gelora UGM",
    short_name: "UKM Badminton",
    type: "UKM",
    description: "Unit kegiatan minat dan bakat olahraga bulutangkis kompetitif dan rekreasi.",
    member_count: 65,
    active_event_count: 1,
    active_task_count: 6,
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
  org_id: "org-undiksha-bem",
  orgId: "org-undiksha-bem",
  org_name: "BEM REMA Undiksha",
  org_type: "BEM",
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
  // UNDIKSHA BEM Tasks
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
  {
    id: "dummy-task-undiksha-3",
    campus_id: "univ-undiksha",
    univ_id: "univ-undiksha",
    org_id: "org-undiksha-bem",
    organization_id: "org-undiksha-bem",
    name: "Publikasi Press Release Kegiatan Pengabdian Mahasiswa",
    type: "divisi",
    status: "review",
    priority: "high",
    pic_name: "Komang Ayu",
    division_name: "Humas & Media Kreatif",
    deadline: "2026-09-12",
  },
  {
    id: "dummy-task-undiksha-4",
    campus_id: "univ-undiksha",
    univ_id: "univ-undiksha",
    org_id: "org-undiksha-bem",
    organization_id: "org-undiksha-bem",
    name: "Penyusunan Jadwal Konten Media Sosial Bulanan Undiksha",
    type: "divisi",
    status: "done",
    priority: "medium",
    pic_name: "Ketut Artana",
    division_name: "Humas & Media Kreatif",
    deadline: "2026-09-08",
  },
  // UI BEM Tasks
  {
    id: "dummy-task-ui-1",
    campus_id: "univ-ui",
    univ_id: "univ-ui",
    org_id: "org-ui-bem",
    organization_id: "org-ui-bem",
    name: "Desain Konten Feed Instagram UI Leadership Summit",
    type: "acara",
    status: "in_progress",
    priority: "high",
    pic_name: "Ahmad Fauzi",
    division_name: "Humas & Media Kreatif",
    deadline: "2026-09-15",
  },
  {
    id: "dummy-task-ui-2",
    campus_id: "univ-ui",
    univ_id: "univ-ui",
    org_id: "org-ui-bem",
    organization_id: "org-ui-bem",
    name: "Koordinasi Perizinan Gedung Makara Art Center",
    type: "acara",
    status: "todo",
    priority: "medium",
    pic_name: "Nabila Putri",
    division_name: "Logistik & Perlengkapan",
    deadline: "2026-09-20",
  },
  {
    id: "dummy-task-ui-3",
    campus_id: "univ-ui",
    univ_id: "univ-ui",
    org_id: "org-ui-bem",
    organization_id: "org-ui-bem",
    name: "Penyusunan LPJ Triwulan Divisi Kominfo",
    type: "divisi",
    status: "done",
    priority: "low",
    pic_name: "Dimas Pratama",
    division_name: "Kastrat & Kajian",
    deadline: "2026-09-05",
  },
  // ITB KM Tasks
  {
    id: "dummy-task-itb-1",
    campus_id: "univ-itb",
    univ_id: "univ-itb",
    org_id: "org-itb-km",
    organization_id: "org-itb-km",
    name: "Rancang Desain Backdrop Utama Ganesha Innovation Expo",
    type: "acara",
    status: "in_progress",
    priority: "high",
    pic_name: "Rian Hendrawan",
    division_name: "Desain Visual & Kreatif",
    deadline: "2026-09-18",
  },
  {
    id: "dummy-task-itb-2",
    campus_id: "univ-itb",
    univ_id: "univ-itb",
    org_id: "org-itb-km",
    organization_id: "org-itb-km",
    name: "Finalisasi Sponsorship Mitra Industri Pasar Seni ITB",
    type: "acara",
    status: "todo",
    priority: "high",
    pic_name: "Farhan Ardiansyah",
    division_name: "Kemitraan & Dana Usaha",
    deadline: "2026-09-22",
  },
  // UNUD BEM Tasks
  {
    id: "dummy-task-unud-1",
    campus_id: "univ-unud",
    univ_id: "univ-unud",
    org_id: "org-unud-bem",
    organization_id: "org-unud-bem",
    name: "Survei Lapangan Lokasi Udayana Mengabdi di Tabanan",
    type: "acara",
    status: "in_progress",
    priority: "medium",
    pic_name: "Wayan Sukadana",
    division_name: "Pengabdian Masyarakat",
    deadline: "2026-09-14",
  },
  {
    id: "dummy-task-unud-2",
    campus_id: "univ-unud",
    univ_id: "univ-unud",
    org_id: "org-unud-bem",
    organization_id: "org-unud-bem",
    name: "Penyusunan Rundown Upacara Pembukaan Festival Budaya",
    type: "acara",
    status: "todo",
    priority: "high",
    pic_name: "Made Ratnasari",
    division_name: "Acara & Protokoler",
    deadline: "2026-09-19",
  },
  // UGM BEM Tasks
  {
    id: "dummy-task-ugm-1",
    campus_id: "univ-ugm",
    univ_id: "univ-ugm",
    org_id: "org-ugm-bem",
    organization_id: "org-ugm-bem",
    name: "Review Proposal Lomba Karya Ilmiah PIMNAS Regional",
    type: "acara",
    status: "review",
    priority: "high",
    pic_name: "Bagas Wicaksono",
    division_name: "Penelitian & Penalaran",
    deadline: "2026-09-12",
  },
  {
    id: "dummy-task-ugm-2",
    campus_id: "univ-ugm",
    univ_id: "univ-ugm",
    org_id: "org-ugm-bem",
    organization_id: "org-ugm-bem",
    name: "Pengadaan Bibit Tanaman untuk Aksi UGM Hijau",
    type: "acara",
    status: "todo",
    priority: "medium",
    pic_name: "Anisa Rahma",
    division_name: "Lingkungan Hidup",
    deadline: "2026-09-25",
  },
];

export const DUMMY_WORKSPACE_EVENTS: DummyWorkspaceEvent[] = [
  // UNDIKSHA BEM
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
  // UI BEM
  {
    id: "dummy-event-ui-1",
    campus_id: "univ-ui",
    univ_id: "univ-ui",
    org_id: "org-ui-bem",
    organization_id: "org-ui-bem",
    name: "UI Youth Leadership Summit 2026",
    description: "Konferensi kepemimpinan pemuda berskala nasional di Balairung Universitas Indonesia.",
    status: "persiapan",
    event_date: "2026-10-10",
    progress_percentage: 45,
  },
  {
    id: "dummy-event-ui-2",
    campus_id: "univ-ui",
    univ_id: "univ-ui",
    org_id: "org-ui-bem",
    organization_id: "org-ui-bem",
    name: "Bakti Desa Makara UI",
    description: "Program pengabdian sosial terpadu mahasiswa UI untuk pemberdayaan UMKM lokal.",
    status: "berlangsung",
    event_date: "2026-09-28",
    progress_percentage: 70,
  },
  // ITB KM
  {
    id: "dummy-event-itb-1",
    campus_id: "univ-itb",
    univ_id: "univ-itb",
    org_id: "org-itb-km",
    organization_id: "org-itb-km",
    name: "Ganesha Innovation Expo",
    description: "Pameran karya riset, rekayasa teknologi, dan startup mahasiswa ITB.",
    status: "persiapan",
    event_date: "2026-11-05",
    progress_percentage: 30,
  },
  {
    id: "dummy-event-itb-2",
    campus_id: "univ-itb",
    univ_id: "univ-itb",
    org_id: "org-itb-km",
    organization_id: "org-itb-km",
    name: "Pasar Seni ITB 2026",
    description: "Festival seni rupa dan instalasi visual akbar kampus Ganesha.",
    status: "persiapan",
    event_date: "2026-12-01",
    progress_percentage: 20,
  },
  // UNUD BEM
  {
    id: "dummy-event-unud-1",
    campus_id: "univ-unud",
    univ_id: "univ-unud",
    org_id: "org-unud-bem",
    organization_id: "org-unud-bem",
    name: "Udayana Mengabdi 2026",
    description: "Program bakti sosial lintas fakultas untuk desa adat pesisir Bali.",
    status: "berlangsung",
    event_date: "2026-09-30",
    progress_percentage: 60,
  },
  // UGM BEM
  {
    id: "dummy-event-ugm-1",
    campus_id: "univ-ugm",
    univ_id: "univ-ugm",
    org_id: "org-ugm-bem",
    organization_id: "org-ugm-bem",
    name: "Pekan Ilmiah Gadjah Mada",
    description: "Simposium kompetisi karya ilmiah dan poster penelitian mahasiswa se-Indonesia.",
    status: "persiapan",
    event_date: "2026-10-24",
    progress_percentage: 50,
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

    const matchesCampus = !itemCampus || itemCampus === targetCampus;
    const matchesOrg = !itemOrg || itemOrg === targetOrg;

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

