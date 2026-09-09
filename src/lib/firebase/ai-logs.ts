import { collection, getDocs, limit, orderBy, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type { AILog } from "@/types";

export async function getRecentAILogs(workspaceFilter?: { org_id?: string; campus_id?: string }) {
  const logsRef = collection(db, "ai_logs");
  let snapshot;

  if (workspaceFilter?.org_id) {
    try {
      snapshot = await getDocs(
        query(
          logsRef,
          where("organization_id", "==", workspaceFilter.org_id),
          orderBy("created_at", "desc"),
          limit(50),
        ),
      );
    } catch {
      snapshot = await getDocs(
        query(logsRef, orderBy("created_at", "desc"), limit(50)),
      );
    }
  } else {
    snapshot = await getDocs(
      query(logsRef, orderBy("created_at", "desc"), limit(50)),
    );
  }

  let items = snapshot.docs.map((item) => ({
    id: item.id,
    ...item.data(),
  })) as AILog[];

  if (workspaceFilter?.org_id) {
    items = items.filter((log) => {
      const logOrg = log.organization_id || log.org_id || log.orgId;
      return !logOrg || logOrg === workspaceFilter.org_id;
    });
  }

  if (workspaceFilter?.campus_id) {
    items = items.filter((log) => {
      const logCampus = log.campus_id || log.campusId || log.univ_id || log.univId;
      return !logCampus || logCampus === workspaceFilter.campus_id;
    });
  }

  return items.reverse();
}
