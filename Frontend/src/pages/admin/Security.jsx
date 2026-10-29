import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import {
  Activity,
  AlertTriangle,
  KeyRound,
  Laptop,
  Lock,
  LogOut,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Unlock,
} from "lucide-react";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import PasswordStrength, {
  evaluatePasswordRules,
} from "../../components/ui/PasswordStrength";
import DataTable from "../../components/admin/DataTable";
import StatusBadge from "../../components/admin/StatusBadge";
import ConfirmDialog from "../../components/admin/ConfirmDialog";
import { useAuth } from "../../context/AuthContext";
import { useLanguage } from "../../context/LanguageContext";
import api from "../../services/api";
import { resetAdminUserPassword } from "../../services/adminService";
import { extractErrorMessage, formatDate } from "../../utils/formatters";

export default function Security() {
  const { user: currentUser } = useAuth();
  const { lang, t } = useLanguage();

  // 1. Summary state
  const [summary, setSummary] = useState({
    failed_logins_today: 0,
    active_sessions: 0,
    locked_accounts: 0,
  });
  const [loadingSummary, setLoadingSummary] = useState(true);

  // 2. Login events state
  const [events, setEvents] = useState([]);
  const [eventsTotal, setEventsTotal] = useState(0);
  const [eventsPage, setEventsPage] = useState(1);
  const [eventsPages, setEventsPages] = useState(1);
  const [emailFilter, setEmailFilter] = useState("");
  const [successFilter, setSuccessFilter] = useState("all");
  const [loadingEvents, setLoadingEvents] = useState(true);

  // 3. Active sessions state
  const [sessions, setSessions] = useState([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [sessionToRevoke, setSessionToRevoke] = useState(null);
  const [revokingSession, setRevokingSession] = useState(false);

  // 4. Locked accounts state
  const [lockedAccounts, setLockedAccounts] = useState([]);
  const [loadingLocked, setLoadingLocked] = useState(true);
  const [unlockingUserId, setUnlockingUserId] = useState(null);

  // Change password form state
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  const fetchSummary = useCallback(async () => {
    setLoadingSummary(true);
    try {
      const res = await api.get("/api/admin/security/summary");
      setSummary({
        failed_logins_today: Number(res.data?.failed_logins_today) || 0,
        active_sessions: Number(res.data?.active_sessions) || 0,
        locked_accounts: Number(res.data?.locked_accounts) || 0,
      });
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setLoadingSummary(false);
    }
  }, []);

  const fetchLoginEvents = useCallback(async () => {
    setLoadingEvents(true);
    try {
      const params = {
        page: eventsPage,
        limit: 10,
      };
      if (emailFilter.trim()) {
        params.email = emailFilter.trim();
      }
      if (successFilter === "true") {
        params.success = true;
      } else if (successFilter === "false") {
        params.success = false;
      }

      const res = await api.get("/api/admin/security/login-events", { params });
      setEvents(Array.isArray(res.data?.items) ? res.data.items : []);
      setEventsTotal(Number(res.data?.total) || 0);
      setEventsPages(Number(res.data?.pages) || 1);
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setLoadingEvents(false);
    }
  }, [eventsPage, emailFilter, successFilter]);

  const fetchSessions = useCallback(async () => {
    setLoadingSessions(true);
    try {
      const res = await api.get("/api/admin/security/sessions");
      setSessions(Array.isArray(res.data?.items) ? res.data.items : []);
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setLoadingSessions(false);
    }
  }, []);

  const fetchLockedAccounts = useCallback(async () => {
    setLoadingLocked(true);
    try {
      const res = await api.get("/api/admin/security/locked-accounts");
      setLockedAccounts(Array.isArray(res.data?.items) ? res.data.items : []);
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setLoadingLocked(false);
    }
  }, []);

  useEffect(() => {
    fetchSummary();
    fetchSessions();
    fetchLockedAccounts();
  }, [fetchSummary, fetchSessions, fetchLockedAccounts]);

  useEffect(() => {
    fetchLoginEvents();
  }, [fetchLoginEvents]);

  const handleRefreshAll = () => {
    fetchSummary();
    fetchLoginEvents();
    fetchSessions();
    fetchLockedAccounts();
  };

  const handleConfirmForceLogout = async () => {
    if (!sessionToRevoke) return;
    const sessionId = sessionToRevoke.session_id || sessionToRevoke.id;
    setRevokingSession(true);
    try {
      await api.delete(`/api/admin/security/sessions/${sessionId}`);
      toast.success(
        t("admin.security.toasts.sessionRevoked") ||
          "Session revoked successfully"
      );
      setSessionToRevoke(null);
      fetchSessions();
      fetchSummary();
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setRevokingSession(false);
    }
  };

  const handleUnlockAccount = async (userId) => {
    setUnlockingUserId(userId);
    try {
      await api.put(`/api/admin/users/${userId}/unlock`);
      toast.success(
        t("admin.security.toasts.accountUnlocked") ||
          "Account unlocked successfully"
      );
      fetchLockedAccounts();
      fetchSummary();
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setUnlockingUserId(null);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    if (!currentUser?.id) return;

    const rules = evaluatePasswordRules(newPassword, currentUser?.email);
    if (!rules.hasMinLength || !rules.hasLetter || !rules.hasNumber) {
      toast.error(
        t("admin.security.errors.passwordTooShort") ||
          "Password must be at least 8 characters with a letter and a number"
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error(
        t("admin.security.errors.passwordMismatch") || "Passwords do not match"
      );
      return;
    }

    setSavingPassword(true);
    try {
      await resetAdminUserPassword(currentUser.id, newPassword);
      toast.success(
        t("admin.security.toasts.passwordUpdated") ||
          "Your admin password has been updated successfully!"
      );
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setSavingPassword(false);
    }
  };

  const loginEventColumns = [
    {
      key: "email",
      header: t("admin.security.events.email") || "Email",
      render: (row) => (
        <span className="font-mono text-xs font-semibold text-slate-900 break-all">
          {row.email || "—"}
        </span>
      ),
    },
    {
      key: "success",
      header: t("admin.security.events.status") || "Status",
      render: (row) => (
        <StatusBadge
          type="user_status"
          value={row.success ? "active" : "inactive"}
          label={
            row.success
              ? t("admin.security.events.success") || "Success"
              : t("admin.security.events.failed") || "Failed"
          }
        />
      ),
    },
    {
      key: "reason",
      header: t("admin.security.events.reason") || "Reason",
      render: (row) => (
        <span className="text-xs font-medium text-slate-700">
          {row.reason || "—"}
        </span>
      ),
    },
    {
      key: "ip_address",
      header: t("admin.security.events.ip") || "IP Address",
      render: (row) => (
        <span className="font-mono text-xs text-slate-600">
          {row.ip_address || "—"}
        </span>
      ),
    },
    {
      key: "created_at",
      header: t("admin.security.events.date") || "Date",
      render: (row) => (
        <span className="text-xs text-slate-500">
          {formatDate(row.created_at, lang) || "—"}
        </span>
      ),
    },
  ];

  const sessionColumns = [
    {
      key: "user",
      header: t("admin.security.sessions.user") || "User",
      render: (row) => (
        <div className="min-w-0">
          <p className="text-xs font-bold text-slate-900 truncate">
            {row.user_name || row.full_name || "Unknown User"}
          </p>
          <p className="text-[11px] font-mono text-slate-500 break-all">
            {row.email || "—"}
          </p>
        </div>
      ),
    },
    {
      key: "ip",
      header: t("admin.security.sessions.ip") || "IP Address",
      render: (row) => (
        <span className="font-mono text-xs text-slate-700">
          {row.ip || row.ip_address || "—"}
        </span>
      ),
    },
    {
      key: "user_agent",
      header: t("admin.security.sessions.userAgent") || "Device / Browser",
      render: (row) => (
        <span
          className="text-xs text-slate-600 line-clamp-1 max-w-[220px]"
          title={row.user_agent || ""}
        >
          {row.user_agent || "—"}
        </span>
      ),
    },
    {
      key: "created_at",
      header: t("admin.security.sessions.createdAt") || "Started",
      render: (row) => (
        <span className="text-xs text-slate-500">
          {formatDate(row.created_at, lang) || "—"}
        </span>
      ),
    },
    {
      key: "expires_at",
      header: t("admin.security.sessions.expiresAt") || "Expires",
      render: (row) => (
        <span className="text-xs text-slate-500">
          {formatDate(row.expires_at, lang) || "—"}
        </span>
      ),
    },
    {
      key: "actions",
      header: t("admin.security.sessions.actions") || "Action",
      align: "right",
      render: (row) => (
        <Button
          type="button"
          variant="danger"
          size="sm"
          icon={LogOut}
          onClick={() => setSessionToRevoke(row)}
        >
          {t("admin.security.sessions.forceLogout") || "Force logout"}
        </Button>
      ),
    },
  ];

  const lockedColumns = [
    {
      key: "user",
      header: t("admin.security.locked.user") || "Account",
      render: (row) => (
        <div className="min-w-0">
          <p className="text-xs font-bold text-slate-900 truncate">
            {row.full_name || "—"}
          </p>
          <p className="text-[11px] font-mono text-slate-500 break-all">
            {row.email || "—"}
          </p>
        </div>
      ),
    },
    {
      key: "failed_login_count",
      header: t("admin.security.locked.failedCount") || "Failed Attempts",
      render: (row) => (
        <StatusBadge
          type="user_status"
          value="inactive"
          label={`${
            row.failed_login_count ?? row.failed_login_attempts ?? 5
          } attempts`}
        />
      ),
    },
    {
      key: "locked_until",
      header: t("admin.security.locked.lockedUntil") || "Locked Until",
      render: (row) => (
        <span className="text-xs font-medium text-red-700">
          {formatDate(row.locked_until, lang) || "—"}
        </span>
      ),
    },
    {
      key: "actions",
      header: t("admin.security.locked.actions") || "Action",
      align: "right",
      render: (row) => (
        <Button
          type="button"
          variant="primary"
          size="sm"
          icon={Unlock}
          loading={unlockingUserId === row.id}
          disabled={unlockingUserId === row.id}
          onClick={() => handleUnlockAccount(row.id)}
        >
          {t("admin.security.locked.unlockBtn") || "Unlock"}
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
            {t("admin.security.pageTitle") || "Security & Access Control"}
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            {t("admin.security.pageSubtitle") ||
              "Monitor login attempts, active sessions, and locked user accounts."}
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          icon={RefreshCw}
          onClick={handleRefreshAll}
        >
          {t("admin.common.retry") || "Refresh"}
        </Button>
      </div>

      {/* 1. 3 Summary Cards from GET /api/admin/security/summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-red-50 border border-red-200/70 text-[#dc2626] flex items-center justify-center shrink-0">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
              {t("admin.security.summary.failedLoginsToday") ||
                "Failed Logins Today"}
            </p>
            <p className="text-2xl font-black text-slate-900 mt-0.5">
              {loadingSummary ? "—" : summary.failed_logins_today}
            </p>
          </div>
        </Card>

        <Card className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200/70 text-[#166534] flex items-center justify-center shrink-0">
            <Laptop className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
              {t("admin.security.summary.activeSessions") || "Active Sessions"}
            </p>
            <p className="text-2xl font-black text-slate-900 mt-0.5">
              {loadingSummary ? "—" : summary.active_sessions}
            </p>
          </div>
        </Card>

        <Card className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200/70 text-amber-700 flex items-center justify-center shrink-0">
            <Lock className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
              {t("admin.security.summary.lockedAccounts") || "Locked Accounts"}
            </p>
            <p className="text-2xl font-black text-slate-900 mt-0.5">
              {loadingSummary ? "—" : summary.locked_accounts}
            </p>
          </div>
        </Card>
      </div>

      {/* 2. Login Events Table with Filters & Pagination */}
      <section className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-[#166534] shrink-0" />
            <h3 className="text-lg font-extrabold text-slate-900">
              {t("admin.security.events.title") || "Login Events"}
            </h3>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-60">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={emailFilter}
                onChange={(e) => {
                  setEmailFilter(e.target.value);
                  setEventsPage(1);
                }}
                placeholder={
                  t("admin.security.events.searchEmail") ||
                  "Filter by email..."
                }
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#166534]/20 focus:border-[#166534]"
              />
            </div>

            <select
              value={successFilter}
              onChange={(e) => {
                setSuccessFilter(e.target.value);
                setEventsPage(1);
              }}
              aria-label={
                t("admin.security.events.filterStatus") || "Filter by status"
              }
              className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#166534]/20 focus:border-[#166534]"
            >
              <option value="all">
                {t("admin.security.events.filterAll") || "All Attempts"}
              </option>
              <option value="true">
                {t("admin.security.events.success") || "Success"}
              </option>
              <option value="false">
                {t("admin.security.events.failed") || "Failed"}
              </option>
            </select>
          </div>
        </div>

        <DataTable
          columns={loginEventColumns}
          data={events}
          rowKey="id"
          loading={loadingEvents}
          skeletonRows={5}
          emptyIcon={Activity}
          emptyTitle={
            t("admin.security.events.emptyTitle") || "No login events found"
          }
          emptySubtitle={
            t("admin.security.events.emptySubtitle") ||
            "Try adjusting your email or status filters."
          }
          page={eventsPage}
          pages={eventsPages}
          total={eventsTotal}
          onPageChange={setEventsPage}
          pageLabel={t("admin.common.page")}
          prevLabel={t("admin.common.prev")}
          nextLabel={t("admin.common.next")}
          totalLabel={t("admin.common.total")}
        />
      </section>

      {/* 3. Active Sessions Table */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Laptop className="w-5 h-5 text-[#166534] shrink-0" />
          <h3 className="text-lg font-extrabold text-slate-900">
            {t("admin.security.sessions.title") || "Active Sessions"}
          </h3>
        </div>
        <DataTable
          columns={sessionColumns}
          data={sessions}
          rowKey={(row) => row.session_id || row.id}
          loading={loadingSessions}
          skeletonRows={3}
          emptyIcon={Laptop}
          emptyTitle={
            t("admin.security.sessions.emptyTitle") || "No active sessions"
          }
          emptySubtitle={
            t("admin.security.sessions.emptySubtitle") ||
            "Active user sessions will appear here."
          }
        />
      </section>

      {/* 4. Locked Accounts List */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-amber-700 shrink-0" />
          <h3 className="text-lg font-extrabold text-slate-900">
            {t("admin.security.locked.title") || "Locked Accounts"}
          </h3>
        </div>
        <DataTable
          columns={lockedColumns}
          data={lockedAccounts}
          rowKey="id"
          loading={loadingLocked}
          skeletonRows={2}
          emptyIcon={ShieldCheck}
          emptyTitle={
            t("admin.security.locked.emptyTitle") || "No locked accounts"
          }
          emptySubtitle={
            t("admin.security.locked.emptySubtitle") ||
            "No user accounts are currently locked due to failed login attempts."
          }
        />
      </section>

      {/* Admin Password Change Form */}
      <Card className="space-y-5">
        <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-[#166534] flex items-center justify-center shrink-0 font-bold">
            <KeyRound className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-slate-900">
              {t("admin.security.passwordForm.title") ||
                "Change Admin Password"}
            </h3>
            <p className="text-xs text-slate-500">
              {t("admin.security.passwordForm.subtitle") ||
                "Update your administrative login credentials."}
            </p>
          </div>
        </div>

        <form onSubmit={handlePasswordSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Input
                label={
                  t("admin.security.passwordForm.newPassword") || "New Password"
                }
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder={
                  t("auth.register.passwordPlaceholder") ||
                  "At least 8 characters"
                }
                required
              />
            </div>

            <div>
              <Input
                label={
                  t("admin.security.passwordForm.confirmPassword") ||
                  "Confirm New Password"
                }
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat new password"
                required
              />
            </div>
          </div>

          <PasswordStrength
            password={newPassword}
            email={currentUser?.email}
          />

          <div className="pt-1">
            <Button
              type="submit"
              variant="primary"
              size="md"
              icon={KeyRound}
              loading={savingPassword}
              disabled={savingPassword || !newPassword || !confirmPassword}
            >
              {savingPassword
                ? t("admin.common.saving")
                : t("admin.security.passwordForm.submitBtn") ||
                  "Update Password"}
            </Button>
          </div>
        </form>
      </Card>

      {/* Confirm Force Logout Dialog */}
      <ConfirmDialog
        open={Boolean(sessionToRevoke)}
        onClose={() => setSessionToRevoke(null)}
        onConfirm={handleConfirmForceLogout}
        title={
          t("admin.security.sessions.confirmTitle") || "Force Logout Session"
        }
        description={
          t("admin.security.sessions.confirmDesc") ||
          "Are you sure you want to revoke this session and force the user to sign in again?"
        }
        confirmLabel={
          t("admin.security.sessions.forceLogout") || "Force logout"
        }
        cancelLabel={t("admin.common.cancel") || "Cancel"}
        variant="danger"
        loading={revokingSession}
      />
    </div>
  );
}
