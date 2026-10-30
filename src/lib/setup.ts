import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import {
  defaultDivision,
  DEFAULT_DIVISION_ID,
  DEFAULT_ORMAWA_ID,
} from "@/lib/seed-data";
import { DUMMY_ORMAWAS } from "@/lib/workspace-dummy-data";

export type InitialSetupStatus = {
  ormawaExists: boolean;
  divisionExists: boolean;
  // Alias untuk kompatibilitas ke belakang
  organizationExists: boolean;
};

export async function getInitialSetupStatus(): Promise<InitialSetupStatus> {
  const [ormawaSnapshot, divisionSnapshot] = await Promise.all([
    getDoc(doc(db, "ormawas", DEFAULT_ORMAWA_ID)),
    getDoc(doc(db, "divisions", DEFAULT_DIVISION_ID)),
  ]);

  let ormawaExists = ormawaSnapshot.exists();
  if (!ormawaExists) {
    const ormawasListSnap = await getDocs(query(collection(db, "ormawas"), limit(1)));
    ormawaExists = !ormawasListSnap.empty;
  }

  let divisionExists = divisionSnapshot.exists();
  if (!divisionExists) {
    const divisionsListSnap = await getDocs(query(collection(db, "divisions"), limit(1)));
    divisionExists = !divisionsListSnap.empty;
  }

  return {
    ormawaExists,
    divisionExists,
    organizationExists: ormawaExists,
  };
}

export async function ensureInitialData() {
  const status = await getInitialSetupStatus();

  const operations: Array<Promise<void>> = [];

  if (!status.ormawaExists) {
    const defaultOrmawaData = DUMMY_ORMAWAS[0] || {
      id: DEFAULT_ORMAWA_ID,
      campus_id: "univ-undiksha",
      name: "Forum Komunikasi KIP-Kuliah Undiksha",
      short_name: "Forkom KIP Undiksha",
      type: "UKM",
      workspace_type: "ormawa",
      description: "Organisasi kemahasiswaan penerima KIP-Kuliah di lingkungan Universitas Pendidikan Ganesha.",
      is_active: true,
    };

    operations.push(
      setDoc(doc(db, "ormawas", DEFAULT_ORMAWA_ID), {
        ...defaultOrmawaData,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      }),
    );
  }

  if (!status.divisionExists) {
    operations.push(
      setDoc(doc(db, "divisions", DEFAULT_DIVISION_ID), {
        ...defaultDivision,
        organization_id: DEFAULT_ORMAWA_ID,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      }),
    );
  }

  await Promise.all(operations);

  return getInitialSetupStatus();
}
