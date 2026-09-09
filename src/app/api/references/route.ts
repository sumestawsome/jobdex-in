import { NextResponse, type NextRequest } from "next/server";
import { getServerAuthContext } from "@/lib/server/auth";
import { getAdminDb } from "@/lib/server/firebase-admin";
import { isTaskReferenceEligible, mapTaskSubcategoryToDesignType } from "@/lib/reference-utils";
import type { ReferenceListItem, Task, TaskUpload, DesignReference } from "@/types";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    // 1. Authenticate user
    const { profile } = await getServerAuthContext(request);
    const db = getAdminDb();

    // Helper functions for safe extraction and fallback
    const safeString = (val: unknown, fallback = ""): string => {
      if (val === null || val === undefined) return fallback;
      return String(val).trim();
    };

    const safeArray = <T>(val: unknown): T[] => {
      return Array.isArray(val) ? val : [];
    };

    // 2. Fetch all collections in parallel using Promise.allSettled for maximum safety
    const isKoordinatorUser =
      profile.role === "super_admin" ||
      profile.role === "koordinator_divisi" ||
      profile.role === "koordinator_acara";

    const referencesRef = db.collection("design_references");
    let referencesQuery = referencesRef.where("is_archived", "==", false);
    if (isKoordinatorUser) {
      referencesQuery = referencesRef;
    }

    const tasksRef = db.collection("tasks");

    const [
      referencesRes,
      tasksRes,
      eventsRes,
      divisionsRes
    ] = await Promise.allSettled([
      referencesQuery.get(),
      tasksRef.where("status", "==", "approved").get(),
      db.collection("events").get(),
      db.collection("divisions").get()
    ]);

    const referencesSnap = referencesRes.status === "fulfilled" ? referencesRes.value : null;
    const tasksSnap = tasksRes.status === "fulfilled" ? tasksRes.value : null;
    const eventsSnap = eventsRes.status === "fulfilled" ? eventsRes.value : null;
    const divisionsSnap = divisionsRes.status === "fulfilled" ? divisionsRes.value : null;

    if (referencesRes.status === "rejected") {
      console.warn("[api/references] Failed to fetch design_references", referencesRes.reason);
    }
    if (tasksRes.status === "rejected") {
      console.warn("[api/references] Failed to fetch tasks", tasksRes.reason);
    }
    if (eventsRes.status === "rejected") {
      console.warn("[api/references] Failed to fetch events", eventsRes.reason);
    }
    if (divisionsRes.status === "rejected") {
      console.warn("[api/references] Failed to fetch divisions", divisionsRes.reason);
    }

    const userOrgId = profile.organization_id || profile.org_id || ((profile as unknown as Record<string, unknown>).orgId as string) || "";
    const userCampusId = profile.campus_id || profile.univ_id || ((profile as unknown as Record<string, unknown>).campusId as string) || "";
    const requestedOrgId = request.nextUrl.searchParams.get("org_id");
    const requestedCampusId = request.nextUrl.searchParams.get("campus_id");

    let targetOrgId = userOrgId;
    let targetCampusId = userCampusId;

    if (profile.role === "super_admin") {
      targetOrgId = requestedOrgId || userOrgId;
      targetCampusId = requestedCampusId || userCampusId;
    } else {
      if (requestedOrgId && userOrgId && requestedOrgId !== userOrgId) {
        return NextResponse.json(
          { error: "Akses ditolak: Anda tidak memiliki izin mengakses data organisasi lain." },
          { status: 403 }
        );
      }
      if (requestedCampusId && userCampusId && requestedCampusId !== userCampusId) {
        return NextResponse.json(
          { error: "Akses ditolak: Anda tidak memiliki izin mengakses data kampus lain." },
          { status: 403 }
        );
      }
    }

    // Populate events map
    const eventsMap = new Map<string, string>();
    if (eventsSnap) {
      eventsSnap.forEach((doc) => {
        const data = doc.data() as Record<string, unknown>;
        if (targetOrgId) {
          const org = data.organization_id || data.org_id || data.orgId || "main_org";
          if (org !== targetOrgId) return;
        }
        if (targetCampusId) {
          const campus = data.campus_id || data.campusId || data.univ_id || data.univId || "ui";
          if (campus !== targetCampusId) return;
        }
        eventsMap.set(doc.id, safeString(data?.name || ""));
      });
    }

    // Populate divisions map with humas_media_kreatif as fallback default
    const divisionsMap = new Map<string, string>();
    divisionsMap.set("humas_media_kreatif", "Humas & Media Kreatif");
    if (divisionsSnap) {
      divisionsSnap.forEach((doc) => {
        const data = doc.data() as Record<string, unknown>;
        if (targetOrgId) {
          const org = data.organization_id || data.org_id || data.orgId || "main_org";
          if (org !== targetOrgId) return;
        }
        if (targetCampusId) {
          const campus = data.campus_id || data.campusId || data.univ_id || data.univId || "ui";
          if (campus !== targetCampusId) return;
        }
        divisionsMap.set(doc.id, safeString(data?.name || ""));
      });
    }

    // Map manual references safely
    const manualReferences: DesignReference[] = [];
    if (referencesSnap) {
      referencesSnap.forEach((doc) => {
        const data = doc.data() as Record<string, unknown>;
        if (targetOrgId) {
          const org = data.organization_id || data.org_id || data.orgId || "main_org";
          if (org !== targetOrgId) return;
        }
        if (targetCampusId) {
          const campus = data.campus_id || data.campusId || data.univ_id || data.univId || "ui";
          if (campus !== targetCampusId) return;
        }
        manualReferences.push({ id: doc.id, ...data } as DesignReference);
      });
    }

    const normalizeManualReferenceSafe = (ref: DesignReference): ReferenceListItem | null => {
      try {
        if (!ref || !ref.id) return null;

        let eventName = safeString(ref.event_name);
        const scope = safeString(ref.scope);
        const divId = ref.division_id ? safeString(ref.division_id) : "humas_media_kreatif";
        
        if (scope === "divisi") {
          const divName = divisionsMap.get(divId) || "Humas & Media Kreatif";
          eventName = `Divisi: ${divName}`;
        } else if (scope === "acara" && ref.event_id) {
          const evName = eventsMap.get(safeString(ref.event_id));
          eventName = evName ? `Acara: ${evName}` : (eventName || "Jobdesk Acara");
        } else if (scope === "acara" && eventName) {
          eventName = eventName.startsWith("Acara:") ? eventName : `Acara: ${eventName}`;
        } else if (scope === "divisi" && eventName) {
          eventName = eventName.startsWith("Divisi:") ? eventName : `Divisi: ${eventName}`;
        } else if (!eventName) {
          eventName = "-";
        }

        return {
          id: ref.id,
          source_type: "manual_reference",
          title: safeString(ref.title) || "Referensi Tanpa Judul",
          event_name: eventName,
          year: ref.year ? safeString(ref.year) : "-",
          scope: scope || "divisi",
          visual_type: safeString(ref.design_type) || "Lainnya",
          category_label: safeString(ref.category) || "Lainnya",
          thumbnail_url: safeString(ref.thumbnail_url),
          file_url: safeString(ref.drive_url),
          source_link: safeString(ref.canva_links?.[0] || ref.drive_links?.[0] || ""),
          source_link_type: ref.canva_links?.length ? "canva" : "other",
          notes: safeString(ref.notes || ref.style_notes),
          status: ref.is_archived ? "archived" : "active",
          created_at: ref.created_at,
          updated_at: ref.updated_at,
          event_id: ref.event_id ? safeString(ref.event_id) : undefined,
          division_id: divId,
          color_palette: safeArray(ref.color_palette),
          file_inventory: safeArray(ref.file_inventory).map((item) => {
            const i = item as { name?: string; url?: string; type?: string; mime_type?: string } | null | undefined;
            return {
              name: safeString(i?.name || ""),
              url: safeString(i?.url || ""),
              type: (i?.type === "folder" ? "folder" : "file") as "file" | "folder",
              mime_type: safeString(i?.mime_type || ""),
            };
          }),
          file_inventory_notes: safeString(ref.file_inventory_notes),
          created_by: safeString(ref.created_by),
        };
      } catch (err) {
        console.warn("[api/references] skipped bad reference item", { id: ref?.id, sourceType: "manual_reference", reason: err });
        return null;
      }
    };

    const normalizedManual = manualReferences
      .map(normalizeManualReferenceSafe)
      .filter((item): item is ReferenceListItem => item !== null);

    // 3. Map approved tasks safely
    const approvedTasks: Task[] = [];
    if (tasksSnap) {
      tasksSnap.forEach((doc) => {
        const data = doc.data() as Record<string, unknown>;
        if (targetOrgId) {
          const org = data.organization_id || data.org_id || data.orgId || "main_org";
          if (org !== targetOrgId) return;
        }
        if (targetCampusId) {
          const campus = data.campus_id || data.campusId || data.univ_id || data.univId || "ui";
          if (campus !== targetCampusId) return;
        }
        approvedTasks.push({ id: doc.id, ...data } as Task);
      });
    }

    // Fetch uploads subcollection in parallel for tasks (with individual try-catch blocks)
    const tasksWithUploads = await Promise.all(
      approvedTasks.map(async (task) => {
        const uploads: TaskUpload[] = [];
        try {
          const uploadsSnap = await db
            .collection("tasks")
            .doc(task.id)
            .collection("uploads")
            .orderBy("version_number", "desc")
            .get();

          uploadsSnap.forEach((doc) => {
            uploads.push({ id: doc.id, ...doc.data() } as TaskUpload);
          });
        } catch (err) {
          console.warn(`[api/references] Failed to fetch uploads for task ${task.id}`, err);
        }
        return { task, uploads };
      })
    );

    const normalizeApprovedTaskReferenceSafe = (task: Task, uploads: TaskUpload[]): ReferenceListItem | null => {
      try {
        if (!task || !task.id) return null;

        if (!isTaskReferenceEligible(task, uploads.length)) {
          return null;
        }

        // Check sensitivity
        if (task.data_sensitivity === "sensitive") {
          const hasAccess =
            profile.role === "super_admin" ||
            profile.role === "koordinator_divisi" ||
            task.pic_id === profile.id ||
            task.coordinator_id === profile.id;
          if (!hasAccess) return null;
        }

        const finalUpload = uploads.find((u) => u.is_final_candidate) || uploads[0];

        // Determine year
        let taskYear: number = new Date().getFullYear();
        if (task.deadline) {
          const deadline = task.deadline as { toDate?: () => Date } | Date | string | number;
          try {
            const d =
              typeof deadline === "object" &&
              deadline &&
              "toDate" in deadline &&
              typeof deadline.toDate === "function"
                ? deadline.toDate()
                : new Date(deadline as string | number | Date);
            if (!isNaN(d.getTime())) {
              taskYear = d.getFullYear();
            }
          } catch {
            // ignore
          }
        }

        const visualType = mapTaskSubcategoryToDesignType(task.subcategory_key);
        const fileUrl = safeString(finalUpload?.upload_url || task.result_design_url || "");
        const thumbnail_url =
          safeString(finalUpload?.thumbnail_url) ||
          (fileUrl && fileUrl.match(/\.(jpeg|jpg|gif|png|webp)/i) ? fileUrl : "");
        const sourceLink = safeString(finalUpload?.source_link || task.source_link || "");
        const sourceLinkType =
          safeString(finalUpload?.source_link_type) ||
          (sourceLink.includes("canva.com") ? "canva" : "other");

        // Event Name dengan prefix dan fallback
        let eventName: string;
        if (task.type === "acara") {
          if (task.event_id) {
            const evName = eventsMap.get(task.event_id);
            eventName = evName ? `Acara: ${evName}` : "Acara: Tidak ditemukan";
          } else {
            eventName = "Acara: Tidak ditemukan";
          }
        } else if (task.type === "divisi") {
          const divId = task.division_id || "humas_media_kreatif";
          const divName = divisionsMap.get(divId) || "Humas & Media Kreatif";
          eventName = `Divisi: ${divName}`;
        } else {
          eventName = "-";
        }

        return {
          id: `task_${task.id}`,
          source_type: "approved_task" as const,
          title: safeString(task.name) || "Jobdesk Tanpa Judul",
          event_name: eventName,
          year: taskYear,
          scope: safeString(task.type) || "divisi",
          visual_type: visualType,
          category_label: safeString(task.category_label || task.category_key),
          subcategory_label: safeString(task.subcategory_label || task.subcategory_key),
          thumbnail_url,
          file_url: fileUrl,
          source_link: sourceLink,
          source_link_type: sourceLinkType,
          notes: safeString(finalUpload?.upload_note || task.description || ""),
          status: task.is_archived ? "archived" : "active",
          created_at: task.created_at,
          updated_at: task.approved_at || task.updated_at,
          task_id: task.id,
          event_id: task.event_id ? safeString(task.event_id) : undefined,
          division_id: task.division_id || "humas_media_kreatif",
          color_palette: safeArray(task.color_palette),
          file_inventory: uploads.map((u) => ({
            name: safeString(u.file_name) || `Hasil pengerjaan - v${u.version_number}`,
            url: safeString(u.upload_url || u.source_link || ""),
            type: "file" as const,
            mime_type: safeString(u.file_type || ""),
          })),
          file_inventory_notes: safeString(finalUpload?.upload_note || ""),
          created_by: safeString(task.pic_id || task.created_by || ""),
        };
      } catch (err) {
        console.warn("[api/references] skipped bad reference item", { id: task?.id, sourceType: "approved_task", reason: err });
        return null;
      }
    };

    const filteredTaskReferences = tasksWithUploads
      .map(({ task, uploads }) => normalizeApprovedTaskReferenceSafe(task, uploads))
      .filter((item): item is ReferenceListItem => item !== null);

    // 4. Combine and Sort
    const combined = [...normalizedManual, ...filteredTaskReferences];
    combined.sort((a, b) => {
      const yearA = typeof a.year === "number" ? a.year : parseInt(String(a.year || "0")) || 0;
      const yearB = typeof b.year === "number" ? b.year : parseInt(String(b.year || "0")) || 0;
      if (yearB !== yearA) {
        return yearB - yearA;
      }
      return (a.title || "").localeCompare(b.title || "");
    });

    return NextResponse.json({ references: combined });
  } catch (error) {
    console.error("[api/references] Failed to load references", {
      message: error instanceof Error ? error.message : String(error),
      stack: process.env.NODE_ENV === "development" && error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      {
        error: "references_api_failed",
        message: "Gagal memuat referensi dari server.",
      },
      { status: 500 }
    );
  }
}
