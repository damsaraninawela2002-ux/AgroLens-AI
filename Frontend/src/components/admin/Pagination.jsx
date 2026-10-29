import { ChevronLeft, ChevronRight } from "lucide-react";
import Button from "../ui/Button";

export default function Pagination({
  page = 1,
  pages = 1,
  total = 0,
  onPageChange,
  pageLabel = "Page",
  prevLabel = "Previous",
  nextLabel = "Next",
  totalLabel = "Total",
}) {
  if (pages <= 1 && total <= 0) return null;

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-100">
      <div className="text-xs font-semibold text-slate-500">
        {pageLabel} <span className="font-bold text-slate-800">{page}</span> /{" "}
        <span className="font-bold text-slate-800">{Math.max(1, pages)}</span>
        {typeof total === "number" && (
          <span className="ml-2 text-slate-400">
            ({totalLabel}: {total})
          </span>
        )}
      </div>

      {pages > 1 && (
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            icon={ChevronLeft}
            disabled={page <= 1}
            onClick={() => onPageChange?.(Math.max(1, page - 1))}
          >
            {prevLabel}
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= pages}
            onClick={() => onPageChange?.(Math.min(pages, page + 1))}
          >
            <span>{nextLabel}</span>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
