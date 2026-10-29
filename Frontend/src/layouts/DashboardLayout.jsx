import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  Activity,
  Bot,
  Camera,
  CheckCircle2,
  ClipboardList,
  Cpu,
  Globe,
  History,
  LayoutDashboard,
  LogOut,
  MapPin,
  MapPinned,
  ScanLine,
  Shield,
  Stethoscope,
  User,
  UserCheck,
  Users,
} from "lucide-react";
import Logo from "../components/ui/Logo";
import Button from "../components/ui/Button";
import Badge from "../components/ui/Badge";
import ErrorBoundary from "../components/ui/ErrorBoundary";
import IdleWarningModal from "../components/ui/IdleWarningModal";
import NotificationBell from "../components/layout/NotificationBell";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import useIdleLogout from "../hooks/useIdleLogout";
import { getAdminAnalyticsOverview } from "../services/adminService";

export default function DashboardLayout() {
  const { user, logout } = useAuth();
  const { lang, toggleLanguage, t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();

  const role = user?.role || "farmer";
  const hasSidebar =
    role === "farmer" || role === "officer" || role === "admin";

  const [adminCounts, setAdminCounts] = useState({
    pendingApprovals: 0,
    unverifiedTreatments: 0,
  });

  useEffect(() => {
    if (role !== "admin") return;
    let active = true;

    const loadAdminBadgeCounts = () => {
      getAdminAnalyticsOverview()
        .then((data) => {
          if (active && data) {
            setAdminCounts({
              pendingApprovals: Number(data.pending_officer_approvals) || 0,
              unverifiedTreatments:
                Number(data.unverified_treatments_count) || 0,
            });
          }
        })
        .catch(() => {
          // Ignore silent badge polling errors
        });
    };

    loadAdminBadgeCounts();
    window.addEventListener(
      "agrolens:admin-counts-updated",
      loadAdminBadgeCounts
    );
    return () => {
      active = false;
      window.removeEventListener(
        "agrolens:admin-counts-updated",
        loadAdminBadgeCounts
      );
    };
  }, [role, location.pathname]);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const { showWarning, remainingSeconds, staySignedIn, logoutNow } =
    useIdleLogout({
      enabled: role === "admin",
      idleTimeoutMs: 30 * 60 * 1000,
      warningBeforeMs: 60 * 1000,
      onIdleLogout: handleLogout,
    });

  // Determine current page title from URL path
  const getPageTitle = () => {
    const path = location.pathname;
    if (path.startsWith("/farmer/scan/") && path.split("/").length > 3) {
      return t("scanResult.pageTitle");
    }
    if (path === "/farmer/scan") return t("newScan.pageTitle");
    if (path === "/farmer/history") return t("history.pageTitle");
    if (path === "/farmer/assistant" || path === "/officer/assistant") {
      return t("assistant.pageTitle") || t("sidebar.aiAssistant");
    }
    if (
      path === "/farmer/profile" ||
      path === "/officer/profile" ||
      path === "/admin/profile"
    ) {
      return t("profile.pageTitle");
    }
    if (path === "/officer/dashboard") return t("dashboard.officerTitle");
    if (path === "/officer/queue") return t("officer.queue.pageTitle");
    if (path.startsWith("/officer/review/"))
      return t("officer.review.pageTitle");
    if (path === "/officer/reviewed") return t("officer.reviewed.pageTitle");
    if (path === "/admin/dashboard") return t("admin.overview.pageTitle");
    if (path === "/admin/users") return t("admin.users.pageTitle");
    if (path === "/admin/approvals") return t("admin.approvals.pageTitle");
    if (path === "/admin/treatments") return t("admin.treatments.pageTitle");
    if (path === "/admin/diagnoses") return t("admin.diagnoses.pageTitle");
    if (path === "/admin/model") return t("admin.model.pageTitle");
    if (path === "/admin/audit-log") return t("admin.auditLog.pageTitle");
    if (path === "/admin/security")
      return t("admin.security.pageTitle") || "Security & Access Control";
    return t("dashboard.farmerTitle");
  };

  const farmerNavItems = [
    {
      to: "/farmer/dashboard",
      label: t("sidebar.dashboard"),
      icon: LayoutDashboard,
      disabled: false,
    },
    {
      to: "/farmer/scan",
      label: t("sidebar.newScan"),
      icon: Camera,
      disabled: false,
    },
    {
      to: "/farmer/history",
      label: t("sidebar.history"),
      icon: History,
      disabled: false,
    },
    {
      to: "/farmer/assistant",
      label: t("sidebar.aiAssistant"),
      icon: Bot,
      disabled: false,
    },
    {
      to: "/farmer/profile",
      label: t("sidebar.profile"),
      icon: User,
      disabled: false,
    },
  ];

  const officerNavItems = [
    {
      to: "/officer/dashboard",
      label: t("sidebar.dashboard"),
      icon: LayoutDashboard,
      disabled: false,
    },
    {
      to: "/officer/queue",
      label: t("sidebar.reviewQueue"),
      icon: ClipboardList,
      disabled: false,
    },
    {
      to: "/officer/reviewed",
      label: t("sidebar.reviewed"),
      icon: CheckCircle2,
      disabled: false,
    },
    {
      to: "/officer/assistant",
      label: t("sidebar.aiAssistant"),
      icon: Bot,
      disabled: false,
    },
    {
      to: "#outbreak-map",
      label: t("sidebar.outbreakMap"),
      icon: MapPinned,
      disabled: true,
      badge: t("sidebar.comingSoon"),
    },
    {
      to: "/officer/profile",
      label: t("sidebar.profile"),
      icon: User,
      disabled: false,
    },
  ];

  const adminNavItems = [
    {
      to: "/admin/dashboard",
      label: t("sidebar.overview"),
      icon: LayoutDashboard,
      disabled: false,
    },
    {
      to: "/admin/users",
      label: t("sidebar.users"),
      icon: Users,
      disabled: false,
    },
    {
      to: "/admin/approvals",
      label: t("sidebar.officerApprovals"),
      icon: UserCheck,
      disabled: false,
      countBadge: adminCounts.pendingApprovals,
      badgeVariant: "warning",
    },
    {
      to: "/admin/treatments",
      label: t("sidebar.treatments"),
      icon: Stethoscope,
      disabled: false,
      countBadge: adminCounts.unverifiedTreatments,
      badgeVariant: "warning",
    },
    {
      to: "/admin/diagnoses",
      label: t("sidebar.diagnoses"),
      icon: ScanLine,
      disabled: false,
    },
    {
      to: "/admin/model",
      label: t("sidebar.modelPerformance"),
      icon: Cpu,
      disabled: false,
    },
    {
      to: "/admin/audit-log",
      label: t("sidebar.auditLog"),
      icon: Activity,
      disabled: false,
    },
    {
      to: "/admin/security",
      label: t("sidebar.security") || "Security",
      icon: Shield,
      disabled: false,
    },
    {
      to: "/admin/profile",
      label: t("sidebar.profile"),
      icon: User,
      disabled: false,
    },
  ];

  const navItems =
    role === "admin"
      ? adminNavItems
      : role === "officer"
      ? officerNavItems
      : farmerNavItems;
  const mobileNavItems = navItems.filter((item) => !item.disabled);
  const homePath =
    role === "officer"
      ? "/officer/dashboard"
      : role === "farmer"
      ? "/farmer/dashboard"
      : "/admin/dashboard";
  const portalLabel =
    role === "admin"
      ? t("sidebar.adminPortal")
      : role === "officer"
      ? t("sidebar.officerPortal")
      : t("sidebar.farmerPortal");

  return (
    <div className="min-h-screen flex bg-[#f8faf5] text-slate-900">
      {/* ================= DESKTOP LEFT SIDEBAR ================= */}
      {hasSidebar && (
        <aside className="no-print hidden lg:flex lg:flex-col lg:w-68 lg:fixed lg:inset-y-0 bg-white border-r border-slate-200/80 z-40">
          {/* Sidebar Brand Header */}
          <div className="h-20 px-6 flex items-center border-b border-slate-100">
            <Logo size="md" to={homePath} />
          </div>

          {/* Navigation Links */}
          <nav
            className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto"
            aria-label="Sidebar Navigation"
          >
            <p className="px-3 pb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
              {portalLabel}
            </p>

            {navItems.map((item) => {
              const Icon = item.icon;

              if (item.disabled) {
                return (
                  <div
                    key={item.label}
                    title={`${item.label} (${item.badge})`}
                    className="flex items-center justify-between px-3.5 py-3 rounded-xl text-sm font-semibold text-slate-400 bg-slate-50/60 cursor-not-allowed select-none"
                  >
                    <span className="flex items-center gap-3">
                      <Icon className="w-5 h-5 text-slate-400" />
                      <span>{item.label}</span>
                    </span>
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-100 text-amber-800">
                      {item.badge}
                    </span>
                  </div>
                );
              }

              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === homePath}
                  className={({ isActive }) =>
                    `flex items-center justify-between gap-2 px-3.5 py-3 rounded-xl text-sm font-semibold transition-all ${
                      isActive
                        ? "bg-[#166534] text-white shadow-sm shadow-[#166534]/20"
                        : "text-slate-600 hover:bg-emerald-50/70 hover:text-[#166534]"
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <span className="flex items-center gap-3 min-w-0">
                        <Icon className="w-5 h-5 shrink-0" />
                        <span className="truncate">{item.label}</span>
                      </span>
                      {item.countBadge > 0 && (
                        <span
                          className={`px-2 py-0.5 text-[11px] font-extrabold rounded-full shrink-0 ${
                            isActive
                              ? "bg-[#a3e635] text-[#052e16]"
                              : "bg-amber-100 text-amber-800 border border-amber-200"
                          }`}
                        >
                          {item.countBadge}
                        </span>
                      )}
                    </>
                  )}
                </NavLink>
              );
            })}
          </nav>

          {/* Bottom User Card inside Sidebar */}
          {user && (
            <div className="p-4 border-t border-slate-100 bg-[#f8faf5]/60">
              <div className="p-3.5 rounded-2xl bg-white border border-slate-200/80 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-100 text-[#166534] flex items-center justify-center font-extrabold text-sm shrink-0">
                    {user.full_name?.charAt(0)?.toUpperCase() || "U"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-slate-900 truncate">
                      {user.full_name}
                    </p>
                    <p className="text-[11px] text-slate-500 truncate">
                      {user.district}
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  fullWidth
                  icon={LogOut}
                  onClick={handleLogout}
                >
                  {t("nav.logout")}
                </Button>
              </div>
            </div>
          )}
        </aside>
      )}

      {/* ================= MAIN CONTENT WRAPPER ================= */}
      <div
        className={`flex-1 flex flex-col min-w-0 ${
          hasSidebar ? "lg:pl-68" : ""
        }`}
      >
        {/* Top Bar */}
        <header className="no-print sticky top-0 z-30 h-16 sm:h-20 bg-white/90 backdrop-blur-md border-b border-slate-200/80 px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="lg:hidden">
              <Logo size="sm" to={homePath} />
            </div>
            <h1 className="hidden sm:block text-lg sm:text-xl font-extrabold text-slate-900 truncate">
              {getPageTitle()}
            </h1>
          </div>

          {/* Right Controls: Role/District Badges + Notification Bell + Language Toggle + User Menu */}
          <div className="flex items-center gap-2 sm:gap-3">
            {user && (
              <div className="hidden md:flex items-center gap-2">
                <Badge variant="success" icon={Shield}>
                  {user.role.toUpperCase()}
                </Badge>
                {user.district && (
                  <Badge variant="neutral" icon={MapPin}>
                    {user.district}
                  </Badge>
                )}
              </div>
            )}

            {/* Notification Bell for all authenticated roles */}
            <NotificationBell />

            <button
              type="button"
              onClick={toggleLanguage}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-[#f8faf5] hover:bg-emerald-50 text-slate-700 hover:text-[#166534] border border-slate-200 transition-colors cursor-pointer"
              aria-label="Toggle language between Sinhala and English"
            >
              <Globe className="w-3.5 h-3.5 text-[#15803d]" />
              <span>{lang === "en" ? "සිංහල" : "English"}</span>
            </button>

            {user && (
              <div className="hidden sm:flex items-center gap-2.5 pl-2 border-l border-slate-200">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 text-[#166534] flex items-center justify-center font-bold text-xs">
                  {user.full_name?.charAt(0)?.toUpperCase() || "U"}
                </div>
                <div className="hidden xl:block text-xs leading-tight max-w-[150px]">
                  <p className="font-bold text-slate-800 truncate">
                    {user.full_name}
                  </p>
                  <p className="text-slate-500 truncate">{user.email}</p>
                </div>
              </div>
            )}

            <Button
              variant="outline"
              size="sm"
              icon={LogOut}
              onClick={handleLogout}
              className="lg:hidden"
              aria-label={t("nav.logout")}
            >
              <span className="hidden sm:inline">{t("nav.logout")}</span>
            </Button>
          </div>
        </header>

        {/* Page Body */}
        <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 pb-24 lg:pb-10">
          <ErrorBoundary key={location.pathname}>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>

      {/* ================= MOBILE BOTTOM NAVIGATION ================= */}
      {hasSidebar && (
        <nav
          aria-label="Mobile Bottom Navigation"
          className="no-print lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 px-2 py-1.5 shadow-lg overflow-x-auto"
        >
          <div className="flex items-center justify-around gap-1 min-w-max mx-auto">
            {mobileNavItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === homePath}
                  className={({ isActive }) =>
                    `relative flex flex-col items-center justify-center py-1.5 px-3 rounded-xl text-[11px] font-bold transition-colors ${
                      isActive
                        ? "text-[#166534] bg-emerald-50"
                        : "text-slate-500 hover:text-slate-800"
                    }`
                  }
                >
                  <Icon className="w-5 h-5 mb-0.5" />
                  <span className="truncate max-w-[78px]">{item.label}</span>
                  {item.countBadge > 0 && (
                    <span className="absolute top-1 right-1.5 w-2 h-2 rounded-full bg-amber-500" />
                  )}
                </NavLink>
              );
            })}
          </div>
        </nav>
      )}

      <IdleWarningModal
        isOpen={role === "admin" && showWarning}
        remainingSeconds={remainingSeconds}
        onStaySignedIn={staySignedIn}
        onLogout={logoutNow}
      />
    </div>
  );
}
