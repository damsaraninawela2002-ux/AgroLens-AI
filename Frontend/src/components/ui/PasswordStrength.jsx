import { Check, Circle } from "lucide-react";
import { useLanguage } from "../../context/LanguageContext";

export function evaluatePasswordRules(password = "", email = "") {
  const pwd = String(password || "");
  const hasMinLength = pwd.length >= 8;
  const hasLetter = /[A-Za-z]/.test(pwd);
  const hasNumber = /\d/.test(pwd);
  const hasBonus =
    pwd.length >= 12 ||
    (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd)) ||
    /[^A-Za-z0-9]/.test(pwd);
  const notEqualEmail =
    !email || !pwd || pwd.trim().toLowerCase() !== String(email).trim().toLowerCase();

  let score = 0;
  if (hasMinLength) score += 1;
  if (hasLetter) score += 1;
  if (hasNumber) score += 1;
  if (hasMinLength && hasLetter && hasNumber && hasBonus) score += 1;

  return {
    hasMinLength,
    hasLetter,
    hasNumber,
    notEqualEmail,
    isValid: hasMinLength && hasLetter && hasNumber && notEqualEmail,
    score,
  };
}

export default function PasswordStrength({ password = "", email = "" }) {
  const { t } = useLanguage();
  const { hasMinLength, hasLetter, hasNumber, score } = evaluatePasswordRules(
    password,
    email
  );

  const levelLabels = [
    t("passwordStrength.weak") || "Weak",
    t("passwordStrength.weak") || "Weak",
    t("passwordStrength.fair") || "Fair",
    t("passwordStrength.good") || "Good",
    t("passwordStrength.strong") || "Strong",
  ];

  const barColors = [
    "bg-slate-200",
    "bg-red-500",
    "bg-amber-500",
    "bg-lime-500",
    "bg-[#166534]",
  ];

  const rules = [
    {
      key: "length",
      passed: hasMinLength,
      label: t("passwordStrength.ruleLength") || "8+ characters",
    },
    {
      key: "letter",
      passed: hasLetter,
      label: t("passwordStrength.ruleLetter") || "At least one letter",
    },
    {
      key: "number",
      passed: hasNumber,
      label: t("passwordStrength.ruleNumber") || "At least one number",
    },
  ];

  const activeColor = barColors[score] || "bg-slate-200";

  return (
    <div className="mt-2 space-y-2" aria-live="polite">
      {/* 4-step strength bar */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600">
          <span>{t("passwordStrength.label") || "Password strength"}</span>
          {password ? (
            <span className="font-bold text-slate-800">{levelLabels[score]}</span>
          ) : null}
        </div>
        <div className="grid grid-cols-4 gap-1.5" role="progressbar" aria-valuenow={score} aria-valuemin={0} aria-valuemax={4}>
          {[1, 2, 3, 4].map((step) => (
            <div
              key={step}
              className={`h-1.5 rounded-full transition-colors duration-200 ${
                password && score >= step ? activeColor : "bg-slate-200"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Live rules with green ticks */}
      <ul className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 pt-0.5">
        {rules.map((rule) => (
          <li
            key={rule.key}
            className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${
              rule.passed ? "text-emerald-700" : "text-slate-500"
            }`}
          >
            {rule.passed ? (
              <span className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                <Check className="w-3 h-3 stroke-[3]" />
              </span>
            ) : (
              <Circle className="w-3.5 h-3.5 text-slate-300 shrink-0" />
            )}
            <span>{rule.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
