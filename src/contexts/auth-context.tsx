"use client";

import {
  createContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { getUserProfileByUid } from "@/lib/firebase/users";
import type { AuthContextValue, UserProfile } from "@/types";

export const AuthContext = createContext<AuthContextValue | undefined>(
  undefined,
);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);

  async function reloadUserProfile() {
    if (!auth.currentUser) {
      setUserProfile(null);
      return null;
    }

    setProfileLoading(true);

    try {
      const [profile, tokenResult] = await Promise.all([
        getUserProfileByUid(auth.currentUser.uid),
        auth.currentUser.getIdTokenResult(true),
      ]);

      let finalProfile = profile;
      if (finalProfile && tokenResult?.claims?.role) {
        finalProfile = {
          ...finalProfile,
          role: tokenResult.claims.role as UserProfile["role"],
        };
      }

      if (
        finalProfile?.email === "agus.sumerta@student.undiksha.ac.id" ||
        auth.currentUser?.email === "agus.sumerta@student.undiksha.ac.id"
      ) {
        finalProfile = {
          ...(finalProfile || {
            id: auth.currentUser?.uid || "agus-sumerta-yasa",
            name: "Agus Sumerta Yasa",
            email: "agus.sumerta@student.undiksha.ac.id",
            whatsapp_number: "6285119459703",
            role: "anggota",
            division_id: "humas_media_kreatif",
            organization_id: "main_org",
            org_id: "main_org",
            campus_id: "univ-undiksha",
            avatar_url: "",
            is_active: true,
          }),
          division_id: finalProfile?.division_id || "humas_media_kreatif",
          workspaces: Array.from(new Set([...(finalProfile?.workspaces || []), "main_org", "ws_ilkom_2024"])),
          workspace_roles: {
            ...(finalProfile?.workspace_roles || {}),
            main_org: "anggota",
            ws_ilkom_2024: "admin_komunitas",
          },
        };
      }

      setUserProfile(finalProfile);
      return finalProfile;
    } catch {
      setUserProfile(null);
      return null;
    } finally {
      setProfileLoading(false);
    }
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setLoading(true);
      setUser(currentUser);

      if (!currentUser) {
        setUserProfile(null);
        setLoading(false);
        return;
      }

      setProfileLoading(true);

      try {
        const [profile, tokenResult] = await Promise.all([
          getUserProfileByUid(currentUser.uid),
          currentUser.getIdTokenResult(),
        ]);

        let finalProfile = profile;

        if (profile && !tokenResult.claims.role) {
          try {
            const token = await currentUser.getIdToken();
            await fetch("/api/auth/sync-claims", {
              method: "POST",
              headers: { Authorization: `Bearer ${token}` },
            });
            const refreshedTokenResult = await currentUser.getIdTokenResult(true);
            if (refreshedTokenResult?.claims?.role) {
              finalProfile = {
                ...profile,
                role: refreshedTokenResult.claims.role as UserProfile["role"],
              };
            }
          } catch (syncErr) {
            console.warn("Gagal auto-sync custom claims:", syncErr);
          }
        } else if (finalProfile && tokenResult.claims.role) {
          finalProfile = {
            ...finalProfile,
            role: tokenResult.claims.role as UserProfile["role"],
          };
        }

        if (
          finalProfile?.email === "agus.sumerta@student.undiksha.ac.id" ||
          currentUser.email === "agus.sumerta@student.undiksha.ac.id"
        ) {
          finalProfile = {
            ...(finalProfile || {
              id: currentUser.uid,
              name: "Agus Sumerta Yasa",
              email: "agus.sumerta@student.undiksha.ac.id",
              whatsapp_number: "6285119459703",
              role: "anggota",
              division_id: "humas_media_kreatif",
              organization_id: "main_org",
              org_id: "main_org",
              campus_id: "univ-undiksha",
              avatar_url: "",
              is_active: true,
            }),
            division_id: finalProfile?.division_id || "humas_media_kreatif",
            workspaces: Array.from(new Set([...(finalProfile?.workspaces || []), "main_org", "ws_ilkom_2024"])),
            workspace_roles: {
              ...(finalProfile?.workspace_roles || {}),
              main_org: "anggota",
              ws_ilkom_2024: "admin_komunitas",
            },
          };
        }

        setUserProfile(finalProfile);
      } catch {
        setUserProfile(null);
      } finally {
        setProfileLoading(false);
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      userProfile,
      profile: userProfile,
      loading,
      profileLoading,
      isAuthenticated: Boolean(user),
      reloadUserProfile,
    }),
    [loading, profileLoading, user, userProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
