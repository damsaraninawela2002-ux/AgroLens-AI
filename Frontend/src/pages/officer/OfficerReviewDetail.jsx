import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Edit3,
  MapPin,
  RefreshCw,
  Search,
  ShieldCheck,
  User,
  X,
} from "lucide-react";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Badge from "../../components/ui/Badge";
import ImageCompareViewer from "../../components/scan/ImageCompareViewer";
import OfficerWaitingApprovalCard from "../../components/officer/OfficerWaitingApprovalCard";
import { useAuth } from "../../context/AuthContext";
import { useLanguage } from "../../context/LanguageContext";
import {
  getOfficerClasses,
  getOfficerDiagnosisById,
  getPendingDiagnoses,
  submitOfficerReview,
} from "../../services/officerService";
import {
  extractErrorMessage,
  formatConfidence,
  formatDateTime,
  formatDiseaseKey,
  getConfidenceTone,
} from "../../utils/formatters";

export default function OfficerReviewDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { lang, t } = useLanguage();

  const isUnapprovedOfficer =
    user?.role === "officer" && user?.is_approved === false;

  const [diagnosis, setDiagnosis] = useState(null);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Review form state
  const [action, setAction] = useState("confirm"); // "confirm" | "correct"
  const [selectedClass, setSelectedClass] = useState("");
  const [notes, setNotes] = useState("");

  // Searchable dropdown state
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [classSearch, setClassSearch] = useState("");
  const dropdownRef = useRef(null);

  // Confirmation modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    if (isUnapprovedOfficer) return;
    setLoading(true);
    setError("");
    try {
      const [detailRes, classesRes] = await Promise.all([
        getOfficerDiagnosisById(id),
        getOfficerClasses(),
      ]);

      const diag = detailRes?.diagnosis || null;
      setDiagnosis(diag);
      const clsList = Array.isArray(classesRes) ? classesRes : [];
      setClasses(clsList);

      // Default selected correction class to the first class different from predicted_class
      if (diag && clsList.length > 0) {
        const defaultAlt =
          clsList.find((c) => c !== diag.predicted_class) || clsList[0];
        setSelectedClass(defaultAlt);
      }
      setAction("confirm");
      setNotes("");
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [id, isUnapprovedOfficer]);

  useEffect(() => {
    if (isUnapprovedOfficer) return;
    let active = true;
    Promise.all([getOfficerDiagnosisById(id), getOfficerClasses()])
      .then(([detailRes, classesRes]) => {
        if (!active) return;
        const diag = detailRes?.diagnosis || null;
        setDiagnosis(diag);
        const clsList = Array.isArray(classesRes) ? classesRes : [];
        setClasses(clsList);

        if (diag && clsList.length > 0) {
          const defaultAlt =
            clsList.find((c) => c !== diag.predicted_class) || clsList[0];
          setSelectedClass(defaultAlt);
        }
        setAction("confirm");
        setNotes("");
        setError("");
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
  }, [id, isUnapprovedOfficer]);

  // Close searchable dropdown on outside click
  useEffect(() => {
    function handleOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen) {
      document.addEventListener("mousedown", handleOutside);
    }
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [dropdownOpen]);

  const filteredClasses = useMemo(() => {
    const q = classSearch.trim().toLowerCase();
    if (!q) return classes;
    return classes.filter((cls) => {
      const labelEn = formatDiseaseKey(cls, "en").toLowerCase();
      const labelSi = formatDiseaseKey(cls, "si").toLowerCase();
      return (
        cls.toLowerCase().includes(q) ||
        labelEn.includes(q) ||
        labelSi.includes(q)
      );
    });
  }, [classes, classSearch]);

  if (isUnapprovedOfficer) {
    return <OfficerWaitingApprovalCard />;
  }

  const handleOpenConfirmModal = () => {
    if (action === "correct" && !selectedClass) {
      toast.error(t("officer.review.selectClassLabel"));
      return;
    }
    setModalOpen(true);
  };

  const handleConfirmSubmit = async () => {
    if (!diagnosis) return;
    setSubmitting(true);
    try {
      const payload = {
        action,
        corrected_label: action === "correct" ? selectedClass : undefined,
        notes: notes.trim() ? notes.trim() : undefined,
      };

      await submitOfficerReview(diagnosis.id, payload);
      setModalOpen(false);

      toast.success(
        action === "confirm"
          ? t("officer.review.toastConfirmSuccess")
          : t("officer.review.toastCorrectSuccess")
      );

      // Check if there is another pending case in the officer's queue
      try {
        const nextPending = await getPendingDiagnoses({ limit: 1, page: 1 });
        const nextItem = nextPending?.items?.[0];
        if (nextItem && nextItem.id && nextItem.id !== diagnosis.id) {
          navigate(`/officer/review/${nextItem.id}`);
          return;
        }
      } catch {
        // Fallback to queue page
      }

      navigate("/officer/queue");
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-6 w-36 bg-slate-200 rounded animate-pulse" />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <Card className="lg:col-span-7 h-96 bg-slate-100 animate-pulse" />
          <Card className="lg:col-span-5 h-96 bg-slate-100 animate-pulse" />
        </div>
      </div>
    );
  }

  if (error || !diagnosis) {
    return (
      <Card className="py-12 text-center space-y-4 max-w-lg mx-auto">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-red-50 text-[#dc2626] flex items-center justify-center">
          <AlertTriangle className="w-7 h-7" />
        </div>
        <h2 className="text-lg font-bold text-slate-900">
          {error || "Diagnosis not found"}
        </h2>
        <div className="flex items-center justify-center gap-3">
          <Link to="/officer/queue">
            <Button variant="outline" icon={ArrowLeft}>
              {t("officer.review.backToQueue")}
            </Button>
          </Link>
          <Button variant="primary" icon={RefreshCw} onClick={loadData}>
            {t("dashboard.error.retryBtn")}
          </Button>
        </div>
      </Card>
    );
  }

  const confidenceValue = Number(diagnosis.confidence) || 0;
  const tone = getConfidenceTone(confidenceValue);
  const canReview =
    diagnosis.status === "pending_review" || diagnosis.status === "auto";

  // Circular SVG gauge calculation
  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  const dashOffset =
    circumference -
    (Math.min(100, Math.max(0, confidenceValue)) / 100) * circumference;

  const finalDiseaseKey =
    action === "confirm" ? diagnosis.predicted_class : selectedClass;

  return (
    <div className="space-y-6">
      {/* Top Bar */}
      <div className="flex items-center justify-between gap-3">
        <Link
          to="/officer/queue"
          className="inline-flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-[#166534] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{t("officer.review.backToQueue")}</span>
        </Link>

        <Badge
          variant={
            diagnosis.status === "pending_review"
              ? "warning"
              : diagnosis.status === "corrected"
              ? "info"
              : "success"
          }
          icon={
            diagnosis.status === "pending_review" ? Clock : CheckCircle2
          }
        >
          {t(`status.${diagnosis.status}`, diagnosis.status)}
        </Badge>
      </div>

      {/* Main Two-Column Review Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ================= LEFT: REUSED IMAGE + GRAD-CAM VIEWER ================= */}
        <ImageCompareViewer
          imageUrl={diagnosis.image_url}
          heatmapUrl={diagnosis.heatmap_url}
          className="lg:col-span-7"
        />

        {/* ================= RIGHT: AI PREDICTION, METADATA & REVIEW PANEL ================= */}
        <div className="lg:col-span-5 space-y-6">
          {/* AI Prediction + Confidence Gauge + Farmer Info + Top 3 */}
          <Card className="space-y-5">
            {/* Farmer, District, Date Strip */}
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3.5 border-b border-slate-100 text-xs text-slate-600">
              <span className="inline-flex items-center gap-1.5 font-bold text-slate-900">
                <User className="w-3.5 h-3.5 text-[#166534]" />
                <span>{diagnosis.farmer_name}</span>
              </span>

              <span className="inline-flex items-center gap-1 font-semibold">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                <span>{diagnosis.district}</span>
              </span>

              <span className="inline-flex items-center gap-1 text-slate-500">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>{formatDateTime(diagnosis.created_at, lang)}</span>
              </span>
            </div>

            {/* AI Prediction & Circular Confidence Gauge */}
            <div className="flex items-center justify-between gap-4 p-4 rounded-2xl bg-[#f8faf5] border border-slate-200/80">
              <div className="space-y-1 min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  {t("officer.review.aiPredictionTitle")}
                </p>
                <h2 className="text-base sm:text-lg font-extrabold text-slate-900 leading-snug">
                  {formatDiseaseKey(diagnosis.predicted_class, lang)}
                </h2>
                {lang === "si" && (
                  <p className="text-xs font-medium text-slate-500">
                    {formatDiseaseKey(diagnosis.predicted_class, "en")}
                  </p>
                )}
              </div>

              {/* Circular Gauge */}
              <div className="relative w-24 h-24 shrink-0 flex items-center justify-center">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 104 104">
                  <circle
                    cx="52"
                    cy="52"
                    r={radius}
                    stroke="#e2e8f0"
                    strokeWidth="8"
                    fill="none"
                  />
                  <circle
                    cx="52"
                    cy="52"
                    r={radius}
                    stroke={tone.color}
                    strokeWidth="8"
                    strokeDasharray={circumference}
                    strokeDashoffset={dashOffset}
                    strokeLinecap="round"
                    fill="none"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className={`text-base font-extrabold ${tone.textClass}`}>
                    {formatConfidence(confidenceValue, 1)}
                  </span>
                </div>
              </div>
            </div>

            {/* Top 3 Predictions */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                {t("officer.review.top3Title")}
              </h3>
              <div className="space-y-2.5">
                {(diagnosis.top3 || []).map((item, idx) => {
                  const conf = Number(item.confidence) || 0;
                  const isTop = idx === 0;
                  const itemTone = getConfidenceTone(conf);

                  return (
                    <div
                      key={item.class_name || idx}
                      className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/70 space-y-1.5"
                    >
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="font-bold text-slate-800 truncate">
                          {idx + 1}. {formatDiseaseKey(item.class_name, lang)}
                        </span>
                        <span
                          className={`font-extrabold shrink-0 ${
                            isTop ? itemTone.textClass : "text-slate-600"
                          }`}
                        >
                          {formatConfidence(conf, 2)}
                        </span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-slate-200/80 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            isTop ? itemTone.barClass : "bg-slate-400"
                          }`}
                          style={{
                            width: `${Math.min(100, Math.max(2, conf))}%`,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </Card>

          {/* ================= OFFICER REVIEW PANEL ================= */}
          {canReview ? (
            <Card className="space-y-5 border-emerald-200/90">
              <div className="space-y-1">
                <h3 className="text-lg font-extrabold text-slate-900">
                  {t("officer.review.panelTitle")}
                </h3>
                <p className="text-xs text-slate-500">
                  {t("officer.review.panelSubtitle")}
                </p>
              </div>

              {/* Action Toggle Buttons: Confirm vs Correct */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setAction("confirm")}
                  className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-xs sm:text-sm font-extrabold border transition-all cursor-pointer ${
                    action === "confirm"
                      ? "bg-[#166534] text-white border-[#166534] shadow-sm shadow-[#166534]/20"
                      : "bg-[#f8faf5] text-slate-700 border-slate-200 hover:border-[#166534]/50"
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{t("officer.review.confirmBtn")}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setAction("correct")}
                  className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-xs sm:text-sm font-extrabold border transition-all cursor-pointer ${
                    action === "correct"
                      ? "bg-sky-700 text-white border-sky-700 shadow-sm shadow-sky-700/20"
                      : "bg-[#f8faf5] text-slate-700 border-slate-200 hover:border-sky-600/50"
                  }`}
                >
                  <Edit3 className="w-4 h-4 shrink-0" />
                  <span>{t("officer.review.correctBtn")}</span>
                </button>
              </div>

              {/* Searchable Disease Class Dropdown (when action === "correct") */}
              {action === "correct" && (
                <div ref={dropdownRef} className="space-y-1.5 relative">
                  <label className="block text-xs font-bold text-slate-700">
                    {t("officer.review.selectClassLabel")} *
                  </label>

                  <button
                    type="button"
                    onClick={() => setDropdownOpen((o) => !o)}
                    className="w-full flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl bg-[#f8faf5] border border-slate-300 hover:border-[#166534] text-left text-xs sm:text-sm font-bold text-slate-900 cursor-pointer"
                  >
                    <span className="truncate">
                      {selectedClass
                        ? formatDiseaseKey(selectedClass, lang)
                        : t("officer.review.selectClassLabel")}
                    </span>
                    <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" />
                  </button>

                  {dropdownOpen && (
                    <div className="absolute left-0 right-0 mt-1 rounded-2xl bg-white border border-slate-200 shadow-xl z-40 overflow-hidden">
                      <div className="p-2.5 border-b border-slate-100 bg-slate-50/70">
                        <div className="relative">
                          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                          <input
                            type="text"
                            value={classSearch}
                            onChange={(e) => setClassSearch(e.target.value)}
                            placeholder={t(
                              "officer.review.searchClassPlaceholder"
                            )}
                            className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-[#166534]"
                          />
                        </div>
                      </div>

                      <div className="max-h-56 overflow-y-auto divide-y divide-slate-50">
                        {filteredClasses.length === 0 ? (
                          <p className="py-4 px-3 text-center text-xs text-slate-500">
                            {t("officer.review.noClassMatch")}
                          </p>
                        ) : (
                          filteredClasses.map((cls) => {
                            const isSelected = cls === selectedClass;
                            return (
                              <button
                                key={cls}
                                type="button"
                                onClick={() => {
                                  setSelectedClass(cls);
                                  setDropdownOpen(false);
                                }}
                                className={`w-full text-left px-3.5 py-2.5 text-xs flex items-center justify-between gap-2 hover:bg-emerald-50/70 cursor-pointer ${
                                  isSelected
                                    ? "bg-emerald-50 font-extrabold text-[#166534]"
                                    : "font-semibold text-slate-800"
                                }`}
                              >
                                <div className="min-w-0">
                                  <p className="truncate">
                                    {formatDiseaseKey(cls, lang)}
                                  </p>
                                  {lang === "si" && (
                                    <p className="text-[11px] text-slate-400 truncate">
                                      {formatDiseaseKey(cls, "en")}
                                    </p>
                                  )}
                                </div>
                                {isSelected && (
                                  <Check className="w-4 h-4 text-[#166534] shrink-0" />
                                )}
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Notes Textarea (500 chars max with counter) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="officer-review-notes"
                    className="text-xs font-bold text-slate-700"
                  >
                    {t("officer.review.notesLabel")}
                  </label>
                  <span className="font-mono text-[11px] text-slate-400">
                    {notes.length} / 500
                  </span>
                </div>
                <textarea
                  id="officer-review-notes"
                  rows={3}
                  maxLength={500}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value.slice(0, 500))}
                  placeholder={t("officer.review.notesPlaceholder")}
                  className="w-full rounded-xl bg-[#f8faf5] p-3 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 border border-slate-200 focus:outline-none focus:border-[#166534] focus:bg-white resize-none"
                />
              </div>

              <Button
                variant="primary"
                size="lg"
                fullWidth
                icon={ShieldCheck}
                onClick={handleOpenConfirmModal}
              >
                {t("officer.review.submitBtn")}
              </Button>
            </Card>
          ) : (
            <Card className="bg-emerald-50/60 border-emerald-200 space-y-2.5">
              <div className="flex items-center gap-2 text-[#166534]">
                <CheckCircle2 className="w-5 h-5" />
                <h3 className="text-sm font-extrabold">
                  {t("officer.review.alreadyReviewedTitle")}
                </h3>
              </div>
              <p className="text-xs text-slate-600">
                {t("officer.review.alreadyReviewedDesc")}
              </p>
              {diagnosis.officer_label && (
                <p className="text-xs font-bold text-slate-900">
                  {t("scanResult.officerConfirmedLabel")}:{" "}
                  {formatDiseaseKey(diagnosis.officer_label, lang)}
                </p>
              )}
              {diagnosis.officer_notes && (
                <p className="text-xs text-slate-700 italic">
                  &ldquo;{diagnosis.officer_notes}&rdquo;
                </p>
              )}
            </Card>
          )}
        </div>
      </div>

      {/* ================= CONFIRMATION MODAL BEFORE SUBMITTING ================= */}
      {modalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs"
        >
          <Card className="w-full max-w-md space-y-5 shadow-2xl border-slate-200">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    action === "confirm"
                      ? "bg-emerald-100 text-[#166534]"
                      : "bg-sky-100 text-sky-700"
                  }`}
                >
                  {action === "confirm" ? (
                    <CheckCircle2 className="w-5 h-5" />
                  ) : (
                    <Edit3 className="w-5 h-5" />
                  )}
                </div>
                <h3 className="text-base sm:text-lg font-extrabold text-slate-900">
                  {t("officer.review.modal.title")}
                </h3>
              </div>

              <button
                type="button"
                onClick={() => setModalOpen(false)}
                disabled={submitting}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              {action === "confirm"
                ? t("officer.review.modal.confirmDesc")
                : t("officer.review.modal.correctDesc")}
            </p>

            <div className="rounded-xl bg-[#f8faf5] border border-slate-200/80 p-3.5 space-y-2.5 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-slate-500">
                  {t("officer.review.modal.actionLabel")}:
                </span>
                <Badge variant={action === "confirm" ? "success" : "info"}>
                  {action === "confirm"
                    ? t("officer.review.modal.actionConfirm")
                    : t("officer.review.modal.actionCorrect")}
                </Badge>
              </div>

              <div>
                <p className="font-semibold text-slate-500">
                  {t("officer.review.modal.finalDiseaseLabel")}:
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  {action === "correct" && (
                    <>
                      <span className="line-through text-slate-400">
                        {formatDiseaseKey(diagnosis.predicted_class, lang)}
                      </span>
                      <ArrowRight className="w-3.5 h-3.5 text-sky-600" />
                    </>
                  )}
                  <span className="font-extrabold text-slate-900">
                    {formatDiseaseKey(finalDiseaseKey, lang)}
                  </span>
                </div>
              </div>

              <div>
                <p className="font-semibold text-slate-500">
                  {t("officer.review.modal.notesLabel")}:
                </p>
                <p className="mt-0.5 text-slate-700">
                  {notes.trim() || t("officer.review.modal.noNotes")}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-1">
              <Button
                variant="outline"
                size="sm"
                disabled={submitting}
                onClick={() => setModalOpen(false)}
              >
                {t("officer.review.modal.cancelBtn")}
              </Button>
              <Button
                variant="primary"
                size="sm"
                loading={submitting}
                onClick={handleConfirmSubmit}
              >
                {submitting
                  ? t("officer.review.submittingBtn")
                  : t("officer.review.modal.confirmSubmitBtn")}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
