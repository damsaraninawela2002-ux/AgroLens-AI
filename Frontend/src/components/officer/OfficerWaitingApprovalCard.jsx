import { useState } from "react";
import toast from "react-hot-toast";
import { Clock, Mail, MapPin, RefreshCw, ShieldAlert } from "lucide-react";
import Card from "../ui/Card";
import Button from "../ui/Button";
import Badge from "../ui/Badge";
import { useAuth } from "../../context/AuthContext";
import { useLanguage } from "../../context/LanguageContext";
import { formatDate } from "../../utils/formatters";

export default function OfficerWaitingApprovalCard() {
  const { user, refreshUser } = useAuth();
  const { lang, t } = useLanguage();
  const [checking, setChecking] = useState(false);

  const handleCheckStatus = async () => {
    setChecking(true);
    try {
      const updated = await refreshUser();
      if (updated?.is_approved) {
        toast.success(t("officer.waitingApproval.approvedToast"));
      } else {
        toast(t("officer.waitingApproval.stillPendingToast"), {
          icon: "⏳",
        });
      }
    } catch {
      toast.error(t("officer.waitingApproval.stillPendingToast"));
    } finally {
      setChecking(false);
    }
  };

  return (
    <Card className="max-w-2xl mx-auto py-12 px-6 sm:px-10 text-center space-y-6 border-amber-200/90 bg-gradient-to-b from-amber-50/50 to-white">
      <div className="w-20 h-20 mx-auto rounded-3xl bg-amber-100 border border-amber-200 text-amber-800 flex items-center justify-center shadow-inner">
        <Clock className="w-10 h-10" />
      </div>

      <div className="space-y-2.5">
        <div className="flex justify-center">
          <Badge variant="warning" icon={ShieldAlert}>
            {t("officer.waitingApproval.badge")}
          </Badge>
        </div>

        <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900">
          {t("officer.waitingApproval.title")}
        </h2>

        <p className="text-sm text-slate-600 max-w-lg mx-auto leading-relaxed">
          {t("officer.waitingApproval.subtitle")}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-left max-w-xl mx-auto">
        <div className="p-3.5 rounded-2xl bg-[#f8faf5] border border-slate-200/80 space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5 text-[#166534]" />
            {t("officer.waitingApproval.districtLabel")}
          </span>
          <p className="text-sm font-extrabold text-slate-900 truncate">
            {user?.district || "Sri Lanka"}
          </p>
        </div>

        <div className="p-3.5 rounded-2xl bg-[#f8faf5] border border-slate-200/80 space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
            <Mail className="w-3.5 h-3.5 text-[#166534]" />
            {t("officer.waitingApproval.emailLabel")}
          </span>
          <p className="text-sm font-bold text-slate-900 truncate">
            {user?.email}
          </p>
        </div>

        <div className="p-3.5 rounded-2xl bg-[#f8faf5] border border-slate-200/80 space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-[#166534]" />
            {t("officer.waitingApproval.registeredLabel")}
          </span>
          <p className="text-sm font-bold text-slate-900 truncate">
            {formatDate(user?.created_at, lang)}
          </p>
        </div>
      </div>

      <div className="pt-2">
        <Button
          variant="primary"
          size="md"
          icon={RefreshCw}
          loading={checking}
          onClick={handleCheckStatus}
        >
          {checking
            ? t("officer.waitingApproval.checkingBtn")
            : t("officer.waitingApproval.checkStatusBtn")}
        </Button>
      </div>
    </Card>
  );
}
