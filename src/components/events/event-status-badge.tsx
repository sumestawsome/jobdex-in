import { Badge } from "@/components/ui/badge";
import { EVENT_STATUS_LABELS } from "@/lib/event-status";
import type { EventStatus } from "@/types";

type EventStatusBadgeProps = {
  status?: EventStatus | null;
};

export function EventStatusBadge({ status }: EventStatusBadgeProps) {
  if (!status) {
    return <Badge variant="neutral">Tanpa status</Badge>;
  }

  const variant =
    status === "selesai"
      ? "success"
      : status === "dibatalkan"
      ? "error"
      : status === "berlangsung"
      ? "orange"
      : "info";

  return <Badge variant={variant}>{EVENT_STATUS_LABELS[status]}</Badge>;
}
