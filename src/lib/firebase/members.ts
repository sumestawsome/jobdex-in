import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase/client";
import { USER_ROLES } from "@/lib/roles";
import { DEFAULT_DIVISION_ID } from "@/lib/seed-data";
import type {
  MemberUpdateInput,
  UserProfile,
  UserRole,
  UserOrmawaMembership,
} from "@/types";

const ORMAWA_MEMBERS_COLLECTION = "ormawa_members";

/**
 * Mengambil daftar anggota/pengguna dengan filter skop tenant.
 * Jika organizationId diberikan, hanya mengambil anggota yang terikat pada ormawa tersebut.
 */
export async function getMembers(organizationId?: string, campusId?: string): Promise<UserProfile[]> {
  const usersRef = collection(db, "users");
  let snapshot;

  if (organizationId) {
    try {
      if (campusId) {
        snapshot = await getDocs(query(usersRef, where("organization_id", "==", organizationId), where("campus_id", "==", campusId)));
      } else {
        snapshot = await getDocs(query(usersRef, where("organization_id", "==", organizationId)));
      }
    } catch {
      snapshot = await getDocs(query(usersRef, where("organization_id", "==", organizationId)));
    }
  } else {
    snapshot = await getDocs(query(usersRef, orderBy("name", "asc")));
  }

  let results = snapshot.docs.map((item) => item.data() as UserProfile);

  if (organizationId) {
    results = results.filter((item) => {
      const itemOrg = item.orgId || item.org_id || item.organization_id;
      return itemOrg === organizationId;
    });
  }

  if (campusId) {
    results = results.filter((item) => {
      const itemCampus = item.univId || item.campusId || item.campus_id || item.univ_id;
      return !itemCampus || itemCampus === campusId;
    });
  }

  return results.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
}

/**
 * Mengambil daftar anggota spesifik berdasarkan ormawaId dan kampusId.
 */
export async function getMembersByOrmawa(
  ormawaId: string,
  campusId?: string
): Promise<UserProfile[]> {
  if (!ormawaId) return [];

  // Cari dari koleksi users yang memiliki organization_id == ormawaId
  const usersRef = collection(db, "users");
  const constraints = [where("organization_id", "==", ormawaId)];
  if (campusId) {
    constraints.push(where("campus_id", "==", campusId));
  }

  try {
    const q = query(usersRef, ...constraints);
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      return snapshot.docs
        .map((docSnap) => docSnap.data() as UserProfile)
        .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    }
  } catch (error) {
    console.warn("Gagal query getMembersByOrmawa:", error);
  }

  // Cek juga lewat relasi tabel ormawa_members
  try {
    const memRef = collection(db, ORMAWA_MEMBERS_COLLECTION);
    const qMem = query(memRef, where("ormawa_id", "==", ormawaId));
    const memSnap = await getDocs(qMem);
    if (!memSnap.empty) {
      const userIds = memSnap.docs.map((d) => (d.data() as UserOrmawaMembership).user_id);
      return getUsersByIds(userIds);
    }
  } catch (error) {
    console.warn("Gagal query ormawa_members:", error);
  }

  return [];
}

/**
 * Mengambil relasi keanggotaan ormawa milik seorang pengguna.
 */
export async function getUserMemberships(
  userId: string
): Promise<UserOrmawaMembership[]> {
  if (!userId) return [];

  try {
    const memRef = collection(db, ORMAWA_MEMBERS_COLLECTION);
    const q = query(memRef, where("user_id", "==", userId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((docSnap) => docSnap.data() as UserOrmawaMembership);
  } catch (error) {
    console.warn(`Gagal mengambil keanggotaan pengguna ${userId}:`, error);
    return [];
  }
}

/**
 * Menambahkan atau memperbarui relasi keanggotaan pengguna ke sebuah ormawa.
 */
export async function assignUserToOrmawa(
  userId: string,
  input: {
    ormawaId: string;
    campusId: string;
    role?: UserRole;
    divisionId?: string;
  }
): Promise<void> {
  if (!userId || !input.ormawaId) {
    throw new Error("userId dan ormawaId wajib diisi.");
  }

  const membershipId = `${userId}_${input.ormawaId}`;
  const membershipRef = doc(db, ORMAWA_MEMBERS_COLLECTION, membershipId);

  const membershipData: UserOrmawaMembership = {
    id: membershipId,
    user_id: userId,
    campus_id: input.campusId,
    campusId: input.campusId,
    univ_id: input.campusId,
    univId: input.campusId,
    ormawa_id: input.ormawaId,
    org_id: input.ormawaId,
    orgId: input.ormawaId,
    role: input.role || USER_ROLES.ANGGOTA,
    division_id: input.divisionId || DEFAULT_DIVISION_ID,
    is_active: true,
    joined_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  };

  // Simpan ke koleksi relasi keanggotaan
  await setDoc(membershipRef, membershipData, { merge: true });

  // Perbarui dokumen profil pengguna agar tersinkronisasi ke ruang kerja aktifnya
  const userRef = doc(db, "users", userId);
  await updateDoc(userRef, {
    organization_id: input.ormawaId,
    org_id: input.ormawaId,
    orgId: input.ormawaId,
    campus_id: input.campusId,
    campusId: input.campusId,
    univ_id: input.campusId,
    univId: input.campusId,
    division_id: input.divisionId || DEFAULT_DIVISION_ID,
    role: input.role || USER_ROLES.ANGGOTA,
    updated_at: serverTimestamp(),
  });
}

/**
 * Melepas relasi keanggotaan pengguna dari ormawa.
 */
export async function removeUserFromOrmawa(
  userId: string,
  ormawaId: string
): Promise<void> {
  const membershipId = `${userId}_${ormawaId}`;
  const membershipRef = doc(db, ORMAWA_MEMBERS_COLLECTION, membershipId);
  await deleteDoc(membershipRef);
}

export async function getUsersByIds(userIds: string[]) {
  const uniqueIds = [...new Set(userIds.filter(Boolean))];
  const snapshots = await Promise.all(
    uniqueIds.map((userId) => getDoc(doc(db, "users", userId))),
  );

  return snapshots
    .filter((snapshot) => snapshot.exists())
    .map((snapshot) => ({
      id: snapshot.id,
      ...snapshot.data(),
    })) as UserProfile[];
}

export async function rotateMemberRole(
  memberId: string,
  newRole: UserRole,
  options?: { divisionId?: string; reason?: string }
): Promise<{ ok: boolean; message: string; from_role?: string; to_role?: string }> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error("Sesi login tidak ditemukan.");
  }

  const token = await currentUser.getIdToken();
  const response = await fetch("/api/auth/rotate-role", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      target_uid: memberId,
      new_role: newRole,
      division_id: options?.divisionId,
      reason: options?.reason,
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Gagal melakukan rotasi peran.");
  }

  return data;
}

export async function updateMember(
  memberId: string,
  input: MemberUpdateInput,
  canUpdateRole: boolean,
) {
  const payload: Record<string, unknown> = {
    name: input.name,
    whatsapp_number: input.whatsapp_number,
    division_id: input.division_id,
    is_active: input.is_active,
    updated_at: serverTimestamp(),
    ...(canUpdateRole ? { role: input.role ?? USER_ROLES.ANGGOTA } : {}),
    ...(input.whatsapp_command_pin !== undefined
      ? { whatsapp_command_pin: input.whatsapp_command_pin }
      : {}),
  };

  await updateDoc(doc(db, "users", memberId), payload);

  // Jika super admin merotasi role, sinkronkan juga custom claims melalui API rotasi peran
  if (canUpdateRole && input.role) {
    try {
      await rotateMemberRole(memberId, input.role, {
        divisionId: input.division_id,
        reason: "Pembaruan anggota dan peran oleh Super Admin",
      });
    } catch (e) {
      console.warn("Sinkronisasi custom claims rotasi peran via background:", e);
    }
  }
}
