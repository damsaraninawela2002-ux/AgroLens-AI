import { useId, useState } from "react";
import { Eye, EyeOff, AlertCircle } from "lucide-react";

export default function Input({
  label,
  id,
  type = "text",
  error = "",
  hint = "",
  icon: Icon = null,
  className = "",
  required = false,
  ...props
}) {
  const generatedId = useId();
  const inputId = id || generatedId;
  const [showPassword, setShowPassword] = useState(false);

  const isPassword = type === "password";
  const resolvedType = isPassword ? (showPassword ? "text" : "password") : type;

  return (
    <div className={`w-full ${className}`}>
      {label && (
        <label
          htmlFor={inputId}
          className="block text-sm font-semibold text-slate-700 mb-1.5"
        >
          {label}
          {required && <span className="text-[#dc2626] ml-0.5">*</span>}
        </label>
      )}

      <div className="relative">
        {Icon && (
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
            <Icon className="w-4 h-4" aria-hidden="true" />
          </div>
        )}

        <input
          id={inputId}
          type={resolvedType}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${inputId}-error` : undefined}
          className={`w-full rounded-xl bg-white px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 border transition-all duration-150 focus:outline-none focus:ring-2 ${
            Icon ? "pl-10" : ""
          } ${isPassword ? "pr-11" : ""} ${
            error
              ? "border-[#dc2626] focus:border-[#dc2626] focus:ring-[#dc2626]/20 bg-red-50/20"
              : "border-slate-200 hover:border-slate-300 focus:border-[#166534] focus:ring-[#166534]/20"
          }`}
          {...props}
        />

        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-400 hover:text-slate-600 focus:outline-none cursor-pointer"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? (
              <EyeOff className="w-4 h-4" aria-hidden="true" />
            ) : (
              <Eye className="w-4 h-4" aria-hidden="true" />
            )}
          </button>
        )}
      </div>

      {error && (
        <p
          id={`${inputId}-error`}
          role="alert"
          className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-[#dc2626]"
        >
          <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </p>
      )}

      {!error && hint && (
        <p className="mt-1.5 text-xs text-slate-500">{hint}</p>
      )}
    </div>
  );
}
