import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import {
  AlertTriangle,
  Eye,
  RefreshCw,
  Trash2,
} from "lucide-react";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import DataTable from "../../components/admin/DataTable";
import SearchInput from "../../components/admin/SearchInput";
import FilterBar from "../../components/admin/FilterBar";
import StatusBadge from "../../components/admin/StatusBadge";
import Drawer from "../../components/admin/Drawer";
import ConfirmDialog from "../../components/admin/ConfirmDialog";
import ImageCompareViewer from "../../components/scan/ImageCompareViewer";
import { useLanguage } from "../../context/LanguageContext";
import {
  deleteAdminDiagnosis,
  getAdminDiagnoses,
  getAdminDiagnosisById,
} from "../../services/adminService";
import {
  SRI_LANKAN_DISTRICTS,
  extractErrorMessage,
  formatConfidence,
  formatDate,
  formatDateTime,
  formatDiseaseKey,
  getConfidenceTone,
  getImageUrl,
} from "../../utils/formatters";

export default function AdminDiagnoses() {
  const { lang, t } = useLanguage();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [districtFilter, setDistrictFilter] = useState("");
  const [cropFilter, setCropFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
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

  // Details Drawer State
  const [detailDrawer, setDetailDrawer] = useState({
    open: false,
    loading: false,
    diagnosis: null,
  });

  // Delete ConfirmDialog State
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const buildParams = useCallback(() => {
    const params = { page, limit };
    if (search.trim()) params.search = search.trim();
    if (statusFilter) params.status = statusFilter;
    if (districtFilter) params.district = districtFilter;
    if (cropFilter) params.crop = cropFilter;
    if (dateFrom) params.date_from = `${dateFrom}T00:00:00Z`;
    if (dateTo) params.date_to = `${dateTo}T23:59:59Z`;
    return params;
  }, [
    page,
    limit,
    search,
    statusFilter,
    districtFilter,
    cropFilter,
    dateFrom,
    dateTo,
  ]);

  const loadDiagnoses = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await getAdminDiagnoses(buildParams());
      const rawItems = res?.items ?? res?.diagnoses ?? res?.data ?? [];
      setData({
        items: Array.isArray(rawItems) ? rawItems : [],
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
    getAdminDiagnoses(buildParams())
      .then((res) => {
        if (active) {
          const rawItems = res?.items ?? res?.diagnoses ?? res?.data ?? [];
          setData({
            items: Array.isArray(rawItems) ? rawItems : [],
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

  const handleOpenDrawer = async (row) => {
    setDetailDrawer({ open: true, loading: true, diagnosis: row });
    try {
      const res = await getAdminDiagnosisById(row.id);
      if (res?.diagnosis) {
        setDetailDrawer({
          open: true,
          loading: false,
          diagnosis: res.diagnosis,
        });
      } else {
        setDetailDrawer((prev) => ({ ...prev, loading: false }));
      }
    } catch (err) {
      toast.error(extractErrorMessage(err));
      setDetailDrawer((prev) => ({ ...prev, loading: false }));
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteAdminDiagnosis(deleteTarget.id);
      toast.success(t("admin.diagnoses.toasts.deleted"));
      setDeleteTarget(null);
      if (detailDrawer.diagnosis?.id === deleteTarget.id) {
        setDetailDrawer({ open: false, loading: false, diagnosis: null });
      }
      loadDiagnoses();
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setDeleting(false);
    }
  };

  const hasActiveFilters = Boolean(
    search ||
      statusFilter ||
      districtFilter ||
      cropFilter ||
      dateFrom ||
      dateTo
  );

  const columns = [
    {
      key: "image_url",
      header: t("admin.diagnoses.table.leaf"),
      render: (d) => (
        <img
          src={getImageUrl(d.image_url)}
          alt={formatDiseaseKey(d.predicted_class, lang)}
          className="w-12 h-12 rounded-xl object-cover border border-slate-200 bg-slate-100"
        />
      ),
    },
    {
      key: "farmer_name",
      header: t("admin.diagnoses.table.farmer"),
      sortable: true,
      render: (d) => (
        <div className="min-w-[130px]">
          <p className="text-xs font-bold text-slate-900 truncate">
            {d.farmer_name}
          </p>
          {d.farmer_email && (
            <p className="text-[11px] text-slate-400 truncate">
              {d.farmer_email}
            </p>
          )}
        </div>
      ),
    },
    {
      key: "district",
      header: t("admin.diagnoses.table.district"),
      sortable: true,
      render: (d) => (
        <span className="text-xs font-semibold text-slate-700">
          {d.district}
        </span>
      ),
    },
    {
      key: "predicted_class",
      header: t("admin.diagnoses.table.aiPrediction"),
      sortable: true,
      render: (d) => {
        const isCorrected =
          d.status === "corrected" &&
          d.officer_label &&
          d.officer_label !== d.predicted_class;
        return (
          <span
            className={`text-xs font-bold ${
              isCorrected ? "text-slate-400 line-through" : "text-slate-900"
            }`}
          >
            {formatDiseaseKey(d.predicted_class, lang)}
          </span>
        );
      },
    },
    {
      key: "confidence",
      header: t("admin.diagnoses.table.confidence"),
      sortable: true,
      render: (d) => {
        const tone = getConfidenceTone(d.confidence);
        return (
          <span className={`text-xs font-extrabold ${tone.textClass}`}>
            {formatConfidence(d.confidence, 1)}
          </span>
        );
      },
    },
    {
      key: "officer_label",
      header: t("admin.diagnoses.table.finalLabel"),
      render: (d) => {
        const effective = d.officer_label || d.predicted_class;
        return (
          <span className="text-xs font-bold text-[#166534]">
            {formatDiseaseKey(effective, lang)}
          </span>
        );
      },
    },
    {
      key: "status",
      header: t("admin.diagnoses.table.status"),
      sortable: true,
      render: (d) => (
        <StatusBadge
          type="status"
          value={d.status}
          label={t(`status.${d.status}`, d.status)}
        />
      ),
    },
    {
      key: "created_at",
      header: t("admin.diagnoses.table.date"),
      sortable: true,
      render: (d) => (
        <span className="text-xs text-slate-500">
          {formatDate(d.created_at, lang)}
        </span>
      ),
    },
    {
      key: "actions",
      header: t("admin.diagnoses.table.actions"),
      align: "right",
      render: (d) => (
        <div className="inline-flex items-center justify-end gap-1">
          <button
            type="button"
            onClick={() => handleOpenDrawer(d)}
            title={t("admin.common.view")}
            className="p-2 rounded-xl text-slate-500 hover:text-[#166534] hover:bg-emerald-50 transition-colors cursor-pointer"
          >
            <Eye className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setDeleteTarget(d)}
            title={t("admin.common.delete")}
            className="p-2 rounded-xl text-slate-500 hover:text-[#dc2626] hover:bg-red-50 transition-colors cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  const diag = detailDrawer.diagnosis;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
          {t("admin.diagnoses.pageTitle")}
        </h2>
        <p className="text-sm text-slate-600 mt-1">
          {t("admin.diagnoses.pageSubtitle")}
        </p>
      </div>

      {/* Filters */}
      <FilterBar
        hasActiveFilters={hasActiveFilters}
        onReset={() => {
          setSearch("");
          setStatusFilter("");
          setDistrictFilter("");
          setCropFilter("");
          setDateFrom("");
          setDateTo("");
          setPage(1);
        }}
        resetLabel={t("admin.common.resetFilters")}
      >
        <SearchInput
          value={search}
          onChange={(val) => {
            setSearch(val);
            setPage(1);
          }}
          placeholder={t("admin.diagnoses.searchPlaceholder")}
        />

        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2.5 rounded-xl bg-[#f8faf5] border border-slate-200 text-xs font-bold text-slate-700 focus:outline-none focus:border-[#166534]"
        >
          <option value="">{t("admin.common.allStatuses")}</option>
          <option value="auto">{t("status.auto")}</option>
          <option value="pending_review">{t("status.pending_review")}</option>
          <option value="confirmed">{t("status.confirmed")}</option>
          <option value="corrected">{t("status.corrected")}</option>
        </select>

        <select
          value={districtFilter}
          onChange={(e) => {
            setDistrictFilter(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2.5 rounded-xl bg-[#f8faf5] border border-slate-200 text-xs font-bold text-slate-700 focus:outline-none focus:border-[#166534]"
        >
          <option value="">{t("admin.common.allDistricts")}</option>
          {SRI_LANKAN_DISTRICTS.map((d) => {
            const val = typeof d === "string" ? d : d.value;
            const label =
              typeof d === "string"
                ? d
                : lang === "si"
                ? d.labelSi || d.labelEn
                : d.labelEn || d.value;
            return (
              <option key={val} value={val}>
                {label}
              </option>
            );
          })}
        </select>

        <select
          value={cropFilter}
          onChange={(e) => {
            setCropFilter(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2.5 rounded-xl bg-[#f8faf5] border border-slate-200 text-xs font-bold text-slate-700 focus:outline-none focus:border-[#166534]"
        >
          <option value="">{t("admin.common.allCrops")}</option>
          <option value="Tomato">Tomato</option>
          <option value="Potato">Potato</option>
          <option value="Pepper">Bell Pepper</option>
        </select>

        <div className="flex items-center gap-2">
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value);
              setPage(1);
            }}
            aria-label={t("admin.diagnoses.dateFrom")}
            className="px-3 py-2 rounded-xl bg-[#f8faf5] border border-slate-200 text-xs font-semibold text-slate-700"
          />
          <span className="text-xs text-slate-400">–</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value);
              setPage(1);
            }}
            aria-label={t("admin.diagnoses.dateTo")}
            className="px-3 py-2 rounded-xl bg-[#f8faf5] border border-slate-200 text-xs font-semibold text-slate-700"
          />
        </div>
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
            onClick={loadDiagnoses}
          >
            {t("admin.common.retry")}
          </Button>
        </Card>
      )}

      {/* Diagnoses DataTable */}
      <DataTable
        columns={columns}
        data={data?.items ?? []}
        loading={loading}
        page={data?.page ?? 1}
        pages={data?.pages ?? 1}
        total={data?.total ?? 0}
        onPageChange={setPage}
        pageLabel={t("admin.common.page")}
        prevLabel={t("admin.common.prev")}
        nextLabel={t("admin.common.next")}
        totalLabel={t("admin.common.total")}
      />

      {/* ================= DIAGNOSIS DETAILS DRAWER ================= */}
      <Drawer
        open={detailDrawer.open}
        onClose={() =>
          setDetailDrawer({ open: false, loading: false, diagnosis: null })
        }
        title={t("admin.diagnoses.drawer.title")}
        subtitle={
          diag
            ? `${diag.farmer_name} • ${diag.district} • ${formatDateTime(
                diag.created_at,
                lang
              )}`
            : ""
        }
        widthClass="max-w-2xl"
        footer={
          diag && (
            <div className="w-full flex items-center justify-between">
              <Button
                variant="danger"
                size="sm"
                icon={Trash2}
                onClick={() => setDeleteTarget(diag)}
              >
                {t("admin.diagnoses.drawer.deleteBtn")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setDetailDrawer({
                    open: false,
                    loading: false,
                    diagnosis: null,
                  })
                }
              >
                {t("admin.common.close")}
              </Button>
            </div>
          )
        }
      >
        {diag && (
          <div className="space-y-5">
            <ImageCompareViewer
              imageUrl={diag.image_url}
              heatmapUrl={diag.heatmap_url}
            />

            {/* Farmer & Submission Metadata */}
            <div className="p-4 rounded-2xl bg-[#f8faf5] border border-slate-200/80 space-y-2 text-xs">
              <p className="font-extrabold text-slate-800 uppercase tracking-wider text-[11px]">
                {t("admin.diagnoses.drawer.farmerInfo")}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-slate-700">
                <div>
                  <span className="font-bold text-slate-500 block">
                    {t("admin.diagnoses.table.farmer")}
                  </span>
                  <span className="font-extrabold text-slate-900">
                    {diag.farmer_name}
                  </span>
                  {diag.farmer_email && (
                    <span className="block text-[11px] text-slate-500 truncate">
                      {diag.farmer_email}
                    </span>
                  )}
                </div>
                <div>
                  <span className="font-bold text-slate-500 block">
                    {t("admin.diagnoses.table.district")}
                  </span>
                  <span className="font-bold text-slate-900">
                    {diag.district}
                  </span>
                </div>
                <div>
                  <span className="font-bold text-slate-500 block">
                    {t("admin.diagnoses.table.date")}
                  </span>
                  <span className="font-bold text-slate-900">
                    {formatDateTime(diag.created_at, lang)}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-4 rounded-2xl bg-[#f8faf5] border border-slate-200/80 space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {t("admin.diagnoses.drawer.aiPrediction")}
                </span>
                <p className="text-sm font-extrabold text-slate-900">
                  {formatDiseaseKey(diag.predicted_class, lang)}
                </p>
                <p className="font-bold text-[#166534]">
                  {formatConfidence(diag.confidence, 2)}
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200/80 space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {t("admin.diagnoses.drawer.finalDiagnosis")}
                </span>
                <p className="text-sm font-extrabold text-[#166534]">
                  {formatDiseaseKey(
                    diag.officer_label || diag.predicted_class,
                    lang
                  )}
                </p>
                <div className="pt-1">
                  <StatusBadge
                    type="status"
                    value={diag.status}
                    label={t(`status.${diag.status}`, diag.status)}
                  />
                </div>
              </div>
            </div>

            {/* Officer Review Info */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2 text-xs">
              <p className="font-extrabold text-slate-800 uppercase tracking-wider text-[11px]">
                {t("admin.diagnoses.drawer.officerReview")}
              </p>
              {diag.reviewed_by ? (
                <div className="space-y-1 text-slate-700">
                  <p>
                    <span className="font-bold">
                      {t("scanResult.officerNameLabel")}:{" "}
                    </span>
                    {diag.reviewed_by_name || diag.reviewed_by}
                  </p>
                  {diag.reviewed_at && (
                    <p>
                      <span className="font-bold">
                        {t("scanResult.officerDateLabel")}:{" "}
                      </span>
                      {formatDateTime(diag.reviewed_at, lang)}
                    </p>
                  )}
                  {diag.officer_notes && (
                    <p className="pt-1 italic text-slate-600">
                      "{diag.officer_notes}"
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-slate-500">
                  {t("admin.diagnoses.drawer.notReviewedYet")}
                </p>
              )}
            </div>
          </div>
        )}
      </Drawer>

      {/* Delete ConfirmDialog */}
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        loading={deleting}
        variant="danger"
        title={t("admin.diagnoses.deleteModal.title")}
        description={t("admin.diagnoses.deleteModal.description")}
        confirmLabel={t("admin.common.delete")}
        cancelLabel={t("admin.common.cancel")}
      />
    </div>
  );
}
