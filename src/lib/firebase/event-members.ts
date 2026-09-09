import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type { EventMember } from "@/types";

export async function getEventMembers(eventId: string) {
  const snapshot = await getDocs(collection(db, "events", eventId, "event_members"));

  return snapshot.docs.map((item) => ({
    id: item.id,
    ...item.data(),
  })) as EventMember[];
}

export async function addEventMember({
  eventId,
  userId,
  roleInEvent,
  addedBy,
  organization_id,
  org_id,
  orgId,
  campus_id,
  campusId,
  univ_id,
  univId,
}: {
  eventId: string;
  userId: string;
  roleInEvent: string;
  addedBy: string;
  organization_id?: string;
  org_id?: string;
  orgId?: string;
  campus_id?: string;
  campusId?: string;
  univ_id?: string;
  univId?: string;
}) {
  let targetOrgId = orgId || org_id || organization_id;
  let targetCampusId = univId || univ_id || campusId || campus_id;

  if (!targetOrgId || !targetCampusId) {
    try {
      const eventSnap = await getDoc(doc(db, "events", eventId));
      if (eventSnap.exists()) {
        const evData = eventSnap.data() as Record<string, unknown>;
        targetOrgId = targetOrgId || (evData.orgId as string) || (evData.org_id as string) || (evData.organization_id as string);
        targetCampusId = targetCampusId || (evData.univId as string) || (evData.univ_id as string) || (evData.campusId as string) || (evData.campus_id as string);
      }
    } catch {
      // ignore
    }
  }

  await setDoc(doc(db, "events", eventId, "event_members", userId), {
    id: userId,
    event_id: eventId,
    user_id: userId,
    organization_id: targetOrgId || "",
    org_id: targetOrgId || "",
    orgId: targetOrgId || "",
    campus_id: targetCampusId || "",
    campusId: targetCampusId || "",
    univ_id: targetCampusId || "",
    univId: targetCampusId || "",
    role_in_event: roleInEvent,
    added_by: addedBy,
    added_at: serverTimestamp(),
  });
}

export async function removeEventMember(eventId: string, userId: string) {
  await deleteDoc(doc(db, "events", eventId, "event_members", userId));
}

export async function updateEventMemberRole(eventId: string, userId: string, roleInEvent: string) {
  const ref = doc(db, "events", eventId, "event_members", userId);
  await updateDoc(ref, {
    role_in_event: roleInEvent,
  });
}

