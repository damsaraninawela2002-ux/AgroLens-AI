import { useMemo, useState } from "react";
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
  User,
  UserCheck,
} from "lucide-react";
import Logo from "../components/ui/Logo";
import Input from "../components/ui/Input";
import Select from "../components/ui/Select";
import Button from "../components/ui/Button";
import PasswordStrength, {
  evaluatePasswordRules,
} from "../components/ui/PasswordStrength";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { SRI_LANKAN_DISTRICTS } from "../utils/constants";
import { extractErrorMessage } from "../utils/formatters";

export default function Register() {
  const { register } = useAuth();
  const { lang, setLanguage, toggleLanguage, t } = useLanguage();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState("farmer");
  const [district, setDistrict] = useState("");
  const [preferredLanguage, setPreferredLanguage] = useState(lang || "en");

  const [fieldErrors, setFieldErrors] = useState({});
  const [serverError, setServerError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const districtOptions = useMemo(
    () =>
      SRI_LANKAN_DISTRICTS.map((d) => ({
        value: d.value,
        label: lang === "si" ? d.labelSi : d.labelEn,
        subLabel: lang === "si" ? d.labelEn : d.labelSi,
      })),
    [lang]
  );

  const validate = () => {
    const errors = {};
    if (fullName.trim().length < 2) {
      errors.fullName = t("auth.register.errors.fullNameRequired");
    }

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      errors.email = t("auth.register.errors.emailRequired");
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      errors.email = t("auth.register.errors.emailInvalid");
    }

    const pwdRules = evaluatePasswordRules(password, trimmedEmail);
    if (!password || !pwdRules.hasMinLength) {
      errors.password = t("auth.register.errors.passwordLength");
    } else if (!pwdRules.hasLetter || !pwdRules.hasNumber) {
      errors.password =
        t("auth.register.errors.passwordComplexity") ||
        t("auth.register.errors.passwordLength");
    } else if (!pwdRules.notEqualEmail) {
      errors.password =
        t("auth.register.errors.passwordEqualsEmail") ||
        t("auth.register.errors.passwordLength");
    }

    if (password !== confirmPassword) {
      errors.confirmPassword = t("auth.register.errors.passwordMismatch");
    }

    if (role !== "farmer" && role !== "officer") {
      errors.role = t("auth.register.errors.roleRequired");
    }

    if (!district) {
      errors.district = t("auth.register.errors.districtRequired");
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
      await register({
        full_name: fullName.trim(),
        email: email.trim().toLowerCase(),
        password,
        role,
        district,
        preferred_language: preferredLanguage,
      });

      setLanguage(preferredLanguage);
      toast.success(t("auth.register.successToast"));
      navigate("/login");
    } catch (err) {
      const msg = extractErrorMessage(
        err,
        "Registration failed. Please check your details and try again."
      );
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

  const roleCards = [
    {
      id: "farmer",
      icon: Sprout,
      title: t("auth.register.roleFarmerTitle"),
      desc: t("auth.register.roleFarmerDesc"),
    },
    {
      id: "officer",
      icon: UserCheck,
      title: t("auth.register.roleOfficerTitle"),
      desc: t("auth.register.roleOfficerDesc"),
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

      {/* Right Registration Form Panel */}
      <div className="lg:col-span-7 flex items-center justify-center p-6 sm:p-10">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="w-full max-w-xl bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 sm:p-8"
        >
          <div className="mb-6">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
              {t("auth.register.title")}
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              {t("auth.register.subtitle")}
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
            {/* Role Selection Cards */}
            <div>
              <span className="block text-sm font-semibold text-slate-700 mb-2">
                {t("auth.register.roleLabel")}{" "}
                <span className="text-[#dc2626]">*</span>
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {roleCards.map((rc) => {
                  const Icon = rc.icon;
                  const selected = role === rc.id;
                  return (
                    <button
                      key={rc.id}
                      type="button"
                      onClick={() => setRole(rc.id)}
                      aria-pressed={selected}
                      className={`flex items-start gap-3 p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                        selected
                          ? "border-[#166534] bg-emerald-50/70 ring-2 ring-[#166534]/20"
                          : "border-slate-200 hover:border-slate-300 bg-white"
                      }`}
                    >
                      <div
                        className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                          selected
                            ? "bg-[#166534] text-white"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <p
                          className={`text-sm font-bold ${
                            selected ? "text-[#166534]" : "text-slate-800"
                          }`}
                        >
                          {rc.title}
                        </p>
                        <p className="text-xs text-slate-500 leading-snug mt-0.5">
                          {rc.desc}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Full Name & Email */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label={t("auth.register.fullNameLabel")}
                name="fullName"
                autoComplete="name"
                placeholder={t("auth.register.fullNamePlaceholder")}
                icon={User}
                value={fullName}
                onChange={(e) => {
                  setFullName(e.target.value);
                  if (fieldErrors.fullName) {
                    setFieldErrors((prev) => ({ ...prev, fullName: "" }));
                  }
                }}
                error={fieldErrors.fullName}
                required
              />

              <Input
                label={t("auth.register.emailLabel")}
                type="email"
                name="email"
                autoComplete="email"
                placeholder={t("auth.register.emailPlaceholder")}
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
            </div>

            {/* Password & Confirm Password */}
            <div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label={t("auth.register.passwordLabel")}
                  type="password"
                  name="password"
                  autoComplete="new-password"
                  placeholder={t("auth.register.passwordPlaceholder")}
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

                <Input
                  label={t("auth.register.confirmPasswordLabel")}
                  type="password"
                  name="confirmPassword"
                  autoComplete="new-password"
                  placeholder={t("auth.register.confirmPasswordPlaceholder")}
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
              </div>
              <PasswordStrength password={password} email={email} />
            </div>

            {/* Searchable District Select & Preferred Language */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Select
                label={t("auth.register.districtLabel")}
                options={districtOptions}
                value={district}
                onChange={(val) => {
                  setDistrict(val);
                  if (fieldErrors.district) {
                    setFieldErrors((prev) => ({ ...prev, district: "" }));
                  }
                }}
                placeholder={t("auth.register.districtPlaceholder")}
                searchPlaceholder={t("auth.register.districtSearchPlaceholder")}
                noResultsText={t("auth.register.districtNoResults")}
                error={fieldErrors.district}
                required
              />

              <div>
                <span className="block text-sm font-semibold text-slate-700 mb-1.5">
                  {t("auth.register.languageLabel")}{" "}
                  <span className="text-[#dc2626]">*</span>
                </span>
                <div className="grid grid-cols-2 gap-2.5">
                  {[
                    { code: "si", label: t("auth.register.langSi") },
                    { code: "en", label: t("auth.register.langEn") },
                  ].map((item) => {
                    const active = preferredLanguage === item.code;
                    return (
                      <button
                        key={item.code}
                        type="button"
                        onClick={() => setPreferredLanguage(item.code)}
                        className={`px-3 py-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                          active
                            ? "border-[#166534] bg-emerald-50 text-[#166534]"
                            : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                        }`}
                      >
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="pt-2">
              <Button
                type="submit"
                variant="primary"
                size="lg"
                fullWidth
                loading={submitting}
                icon={ArrowRight}
                iconPosition="right"
              >
                {submitting
                  ? t("auth.register.submitting")
                  : t("auth.register.submitBtn")}
              </Button>
            </div>
          </form>

          <p className="mt-6 text-center text-sm text-slate-600">
            {t("auth.register.hasAccount")}{" "}
            <Link
              to="/login"
              className="font-bold text-[#166534] hover:text-[#15803d] underline underline-offset-4"
            >
              {t("auth.register.signInLink")}
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
