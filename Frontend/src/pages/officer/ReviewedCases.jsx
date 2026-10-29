import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Badge from "../../components/ui/Badge";
import { useAuth } from "../../context/AuthContext";
import { useLanguage } from "../../context/LanguageContext";
import { getReviewedDiagnoses } from "../../services/officerService";
import {
  extractErrorMessage,
  formatDateTime,
  formatDiseaseKey,
  getImageUrl,
} from "../../utils/formatters";
import OfficerWaitingApprovalCard from "../../components/officer/OfficerWaitingApprovalCard";

export default function ReviewedCases() {
  const { user } = useAuth();
  const { lang, t } = useLanguage();

  const isUnapprovedOfficer =
    user?.role === "officer" && user?.is_approved === false;

  const [page, setPage] = useState(1);
  const limit = 15;
  const [data, setData] = useState({
    items: [],
    total: 0,
    page: 1,
    pages: 1,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadReviewed = useCallback(async () => {
    if (isUnapprovedOfficer) return;
    setLoading(true);
    setError("");
    try {
      const res = await getReviewedDiagnoses({ page, limit });
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
  }, [page, isUnapprovedOfficer]);

  useEffect(() => {
    if (isUnapprovedOfficer) return;
    let active = true;
    getReviewedDiagnoses({ page, limit })
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
  }, [page, isUnapprovedOfficer]);

  if (isUnapprovedOfficer) {
    return <OfficerWaitingApprovalCard />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
            {t("officer.reviewed.pageTitle")}
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            {t("officer.reviewed.pageSubtitle")}
          </p>
        </div>

        <Link to="/officer/queue">
          <Button variant="primary" size="sm" icon={ClipboardList}>
            {t("officer.reviewed.goToQueueBtn")}
          </Button>
        </Link>
      </div>

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
            onClick={loadReviewed}
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
      {!loading && !error && data.items.length === 0 && (
        <Card className="py-16 px-6 text-center max-w-lg mx-auto space-y-4">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-50 text-[#166534] flex items-center justify-center">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-extrabold text-slate-900">
              {t("officer.reviewed.emptyTitle")}
            </h3>
            <p className="text-xs sm:text-sm text-slate-600">
              {t("officer.reviewed.emptySubtitle")}
            </p>
          </div>
          <div>
            <Link to="/officer/queue">
              <Button variant="primary" icon={ClipboardList}>
                {t("officer.reviewed.goToQueueBtn")}
              </Button>
            </Link>
          </div>
        </Card>
      )}

      {/* Desktop Table & Mobile Cards */}
      {!loading && data.items.length > 0 && (
        <>
          {/* Desktop Table (md and up) */}
          <Card padding="p-0" className="hidden md:block overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200/80 bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    <th className="py-3.5 px-5">
                      {t("officer.reviewed.table.leaf")}
                    </th>
                    <th className="py-3.5 px-5">
                      {t("officer.reviewed.table.farmer")}
                    </th>
                    <th className="py-3.5 px-5">
                      {t("officer.reviewed.table.action")}
                    </th>
                    <th className="py-3.5 px-5">
                      {t("officer.reviewed.table.labels")}
                    </th>
                    <th className="py-3.5 px-5">
                      {t("officer.reviewed.table.date")}
                    </th>
                    <th className="py-3.5 px-5 text-right">
                      {t("officer.reviewed.table.view")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {data.items.map((scan) => {
                    const isCorrected = scan.status === "corrected";
                    const finalLabel =
                      scan.officer_label || scan.predicted_class;

                    return (
                      <tr
                        key={scan.id}
                        className="hover:bg-emerald-50/30 transition-colors"
                      >
                        <td className="py-3.5 px-5">
                          <img
                            src={getImageUrl(scan.image_url)}
                            alt={formatDiseaseKey(finalLabel, lang)}
                            className="w-12 h-12 rounded-xl object-cover border border-slate-200 bg-slate-100"
                          />
                        </td>
                        <td className="py-3.5 px-5">
                          <p className="font-bold text-slate-900">
                            {scan.farmer_name}
                          </p>
                          <p className="text-xs text-slate-500">
                            {scan.district}
                          </p>
                        </td>
                        <td className="py-3.5 px-5">
                          <Badge
                            variant={isCorrected ? "info" : "success"}
                            icon={isCorrected ? ShieldCheck : CheckCircle2}
                          >
                            {isCorrected
                              ? t("officer.reviewed.correctedBadge")
                              : t("officer.reviewed.confirmedBadge")}
                          </Badge>
                        </td>
                        <td className="py-3.5 px-5">
                          {isCorrected ? (
                            <div className="space-y-0.5">
                              <p className="text-xs line-through text-slate-400">
                                {formatDiseaseKey(scan.predicted_class, lang)}
                              </p>
                              <p className="font-bold text-sky-900">
                                {formatDiseaseKey(finalLabel, lang)}
                              </p>
                            </div>
                          ) : (
                            <p className="font-bold text-slate-900">
                              {formatDiseaseKey(finalLabel, lang)}
                            </p>
                          )}
                          {scan.officer_notes && (
                            <p className="text-xs text-slate-500 truncate max-w-xs mt-0.5">
                              {scan.officer_notes}
                            </p>
                          )}
                        </td>
                        <td className="py-3.5 px-5 text-xs text-slate-500">
                          {formatDateTime(
                            scan.reviewed_at || scan.created_at,
                            lang
                          )}
                        </td>
                        <td className="py-3.5 px-5 text-right">
                          <Link
                            to={`/officer/review/${scan.id}`}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-[#166534] bg-emerald-50 hover:bg-emerald-100 transition-colors"
                          >
                            <span>{t("officer.reviewed.table.view")}</span>
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
            {data.items.map((scan) => {
              const isCorrected = scan.status === "corrected";
              const finalLabel = scan.officer_label || scan.predicted_class;

              return (
                <Link key={scan.id} to={`/officer/review/${scan.id}`}>
                  <Card
                    padding="p-4"
                    className="flex items-center justify-between gap-3.5"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <img
                        src={getImageUrl(scan.image_url)}
                        alt={formatDiseaseKey(finalLabel, lang)}
                        className="w-16 h-16 rounded-xl object-cover border border-slate-200 shrink-0 bg-slate-100"
                      />
                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={isCorrected ? "info" : "success"}
                            icon={isCorrected ? ShieldCheck : CheckCircle2}
                          >
                            {isCorrected
                              ? t("officer.reviewed.correctedBadge")
                              : t("officer.reviewed.confirmedBadge")}
                          </Badge>
                        </div>

                        {isCorrected && (
                          <p className="text-[11px] line-through text-slate-400 truncate">
                            {formatDiseaseKey(scan.predicted_class, lang)}
                          </p>
                        )}

                        <p className="text-sm font-bold text-slate-900 truncate">
                          {formatDiseaseKey(finalLabel, lang)}
                        </p>

                        <p className="text-xs text-slate-500 truncate">
                          {scan.farmer_name} • {scan.district}
                        </p>
                      </div>
                    </div>

                    <ArrowRight className="w-5 h-5 text-slate-400 shrink-0" />
                  </Card>
                </Link>
              );
            })}
          </div>

          {/* Pagination */}
          {data.pages > 1 && (
            <div className="flex items-center justify-between gap-4 pt-2">
              <Button
                variant="outline"
                size="sm"
                icon={ArrowLeft}
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                {t("officer.queue.prevPage")}
              </Button>

              <span className="text-xs font-bold text-slate-600">
                {t("officer.queue.pageInfo")} {data.page} / {data.pages}
              </span>

              <Button
                variant="outline"
                size="sm"
                icon={ArrowRight}
                iconPosition="right"
                disabled={page >= data.pages}
                onClick={() => setPage((p) => Math.min(data.pages, p + 1))}
              >
                {t("officer.queue.nextPage")}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
