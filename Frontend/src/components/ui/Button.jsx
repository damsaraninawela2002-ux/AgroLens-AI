import Spinner from "./Spinner";

export default function Button({
  children,
  type = "button",
  variant = "primary",
  size = "md",
  loading = false,
  disabled = false,
  fullWidth = false,
  icon: Icon = null,
  iconPosition = "left",
  className = "",
  ...props
}) {
  const baseStyles =
    "inline-flex items-center justify-center gap-2 font-semibold rounded-xl transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed active:scale-[0.99]";

  const variants = {
    primary:
      "bg-[#166534] hover:bg-[#15803d] text-white shadow-sm shadow-[#166534]/20 hover:shadow-md hover:shadow-[#166534]/25 focus-visible:ring-[#166534]",
    accent:
      "bg-[#84cc16] hover:bg-[#65a30d] text-slate-950 hover:text-white shadow-sm shadow-[#84cc16]/25 focus-visible:ring-[#84cc16]",
    secondary:
      "bg-emerald-50 hover:bg-emerald-100 text-[#166534] border border-emerald-200/80 focus-visible:ring-[#166534]",
    outline:
      "bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 hover:border-slate-300 shadow-xs focus-visible:ring-[#166534]",
    ghost:
      "bg-transparent hover:bg-slate-100 text-slate-700 focus-visible:ring-[#166534]",
    danger:
      "bg-[#dc2626] hover:bg-red-700 text-white shadow-sm focus-visible:ring-[#dc2626]",
  };

  const sizes = {
    sm: "px-3.5 py-2 text-xs",
    md: "px-5 py-2.5 text-sm",
    lg: "px-6 py-3.5 text-base",
  };

  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={`${baseStyles} ${variants[variant] || variants.primary} ${
        sizes[size] || sizes.md
      } ${fullWidth ? "w-full" : ""} ${className}`}
      {...props}
    >
      {loading && <Spinner size="sm" />}
      {!loading && Icon && iconPosition === "left" && (
        <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
      )}
      <span>{children}</span>
      {!loading && Icon && iconPosition === "right" && (
        <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
      )}
    </button>
  );
}
