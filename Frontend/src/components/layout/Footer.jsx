import { Link } from "react-router-dom";
import { Sprout, Phone } from "lucide-react";
import Logo from "../ui/Logo";
import { useLanguage } from "../../context/LanguageContext";

export default function Footer() {
  const { t } = useLanguage();

  return (
    <footer className="bg-slate-950 text-slate-300 border-t border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10 pb-10 border-b border-slate-800/80">
          {/* Brand Column */}
          <div className="md:col-span-5 space-y-4">
            <Logo variant="light" size="md" />
            <p className="text-sm text-slate-400 max-w-md leading-relaxed">
              {t("footer.tagline")}
            </p>
            <a
              href="tel:1920"
              aria-label="Call Govi Sahana Sevaya 1920"
              className="btn-interactive inline-flex items-center gap-2 min-h-[48px] h-auto px-4 py-2.5 text-xs font-semibold leading-[1.7] whitespace-normal break-words text-emerald-400 hover:text-[#a3e635] bg-emerald-950/60 hover:bg-emerald-950 border border-emerald-800/60 rounded-full transition-colors"
            >
              <Phone className="w-5 h-5 text-[#84cc16] shrink-0" />
              <span>{t("footer.helplineBadge")}</span>
            </a>
          </div>

          {/* Navigation Column */}
          <div className="md:col-span-3 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-white">
              {t("footer.platformTitle")}
            </h3>
            <ul className="space-y-2.5 text-sm text-slate-400">
              <li>
                <a
                  href="/#features"
                  className="hover:text-[#a3e635] transition-colors"
                >
                  {t("nav.features")}
                </a>
              </li>
              <li>
                <a
                  href="/#how-it-works"
                  className="hover:text-[#a3e635] transition-colors"
                >
                  {t("nav.howItWorks")}
                </a>
              </li>
              <li>
                <Link
                  to="/about"
                  className="hover:text-[#a3e635] transition-colors"
                >
                  {t("nav.about")}
                </Link>
              </li>
              <li>
                <Link
                  to="/login"
                  className="hover:text-[#a3e635] transition-colors"
                >
                  {t("nav.login")}
                </Link>
              </li>
              <li>
                <Link
                  to="/register"
                  className="hover:text-[#a3e635] transition-colors"
                >
                  {t("nav.getStarted")}
                </Link>
              </li>
            </ul>
          </div>

          {/* Supported Crops Column */}
          <div className="md:col-span-4 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-white">
              {t("footer.cropsTitle")}
            </h3>
            <ul className="space-y-2.5 text-sm text-slate-400">
              <li className="flex items-center gap-2">
                <Sprout className="w-4 h-4 text-[#84cc16]" />
                <span>{t("footer.cropTomato")}</span>
              </li>
              <li className="flex items-center gap-2">
                <Sprout className="w-4 h-4 text-[#84cc16]" />
                <span>{t("footer.cropPotato")}</span>
              </li>
              <li className="flex items-center gap-2">
                <Sprout className="w-4 h-4 text-[#84cc16]" />
                <span>{t("footer.cropPepper")}</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Copyright */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <p>{t("footer.copyright")}</p>
        </div>
      </div>
    </footer>
  );
}
