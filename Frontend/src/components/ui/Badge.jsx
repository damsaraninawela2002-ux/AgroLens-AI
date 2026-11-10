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
      className={`inline-flex items-center gap-2 px-3 py-1.5 h-auto rounded-full text-xs font-semibold leading-[1.7] whitespace-normal break-words border ${
        variants[variant] || variants.success
      } ${className}`}
    >
      {Icon && <Icon className="w-5 h-5 shrink-0" aria-hidden="true" />}
      <span>{children}</span>
    </span>
  );
}
