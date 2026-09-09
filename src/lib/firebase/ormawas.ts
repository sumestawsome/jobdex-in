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
import { DUMMY_ORMAWAS } from "@/lib/workspace-dummy-data";
import { buildOrmawaDoc, validateOrmawaInput } from "@/lib/workspace-schema";
import type { Ormawa, OrmawaInput } from "@/types/workspace";

const ORMAWAS_COLLECTION = "ormawas";

/**
 * Mengambil daftar ormawa, dapat difilter berdasarkan campusId / univId.
 * Fallback ke data bawaan sistem bila Firestore belum memiliki record ormawa.
 */
export async function getOrmawas(campusId?: string): Promise<Ormawa[]> {
  try {
    const collRef = collection(db, ORMAWAS_COLLECTION);
    const q = campusId
      ? query(collRef, where("campus_id", "==", campusId))
      : collRef;

    const snap = await getDocs(q);
    if (!snap.empty) {
      const items: Ormawa[] = [];
      snap.forEach((docSnap) => {
        const data = docSnap.data() as Ormawa;
        items.push({
          ...data,
          id: docSnap.id,
        });
      });
      return items.sort((a, b) => a.name.localeCompare(b.name));
    }
  } catch (error) {
    console.warn("Gagal mengambil data ormawa dari Firestore, menggunakan fallback:", error);
  }

  // Fallback ke data bawaan
  if (campusId) {
    return DUMMY_ORMAWAS.filter((o) => o.campus_id === campusId);
  }
  return DUMMY_ORMAWAS;
}

/**
 * Mengambil detail satu ormawa berdasarkan ID.
 */
export async function getOrmawaById(ormawaId: string): Promise<Ormawa | null> {
  if (!ormawaId) return null;

  try {
    const ref = doc(db, ORMAWAS_COLLECTION, ormawaId);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      return {
        ...(snap.data() as Ormawa),
        id: snap.id,
      };
    }
  } catch (error) {
    console.warn(`Gagal mengambil detail ormawa ${ormawaId} dari Firestore:`, error);
  }

  const fallback = DUMMY_ORMAWAS.find((o) => o.id === ormawaId);
  return fallback || null;
}

/**
 * Mendaftarkan ormawa baru ke Firestore.
 */
export async function createOrmawa(
  input: OrmawaInput,
  customId?: string
): Promise<Ormawa> {
  const validation = validateOrmawaInput(input);
  if (!validation.valid || !validation.data) {
    throw new Error(validation.errors.join(", "));
  }

  const cleanData = validation.data;
  const id = customId || `org-${cleanData.short_name.toLowerCase().replace(/[^a-z0-9]/g, "")}-${Date.now().toString(36)}`;
  const ormawaDoc = buildOrmawaDoc(cleanData, id);

  const docRef = doc(db, ORMAWAS_COLLECTION, id);
  await setDoc(docRef, {
    ...ormawaDoc,
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  });

  return {
    ...ormawaDoc,
    created_at: new Date(),
    updated_at: new Date(),
  };
}

/**
 * Memperbarui data ormawa.
 */
export async function updateOrmawa(
  ormawaId: string,
  updates: Partial<OrmawaInput>
): Promise<void> {
  if (!ormawaId) throw new Error("ID ormawa wajib diisi.");

  const docRef = doc(db, ORMAWAS_COLLECTION, ormawaId);
  await updateDoc(docRef, {
    ...updates,
    updated_at: serverTimestamp(),
  });
}
