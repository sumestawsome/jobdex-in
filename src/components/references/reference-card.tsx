"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ColorPalettePreview } from "@/components/references/color-palette-preview";
import { DesignTypeBadge } from "@/components/references/design-type-badge";
import type { ReferenceListItem, DesignType } from "@/types";

import { Eye, FolderOpen, Palette, Pencil, Archive, ExternalLink } from "lucide-react";

type ReferenceCardProps = {
  reference: ReferenceListItem;
  canEdit: boolean;
  onView: (reference: ReferenceListItem) => void;
  onEdit: (reference: ReferenceListItem) => void;
  onArchive: (reference: ReferenceListItem) => void;
};

export function ReferenceCard({
  reference,
  canEdit,
  onView,
  onEdit,
  onArchive,
}: ReferenceCardProps) {
  return (
    <Card className="flex flex-col justify-between overflow-hidden rounded-none shadow-none border border-border">
      {reference.thumbnail_url ? (
        <div className="h-44 border-b border-border bg-muted">
          {/* Manual thumbnail URLs can come from arbitrary hosts; avoid broad Next image allowlists. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={reference.thumbnail_url}
            alt={reference.title}
            className="h-full w-full object-cover"
          />
        </div>
      ) : (
        <div className="flex h-44 items-center justify-center border-b border-slate-200 bg-slate-100 text-sm font-semibold text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
          Tanpa thumbnail
        </div>
      )}
      <CardContent className="space-y-4 p-5 flex-1 flex flex-col justify-between">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <DesignTypeBadge type={reference.visual_type as DesignType} />
            <Badge variant={reference.status === "archived" ? "warning" : "success"}>
              {reference.status === "archived" ? "Archived" : "Aktif"}
            </Badge>
            <Badge variant={reference.source_type === "approved_task" ? "orange" : "neutral"}>
              {reference.source_type === "approved_task" ? "Dari Jobdesk Approved" : "Manual"}
            </Badge>
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white leading-tight">{reference.title}</h2>
            <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
              {reference.event_name || "Tanpa nama acara"} - {reference.year}
            </p>
          </div>
          <ColorPalettePreview colors={reference.color_palette ?? []} />
          <p className="line-clamp-2 min-h-10 text-xs font-medium leading-relaxed text-slate-650 dark:text-slate-300">
            {reference.notes || "Tidak ada catatan."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 pt-3 border-t border-dashed border-neutral-200 dark:border-neutral-800">
          <Button type="button" size="sm" variant="info" onClick={() => onView(reference)}>
            <Eye className="size-3.5" />
            <span>Detail</span>
          </Button>
          
          {reference.source_type === "approved_task" ? (
            <>
              {reference.task_id ? (
                <Button asChild size="sm" variant="secondary">
                  <a href={`/dashboard/tasks/${reference.task_id}`} target="_blank" rel="noreferrer" className="flex items-center gap-1.5">
                    <ExternalLink className="size-3.5" />
                    <span>Buka Jobdesk</span>
                  </a>
                </Button>
              ) : null}
              {reference.file_url ? (
                <Button asChild size="sm" variant="secondary">
                  <a href={reference.file_url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5">
                    <FolderOpen className="size-3.5" />
                    <span>Buka File</span>
                  </a>
                </Button>
              ) : null}
              {reference.source_link ? (
                <Button asChild size="sm" variant="secondary">
                  <a href={reference.source_link} target="_blank" rel="noreferrer" className="flex items-center gap-1.5">
                    <Palette className="size-3.5" />
                    <span>Buka Sumber Desain</span>
                  </a>
                </Button>
              ) : null}
            </>
          ) : (
            <>
              {(() => {
                const driveUrl = reference.file_url || "";
                const canvaLink = reference.source_link || "";
                return (
                  <>
                    {driveUrl ? (
                      <Button asChild size="sm" variant="secondary">
                        <a href={driveUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1.5">
                          <FolderOpen className="size-3.5" />
                          <span>Drive</span>
                        </a>
                      </Button>
                    ) : null}
                    {canvaLink ? (
                      <Button asChild size="sm" variant="secondary">
                        <a href={canvaLink} target="_blank" rel="noreferrer" className="flex items-center gap-1.5">
                          <Palette className="size-3.5" />
                          <span>Canva</span>
                        </a>
                      </Button>
                    ) : null}
                  </>
                );
              })()}
              {canEdit ? (
                <>
                  <Button type="button" size="sm" variant="warning" onClick={() => onEdit(reference)}>
                    <Pencil className="size-3.5" />
                    <span>Edit</span>
                  </Button>
                  {reference.status !== "archived" ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      onClick={() => onArchive(reference)}
                    >
                      <Archive className="size-3.5" />
                      <span>Archive</span>
                    </Button>
                  ) : null}
                </>
              ) : null}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
