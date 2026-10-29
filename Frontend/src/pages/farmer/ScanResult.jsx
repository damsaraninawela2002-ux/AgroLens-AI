import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Bot,
  Camera,
  CheckCircle2,
  Clock,
  FileText,
  MapPin,
  Printer,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Sprout,
  UserCheck,
} from "lucide-react";
import Card from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import ImageCompareViewer from "../../components/scan/ImageCompareViewer";
import { useLanguage } from "../../context/LanguageContext";
import { getDiagnosisById } from "../../services/predictService";
import {
  extractErrorMessage,
  formatConfidence,
  formatDateTime,
  formatDiseaseKey,
  getConfidenceTone,
  getCropFromDiseaseKey,
  isHealthyDiseaseKey,
  isToBeVerified,
} from "../../utils/formatters";

export default function ScanResult() {
  const { id } = useParams();
  const location = useLocation();
  const { lang, t } = useLanguage();

  const [data, setData] = useState(
    () => location.state?.initialData || null
  );
  const [loading, setLoading] = useState(!location.state?.initialData);
  const [error, setError] = useState("");

  // Treatment active tab: "symptoms" | "treatment" | "prevention"
  const [activeTab, setActiveTab] = useState("treatment");

  const fetchResult = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await getDiagnosisById(id);
      setData(response);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (data && data?.diagnosis?.id === id) {
      return;
    }
    let active = true;
    getDiagnosisById(id)
      .then((response) => {
        if (active) {
          setData(response);
          setError("");
        }
      })
      .catch((err) => {
        if (active) {
          setError(extractErrorMessage(err));
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [id, data]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Card className="space-y-4">
          <div className="h-8 w-64 bg-slate-200 rounded-lg animate-pulse" />
          <div className="h-4 w-48 bg-slate-100 rounded animate-pulse" />
        </Card>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <Card className="lg:col-span-8 h-80 bg-slate-100 animate-pulse" />
          <Card className="lg:col-span-4 h-80 bg-slate-100 animate-pulse" />
        </div>
      </div>
    );
  }

  if (error || !data?.diagnosis) {
    return (
      <Card className="py-12 text-center space-y-4 max-w-lg mx-auto">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-red-50 text-[#dc2626] flex items-center justify-center">
          <AlertTriangle className="w-7 h-7" />
        </div>
        <h2 className="text-lg font-bold text-slate-900">
          {error || "Diagnosis not found"}
        </h2>
        <div className="flex items-center justify-center gap-3">
          <Link to="/farmer/history">
            <Button variant="outline" icon={ArrowLeft}>
              {t("scanResult.backToHistory")}
            </Button>
          </Link>
          <Button variant="primary" icon={RefreshCw} onClick={fetchResult}>
            {t("dashboard.error.retryBtn")}
          </Button>
        </div>
      </Card>
    );
  }

  const { diagnosis, treatment, disclaimer } = data;
  const effectiveClass = diagnosis.officer_label || diagnosis.predicted_class;
  const isReviewed =
    diagnosis.status === "confirmed" ||
    diagnosis.status === "corrected" ||
    Boolean(diagnosis.officer_label);
  const isCorrected =
    diagnosis.status === "corrected" ||
    Boolean(
      diagnosis.officer_label &&
        diagnosis.officer_label !== diagnosis.predicted_class
    );

  const isHealthy =
    treatment?.is_healthy !== undefined
      ? treatment.is_healthy
      : isHealthyDiseaseKey(effectiveClass);

  const displayDiseaseName =
    lang === "si" && treatment?.disease_name_si
      ? treatment.disease_name_si
      : lang === "en" && treatment?.disease_name_en
      ? treatment.disease_name_en
      : formatDiseaseKey(effectiveClass, lang);

  const cropName =
    lang === "si"
      ? getCropFromDiseaseKey(effectiveClass, "si")
      : treatment?.crop || getCropFromDiseaseKey(effectiveClass, "en");

  const confidenceValue = Number(diagnosis.confidence) || 0;
  const tone = getConfidenceTone(confidenceValue);

  const getStatusBadgeProps = (st) => {
    if (st === "pending_review") {
      return { variant: "warning", icon: Clock };
    }
    if (st === "confirmed") {
      return { variant: "success", icon: CheckCircle2 };
    }
    if (st === "corrected") {
      return { variant: "info", icon: ShieldCheck };
    }
    return { variant: "success", icon: ShieldCheck };
  };

  const statusBadge = getStatusBadgeProps(diagnosis.status);

  // Circular SVG gauge calculation
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const dashOffset =
    circumference -
    (Math.min(100, Math.max(0, confidenceValue)) / 100) * circumference;

  const getTabContent = () => {
    if (!treatment) return "";
    if (activeTab === "symptoms") {
      return lang === "si" ? treatment.symptoms_si : treatment.symptoms_en;
    }
    if (activeTab === "prevention") {
      return lang === "si" ? treatment.prevention_si : treatment.prevention_en;
    }
    return lang === "si" ? treatment.treatment_si : treatment.treatment_en;
  };

  const currentTabText = getTabContent();
  const showVerifyingCard = isToBeVerified(currentTabText);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="space-y-6"
    >
      {/* Back Navigation + Top Action Bar */}
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/farmer/history"
          className="inline-flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-[#166534] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{t("scanResult.backToHistory")}</span>
        </Link>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            icon={Printer}
            onClick={() => window.print()}
          >
            {t("scanResult.actions.downloadReport")}
          </Button>
          <Link to="/farmer/scan">
            <Button variant="primary" size="sm" icon={Camera}>
              {t("scanResult.actions.scanAnother")}
            </Button>
          </Link>
        </div>
      </div>

      {/* ================= PENDING OFFICER REVIEW AMBER BANNER ================= */}
      {diagnosis.status === "pending_review" && (
        <div
          role="status"
          className="rounded-2xl bg-amber-50 border border-amber-300/90 p-4 sm:p-5 flex items-start gap-3.5 text-amber-950 shadow-xs print-card"
        >
          <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm sm:text-base font-extrabold text-amber-900">
              {t("scanResult.pendingReviewNoticeTitle")}
            </h3>
            <p className="text-xs sm:text-sm text-amber-800/90 leading-relaxed">
              {t("scanResult.pendingReviewNoticeDesc")}
            </p>
          </div>
        </div>
      )}

      {/* ================= HEADER & CONFIDENCE GAUGE CARD ================= */}
      <Card className="print-card p-6 sm:p-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          {/* Disease Name, Crop & Metadata */}
          <div className="lg:col-span-8 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant={isHealthy ? "lime" : "danger"}
                icon={isHealthy ? CheckCircle2 : ShieldAlert}
              >
                {isHealthy ? t("status.healthy") : t("status.diseased")}
              </Badge>

              <Badge variant={statusBadge.variant} icon={statusBadge.icon}>
                {t(`status.${diagnosis.status}`, diagnosis.status)}
              </Badge>

              <Badge variant="neutral" icon={Sprout}>
                {t("scanResult.cropLabel")}: {cropName}
              </Badge>
            </div>

            {isCorrected && (
              <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm font-semibold">
                <span className="text-slate-400">
                  {t("scanResult.aiPredictionWasLabel")}:
                </span>
                <span className="line-through text-slate-400">
                  {formatDiseaseKey(diagnosis.predicted_class, lang)}
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-sky-600" />
                <span className="text-sky-700 font-bold">
                  {formatDiseaseKey(effectiveClass, lang)}
                </span>
              </div>
            )}

            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-slate-900 tracking-tight">
              {displayDiseaseName}
            </h1>

            {lang === "si" && (
              <p className="text-sm font-semibold text-slate-500">
                {formatDiseaseKey(effectiveClass, "en")}
              </p>
            )}

            <div className="pt-2 flex flex-wrap items-center gap-4 text-xs font-medium text-slate-500">
              <span className="inline-flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>
                  {t("scanResult.scannedOn")}:{" "}
                  {formatDateTime(diagnosis.created_at, lang)}
                </span>
              </span>
              {diagnosis.district && (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  <span>
                    {t("scanResult.districtLabel")}: {diagnosis.district}
                  </span>
                </span>
              )}
            </div>
          </div>

          {/* Circular Confidence Gauge */}
          <div className="lg:col-span-4 flex flex-col sm:flex-row lg:flex-col items-center justify-center p-4 rounded-2xl bg-[#f8faf5] border border-slate-200/80 gap-4">
            <div className="relative w-32 h-32 flex items-center justify-center">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
                <circle
                  cx="60"
                  cy="60"
                  r={radius}
                  stroke="#e2e8f0"
                  strokeWidth="10"
                  fill="none"
                />
                <circle
                  cx="60"
                  cy="60"
                  r={radius}
                  stroke={tone.color}
                  strokeWidth="10"
                  strokeDasharray={circumference}
                  strokeDashoffset={dashOffset}
                  strokeLinecap="round"
                  fill="none"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className={`text-2xl font-extrabold ${tone.textClass}`}>
                  {formatConfidence(confidenceValue, 1)}
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Confidence
                </span>
              </div>
            </div>

            <div className="text-center space-y-1">
              <p className="text-xs font-bold text-slate-800">
                {t("scanResult.confidenceTitle")}
              </p>
              <Badge variant={tone.badgeVariant}>
                {confidenceValue >= 85
                  ? t("scanResult.highConfidence")
                  : confidenceValue >= 70
                  ? t("scanResult.moderateConfidence")
                  : t("scanResult.lowConfidence")}
              </Badge>
            </div>
          </div>
        </div>
      </Card>

      {/* ================= OFFICER REVIEW CARD (IF REVIEWED) ================= */}
      {isReviewed && (
        <Card
          className={`print-card border ${
            isCorrected
              ? "border-sky-200 bg-gradient-to-r from-sky-50/70 to-white"
              : "border-emerald-200 bg-gradient-to-r from-emerald-50/70 to-white"
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div
                className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                  isCorrected
                    ? "bg-sky-100 text-sky-700"
                    : "bg-emerald-100 text-[#166534]"
                }`}
              >
                <UserCheck className="w-5 h-5" />
              </div>

              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-extrabold text-slate-900">
                    {t("scanResult.officerReviewTitle")}
                  </h2>
                  <Badge
                    variant={isCorrected ? "info" : "success"}
                    icon={isCorrected ? ShieldCheck : CheckCircle2}
                  >
                    {t(
                      `status.${isCorrected ? "corrected" : "confirmed"}`
                    )}
                  </Badge>
                </div>

                {/* Final Diagnosis (with AI prediction crossed out if corrected) */}
                <div className="text-sm">
                  <span className="font-semibold text-slate-600">
                    {t("scanResult.officerConfirmedLabel")}:{" "}
                  </span>
                  {isCorrected ? (
                    <span className="inline-flex flex-wrap items-center gap-2">
                      <span className="line-through text-slate-400 font-medium">
                        {formatDiseaseKey(diagnosis.predicted_class, lang)}
                      </span>
                      <ArrowRight className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                      <span className="font-extrabold text-sky-900">
                        {formatDiseaseKey(effectiveClass, lang)}
                      </span>
                    </span>
                  ) : (
                    <span className="font-extrabold text-[#166534]">
                      {formatDiseaseKey(effectiveClass, lang)}
                    </span>
                  )}
                </div>

                {/* Officer Notes */}
                {diagnosis.officer_notes && (
                  <div className="p-3 rounded-xl bg-white/90 border border-slate-200/80 text-xs sm:text-sm text-slate-700 leading-relaxed">
                    <span className="font-bold text-slate-900">
                      {t("scanResult.officerNotesLabel")}:{" "}
                    </span>
                    <span>{diagnosis.officer_notes}</span>
                  </div>
                )}

                {/* Officer Name & Reviewed Date */}
                <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 pt-0.5">
                  {diagnosis.reviewed_by_name && (
                    <span>
                      <strong className="text-slate-700">
                        {t("scanResult.officerNameLabel")}:
                      </strong>{" "}
                      {diagnosis.reviewed_by_name}
                    </span>
                  )}
                  {diagnosis.reviewed_at && (
                    <span>
                      <strong className="text-slate-700">
                        {t("scanResult.officerDateLabel")}:
                      </strong>{" "}
                      {formatDateTime(diagnosis.reviewed_at, lang)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* ================= VISUAL & GRAD-CAM EXPLAINABILITY + TOP 3 ================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Reused ImageCompareViewer Component */}
        <ImageCompareViewer
          imageUrl={diagnosis.image_url}
          heatmapUrl={diagnosis.heatmap_url}
          className="lg:col-span-7"
        />

        {/* Right: Top 3 Model Predictions */}
        <Card className="lg:col-span-5 space-y-5 print-card">
          <div className="pb-3 border-b border-slate-100">
            <h2 className="text-lg font-extrabold text-slate-900">
              {t("scanResult.top3Title")}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {t("scanResult.top3Subtitle")}
            </p>
          </div>

          <div className="space-y-4">
            {(diagnosis.top3 || []).map((item, idx) => {
              const conf = Number(item.confidence) || 0;
              const isTop = idx === 0;
              const itemTone = getConfidenceTone(conf);

              return (
                <div
                  key={item.class_name || idx}
                  className={`p-3.5 rounded-xl border ${
                    isTop
                      ? "bg-emerald-50/40 border-emerald-200"
                      : "bg-slate-50/60 border-slate-200/70"
                  } space-y-2`}
                >
                  <div className="flex items-center justify-between gap-2 text-xs sm:text-sm">
                    <span className="font-bold text-slate-900 truncate">
                      {idx + 1}. {formatDiseaseKey(item.class_name, lang)}
                    </span>
                    <span
                      className={`font-extrabold shrink-0 ${
                        isTop ? itemTone.textClass : "text-slate-700"
                      }`}
                    >
                      {formatConfidence(conf, 2)}
                    </span>
                  </div>

                  <div className="w-full h-2.5 rounded-full bg-slate-200/80 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        isTop ? itemTone.barClass : "bg-slate-400"
                      }`}
                      style={{ width: `${Math.min(100, Math.max(2, conf))}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* ================= TREATMENT SECTION (TABS) ================= */}
      <Card className="space-y-5 print-card">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-[#166534]" />
            <h2 className="text-lg font-extrabold text-slate-900">
              {t("scanResult.treatmentSectionTitle")}
            </h2>
          </div>

          <div
            role="tablist"
            className="no-print inline-flex rounded-xl bg-slate-100 p-1 text-xs font-bold"
          >
            {[
              { id: "symptoms", label: t("scanResult.tabs.symptoms") },
              { id: "treatment", label: t("scanResult.tabs.treatment") },
              { id: "prevention", label: t("scanResult.tabs.prevention") },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 rounded-lg transition-all cursor-pointer ${
                  activeTab === tab.id
                    ? "bg-[#166534] text-white shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Treatment Content or Neat "Information Being Verified" Notice */}
        {(showVerifyingCard || treatment?.is_verified === false) && (
          <div className="rounded-2xl bg-amber-50/70 border border-amber-200/90 p-5 flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-extrabold text-amber-900">
                {t("scanResult.verifyingNoticeTitle")}
              </h3>
              <p className="text-xs sm:text-sm text-amber-800/90 leading-relaxed">
                {t("scanResult.verifyingNoticeDesc")}
              </p>
            </div>
          </div>
        )}

        {!showVerifyingCard && currentTabText && (
          <div className="rounded-2xl bg-[#f8faf5] border border-slate-200/80 p-5 text-sm text-slate-800 leading-relaxed whitespace-pre-line">
            {currentTabText}
          </div>
        )}

        {/* API Disclaimer Box */}
        <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 flex items-start gap-3 text-xs text-slate-600">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold text-slate-800">
              {t("scanResult.disclaimerTitle")}:{" "}
            </span>
            <span>
              {disclaimer ||
                "This is an AI suggestion. Consult an Agricultural Officer for important decisions."}
            </span>
          </div>
        </div>
      </Card>

      {/* ================= BOTTOM ACTION BUTTONS ================= */}
      <div className="no-print flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <Link to="/farmer/scan">
            <Button variant="primary" size="lg" icon={Camera} fullWidth>
              {t("scanResult.actions.scanAnother")}
            </Button>
          </Link>

          <Link to={`/farmer/assistant?diagnosis=${diagnosis.id || id}`}>
            <Button
              variant="secondary"
              size="lg"
              icon={Bot}
              fullWidth
            >
              {t("scanResult.actions.askAiAssistant")}
            </Button>
          </Link>
        </div>

        <Button
          variant="outline"
          size="lg"
          icon={Printer}
          onClick={() => window.print()}
        >
          {t("scanResult.actions.downloadReport")}
        </Button>
      </div>
    </motion.div>
  );
}
