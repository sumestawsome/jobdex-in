export type TaskViewMode = "table" | "card";

type TaskViewToggleProps = {
  value: TaskViewMode;
  onChange: (value: TaskViewMode) => void;
};

export function TaskViewToggle({ value, onChange }: TaskViewToggleProps) {
  return (
    <div className="inline-flex items-center p-0.5 rounded-none bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
      <button
        type="button"
        onClick={() => onChange("table")}
        className={`px-3 py-1 text-xs font-semibold rounded-none transition-all cursor-pointer ${
          value === "table"
            ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-none font-bold"
            : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
        }`}
      >
        Tabel
      </button>
      <button
        type="button"
        onClick={() => onChange("card")}
        className={`px-3 py-1 text-xs font-semibold rounded-none transition-all cursor-pointer ${
          value === "card"
            ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-none font-bold"
            : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
        }`}
      >
        Kartu
      </button>
    </div>
  );
}
