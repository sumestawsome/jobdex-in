import { EventCard } from "@/components/events/event-card";
import type { Event, UserProfile } from "@/types";

type EventCardGridProps = {
  events: Event[];
  usersById: Map<string, UserProfile>;
  memberCounts: Record<string, number>;
  userProfile?: UserProfile | null;
  userRoles?: Record<string, string>;
  onEdit: (event: Event) => void;
};

export function EventCardGrid({
  events,
  usersById,
  memberCounts,
  userProfile,
  userRoles,
  onEdit,
}: EventCardGridProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {events.map((event) => (
        <EventCard
          key={event.id}
          event={event}
          usersById={usersById}
          memberCount={memberCounts[event.id] ?? 0}
          userProfile={userProfile}
          userRole={userRoles?.[event.id]}
          onEdit={onEdit}
        />
      ))}
    </div>
  );
}
