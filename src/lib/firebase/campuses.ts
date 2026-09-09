import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { DUMMY_CAMPUSES } from "@/lib/workspace-dummy-data";
import { buildCampusDoc, validateCampusInput } from "@/lib/workspace-schema";
import type { Campus, CampusInput } from "@/types/workspace";

const CAMPUSES_COLLECTION = "campuses";

/**
 * Mengambil seluruh daftar kampus yang terdaftar dan aktif.
 * Jika Firestore belum memiliki data (misal saat inisialisasi awal), fallback ke data kampus terverifikasi.
 */
export async function getCampuses(): Promise<Campus[]> {
  try {
    const snap = await getDocs(collection(db, CAMPUSES_COLLECTION));
    if (!snap.empty) {
      const items: Campus[] = [];
      snap.forEach((docSnap) => {
        const data = docSnap.data() as Campus;
        items.push({
          ...data,
          id: docSnap.id,
        });
      });
      return items.sort((a, b) => a.name.localeCompare(b.name));
    }
  } catch (error) {
    console.warn("Gagal mengambil data kampus dari Firestore, menggunakan fallback:", error);
  }

  // Fallback ke data bawaan sistem
  return DUMMY_CAMPUSES;
}

/**
 * Mengambil detail kampus berdasarkan ID.
 */
export async function getCampusById(campusId: string): Promise<Campus | null> {
  if (!campusId) return null;

  try {
    const ref = doc(db, CAMPUSES_COLLECTION, campusId);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      return {
        ...(snap.data() as Campus),
        id: snap.id,
      };
    }
  } catch (error) {
    console.warn(`Gagal mengambil detail kampus ${campusId} dari Firestore:`, error);
  }

  const fallback = DUMMY_CAMPUSES.find((c) => c.id === campusId);
  return fallback || null;
}

/**
 * Mendaftarkan kampus baru ke Firestore.
 */
export async function createCampus(
  input: CampusInput,
  customId?: string
): Promise<Campus> {
  const validation = validateCampusInput(input);
  if (!validation.valid || !validation.data) {
    throw new Error(validation.errors.join(", "));
  }

  const cleanData = validation.data;
  const id = customId || `univ-${cleanData.code.toLowerCase().replace(/[^a-z0-9]/g, "")}-${Date.now().toString(36)}`;
  const campusDoc = buildCampusDoc(cleanData, id);

  const docRef = doc(db, CAMPUSES_COLLECTION, id);
  await setDoc(docRef, {
    ...campusDoc,
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  });

  return {
    ...campusDoc,
    created_at: new Date(),
    updated_at: new Date(),
  };
}

/**
 * Memperbarui data kampus yang sudah ada.
 */
export async function updateCampus(
  campusId: string,
  updates: Partial<CampusInput>
): Promise<void> {
  if (!campusId) throw new Error("ID kampus wajib diisi.");

  const docRef = doc(db, CAMPUSES_COLLECTION, campusId);
  await updateDoc(docRef, {
    ...updates,
    updated_at: serverTimestamp(),
  });
}
