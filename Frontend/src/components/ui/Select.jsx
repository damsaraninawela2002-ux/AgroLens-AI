import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, MapPin, Search, AlertCircle } from "lucide-react";

/**
 * Searchable Select component tailored for selecting from the 25 Sri Lankan districts
 * or any list of { value, label } options.
 */
export default function Select({
  label,
  options = [],
  value = "",
  onChange,
  placeholder = "Select an option...",
  searchPlaceholder = "Type to search...",
  noResultsText = "No matching option found",
  error = "",
  required = false,
  icon: Icon = MapPin,
  className = "",
}) {
  const selectId = useId();
  const containerRef = useRef(null);
  const searchInputRef = useRef(null);

  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selectedOption = useMemo(
    () => options.find((opt) => opt.value === value) || null,
    [options, value]
  );

  const filteredOptions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(q) ||
        opt.value.toLowerCase().includes(q) ||
        (opt.subLabel && opt.subLabel.toLowerCase().includes(q))
    );
  }, [options, query]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target)
      ) {
        setIsOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Focus search input when opened
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  const handleSelect = (optValue) => {
    onChange(optValue);
    setIsOpen(false);
    setQuery("");
  };

  return (
    <div ref={containerRef} className={`w-full relative ${className}`}>
      {label && (
        <label
          id={`${selectId}-label`}
          htmlFor={`${selectId}-trigger`}
          className="block text-sm font-semibold text-slate-700 mb-1.5"
        >
          {label}
          {required && <span className="text-[#dc2626] ml-0.5">*</span>}
        </label>
      )}

      <button
        id={`${selectId}-trigger`}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-labelledby={`${selectId}-label`}
        onClick={() => setIsOpen((prev) => !prev)}
        className={`w-full flex items-center justify-between rounded-xl bg-white px-3.5 py-2.5 text-sm text-left border transition-all duration-150 focus:outline-none focus:ring-2 cursor-pointer ${
          error
            ? "border-[#dc2626] focus:border-[#dc2626] focus:ring-[#dc2626]/20"
            : isOpen
            ? "border-[#166534] ring-2 ring-[#166534]/20"
            : "border-slate-200 hover:border-slate-300 focus:border-[#166534] focus:ring-[#166534]/20"
        }`}
      >
        <span className="flex items-center gap-2.5 truncate">
          {Icon && (
            <Icon className="w-4 h-4 text-slate-400 shrink-0" aria-hidden="true" />
          )}
          {selectedOption ? (
            <span className="text-slate-900 font-medium truncate">
              {selectedOption.label}
              {selectedOption.subLabel ? (
                <span className="text-slate-500 font-normal ml-1.5">
                  ({selectedOption.subLabel})
                </span>
              ) : null}
            </span>
          ) : (
            <span className="text-slate-400">{placeholder}</span>
          )}
        </span>

        <ChevronDown
          className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-150 ${
            isOpen ? "rotate-180 text-[#166534]" : ""
          }`}
          aria-hidden="true"
        />
      </button>

      {isOpen && (
        <div
          role="listbox"
          aria-labelledby={`${selectId}-label`}
          className="absolute z-40 mt-1.5 w-full rounded-2xl bg-white border border-slate-200 shadow-xl shadow-slate-900/10 overflow-hidden"
        >
          {/* Search Input */}
          <div className="p-2 border-b border-slate-100 bg-slate-50/70">
            <div className="relative">
              <Search
                className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2"
                aria-hidden="true"
              />
              <input
                ref={searchInputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full rounded-lg bg-white pl-9 pr-3 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 border border-slate-200 focus:outline-none focus:border-[#166534]"
              />
            </div>
          </div>

          {/* Options List */}
          <div className="max-h-56 overflow-y-auto p-1.5 divide-y divide-slate-50">
            {filteredOptions.length === 0 ? (
              <div className="py-4 px-3 text-center text-xs text-slate-500">
                {noResultsText}
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = opt.value === value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => handleSelect(opt.value)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm text-left transition-colors cursor-pointer ${
                      isSelected
                        ? "bg-emerald-50 text-[#166534] font-semibold"
                        : "text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <span className="truncate">
                      {opt.label}
                      {opt.subLabel ? (
                        <span className="text-slate-500 font-normal ml-1.5 text-xs">
                          ({opt.subLabel})
                        </span>
                      ) : null}
                    </span>
                    {isSelected && (
                      <Check
                        className="w-4 h-4 text-[#166534] shrink-0"
                        aria-hidden="true"
                      />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}

      {error && (
        <p
          role="alert"
          className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-[#dc2626]"
        >
          <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}
