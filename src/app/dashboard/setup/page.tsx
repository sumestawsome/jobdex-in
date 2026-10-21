"use client";

import { PermissionGuard } from "@/components/auth/permission-guard";
import { InitialDataSetup } from "@/components/setup/initial-data-setup";
import { OrganizationManager } from "@/components/organization/organization-manager";
import { isSuperAdmin } from "@/lib/permissions";

export default function SetupPage() {
  return (
    <PermissionGuard canAccess={isSuperAdmin}>
      <div className="space-y-8">
        <OrganizationManager />
        <div className="border-t border-[#e1e2e3] pt-6">
          <InitialDataSetup />
        </div>
      </div>
    </PermissionGuard>
  );
}
