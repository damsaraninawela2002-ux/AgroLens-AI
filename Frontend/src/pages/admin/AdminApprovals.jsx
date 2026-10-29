import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Mail,
  MapPin,
  RefreshCw,
  UserCheck,
  XCircle,
} from "lucide-react";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Badge from "../../components/ui/Badge";
import ConfirmDialog from "../../components/admin/ConfirmDialog";
import { useLanguage } from "../../context/LanguageContext";
import {
  approveOfficerUser,
  getAdminUsers,
  notifyAdminCountsUpdated,
  rejectOfficerUser,
} from "../../services/adminService";
import { extractErrorMessage, formatDate } from "../../utils/formatters";

export default function AdminApprovals() {
  const { lang, t } = useLanguage();

  const [officers, setOfficers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [confirmState, setConfirmState] = useState({
    open: false,
    action: "approve",
    officer: null,
  });
  const [submittingId, setSubmittingId] = useState(null);

  const loadPendingOfficers = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getAdminUsers({
        role: "officer",
        is_approved: false,
        is_active: true,
        sort: "oldest",
        page: 1,
        limit: 100,
      });
      setOfficers(Array.isArray(data?.items) ? data.items : []);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    getAdminUsers({
      role: "officer",
      is_approved: false,
      is_active: true,
      sort: "oldest",
      page: 1,
      limit: 100,
    })
      .then((data) => {
        if (active) {
          setOfficers(Array.isArray(data?.items) ? data.items : []);
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

  const handleConfirmAction = async () => {
    const target = confirmState.officer;
    if (!target) return;
    setSubmittingId(target.id);
    try {
      if (confirmState.action === "approve") {
        await approveOfficerUser(target.id);
        toast.success(t("admin.approvals.toasts.approved"));
        setOfficers((prev) => prev.filter((o) => o.id !== target.id));
      } else {
        await rejectOfficerUser(target.id);
        toast.success(t("admin.approvals.toasts.rejected"));
        setOfficers((prev) => prev.filter((o) => o.id !== target.id));
      }
      notifyAdminCountsUpdated();
      setConfirmState({ open: false, action: "approve", officer: null });
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setSubmittingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
              {t("admin.approvals.pageTitle")}
            </h2>
            <Badge variant="warning">
              {officers.length} {t("admin.approvals.pendingCountBadge")}
            </Badge>
          </div>
          <p className="text-sm text-slate-600 mt-1">
            {t("admin.approvals.pageSubtitle")}
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          icon={RefreshCw}
          onClick={loadPendingOfficers}
        >
          {t("admin.common.retry")}
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
            onClick={loadPendingOfficers}
          >
            {t("admin.common.retry")}
          </Button>
        </Card>
      )}

      {/* Loading Skeletons */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((n) => (
            <Card key={n} className="space-y-4 animate-pulse">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-slate-200" />
                <div className="space-y-2 flex-1">
                  <div className="h-4 w-3/4 bg-slate-200 rounded" />
                  <div className="h-3 w-1/2 bg-slate-100 rounded" />
                </div>
              </div>
              <div className="h-10 w-full bg-slate-100 rounded-xl" />
            </Card>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && officers.length === 0 && (
        <Card className="py-14 px-6 text-center max-w-xl mx-auto space-y-3">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-50 border border-emerald-200 text-[#166534] flex items-center justify-center">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-extrabold text-slate-900">
            {t("admin.approvals.emptyTitle")}
          </h3>
          <p className="text-xs sm:text-sm text-slate-500">
            {t("admin.approvals.emptySubtitle")}
          </p>
        </Card>
      )}

      {/* Officer Approval Cards */}
      {!loading && officers.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {officers.map((officer) => (
            <Card
              key={officer.id}
              className="flex flex-col justify-between gap-5 hover:border-[#166534]/40 transition-all"
            >
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-[#166534] flex items-center justify-center font-extrabold text-lg shrink-0">
                      {officer.full_name?.charAt(0)?.toUpperCase() || "O"}
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-base font-extrabold text-slate-900 truncate">
                        {officer.full_name}
                      </h3>
                      <p className="text-xs text-slate-500 flex items-center gap-1 truncate mt-0.5">
                        <Mail className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{officer.email}</span>
                      </p>
                    </div>
                  </div>
                  <Badge variant="warning" icon={UserCheck}>
                    {t("admin.approvals.pendingCountBadge")}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-2.5 p-3 rounded-2xl bg-[#f8faf5] border border-slate-200/70 text-xs">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-[#166534]" />
                      {t("admin.approvals.districtLabel")}
                    </span>
                    <p className="font-bold text-slate-800 mt-0.5 truncate">
                      {officer.district}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-[#166534]" />
                      {t("admin.approvals.registeredLabel")}
                    </span>
                    <p className="font-bold text-slate-800 mt-0.5 truncate">
                      {formatDate(officer.created_at, lang)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2.5 pt-2 border-t border-slate-100">
                <Button
                  variant="primary"
                  size="sm"
                  fullWidth
                  icon={CheckCircle2}
                  disabled={submittingId === officer.id}
                  onClick={() =>
                    setConfirmState({
                      open: true,
                      action: "approve",
                      officer,
                    })
                  }
                >
                  {t("admin.approvals.approveBtn")}
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  icon={XCircle}
                  disabled={submittingId === officer.id}
                  onClick={() =>
                    setConfirmState({
                      open: true,
                      action: "reject",
                      officer,
                    })
                  }
                >
                  {t("admin.approvals.rejectBtn")}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Confirmation Dialog */}
      <ConfirmDialog
        open={confirmState.open}
        onClose={() =>
          setConfirmState({ open: false, action: "approve", officer: null })
        }
        onConfirm={handleConfirmAction}
        loading={Boolean(submittingId)}
        variant={confirmState.action === "approve" ? "primary" : "danger"}
        title={
          confirmState.action === "approve"
            ? t("admin.approvals.confirmApproveTitle")
            : t("admin.approvals.confirmRejectTitle")
        }
        description={`${
          confirmState.action === "approve"
            ? t("admin.approvals.confirmApproveDesc")
            : t("admin.approvals.confirmRejectDesc")
        } (${confirmState.officer?.full_name || ""} — ${
          confirmState.officer?.district || ""
        })`}
        confirmLabel={
          confirmState.action === "approve"
            ? t("admin.approvals.approveBtn")
            : t("admin.approvals.rejectBtn")
        }
        cancelLabel={t("admin.common.cancel")}
      />
    </div>
  );
}
