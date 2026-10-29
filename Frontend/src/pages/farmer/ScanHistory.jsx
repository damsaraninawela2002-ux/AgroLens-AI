import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  Camera,
  CheckCircle2,
  Clock,
  RefreshCw,
  Search,
  ShieldCheck,
  Sprout,
} from "lucide-react";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Badge from "../../components/ui/Badge";
import { useLanguage } from "../../context/LanguageContext";
import { getFarmerHistory } from "../../services/predictService";
import {
  extractErrorMessage,
  formatConfidence,
  formatDate,
  formatDiseaseKey,
  getConfidenceTone,
  getImageUrl,
} from "../../utils/formatters";

export default function ScanHistory() {
  const { lang, t } = useLanguage();

  const [scans, setScans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const loadHistory = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getFarmerHistory();
      setScans(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    getFarmerHistory()
      .then((data) => {
        if (active) {
          setScans(Array.isArray(data) ? data : []);
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
  }, []);

  const filterTabs = [
    { id: "all", label: t("history.filters.all") },
    { id: "auto", label: t("history.filters.auto") },
    { id: "pending_review", label: t("history.filters.pending_review") },
    { id: "confirmed", label: t("history.filters.confirmed") },
    { id: "corrected", label: t("history.filters.corrected") },
  ];

  const filteredScans = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return scans.filter((scan) => {
      if (statusFilter !== "all" && scan.status !== statusFilter) {
        return false;
      }
      if (!q) return true;

      const effectiveClass = scan.officer_label || scan.predicted_class || "";
      const labelEn = formatDiseaseKey(effectiveClass, "en").toLowerCase();
      const labelSi = formatDiseaseKey(effectiveClass, "si").toLowerCase();
      return (
        effectiveClass.toLowerCase().includes(q) ||
        labelEn.includes(q) ||
        labelSi.includes(q)
      );
    });
  }, [scans, statusFilter, searchQuery]);

  const statusBadgeProps = (status) => {
    if (status === "pending_review") return { variant: "warning", icon: Clock };
    if (status === "confirmed") return { variant: "success", icon: CheckCircle2 };
    if (status === "corrected") return { variant: "info", icon: ShieldCheck };
    if (status === "auto") return { variant: "success", icon: ShieldCheck };
    return { variant: "neutral", icon: null };
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
            {t("history.pageTitle")}
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            {t("history.pageSubtitle")}
          </p>
        </div>

        <Link to="/farmer/scan">
          <Button variant="primary" icon={Camera}>
            {t("history.newScanBtn")}
          </Button>
        </Link>
      </div>

      {/* Filters & Search Bar */}
      <Card padding="p-4 sm:p-5" className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Status Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
            {filterTabs.map((tab) => {
              const active = statusFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStatusFilter(tab.id)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                    active
                      ? "bg-[#166534] text-white shadow-xs"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200/70"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Search Input */}
          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("history.searchPlaceholder")}
              className="w-full rounded-xl bg-[#f8faf5] pl-10 pr-4 py-2 text-sm text-slate-900 placeholder:text-slate-400 border border-slate-200 focus:outline-none focus:border-[#166534] focus:bg-white"
            />
          </div>
        </div>
      </Card>

      {/* Error Banner */}
      {error && (
        <Card className="border-red-200 bg-red-50/60 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-[#dc2626]">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <span className="text-sm font-semibold">{error}</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            icon={RefreshCw}
            onClick={loadHistory}
          >
            {t("dashboard.error.retryBtn")}
          </Button>
        </Card>
      )}

      {/* Loading Skeletons */}
      {loading && (
        <Card className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="flex items-center justify-between gap-4 p-3 rounded-xl border border-slate-100"
            >
              <div className="flex items-center gap-3.5 flex-1">
                <div className="w-14 h-14 rounded-xl bg-slate-200 animate-pulse shrink-0" />
                <div className="space-y-2 flex-1">
                  <div className="h-4 w-48 bg-slate-200 rounded animate-pulse" />
                  <div className="h-3 w-32 bg-slate-100 rounded animate-pulse" />
                </div>
              </div>
              <div className="h-6 w-24 bg-slate-200 rounded-full animate-pulse" />
            </div>
          ))}
        </Card>
      )}

      {/* Empty State */}
      {!loading && !error && filteredScans.length === 0 && (
        <Card className="py-14 px-6 text-center max-w-lg mx-auto space-y-4">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-50 text-[#166534] flex items-center justify-center">
            <Sprout className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-extrabold text-slate-900">
              {t("history.empty.title")}
            </h3>
            <p className="text-xs sm:text-sm text-slate-600">
              {t("history.empty.subtitle")}
            </p>
          </div>
          <div>
            <Link to="/farmer/scan">
              <Button variant="primary" icon={Camera}>
                {t("history.newScanBtn")}
              </Button>
            </Link>
          </div>
        </Card>
      )}

      {/* Desktop Table & Mobile Cards */}
      {!loading && filteredScans.length > 0 && (
        <>
          {/* Desktop Table (md and up) */}
          <Card padding="p-0" className="hidden md:block overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200/80 bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    <th className="py-3.5 px-5">{t("history.table.leaf")}</th>
                    <th className="py-3.5 px-5">
                      {t("history.table.disease")}
                    </th>
                    <th className="py-3.5 px-5">
                      {t("history.table.confidence")}
                    </th>
                    <th className="py-3.5 px-5">{t("history.table.status")}</th>
                    <th className="py-3.5 px-5">{t("history.table.date")}</th>
                    <th className="py-3.5 px-5 text-right">
                      {t("history.table.action")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filteredScans.map((scan) => {
                    const effectiveClass =
                      scan.officer_label || scan.predicted_class;
                    const isCorrected =
                      scan.status === "corrected" ||
                      Boolean(
                        scan.officer_label &&
                          scan.officer_label !== scan.predicted_class
                      );
                    const tone = getConfidenceTone(scan.confidence);
                    const badge = statusBadgeProps(scan.status);

                    return (
                      <tr
                        key={scan.id}
                        className="hover:bg-emerald-50/30 transition-colors"
                      >
                        <td className="py-3.5 px-5">
                          <img
                            src={getImageUrl(scan.image_url)}
                            alt={formatDiseaseKey(effectiveClass, lang)}
                            className="w-12 h-12 rounded-xl object-cover border border-slate-200 bg-slate-100"
                          />
                        </td>
                        <td className="py-3.5 px-5">
                          {isCorrected && (
                            <p className="text-xs line-through text-slate-400">
                              {formatDiseaseKey(scan.predicted_class, lang)}
                            </p>
                          )}
                          <p className="font-bold text-slate-900">
                            {formatDiseaseKey(effectiveClass, lang)}
                          </p>
                        </td>
                        <td className="py-3.5 px-5">
                          <span className={`font-extrabold ${tone.textClass}`}>
                            {formatConfidence(scan.confidence, 1)}
                          </span>
                        </td>
                        <td className="py-3.5 px-5">
                          <Badge variant={badge.variant} icon={badge.icon}>
                            {t(`status.${scan.status}`, scan.status)}
                          </Badge>
                        </td>
                        <td className="py-3.5 px-5 text-slate-500 text-xs">
                          {formatDate(scan.created_at, lang)}
                        </td>
                        <td className="py-3.5 px-5 text-right">
                          <Link
                            to={`/farmer/scan/${scan.id}`}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-[#166534] bg-emerald-50 hover:bg-emerald-100 transition-colors"
                          >
                            <span>{t("history.table.view")}</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Mobile Cards (< md) */}
          <div className="grid grid-cols-1 gap-3.5 md:hidden">
            {filteredScans.map((scan) => {
              const effectiveClass =
                scan.officer_label || scan.predicted_class;
              const isCorrected =
                scan.status === "corrected" ||
                Boolean(
                  scan.officer_label &&
                    scan.officer_label !== scan.predicted_class
                );
              const tone = getConfidenceTone(scan.confidence);
              const badge = statusBadgeProps(scan.status);

              return (
                <Link key={scan.id} to={`/farmer/scan/${scan.id}`}>
                  <Card
                    padding="p-4"
                    className="flex items-center justify-between gap-3.5 active:scale-[0.99] transition-transform"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <img
                        src={getImageUrl(scan.image_url)}
                        alt={formatDiseaseKey(effectiveClass, lang)}
                        className="w-16 h-16 rounded-xl object-cover border border-slate-200 shrink-0 bg-slate-100"
                      />
                      <div className="min-w-0 space-y-1">
                        {isCorrected && (
                          <p className="text-[11px] line-through text-slate-400 truncate">
                            {formatDiseaseKey(scan.predicted_class, lang)}
                          </p>
                        )}
                        <p className="text-sm font-bold text-slate-900 truncate">
                          {formatDiseaseKey(effectiveClass, lang)}
                        </p>
                        <div className="flex items-center gap-2 text-xs">
                          <span className={`font-extrabold ${tone.textClass}`}>
                            {formatConfidence(scan.confidence, 1)}
                          </span>
                          <span className="text-slate-300">•</span>
                          <span className="text-slate-500">
                            {formatDate(scan.created_at, lang)}
                          </span>
                        </div>
                        <div>
                          <Badge variant={badge.variant} icon={badge.icon}>
                            {t(`status.${scan.status}`, scan.status)}
                          </Badge>
                        </div>
                      </div>
                    </div>

                    <ArrowRight className="w-5 h-5 text-slate-400 shrink-0" />
                  </Card>
                </Link>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
