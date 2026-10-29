import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Leaf } from "lucide-react";
import Button from "../components/ui/Button";
import { useLanguage } from "../context/LanguageContext";

export default function NotFound() {
  const { t } = useLanguage();

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-16 bg-[#f8faf5]">
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="max-w-md w-full text-center bg-white rounded-2xl border border-slate-200/80 shadow-sm p-8 sm:p-10"
      >
        <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-emerald-50 border border-emerald-200/80 flex items-center justify-center text-[#166534]">
          <Leaf className="w-8 h-8" />
        </div>

        <p className="text-5xl font-extrabold tracking-tight text-[#166534]">
          {t("notFound.code")}
        </p>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">
          {t("notFound.title")}
        </h1>
        <p className="mt-2 text-sm text-slate-600 leading-relaxed">
          {t("notFound.subtitle")}
        </p>

        <div className="mt-7">
          <Link to="/">
            <Button variant="primary" icon={ArrowLeft}>
              {t("notFound.backHome")}
            </Button>
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
