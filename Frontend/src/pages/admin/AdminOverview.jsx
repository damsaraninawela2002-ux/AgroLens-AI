import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  CheckCircle2,
  Clock,
  RefreshCw,
  ScanLine,
  Shield,
  Sprout,
  Stethoscope,
  UserCheck,
  Users,
} from "lucide-react";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Badge from "../../components/ui/Badge";
import { useLanguage } from "../../context/LanguageContext";
import {
  getAdminAnalyticsOverview,
  getAdminScansOverTime,
  getAdminDiseaseAnalytics,
  getAdminDistrictAnalytics,
} from "../../services/adminService";
import {
  extractErrorMessage,
  formatShortDiseaseKey,
  isHealthyDiseaseKey,
} from "../../utils/formatters";

export default function AdminOverview() {
  const { lang, t } = useLanguage();

  const [overview, setOverview] = useState(null);
  const [scansSeries, setScansSeries] = useState([]);
  const [diseaseStats, setDiseaseStats] = useState([]);
  const [districtStats, setDistrictStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [ov, overTime, diseases, districts] = await Promise.all([
        getAdminAnalyticsOverview(),
        getAdminScansOverTime(30),
        getAdminDiseaseAnalytics(),
        getAdminDistrictAnalytics(),
      ]);
      setOverview(ov);
      setScansSeries(Array.isArray(overTime?.series) ? overTime.series : []);
      setDiseaseStats(Array.isArray(diseases?.items) ? diseases.items : []);
      setDistrictStats(Array.isArray(districts?.items) ? districts.items : []);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    Promise.all([
      getAdminAnalyticsOverview(),
      getAdminScansOverTime(30),
      getAdminDiseaseAnalytics(),
      getAdminDistrictAnalytics(),
    ])
      .then(([ov, overTime, diseases, districts]) => {
        if (!active) return;
        setOverview(ov);
        setScansSeries(Array.isArray(overTime?.series) ? overTime.series : []);
        setDiseaseStats(Array.isArray(diseases?.items) ? diseases.items : []);
        setDistrictStats(
          Array.isArray(districts?.items) ? districts.items : []
        );
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
  }, []);

  const kpiCards = [
    {
      label: t("admin.overview.kpi.farmers"),
      value: overview?.users_by_role?.farmer ?? 0,
      icon: Sprout,
      iconBg: "bg-emerald-50 text-[#166534] border-emerald-200/70",
      to: "/admin/users",
    },
    {
      label: t("admin.overview.kpi.officers"),
      value: overview?.users_by_role?.officer ?? 0,
      icon: UserCheck,
      iconBg: "bg-sky-50 text-sky-700 border-sky-200/70",
      to: "/admin/users",
    },
    {
      label: t("admin.overview.kpi.totalScans"),
      value: overview?.total_scans ?? 0,
      icon: ScanLine,
      iconBg: "bg-lime-50 text-[#3f6212] border-lime-200/70",
      to: "/admin/diagnoses",
    },
    {
      label: t("admin.overview.kpi.scansToday"),
      value: overview?.scans_today ?? 0,
      icon: Calendar,
      iconBg: "bg-emerald-50 text-[#166534] border-emerald-200/70",
      to: "/admin/diagnoses",
    },
    {
      label: t("admin.overview.kpi.pendingReviews"),
      value: overview?.pending_reviews ?? 0,
      icon: Clock,
      iconBg: "bg-amber-50 text-amber-700 border-amber-200/70",
      to: "/admin/diagnoses",
    },
    {
      label: t("admin.overview.kpi.pendingApprovals"),
      value: overview?.pending_officer_approvals ?? 0,
      icon: Users,
      iconBg: "bg-amber-50 text-amber-700 border-amber-200/70",
      to: "/admin/approvals",
    },
    {
      label: t("admin.overview.kpi.unverifiedTreatments"),
      value: overview?.unverified_treatments_count ?? 0,
      icon: Stethoscope,
      iconBg: "bg-red-50 text-[#dc2626] border-red-200/70",
      to: "/admin/treatments",
    },
  ];

  const topDiseasesChartData = diseaseStats.slice(0, 6).map((item) => ({
    key: item.disease_key,
    name: formatShortDiseaseKey(item.disease_key, lang),
    count: item.final_count,
    isHealthy: isHealthyDiseaseKey(item.disease_key),
  }));

  const districtChartData = districtStats.slice(0, 8);

  const confirmedCount = overview?.confirmed_vs_corrected?.confirmed ?? 0;
  const correctedCount = overview?.confirmed_vs_corrected?.corrected ?? 0;
  const totalReviewed = confirmedCount + correctedCount;
  const donutData = [
    {
      name: t("admin.overview.charts.confirmed"),
      value: confirmedCount,
      color: "#16a34a",
    },
    {
      name: t("admin.overview.charts.corrected"),
      value: correctedCount,
      color: "#0284c7",
    },
  ];

  const pendingApprovalsCount = overview?.pending_officer_approvals ?? 0;
  const unverifiedTreatmentsCount = overview?.unverified_treatments_count ?? 0;

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* ================= HERO BANNER ================= */}
      <div className="rounded-3xl bg-gradient-to-br from-[#052e16] via-[#14532d] to-[#166534] text-white p-6 sm:p-8 shadow-lg shadow-[#166534]/15 relative overflow-hidden">
        <div
          className="pointer-events-none absolute -right-16 -top-16 w-72 h-72 rounded-full bg-[#84cc16]/20 blur-3xl"
          aria-hidden="true"
        />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/15 text-xs font-semibold text-[#a3e635]">
              <Shield className="w-3.5 h-3.5" />
              <span>{t("admin.overview.bannerBadge")}</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              {t("admin.overview.bannerTitle")}
            </h2>
            <p className="text-sm sm:text-base text-emerald-100/90 leading-relaxed">
              {t("admin.overview.bannerDesc")}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <Link to="/admin/users">
              <Button variant="accent" size="md" icon={Users}>
                {t("sidebar.users")}
              </Button>
            </Link>
            <Link to="/admin/treatments">
              <Button
                variant="outline"
                size="md"
                icon={Stethoscope}
                className="bg-white/10 text-white border-white/20 hover:bg-white/20"
              >
                {t("sidebar.treatments")}
              </Button>
            </Link>
          </div>
        </div>
      </div>

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
            onClick={loadAll}
          >
            {t("admin.common.retry")}
          </Button>
        </Card>
      )}

      {/* ================= 7 KPI STAT CARDS ================= */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3.5 sm:gap-4">
        {kpiCards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <Link key={idx} to={card.to} className="group block">
              <Card
                padding="p-4"
                className="h-full hover:border-[#166534]/40 transition-all"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 line-clamp-2">
                    {card.label}
                  </span>
                  <div
                    className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${card.iconBg}`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                </div>
                {loading ? (
                  <div className="mt-3 h-7 w-14 rounded-lg bg-slate-200 animate-pulse" />
                ) : (
                  <p className="mt-3 text-2xl font-extrabold text-slate-900 group-hover:text-[#166534] transition-colors">
                    {card.value}
                  </p>
                )}
              </Card>
            </Link>
          );
        })}
      </div>

      {/* ================= "NEEDS ATTENTION" PANEL ================= */}
      <Card className="space-y-4">
        <div className="pb-2 border-b border-slate-100">
          <h3 className="text-lg font-extrabold text-slate-900">
            {t("admin.overview.attention.title")}
          </h3>
          <p className="text-xs text-slate-500">
            {t("admin.overview.attention.subtitle")}
          </p>
        </div>

        {pendingApprovalsCount === 0 && unverifiedTreatmentsCount === 0 ? (
          <div className="flex items-center gap-3 p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200/80 text-[#166534]">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <div>
              <p className="text-sm font-extrabold">
                {t("admin.overview.attention.allClearTitle")}
              </p>
              <p className="text-xs text-emerald-800/80">
                {t("admin.overview.attention.allClearDesc")}
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 font-extrabold text-sm">
                  {pendingApprovalsCount}
                </div>
                <div>
                  <p className="text-sm font-extrabold text-slate-900">
                    {t("admin.overview.attention.officersWaitingTitle")}
                  </p>
                  <p className="text-xs text-slate-600">
                    {t("admin.overview.attention.officersWaitingDesc")}
                  </p>
                </div>
              </div>
              <Link to="/admin/approvals" className="shrink-0">
                <Button variant="primary" size="sm">
                  <span>{t("admin.overview.attention.reviewOfficersBtn")}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </Link>
            </div>

            <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 font-extrabold text-sm">
                  {unverifiedTreatmentsCount}
                </div>
                <div>
                  <p className="text-sm font-extrabold text-slate-900">
                    {t("admin.overview.attention.unverifiedTreatmentsTitle")}
                  </p>
                  <p className="text-xs text-slate-600">
                    {t("admin.overview.attention.unverifiedTreatmentsDesc")}
                  </p>
                </div>
              </div>
              <Link to="/admin/treatments" className="shrink-0">
                <Button variant="primary" size="sm">
                  <span>
                    {t("admin.overview.attention.verifyTreatmentsBtn")}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </Link>
            </div>
          </div>
        )}
      </Card>

      {/* ================= 4 RECHARTS PANELS ================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* 1. Scans Over the Last 30 Days (AreaChart) */}
        <Card className="lg:col-span-7 space-y-4">
          <div className="pb-2 border-b border-slate-100">
            <h3 className="text-base font-extrabold text-slate-900">
              {t("admin.overview.charts.scansOverTimeTitle")}
            </h3>
            <p className="text-xs text-slate-500">
              {t("admin.overview.charts.scansOverTimeSubtitle")}
            </p>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={scansSeries}
                margin={{ top: 8, right: 12, left: -16, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="scansFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#166534" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#166534" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: "#64748b" }}
                  tickFormatter={(val) => String(val).slice(5)}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: "#64748b" }}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: "12px",
                    border: "1px solid #e2e8f0",
                    fontSize: "12px",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="count"
                  name={t("admin.overview.charts.scansCount")}
                  stroke="#166534"
                  strokeWidth={2.5}
                  fill="url(#scansFill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* 2. Confirmed vs Corrected (Donut PieChart) */}
        <Card className="lg:col-span-5 space-y-4">
          <div className="pb-2 border-b border-slate-100">
            <h3 className="text-base font-extrabold text-slate-900">
              {t("admin.overview.charts.decisionsTitle")}
            </h3>
            <p className="text-xs text-slate-500">
              {t("admin.overview.charts.decisionsSubtitle")}
            </p>
          </div>

          {totalReviewed === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-center text-xs text-slate-500">
              {t("admin.model.agreement.noReviewsYet")}
            </div>
          ) : (
            <div className="h-64 flex flex-col justify-between">
              <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={donutData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={48}
                      outerRadius={72}
                      paddingAngle={4}
                    >
                      {donutData.map((entry, idx) => (
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
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-200/70 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700">
                    {t("admin.overview.charts.confirmed")}
                  </span>
                  <Badge variant="success">{confirmedCount}</Badge>
                </div>
                <div className="p-2.5 rounded-xl bg-sky-50/70 border border-sky-200/70 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700">
                    {t("admin.overview.charts.corrected")}
                  </span>
                  <Badge variant="info">{correctedCount}</Badge>
                </div>
              </div>
            </div>
          )}
        </Card>

        {/* 3. Top Diseases (Horizontal BarChart) */}
        <Card className="lg:col-span-6 space-y-4">
          <div className="pb-2 border-b border-slate-100">
            <h3 className="text-base font-extrabold text-slate-900">
              {t("admin.overview.charts.topDiseasesTitle")}
            </h3>
            <p className="text-xs text-slate-500">
              {t("admin.overview.charts.topDiseasesSubtitle")}
            </p>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={topDiseasesChartData}
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
                  width={120}
                  tick={{ fontSize: 11, fill: "#334155", fontWeight: 600 }}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: "12px",
                    border: "1px solid #e2e8f0",
                    fontSize: "12px",
                  }}
                />
                <Bar
                  dataKey="count"
                  name={t("admin.overview.charts.scansCount")}
                  radius={[0, 8, 8, 0]}
                  barSize={20}
                >
                  {topDiseasesChartData.map((entry, idx) => (
                    <Cell
                      key={idx}
                      fill={entry.isHealthy ? "#84cc16" : "#166534"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* 4. Scans by District (BarChart) */}
        <Card className="lg:col-span-6 space-y-4">
          <div className="pb-2 border-b border-slate-100">
            <h3 className="text-base font-extrabold text-slate-900">
              {t("admin.overview.charts.districtsTitle")}
            </h3>
            <p className="text-xs text-slate-500">
              {t("admin.overview.charts.districtsSubtitle")}
            </p>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={districtChartData}
                margin={{ top: 8, right: 12, left: -16, bottom: 4 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#e2e8f0"
                />
                <XAxis
                  dataKey="district"
                  tick={{ fontSize: 11, fill: "#334155", fontWeight: 600 }}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: "#64748b" }}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: "12px",
                    border: "1px solid #e2e8f0",
                    fontSize: "12px",
                  }}
                />
                <Bar
                  dataKey="count"
                  name={t("admin.overview.charts.scansCount")}
                  fill="#15803d"
                  radius={[8, 8, 0, 0]}
                  barSize={28}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  );
}
