"use client";

import { PermissionGuard } from "@/components/auth/permission-guard";
import { AIChat } from "@/components/ai/ai-chat";
import { canAccessAI } from "@/lib/permissions";

export default function AIAssistantPage() {
  return (
    <PermissionGuard canAccess={canAccessAI}>
      <div className="flex flex-col h-[calc(100dvh-7.5rem)] md:h-[calc(100dvh-8rem)] w-full">
        <AIChat />
      </div>
    </PermissionGuard>
  );
}
