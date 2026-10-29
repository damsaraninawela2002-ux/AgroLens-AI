import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import {
  Activity,
  AlertTriangle,
  Award,
  CheckCircle2,
  Cpu,
  Download,
  RefreshCw,
  ShieldCheck,
  Target,
} from "lucide-react";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Badge from "../../components/ui/Badge";
import { useLanguage } from "../../context/LanguageContext";
import {
  exportModelFeedbackCsv,
  getAdminModelInfo,
} from "../../services/adminService";
import {
  extractErrorMessage,
  formatDiseaseKey,
  formatShortDiseaseKey,
  getCropFromDiseaseKey,
  isHealthyDiseaseKey,
} from "../../utils/formatters";

function formatMetricPercent(val) {
  const num = Number(val);
  if (!Number.isFinite(num) || num <= 0) return "—";
  const pct = num <= 1 ? num * 100 : num;
  return `${pct.toFixed(1)}%`;
}

export default function AdminModelPerformance() {
  const { lang, t } = useLanguage();

  const [modelData, setModelData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);

  const loadModelData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await getAdminModelInfo();
      setModelData(res);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    getAdminModelInfo()
      .then((res) => {
        if (active) {
          setModelData(res);
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

  const handleExportCsv = async () => {
    setExporting(true);
    try {
      await exportModelFeedbackCsv();
      toast.success(t("admin.model.toasts.exported"));
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setExporting(false);
    }
  };

  const metrics = modelData?.metrics || {};
  const accuracy =
    metrics.test_accuracy ?? metrics.accuracy ?? metrics.val_accuracy;
  const precision =
    metrics.macro_precision ??
    metrics.precision ??
    metrics.weighted_precision ??
    accuracy;
  const recall =
    metrics.macro_recall ??
    metrics.recall ??
    metrics.weighted_recall ??
    accuracy;
  const f1 =
    metrics.macro_f1 ?? metrics.f1_score ?? metrics.f1 ?? accuracy;

  const kpiCards = [
    {
      label: t("admin.model.kpi.accuracy"),
      value: formatMetricPercent(accuracy),
      icon: Target,
      iconBg: "bg-emerald-50 text-[#166534] border-emerald-200/70",
    },
    {
      label: t("admin.model.kpi.precision"),
      value: formatMetricPercent(precision),
      icon: Award,
      iconBg: "bg-lime-50 text-[#3f6212] border-lime-200/70",
    },
    {
      label: t("admin.model.kpi.recall"),
      value: formatMetricPercent(recall),
      icon: Activity,
      iconBg: "bg-sky-50 text-sky-700 border-sky-200/70",
    },
    {
      label: t("admin.model.kpi.f1"),
      value: formatMetricPercent(f1),
      icon: Cpu,
      iconBg: "bg-emerald-50 text-[#166534] border-emerald-200/70",
    },
  ];

  const correctedChartData = (modelData?.most_corrected_classes || []).map(
    (item) => ({
      name: formatShortDiseaseKey(item.predicted_class, lang),
      count: item.corrected_count,
      trueLabel: item.most_common_true_label
        ? formatDiseaseKey(item.most_common_true_label, lang)
        : "",
    })
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
            {t("admin.model.pageTitle")}
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            {t("admin.model.pageSubtitle")}
          </p>
        </div>

        <Button
          variant="primary"
          size="md"
          icon={Download}
          loading={exporting}
          onClick={handleExportCsv}
        >
          {exporting
            ? t("admin.model.exportingBtn")
            : t("admin.model.exportCsvBtn")}
        </Button>
      </div>

      {/* Error State */}
      {error && (
        <Card className="border-red-200 bg-red-50/60 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-[#dc2626]">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <p className="text-sm font-bold">{error}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            icon={RefreshCw}
            onClick={loadModelData}
          >
            {t("admin.common.retry")}
          </Button>
        </Card>
      )}

      {/* 4 Evaluation Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <Card key={idx} padding="p-5">
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
                <div className="mt-3 h-8 w-20 bg-slate-200 rounded animate-pulse" />
              ) : (
                <p className="mt-3 text-2xl sm:text-3xl font-extrabold text-slate-900">
                  {card.value}
                </p>
              )}
            </Card>
          );
        })}
      </div>

      {/* Officer Agreement Rate + Most Corrected Classes Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <Card className="lg:col-span-5 space-y-5 flex flex-col justify-between">
          <div className="space-y-1 pb-3 border-b border-slate-100">
            <h3 className="text-base font-extrabold text-slate-900">
              {t("admin.model.agreement.title")}
            </h3>
            <p className="text-xs text-slate-500">
              {t("admin.model.agreement.subtitle")}
            </p>
          </div>

          <div className="py-4 text-center space-y-2">
            <div className="inline-flex items-center justify-center w-28 h-28 rounded-full bg-emerald-50 border-4 border-[#166534] text-[#166534]">
              <span className="text-2xl font-extrabold">
                {modelData?.officer_agreement_rate != null
                  ? `${modelData.officer_agreement_rate}%`
                  : "100%"}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              {t("admin.model.agreement.totalReviewed")}:{" "}
              <span className="font-extrabold text-slate-800">
                {modelData?.total_reviewed ?? 0}
              </span>
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-2xl bg-emerald-50/70 border border-emerald-200/70">
              <span className="text-[11px] font-bold text-slate-500 block">
                {t("admin.model.agreement.confirmed")}
              </span>
              <span className="text-xl font-extrabold text-[#166534]">
                {modelData?.confirmed_count ?? 0}
              </span>
            </div>
            <div className="p-3 rounded-2xl bg-sky-50/70 border border-sky-200/70">
              <span className="text-[11px] font-bold text-slate-500 block">
                {t("admin.model.agreement.corrected")}
              </span>
              <span className="text-xl font-extrabold text-sky-700">
                {modelData?.corrected_count ?? 0}
              </span>
            </div>
          </div>
        </Card>

        <Card className="lg:col-span-7 space-y-4">
          <div className="pb-3 border-b border-slate-100">
            <h3 className="text-base font-extrabold text-slate-900">
              {t("admin.model.correctedChart.title")}
            </h3>
            <p className="text-xs text-slate-500">
              {t("admin.model.correctedChart.subtitle")}
            </p>
          </div>

          {correctedChartData.length === 0 ? (
            <div className="h-56 flex flex-col items-center justify-center text-center gap-2 text-slate-500">
              <CheckCircle2 className="w-8 h-8 text-[#166534]" />
              <p className="text-xs sm:text-sm font-medium">
                {t("admin.model.correctedChart.empty")}
              </p>
            </div>
          ) : (
            <div className="h-60 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={correctedChartData}
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
                    width={130}
                    tick={{ fontSize: 11, fill: "#334155", fontWeight: 600 }}
                  />
                  <Tooltip
                    formatter={(value, _name, props) => {
                      const trueLbl = props?.payload?.trueLabel;
                      const suffix = trueLbl
                        ? ` (${t("admin.model.correctedChart.mostCommonTrue")}: ${trueLbl})`
                        : "";
                      return [`${value}${suffix}`, t("admin.model.agreement.corrected")];
                    }}
                    contentStyle={{
                      borderRadius: "12px",
                      border: "1px solid #e2e8f0",
                      fontSize: "12px",
                    }}
                  />
                  <Bar
                    dataKey="count"
                    fill="#0284c7"
                    radius={[0, 8, 8, 0]}
                    barSize={22}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </div>

      {/* Supported 15 Disease Classes List */}
      <Card className="space-y-4">
        <div className="pb-3 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-base font-extrabold text-slate-900">
              {t("admin.model.classes.title")}
            </h3>
            <p className="text-xs text-slate-500">
              {t("admin.model.classes.subtitle")}
            </p>
          </div>
          <Badge variant="success" icon={ShieldCheck}>
            {modelData?.num_classes ?? 15} Classes
          </Badge>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {(modelData?.class_names || []).map((cls, idx) => {
            const healthy = isHealthyDiseaseKey(cls);
            const crop = getCropFromDiseaseKey(cls, lang);
            return (
              <div
                key={cls}
                className="p-3.5 rounded-2xl bg-[#f8faf5] border border-slate-200/80 flex items-start justify-between gap-2"
              >
                <div className="min-w-0 space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-mono font-bold text-slate-400">
                      #{String(idx + 1).padStart(2, "0")}
                    </span>
                    <Badge variant={healthy ? "success" : "neutral"}>
                      {crop}
                    </Badge>
                  </div>
                  <p className="text-xs font-extrabold text-slate-900 truncate pt-1">
                    {formatDiseaseKey(cls, lang)}
                  </p>
                  <p className="text-[10px] font-mono text-slate-400 truncate">
                    {cls}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
