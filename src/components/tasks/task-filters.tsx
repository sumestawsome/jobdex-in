import { Input } from "@/components/ui/input";
import { TASK_PRIORITY_OPTIONS } from "@/lib/task-priority";
import { TASK_STATUS_OPTIONS } from "@/lib/task-status";
import type { Event, TaskPriority, TaskStatus, TaskType, UserProfile } from "@/types";
import { Search, Layers, Activity, AlertCircle, User, Calendar, Clock } from "lucide-react";
import { useWorkspace } from "@/hooks/use-workspace";

export type TaskDeadlineFilter = "all" | "overdue" | "week";

type TaskFiltersProps = {
  search: string;
  type: "all" | TaskType;
  status: "all" | TaskStatus;
  priority: "all" | TaskPriority;
  picId: string;
  eventId: string;
  deadline: TaskDeadlineFilter;
  users: UserProfile[];
  events: Event[];
  isClassWorkspace?: boolean;
  onSearchChange: (value: string) => void;
  onTypeChange: (value: "all" | TaskType) => void;
  onStatusChange: (value: "all" | TaskStatus) => void;
  onPriorityChange: (value: "all" | TaskPriority) => void;
  onPicChange: (value: string) => void;
  onEventChange: (value: string) => void;
  onDeadlineChange: (value: TaskDeadlineFilter) => void;
};

const selectClassName =
  "h-9 w-full rounded-none border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 pl-8 pr-3 text-xs font-medium text-zinc-900 dark:text-zinc-100 outline-none transition-colors focus:border-zinc-900 dark:focus:border-zinc-500 focus:ring-1 focus:ring-zinc-900/10 dark:focus:ring-zinc-700/50 shadow-none cursor-pointer [&>option]:bg-white [&>option]:text-zinc-900 dark:[&>option]:bg-zinc-900 dark:[&>option]:text-zinc-100";

export function TaskFilters({
  search,
  type,
  status,
  priority,
  picId,
  eventId,
  deadline,
  users,
  events,
  isClassWorkspace: isClassWorkspaceProp,
  onSearchChange,
  onTypeChange,
  onStatusChange,
  onPriorityChange,
  onPicChange,
  onEventChange,
  onDeadlineChange,
}: TaskFiltersProps) {
  const { isClassWorkspace: isClassWsContext } = useWorkspace();
  const isClass = isClassWorkspaceProp ?? isClassWsContext;

  if (isClass) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-zinc-500 dark:text-zinc-400" />
          <Input
            placeholder="Cari mata kuliah atau nama tugas..."
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            className="pl-8 h-9 text-xs rounded-none border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-500 dark:placeholder:text-zinc-500 focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-600 shadow-none"
          />
        </div>

        <div className="relative">
          <Activity className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-[#898989] dark:text-zinc-500 pointer-events-none" />
          <select className={selectClassName} value={status} onChange={(event) => onStatusChange(event.target.value as "all" | TaskStatus)}>
            <option value="all">Semua Status</option>
            {TASK_STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>

        <div className="relative">
          <Clock className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-[#898989] dark:text-zinc-500 pointer-events-none" />
          <select className={selectClassName} value={deadline} onChange={(event) => onDeadlineChange(event.target.value as TaskDeadlineFilter)}>
            <option value="all">Semua Tenggat</option>
            <option value="overdue">Terlewat Deadline</option>
            <option value="week">Deadline Minggu Ini</option>
          </select>
        </div>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-2.5 md:grid-cols-2 xl:grid-cols-4">
      <div className="col-span-2 md:col-span-1 xl:col-span-1 relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-zinc-500 dark:text-zinc-400" />
        <Input
          placeholder="Cari nama job desk..."
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          className="pl-8 h-9 text-xs rounded-none border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-500 dark:placeholder:text-zinc-500 focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-600 shadow-none"
        />
      </div>

      <div className="relative">
        <Layers className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-[#898989] dark:text-zinc-500 pointer-events-none" />
        <select className={selectClassName} value={type} onChange={(event) => onTypeChange(event.target.value as "all" | TaskType)}>
          <option value="all">Semua Tipe</option>
          <option value="divisi">Divisi</option>
          <option value="acara">Acara</option>
        </select>
      </div>

      <div className="relative">
        <Activity className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-[#898989] dark:text-zinc-500 pointer-events-none" />
        <select className={selectClassName} value={status} onChange={(event) => onStatusChange(event.target.value as "all" | TaskStatus)}>
          <option value="all">Semua Status</option>
          {TASK_STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </div>

      <div className="relative">
        <AlertCircle className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-[#898989] dark:text-zinc-500 pointer-events-none" />
        <select className={selectClassName} value={priority} onChange={(event) => onPriorityChange(event.target.value as "all" | TaskPriority)}>
          <option value="all">Semua Prioritas</option>
          {TASK_PRIORITY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </div>

      <div className="relative">
        <User className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-[#898989] dark:text-zinc-500 pointer-events-none" />
        <select className={selectClassName} value={picId} onChange={(event) => onPicChange(event.target.value)}>
          <option value="all">Semua PIC</option>
          {users.map((user) => (
            <option key={user.id} value={user.id}>{user.name || user.email}</option>
          ))}
        </select>
      </div>

      <div className="relative">
        <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-[#898989] dark:text-zinc-500 pointer-events-none" />
        <select className={selectClassName} value={eventId} onChange={(event) => onEventChange(event.target.value)}>
          <option value="all">Semua Acara</option>
          {events.map((event) => (
            <option key={event.id} value={event.id}>{event.name}</option>
          ))}
        </select>
      </div>

      <div className="relative col-span-2 md:col-span-1 xl:col-span-2">
        <Clock className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-[#898989] dark:text-zinc-500 pointer-events-none" />
        <select className={selectClassName} value={deadline} onChange={(event) => onDeadlineChange(event.target.value as TaskDeadlineFilter)}>
          <option value="all">Semua Deadline</option>
          <option value="overdue">Terlewat Deadline</option>
          <option value="week">Deadline Minggu Ini</option>
        </select>
      </div>
    </div>
  );
}
