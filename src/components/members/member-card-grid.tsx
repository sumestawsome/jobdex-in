import { MemberCard } from "@/components/members/member-card";
import type { UserProfile } from "@/types";

type MemberCardGridProps = {
  members: UserProfile[];
  eventRolesByUser?: Record<string, string>;
  onView: (member: UserProfile) => void;
  onEdit: (member: UserProfile) => void;
  onToggleStatus: (member: UserProfile) => void;
};

export function MemberCardGrid({
  members,
  eventRolesByUser = {},
  onView,
  onEdit,
  onToggleStatus,
}: MemberCardGridProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {members.map((member) => (
        <MemberCard
          key={member.id}
          member={member}
          eventRole={eventRolesByUser[member.id]}
          onView={onView}
          onEdit={onEdit}
          onToggleStatus={onToggleStatus}
        />
      ))}
    </div>
  );
}
