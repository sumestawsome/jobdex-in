import {
  collection,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import {
  DEFAULT_DIVISION_ID,
  DEFAULT_ORGANIZATION_ID,
} from "@/lib/seed-data";
import type { UserProfile } from "@/types";

export type DashboardSummaryItem = {
  label: string;
  value: number | string;
  description: string;
};

export type DashboardSummary = {
  title: string;
  description: string;
  items: DashboardSummaryItem[];
  setupReady?: boolean;
};

async function safeCount(collectionName: string) {
  try {
    const snapshot = await getCountFromServer(collection(db, collectionName));
    return snapshot.data().count;
  } catch {
    return 0;
  }
}

async function safeQueryCount(collectionName: string, field: string, value: unknown) {
  try {
    const snapshot = await getCountFromServer(
      query(collection(db, collectionName), where(field, "==", value)),
    );
    return snapshot.data().count;
  } catch {
    return 0;
  }
}

async function safeDocsByField(
  collectionName: string,
  field: string,
  value: unknown,
) {
  try {
    const snapshot = await getDocs(
      query(collection(db, collectionName), where(field, "==", value)),
    );

    return snapshot.docs.map((item) => item.data());
  } catch {
    return [];
  }
}

async function safeDocs(collectionName: string) {
  try {
    const snapshot = await getDocs(collection(db, collectionName));
    return snapshot.docs.map((item) => item.data());
  } catch {
    return [];
  }
}

function countWhere(
  docs: Array<Record<string, unknown>>,
  field: string,
  value: unknown,
) {
  return docs.filter((item) => item[field] === value).length;
}

async function safeSetupReady() {
  try {
    const [organizationSnapshot, divisionSnapshot] = await Promise.all([
      getDoc(doc(db, "organizations", DEFAULT_ORGANIZATION_ID)),
      getDoc(doc(db, "divisions", DEFAULT_DIVISION_ID)),
    ]);

    return organizationSnapshot.exists() && divisionSnapshot.exists();
  } catch {
    return false;
  }
}

export async function getDashboardSummary(
  profile: UserProfile,
  workspaceFilter?: { org_id?: string; campus_id?: string }
) {
  const targetOrgId = workspaceFilter?.org_id || profile.organization_id || profile.org_id;
  const targetCampusId = workspaceFilter?.campus_id || profile.campus_id || profile.univ_id;

  const matchesTenant = (item: Record<string, unknown>): boolean => {
    if (targetOrgId) {
      const org = item.organization_id || item.org_id || item.orgId || "org-undiksha-forkom-kip";
      const isLegacyOrg =
        org === targetOrgId ||
        ((org === "main_org" || org === "org-undiksha-forkom-kip" || org === "org-undiksha-bem") &&
         (targetOrgId === "org-undiksha-forkom-kip" || targetOrgId === "org-undiksha-bem" || targetOrgId === "main_org"));
      if (!isLegacyOrg) return false;
    }
    if (targetCampusId) {
      const campus = item.campus_id || item.campusId || item.univ_id || item.univId || "univ-undiksha";
      const isLegacyCampus =
        campus === targetCampusId ||
        campus === "univ-undiksha" ||
        campus === "ui" ||
        (!item.campus_id && !item.campusId && !item.univ_id && !item.univId);
      if (!isLegacyCampus) return false;
    }
    return true;
  };

  if (profile.role === "super_admin") {
    const [rawUsers, rawEvents, rawTasks, rawReferences, setupReady] = await Promise.all([
      safeDocs("users"),
      safeDocs("events"),
      safeDocs("tasks"),
      safeDocs("design_references"),
      safeSetupReady(),
    ]);

    const users = rawUsers.filter(matchesTenant).length;
    const events = rawEvents.filter(matchesTenant).length;
    const taskDocs = rawTasks.filter(matchesTenant);
    const references = rawReferences.filter(matchesTenant).length;

    return {
      title: "Ringkasan seluruh organisasi",
      description:
        "Pantauan awal untuk anggota, acara, tugas, referensi, dan status setup data.",
      setupReady,
      items: [
        {
          label: "Total anggota",
          value: users,
          description: "Anggota terdaftar",
        },
        {
          label: "Total acara",
          value: events,
          description: "Acara aktif",
        },
        {
          label: "Total tugas",
          value: taskDocs.length,
          description: "Total job desk",
        },
        {
          label: "Sedang dikerjakan",
          value: countWhere(taskDocs, "status", "sedang_dikerjakan"),
          description: "Sedang proses",
        },
        {
          label: "Stuck",
          value: countWhere(taskDocs, "status", "stuck"),
          description: "Tugas stuck",
        },
        {
          label: "Butuh bantuan",
          value: countWhere(taskDocs, "status", "butuh_bantuan"),
          description: "Butuh bantuan",
        },
        {
          label: "Perlu revisi",
          value: countWhere(taskDocs, "approval_status", "need_revision"),
          description: "Perlu revisi",
        },
        {
          label: "Menunggu approval",
          value: countWhere(taskDocs, "status", "menunggu_approval"),
          description: "Menunggu approval",
        },
        {
          label: "Approved",
          value: countWhere(taskDocs, "status", "approved"),
          description: "Sudah approved",
        },
        {
          label: "Referensi desain",
          value: references,
          description: "Arsip desain",
        },
      ],
    } satisfies DashboardSummary;
  }

  if (profile.role === "koordinator_divisi") {
    const divisionId = profile.division_id || DEFAULT_DIVISION_ID;
    const [rawMembers, rawTasks] = await Promise.all([
      safeDocsByField("users", "division_id", divisionId),
      safeDocsByField("tasks", "division_id", divisionId),
    ]);
    const members = rawMembers.filter(matchesTenant).length;
    const divisionTaskDocs = rawTasks.filter(matchesTenant);

    return {
      title: "Ringkasan koordinator divisi",
      description:
        "Pantauan awal untuk anggota divisi dan status tugas divisi.",
      items: [
        {
          label: "Total anggota divisi",
          value: members,
          description: "Anggota terdaftar",
        },
        {
          label: "Tugas divisi aktif",
          value: divisionTaskDocs.length,
          description: "Total job desk",
        },
        {
          label: "Tugas stuck",
          value: countWhere(divisionTaskDocs, "status", "stuck"),
          description: "Tugas stuck",
        },
        {
          label: "Butuh bantuan",
          value: countWhere(divisionTaskDocs, "status", "butuh_bantuan"),
          description: "Butuh bantuan",
        },
        {
          label: "Perlu revisi",
          value: countWhere(divisionTaskDocs, "approval_status", "need_revision"),
          description: "Perlu revisi",
        },
        {
          label: "Menunggu approval",
          value: countWhere(divisionTaskDocs, "status", "menunggu_approval"),
          description: "Menunggu approval",
        },
      ],
    } satisfies DashboardSummary;
  }

  if (profile.role === "koordinator_acara") {
    const [rawEvents, rawTasks] = await Promise.all([
      safeDocsByField("events", "coordinator_id", profile.id),
      safeDocsByField("tasks", "coordinator_id", profile.id),
    ]);
    const events = rawEvents.filter(matchesTenant).length;
    const eventTaskDocs = rawTasks.filter(matchesTenant);

    return {
      title: "Ringkasan koordinator acara",
      description: "Pantauan awal untuk acara dan tugas yang Anda koordinasikan.",
      items: [
        {
          label: "Acara dikoordinasi",
          value: events,
          description: "Acara aktif",
        },
        {
          label: "Tugas acara aktif",
          value: eventTaskDocs.length,
          description: "Total job desk",
        },
        {
          label: "Tugas stuck",
          value: countWhere(eventTaskDocs, "status", "stuck"),
          description: "Tugas stuck",
        },
        {
          label: "Butuh bantuan",
          value: countWhere(eventTaskDocs, "status", "butuh_bantuan"),
          description: "Butuh bantuan",
        },
        {
          label: "Perlu revisi",
          value: countWhere(eventTaskDocs, "approval_status", "need_revision"),
          description: "Perlu revisi",
        },
        {
          label: "Menunggu approval",
          value: countWhere(eventTaskDocs, "status", "menunggu_approval"),
          description: "Menunggu approval",
        },
      ],
    } satisfies DashboardSummary;
  }

  const rawTasks = await safeDocsByField("tasks", "pic_id", profile.id);
  const myTaskDocs = rawTasks.filter(matchesTenant);

  return {
    title: "Ringkasan tugas saya",
    description: "Pantauan awal untuk tugas yang ditugaskan ke akun Anda.",
    items: [
      {
        label: "Tugas saya",
        value: myTaskDocs.length,
        description: "Total job desk",
      },
      {
        label: "Belum dimulai",
        value: countWhere(myTaskDocs, "status", "belum_dimulai"),
        description: "Belum dimulai",
      },
      {
        label: "Sedang dikerjakan",
        value: countWhere(myTaskDocs, "status", "sedang_dikerjakan"),
        description: "Sedang proses",
      },
      {
        label: "Perlu revisi",
        value: countWhere(myTaskDocs, "approval_status", "need_revision"),
        description: "Perlu revisi",
      },
      {
        label: "Butuh bantuan",
        value: countWhere(myTaskDocs, "status", "butuh_bantuan"),
        description: "Butuh bantuan",
      },
      {
        label: "Menunggu approval",
        value: countWhere(myTaskDocs, "status", "menunggu_approval"),
        description: "Menunggu approval",
      },
      {
        label: "Approved",
        value: countWhere(myTaskDocs, "status", "approved"),
        description: "Sudah approved",
      },
    ],
  } satisfies DashboardSummary;
}
