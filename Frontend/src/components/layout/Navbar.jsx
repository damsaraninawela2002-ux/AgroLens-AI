import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Globe, LogOut, LayoutDashboard, Menu, X, ArrowRight } from "lucide-react";
import Logo from "../ui/Logo";
import Button from "../ui/Button";
import { useLanguage } from "../../context/LanguageContext";
import { useAuth } from "../../context/AuthContext";
import { ROLE_REDIRECTS } from "../../utils/constants";

export default function Navbar() {
  const { lang, toggleLanguage, t } = useLanguage();
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const dashboardPath = user ? ROLE_REDIRECTS[user.role] || "/farmer/dashboard" : "/login";

  const handleLogout = () => {
    logout();
    setMobileMenuOpen(false);
    navigate("/");
  };

  return (
    <header className="sticky top-0 z-50 w-full bg-[#f8faf5]/90 backdrop-blur-md border-b border-slate-200/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        {/* Brand Logo */}
        <Logo size="md" />

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-8" aria-label="Main Navigation">
          <a
            href="/#features"
            className="text-sm font-semibold text-slate-600 hover:text-[#166534] transition-colors"
          >
            {t("nav.features")}
          </a>
          <a
            href="/#how-it-works"
            className="text-sm font-semibold text-slate-600 hover:text-[#166534] transition-colors"
          >
            {t("nav.howItWorks")}
          </a>
          <a
            href="/#roles"
            className="text-sm font-semibold text-slate-600 hover:text-[#166534] transition-colors"
          >
            {t("nav.about")}
          </a>
        </nav>

        {/* Right Actions: Language Toggle + Auth Buttons */}
        <div className="hidden md:flex items-center gap-3">
          <button
            type="button"
            onClick={toggleLanguage}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold bg-white text-slate-700 border border-slate-200 hover:border-[#166534]/40 hover:text-[#166534] shadow-2xs transition-all cursor-pointer"
            aria-label="Toggle language between Sinhala and English"
          >
            <Globe className="w-3.5 h-3.5 text-[#15803d]" aria-hidden="true" />
            <span>{lang === "en" ? "සිංහල" : "English"}</span>
          </button>

          {isAuthenticated ? (
            <>
              <Link to={dashboardPath}>
                <Button variant="secondary" size="sm" icon={LayoutDashboard}>
                  {t("nav.dashboard")}
                </Button>
              </Link>
              <Button
                variant="outline"
                size="sm"
                icon={LogOut}
                onClick={handleLogout}
              >
                {t("nav.logout")}
              </Button>
            </>
          ) : (
            <>
              <Link
                to="/login"
                className="px-4 py-2 text-sm font-semibold text-slate-700 hover:text-[#166534] transition-colors"
              >
                {t("nav.login")}
              </Link>
              <Link to="/register">
                <Button
                  variant="primary"
                  size="sm"
                  icon={ArrowRight}
                  iconPosition="right"
                >
                  {t("nav.getStarted")}
                </Button>
              </Link>
            </>
          )}
        </div>

        {/* Mobile Controls */}
        <div className="flex items-center gap-2 md:hidden">
          <button
            type="button"
            onClick={toggleLanguage}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-white text-slate-700 border border-slate-200"
            aria-label="Switch Language"
          >
            <Globe className="w-3.5 h-3.5 text-[#15803d]" />
            <span>{lang === "en" ? "සිංහල" : "EN"}</span>
          </button>

          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className="p-2 rounded-xl text-slate-700 hover:bg-slate-100 focus:outline-none"
            aria-label="Toggle Menu"
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? (
              <X className="w-6 h-6" />
            ) : (
              <Menu className="w-6 h-6" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile Dropdown Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white border-b border-slate-200 px-4 pt-3 pb-6 space-y-4 shadow-lg">
          <div className="flex flex-col space-y-2">
            <a
              href="/#features"
              onClick={() => setMobileMenuOpen(false)}
              className="px-3 py-2 rounded-lg text-sm font-semibold text-slate-700 hover:bg-emerald-50 hover:text-[#166534]"
            >
              {t("nav.features")}
            </a>
            <a
              href="/#how-it-works"
              onClick={() => setMobileMenuOpen(false)}
              className="px-3 py-2 rounded-lg text-sm font-semibold text-slate-700 hover:bg-emerald-50 hover:text-[#166534]"
            >
              {t("nav.howItWorks")}
            </a>
            <a
              href="/#roles"
              onClick={() => setMobileMenuOpen(false)}
              className="px-3 py-2 rounded-lg text-sm font-semibold text-slate-700 hover:bg-emerald-50 hover:text-[#166534]"
            >
              {t("nav.about")}
            </a>
          </div>

          <div className="pt-3 border-t border-slate-100 flex flex-col gap-2.5">
            {isAuthenticated ? (
              <>
                <Link
                  to={dashboardPath}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <Button variant="primary" fullWidth icon={LayoutDashboard}>
                    {t("nav.dashboard")}
                  </Button>
                </Link>
                <Button
                  variant="outline"
                  fullWidth
                  icon={LogOut}
                  onClick={handleLogout}
                >
                  {t("nav.logout")}
                </Button>
              </>
            ) : (
              <>
                <Link to="/login" onClick={() => setMobileMenuOpen(false)}>
                  <Button variant="outline" fullWidth>
                    {t("nav.login")}
                  </Button>
                </Link>
                <Link to="/register" onClick={() => setMobileMenuOpen(false)}>
                  <Button variant="primary" fullWidth>
                    {t("nav.getStarted")}
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
