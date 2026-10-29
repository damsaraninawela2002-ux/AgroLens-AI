import { Link } from "react-router-dom";

export default function Logo({
  variant = "dark",
  size = "md",
  to = "/",
  showSubtitle = true,
  className = "",
}) {
  const isLight = variant === "light";

  const iconSizes = {
    sm: "w-8 h-8",
    md: "w-10 h-10",
    lg: "w-12 h-12",
  };

  const textSizes = {
    sm: "text-lg",
    md: "text-xl",
    lg: "text-2xl",
  };

  const content = (
    <div className={`inline-flex items-center gap-2.5 select-none group ${className}`}>
      <div
        className={`${
          iconSizes[size] || iconSizes.md
        } shrink-0 relative flex items-center justify-center rounded-xl bg-gradient-to-br from-[#166534] via-[#15803d] to-[#65a30d] shadow-md shadow-[#166534]/20 ring-1 ring-white/20 transition-transform duration-200 group-hover:scale-105`}
      >
        {/* Custom Leaf + Optical Lens SVG Mark */}
        <svg
          viewBox="0 0 40 40"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-6 h-6"
          aria-hidden="true"
        >
          {/* Outer Scanner Lens Brackets */}
          <path
            d="M9 14V11C9 9.89543 9.89543 9 11 9H14"
            stroke="#a3e635"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
          <path
            d="M26 9H29C30.1046 9 31 9.89543 31 11V14"
            stroke="#a3e635"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
          <path
            d="M31 26V29C31 30.1046 30.1046 31 29 31H26"
            stroke="#a3e635"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
          <path
            d="M14 31H11C9.89543 31 9 30.1046 9 29V26"
            stroke="#a3e635"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
          {/* Organic Leaf Silhouette */}
          <path
            d="M27.5 12.5C20.5 12.5 14 16.5 13 24.5C12.8 26.2 13.8 27.2 15.5 27C23.5 26 27.5 19.5 27.5 12.5Z"
            fill="white"
            fillOpacity="0.95"
          />
          {/* Leaf Central Vein */}
          <path
            d="M14.5 25.5C17.5 22.5 21 19 25.5 14.5"
            stroke="#166534"
            strokeWidth="2"
            strokeLinecap="round"
          />
          {/* AI Target Node */}
          <circle cx="21.5" cy="18.5" r="2.2" fill="#84cc16" />
        </svg>
      </div>

      <div className="flex flex-col leading-none">
        <span
          className={`font-extrabold tracking-tight whitespace-nowrap ${
            textSizes[size] || textSizes.md
          } ${isLight ? "text-white" : "text-slate-900"}`}
        >
          AgroLens{" "}
          <span
            className={
              isLight
                ? "text-[#a3e635]"
                : "bg-gradient-to-r from-[#166534] to-[#65a30d] bg-clip-text text-transparent"
            }
          >
            AI
          </span>
        </span>
        {showSubtitle && (
          <span
            className={`text-[10px] font-semibold uppercase tracking-widest mt-0.5 whitespace-nowrap ${
              isLight ? "text-emerald-200/80" : "text-slate-500"
            }`}
          >
            Sri Lanka Agri-Tech
          </span>
        )}
      </div>
    </div>
  );

  if (to) {
    return (
      <Link
        to={to}
        className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#84cc16] rounded-xl"
        aria-label="AgroLens AI Home"
      >
        {content}
      </Link>
    );
  }

  return content;
}
