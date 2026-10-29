import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
} from "recharts";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  Clock,
  MapPin,
  RefreshCw,
  ShieldCheck,
  UserCheck,
} from "lucide-react";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Badge from "../../components/ui/Badge";
import { useAuth } from "../../context/AuthContext";
import { useLanguage } from "../../context/LanguageContext";
import {
  getOfficerStats,
  getPendingDiagnoses,
} from "../../services/officerService";
import {
  extractErrorMessage,
  formatConfidence,
  formatDiseaseKey,
  formatTimeAgo,
  getConfidenceTone,
  getImageUrl,
} from "../../utils/formatters";
import OfficerWaitingApprovalCard from "../../components/officer/OfficerWaitingApprovalCard";

export default function OfficerDashboard() {
  const { user } = useAuth();
  const { lang, t } = useLanguage();

  const isUnapprovedOfficer =
    user?.role === "officer" && user?.is_approved === false;

  const [stats, setStats] = useState(null);
  const [oldestPending, setOldestPending] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadDashboard = useCallback(async () => {
    if (isUnapprovedOfficer) return;
    setLoading(true);
    setError("");
    try {
      const [statsData, pendingData] = await Promise.all([
        getOfficerStats(),
        getPendingDiagnoses({ limit: 5, page: 1 }),
      ]);
      setStats(statsData);
      setOldestPending(
        Array.isArray(pendingData?.items) ? pendingData.items : []
      );
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [isUnapprovedOfficer]);

  useEffect(() => {
    if (isUnapprovedOfficer) return;
    let active = true;
    Promise.all([
      getOfficerStats(),
      getPendingDiagnoses({ limit: 5, page: 1 }),
    ])
      .then(([statsData, pendingData]) => {
        if (active) {
          setStats(statsData);
          setOldestPending(
            Array.isArray(pendingData?.items) ? pendingData.items : []
          );
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
  }, [isUnapprovedOfficer]);

  if (isUnapprovedOfficer) {
    return <OfficerWaitingApprovalCard />;
  }

  const confirmedCount = Number(stats?.confirmed_count) || 0;
  const correctedCount = Number(stats?.corrected_count) || 0;
  const totalDecisions = confirmedCount + correctedCount;

  const pieData = [
    {
      name: t("officer.dashboard.stats.confirmed"),
      value: confirmedCount,
      color: "#16a34a",
    },
    {
      name: t("officer.dashboard.stats.corrected"),
      value: correctedCount,
      color: "#0284c7",
    },
  ];

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* ================= GREETING BANNER ================= */}
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
                {t("dashboard.districtBadge")}:{" "}
                {stats?.district || user?.district || "Sri Lanka"}
              </span>
            </div>

            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              {t("officer.dashboard.greetingPrefix")} {user?.full_name}!
            </h2>

            <p className="text-sm sm:text-base text-emerald-100/90 leading-relaxed">
              {t("officer.dashboard.districtSubtitle")}{" "}
              <strong className="text-white">
                {stats?.district || user?.district}
              </strong>
              .
            </p>
          </div>

          <div className="shrink-0">
            <Link to="/officer/queue">
              <Button
                variant="accent"
                size="lg"
                icon={ClipboardList}
                className="w-full sm:w-auto text-base px-7 py-4 shadow-lg"
              >
                {t("officer.dashboard.openQueueBtn")}
              </Button>
            </Link>
          </div>
        </div>
      </motion.div>

      {/* ================= ERROR BANNER ================= */}
      {error && (
        <Card className="border-red-200 bg-red-50/60 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-[#dc2626]">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <div>
              <p className="text-sm font-bold">{t("dashboard.error.title")}</p>
              <p className="text-xs text-red-700">{error}</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            icon={RefreshCw}
            onClick={loadDashboard}
          >
            {t("dashboard.error.retryBtn")}
          </Button>
        </Card>
      )}

      {/* ================= 4 STAT CARDS ================= */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        {[
          {
            label: t("officer.dashboard.stats.pendingInDistrict"),
            value: stats?.pending_count ?? 0,
            icon: Clock,
            iconBg: "bg-amber-50 text-amber-700 border-amber-200/70",
          },
          {
            label: t("officer.dashboard.stats.reviewedToday"),
            value: stats?.reviewed_today ?? 0,
            icon: UserCheck,
            iconBg: "bg-emerald-50 text-[#166534] border-emerald-200/70",
          },
          {
            label: t("officer.dashboard.stats.totalReviewed"),
            value: stats?.total_reviewed ?? 0,
            icon: CheckCircle2,
            iconBg: "bg-lime-50 text-[#3f6212] border-lime-200/70",
          },
          {
            label: t("officer.dashboard.stats.confirmedVsCorrected"),
            value: `${confirmedCount} / ${correctedCount}`,
            icon: ShieldCheck,
            iconBg: "bg-sky-50 text-sky-700 border-sky-200/70",
          },
        ].map((card, idx) => {
          const Icon = card.icon;
          return (
            <Card key={idx} padding="p-4 sm:p-5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  {card.label}
                </span>
                <div
                  className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${card.iconBg}`}
                >
                  <Icon className="w-5 h-5" />
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
          );
        })}
      </div>

      {/* ================= OLDEST 5 PENDING CASES + RECHARTS DONUT CHART ================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Oldest 5 Pending Cases */}
        <Card className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-lg font-extrabold text-slate-900">
                {t("officer.dashboard.oldestPending.title")}
              </h3>
              <p className="text-xs text-slate-500">
                {t("officer.dashboard.oldestPending.subtitle")}
              </p>
            </div>
            <Link
              to="/officer/queue"
              className="inline-flex items-center gap-1 text-xs font-bold text-[#166534] hover:text-[#15803d]"
            >
              <span>{t("officer.dashboard.oldestPending.viewAll")}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
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
                  <div className="h-8 w-24 bg-slate-200 rounded-xl animate-pulse" />
                </div>
              ))}
            </div>
          ) : oldestPending.length === 0 ? (
            <div className="py-10 px-4 text-center space-y-2">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-50 text-[#166534] flex items-center justify-center">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <h4 className="text-base font-extrabold text-slate-900">
                {t("officer.dashboard.oldestPending.emptyTitle")}
              </h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                {t("officer.dashboard.oldestPending.emptySubtitle")}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {oldestPending.map((item) => {
                const tone = getConfidenceTone(item.confidence);
                return (
                  <div
                    key={item.id}
                    className="py-3.5 first:pt-1 last:pb-1 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <img
                        src={getImageUrl(item.image_url)}
                        alt={formatDiseaseKey(item.predicted_class, lang)}
                        className="w-14 h-14 rounded-xl object-cover border border-slate-200 shrink-0 bg-slate-100"
                      />
                      <div className="min-w-0 space-y-1">
                        <p className="text-sm font-bold text-slate-900 truncate">
                          {formatDiseaseKey(item.predicted_class, lang)}
                        </p>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                          <span className="font-semibold text-slate-700">
                            {item.farmer_name}
                          </span>
                          <span>•</span>
                          <span>{item.district}</span>
                          <span>•</span>
                          <span>{formatTimeAgo(item.created_at, lang)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-2.5 shrink-0">
                      <Badge variant={tone.badgeVariant}>
                        {formatConfidence(item.confidence, 1)}
                      </Badge>
                      <Link to={`/officer/review/${item.id}`}>
                        <Button
                          variant="primary"
                          size="sm"
                          icon={ArrowRight}
                          iconPosition="right"
                        >
                          {t("officer.dashboard.oldestPending.reviewNow")}
                        </Button>
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Right: Recharts Donut Chart (Confirmed vs Corrected) */}
        <Card className="lg:col-span-5 space-y-4">
          <div className="pb-3 border-b border-slate-100">
            <h3 className="text-lg font-extrabold text-slate-900">
              {t("officer.dashboard.chart.title")}
            </h3>
            <p className="text-xs text-slate-500">
              {t("officer.dashboard.chart.subtitle")}
            </p>
          </div>

          {loading ? (
            <div className="h-56 w-full rounded-xl bg-slate-100 animate-pulse" />
          ) : totalDecisions === 0 ? (
            <div className="h-56 flex flex-col items-center justify-center text-center px-4 space-y-2">
              <ShieldCheck className="w-8 h-8 text-slate-300" />
              <p className="text-xs font-semibold text-slate-500">
                {t("officer.dashboard.chart.empty")}
              </p>
            </div>
          ) : (
            <>
              <div className="h-56 w-full relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={56}
                      outerRadius={82}
                      paddingAngle={4}
                    >
                      {pieData.map((entry, idx) => (
                        <Cell key={idx} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        borderRadius: "12px",
                        border: "1px solid #e2e8f0",
                        fontSize: "12px",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-extrabold text-slate-900">
                    {totalDecisions}
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    {t("officer.dashboard.stats.totalReviewed")}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-center gap-6 pt-1 text-xs font-semibold text-slate-700">
                <span className="inline-flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-[#16a34a]" />
                  <span>
                    {t("officer.dashboard.stats.confirmed")} ({confirmedCount})
                  </span>
                </span>
                <span className="inline-flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-[#0284c7]" />
                  <span>
                    {t("officer.dashboard.stats.corrected")} ({correctedCount})
                  </span>
                </span>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
