import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";

export default function SearchInput({
  value = "",
  onChange,
  placeholder = "Search...",
  debounceMs = 400,
  className = "",
}) {
  const [draft, setDraft] = useState(null);
  const timerRef = useRef(null);

  const displayValue = draft !== null ? draft : value;

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleInputChange = (e) => {
    const nextVal = e.target.value;
    setDraft(nextVal);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setDraft(null);
      onChange?.(nextVal);
    }, debounceMs);
  };

  const handleClear = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setDraft(null);
    onChange?.("");
  };

  return (
    <div className={`relative flex-1 min-w-[200px] ${className}`}>
      <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
      <input
        type="text"
        value={displayValue}
        onChange={handleInputChange}
        placeholder={placeholder}
        className="w-full pl-9 pr-9 py-2.5 rounded-xl bg-[#f8faf5] border border-slate-200 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#166534]/20 focus:border-[#166534] transition-all"
      />
      {displayValue && (
        <button
          type="button"
          onClick={handleClear}
          aria-label="Clear search"
          className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
