export default function Card({
  children,
  className = "",
  hover = false,
  padding = "p-6",
  ...props
}) {
  return (
    <div
      className={`rounded-2xl bg-white border border-slate-200/80 shadow-sm shadow-slate-900/5 ${
        hover
          ? "transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-emerald-200"
          : ""
      } ${padding} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
