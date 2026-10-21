"use client";

import { PermissionGuard } from "@/components/auth/permission-guard";
import { AIChat } from "@/components/ai/ai-chat";
import { canAccessAI } from "@/lib/permissions";
import { Sparkles } from "lucide-react";

export default function AIAssistantPage() {
  return (
    <PermissionGuard canAccess={canAccessAI}>
      <div className="flex flex-col h-[calc(100vh-8.5rem)] max-w-4xl mx-auto w-full">
        {/* Header Cal.com */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#e1e2e3] shrink-0 mb-3">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border border-[#e1e2e3] bg-white text-[11px] font-semibold text-[#242424]">
                <Sparkles className="size-3 text-[#6349ea]" />
                Gemini AI Workspace
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#242424]">
              AI Assistant
            </h1>
            <p className="mt-0.5 text-xs sm:text-sm text-[#898989]">
              Tanya progress, deadline tugas, dan referensi desain kepanitiaan secara real-time.
            </p>
          </div>
        </header>

        {/* Chat Area */}
        <AIChat />
      </div>
    </PermissionGuard>
  );
}
