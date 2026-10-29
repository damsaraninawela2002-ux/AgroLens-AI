import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import {
  AlertTriangle,
  CheckCircle2,
  Edit3,
  Eye,
  KeyRound,
  Plus,
  Power,
  RefreshCw,
  Trash2,
  UserPlus,
} from "lucide-react";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import DataTable from "../../components/admin/DataTable";
import SearchInput from "../../components/admin/SearchInput";
import FilterBar from "../../components/admin/FilterBar";
import StatusBadge from "../../components/admin/StatusBadge";
import Modal from "../../components/admin/Modal";
import Drawer from "../../components/admin/Drawer";
import ConfirmDialog from "../../components/admin/ConfirmDialog";
import { useAuth } from "../../context/AuthContext";
import { useLanguage } from "../../context/LanguageContext";
import {
  createAdminUser,
  deleteAdminUser,
  getAdminUserById,
  getAdminUsers,
  notifyAdminCountsUpdated,
  resetAdminUserPassword,
  updateAdminUser,
} from "../../services/adminService";
import {
  SRI_LANKAN_DISTRICTS,
  extractErrorMessage,
  formatDate,
  formatDateTime,
} from "../../utils/formatters";

export default function AdminUsers() {
  const { user: currentUser } = useAuth();
  const { lang, t } = useLanguage();

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [districtFilter, setDistrictFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sort, setSort] = useState("newest");
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

  // View Drawer State
  const [viewDrawer, setViewDrawer] = useState({
    open: false,
    loading: false,
    user: null,
  });

  // Create User Modal State
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    full_name: "",
    email: "",
    password: "",
    role: "farmer",
    district: "Colombo",
    preferred_language: "en",
  });
  const [creating, setCreating] = useState(false);

  // Edit User Modal State
  const [editModal, setEditModal] = useState({
    open: false,
    user: null,
    full_name: "",
    role: "farmer",
    district: "Colombo",
    preferred_language: "en",
    is_active: true,
  });
  const [updating, setUpdating] = useState(false);

  // Reset Password Modal State
  const [pwdModal, setPwdModal] = useState({
    open: false,
    user: null,
    newPassword: "",
  });
  const [resettingPwd, setResettingPwd] = useState(false);

  // Delete ConfirmDialog State
  const [deleteDialog, setDeleteDialog] = useState({
    open: false,
    user: null,
  });
  const [deleting, setDeleting] = useState(false);
  const [togglingId, setTogglingId] = useState(null);

  const buildQueryParams = useCallback(() => {
    const params = {
      page,
      limit,
      sort,
    };
    if (search.trim()) params.search = search.trim();
    if (roleFilter) params.role = roleFilter;
    if (districtFilter) params.district = districtFilter;
    if (statusFilter === "active") {
      params.is_active = true;
    } else if (statusFilter === "inactive") {
      params.is_active = false;
    } else if (statusFilter === "pending_approval") {
      params.role = "officer";
      params.is_approved = false;
      params.is_active = true;
    }
    return params;
  }, [page, limit, sort, search, roleFilter, districtFilter, statusFilter]);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await getAdminUsers(buildQueryParams());
      const rawItems = res?.items ?? res?.users ?? res?.data ?? [];
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
  }, [buildQueryParams]);

  useEffect(() => {
    let active = true;
    getAdminUsers(buildQueryParams())
      .then((res) => {
        if (active) {
          const rawItems = res?.items ?? res?.users ?? res?.data ?? [];
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
  }, [buildQueryParams]);

  const getUserStatusType = (u) => {
    if (u.is_active === false) return "inactive";
    if (u.role === "officer" && u.is_approved === false)
      return "pending_approval";
    return "active";
  };

  const getUserStatusLabel = (u) => {
    const st = getUserStatusType(u);
    if (st === "inactive") return t("admin.common.inactive");
    if (st === "pending_approval") return t("admin.common.pendingApproval");
    return t("admin.common.active");
  };

  const handleOpenViewDrawer = async (rowUser) => {
    setViewDrawer({ open: true, loading: true, user: rowUser });
    try {
      const fullDetail = await getAdminUserById(rowUser.id);
      setViewDrawer({ open: true, loading: false, user: fullDetail });
    } catch (err) {
      toast.error(extractErrorMessage(err));
      setViewDrawer((prev) => ({ ...prev, loading: false }));
    }
  };

  const handleCreateSubmit = async (e) => {
    if (e?.preventDefault) e.preventDefault();
    if (createForm.full_name.trim().length < 2) {
      toast.error("Full name must be at least 2 characters");
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(createForm.email.trim())) {
      toast.error("Please enter a valid email address");
      return;
    }
    if (createForm.password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    setCreating(true);
    try {
      await createAdminUser({
        ...createForm,
        full_name: createForm.full_name.trim(),
        email: createForm.email.trim(),
      });
      toast.success(t("admin.users.toasts.created"));
      setCreateOpen(false);
      setCreateForm({
        full_name: "",
        email: "",
        password: "",
        role: "farmer",
        district: "Colombo",
        preferred_language: "en",
      });
      notifyAdminCountsUpdated();
      loadUsers();
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setCreating(false);
    }
  };

  const handleOpenEdit = (u) => {
    setEditModal({
      open: true,
      user: u,
      full_name: u.full_name,
      role: u.role,
      district: u.district,
      preferred_language: u.preferred_language || "en",
      is_active: u.is_active !== false,
    });
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editModal.user) return;
    setUpdating(true);
    try {
      const isSelf = editModal.user.id === currentUser?.id;
      const payload = {
        full_name: editModal.full_name.trim(),
        district: editModal.district,
        preferred_language: editModal.preferred_language,
      };
      if (!isSelf) {
        payload.role = editModal.role;
        payload.is_active = editModal.is_active;
      }
      await updateAdminUser(editModal.user.id, payload);
      toast.success(t("admin.users.toasts.updated"));
      setEditModal((prev) => ({ ...prev, open: false, user: null }));
      notifyAdminCountsUpdated();
      loadUsers();
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setUpdating(false);
    }
  };

  const handleToggleActive = async (u) => {
    if (u.id === currentUser?.id || togglingId === u.id) return;
    const nextActive = u.is_active === false;
    setTogglingId(u.id);
    try {
      await updateAdminUser(u.id, { is_active: nextActive });
      toast.success(t("admin.users.toasts.updated"));
      setData((prev) => ({
        ...prev,
        items: prev.items.map((item) =>
          item.id === u.id ? { ...item, is_active: nextActive } : item
        ),
      }));
      notifyAdminCountsUpdated();
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setTogglingId(null);
    }
  };

  const handleResetPasswordSubmit = async (e) => {
    e.preventDefault();
    if (!pwdModal.user) return;
    if (pwdModal.newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    setResettingPwd(true);
    try {
      await resetAdminUserPassword(pwdModal.user.id, pwdModal.newPassword);
      toast.success(t("admin.users.toasts.passwordReset"));
      setPwdModal({ open: false, user: null, newPassword: "" });
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setResettingPwd(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteDialog.user) return;
    setDeleting(true);
    try {
      await deleteAdminUser(deleteDialog.user.id);
      toast.success(t("admin.users.toasts.deleted"));
      setDeleteDialog({ open: false, user: null });
      notifyAdminCountsUpdated();
      loadUsers();
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setDeleting(false);
    }
  };

  const hasActiveFilters = Boolean(
    search || roleFilter || districtFilter || statusFilter || sort !== "newest"
  );

  const resetFilters = () => {
    setSearch("");
    setRoleFilter("");
    setDistrictFilter("");
    setStatusFilter("");
    setSort("newest");
    setPage(1);
  };

  const columns = [
    {
      key: "full_name",
      header: t("admin.users.table.user"),
      sortable: true,
      render: (u) => (
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 text-[#166534] flex items-center justify-center font-extrabold text-sm shrink-0">
            {u.full_name?.charAt(0)?.toUpperCase() || "U"}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-900 truncate">
              {u.full_name}
              {u.id === currentUser?.id && (
                <span className="ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-[#166534]">
                  YOU
                </span>
              )}
            </p>
            <p className="text-xs text-slate-500 truncate">{u.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: "role",
      header: t("admin.users.table.role"),
      sortable: true,
      render: (u) => <StatusBadge type="role" value={u.role} />,
    },
    {
      key: "district",
      header: t("admin.users.table.district"),
      sortable: true,
      render: (u) => (
        <span className="text-xs font-semibold text-slate-700">
          {u.district}
        </span>
      ),
    },
    {
      key: "status",
      header: t("admin.users.table.status"),
      render: (u) => (
        <StatusBadge
          type="user_status"
          value={getUserStatusType(u)}
          label={getUserStatusLabel(u)}
        />
      ),
    },
    {
      key: "created_at",
      header: t("admin.users.table.joined"),
      sortable: true,
      render: (u) => (
        <span className="text-xs text-slate-500">
          {formatDate(u.created_at, lang)}
        </span>
      ),
    },
    {
      key: "actions",
      header: t("admin.users.table.actions"),
      align: "right",
      render: (u) => {
        const isSelf = u.id === currentUser?.id;
        return (
          <div className="inline-flex items-center justify-end gap-1">
            <button
              type="button"
              onClick={() => handleOpenViewDrawer(u)}
              title={t("admin.users.actions.view")}
              className="p-2 rounded-xl text-slate-500 hover:text-[#166534] hover:bg-emerald-50 transition-colors cursor-pointer"
            >
              <Eye className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => handleOpenEdit(u)}
              title={t("admin.users.actions.edit")}
              className="p-2 rounded-xl text-slate-500 hover:text-[#166534] hover:bg-emerald-50 transition-colors cursor-pointer"
            >
              <Edit3 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() =>
                setPwdModal({ open: true, user: u, newPassword: "" })
              }
              title={t("admin.users.actions.resetPassword")}
              className="p-2 rounded-xl text-slate-500 hover:text-amber-700 hover:bg-amber-50 transition-colors cursor-pointer"
            >
              <KeyRound className="w-4 h-4" />
            </button>
            <button
              type="button"
              disabled={isSelf || togglingId === u.id}
              onClick={() => handleToggleActive(u)}
              title={
                isSelf
                  ? t("admin.users.actions.selfProtectedTooltip")
                  : u.is_active === false
                  ? t("admin.users.actions.activate")
                  : t("admin.users.actions.deactivate")
              }
              className={`p-2 rounded-xl transition-colors ${
                isSelf || togglingId === u.id
                  ? "text-slate-300 cursor-not-allowed"
                  : u.is_active === false
                  ? "text-emerald-600 hover:bg-emerald-50 cursor-pointer"
                  : "text-amber-600 hover:bg-amber-50 cursor-pointer"
              }`}
            >
              <Power className="w-4 h-4" />
            </button>
            <button
              type="button"
              disabled={isSelf}
              onClick={() => setDeleteDialog({ open: true, user: u })}
              title={
                isSelf
                  ? t("admin.users.actions.selfProtectedTooltip")
                  : t("admin.users.actions.delete")
              }
              className={`p-2 rounded-xl transition-colors ${
                isSelf
                  ? "text-slate-300 cursor-not-allowed"
                  : "text-slate-500 hover:text-[#dc2626] hover:bg-red-50 cursor-pointer"
              }`}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
            {t("admin.users.pageTitle")}
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            {t("admin.users.pageSubtitle")}
          </p>
        </div>

        <Button
          variant="primary"
          size="md"
          icon={UserPlus}
          onClick={() => setCreateOpen(true)}
        >
          {t("admin.users.addUserBtn")}
        </Button>
      </div>

      {/* Search + FilterBar */}
      <FilterBar
        hasActiveFilters={hasActiveFilters}
        onReset={resetFilters}
        resetLabel={t("admin.common.resetFilters")}
      >
        <SearchInput
          value={search}
          onChange={(val) => {
            setSearch(val);
            setPage(1);
          }}
          placeholder={t("admin.users.searchPlaceholder")}
        />

        <select
          value={roleFilter}
          onChange={(e) => {
            setRoleFilter(e.target.value);
            setPage(1);
          }}
          className="px-3.5 py-2.5 rounded-xl bg-[#f8faf5] border border-slate-200 text-xs font-bold text-slate-700 focus:outline-none focus:border-[#166534]"
        >
          <option value="">{t("admin.common.allRoles")}</option>
          <option value="farmer">Farmer</option>
          <option value="officer">Officer</option>
          <option value="admin">Admin</option>
        </select>

        <select
          value={districtFilter}
          onChange={(e) => {
            setDistrictFilter(e.target.value);
            setPage(1);
          }}
          className="px-3.5 py-2.5 rounded-xl bg-[#f8faf5] border border-slate-200 text-xs font-bold text-slate-700 focus:outline-none focus:border-[#166534]"
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
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="px-3.5 py-2.5 rounded-xl bg-[#f8faf5] border border-slate-200 text-xs font-bold text-slate-700 focus:outline-none focus:border-[#166534]"
        >
          <option value="">{t("admin.users.statusAll")}</option>
          <option value="active">{t("admin.users.statusActive")}</option>
          <option value="inactive">{t("admin.users.statusInactive")}</option>
          <option value="pending_approval">
            {t("admin.users.statusPending")}
          </option>
        </select>

        <select
          value={sort}
          onChange={(e) => {
            setSort(e.target.value);
            setPage(1);
          }}
          className="px-3.5 py-2.5 rounded-xl bg-[#f8faf5] border border-slate-200 text-xs font-bold text-slate-700 focus:outline-none focus:border-[#166534]"
        >
          <option value="newest">{t("admin.users.sortNewest")}</option>
          <option value="oldest">{t("admin.users.sortOldest")}</option>
          <option value="name">{t("admin.users.sortName")}</option>
        </select>
      </FilterBar>

      {/* Error State */}
      {error && (
        <Card className="border-red-200 bg-red-50/60 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-[#dc2626]">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <p className="text-sm font-bold">{error}</p>
          </div>
          <Button variant="outline" size="sm" icon={RefreshCw} onClick={loadUsers}>
            {t("admin.common.retry")}
          </Button>
        </Card>
      )}

      {/* Users DataTable */}
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

      {/* ================= VIEW USER DETAILS DRAWER ================= */}
      <Drawer
        open={viewDrawer.open}
        onClose={() => setViewDrawer({ open: false, loading: false, user: null })}
        title={t("admin.users.drawer.title")}
        subtitle={viewDrawer.user?.email}
      >
        {viewDrawer.user && (
          <div className="space-y-5">
            <div className="flex items-center gap-4 p-4 rounded-2xl bg-[#f8faf5] border border-slate-200/80">
              <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-[#166534] flex items-center justify-center font-extrabold text-xl shrink-0">
                {viewDrawer.user.full_name?.charAt(0)?.toUpperCase() || "U"}
              </div>
              <div className="min-w-0 space-y-1">
                <h4 className="text-base font-extrabold text-slate-900 truncate">
                  {viewDrawer.user.full_name}
                </h4>
                <p className="text-xs text-slate-500 truncate">
                  {viewDrawer.user.email}
                </p>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <StatusBadge type="role" value={viewDrawer.user.role} />
                  <StatusBadge
                    type="user_status"
                    value={getUserStatusType(viewDrawer.user)}
                    label={getUserStatusLabel(viewDrawer.user)}
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200/70">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  {t("admin.users.drawer.scanCount")}
                </span>
                <p className="text-2xl font-extrabold text-[#166534] mt-1">
                  {viewDrawer.loading ? "..." : viewDrawer.user.scan_count ?? 0}
                </p>
              </div>
              <div className="p-4 rounded-2xl bg-sky-50/60 border border-sky-200/70">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  {t("admin.users.drawer.reviewCount")}
                </span>
                <p className="text-2xl font-extrabold text-sky-700 mt-1">
                  {viewDrawer.loading
                    ? "..."
                    : viewDrawer.user.review_count ?? 0}
                </p>
              </div>
            </div>

            <div className="space-y-3 text-xs border-t border-slate-100 pt-4">
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="font-bold text-slate-500">
                  {t("profile.district")}
                </span>
                <span className="font-bold text-slate-900">
                  {viewDrawer.user.district}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="font-bold text-slate-500">
                  {t("profile.preferredLanguage")}
                </span>
                <span className="font-bold text-slate-900 uppercase">
                  {viewDrawer.user.preferred_language}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="font-bold text-slate-500">
                  {t("profile.memberSince")}
                </span>
                <span className="font-bold text-slate-900">
                  {formatDateTime(viewDrawer.user.created_at, lang)}
                </span>
              </div>
              {viewDrawer.user.approved_at && (
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="font-bold text-slate-500">
                    {t("admin.users.drawer.approvedAt")}
                  </span>
                  <span className="font-bold text-slate-900">
                    {formatDateTime(viewDrawer.user.approved_at, lang)}
                  </span>
                </div>
              )}
              {viewDrawer.user.updated_at && (
                <div className="flex justify-between py-1.5">
                  <span className="font-bold text-slate-500">
                    {t("admin.users.drawer.updatedAt")}
                  </span>
                  <span className="font-bold text-slate-900">
                    {formatDateTime(viewDrawer.user.updated_at, lang)}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </Drawer>

      {/* ================= CREATE USER MODAL ================= */}
      <Modal
        open={createOpen}
        onClose={() => !creating && setCreateOpen(false)}
        title={t("admin.users.createModal.title")}
        subtitle={t("admin.users.createModal.subtitle")}
        footer={
          <>
            <Button
              variant="ghost"
              disabled={creating}
              onClick={() => setCreateOpen(false)}
            >
              {t("admin.common.cancel")}
            </Button>
            <Button
              variant="primary"
              icon={Plus}
              loading={creating}
              onClick={handleCreateSubmit}
            >
              {t("admin.users.createModal.createBtn")}
            </Button>
          </>
        }
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              {t("profile.fullName")} *
            </label>
            <input
              type="text"
              required
              minLength={2}
              value={createForm.full_name}
              onChange={(e) =>
                setCreateForm((p) => ({ ...p, full_name: e.target.value }))
              }
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#f8faf5] border border-slate-200 text-sm focus:outline-none focus:border-[#166534]"
              placeholder="Kasun Perera"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              {t("profile.email")} *
            </label>
            <input
              type="email"
              required
              value={createForm.email}
              onChange={(e) =>
                setCreateForm((p) => ({ ...p, email: e.target.value }))
              }
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#f8faf5] border border-slate-200 text-sm focus:outline-none focus:border-[#166534]"
              placeholder="user@agrolens.lk"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Password (min 6 chars) *
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={createForm.password}
              onChange={(e) =>
                setCreateForm((p) => ({ ...p, password: e.target.value }))
              }
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#f8faf5] border border-slate-200 text-sm focus:outline-none focus:border-[#166534]"
              placeholder="••••••••"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {t("profile.role")}
              </label>
              <select
                value={createForm.role}
                onChange={(e) =>
                  setCreateForm((p) => ({ ...p, role: e.target.value }))
                }
                className="w-full px-3 py-2.5 rounded-xl bg-[#f8faf5] border border-slate-200 text-sm font-semibold focus:outline-none focus:border-[#166534]"
              >
                <option value="farmer">Farmer</option>
                <option value="officer">Officer</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {t("profile.district")}
              </label>
              <select
                value={createForm.district}
                onChange={(e) =>
                  setCreateForm((p) => ({ ...p, district: e.target.value }))
                }
                className="w-full px-3 py-2.5 rounded-xl bg-[#f8faf5] border border-slate-200 text-sm font-semibold focus:outline-none focus:border-[#166534]"
              >
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
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Language
              </label>
              <select
                value={createForm.preferred_language}
                onChange={(e) =>
                  setCreateForm((p) => ({
                    ...p,
                    preferred_language: e.target.value,
                  }))
                }
                className="w-full px-3 py-2.5 rounded-xl bg-[#f8faf5] border border-slate-200 text-sm font-semibold focus:outline-none focus:border-[#166534]"
              >
                <option value="en">English</option>
                <option value="si">සිංහල</option>
              </select>
            </div>
          </div>
        </form>
      </Modal>

      {/* ================= EDIT USER MODAL ================= */}
      <Modal
        open={editModal.open}
        onClose={() =>
          !updating && setEditModal((p) => ({ ...p, open: false, user: null }))
        }
        title={t("admin.users.editModal.title")}
        subtitle={t("admin.users.editModal.subtitle")}
        footer={
          <>
            <Button
              variant="ghost"
              disabled={updating}
              onClick={() =>
                setEditModal((p) => ({ ...p, open: false, user: null }))
              }
            >
              {t("admin.common.cancel")}
            </Button>
            <Button
              variant="primary"
              icon={CheckCircle2}
              loading={updating}
              onClick={handleEditSubmit}
            >
              {t("admin.common.save")}
            </Button>
          </>
        }
      >
        <form onSubmit={handleEditSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              {t("profile.fullName")}
            </label>
            <input
              type="text"
              required
              minLength={2}
              value={editModal.full_name}
              onChange={(e) =>
                setEditModal((p) => ({ ...p, full_name: e.target.value }))
              }
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#f8faf5] border border-slate-200 text-sm focus:outline-none focus:border-[#166534]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {t("profile.role")}
              </label>
              <select
                disabled={editModal.user?.id === currentUser?.id}
                value={editModal.role}
                onChange={(e) =>
                  setEditModal((p) => ({ ...p, role: e.target.value }))
                }
                className="w-full px-3 py-2.5 rounded-xl bg-[#f8faf5] border border-slate-200 text-sm font-semibold focus:outline-none focus:border-[#166534] disabled:opacity-50"
              >
                <option value="farmer">Farmer</option>
                <option value="officer">Officer</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {t("profile.district")}
              </label>
              <select
                value={editModal.district}
                onChange={(e) =>
                  setEditModal((p) => ({ ...p, district: e.target.value }))
                }
                className="w-full px-3 py-2.5 rounded-xl bg-[#f8faf5] border border-slate-200 text-sm font-semibold focus:outline-none focus:border-[#166534]"
              >
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
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Language
              </label>
              <select
                value={editModal.preferred_language}
                onChange={(e) =>
                  setEditModal((p) => ({
                    ...p,
                    preferred_language: e.target.value,
                  }))
                }
                className="w-full px-3 py-2.5 rounded-xl bg-[#f8faf5] border border-slate-200 text-sm font-semibold focus:outline-none focus:border-[#166534]"
              >
                <option value="en">English</option>
                <option value="si">සිංහල</option>
              </select>
            </div>
          </div>

          {editModal.user?.id !== currentUser?.id && (
            <label className="flex items-center gap-2.5 pt-2 cursor-pointer">
              <input
                type="checkbox"
                checked={editModal.is_active}
                onChange={(e) =>
                  setEditModal((p) => ({ ...p, is_active: e.target.checked }))
                }
                className="w-4 h-4 rounded accent-[#166534]"
              />
              <span className="text-xs font-bold text-slate-700">
                Account Active ({t("admin.common.active")})
              </span>
            </label>
          )}
        </form>
      </Modal>

      {/* ================= RESET PASSWORD MODAL ================= */}
      <Modal
        open={pwdModal.open}
        onClose={() =>
          !resettingPwd &&
          setPwdModal({ open: false, user: null, newPassword: "" })
        }
        title={t("admin.users.passwordModal.title")}
        subtitle={`${t("admin.users.passwordModal.subtitle")} ${
          pwdModal.user?.full_name || ""
        } (${pwdModal.user?.email || ""})`}
        size="sm"
        footer={
          <>
            <Button
              variant="ghost"
              disabled={resettingPwd}
              onClick={() =>
                setPwdModal({ open: false, user: null, newPassword: "" })
              }
            >
              {t("admin.common.cancel")}
            </Button>
            <Button
              variant="primary"
              icon={KeyRound}
              loading={resettingPwd}
              onClick={handleResetPasswordSubmit}
            >
              {t("admin.users.passwordModal.submitBtn")}
            </Button>
          </>
        }
      >
        <form onSubmit={handleResetPasswordSubmit} className="space-y-3">
          <label className="block text-xs font-bold text-slate-700">
            {t("admin.users.passwordModal.newPasswordLabel")}
          </label>
          <input
            type="password"
            required
            minLength={6}
            value={pwdModal.newPassword}
            onChange={(e) =>
              setPwdModal((p) => ({ ...p, newPassword: e.target.value }))
            }
            placeholder={t("admin.users.passwordModal.newPasswordPlaceholder")}
            className="w-full px-3.5 py-2.5 rounded-xl bg-[#f8faf5] border border-slate-200 text-sm focus:outline-none focus:border-[#166534]"
          />
        </form>
      </Modal>

      {/* ================= DELETE CONFIRMATION DIALOG (TYPED NAME) ================= */}
      <ConfirmDialog
        open={deleteDialog.open}
        onClose={() => setDeleteDialog({ open: false, user: null })}
        onConfirm={handleConfirmDelete}
        loading={deleting}
        variant="danger"
        title={t("admin.users.deleteModal.title")}
        description={t("admin.users.deleteModal.description")}
        requireTypedText={deleteDialog.user?.full_name || ""}
        typedPromptLabel={t("admin.users.deleteModal.typePrompt")}
        confirmLabel={t("admin.users.deleteModal.confirmBtn")}
        cancelLabel={t("admin.common.cancel")}
      />
    </div>
  );
}
