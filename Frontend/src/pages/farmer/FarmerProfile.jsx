import { useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import {
  AlertTriangle,
  Calendar,
  Globe,
  LogOut,
  Mail,
  MapPin,
  ShieldCheck,
  User,
} from "lucide-react";
import Card from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import FadeIn from "../../components/common/FadeIn";
import { useAuth } from "../../context/AuthContext";
import { useLanguage } from "../../context/LanguageContext";
import api from "../../services/api";
import { extractErrorMessage, formatDate } from "../../utils/formatters";

export default function FarmerProfile() {
  const { user, logout } = useAuth();
  const { lang, setLanguage, t } = useLanguage();
  const navigate = useNavigate();

  const [showLogoutAllModal, setShowLogoutAllModal] = useState(false);
  const [loggingOutAll, setLoggingOutAll] = useState(false);

  const handleConfirmLogoutAll = async () => {
    setLoggingOutAll(true);
    try {
      await api.post("/api/auth/logout-all");
      toast.success(
        t("profile.logoutAllToast") || "Logged out from all devices"
      );
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setLoggingOutAll(false);
      setShowLogoutAllModal(false);
      await logout();
      navigate("/login", { replace: true });
    }
  };

  const details = [
    {
      icon: User,
      label: t("profile.fullName"),
      value: user?.full_name || "—",
    },
    {
      icon: Mail,
      label: t("profile.email"),
      value: user?.email || "—",
    },
    {
      icon: ShieldCheck,
      label: t("profile.role"),
      value: (user?.role || "farmer").toUpperCase(),
    },
    {
      icon: MapPin,
      label: t("profile.district"),
      value: user?.district || "—",
    },
    {
      icon: Globe,
      label: t("profile.preferredLanguage"),
      value:
        user?.preferred_language === "si"
          ? "සිංහල (Sinhala)"
          : "English",
    },
    {
      icon: Calendar,
      label: t("profile.memberSince"),
      value: formatDate(user?.created_at, lang) || "—",
    },
  ];

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
          {t("profile.pageTitle")}
        </h2>
        <p className="text-sm text-slate-600 mt-1">
          {t("profile.pageSubtitle")}
        </p>
      </div>

      {/* Main Profile Card */}
      <FadeIn>
        <Card className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 pb-5 border-b border-slate-100">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#166534] to-[#65a30d] text-white flex items-center justify-center text-2xl font-extrabold shadow-md shadow-[#166534]/20 shrink-0">
              {user?.full_name?.charAt(0)?.toUpperCase() || "F"}
            </div>
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-xl font-extrabold text-slate-900">
                  {user?.full_name}
                </h3>
                <Badge variant="success" icon={User}>
                  {user?.role?.toUpperCase()}
                </Badge>
              </div>
              <p className="text-sm text-slate-500 break-words">{user?.email}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {details.map((item, idx) => {
              const Icon = item.icon;
              return (
                <FadeIn key={idx} delay={idx * 80} className="h-full">
                  <div className="p-4 rounded-xl bg-[#f8faf5] border border-slate-200/80 flex items-start gap-3.5 h-full">
                    <div className="w-11 h-11 rounded-lg bg-emerald-100 text-[#166534] flex items-center justify-center shrink-0">
                      <Icon className="w-6 h-6" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-500">
                        {item.label}
                      </p>
                      <p className="text-sm font-bold text-slate-900 break-words mt-0.5">
                        {item.value}
                      </p>
                    </div>
                  </div>
                </FadeIn>
              );
            })}
          </div>
        </Card>
      </FadeIn>

      {/* Interface Language Switcher Card */}
      <FadeIn delay={80}>
        <Card className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <Globe className="w-6 h-6 text-[#166534] shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h3 className="text-base font-bold text-slate-900">
                {t("profile.uiLanguageTitle")}
              </h3>
              <p className="text-xs text-slate-600">
                {t("profile.uiLanguageDesc")}
              </p>
            </div>
          </div>

          <div className="inline-flex rounded-xl bg-slate-100 p-1 w-full sm:w-auto">
            {[
              { code: "en", label: "English" },
              { code: "si", label: "සිංහල" },
            ].map((opt) => (
              <button
                key={opt.code}
                type="button"
                onClick={() => setLanguage(opt.code)}
                className={`btn-interactive flex-1 sm:flex-initial min-h-[48px] h-auto px-4 py-2.5 rounded-lg text-xs font-bold leading-[1.7] whitespace-normal break-words transition-all cursor-pointer ${
                  lang === opt.code
                    ? "bg-[#166534] text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </Card>
      </FadeIn>

      {/* Active Sessions / Log Out of All Devices Card */}
      <FadeIn delay={160}>
        <Card className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-red-200/70">
          <div className="flex items-start gap-3">
            <LogOut className="w-6 h-6 text-[#dc2626] shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h3 className="text-base font-bold text-slate-900">
                {t("profile.devicesCardTitle") || "Active Sessions"}
              </h3>
              <p className="text-xs text-slate-600">
                {t("profile.devicesCardDesc") ||
                  "Sign out of all active sessions across your phones, tablets, and computers."}
              </p>
            </div>
          </div>

          <Button
            type="button"
            variant="danger"
            size="sm"
            icon={LogOut}
            onClick={() => setShowLogoutAllModal(true)}
            className="w-full sm:w-auto shrink-0"
          >
            {t("profile.logoutAllBtn") || "Log out of all devices"}
          </Button>
        </Card>
      </FadeIn>

      {/* Confirm Dialog for Log out of all devices */}
      {showLogoutAllModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="logout-all-modal-title"
        >
          <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-xl p-6 space-y-5">
            <div className="flex items-start gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-red-100 text-[#dc2626] flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3
                  id="logout-all-modal-title"
                  className="text-lg font-extrabold text-slate-900"
                >
                  {t("profile.logoutAllConfirmTitle") ||
                    "Log out of all devices?"}
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {t("profile.logoutAllConfirmDesc") ||
                    "This will immediately revoke all active sessions on every device and sign you out."}
                </p>
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5 pt-2">
              <Button
                type="button"
                variant="outline"
                size="md"
                disabled={loggingOutAll}
                onClick={() => setShowLogoutAllModal(false)}
              >
                {t("profile.logoutAllCancelBtn") || "Cancel"}
              </Button>
              <Button
                type="button"
                variant="danger"
                size="md"
                icon={LogOut}
                loading={loggingOutAll}
                disabled={loggingOutAll}
                onClick={handleConfirmLogoutAll}
              >
                {t("profile.logoutAllConfirmBtn") || "Log out of all devices"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
