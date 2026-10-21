export type TaskViewMode = "table" | "card";

type TaskViewToggleProps = {
  value: TaskViewMode;
  onChange: (value: TaskViewMode) => void;
};

export function TaskViewToggle({ value, onChange }: TaskViewToggleProps) {
  return (
    <div className="inline-flex items-center p-0.5 rounded-lg bg-[#f7f7f8] border border-[#e1e2e3]">
      <button
        type="button"
        onClick={() => onChange("table")}
        className={`px-3 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
          value === "table"
            ? "bg-white text-[#242424] shadow-2xs font-bold"
            : "text-[#898989] hover:text-[#242424]"
        }`}
      >
        Tabel
      </button>
      <button
        type="button"
        onClick={() => onChange("card")}
        className={`px-3 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
          value === "card"
            ? "bg-white text-[#242424] shadow-2xs font-bold"
            : "text-[#898989] hover:text-[#242424]"
        }`}
      >
        Kartu
      </button>
    </div>
  );
}
