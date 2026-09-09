"use client";

import { PermissionGuard } from "@/components/auth/permission-guard";
import { InitialDataSetup } from "@/components/setup/initial-data-setup";
import { OrganizationManager } from "@/components/organization/organization-manager";
import { isSuperAdmin } from "@/lib/permissions";

export default function SetupPage() {
  return (
    <PermissionGuard canAccess={isSuperAdmin}>
      <div className="space-y-10">
        <OrganizationManager />
        <div className="border-t border-slate-200 dark:border-slate-800 pt-8">
          <InitialDataSetup />
        </div>
      </div>
    </PermissionGuard>
  );
}
