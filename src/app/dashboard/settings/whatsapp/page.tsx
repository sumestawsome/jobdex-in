"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { OrmawaWhatsAppGatewaySettings } from "@/components/settings/ormawa-whatsapp-gateway-settings";

export default function OrmawaWhatsAppPage() {
  return (
    <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8 space-y-6">
      <div className="flex items-center gap-2">
        <Link
          href="/dashboard/settings"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
        >
          <ArrowLeft className="size-3.5" />
          <span>Kembali ke Pengaturan</span>
        </Link>
      </div>

      <OrmawaWhatsAppGatewaySettings />
    </div>
  );
}
