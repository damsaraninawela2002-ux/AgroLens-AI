import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from "recharts";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Camera,
  CheckCircle2,
  Clock,
  History,
  MapPin,
  RefreshCw,
  Sprout,
} from "lucide-react";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Badge from "../../components/ui/Badge";
import FadeIn from "../../components/common/FadeIn";
import { useAuth } from "../../context/AuthContext";
import { useLanguage } from "../../context/LanguageContext";
import { getFarmerHistory } from "../../services/predictService";
import {
  extractErrorMessage,
  formatConfidence,
  formatDate,
  formatDiseaseKey,
  formatShortDiseaseKey,
  getConfidenceTone,
  getImageUrl,
  isHealthyDiseaseKey,
} from "../../utils/formatters";

export default function FarmerDashboard() {
  const { user } = useAuth();
  const { lang, t } = useLanguage();

  const [scans, setScans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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

  // Compute 4 stat cards from history data
  const stats = useMemo(() => {
    const total = scans.length;
    let healthy = 0;
    let diseased = 0;
    let pending = 0;

    for (const s of scans) {
      const effectiveClass = s.officer_label || s.predicted_class;
      if (isHealthyDiseaseKey(effectiveClass)) {
        healthy += 1;
      } else {
        diseased += 1;
      }
      if (s.status === "pending_review") {
        pending += 1;
      }
    }

    return { total, healthy, diseased, pending };
  }, [scans]);

  // Recent 5 scans
  const recentScans = useMemo(() => scans.slice(0, 5), [scans]);

  // Aggregate scans by disease for Recharts bar chart
  const chartData = useMemo(() => {
    const counts = {};
    for (const s of scans) {
      const key = s.officer_label || s.predicted_class || "Unknown";
      counts[key] = (counts[key] || 0) + 1;
    }

    return Object.entries(counts)
      .map(([key, count]) => ({
        key,
        name: formatShortDiseaseKey(key, lang),
        fullName: formatDiseaseKey(key, lang),
        count,
        isHealthy: isHealthyDiseaseKey(key),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [scans, lang]);

  const statusBadgeProps = (status) => {
    if (status === "pending_review") return { variant: "warning", icon: Clock };
    if (status === "confirmed" || status === "auto")
      return { variant: "success", icon: CheckCircle2 };
    if (status === "corrected") return { variant: "info", icon: CheckCircle2 };
    return { variant: "neutral", icon: null };
  };

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* ================= GREETING + BIG "SCAN A LEAF" CTA CARD ================= */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="rounded-3xl bg-gradient-to-br from-[#052e16] via-[#14532d] to-[#166534] text-white p-6 sm:p-8 lg:p-10 shadow-lg shadow-[#166534]/15 relative overflow-hidden"
      >
        <div
          className="pointer-events-none absolute -right-16 -top-16 w-72 h-72 rounded-full bg-[#84cc16]/20 blur-3xl"
          aria-hidden="true"
        />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2.5 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/15 text-xs font-semibold text-[#a3e635]">
              <MapPin className="w-3.5 h-3.5" />
              <span>
                {t("dashboard.districtBadge")}: {user?.district || "Sri Lanka"}
              </span>
            </div>

            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              {t("dashboard.welcome")}, {user?.full_name || "Farmer"}!
            </h2>

            <p className="text-sm sm:text-base text-emerald-100/90 leading-relaxed">
              {t("dashboard.scanCtaDesc")}
            </p>
          </div>

          <div className="w-full sm:w-auto shrink-0">
            <Link to="/farmer/scan" className="block w-full sm:w-auto">
              <Button
                variant="accent"
                size="lg"
                icon={Camera}
                className="w-full sm:w-auto text-base px-7 py-3.5 shadow-lg"
              >
                {t("dashboard.scanCtaButton")}
              </Button>
            </Link>
          </div>
        </div>
      </motion.div>

      {/* ================= ERROR STATE WITH RETRY ================= */}
      {error && (
        <Card className="border-red-200 bg-red-50/60 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-[#dc2626]">
            <AlertTriangle className="w-6 h-6 shrink-0" />
            <div>
              <p className="text-sm font-bold">{t("dashboard.error.title")}</p>
              <p className="text-xs text-red-700">{error}</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            icon={RefreshCw}
            onClick={loadHistory}
            className="w-full sm:w-auto"
          >
            {t("dashboard.error.retryBtn")}
          </Button>
        </Card>
      )}

      {/* ================= 4 STAT CARDS ================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        {[
          {
            label: t("dashboard.stats.totalScans"),
            value: stats.total,
            icon: Camera,
            iconBg: "bg-emerald-50 text-[#166534] border-emerald-200/70",
          },
          {
            label: t("dashboard.stats.healthyResults"),
            value: stats.healthy,
            icon: CheckCircle2,
            iconBg: "bg-lime-50 text-[#3f6212] border-lime-200/70",
          },
          {
            label: t("dashboard.stats.diseasesDetected"),
            value: stats.diseased,
            icon: AlertTriangle,
            iconBg: "bg-red-50 text-[#dc2626] border-red-200/70",
          },
          {
            label: t("dashboard.stats.pendingReview"),
            value: stats.pending,
            icon: Clock,
            iconBg: "bg-amber-50 text-amber-700 border-amber-200/70",
          },
        ].map((card, idx) => {
          const Icon = card.icon;
          return (
            <FadeIn key={idx} delay={idx * 80} className="h-full">
              <Card padding="p-4 sm:p-5" className="h-full">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    {card.label}
                  </span>
                  <div
                    className={`w-11 h-11 rounded-xl border flex items-center justify-center shrink-0 ${card.iconBg}`}
                  >
                    <Icon className="w-6 h-6" />
                  </div>
                </div>
                {loading ? (
                  <div className="mt-3 h-8 w-16 rounded-lg bg-slate-200 animate-pulse" />
                ) : (
                  <p className="mt-3 text-2xl sm:text-3xl font-extrabold text-slate-900">
                    {card.value}
                  </p>
                )}
              </Card>
            </FadeIn>
          );
        })}
      </div>

      {/* ================= LOADING SKELETONS ================= */}
      {loading && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <Card className="lg:col-span-7 space-y-4">
            <div className="h-6 w-48 bg-slate-200 rounded animate-pulse" />
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="flex items-center gap-4 p-3 rounded-xl border border-slate-100"
              >
                <div className="w-14 h-14 rounded-xl bg-slate-200 animate-pulse shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-3/4 bg-slate-200 rounded animate-pulse" />
                  <div className="h-3 w-1/2 bg-slate-100 rounded animate-pulse" />
                </div>
              </div>
            ))}
          </Card>
          <Card className="lg:col-span-5">
            <div className="h-6 w-44 bg-slate-200 rounded animate-pulse mb-4" />
            <div className="h-56 w-full bg-slate-100 rounded-xl animate-pulse" />
          </Card>
        </div>
      )}

      {/* ================= EMPTY STATE (WHEN NO SCANS YET) ================= */}
      {!loading && !error && scans.length === 0 && (
        <FadeIn>
          <Card className="py-14 px-6 text-center max-w-xl mx-auto space-y-5">
            <div className="w-20 h-20 mx-auto rounded-3xl bg-gradient-to-br from-emerald-50 to-lime-100 border border-emerald-200/80 flex items-center justify-center text-[#166534] shadow-inner">
              <Sprout className="w-10 h-10" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-extrabold text-slate-900">
                {t("dashboard.empty.title")}
              </h3>
              <p className="text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
                {t("dashboard.empty.subtitle")}
              </p>
            </div>
            <div>
              <Link to="/farmer/scan" className="block w-full sm:inline-block sm:w-auto">
                <Button variant="primary" size="lg" icon={Camera} className="w-full sm:w-auto">
                  {t("dashboard.empty.actionBtn")}
                </Button>
              </Link>
            </div>
          </Card>
        </FadeIn>
      )}

      {/* ================= RECENT SCANS + RECHARTS BAR CHART ================= */}
      {!loading && scans.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left: Recent 5 Scans List */}
          <FadeIn className="lg:col-span-7">
            <Card className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <History className="w-6 h-6 text-[#166534] shrink-0" />
                  <div>
                    <h3 className="text-lg font-extrabold text-slate-900">
                      {t("dashboard.recentScans.title")}
                    </h3>
                    <p className="text-xs text-slate-500">
                      {t("dashboard.recentScans.subtitle")}
                    </p>
                  </div>
                </div>
                <Link
                  to="/farmer/history"
                  className="btn-interactive inline-flex items-center gap-1.5 min-h-[48px] px-3 py-2 rounded-xl text-xs font-bold text-[#166534] hover:bg-emerald-50 hover:text-[#15803d]"
                >
                  <span>{t("dashboard.recentScans.viewAll")}</span>
                  <ArrowRight className="w-4 h-4 shrink-0" />
                </Link>
              </div>

              <div className="divide-y divide-slate-100">
                {recentScans.map((scan, sIdx) => {
                  const effectiveClass =
                    scan.officer_label || scan.predicted_class;
                  const isCorrected =
                    scan.status === "corrected" &&
                    scan.officer_label &&
                    scan.officer_label !== scan.predicted_class;
                  const tone = getConfidenceTone(scan.confidence);
                  const badge = statusBadgeProps(scan.status);
                  return (
                    <FadeIn key={scan.id} delay={sIdx * 80}>
                      <Link
                        to={`/farmer/scan/${scan.id}`}
                        className="py-3.5 first:pt-1 last:pb-1 flex flex-col sm:flex-row sm:items-center justify-between gap-3 group hover:bg-slate-50/80 -mx-2 px-2 rounded-xl transition-colors"
                      >
                        <div className="flex items-center gap-3.5 min-w-0">
                          <img
                            src={getImageUrl(scan.image_url)}
                            alt={formatDiseaseKey(effectiveClass, lang)}
                            className="w-14 h-14 rounded-xl object-cover border border-slate-200 shrink-0 bg-slate-100"
                          />
                          <div className="min-w-0 space-y-1">
                            {isCorrected && (
                              <p className="text-[11px] font-semibold text-slate-400 line-through truncate">
                                {formatDiseaseKey(scan.predicted_class, lang)}
                              </p>
                            )}
                            <p className="text-sm font-bold text-slate-900 group-hover:text-[#166534] break-words">
                              {formatDiseaseKey(effectiveClass, lang)}
                            </p>
                            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                              <span className={`font-bold ${tone.textClass}`}>
                                {formatConfidence(scan.confidence, 1)}
                              </span>
                              <span>•</span>
                              <span>{formatDate(scan.created_at, lang)}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0 pl-17 sm:pl-0">
                          <Badge variant={badge.variant} icon={badge.icon}>
                            {t(
                              `farmerStatus.${scan.status}`,
                              t(`status.${scan.status}`, scan.status)
                            )}
                          </Badge>
                          <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-[#166534] group-hover:translate-x-0.5 transition-transform hidden sm:block" />
                        </div>
                      </Link>
                    </FadeIn>
                  );
                })}
              </div>
            </Card>
          </FadeIn>

          {/* Right: Recharts Bar Chart (Scans by Disease) */}
          <FadeIn delay={120} className="lg:col-span-5">
            <Card className="space-y-4">
              <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100">
                <BarChart3 className="w-6 h-6 text-[#166534] shrink-0" />
                <div>
                  <h3 className="text-lg font-extrabold text-slate-900">
                    {t("dashboard.chart.title")}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {t("dashboard.chart.subtitle")}
                  </p>
                </div>
              </div>

            <div className="h-64 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData}
                  layout="vertical"
                  margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    horizontal={false}
                    stroke="#e2e8f0"
                  />
                  <XAxis
                    type="number"
                    allowDecimals={false}
                    tick={{ fontSize: 11, fill: "#64748b" }}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={115}
                    tick={{ fontSize: 11, fill: "#334155", fontWeight: 600 }}
                  />
                  <Tooltip
                    cursor={{ fill: "#f1f5f9" }}
                    contentStyle={{
                      borderRadius: "12px",
                      border: "1px solid #e2e8f0",
                      fontSize: "12px",
                    }}
                    formatter={(value) => [
                      value,
                      t("dashboard.chart.countLabel"),
                    ]}
                  />
                  <Bar dataKey="count" radius={[0, 8, 8, 0]} barSize={22}>
                    {chartData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.isHealthy ? "#84cc16" : "#166534"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="flex items-center justify-center gap-5 pt-2 text-xs text-slate-600">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-[#166534]" />
                <span>{t("status.diseased")}</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-[#84cc16]" />
                <span>{t("status.healthy")}</span>
              </span>
            </div>
            </Card>
          </FadeIn>
        </div>
      )}
    </div>
  );
}
