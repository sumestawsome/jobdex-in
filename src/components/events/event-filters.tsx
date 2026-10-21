import { Input } from "@/components/ui/input";
import { EVENT_STATUS_OPTIONS } from "@/lib/event-status";
import type { EventStatus } from "@/types";
import { Search } from "lucide-react";

export type EventDateFilter = "all" | "upcoming" | "past";

type EventFiltersProps = {
  search: string;
  status: "all" | EventStatus;
  dateFilter: EventDateFilter;
  onSearchChange: (value: string) => void;
  onStatusChange: (value: "all" | EventStatus) => void;
  onDateFilterChange: (value: EventDateFilter) => void;
};

const selectClassName =
  "h-9 w-full rounded-lg border border-[#e1e2e3] bg-white px-3 text-xs font-medium text-[#242424] outline-none transition-colors focus:border-[#242424] focus:ring-1 focus:ring-[#242424]/10 shadow-2xs cursor-pointer";

export function EventFilters({
  search,
  status,
  dateFilter,
  onSearchChange,
  onStatusChange,
  onDateFilterChange,
}: EventFiltersProps) {
  return (
    <div className="grid grid-cols-2 gap-2.5 md:grid-cols-[1.5fr_1fr_1fr]">
      <div className="col-span-2 md:col-span-1 relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-[#898989]" />
        <Input
          placeholder="Cari nama acara..."
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          className="pl-8 h-9 text-xs rounded-lg border-[#e1e2e3] bg-white text-[#242424] placeholder:text-[#898989] focus:ring-1 focus:ring-[#242424] shadow-2xs"
        />
      </div>
      <select
        className={selectClassName}
        value={status}
        onChange={(event) => onStatusChange(event.target.value as "all" | EventStatus)}
      >
        <option value="all">Semua Status</option>
        {EVENT_STATUS_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <select
        className={selectClassName}
        value={dateFilter}
        onChange={(event) =>
          onDateFilterChange(event.target.value as EventDateFilter)
        }
      >
        <option value="all">Semua Tanggal</option>
        <option value="upcoming">Akan Datang</option>
        <option value="past">Sudah Lewat</option>
      </select>
    </div>
  );
}
