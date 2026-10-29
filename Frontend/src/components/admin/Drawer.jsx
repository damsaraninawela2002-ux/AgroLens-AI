import { useEffect, useRef } from "react";
import { X } from "lucide-react";

export default function Drawer({
  open,
  onClose,
  title,
  subtitle,
  widthClass = "max-w-xl",
  children,
  footer,
}) {
  const drawerRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(e) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose?.();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-slate-900/60 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="drawer-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) {
          onClose?.();
        }
      }}
    >
      <div
        ref={drawerRef}
        className={`w-full ${widthClass} bg-white h-full shadow-2xl border-l border-slate-200 flex flex-col overflow-hidden`}
      >
        {/* Drawer Header */}
        <div className="px-6 py-4 border-b border-slate-100 bg-[#f8faf5]/70 flex items-start justify-between gap-4 shrink-0">
          <div className="space-y-0.5 min-w-0">
            <h3
              id="drawer-title"
              className="text-lg font-extrabold text-slate-900 truncate"
            >
              {title}
            </h3>
            {subtitle && (
              <p className="text-xs text-slate-500 truncate">{subtitle}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close drawer"
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">{children}</div>

        {/* Optional Footer */}
        {footer && (
          <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/70 flex flex-wrap items-center justify-end gap-3 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
