export default function Tabs({ tabs = [], activeTab, onChange, className = "" }) {
  return (
    <div
      role="tablist"
      className={`inline-flex flex-wrap rounded-xl bg-slate-100 p-1 text-xs font-bold gap-1 ${className}`}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange?.(tab.id)}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg transition-all cursor-pointer ${
              isActive
                ? "bg-[#166534] text-white shadow-2xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            {Icon && <Icon className="w-3.5 h-3.5" />}
            <span>{tab.label}</span>
            {tab.badge !== undefined && tab.badge !== null && (
              <span
                className={`px-1.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                  tab.badgeTone === "warning"
                    ? isActive
                      ? "bg-amber-300 text-amber-950"
                      : "bg-amber-100 text-amber-800"
                    : isActive
                    ? "bg-white/20 text-white"
                    : "bg-slate-200 text-slate-700"
                }`}
              >
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
