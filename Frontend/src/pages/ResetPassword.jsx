import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Flame,
  Globe,
  Lock,
  ShieldCheck,
  Sprout,
} from "lucide-react";
import Logo from "../components/ui/Logo";
import Input from "../components/ui/Input";
import Button from "../components/ui/Button";
import PasswordStrength, {
  evaluatePasswordRules,
} from "../components/ui/PasswordStrength";
import FadeIn from "../components/common/FadeIn";
import { useLanguage } from "../context/LanguageContext";
import { resetPassword } from "../services/authService";
import { extractErrorMessage } from "../utils/formatters";

export default function ResetPassword() {
  const { lang, toggleLanguage, t } = useLanguage();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = (searchParams.get("token") || "").trim();

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [serverError, setServerError] = useState("");
  const [tokenInvalid, setTokenInvalid] = useState(!token);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    setTokenInvalid(!token);
  }, [token]);

  useEffect(() => {
    if (!success) return undefined;
    const timer = setTimeout(() => {
      navigate("/login", { replace: true });
    }, 3000);
    return () => clearTimeout(timer);
  }, [success, navigate]);

  const validate = () => {
    const errors = {};
    const pwRules = evaluatePasswordRules(newPassword);

    if (!newPassword) {
      errors.newPassword = t("auth.resetPassword.errors.passwordRequired");
    } else if (!pwRules.minLength) {
      errors.newPassword = t("auth.resetPassword.errors.passwordLength");
    } else if (!pwRules.hasLetter || !pwRules.hasNumber) {
      errors.newPassword = t("auth.resetPassword.errors.passwordComplexity");
    }

    if (confirmPassword !== newPassword) {
      errors.confirmPassword = t("auth.resetPassword.errors.passwordMismatch");
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError("");

    if (!token) {
      setTokenInvalid(true);
      return;
    }

    if (!validate()) return;

    setSubmitting(true);
    try {
      await resetPassword({
        token,
        new_password: newPassword,
      });
      setSuccess(true);
      toast.success(t("auth.resetPassword.successTitle"));
    } catch (err) {
      const fallbackMsg =
        t("auth.resetPassword.errors.invalidOrExpired") ||
        "Invalid or expired password reset link.";
      const msg = extractErrorMessage(err, fallbackMsg);
      setServerError(msg);
      const lower = (msg || "").toLowerCase();
      if (lower.includes("invalid") || lower.includes("expired")) {
        setTokenInvalid(true);
      }
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const benefits = [
    {
      icon: Sprout,
      title: t("auth.benefit1Title"),
      desc: t("auth.benefit1Desc"),
    },
    {
      icon: Flame,
      title: t("auth.benefit2Title"),
      desc: t("auth.benefit2Desc"),
    },
    {
      icon: ShieldCheck,
      title: t("auth.benefit3Title"),
      desc: t("auth.benefit3Desc"),
    },
  ];

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-12 bg-[#f8faf5] overflow-x-hidden">
      {/* Left Branded Green Panel */}
      <div className="lg:col-span-5 bg-gradient-to-br from-[#052e16] via-[#14532d] to-[#166534] text-white px-4 py-8 sm:p-12 flex flex-col justify-between relative overflow-hidden">
        <div
          className="pointer-events-none absolute -top-24 -right-24 w-80 h-80 rounded-full bg-[#84cc16]/15 blur-3xl"
          aria-hidden="true"
        />

        <div className="relative z-10 flex items-center justify-between gap-2">
          <Logo variant="light" size="md" />
          <button
            type="button"
            onClick={toggleLanguage}
            className="btn-interactive inline-flex items-center gap-2 min-h-[48px] px-3.5 py-2.5 rounded-xl text-xs font-bold leading-[1.7] bg-white/10 hover:bg-white/20 text-white border border-white/20 transition-colors cursor-pointer"
          >
            <Globe className="w-5 h-5 text-[#a3e635] shrink-0" />
            <span>{lang === "en" ? "සිංහල" : "English"}</span>
          </button>
        </div>

        <div className="relative z-10 my-10 space-y-6">
          <p className="text-xl sm:text-2xl font-bold leading-snug text-white">
            {t("auth.panelTagline")}
          </p>

          <div className="space-y-5 pt-2">
            {benefits.map((b, idx) => {
              const Icon = b.icon;
              return (
                <FadeIn key={idx} delay={idx * 80}>
                  <div className="flex items-start gap-3.5">
                    <div className="w-11 h-11 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center shrink-0 text-[#a3e635]">
                      <Icon className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white">{b.title}</h3>
                      <p className="text-xs text-emerald-100/80 leading-relaxed mt-0.5">
                        {b.desc}
                      </p>
                    </div>
                  </div>
                </FadeIn>
              );
            })}
          </div>
        </div>

        <div className="relative z-10 text-xs text-emerald-200/70 flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-[#a3e635] shrink-0" />
          <span>© 2026 AgroLens AI • Sri Lanka</span>
        </div>
      </div>

      {/* Right Form Panel */}
      <div className="lg:col-span-7 flex items-center justify-center px-4 py-8 sm:p-12">
        <FadeIn className="w-full max-w-md">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="w-full bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 sm:p-8"
          >
            <div className="mb-6">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
                {t("auth.resetPassword.title")}
              </h1>
              <p className="text-sm text-slate-600 mt-1">
                {t("auth.resetPassword.subtitle")}
              </p>
            </div>

            {success ? (
              <div className="space-y-5">
                <div
                  role="status"
                  className="rounded-xl bg-[#f0fdf4] border border-[#bbf7d0] p-4 flex items-start gap-3"
                >
                  <CheckCircle2 className="w-5 h-5 text-[#16a34a] shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <h2 className="text-sm font-bold text-[#14532d]">
                      {t("auth.resetPassword.successTitle")}
                    </h2>
                    <p className="text-xs text-[#166534] leading-relaxed">
                      {t("auth.resetPassword.successMessage")}
                    </p>
                  </div>
                </div>

                <Link
                  to="/login"
                  className="btn-interactive inline-flex items-center justify-center gap-2 w-full min-h-[48px] px-5 py-3 rounded-xl text-sm font-semibold bg-[#166534] hover:bg-[#15803d] text-white shadow-sm transition-colors"
                >
                  <ArrowLeft className="w-4 h-4 shrink-0" />
                  <span>{t("auth.resetPassword.backToLogin")}</span>
                </Link>
              </div>
            ) : !token || tokenInvalid ? (
              <div className="space-y-5">
                <div
                  role="alert"
                  className="rounded-xl bg-red-50 border border-red-200 p-4 flex items-start gap-3 text-xs text-[#dc2626]"
                >
                  <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <h2 className="text-sm font-bold text-red-900">
                      {t("auth.resetPassword.invalidLinkTitle")}
                    </h2>
                    <p className="text-xs text-red-700 leading-relaxed">
                      {serverError || t("auth.resetPassword.invalidLinkMessage")}
                    </p>
                  </div>
                </div>

                <Link
                  to="/forgot-password"
                  className="btn-interactive inline-flex items-center justify-center gap-2 w-full min-h-[48px] px-5 py-3 rounded-xl text-sm font-semibold bg-[#166534] hover:bg-[#15803d] text-white shadow-sm transition-colors"
                >
                  <span>{t("auth.resetPassword.requestNewLink")}</span>
                  <ArrowRight className="w-4 h-4 shrink-0" />
                </Link>

                <div className="text-center pt-1">
                  <Link
                    to="/login"
                    className="inline-flex items-center gap-1.5 text-sm font-bold text-[#166534] hover:text-[#15803d] underline underline-offset-4"
                  >
                    <ArrowLeft className="w-4 h-4 shrink-0" />
                    <span>{t("auth.resetPassword.backToLogin")}</span>
                  </Link>
                </div>
              </div>
            ) : (
              <>
                {serverError && (
                  <div
                    role="alert"
                    className="mb-5 rounded-xl bg-red-50 border border-red-200 p-3.5 flex items-start gap-2.5 text-xs font-medium text-[#dc2626]"
                  >
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{serverError}</span>
                  </div>
                )}

                <form onSubmit={handleSubmit} noValidate className="space-y-4">
                  <div>
                    <Input
                      label={t("auth.resetPassword.newPasswordLabel")}
                      type="password"
                      name="newPassword"
                      autoComplete="new-password"
                      placeholder={t("auth.resetPassword.newPasswordPlaceholder")}
                      icon={Lock}
                      value={newPassword}
                      onChange={(e) => {
                        setNewPassword(e.target.value);
                        if (fieldErrors.newPassword) {
                          setFieldErrors((prev) => ({
                            ...prev,
                            newPassword: "",
                          }));
                        }
                      }}
                      error={fieldErrors.newPassword}
                      required
                    />
                    <PasswordStrength password={newPassword} />
                  </div>

                  <Input
                    label={t("auth.resetPassword.confirmPasswordLabel")}
                    type="password"
                    name="confirmPassword"
                    autoComplete="new-password"
                    placeholder={t("auth.resetPassword.confirmPasswordPlaceholder")}
                    icon={Lock}
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      if (fieldErrors.confirmPassword) {
                        setFieldErrors((prev) => ({
                          ...prev,
                          confirmPassword: "",
                        }));
                      }
                    }}
                    error={fieldErrors.confirmPassword}
                    required
                  />

                  <div className="pt-2">
                    <Button
                      type="submit"
                      variant="primary"
                      size="lg"
                      fullWidth
                      loading={submitting}
                      disabled={submitting}
                      icon={ArrowRight}
                      iconPosition="right"
                    >
                      {submitting
                        ? t("auth.resetPassword.submitting")
                        : t("auth.resetPassword.submitBtn")}
                    </Button>
                  </div>
                </form>

                <div className="mt-6 text-center">
                  <Link
                    to="/login"
                    className="inline-flex items-center gap-1.5 text-sm font-bold text-[#166534] hover:text-[#15803d] underline underline-offset-4"
                  >
                    <ArrowLeft className="w-4 h-4 shrink-0" />
                    <span>{t("auth.resetPassword.backToLogin")}</span>
                  </Link>
                </div>
              </>
            )}
          </motion.div>
        </FadeIn>
      </div>
    </div>
  );
}
