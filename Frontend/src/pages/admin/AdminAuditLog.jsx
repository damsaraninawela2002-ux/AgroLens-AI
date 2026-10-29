import { useCallback, useEffect, useState } from "react";
import { Activity, AlertTriangle, RefreshCw, Shield } from "lucide-react";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Badge from "../../components/ui/Badge";
import DataTable from "../../components/admin/DataTable";
import FilterBar from "../../components/admin/FilterBar";
import { useLanguage } from "../../context/LanguageContext";
import { getAdminAuditLogs } from "../../services/adminService";
import { extractErrorMessage, formatDateTime } from "../../utils/formatters";

const ACTION_OPTIONS = [
  "user.create",
  "user.update",
  "user.approve",
  "user.reject",
  "user.reset_password",
  "user.delete",
  "treatment.create",
  "treatment.update",
  "treatment.verify",
  "treatment.delete",
  "diagnosis.delete",
];

function getActionBadgeVariant(action) {
  if (!action) return "neutral";
  if (action.endsWith(".delete") || action.endsWith(".reject")) return "danger";
  if (
    action.endsWith(".create") ||
    action.endsWith(".approve") ||
    action.endsWith(".verify")
  ) {
    return "success";
  }
  return "info";
}

export default function AdminAuditLog() {
  const { lang, t } = useLanguage();

  const [actionFilter, setActionFilter] = useState("");
  const [targetFilter, setTargetFilter] = useState("");
  const [page, setPage] = useState(1);
  const limit = 20;

  const [data, setData] = useState({
    items: [],
    total: 0,
    page: 1,
    pages: 1,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const buildParams = useCallback(() => {
    const params = { page, limit };
    if (actionFilter) params.action = actionFilter;
    if (targetFilter) params.target_type = targetFilter;
    return params;
  }, [page, limit, actionFilter, targetFilter]);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await getAdminAuditLogs(buildParams());
      setData({
        items: Array.isArray(res?.items) ? res.items : [],
        total: Number(res?.total) || 0,
        page: Number(res?.page) || 1,
        pages: Number(res?.pages) || 1,
      });
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [buildParams]);

  useEffect(() => {
    let active = true;
    getAdminAuditLogs(buildParams())
      .then((res) => {
        if (active) {
          setData({
            items: Array.isArray(res?.items) ? res.items : [],
            total: Number(res?.total) || 0,
            page: Number(res?.page) || 1,
            pages: Number(res?.pages) || 1,
          });
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
  }, [buildParams]);

  const columns = [
    {
      key: "created_at",
      header: t("admin.auditLog.table.timestamp"),
      sortable: true,
      render: (log) => (
        <span className="text-xs font-medium text-slate-600 whitespace-nowrap">
          {formatDateTime(log.created_at, lang)}
        </span>
      ),
    },
    {
      key: "admin_name",
      header: t("admin.auditLog.table.admin"),
      render: (log) => (
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-emerald-100 text-[#166534] flex items-center justify-center font-extrabold text-xs shrink-0">
            <Shield className="w-3.5 h-3.5" />
          </div>
          <span className="text-xs font-bold text-slate-900">
            {log.admin_name}
          </span>
        </div>
      ),
    },
    {
      key: "action",
      header: t("admin.auditLog.table.action"),
      render: (log) => (
        <Badge variant={getActionBadgeVariant(log.action)}>
          <span className="font-mono">{log.action}</span>
        </Badge>
      ),
    },
    {
      key: "target_type",
      header: t("admin.auditLog.table.target"),
      render: (log) => (
        <div className="text-xs">
          <span className="font-bold uppercase text-slate-700">
            {log.target_type}
          </span>
          <span className="block font-mono text-[11px] text-slate-400 truncate max-w-[140px]">
            {log.target_id}
          </span>
        </div>
      ),
    },
    {
      key: "ip_address",
      header: t("admin.auditLog.table.ipAddress") || "IP Address",
      render: (log) => (
        <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200/60">
          {log.ip_address || "127.0.0.1"}
        </span>
      ),
    },
    {
      key: "details",
      header: t("admin.auditLog.table.details"),
      render: (log) => {
        const entries = Object.entries(log.details || {});
        if (entries.length === 0) {
          return <span className="text-xs text-slate-400">—</span>;
        }
        return (
          <div className="flex flex-wrap gap-1.5 max-w-md">
            {entries.map(([k, v]) => (
              <span
                key={k}
                className="px-2 py-0.5 rounded-lg bg-slate-100 border border-slate-200/80 text-[11px] font-mono text-slate-700"
              >
                <strong className="text-slate-900">{k}:</strong>{" "}
                {Array.isArray(v) ? v.join(", ") : String(v)}
              </span>
            ))}
          </div>
        );
      },
    },
  ];

  const hasActiveFilters = Boolean(actionFilter || targetFilter);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
            {t("admin.auditLog.pageTitle")}
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            {t("admin.auditLog.pageSubtitle")}
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          icon={RefreshCw}
          onClick={loadLogs}
        >
          {t("admin.common.retry")}
        </Button>
      </div>

      {/* FilterBar */}
      <FilterBar
        hasActiveFilters={hasActiveFilters}
        onReset={() => {
          setActionFilter("");
          setTargetFilter("");
          setPage(1);
        }}
        resetLabel={t("admin.common.resetFilters")}
      >
        <select
          value={actionFilter}
          onChange={(e) => {
            setActionFilter(e.target.value);
            setPage(1);
          }}
          className="px-3.5 py-2.5 rounded-xl bg-[#f8faf5] border border-slate-200 text-xs font-bold text-slate-700 focus:outline-none focus:border-[#166534]"
        >
          <option value="">{t("admin.auditLog.allActions")}</option>
          {ACTION_OPTIONS.map((act) => (
            <option key={act} value={act}>
              {act}
            </option>
          ))}
        </select>

        <select
          value={targetFilter}
          onChange={(e) => {
            setTargetFilter(e.target.value);
            setPage(1);
          }}
          className="px-3.5 py-2.5 rounded-xl bg-[#f8faf5] border border-slate-200 text-xs font-bold text-slate-700 focus:outline-none focus:border-[#166534]"
        >
          <option value="">{t("admin.auditLog.allTargets")}</option>
          <option value="user">user</option>
          <option value="treatment">treatment</option>
          <option value="diagnosis">diagnosis</option>
        </select>
      </FilterBar>

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
            onClick={loadLogs}
          >
            {t("admin.common.retry")}
          </Button>
        </Card>
      )}

      {/* Audit Log DataTable */}
      <DataTable
        columns={columns}
        data={data.items}
        loading={loading}
        emptyIcon={Activity}
        emptyTitle={t("admin.auditLog.emptyTitle")}
        emptySubtitle={t("admin.auditLog.emptySubtitle")}
        page={data.page}
        pages={data.pages}
        total={data.total}
        onPageChange={setPage}
        pageLabel={t("admin.common.page")}
        prevLabel={t("admin.common.prev")}
        nextLabel={t("admin.common.next")}
        totalLabel={t("admin.common.total")}
      />
    </div>
  );
}
