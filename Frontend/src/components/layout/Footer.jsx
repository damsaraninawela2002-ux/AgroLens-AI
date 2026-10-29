import { Link } from "react-router-dom";
import { Sprout, ShieldCheck } from "lucide-react";
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
            <div className="inline-flex items-center gap-2 text-xs font-medium text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-3 py-1.5 rounded-full">
              <ShieldCheck className="w-4 h-4 text-[#84cc16]" />
              <span>MobileNetV2 + Grad-CAM Explainable AI</span>
            </div>
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

        {/* Bottom Copyright & GitHub Link */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <p>{t("footer.copyright")}</p>
          <a
            href="https://github.com/damsaraninawela2002-ux"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 transition-colors"
          >
            <svg
              viewBox="0 0 24 24"
              fill="currentColor"
              className="w-4 h-4 text-[#84cc16]"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
              />
            </svg>
            <span>github.com/damsaraninawela2002-ux</span>
          </a>
        </div>
      </div>
    </footer>
  );
}
