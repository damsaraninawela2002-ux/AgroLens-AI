import { RotateCcw } from "lucide-react";

export default function FilterBar({
  children,
  onReset,
  hasActiveFilters = false,
  resetLabel = "Reset",
  className = "",
}) {
  return (
    <div
      className={`rounded-2xl bg-white border border-slate-200/80 p-3.5 sm:p-4 shadow-2xs flex flex-col lg:flex-row lg:items-center justify-between gap-3 ${className}`}
    >
      <div className="flex flex-wrap items-center gap-2.5 flex-1">
        {children}
      </div>

      {hasActiveFilters && onReset && (
        <button
          type="button"
          onClick={onReset}
          className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-600 hover:text-[#dc2626] bg-slate-100 hover:bg-red-50 transition-colors cursor-pointer shrink-0"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>{resetLabel}</span>
        </button>
      )}
    </div>
  );
}
