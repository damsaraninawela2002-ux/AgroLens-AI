import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import {
  AlertTriangle,
  CheckCircle2,
  Edit3,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Badge from "../../components/ui/Badge";
import DataTable from "../../components/admin/DataTable";
import SearchInput from "../../components/admin/SearchInput";
import FilterBar from "../../components/admin/FilterBar";
import StatusBadge from "../../components/admin/StatusBadge";
import Tabs from "../../components/admin/Tabs";
import Modal from "../../components/admin/Modal";
import ConfirmDialog from "../../components/admin/ConfirmDialog";
import { useLanguage } from "../../context/LanguageContext";
import {
  createAdminTreatment,
  deleteAdminTreatment,
  getAdminModelInfo,
  getAdminTreatments,
  notifyAdminCountsUpdated,
  updateAdminTreatment,
  verifyAdminTreatment,
} from "../../services/adminService";
import {
  extractErrorMessage,
  formatDate,
  formatDiseaseKey,
  getCropFromDiseaseKey,
  isHealthyDiseaseKey,
} from "../../utils/formatters";

function containsPlaceholder(val) {
  return String(val || "")
    .toLowerCase()
    .includes("to be verified");
}

function recordHasPlaceholder(item) {
  if (!item) return false;
  return (
    containsPlaceholder(item.disease_name_en) ||
    containsPlaceholder(item.disease_name_si) ||
    containsPlaceholder(item.symptoms_en) ||
    containsPlaceholder(item.symptoms_si) ||
    containsPlaceholder(item.treatment_en) ||
    containsPlaceholder(item.treatment_si) ||
    containsPlaceholder(item.prevention_en) ||
    containsPlaceholder(item.prevention_si) ||
    containsPlaceholder(item.source)
  );
}

const EMPTY_FORM = {
  disease_key: "",
  crop: "Tomato",
  disease_name_en: "",
  disease_name_si: "",
  is_healthy: false,
  symptoms_en: "",
  symptoms_si: "",
  treatment_en: "",
  treatment_si: "",
  prevention_en: "",
  prevention_si: "",
  source: "Department of Agriculture, Sri Lanka",
};

export default function AdminTreatments() {
  const { lang, t } = useLanguage();

  const [search, setSearch] = useState("");
  const [cropFilter, setCropFilter] = useState("");
  const [verifiedFilter, setVerifiedFilter] = useState("");

  const [treatments, setTreatments] = useState([]);
  const [allClassNames, setAllClassNames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Create / Edit Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formTab, setFormTab] = useState("en");
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [verifyingId, setVerifyingId] = useState(null);

  // Delete ConfirmDialog
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const buildParams = useCallback(() => {
    const params = {};
    if (search.trim()) params.search = search.trim();
    if (cropFilter) params.crop = cropFilter;
    if (verifiedFilter === "verified") params.is_verified = true;
    if (verifiedFilter === "unverified") params.is_verified = false;
    return params;
  }, [search, cropFilter, verifiedFilter]);

  const loadTreatments = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await getAdminTreatments(buildParams());
      setTreatments(Array.isArray(res?.items) ? res.items : []);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [buildParams]);

  useEffect(() => {
    let active = true;
    Promise.all([getAdminTreatments(buildParams()), getAdminModelInfo()])
      .then(([trRes, modelRes]) => {
        if (!active) return;
        setTreatments(Array.isArray(trRes?.items) ? trRes.items : []);
        if (Array.isArray(modelRes?.class_names)) {
          setAllClassNames(modelRes.class_names);
        }
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
  }, [buildParams]);

  const handleOpenCreate = () => {
    const usedKeys = new Set(treatments.map((tr) => tr.disease_key));
    const availableKey =
      allClassNames.find((cls) => !usedKeys.has(cls)) ||
      allClassNames[0] ||
      "";
    const defaultCrop = availableKey
      ? getCropFromDiseaseKey(availableKey, "en")
      : "Tomato";
    setEditingId(null);
    setFormTab("en");
    setForm({
      ...EMPTY_FORM,
      disease_key: availableKey,
      crop: defaultCrop,
      is_healthy: isHealthyDiseaseKey(availableKey),
    });
    setModalOpen(true);
  };

  const handleOpenEdit = (tr) => {
    setEditingId(tr.id);
    setFormTab("en");
    setForm({
      disease_key: tr.disease_key || "",
      crop: tr.crop || "Tomato",
      disease_name_en: tr.disease_name_en || "",
      disease_name_si: tr.disease_name_si || "",
      is_healthy: Boolean(tr.is_healthy),
      symptoms_en: tr.symptoms_en || "",
      symptoms_si: tr.symptoms_si || "",
      treatment_en: tr.treatment_en || "",
      treatment_si: tr.treatment_si || "",
      prevention_en: tr.prevention_en || "",
      prevention_si: tr.prevention_si || "",
      source: tr.source || "Department of Agriculture, Sri Lanka",
    });
    setModalOpen(true);
  };

  const handleDiseaseKeySelect = (keyVal) => {
    setForm((prev) => ({
      ...prev,
      disease_key: keyVal,
      crop: getCropFromDiseaseKey(keyVal, "en"),
      is_healthy: isHealthyDiseaseKey(keyVal),
      disease_name_en: prev.disease_name_en || formatDiseaseKey(keyVal, "en"),
    }));
  };

  const handleSave = async (e) => {
    e?.preventDefault();
    setSaving(true);
    try {
      if (editingId) {
        await updateAdminTreatment(editingId, form);
        toast.success(t("admin.treatments.toasts.updated"));
      } else {
        await createAdminTreatment(form);
        toast.success(t("admin.treatments.toasts.created"));
      }
      setModalOpen(false);
      notifyAdminCountsUpdated();
      loadTreatments();
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleVerifyRow = async (tr) => {
    if (recordHasPlaceholder(tr)) return;
    setVerifyingId(tr.id);
    try {
      await verifyAdminTreatment(
        tr.id,
        tr.source || "Department of Agriculture, Sri Lanka"
      );
      toast.success(t("admin.treatments.toasts.verified"));
      notifyAdminCountsUpdated();
      loadTreatments();
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setVerifyingId(null);
    }
  };

  const handleSaveAndVerifyModal = async () => {
    if (!editingId || recordHasPlaceholder(form)) return;
    setSaving(true);
    try {
      await updateAdminTreatment(editingId, form);
      await verifyAdminTreatment(
        editingId,
        form.source || "Department of Agriculture, Sri Lanka"
      );
      toast.success(t("admin.treatments.toasts.verified"));
      setModalOpen(false);
      notifyAdminCountsUpdated();
      loadTreatments();
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteAdminTreatment(deleteTarget.id);
      toast.success(t("admin.treatments.toasts.deleted"));
      setDeleteTarget(null);
      notifyAdminCountsUpdated();
      loadTreatments();
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setDeleting(false);
    }
  };

  const enHasPlaceholder =
    containsPlaceholder(form.disease_name_en) ||
    containsPlaceholder(form.symptoms_en) ||
    containsPlaceholder(form.treatment_en) ||
    containsPlaceholder(form.prevention_en);

  const siHasPlaceholder =
    containsPlaceholder(form.disease_name_si) ||
    containsPlaceholder(form.symptoms_si) ||
    containsPlaceholder(form.treatment_si) ||
    containsPlaceholder(form.prevention_si);

  const formHasAnyPlaceholder = recordHasPlaceholder(form);

  const renderFieldWithHighlight = ({
    label,
    fieldKey,
    isTextarea = false,
    rows = 3,
  }) => {
    const val = form[fieldKey] || "";
    const hasWarn = containsPlaceholder(val);
    const baseClasses = `w-full px-3.5 py-2.5 rounded-xl text-sm transition-all focus:outline-none ${
      hasWarn
        ? "bg-amber-50/90 border-2 border-amber-400 text-amber-950 focus:ring-2 focus:ring-amber-400/30"
        : "bg-[#f8faf5] border border-slate-200 text-slate-900 focus:border-[#166534] focus:ring-2 focus:ring-[#166534]/15"
    }`;

    return (
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
            <span>{label}</span>
            {hasWarn && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-200 text-amber-900">
                <AlertTriangle className="w-3 h-3" />
                TO BE VERIFIED
              </span>
            )}
          </label>
          <span className="text-[11px] font-mono text-slate-400">
            {val.length} chars
          </span>
        </div>

        {isTextarea ? (
          <textarea
            rows={rows}
            value={val}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, [fieldKey]: e.target.value }))
            }
            className={baseClasses}
          />
        ) : (
          <input
            type="text"
            value={val}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, [fieldKey]: e.target.value }))
            }
            className={baseClasses}
          />
        )}

        {hasWarn && (
          <p className="text-[11px] font-semibold text-amber-800 flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span>{t("admin.treatments.modal.placeholderAlert")}</span>
          </p>
        )}
      </div>
    );
  };

  const columns = [
    {
      key: "crop",
      header: t("admin.treatments.table.crop"),
      sortable: true,
      render: (tr) => (
        <Badge variant="neutral">{tr.crop || "Crop"}</Badge>
      ),
    },
    {
      key: "disease_name_en",
      header: t("admin.treatments.table.disease"),
      sortable: true,
      render: (tr) => {
        const hasWarn = recordHasPlaceholder(tr);
        return (
          <div className="space-y-1 min-w-[200px]">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-bold text-slate-900">
                {tr.disease_name_en}
              </p>
              {hasWarn && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-800 border border-amber-300">
                  {t("admin.treatments.placeholderWarningBadge")}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-600">{tr.disease_name_si}</p>
            <p className="text-[11px] font-mono text-slate-400">
              {tr.disease_key}
            </p>
          </div>
        );
      },
    },
    {
      key: "is_verified",
      header: t("admin.treatments.table.verified"),
      sortable: true,
      render: (tr) => (
        <StatusBadge
          type="verified"
          value={tr.is_verified}
          label={
            tr.is_verified
              ? t("admin.common.verified")
              : t("admin.common.unverified")
          }
        />
      ),
    },
    {
      key: "source",
      header: t("admin.treatments.table.source"),
      render: (tr) => (
        <span className="text-xs text-slate-600">
          {tr.source || "Department of Agriculture, Sri Lanka"}
        </span>
      ),
    },
    {
      key: "updated_at",
      header: t("admin.treatments.table.updated"),
      sortable: true,
      render: (tr) => (
        <span className="text-xs text-slate-500">
          {formatDate(tr.updated_at, lang)}
        </span>
      ),
    },
    {
      key: "actions",
      header: t("admin.treatments.table.actions"),
      align: "right",
      render: (tr) => {
        const hasWarn = recordHasPlaceholder(tr);
        return (
          <div className="inline-flex items-center justify-end gap-1.5">
            {!tr.is_verified && (
              <div
                title={
                  hasWarn
                    ? t("admin.treatments.verifyDisabledTooltip")
                    : t("admin.treatments.verifyBtn")
                }
              >
                <Button
                  variant="outline"
                  size="sm"
                  icon={ShieldCheck}
                  disabled={hasWarn || verifyingId === tr.id}
                  onClick={() => handleVerifyRow(tr)}
                >
                  {t("admin.treatments.verifyBtn")}
                </Button>
              </div>
            )}
            <button
              type="button"
              onClick={() => handleOpenEdit(tr)}
              title={t("admin.common.edit")}
              className="p-2 rounded-xl text-slate-500 hover:text-[#166534] hover:bg-emerald-50 transition-colors cursor-pointer"
            >
              <Edit3 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setDeleteTarget(tr)}
              title={t("admin.common.delete")}
              className="p-2 rounded-xl text-slate-500 hover:text-[#dc2626] hover:bg-red-50 transition-colors cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        );
      },
    },
  ];

  const hasActiveFilters = Boolean(search || cropFilter || verifiedFilter);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
            {t("admin.treatments.pageTitle")}
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            {t("admin.treatments.pageSubtitle")}
          </p>
        </div>

        <Button
          variant="primary"
          size="md"
          icon={Plus}
          onClick={handleOpenCreate}
        >
          {t("admin.treatments.addBtn")}
        </Button>
      </div>

      {/* Filters */}
      <FilterBar
        hasActiveFilters={hasActiveFilters}
        onReset={() => {
          setSearch("");
          setCropFilter("");
          setVerifiedFilter("");
        }}
        resetLabel={t("admin.common.resetFilters")}
      >
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder={t("admin.treatments.searchPlaceholder")}
        />

        <select
          value={cropFilter}
          onChange={(e) => setCropFilter(e.target.value)}
          className="px-3.5 py-2.5 rounded-xl bg-[#f8faf5] border border-slate-200 text-xs font-bold text-slate-700 focus:outline-none focus:border-[#166534]"
        >
          <option value="">{t("admin.common.allCrops")}</option>
          <option value="Tomato">Tomato</option>
          <option value="Potato">Potato</option>
          <option value="Pepper">Bell Pepper</option>
        </select>

        <select
          value={verifiedFilter}
          onChange={(e) => setVerifiedFilter(e.target.value)}
          className="px-3.5 py-2.5 rounded-xl bg-[#f8faf5] border border-slate-200 text-xs font-bold text-slate-700 focus:outline-none focus:border-[#166534]"
        >
          <option value="">{t("admin.treatments.filterAll")}</option>
          <option value="verified">{t("admin.treatments.filterVerified")}</option>
          <option value="unverified">
            {t("admin.treatments.filterUnverified")}
          </option>
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
            onClick={loadTreatments}
          >
            {t("admin.common.retry")}
          </Button>
        </Card>
      )}

      {/* Treatments DataTable */}
      <DataTable
        columns={columns}
        data={treatments}
        loading={loading}
        skeletonRows={6}
      />

      {/* ================= CREATE / EDIT TREATMENT MODAL ================= */}
      <Modal
        open={modalOpen}
        onClose={() => !saving && setModalOpen(false)}
        size="xl"
        title={
          editingId
            ? t("admin.treatments.modal.editTitle")
            : t("admin.treatments.modal.createTitle")
        }
        subtitle={t("admin.treatments.modal.subtitle")}
        footer={
          <div className="w-full flex flex-wrap items-center justify-between gap-3">
            <div>
              {editingId && (
                <div
                  title={
                    formHasAnyPlaceholder
                      ? t("admin.treatments.verifyDisabledTooltip")
                      : t("admin.treatments.verifyBtn")
                  }
                >
                  <Button
                    variant="accent"
                    size="md"
                    icon={ShieldCheck}
                    disabled={formHasAnyPlaceholder || saving}
                    onClick={handleSaveAndVerifyModal}
                  >
                    {t("admin.treatments.verifyBtn")}
                  </Button>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2.5">
              <Button
                variant="ghost"
                disabled={saving}
                onClick={() => setModalOpen(false)}
              >
                {t("admin.common.cancel")}
              </Button>
              <Button
                variant="primary"
                icon={CheckCircle2}
                loading={saving}
                onClick={handleSave}
              >
                {t("admin.common.save")}
              </Button>
            </div>
          </div>
        }
      >
        <form onSubmit={handleSave} className="space-y-5">
          {/* Top Metadata Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-2xl bg-[#f8faf5] border border-slate-200/80">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {t("admin.treatments.modal.diseaseKeyLabel")}
              </label>
              {editingId ? (
                <input
                  type="text"
                  disabled
                  value={form.disease_key}
                  className="w-full px-3 py-2 rounded-xl bg-slate-100 border border-slate-200 text-xs font-mono text-slate-600"
                />
              ) : (
                <select
                  required
                  value={form.disease_key}
                  onChange={(e) => handleDiseaseKeySelect(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-mono text-slate-800 focus:outline-none focus:border-[#166534]"
                >
                  <option value="">
                    {t("admin.treatments.modal.selectDiseaseKey")}
                  </option>
                  {allClassNames.map((cls) => (
                    <option key={cls} value={cls}>
                      {cls}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {t("admin.treatments.modal.cropLabel")}
              </label>
              <input
                type="text"
                required
                value={form.crop}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, crop: e.target.value }))
                }
                className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-sm text-slate-800 focus:outline-none focus:border-[#166534]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {t("admin.treatments.modal.sourceLabel")}
              </label>
              <input
                type="text"
                value={form.source}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, source: e.target.value }))
                }
                className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-sm text-slate-800 focus:outline-none focus:border-[#166534]"
              />
            </div>
          </div>

          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={form.is_healthy}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, is_healthy: e.target.checked }))
              }
              className="w-4 h-4 rounded accent-[#166534]"
            />
            <span className="text-xs font-bold text-slate-700">
              {t("admin.treatments.modal.isHealthyLabel")}
            </span>
          </label>

          {/* Language Tabs: English | සිංහල */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <Tabs
              activeTab={formTab}
              onChange={setFormTab}
              tabs={[
                {
                  id: "en",
                  label: t("admin.treatments.modal.tabEn"),
                  badge: enHasPlaceholder ? "!" : null,
                  badgeTone: "warning",
                },
                {
                  id: "si",
                  label: t("admin.treatments.modal.tabSi"),
                  badge: siHasPlaceholder ? "!" : null,
                  badgeTone: "warning",
                },
              ]}
            />
          </div>

          {formTab === "en" ? (
            <div className="space-y-4">
              {renderFieldWithHighlight({
                label: t("admin.treatments.modal.diseaseNameEn"),
                fieldKey: "disease_name_en",
                isTextarea: false,
              })}
              {renderFieldWithHighlight({
                label: t("admin.treatments.modal.symptomsEn"),
                fieldKey: "symptoms_en",
                isTextarea: true,
                rows: 3,
              })}
              {renderFieldWithHighlight({
                label: t("admin.treatments.modal.treatmentEn"),
                fieldKey: "treatment_en",
                isTextarea: true,
                rows: 4,
              })}
              {renderFieldWithHighlight({
                label: t("admin.treatments.modal.preventionEn"),
                fieldKey: "prevention_en",
                isTextarea: true,
                rows: 3,
              })}
            </div>
          ) : (
            <div className="space-y-4">
              {renderFieldWithHighlight({
                label: t("admin.treatments.modal.diseaseNameSi"),
                fieldKey: "disease_name_si",
                isTextarea: false,
              })}
              {renderFieldWithHighlight({
                label: t("admin.treatments.modal.symptomsSi"),
                fieldKey: "symptoms_si",
                isTextarea: true,
                rows: 3,
              })}
              {renderFieldWithHighlight({
                label: t("admin.treatments.modal.treatmentSi"),
                fieldKey: "treatment_si",
                isTextarea: true,
                rows: 4,
              })}
              {renderFieldWithHighlight({
                label: t("admin.treatments.modal.preventionSi"),
                fieldKey: "prevention_si",
                isTextarea: true,
                rows: 3,
              })}
            </div>
          )}
        </form>
      </Modal>

      {/* Delete ConfirmDialog */}
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        loading={deleting}
        variant="danger"
        title={t("admin.treatments.deleteModal.title")}
        description={`${t("admin.treatments.deleteModal.description")} (${
          deleteTarget?.disease_name_en || ""
        })`}
        confirmLabel={t("admin.common.delete")}
        cancelLabel={t("admin.common.cancel")}
      />
    </div>
  );
}
