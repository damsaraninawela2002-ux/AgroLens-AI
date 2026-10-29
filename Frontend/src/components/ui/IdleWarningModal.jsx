import { Clock, LogOut, ShieldCheck } from "lucide-react";
import Button from "./Button";
import { useLanguage } from "../../context/LanguageContext";

export default function IdleWarningModal({
  isOpen,
  remainingSeconds = 60,
  onStaySignedIn,
  onLogout,
}) {
  const { t } = useLanguage();

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="idle-warning-title"
    >
      <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-xl p-6 space-y-5">
        <div className="flex items-start gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h3
              id="idle-warning-title"
              className="text-lg font-extrabold text-slate-900"
            >
              {t("idleTimeout.title") || "Session Timeout Warning"}
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              {t("idleTimeout.description") ||
                "You have been inactive. For your security, you will be automatically logged out in"}{" "}
              <span className="font-extrabold text-amber-700">
                {remainingSeconds}s
              </span>
              .
            </p>
          </div>
        </div>

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5 pt-2">
          <Button
            type="button"
            variant="outline"
            size="md"
            icon={LogOut}
            onClick={onLogout}
          >
            {t("idleTimeout.logoutNow") || "Log out"}
          </Button>
          <Button
            type="button"
            variant="primary"
            size="md"
            icon={ShieldCheck}
            onClick={onStaySignedIn}
          >
            {t("idleTimeout.staySignedIn") || "Stay signed in"}
          </Button>
        </div>
      </div>
    </div>
  );
}
