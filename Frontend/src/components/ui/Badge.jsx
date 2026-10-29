export default function Badge({
  children,
  variant = "success",
  icon: Icon = null,
  className = "",
}) {
  const variants = {
    success:
      "bg-emerald-50 text-[#166534] border-emerald-200/90",
    lime:
      "bg-[#ecfccb] text-[#3f6212] border-[#bef264]",
    warning:
      "bg-amber-50 text-amber-800 border-amber-200/90",
    danger:
      "bg-red-50 text-[#dc2626] border-red-200/90",
    info:
      "bg-sky-50 text-sky-800 border-sky-200/90",
    neutral:
      "bg-slate-100 text-slate-600 border-slate-200",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${
        variants[variant] || variants.success
      } ${className}`}
    >
      {Icon && <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />}
      <span>{children}</span>
    </span>
  );
}
