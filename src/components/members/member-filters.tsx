import { Input } from "@/components/ui/input";
import { USER_ROLE_OPTIONS } from "@/lib/roles";
import type { UserRole } from "@/types";
import { Search } from "lucide-react";

export type MemberStatusFilter = "all" | "active" | "inactive";

type MemberFiltersProps = {
  search: string;
  role: "all" | UserRole;
  status: MemberStatusFilter;
  division: string;
  divisions: string[];
  onSearchChange: (value: string) => void;
  onRoleChange: (value: "all" | UserRole) => void;
  onStatusChange: (value: MemberStatusFilter) => void;
  onDivisionChange: (value: string) => void;
};

const selectClassName =
  "h-9 w-full rounded-lg border border-[#e1e2e3] bg-white px-3 text-xs font-medium text-[#242424] outline-none transition-colors focus:border-[#242424] focus:ring-1 focus:ring-[#242424]/10 shadow-2xs cursor-pointer";

export function MemberFilters({
  search,
  role,
  status,
  division,
  divisions,
  onSearchChange,
  onRoleChange,
  onStatusChange,
  onDivisionChange,
}: MemberFiltersProps) {
  return (
    <div className="grid gap-2.5 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-[#898989]" />
        <Input
          placeholder="Cari nama atau email..."
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          className="pl-8 h-9 text-xs rounded-lg border-[#e1e2e3] bg-white text-[#242424] placeholder:text-[#898989] focus:ring-1 focus:ring-[#242424] shadow-2xs"
        />
      </div>

      <select
        className={selectClassName}
        value={role}
        onChange={(event) => onRoleChange(event.target.value as "all" | UserRole)}
      >
        <option value="all">Semua Role</option>
        {USER_ROLE_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      <select
        className={selectClassName}
        value={status}
        onChange={(event) =>
          onStatusChange(event.target.value as MemberStatusFilter)
        }
      >
        <option value="all">Semua Status</option>
        <option value="active">Aktif</option>
        <option value="inactive">Nonaktif</option>
      </select>

      <select
        className={selectClassName}
        value={division}
        onChange={(event) => onDivisionChange(event.target.value)}
      >
        <option value="all">Semua Divisi</option>
        {divisions.map((item) => (
          <option key={item} value={item}>
            {item}
          </option>
        ))}
      </select>
    </div>
  );
}
