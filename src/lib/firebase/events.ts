import {
  Timestamp,
  addDoc,
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { DEFAULT_ORGANIZATION_ID, DEFAULT_DIVISION_ID } from "@/lib/seed-data";
import { isKoordinatorDivisi, isSuperAdmin } from "@/lib/permissions";
import type { Event, EventInput, EventStatus, ReferenceLink, UserProfile } from "@/types";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object") {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

export function removeUndefinedDeep<T>(value: T): T {
  if (Array.isArray(value)) {
    return value
      .filter((item) => item !== undefined)
      .map((item) => removeUndefinedDeep(item)) as T;
  }

  if (isPlainObject(value)) {
    return Object.entries(value).reduce<Record<string, unknown>>(
      (cleaned, [key, item]) => {
        if (item !== undefined) {
          cleaned[key] = removeUndefinedDeep(item);
        }
        return cleaned;
      },
      {},
    ) as T;
  }

  return value;
}

export function findUndefinedPaths(value: unknown, prefix = ""): string[] {
  if (value === undefined) {
    return [prefix || "(root)"];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item, index) =>
      findUndefinedPaths(item, `${prefix}[${index}]`),
    );
  }

  if (isPlainObject(value)) {
    return Object.entries(value).flatMap(([key, item]) =>
      findUndefinedPaths(item, prefix ? `${prefix}.${key}` : key),
    );
  }

  return [];
}

function sanitizeEventPayload<T>(payload: T, operation: string): T {
  if (process.env.NODE_ENV !== "production") {
    const undefinedPaths = findUndefinedPaths(payload);
    if (undefinedPaths.length > 0) {
      console.warn(
        `[events] Undefined fields removed before ${operation}`,
        undefinedPaths,
      );
    }
  }

  return removeUndefinedDeep(payload);
}

function eventDateToTimestamp(value: string) {
  return Timestamp.fromDate(new Date(`${value}T00:00:00`));
}

export async function getEventsForProfile(
  profile: UserProfile,
  workspaceFilter?: { org_id?: string; campus_id?: string }
) {
  const eventsRef = collection(db, "events");
  const targetOrgId = workspaceFilter?.org_id || profile.organization_id || profile.org_id;
  const targetCampusId = workspaceFilter?.campus_id || profile.campus_id || profile.univ_id;

  const filterByWorkspace = (list: Event[]): Event[] => {
    if (!targetOrgId && !targetCampusId) return list;
    return list.filter((event) => {
      // Filter organisasi / ormawa
      if (targetOrgId) {
        const eventOrg =
          event.organization_id ||
          event.org_id ||
          (event as unknown as Record<string, unknown>).orgId ||
          DEFAULT_ORGANIZATION_ID;
        if (eventOrg !== targetOrgId) return false;
      }

      // Filter kampus
      if (targetCampusId) {
        const eventCampus =
          event.campus_id ||
          (event as unknown as Record<string, unknown>).campusId ||
          event.univ_id ||
          (event as unknown as Record<string, unknown>).univId ||
          "ui";
        if (eventCampus !== targetCampusId) return false;
      }

      return true;
    });
  };

  // For admins and division coordinators, query all events
  if (isSuperAdmin(profile) || isKoordinatorDivisi(profile)) {
    const snapshot = await getDocs(query(eventsRef, orderBy("event_date", "asc")));
    const events = snapshot.docs.map((item) => ({
      id: item.id,
      ...item.data(),
    })) as Event[];

    const filtered = filterByWorkspace(events);

    return filtered.sort((a, b) => {
      const aDate = a.event_date ? getDateMillis(a.event_date) : (a.created_at ? getDateMillis(a.created_at) : (a.updated_at ? getDateMillis(a.updated_at) : 0));
      const bDate = b.event_date ? getDateMillis(b.event_date) : (b.created_at ? getDateMillis(b.created_at) : (b.updated_at ? getDateMillis(b.updated_at) : 0));
      return bDate - aDate;
    });
  }

  // For members (anggota) and event-specific staff, query via collectionGroup
  try {
    const membershipsSnapshot = await getDocs(
      query(
        collectionGroup(db, "event_members"),
        where("user_id", "==", profile.id)
      )
    );
    const eventIds = [...new Set(membershipsSnapshot.docs.map((doc) => doc.data().event_id as string).filter(Boolean))];
    
    // Also include events where coordinator_id matches profile.id
    const coordSnap = await getDocs(query(eventsRef, where("coordinator_id", "==", profile.id)));
    coordSnap.docs.forEach((doc) => {
      eventIds.push(doc.id);
    });

    const uniqueEventIds = [...new Set(eventIds)];

    if (uniqueEventIds.length === 0) {
      return [];
    }

    const eventSnaps = await Promise.all(
      uniqueEventIds.map((id) => getDoc(doc(db, "events", id)))
    );

    const events = eventSnaps
      .filter((snap) => snap.exists())
      .map((snap) => ({
        id: snap.id,
        ...snap.data(),
      })) as Event[];

    const filtered = filterByWorkspace(events);

    return filtered.sort((a, b) => {
      const aDate = a.event_date ? getDateMillis(a.event_date) : (a.created_at ? getDateMillis(a.created_at) : (a.updated_at ? getDateMillis(a.updated_at) : 0));
      const bDate = b.event_date ? getDateMillis(b.event_date) : (b.created_at ? getDateMillis(b.created_at) : (b.updated_at ? getDateMillis(b.updated_at) : 0));
      return bDate - aDate;
    });
  } catch (err) {
    console.error("[events] Failed to fetch events for profile:", err);
    return [];
  }
}

export async function getEventById(
  eventId: string,
  workspaceFilter?: { org_id?: string; campus_id?: string }
) {
  const snapshot = await getDoc(doc(db, "events", eventId));

  if (!snapshot.exists()) {
    return null;
  }

  const event = {
    id: snapshot.id,
    ...snapshot.data(),
  } as Event;

  if (workspaceFilter?.org_id) {
    const eventOrg =
      event.organization_id ||
      event.org_id ||
      (event as unknown as Record<string, unknown>).orgId ||
      DEFAULT_ORGANIZATION_ID;
    if (eventOrg !== workspaceFilter.org_id) {
      return null;
    }
  }

  if (workspaceFilter?.campus_id) {
    const eventCampus =
      event.campus_id ||
      (event as unknown as Record<string, unknown>).campusId ||
      event.univ_id ||
      (event as unknown as Record<string, unknown>).univId ||
      "ui";
    if (eventCampus !== workspaceFilter.campus_id) {
      return null;
    }
  }

  return event;
}

export async function createEvent(input: EventInput, createdBy: string) {
  let orgId = input.organization_id || input.org_id || input.orgId;
  let campusId = input.campus_id || input.univ_id || input.univId || input.campusId || "";

  // Otomatis isi univId dan orgId dari profil pembuat jika belum terisi
  if ((!orgId || !campusId) && createdBy) {
    try {
      const userSnap = await getDoc(doc(db, "users", createdBy));
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
    throw new Error("Ruang kerja aktif (organisasi / ormawa) wajib dipilih sebelum membuat acara.");
  }

  const rawPayload = {
    organization_id: orgId,
    org_id: orgId,
    orgId: orgId,
    campus_id: campusId,
    univ_id: campusId,
    univId: campusId,
    division_id: input.division_id || DEFAULT_DIVISION_ID,
    name: input.name,
    description: input.description,
    event_date: eventDateToTimestamp(input.event_date),
    coordinator_id: input.coordinator_id,
    status: input.status,
    progress_percentage: 0,
    whatsapp_group_id: input.whatsapp_group_id || "",
    whatsapp_group_name: input.whatsapp_group_name || "",
    whatsapp_group_verified: false,
    whatsapp_group_updated_at: serverTimestamp(),
    whatsapp_group_updated_by: createdBy,
    // Fase 26A: Event Design Kit
    design_kit_color_palette: input.design_kit_color_palette || [],
    design_kit_visual_direction: input.design_kit_visual_direction || "",
    design_kit_supergraphic_notes: input.design_kit_supergraphic_notes || "",
    design_kit_redaction_links: input.design_kit_redaction_links || [],
    design_kit_design_reference_links: input.design_kit_design_reference_links || [],
    design_kit_drive_reference_links: input.design_kit_drive_reference_links || [],
    design_kit_previous_event_refs: input.design_kit_previous_event_refs || [],
    design_kit_notes_for_team: input.design_kit_notes_for_team || "",
    created_by: createdBy,
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  };
  const payload = sanitizeEventPayload(rawPayload, "create");
  const eventRef = await addDoc(collection(db, "events"), payload);

  return eventRef.id;
}

export async function updateEvent(
  eventId: string,
  input: EventInput,
  updatedBy?: string,
  workspaceFilter?: { org_id?: string; campus_id?: string }
) {
  const eventRef = doc(db, "events", eventId);
  const eventSnap = await getDoc(eventRef);
  const existingData = eventSnap.exists() ? (eventSnap.data() as Event) : null;

  if (existingData) {
    const existingOrg =
      existingData.organization_id ||
      existingData.org_id ||
      (existingData as unknown as Record<string, unknown>).orgId;
    const existingCampus =
      existingData.campus_id ||
      existingData.univ_id ||
      (existingData as unknown as Record<string, unknown>).univId ||
      (existingData as unknown as Record<string, unknown>).campusId;

    if (workspaceFilter?.org_id && existingOrg && workspaceFilter.org_id !== existingOrg) {
      throw new Error("Akses ditolak: Tidak dapat memodifikasi acara milik organisasi/ormawa lain.");
    }
    if (workspaceFilter?.campus_id && existingCampus && workspaceFilter.campus_id !== existingCampus) {
      throw new Error("Akses ditolak: Tidak dapat memodifikasi acara milik kampus lain.");
    }

    const inputOrg = input.organization_id || input.org_id || input.orgId;
    if (inputOrg && existingOrg && inputOrg !== existingOrg) {
      throw new Error("Dilarang mengubah penanda kepemilikan ormawa/organisasi pada pembaruan acara.");
    }

    const inputCampus = input.campus_id || input.univ_id || input.univId || input.campusId;
    if (inputCampus && existingCampus && inputCampus !== existingCampus) {
      throw new Error("Dilarang mengubah penanda kepemilikan kampus pada pembaruan acara.");
    }
  }

  const updateData: Record<string, unknown> = {
    name: input.name,
    description: input.description,
    event_date: eventDateToTimestamp(input.event_date),
    coordinator_id: input.coordinator_id,
    status: input.status,
    division_id: input.division_id ?? existingData?.division_id ?? DEFAULT_DIVISION_ID,
    // Pertahankan penanda kepemilikan awal yang tidak boleh diubah
    ...(existingData?.organization_id ? { organization_id: existingData.organization_id } : {}),
    ...(existingData?.org_id ? { org_id: existingData.org_id } : {}),
    ...(existingData?.orgId ? { orgId: existingData.orgId } : {}),
    ...(existingData?.campus_id ? { campus_id: existingData.campus_id } : {}),
    ...(existingData?.campusId ? { campusId: existingData.campusId } : {}),
    ...(existingData?.univ_id ? { univ_id: existingData.univ_id } : {}),
    ...(existingData?.univId ? { univId: existingData.univId } : {}),
    updated_at: serverTimestamp(),
    // Fase 26A: Event Design Kit
    design_kit_color_palette: input.design_kit_color_palette ?? [],
    design_kit_visual_direction: input.design_kit_visual_direction ?? "",
    design_kit_supergraphic_notes: input.design_kit_supergraphic_notes ?? "",
    design_kit_redaction_links: input.design_kit_redaction_links ?? [],
    design_kit_design_reference_links: input.design_kit_design_reference_links ?? [],
    design_kit_drive_reference_links: input.design_kit_drive_reference_links ?? [],
    design_kit_previous_event_refs: input.design_kit_previous_event_refs ?? [],
    design_kit_notes_for_team: input.design_kit_notes_for_team ?? "",
  };

  if (input.whatsapp_group_id !== undefined) {
    const newGroupId = input.whatsapp_group_id;
    const newGroupName = input.whatsapp_group_name || "";
    const oldGroupId = existingData?.whatsapp_group_id || "";
    const isGroupIdChanged = oldGroupId !== newGroupId;

    updateData.whatsapp_group_id = newGroupId;
    updateData.whatsapp_group_name = newGroupName;

    if (isGroupIdChanged) {
      updateData.whatsapp_group_verified = false;
      updateData.whatsapp_group_updated_at = serverTimestamp();
      if (updatedBy) {
        updateData.whatsapp_group_updated_by = updatedBy;
      }
    }
  }

  const payload = sanitizeEventPayload(updateData, "update");
  await updateDoc(eventRef, payload);
}

export async function updateEventStatus(
  eventId: string,
  status: EventStatus,
) {
  const payload = sanitizeEventPayload({
    status,
    updated_at: serverTimestamp(),
  }, "status update");
  await updateDoc(doc(db, "events", eventId), payload);
}

export async function updateEventDesignKit(
  eventId: string,
  kit: {
    color_palette?: string[];
    visual_direction?: string;
    supergraphic_notes?: string;
    redaction_links?: ReferenceLink[];
    design_reference_links?: ReferenceLink[];
    drive_reference_links?: ReferenceLink[];
    previous_event_refs?: string[];
    notes_for_team?: string;
  },
) {
  const rawPayload = {
    design_kit_color_palette: kit.color_palette ?? [],
    design_kit_visual_direction: kit.visual_direction ?? "",
    design_kit_supergraphic_notes: kit.supergraphic_notes ?? "",
    design_kit_redaction_links: kit.redaction_links ?? [],
    design_kit_design_reference_links: kit.design_reference_links ?? [],
    design_kit_drive_reference_links: kit.drive_reference_links ?? [],
    design_kit_previous_event_refs: kit.previous_event_refs ?? [],
    design_kit_notes_for_team: kit.notes_for_team ?? "",
    updated_at: serverTimestamp(),
  };
  const payload = sanitizeEventPayload(rawPayload, "design kit update");
  await updateDoc(doc(db, "events", eventId), payload);
}

export function getDateInputValue(value: unknown) {
  if (!value || typeof value !== "object" || !("toDate" in value)) {
    return "";
  }

  const date = (value as { toDate: () => Date }).toDate();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatEventDate(value: unknown) {
  if (!value || typeof value !== "object" || !("toDate" in value)) {
    return "-";
  }

  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "long",
  }).format((value as { toDate: () => Date }).toDate());
}

function getDateMillis(value: unknown) {
  if (!value || typeof value !== "object" || !("toDate" in value)) {
    return 0;
  }

  return (value as { toDate: () => Date }).toDate().getTime();
}
