import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Inbox } from "lucide-react";
import Card from "../ui/Card";
import Pagination from "./Pagination";

/**
 * Reusable DataTable with:
 * - Sortable columns (client-side or server-side callback)
 * - Loading skeleton rows
 * - Empty state
 * - Mobile card view at < md (375px responsive)
 * - Integrated Pagination
 */
export default function DataTable({
  columns = [],
  data = [],
  rowKey = "id",
  loading = false,
  skeletonRows = 5,
  emptyTitle = "No records found",
  emptySubtitle = "Try adjusting your search or filter criteria.",
  emptyIcon: EmptyIcon = Inbox,
  renderMobileCard,
  page = 1,
  pages = 1,
  total = 0,
  onPageChange,
  pageLabel,
  prevLabel,
  nextLabel,
  totalLabel,
  onSortChange,
}) {
  const [sortState, setSortState] = useState({ key: null, direction: "asc" });

  const handleHeaderSort = (col) => {
    if (!col.sortable) return;
    const nextDir =
      sortState.key === col.key && sortState.direction === "asc"
        ? "desc"
        : "asc";
    const nextSort = { key: col.key, direction: nextDir };
    setSortState(nextSort);
    if (onSortChange) {
      onSortChange(nextSort);
    }
  };

  const safeData = useMemo(() => (Array.isArray(data) ? data : []), [data]);
  const safeColumns = useMemo(
    () => (Array.isArray(columns) ? columns : []),
    [columns]
  );

  const sortedData = useMemo(() => {
    if (!sortState.key || onSortChange) return safeData;
    const col = safeColumns.find((c) => c.key === sortState.key);
    if (!col) return safeData;

    return [...safeData].sort((a, b) => {
      const valA = col.sortValue ? col.sortValue(a) : a?.[col.key];
      const valB = col.sortValue ? col.sortValue(b) : b?.[col.key];
      if (valA == null && valB == null) return 0;
      if (valA == null) return 1;
      if (valB == null) return -1;
      if (typeof valA === "number" && typeof valB === "number") {
        return sortState.direction === "asc" ? valA - valB : valB - valA;
      }
      const cmp = String(valA).localeCompare(String(valB));
      return sortState.direction === "asc" ? cmp : -cmp;
    });
  }, [safeData, safeColumns, sortState, onSortChange]);

  if (loading) {
    return (
      <Card padding="p-0" className="overflow-hidden">
        <div className="divide-y divide-slate-100 p-4 space-y-3">
          {Array.from({ length: skeletonRows }).map((_, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between gap-4 py-3 animate-pulse"
            >
              <div className="flex items-center gap-3 flex-1">
                <div className="w-10 h-10 rounded-xl bg-slate-200 shrink-0" />
                <div className="space-y-2 flex-1 max-w-sm">
                  <div className="h-4 w-3/4 bg-slate-200 rounded" />
                  <div className="h-3 w-1/2 bg-slate-100 rounded" />
                </div>
              </div>
              <div className="h-6 w-20 bg-slate-200 rounded-full" />
              <div className="h-8 w-24 bg-slate-100 rounded-xl hidden sm:block" />
            </div>
          ))}
        </div>
      </Card>
    );
  }

  if (!sortedData || sortedData.length === 0) {
    return (
      <Card className="py-12 px-6 text-center space-y-3">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-50 border border-emerald-200/70 text-[#166534] flex items-center justify-center">
          <EmptyIcon className="w-7 h-7" />
        </div>
        <h3 className="text-base font-extrabold text-slate-900">
          {emptyTitle}
        </h3>
        <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto">
          {emptySubtitle}
        </p>
      </Card>
    );
  }

  return (
    <Card padding="p-0" className="overflow-hidden">
      {/* Desktop Table View (md and up) */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-[#f8faf5] border-b border-slate-200/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
              {safeColumns.map((col) => {
                const isSorted = sortState.key === col.key;
                return (
                  <th
                    key={col.key}
                    className={`py-3.5 px-5 ${
                      col.align === "right" ? "text-right" : "text-left"
                    } ${col.className || ""}`}
                  >
                    {col.sortable ? (
                      <button
                        type="button"
                        onClick={() => handleHeaderSort(col)}
                        className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer uppercase font-bold"
                      >
                        <span>{col.header}</span>
                        {isSorted ? (
                          sortState.direction === "asc" ? (
                            <ArrowUp className="w-3.5 h-3.5 text-[#166534]" />
                          ) : (
                            <ArrowDown className="w-3.5 h-3.5 text-[#166534]" />
                          )
                        ) : (
                          <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                        )}
                      </button>
                    ) : (
                      col.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm">
            {sortedData.map((row, rIdx) => {
              const keyVal =
                typeof rowKey === "function"
                  ? rowKey(row)
                  : row?.[rowKey] || rIdx;
              return (
                <tr
                  key={keyVal}
                  className="hover:bg-slate-50/80 transition-colors"
                >
                  {safeColumns.map((col) => (
                    <td
                      key={col.key}
                      className={`py-3.5 px-5 align-middle ${
                        col.align === "right" ? "text-right" : "text-left"
                      } ${col.cellClassName || ""}`}
                    >
                      {col.render ? col.render(row) : row?.[col.key]}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View (< md, responsive down to 375px) */}
      <div className="md:hidden divide-y divide-slate-100">
        {sortedData.map((row, rIdx) => {
          const keyVal =
            typeof rowKey === "function"
              ? rowKey(row)
              : row?.[rowKey] || rIdx;
          if (renderMobileCard) {
            return (
              <div key={keyVal} className="p-4">
                {renderMobileCard(row)}
              </div>
            );
          }
          return (
            <div key={keyVal} className="p-4 space-y-2.5">
              {safeColumns.map((col) => (
                <div
                  key={col.key}
                  className="flex items-start justify-between gap-3 text-xs"
                >
                  <span className="font-bold uppercase tracking-wider text-slate-400 shrink-0">
                    {col.header}
                  </span>
                  <div className="text-right font-medium text-slate-800 min-w-0">
                    {col.render ? col.render(row) : row?.[col.key]}
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {/* Pagination Bar */}
      {(pages > 1 || total > 0) && onPageChange && (
        <div className="px-5 py-3.5 bg-[#f8faf5]/50">
          <Pagination
            page={page}
            pages={pages}
            total={total}
            onPageChange={onPageChange}
            pageLabel={pageLabel}
            prevLabel={prevLabel}
            nextLabel={nextLabel}
            totalLabel={totalLabel}
          />
        </div>
      )}
    </Card>
  );
}
