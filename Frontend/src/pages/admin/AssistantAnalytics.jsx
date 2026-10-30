import { useCallback, useEffect, useState } from "react";
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
  Activity,
  AlertTriangle,
  Bot,
  Calendar,
  MessageSquare,
  MessagesSquare,
  RefreshCw,
  ShieldCheck,
  Users,
} from "lucide-react";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Badge from "../../components/ui/Badge";
import { useLanguage } from "../../context/LanguageContext";
import api from "../../services/api";
import { extractErrorMessage } from "../../utils/formatters";

export default function AssistantAnalytics() {
  const { t } = useLanguage();

  const [stats, setStats] = useState(null);
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadAnalytics = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [analyticsRes, healthRes] = await Promise.all([
        api.get("/api/admin/analytics/assistant", { params: { days: 30 } }),
        api
          .get("/api/admin/assistant/health")
          .catch(() => ({ data: { status: "error" } })),
      ]);
      setStats(analyticsRes?.data || null);
      setHealth(healthRes?.data || { status: "error" });
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  const kpiCards = [
    {
      label: t("admin.assistant.kpi.conversations"),
      value: stats?.total_conversations ?? 0,
      icon: MessagesSquare,
      iconBg: "bg-emerald-50 text-[#166534] border-emerald-200/70",
    },
    {
      label: t("admin.assistant.kpi.messages"),
      value: stats?.total_messages ?? 0,
      icon: MessageSquare,
      iconBg: "bg-lime-50 text-[#3f6212] border-lime-200/70",
    },
    {
      label: t("admin.assistant.kpi.messagesToday"),
      value: stats?.messages_today ?? 0,
      icon: Calendar,
      iconBg: "bg-sky-50 text-sky-700 border-sky-200/70",
    },
    {
      label: t("admin.assistant.kpi.activeUsersToday"),
      value: stats?.active_users_today ?? 0,
      icon: Users,
      iconBg: "bg-amber-50 text-amber-700 border-amber-200/70",
    },
  ];

  const messagesPerDay = Array.isArray(stats?.messages_per_day)
    ? stats.messages_per_day
    : [];

  const sinhalaCount =
    stats?.sinhala_messages ?? stats?.language_counts?.si ?? 0;
  const englishCount =
    stats?.english_messages ?? stats?.language_counts?.en ?? 0;
  const languageTotal = sinhalaCount + englishCount;

  const languageDonutData = [
    {
      name: t("admin.assistant.charts.sinhala"),
      value: sinhalaCount,
      color: "#16a34a",
    },
    {
      name: t("admin.assistant.charts.english"),
      value: englishCount,
      color: "#0284c7",
    },
  ];

  const scanLinkedCount =
    stats?.scan_linked_conversations ??
    stats?.conversations_by_type?.scan_linked ??
    0;
  const generalCount =
    stats?.general_conversations ??
    stats?.conversations_by_type?.general ??
    0;

  const contextBarData = [
    {
      name: t("admin.assistant.charts.scanLinked"),
      count: scanLinkedCount,
      color: "#166534",
    },
    {
      name: t("admin.assistant.charts.general"),
      count: generalCount,
      color: "#84cc16",
    },
  ];

  const errorsByType = stats?.errors_by_type || {
    quota: 0,
    network: 0,
    config: 0,
    other: 0,
  };

  const errorRows = [
    {
      key: "quota",
      label: t("admin.assistant.errorsTable.types.quota"),
      count: errorsByType.quota ?? 0,
    },
    {
      key: "network",
      label: t("admin.assistant.errorsTable.types.network"),
      count: errorsByType.network ?? 0,
    },
    {
      key: "config",
      label: t("admin.assistant.errorsTable.types.config"),
      count: errorsByType.config ?? 0,
    },
    {
      key: "other",
      label: t("admin.assistant.errorsTable.types.other"),
      count: errorsByType.other ?? 0,
    },
  ];

  const isGeminiOnline = health?.status === "online";

  return (
    <div className="space-y-6">
      {/* ================= PAGE HEADER ================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900">
              {t("admin.assistant.pageTitle")}
            </h2>
            {health && (
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${
                  isGeminiOnline
                    ? "bg-emerald-50 text-[#166534] border-emerald-200"
                    : "bg-red-50 text-[#dc2626] border-red-200"
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    isGeminiOnline ? "bg-[#16a34a]" : "bg-[#dc2626]"
                  }`}
                />
                <span>
                  {t("admin.assistant.geminiStatusLabel")}:{" "}
                  {isGeminiOnline
                    ? t("admin.assistant.online")
                    : t("admin.assistant.error")}
                </span>
                {health.model && (
                  <span className="text-[11px] opacity-75 font-mono">
                    ({health.model})
                  </span>
                )}
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-slate-500">
            {t("admin.assistant.pageSubtitle")}
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          icon={RefreshCw}
          onClick={loadAnalytics}
          loading={loading}
          className="self-start sm:self-auto"
        >
          {t("admin.common.retry") || "Refresh"}
        </Button>
      </div>

      {/* ================= PRIVACY NOTE BANNER ================= */}
      <div className="p-3.5 sm:p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200/80 flex items-center gap-3 text-[#166534]">
        <ShieldCheck className="w-5 h-5 shrink-0" />
        <p className="text-xs sm:text-sm font-semibold">
          {t("admin.assistant.privacyNote")}
        </p>
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
            onClick={loadAnalytics}
          >
            {t("admin.common.retry")}
          </Button>
        </Card>
      )}

      {/* ================= 4 KPI CARDS ================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        {kpiCards.map((card, idx) => {
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

      {/* ================= CHARTS & ERROR TABLE GRID ================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* 1. Messages Per Day (30 Days) AreaChart */}
        <Card className="lg:col-span-7 space-y-4">
          <div className="pb-2 border-b border-slate-100">
            <h3 className="text-base font-extrabold text-slate-900">
              {t("admin.assistant.charts.messagesPerDayTitle")}
            </h3>
            <p className="text-xs text-slate-500">
              {t("admin.assistant.charts.messagesPerDaySubtitle")}
            </p>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={messagesPerDay}
                margin={{ top: 8, right: 12, left: -16, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="aiMessagesFill" x1="0" y1="0" x2="0" y2="1">
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
                  name={t("admin.assistant.charts.messagesCount")}
                  stroke="#166534"
                  strokeWidth={2.5}
                  fill="url(#aiMessagesFill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* 2. Donut: Sinhala vs English */}
        <Card className="lg:col-span-5 space-y-4">
          <div className="pb-2 border-b border-slate-100">
            <h3 className="text-base font-extrabold text-slate-900">
              {t("admin.assistant.charts.languageTitle")}
            </h3>
            <p className="text-xs text-slate-500">
              {t("admin.assistant.charts.languageSubtitle")}
            </p>
          </div>

          <div className="h-64 flex flex-col justify-between">
            <div className="h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={
                      languageTotal > 0
                        ? languageDonutData
                        : [
                            {
                              name: t("admin.assistant.charts.english"),
                              value: 1,
                              color: "#e2e8f0",
                            },
                          ]
                    }
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={68}
                    paddingAngle={languageTotal > 0 ? 4 : 0}
                  >
                    {(languageTotal > 0
                      ? languageDonutData
                      : [{ color: "#e2e8f0" }]
                    ).map((entry, idx) => (
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
                <span className="text-xs font-bold text-slate-700 truncate">
                  {t("admin.assistant.charts.sinhala")}
                </span>
                <Badge variant="success">{sinhalaCount}</Badge>
              </div>
              <div className="p-2.5 rounded-xl bg-sky-50/70 border border-sky-200/70 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 truncate">
                  {t("admin.assistant.charts.english")}
                </span>
                <Badge variant="info">{englishCount}</Badge>
              </div>
            </div>
          </div>
        </Card>

        {/* 3. Bar: Scan-linked vs General Chats */}
        <Card className="lg:col-span-6 space-y-4">
          <div className="pb-2 border-b border-slate-100">
            <h3 className="text-base font-extrabold text-slate-900">
              {t("admin.assistant.charts.contextTitle")}
            </h3>
            <p className="text-xs text-slate-500">
              {t("admin.assistant.charts.contextSubtitle")}
            </p>
          </div>

          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={contextBarData}
                margin={{ top: 8, right: 16, left: -16, bottom: 4 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#e2e8f0"
                />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 12, fill: "#334155", fontWeight: 600 }}
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
                  name={t("admin.assistant.charts.conversationsCount")}
                  radius={[8, 8, 0, 0]}
                  barSize={44}
                >
                  {contextBarData.map((entry, idx) => (
                    <Cell key={idx} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* 4. Small Table: Gemini Errors by Type */}
        <Card className="lg:col-span-6 space-y-4">
          <div className="pb-2 border-b border-slate-100 flex items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-extrabold text-slate-900">
                {t("admin.assistant.errorsTable.title")}
              </h3>
              <p className="text-xs text-slate-500">
                {t("admin.assistant.errorsTable.subtitle")}
              </p>
            </div>
            <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
              <Activity className="w-4 h-4" />
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200/80">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#f8faf5] border-b border-slate-200/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-2.5 px-4">
                    {t("admin.assistant.errorsTable.typeCol")}
                  </th>
                  <th className="py-2.5 px-4 text-right">
                    {t("admin.assistant.errorsTable.countCol")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs sm:text-sm">
                {errorRows.map((row) => (
                  <tr key={row.key} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4 font-semibold text-slate-800">
                      <span className="inline-flex items-center gap-2">
                        <Bot className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{row.label}</span>
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Badge variant={row.count > 0 ? "danger" : "neutral"}>
                        {row.count}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
