import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { USER_ROLES } from "@/lib/roles";
import {
  DEFAULT_DIVISION_ID,
  DEFAULT_ORGANIZATION_ID,
} from "@/lib/seed-data";
import { db } from "@/lib/firebase/client";
import type { NewUserProfileInput, UserProfile } from "@/types";

export async function createUserProfile({
  id,
  name,
  email,
  whatsapp_number,
  organization_id,
  org_id,
  orgId,
  campus_id,
  campusId,
  univ_id,
  univId,
  division_id,
}: NewUserProfileInput) {
  const userRef = doc(db, "users", id);
  const activeOrgId = organization_id || org_id || orgId || DEFAULT_ORGANIZATION_ID;
  const activeCampusId = campus_id || campusId || univ_id || univId || "";
  const activeDivisionId = division_id || DEFAULT_DIVISION_ID;

  await setDoc(userRef, {
    id,
    organization_id: activeOrgId,
    org_id: activeOrgId,
    orgId: activeOrgId,
    campus_id: activeCampusId,
    campusId: activeCampusId,
    univ_id: activeCampusId,
    univId: activeCampusId,
    name,
    email,
    whatsapp_number,
    role: USER_ROLES.ANGGOTA,
    division_id: activeDivisionId,
    avatar_url: "",
    is_active: true,
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  });

  // Sinkronisasi relasi keanggotaan ormawa
  if (activeOrgId) {
    const membershipRef = doc(db, "ormawa_members", `${id}_${activeOrgId}`);
    await setDoc(
      membershipRef,
      {
        id: `${id}_${activeOrgId}`,
        user_id: id,
        ormawa_id: activeOrgId,
        org_id: activeOrgId,
        orgId: activeOrgId,
        campus_id: activeCampusId,
        campusId: activeCampusId,
        univ_id: activeCampusId,
        univId: activeCampusId,
        role: USER_ROLES.ANGGOTA,
        division_id: activeDivisionId,
        is_active: true,
        joined_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      },
      { merge: true }
    );
  }
}

export async function getUserProfileByUid(userId: string) {
  const snapshot = await getDoc(doc(db, "users", userId));

  if (!snapshot.exists()) {
    return null;
  }

  return snapshot.data() as UserProfile;
}

export async function completeUserProfile({
  id,
  name,
  email,
  whatsapp_number,
  organization_id,
  org_id,
  orgId,
  campus_id,
  campusId,
  univ_id,
  univId,
  division_id,
}: NewUserProfileInput) {
  const userRef = doc(db, "users", id);
  const snapshot = await getDoc(userRef);
  const existingData = snapshot.exists() ? (snapshot.data() as UserProfile) : null;
  const existingCreatedAt = existingData?.created_at ?? null;

  const activeOrgId =
    organization_id ||
    org_id ||
    orgId ||
    existingData?.org_id ||
    existingData?.orgId ||
    existingData?.organization_id ||
    DEFAULT_ORGANIZATION_ID;
  const activeCampusId =
    campus_id ||
    campusId ||
    univ_id ||
    univId ||
    existingData?.campus_id ||
    existingData?.campusId ||
    existingData?.univ_id ||
    existingData?.univId ||
    "";
  const activeDivisionId = division_id || existingData?.division_id || DEFAULT_DIVISION_ID;
  const role = existingData?.role || USER_ROLES.ANGGOTA;

  await setDoc(
    userRef,
    {
      id,
      organization_id: activeOrgId,
      org_id: activeOrgId,
      orgId: activeOrgId,
      campus_id: activeCampusId,
      campusId: activeCampusId,
      univ_id: activeCampusId,
      univId: activeCampusId,
      name,
      email,
      whatsapp_number,
      role,
      division_id: activeDivisionId,
      avatar_url: existingData?.avatar_url || "",
      is_active: existingData?.is_active ?? true,
      created_at: existingCreatedAt ?? serverTimestamp(),
      updated_at: serverTimestamp(),
    },
    { merge: true },
  );

  // Sinkronisasi relasi keanggotaan ormawa
  if (activeOrgId) {
    const membershipRef = doc(db, "ormawa_members", `${id}_${activeOrgId}`);
    await setDoc(
      membershipRef,
      {
        id: `${id}_${activeOrgId}`,
        user_id: id,
        ormawa_id: activeOrgId,
        org_id: activeOrgId,
        orgId: activeOrgId,
        campus_id: activeCampusId,
        campusId: activeCampusId,
        univ_id: activeCampusId,
        univId: activeCampusId,
        role,
        division_id: activeDivisionId,
        is_active: true,
        joined_at: existingCreatedAt ?? serverTimestamp(),
        updated_at: serverTimestamp(),
      },
      { merge: true }
    );
  }

  return getUserProfileByUid(id);
}

export async function touchUserProfile(userId: string) {
  await updateDoc(doc(db, "users", userId), {
    updated_at: serverTimestamp(),
  });
}
