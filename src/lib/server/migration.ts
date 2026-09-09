import "server-only";

import { FieldValue, getAdminDb } from "@/lib/server/firebase-admin";
import { syncUserClaims } from "@/lib/server/auth";
import { DEFAULT_CORE_DIVISIONS } from "@/lib/workspace-schema";

export const TARGET_DEFAULT_CAMPUS = {
  id: "univ-undiksha",
  name: "Universitas Pendidikan Ganesha",
  code: "UNDIKSHA",
  city: "Singaraja, Bali",
  ormawa_count: 4,
};

export const TARGET_DEFAULT_ORMAWA = {
  id: "org-undiksha-forkom-kip",
  campus_id: "univ-undiksha",
  univ_id: "univ-undiksha",
  name: "Forkom KIP-Kuliah Undiksha",
  short_name: "Forkom KIP Undiksha",
  type: "UKM" as const,
  description: "Organisasi kemahasiswaan penerima KIP-Kuliah di lingkungan Universitas Pendidikan Ganesha.",
  is_active: true,
  member_count: 0,
  active_event_count: 0,
  active_task_count: 0,
};

export interface MigrationSummary {
  success: boolean;
  message: string;
  counts: {
    campuses: number;
    ormawas: number;
    coreDivisionsCreated: number;
    usersMigrated: number;
    ormawaMembersCreated: number;
    eventsMigrated: number;
    tasksMigrated: number;
    divisionsMigrated: number;
    referencesMigrated: number;
  };
  details: string[];
}

/**
 * Memigrasikan struktur data lama ke hierarki organisasi multi-tenant baru:
 * Universitas (univ-ui) -> Ormawa (org-ui-bem) -> Divisi Pokok -> Kegiatan -> Tugas.
 */
export async function migrateLegacyDataToNewOrganizationStructure(): Promise<MigrationSummary> {
  const db = getAdminDb();
  const details: string[] = [];
  const counts = {
    campuses: 0,
    ormawas: 0,
    coreDivisionsCreated: 0,
    usersMigrated: 0,
    ormawaMembersCreated: 0,
    eventsMigrated: 0,
    tasksMigrated: 0,
    divisionsMigrated: 0,
    referencesMigrated: 0,
  };

  // 1. Pastikan kampus bawaan (Universitas Indonesia) ada
  const campusRef = db.collection("campuses").doc(TARGET_DEFAULT_CAMPUS.id);
  const campusSnap = await campusRef.get();
  if (!campusSnap.exists) {
    await campusRef.set({
      ...TARGET_DEFAULT_CAMPUS,
      created_at: FieldValue.serverTimestamp(),
      updated_at: FieldValue.serverTimestamp(),
    });
    counts.campuses++;
    details.push(`Kampus default "${TARGET_DEFAULT_CAMPUS.name}" (${TARGET_DEFAULT_CAMPUS.id}) dibuat.`);
  }

  // 2. Pastikan ormawa bawaan (BEM UI) ada
  const ormawaRef = db.collection("ormawas").doc(TARGET_DEFAULT_ORMAWA.id);
  const ormawaSnap = await ormawaRef.get();
  if (!ormawaSnap.exists) {
    await ormawaRef.set({
      ...TARGET_DEFAULT_ORMAWA,
      created_at: FieldValue.serverTimestamp(),
      updated_at: FieldValue.serverTimestamp(),
    });
    counts.ormawas++;
    details.push(`Ormawa default "${TARGET_DEFAULT_ORMAWA.name}" (${TARGET_DEFAULT_ORMAWA.id}) dibuat.`);
  }

  // 3. Pastikan divisi-divisi pokok bawaan terdaftar di ormawa BEM UI
  const divisionsSnap = await db
    .collection("divisions")
    .where("organization_id", "in", [TARGET_DEFAULT_ORMAWA.id, "main_org"])
    .get();

  const existingDivSlugs = new Set<string>();
  divisionsSnap.forEach((d) => {
    const data = d.data();
    if (data.slug) existingDivSlugs.add(data.slug);
    if (d.id) existingDivSlugs.add(d.id);
  });

  for (const coreDiv of DEFAULT_CORE_DIVISIONS) {
    if (!existingDivSlugs.has(coreDiv.slug)) {
      const divDocId = `div-bem-${coreDiv.slug}`;
      await db.collection("divisions").doc(divDocId).set({
        id: divDocId,
        name: coreDiv.name,
        slug: coreDiv.slug,
        description: coreDiv.description,
        organization_id: TARGET_DEFAULT_ORMAWA.id,
        org_id: TARGET_DEFAULT_ORMAWA.id,
        orgId: TARGET_DEFAULT_ORMAWA.id,
        campus_id: TARGET_DEFAULT_CAMPUS.id,
        campusId: TARGET_DEFAULT_CAMPUS.id,
        univ_id: TARGET_DEFAULT_CAMPUS.id,
        univId: TARGET_DEFAULT_CAMPUS.id,
        is_core: true,
        is_active: true,
        coordinator_id: "",
        created_at: FieldValue.serverTimestamp(),
        updated_at: FieldValue.serverTimestamp(),
      });
      counts.coreDivisionsCreated++;
      details.push(`Divisi pokok "${coreDiv.name}" ditambahkan ke ormawa ${TARGET_DEFAULT_ORMAWA.id}.`);
    }
  }

  // 4. Migrasi Users ke struktur baru + ormawa_members
  const usersSnap = await db.collection("users").get();
  for (const userDoc of usersSnap.docs) {
    const uData = userDoc.data();
    const hasValidOrg = uData.org_id && uData.org_id !== "main_org";
    const hasValidCampus = uData.campus_id && uData.campus_id !== "ui";

    const targetOrg = (hasValidOrg ? uData.org_id : (uData.organization_id && uData.organization_id !== "main_org" ? uData.organization_id : TARGET_DEFAULT_ORMAWA.id)) as string;
    const targetCampus = (hasValidCampus ? uData.campus_id : (uData.univ_id && uData.univ_id !== "ui" ? uData.univ_id : TARGET_DEFAULT_CAMPUS.id)) as string;

    const needsUserUpdate =
      !uData.org_id ||
      uData.org_id === "main_org" ||
      !uData.organization_id ||
      uData.organization_id === "main_org" ||
      !uData.campus_id ||
      uData.campus_id === "ui" ||
      !uData.univ_id ||
      uData.univ_id === "ui";

    if (needsUserUpdate) {
      await userDoc.ref.update({
        organization_id: targetOrg,
        org_id: targetOrg,
        orgId: targetOrg,
        campus_id: targetCampus,
        campusId: targetCampus,
        univ_id: targetCampus,
        univId: targetCampus,
        updated_at: FieldValue.serverTimestamp(),
      });
      counts.usersMigrated++;

      // Sinkronkan Custom Claims
      try {
        await syncUserClaims(userDoc.id);
      } catch (claimErr) {
        console.warn(`[migration] Gagal sync claims user ${userDoc.id}:`, claimErr);
      }
    }

    // Pastikan relasi ormawa_members ada
    const relationId = `${userDoc.id}_${targetOrg}`;
    const relationRef = db.collection("ormawa_members").doc(relationId);
    const relationSnap = await relationRef.get();
    if (!relationSnap.exists) {
      await relationRef.set({
        id: relationId,
        user_id: userDoc.id,
        ormawa_id: targetOrg,
        organization_id: targetOrg,
        org_id: targetOrg,
        campus_id: targetCampus,
        univ_id: targetCampus,
        role: uData.role || "anggota",
        is_active: uData.is_active !== false,
        joined_at: FieldValue.serverTimestamp(),
      });
      counts.ormawaMembersCreated++;
    }
  }

  // 5. Migrasi Events
  const eventsSnap = await db.collection("events").get();
  for (const eventDoc of eventsSnap.docs) {
    const eData = eventDoc.data();
    const needsEventUpdate =
      !eData.org_id ||
      eData.org_id === "main_org" ||
      !eData.organization_id ||
      eData.organization_id === "main_org" ||
      !eData.campus_id ||
      eData.campus_id === "ui" ||
      !eData.univ_id ||
      eData.univ_id === "ui";

    const targetOrg = (eData.org_id && eData.org_id !== "main_org") ? eData.org_id : TARGET_DEFAULT_ORMAWA.id;
    const targetCampus = (eData.campus_id && eData.campus_id !== "ui") ? eData.campus_id : TARGET_DEFAULT_CAMPUS.id;

    if (needsEventUpdate) {
      await eventDoc.ref.update({
        organization_id: targetOrg,
        org_id: targetOrg,
        orgId: targetOrg,
        campus_id: targetCampus,
        campusId: targetCampus,
        univ_id: targetCampus,
        univId: targetCampus,
        updated_at: FieldValue.serverTimestamp(),
      });
      counts.eventsMigrated++;
    }

    // Perbarui event_members jika belum lengkap
    try {
      const emSnap = await eventDoc.ref.collection("event_members").get();
      for (const emDoc of emSnap.docs) {
        const emData = emDoc.data();
        if (!emData.organization_id || !emData.campus_id) {
          await emDoc.ref.update({
            organization_id: targetOrg,
            org_id: targetOrg,
            orgId: targetOrg,
            campus_id: targetCampus,
            campusId: targetCampus,
            univ_id: targetCampus,
            univId: targetCampus,
          });
        }
      }
    } catch {
      // ignore
    }
  }

  // 6. Migrasi Tasks
  const tasksSnap = await db.collection("tasks").get();
  for (const taskDoc of tasksSnap.docs) {
    const tData = taskDoc.data();
    const needsTaskUpdate =
      !tData.org_id ||
      tData.org_id === "main_org" ||
      !tData.organization_id ||
      tData.organization_id === "main_org" ||
      !tData.campus_id ||
      tData.campus_id === "ui" ||
      !tData.univ_id ||
      tData.univ_id === "ui" ||
      (tData.type === "divisi" && !tData.division_id);

    const targetOrg = (tData.org_id && tData.org_id !== "main_org") ? tData.org_id : TARGET_DEFAULT_ORMAWA.id;
    const targetCampus = (tData.campus_id && tData.campus_id !== "ui") ? tData.campus_id : TARGET_DEFAULT_CAMPUS.id;

    if (needsTaskUpdate) {
      const updatePayload: Record<string, unknown> = {
        organization_id: targetOrg,
        org_id: targetOrg,
        orgId: targetOrg,
        campus_id: targetCampus,
        campusId: targetCampus,
        univ_id: targetCampus,
        univId: targetCampus,
        updated_at: FieldValue.serverTimestamp(),
      };
      if (tData.type === "divisi" && !tData.division_id) {
        updatePayload.division_id = "div-bem-humas-media-kreatif";
      }

      await taskDoc.ref.update(updatePayload);
      counts.tasksMigrated++;
    }

    // Subkoleksi status_logs
    try {
      const slSnap = await taskDoc.ref.collection("status_logs").get();
      for (const slDoc of slSnap.docs) {
        const slData = slDoc.data();
        if (!slData.organization_id || !slData.campus_id) {
          await slDoc.ref.update({
            organization_id: targetOrg,
            org_id: targetOrg,
            campus_id: targetCampus,
            univ_id: targetCampus,
          });
        }
      }
    } catch {
      // ignore
    }

    // Subkoleksi uploads
    try {
      const upSnap = await taskDoc.ref.collection("uploads").get();
      for (const upDoc of upSnap.docs) {
        const upData = upDoc.data();
        if (!upData.organization_id || !upData.campus_id) {
          await upDoc.ref.update({
            organization_id: targetOrg,
            org_id: targetOrg,
            campus_id: targetCampus,
            univ_id: targetCampus,
          });
        }
      }
    } catch {
      // ignore
    }
  }

  // 7. Migrasi Divisions
  const allDivisionsSnap = await db.collection("divisions").get();
  for (const divDoc of allDivisionsSnap.docs) {
    const dData = divDoc.data();
    const needsDivUpdate =
      !dData.org_id ||
      dData.org_id === "main_org" ||
      !dData.organization_id ||
      dData.organization_id === "main_org" ||
      !dData.campus_id ||
      dData.campus_id === "ui" ||
      !dData.univ_id ||
      dData.univ_id === "ui";

    if (needsDivUpdate) {
      await divDoc.ref.update({
        organization_id: TARGET_DEFAULT_ORMAWA.id,
        org_id: TARGET_DEFAULT_ORMAWA.id,
        orgId: TARGET_DEFAULT_ORMAWA.id,
        campus_id: TARGET_DEFAULT_CAMPUS.id,
        campusId: TARGET_DEFAULT_CAMPUS.id,
        univ_id: TARGET_DEFAULT_CAMPUS.id,
        univId: TARGET_DEFAULT_CAMPUS.id,
        updated_at: FieldValue.serverTimestamp(),
      });
      counts.divisionsMigrated++;
    }
  }

  // 8. Migrasi Design References
  const refsSnap = await db.collection("design_references").get();
  for (const refDoc of refsSnap.docs) {
    const rData = refDoc.data();
    const needsRefUpdate =
      !rData.org_id ||
      rData.org_id === "main_org" ||
      !rData.organization_id ||
      rData.organization_id === "main_org" ||
      !rData.campus_id ||
      rData.campus_id === "ui" ||
      !rData.univ_id ||
      rData.univ_id === "ui";

    if (needsRefUpdate) {
      await refDoc.ref.update({
        organization_id: TARGET_DEFAULT_ORMAWA.id,
        org_id: TARGET_DEFAULT_ORMAWA.id,
        orgId: TARGET_DEFAULT_ORMAWA.id,
        campus_id: TARGET_DEFAULT_CAMPUS.id,
        campusId: TARGET_DEFAULT_CAMPUS.id,
        univ_id: TARGET_DEFAULT_CAMPUS.id,
        univId: TARGET_DEFAULT_CAMPUS.id,
        updated_at: FieldValue.serverTimestamp(),
      });
      counts.referencesMigrated++;
    }
  }

  const message = `Migrasi selesai: ${counts.usersMigrated} pengguna, ${counts.eventsMigrated} kegiatan, ${counts.tasksMigrated} tugas, ${counts.divisionsMigrated} divisi, ${counts.referencesMigrated} referensi diperbarui ke ormawa ${TARGET_DEFAULT_ORMAWA.name}.`;

  return {
    success: true,
    message,
    counts,
    details,
  };
}
