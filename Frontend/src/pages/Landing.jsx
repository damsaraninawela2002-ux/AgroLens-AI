import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Bot,
  Camera,
  CheckCircle2,
  Cpu,
  Eye,
  FileCheck2,
  Flame,
  Globe2,
  Layers,
  Leaf,
  MapPinned,
  Microscope,
  Radio,
  ScanLine,
  ShieldCheck,
  Sparkles,
  Sprout,
  UserCheck,
  Users,
} from "lucide-react";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import Badge from "../components/ui/Badge";
import TechStackAssembly from "../components/landing/TechStackAssembly";
import { useLanguage } from "../context/LanguageContext";
import { useAuth } from "../context/AuthContext";
import { ROLE_REDIRECTS } from "../utils/constants";

const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: "easeOut" } },
};

export default function Landing() {
  const { t } = useLanguage();
  const { isAuthenticated, user } = useAuth();

  const primaryCtaPath = isAuthenticated
    ? ROLE_REDIRECTS[user?.role] || "/farmer/dashboard"
    : "/register";

  const stats = [
    {
      icon: Sprout,
      label: t("stats.cropsLabel"),
      value: t("stats.cropsValue"),
    },
    {
      icon: Layers,
      label: t("stats.classesLabel"),
      value: t("stats.classesValue"),
    },
    {
      icon: Globe2,
      label: t("stats.languagesLabel"),
      value: t("stats.languagesValue"),
    },
    {
      icon: ShieldCheck,
      label: t("stats.verificationLabel"),
      value: t("stats.verificationValue"),
    },
  ];

  const features = [
    {
      icon: Microscope,
      title: t("features.items.detection.title"),
      desc: t("features.items.detection.desc"),
      status: "live",
    },
    {
      icon: Flame,
      title: t("features.items.gradcam.title"),
      desc: t("features.items.gradcam.desc"),
      status: "live",
    },
    {
      icon: Bot,
      title: t("features.items.chatbot.title"),
      desc: t("features.items.chatbot.desc"),
      status: "soon",
    },
    {
      icon: UserCheck,
      title: t("features.items.officer.title"),
      desc: t("features.items.officer.desc"),
      status: "soon",
    },
    {
      icon: MapPinned,
      title: t("features.items.outbreakMap.title"),
      desc: t("features.items.outbreakMap.desc"),
      status: "soon",
    },
    {
      icon: Radio,
      title: t("features.items.iot.title"),
      desc: t("features.items.iot.desc"),
      status: "soon",
    },
  ];

  const steps = [
    {
      icon: Camera,
      title: t("howItWorks.step1Title"),
      desc: t("howItWorks.step1Desc"),
    },
    {
      icon: Cpu,
      title: t("howItWorks.step2Title"),
      desc: t("howItWorks.step2Desc"),
    },
    {
      icon: FileCheck2,
      title: t("howItWorks.step3Title"),
      desc: t("howItWorks.step3Desc"),
    },
  ];

  const roles = [
    {
      icon: Sprout,
      badge: t("roles.farmer.badge"),
      title: t("roles.farmer.title"),
      desc: t("roles.farmer.desc"),
      points: [
        t("roles.farmer.point1"),
        t("roles.farmer.point2"),
        t("roles.farmer.point3"),
      ],
      accent: "border-emerald-200 bg-gradient-to-b from-emerald-50/60 to-white",
    },
    {
      icon: ShieldCheck,
      badge: t("roles.officer.badge"),
      title: t("roles.officer.title"),
      desc: t("roles.officer.desc"),
      points: [
        t("roles.officer.point1"),
        t("roles.officer.point2"),
        t("roles.officer.point3"),
      ],
      accent: "border-lime-200 bg-gradient-to-b from-lime-50/60 to-white",
    },
    {
      icon: Users,
      badge: t("roles.admin.badge"),
      title: t("roles.admin.title"),
      desc: t("roles.admin.desc"),
      points: [
        t("roles.admin.point1"),
        t("roles.admin.point2"),
        t("roles.admin.point3"),
      ],
      accent: "border-slate-200 bg-gradient-to-b from-slate-50/70 to-white",
    },
  ];

  return (
    <div className="overflow-hidden">
      {/* ================= HERO SECTION ================= */}
      <section className="relative pt-10 pb-20 lg:pt-16 lg:pb-24">
        {/* Ambient Decorative Glows */}
        <div
          className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-[900px] h-[420px] rounded-full bg-gradient-to-tr from-[#166534]/12 via-[#84cc16]/15 to-transparent blur-3xl"
          aria-hidden="true"
        />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-10 items-center">
            {/* Left Copy Column */}
            <motion.div
              initial="hidden"
              animate="visible"
              variants={fadeUp}
              className="lg:col-span-7 space-y-6"
            >
              <Badge variant="lime" icon={Sparkles}>
                {t("hero.badge")}
              </Badge>

              <h1 className="text-3xl sm:text-5xl lg:text-[52px] font-extrabold tracking-tight text-slate-900 leading-[1.12]">
                {t("hero.title")}
              </h1>

              <p className="text-base sm:text-lg text-slate-600 max-w-2xl leading-relaxed">
                {t("hero.subtitle")}
              </p>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3.5 pt-2">
                <Link to={primaryCtaPath}>
                  <Button
                    variant="primary"
                    size="lg"
                    icon={ArrowRight}
                    iconPosition="right"
                    fullWidth
                  >
                    {t("hero.ctaPrimary")}
                  </Button>
                </Link>
                <a href="#how-it-works">
                  <Button variant="outline" size="lg" fullWidth>
                    {t("hero.ctaSecondary")}
                  </Button>
                </a>
              </div>

              <div className="pt-2 flex items-center gap-2.5 text-xs sm:text-sm font-medium text-slate-600">
                <CheckCircle2 className="w-4 h-4 text-[#15803d] shrink-0" />
                <span>{t("hero.trustNote")}</span>
              </div>
            </motion.div>

            {/* Right Interactive Visual Mockup Card */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.1 }}
              className="lg:col-span-5"
            >
              <div className="relative rounded-2xl bg-white border border-slate-200/90 shadow-xl shadow-[#166534]/10 p-5 sm:p-6">
                {/* Top Status Header */}
                <div className="flex items-center justify-between gap-2 pb-4 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#22c55e] animate-pulse" />
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                      {t("hero.mockup.header")}
                    </span>
                  </div>
                  <Badge variant="success" icon={ScanLine}>
                    {t("hero.mockup.verifiedBadge")}
                  </Badge>
                </div>

                {/* CSS Gradient "Grad-CAM" Heatmap Visual Preview */}
                <div className="mt-4 relative rounded-2xl overflow-hidden border border-emerald-900/15 bg-gradient-to-br from-[#052e16] via-[#14532d] to-[#166534] p-5 text-white">
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
                    {/* Stylized Leaf + CSS Radial Grad-CAM Activation Overlay */}
                    <div className="sm:col-span-5 flex justify-center">
                      <div className="relative w-36 h-36 rounded-2xl bg-emerald-950/80 border border-white/15 flex items-center justify-center overflow-hidden shadow-inner">
                        {/* Base Leaf Shape */}
                        <Leaf className="w-24 h-24 text-emerald-400/50" />
                        {/* Simulated Grad-CAM Jet Heatmap CSS Gradient Overlay */}
                        <div
                          className="absolute inset-0 opacity-90 mix-blend-screen"
                          style={{
                            background:
                              "radial-gradient(circle at 60% 42%, rgba(220,38,38,0.95) 0%, rgba(245,158,11,0.85) 26%, rgba(132,204,22,0.55) 52%, rgba(22,101,52,0) 75%)",
                          }}
                          aria-hidden="true"
                        />
                        {/* Scanner Reticle Box */}
                        <div className="absolute top-5 right-5 w-14 h-14 rounded-lg border-2 border-[#f59e0b] shadow-sm flex items-start justify-end p-1">
                          <span className="px-1 py-0.5 rounded text-[9px] font-bold bg-[#dc2626] text-white leading-none">
                            CAM
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Diagnosis Readout */}
                    <div className="sm:col-span-7 space-y-2.5">
                      <div>
                        <p className="text-[11px] uppercase tracking-wider text-emerald-200/80">
                          {t("hero.mockup.cropLabel")}
                        </p>
                        <p className="text-xs font-semibold text-white">
                          {t("hero.mockup.cropValue")}
                        </p>
                      </div>

                      <div>
                        <p className="text-[11px] uppercase tracking-wider text-emerald-200/80">
                          {t("hero.mockup.detectedLabel")}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="inline-block w-2 h-2 rounded-full bg-[#dc2626]" />
                          <p className="text-base font-extrabold text-white">
                            {t("hero.mockup.detectedDisease")}
                          </p>
                        </div>
                        <p className="text-xs text-[#a3e635] font-medium">
                          {t("hero.mockup.detectedDiseaseSi")}
                        </p>
                      </div>

                      {/* Confidence Progress Bar */}
                      <div className="pt-1">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-emerald-100 font-medium">
                            {t("hero.mockup.confidenceLabel")}
                          </span>
                          <span className="font-extrabold text-[#a3e635]">
                            94.2%
                          </span>
                        </div>
                        <div className="w-full h-2.5 rounded-full bg-emerald-950/90 overflow-hidden p-0.5">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-[#84cc16] via-[#f59e0b] to-[#dc2626]"
                            style={{ width: "94.2%" }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Heatmap Legend Strip */}
                  <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between gap-2 text-[11px] text-emerald-100/90">
                    <span className="flex items-center gap-1.5">
                      <Eye className="w-3.5 h-3.5 text-[#a3e635] shrink-0" />
                      <span className="truncate">
                        {t("hero.mockup.heatmapCaption")}
                      </span>
                    </span>
                    <span className="shrink-0 font-mono text-[10px] px-2 py-0.5 rounded bg-white/10">
                      Conv_1
                    </span>
                  </div>
                </div>

                {/* Treatment Preview Box */}
                <div className="mt-4 rounded-xl bg-[#f8faf5] border border-slate-200/80 p-3.5 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#166534]">
                      {t("hero.mockup.adviceTitle")}
                    </span>
                    <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                      {t("hero.mockup.statusValue")}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    {t("hero.mockup.adviceText")}
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ================= STATS STRIP ================= */}
      <section className="border-y border-slate-200/80 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {stats.map((item, index) => {
              const Icon = item.icon;
              return (
                <div
                  key={index}
                  className="flex items-center gap-4 p-3 rounded-2xl bg-[#f8faf5] border border-slate-200/60"
                >
                  <div className="w-12 h-12 rounded-xl bg-emerald-100/80 text-[#166534] flex items-center justify-center shrink-0">
                    <Icon className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      {item.label}
                    </p>
                    <p className="text-base font-extrabold text-slate-900 mt-0.5">
                      {item.value}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ================= FEATURES GRID (6 CARDS) ================= */}
      <section id="features" className="py-20 bg-[#f8faf5]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto space-y-3 mb-14">
            <Badge variant="success">{t("features.sectionBadge")}</Badge>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">
              {t("features.title")}
            </h2>
            <p className="text-base text-slate-600 leading-relaxed">
              {t("features.subtitle")}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feat, idx) => {
              const Icon = feat.icon;
              const isLive = feat.status === "live";
              return (
                <Card key={idx} hover className="flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-5">
                      <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200/70 text-[#166534] flex items-center justify-center">
                        <Icon className="w-6 h-6" />
                      </div>
                      <Badge variant={isLive ? "lime" : "warning"}>
                        {isLive
                          ? t("features.liveBadge")
                          : t("features.comingSoon")}
                      </Badge>
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 mb-2">
                      {feat.title}
                    </h3>
                    <p className="text-sm text-slate-600 leading-relaxed">
                      {feat.desc}
                    </p>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* ================= HOW IT WORKS (3 STEPS) ================= */}
      <section id="how-it-works" className="py-20 bg-white border-y border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto space-y-3 mb-14">
            <Badge variant="lime">{t("howItWorks.sectionBadge")}</Badge>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">
              {t("howItWorks.title")}
            </h2>
            <p className="text-base text-slate-600">
              {t("howItWorks.subtitle")}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {steps.map((step, i) => {
              const Icon = step.icon;
              return (
                <div
                  key={i}
                  className="relative rounded-2xl bg-[#f8faf5] border border-slate-200/80 p-7 space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <div className="w-12 h-12 rounded-2xl bg-[#166534] text-white flex items-center justify-center shadow-md shadow-[#166534]/20">
                      <Icon className="w-6 h-6" />
                    </div>
                    <span className="text-3xl font-extrabold text-slate-200">
                      0{i + 1}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-slate-900">
                    {step.title}
                  </h3>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    {step.desc}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ================= BUILT WITH (TECH STACK ASSEMBLY) ================= */}
      <TechStackAssembly />

      {/* ================= ROLES SECTION ================= */}
      <section id="roles" className="py-20 bg-[#f8faf5]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto space-y-3 mb-14">
            <Badge variant="success">{t("roles.sectionBadge")}</Badge>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">
              {t("roles.title")}
            </h2>
            <p className="text-base text-slate-600">{t("roles.subtitle")}</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {roles.map((role, idx) => {
              const Icon = role.icon;
              return (
                <Card
                  key={idx}
                  className={`flex flex-col justify-between ${role.accent}`}
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="w-11 h-11 rounded-xl bg-[#166534] text-white flex items-center justify-center">
                        <Icon className="w-5 h-5" />
                      </div>
                      <Badge variant="neutral">{role.badge}</Badge>
                    </div>

                    <h3 className="text-xl font-bold text-slate-900">
                      {role.title}
                    </h3>
                    <p className="text-sm text-slate-600 leading-relaxed">
                      {role.desc}
                    </p>

                    <ul className="space-y-2.5 pt-2">
                      {role.points.map((pt, pIdx) => (
                        <li
                          key={pIdx}
                          className="flex items-start gap-2.5 text-xs sm:text-sm text-slate-700"
                        >
                          <CheckCircle2 className="w-4 h-4 text-[#15803d] shrink-0 mt-0.5" />
                          <span>{pt}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* ================= CTA BANNER ================= */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto rounded-3xl bg-gradient-to-br from-[#052e16] via-[#166534] to-[#15803d] text-white p-8 sm:p-12 lg:p-14 shadow-xl shadow-[#166534]/20 relative overflow-hidden">
          <div
            className="pointer-events-none absolute -right-20 -bottom-20 w-80 h-80 rounded-full bg-[#84cc16]/20 blur-3xl"
            aria-hidden="true"
          />

          <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-8">
            <div className="max-w-2xl space-y-3">
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight">
                {t("cta.title")}
              </h2>
              <p className="text-sm sm:text-base text-emerald-100/90 leading-relaxed">
                {t("cta.subtitle")}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3.5 w-full lg:w-auto shrink-0">
              <Link to="/register">
                <Button
                  variant="accent"
                  size="lg"
                  icon={ArrowRight}
                  iconPosition="right"
                  fullWidth
                >
                  {t("cta.primaryBtn")}
                </Button>
              </Link>
              <Link to="/login">
                <Button
                  variant="outline"
                  size="lg"
                  fullWidth
                  className="!bg-white/10 !text-white !border-white/25 hover:!bg-white/20"
                >
                  {t("cta.secondaryBtn")}
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
