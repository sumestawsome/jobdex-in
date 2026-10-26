"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import type { Campus, Ormawa, ActiveWorkspace } from "@/types/workspace";
import type { UserProfile } from "@/types";
import { isClassAdmin, getEffectiveWorkspaceRole } from "@/lib/permissions";
import {
  DUMMY_CAMPUSES,
  DUMMY_ORMAWAS,
  DEFAULT_ACTIVE_WORKSPACE,
  getDummyTasksForWorkspace,
  getDummyEventsForWorkspace,
  type DummyWorkspaceTask,
  type DummyWorkspaceEvent,
} from "@/lib/workspace-dummy-data";

const STORAGE_KEY = "jobdex_active_workspace";

/**
 * Helper to identify if active workspace is a class workspace (e.g. ws_ilkom_2024 or type 'kelas')
 */
export function isClassWorkspace(workspace?: ActiveWorkspace | null): boolean {
  if (!workspace) return false;
  const ws = workspace as unknown as Record<string, unknown>;
  const rawType = String(ws.type || workspace.workspace_type || workspace.org_type || "").toLowerCase();
  if (rawType === "kelas") return true;
  return (
    workspace.org_id === "ws_ilkom_2024" ||
    ws.id === "ws_ilkom_2024" ||
    Boolean(workspace.org_id?.startsWith("ws_kelas_")) ||
    Boolean((ws.id as string)?.startsWith("ws_kelas_"))
  );
}

export interface WorkspaceContextType {
  activeWorkspace: ActiveWorkspace;
  isClassWorkspace: boolean;
  activeCampus: Campus;
  activeOrmawa: Ormawa;
  campuses: Campus[];
  ormawas: Ormawa[];
  dummyTasks: DummyWorkspaceTask[];
  dummyEvents: DummyWorkspaceEvent[];
  setActiveWorkspace: (workspace: ActiveWorkspace) => void;
  selectWorkspace: (campusId: string, orgId: string) => boolean;
  getOrmawasByCampus: (campusId: string) => Ormawa[];
  resetWorkspace: () => void;
  isClassAdminUser: (user?: UserProfile | null) => boolean;
  getEffectiveRole: (user?: UserProfile | null) => string;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [activeWorkspace, setActiveWorkspaceState] = useState<ActiveWorkspace>(() => {
    if (typeof window === "undefined") {
      return DEFAULT_ACTIVE_WORKSPACE;
    }
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as ActiveWorkspace;
        const campusExists = DUMMY_CAMPUSES.some((c) => c.id === parsed.campus_id);
        const ormawaObj = DUMMY_ORMAWAS.find((o) => o.id === parsed.org_id);
        if (campusExists && ormawaObj) {
          if (!parsed.authorized_admins && (ormawaObj as unknown as Record<string, unknown>).authorized_admins) {
            parsed.authorized_admins = (ormawaObj as unknown as Record<string, unknown>).authorized_admins as ActiveWorkspace["authorized_admins"];
          }
          return parsed;
        }
      }
    } catch {
      // LocalStorage access failure fallback
    }
    return DEFAULT_ACTIVE_WORKSPACE;
  });

  const setActiveWorkspace = useCallback((workspace: ActiveWorkspace) => {
    setActiveWorkspaceState(workspace);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(workspace));
    } catch {
      // Ignore storage errors
    }
  }, []);

  const selectWorkspace = useCallback((campusId: string, orgId: string): boolean => {
    const campus = DUMMY_CAMPUSES.find((c) => c.id === campusId);
    const ormawa = DUMMY_ORMAWAS.find((o) => o.id === orgId && o.campus_id === campusId);

    if (!campus || !ormawa) return false;

    const newWorkspace: ActiveWorkspace = {
      id: ormawa.id,
      type: ormawa.type,
      campus_id: campus.id,
      campusId: campus.id,
      univ_id: campus.id,
      univId: campus.id,
      campus_name: campus.name,
      campus_code: campus.code,
      org_id: ormawa.id,
      orgId: ormawa.id,
      org_name: ormawa.name,
      org_type: ormawa.type,
      workspace_type: ormawa.workspace_type || (ormawa.type.toLowerCase() === "kelas" ? "kelas" : "ormawa"),
      whatsapp_group_id: ormawa.whatsapp_group_id,
      whatsapp_announcement_group_id: (ormawa as unknown as Record<string, unknown>).whatsapp_announcement_group_id as string | undefined || ormawa.whatsapp_group_id,
      whatsapp_discussion_group_id: (ormawa as unknown as Record<string, unknown>).whatsapp_discussion_group_id as string | undefined,
      authorized_admins: (ormawa as unknown as Record<string, unknown>).authorized_admins as ActiveWorkspace["authorized_admins"],
    };

    setActiveWorkspace(newWorkspace);
    return true;
  }, [setActiveWorkspace]);

  const resetWorkspace = useCallback(() => {
    setActiveWorkspace(DEFAULT_ACTIVE_WORKSPACE);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore
    }
  }, [setActiveWorkspace]);

  const getOrmawasByCampus = useCallback((campusId: string): Ormawa[] => {
    return DUMMY_ORMAWAS.filter((o) => o.campus_id === campusId);
  }, []);

  const activeCampus = useMemo(() => {
    return (
      DUMMY_CAMPUSES.find((c) => c.id === activeWorkspace.campus_id) ||
      DUMMY_CAMPUSES[0]
    );
  }, [activeWorkspace.campus_id]);

  const activeOrmawa = useMemo(() => {
    return (
      DUMMY_ORMAWAS.find((o) => o.id === activeWorkspace.org_id) ||
      DUMMY_ORMAWAS[0]
    );
  }, [activeWorkspace.org_id]);

  const dummyTasks = useMemo(() => {
    return getDummyTasksForWorkspace(activeWorkspace);
  }, [activeWorkspace]);

  const dummyEvents = useMemo(() => {
    return getDummyEventsForWorkspace(activeWorkspace);
  }, [activeWorkspace]);

  const isClassAdminUser = useCallback(
    (user?: UserProfile | null) => {
      return isClassAdmin(user, activeWorkspace);
    },
    [activeWorkspace]
  );

  const getEffectiveRole = useCallback(
    (user?: UserProfile | null) => {
      return getEffectiveWorkspaceRole(user, activeWorkspace);
    },
    [activeWorkspace]
  );

  const value = useMemo<WorkspaceContextType>(
    () => ({
      activeWorkspace,
      isClassWorkspace: isClassWorkspace(activeWorkspace),
      activeCampus,
      activeOrmawa,
      campuses: DUMMY_CAMPUSES,
      ormawas: DUMMY_ORMAWAS,
      dummyTasks,
      dummyEvents,
      setActiveWorkspace,
      selectWorkspace,
      getOrmawasByCampus,
      resetWorkspace,
      isClassAdminUser,
      getEffectiveRole,
    }),
    [
      activeWorkspace,
      activeCampus,
      activeOrmawa,
      dummyTasks,
      dummyEvents,
      setActiveWorkspace,
      selectWorkspace,
      getOrmawasByCampus,
      resetWorkspace,
      isClassAdminUser,
      getEffectiveRole,
    ]
  );

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace(): WorkspaceContextType {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error("useWorkspace must be used within a WorkspaceProvider");
  }
  return context;
}
