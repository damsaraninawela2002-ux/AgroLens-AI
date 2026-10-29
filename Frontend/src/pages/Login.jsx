import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Flame,
  Globe,
  Lock,
  Mail,
  ShieldCheck,
  Sprout,
} from "lucide-react";
import Logo from "../components/ui/Logo";
import Input from "../components/ui/Input";
import Button from "../components/ui/Button";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { ROLE_REDIRECTS } from "../utils/constants";
import { extractErrorMessage } from "../utils/formatters";

export default function Login() {
  const { login } = useAuth();
  const { lang, toggleLanguage, t } = useLanguage();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [fieldErrors, setFieldErrors] = useState({});
  const [serverError, setServerError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const validate = () => {
    const errors = {};
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      errors.email = t("auth.login.errors.emailRequired");
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      errors.email = t("auth.login.errors.emailInvalid");
    }

    if (!password) {
      errors.password = t("auth.login.errors.passwordRequired");
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError("");

    if (!validate()) return;

    setSubmitting(true);
    try {
      const data = await login({
        email: email.trim().toLowerCase(),
        password,
      });

      toast.success(t("auth.login.welcomeToast"));
      const role = data?.user?.role || "farmer";
      const targetPath = ROLE_REDIRECTS[role] || "/farmer/dashboard";
      navigate(targetPath, { replace: true });
    } catch (err) {
      const status = err?.response?.status;
      let fallbackMsg =
        t("auth.login.errors.invalidCredentials") ||
        "Invalid email or password";
      if (status === 423 || status === 403) {
        fallbackMsg =
          t("auth.login.errors.accountLocked") ||
          "Account locked. Please try again later.";
      } else if (status === 429) {
        fallbackMsg =
          t("auth.login.errors.rateLimited") ||
          "Too many attempts. Please try again later.";
      }
      const msg = extractErrorMessage(err, fallbackMsg);
      setServerError(msg);
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
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-12 bg-[#f8faf5]">
      {/* Left Branded Green Panel */}
      <div className="lg:col-span-5 bg-gradient-to-br from-[#052e16] via-[#14532d] to-[#166534] text-white p-8 sm:p-12 flex flex-col justify-between relative overflow-hidden">
        <div
          className="pointer-events-none absolute -top-24 -right-24 w-80 h-80 rounded-full bg-[#84cc16]/15 blur-3xl"
          aria-hidden="true"
        />

        <div className="relative z-10 flex items-center justify-between">
          <Logo variant="light" size="md" />
          <button
            type="button"
            onClick={toggleLanguage}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/20 text-white border border-white/20 transition-colors cursor-pointer"
          >
            <Globe className="w-3.5 h-3.5 text-[#a3e635]" />
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
                <div key={idx} className="flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center shrink-0 text-[#a3e635]">
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">{b.title}</h3>
                    <p className="text-xs text-emerald-100/80 leading-relaxed mt-0.5">
                      {b.desc}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="relative z-10 text-xs text-emerald-200/70 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-[#a3e635]" />
          <span>© 2026 AgroLens AI • Sri Lanka</span>
        </div>
      </div>

      {/* Right Login Form Panel */}
      <div className="lg:col-span-7 flex items-center justify-center p-6 sm:p-12">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="w-full max-w-md bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 sm:p-8"
        >
          <div className="mb-6">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
              {t("auth.login.title")}
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              {t("auth.login.subtitle")}
            </p>
          </div>

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
            <Input
              label={t("auth.login.emailLabel")}
              type="email"
              name="email"
              autoComplete="email"
              placeholder={t("auth.login.emailPlaceholder")}
              icon={Mail}
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (fieldErrors.email) {
                  setFieldErrors((prev) => ({ ...prev, email: "" }));
                }
              }}
              error={fieldErrors.email}
              required
            />

            <Input
              label={t("auth.login.passwordLabel")}
              type="password"
              name="password"
              autoComplete="current-password"
              placeholder={t("auth.login.passwordPlaceholder")}
              icon={Lock}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (fieldErrors.password) {
                  setFieldErrors((prev) => ({ ...prev, password: "" }));
                }
              }}
              error={fieldErrors.password}
              required
            />

            <div className="flex items-center justify-between pt-1">
              <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-600 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-[#166534] focus:ring-[#166534]"
                />
                <span>{t("auth.login.rememberMe")}</span>
              </label>
            </div>

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
                  ? t("auth.login.submitting")
                  : t("auth.login.submitBtn")}
              </Button>
            </div>
          </form>

          <p className="mt-6 text-center text-sm text-slate-600">
            {t("auth.login.noAccount")}{" "}
            <Link
              to="/register"
              className="font-bold text-[#166534] hover:text-[#15803d] underline underline-offset-4"
            >
              {t("auth.login.createAccountLink")}
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
