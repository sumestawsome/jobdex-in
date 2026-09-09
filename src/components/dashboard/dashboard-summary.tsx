"use client";

import { useEffect, useState } from "react";
import { StatCard } from "@/components/dashboard/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import {
  getDashboardSummary,
  type DashboardSummary as DashboardSummaryData,
} from "@/lib/dashboard-summary";
import { useWorkspace } from "@/hooks/use-workspace";
import type { UserProfile } from "@/types";

type DashboardSummaryProps = {
  profile: UserProfile;
};

export function DashboardSummary({ profile }: DashboardSummaryProps) {
  const { activeWorkspace } = useWorkspace();
  const [summary, setSummary] = useState<DashboardSummaryData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function loadSummary() {
      setLoading(true);

      try {
        const data = await getDashboardSummary(profile, {
          org_id: activeWorkspace.org_id,
          campus_id: activeWorkspace.campus_id,
        });

        if (mounted) {
          setSummary(data);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadSummary();

    return () => {
      mounted = false;
    };
  }, [profile, activeWorkspace.org_id, activeWorkspace.campus_id]);

  if (loading) {
    return <LoadingState title="Memuat ringkasan dashboard..." />;
  }

  if (!summary) {
    return (
      <EmptyState
        title="Ringkasan belum tersedia"
        description="Data dashboard belum bisa dimuat. Coba refresh halaman atau periksa Firestore Rules."
      />
    );
  }

  const hasAnyData = summary.items.some((item) => {
    if (typeof item.value === "number") {
      return item.value > 0;
    }

    return item.value === "Siap";
  });

  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-xl font-bold text-slate-950 dark:text-slate-50">{summary.title}</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500 dark:text-slate-400">
          {summary.description}
        </p>
      </section>

      <section className="grid grid-cols-2 gap-3 md:gap-4 md:grid-cols-2 xl:grid-cols-4">
        {summary.items.map((item) => (
          <StatCard
            key={item.label}
            label={item.label}
            value={item.value}
            description={item.description}
          />
        ))}
      </section>

      {!hasAnyData ? (
        <EmptyState
          title="Data operasional masih kosong"
          description="Collection Firestore untuk tugas, acara, anggota tambahan, atau referensi belum berisi data. Ini normal untuk fase fondasi."
        />
      ) : null}
    </div>
  );
}
