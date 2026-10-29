import { useState } from "react";
import { Flame, Info, SlidersHorizontal } from "lucide-react";
import Card from "../ui/Card";
import { useLanguage } from "../../context/LanguageContext";
import { getImageUrl } from "../../utils/formatters";

export default function ImageCompareViewer({
  imageUrl,
  originalUrl,
  heatmapUrl,
  className = "",
}) {
  const { t } = useLanguage();
  const [compareMode, setCompareMode] = useState("sideBySide");
  const [sliderPosition, setSliderPosition] = useState(50);
  const resolvedImageUrl = imageUrl || originalUrl;

  return (
    <Card className={`space-y-5 print-card ${className}`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <Flame className="w-5 h-5 text-[#dc2626]" />
          <h2 className="text-lg font-extrabold text-slate-900">
            {t("scanResult.visualComparisonTitle")}
          </h2>
        </div>

        {/* View Toggle Buttons */}
        <div className="no-print inline-flex rounded-xl bg-slate-100 p-1 text-xs font-bold">
          {[
            { id: "sideBySide", label: t("scanResult.viewSideBySide") },
            { id: "slider", label: t("scanResult.viewSlider") },
            { id: "heatmap", label: t("scanResult.viewHeatmapOnly") },
          ].map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setCompareMode(m.id)}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                compareMode === m.id
                  ? "bg-white text-[#166534] shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Mode 1: Side-by-Side (Stacked on Mobile) */}
      {compareMode === "sideBySide" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <p className="text-xs font-bold text-slate-600">
              {t("scanResult.originalImageLabel")}
            </p>
            <div className="rounded-2xl overflow-hidden border border-slate-200 bg-slate-950 aspect-square flex items-center justify-center">
              <img
                src={getImageUrl(resolvedImageUrl)}
                alt={t("scanResult.originalImageLabel")}
                className="w-full h-full object-cover"
              />
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-bold text-[#dc2626] flex items-center gap-1.5">
              <Flame className="w-3.5 h-3.5" />
              <span>{t("scanResult.heatmapImageLabel")}</span>
            </p>
            <div className="rounded-2xl overflow-hidden border border-slate-200 bg-slate-950 aspect-square flex items-center justify-center">
              <img
                src={getImageUrl(heatmapUrl)}
                alt={t("scanResult.heatmapImageLabel")}
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </div>
      )}

      {/* Mode 2: Interactive Split Slider */}
      {compareMode === "slider" && (
        <div className="space-y-3">
          <div className="relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-950 aspect-square max-h-[380px] mx-auto select-none">
            {/* Base Layer: Grad-CAM Heatmap */}
            <img
              src={getImageUrl(heatmapUrl)}
              alt={t("scanResult.heatmapImageLabel")}
              className="w-full h-full object-cover"
            />

            {/* Clipped Foreground Layer: Original Image */}
            <div
              className="absolute inset-0 overflow-hidden"
              style={{
                clipPath: `inset(0 ${100 - sliderPosition}% 0 0)`,
              }}
            >
              <img
                src={getImageUrl(resolvedImageUrl)}
                alt={t("scanResult.originalImageLabel")}
                className="w-full h-full object-cover"
              />
            </div>

            {/* Vertical Divider Handle */}
            <div
              className="absolute inset-y-0 w-0.5 bg-white shadow-[0_0_10px_rgba(0,0,0,0.6)] pointer-events-none"
              style={{ left: `${sliderPosition}%` }}
            >
              <div className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white text-[#166534] shadow-md flex items-center justify-center">
                <SlidersHorizontal className="w-4 h-4" />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 px-2">
            <span className="text-xs font-bold text-slate-600">
              {t("scanResult.originalImageLabel")}
            </span>
            <input
              type="range"
              min="0"
              max="100"
              value={sliderPosition}
              onChange={(e) => setSliderPosition(Number(e.target.value))}
              aria-label="Compare original leaf photo and Grad-CAM heatmap"
              className="flex-1 accent-[#166534] cursor-pointer"
            />
            <span className="text-xs font-bold text-[#dc2626]">
              {t("scanResult.heatmapImageLabel")}
            </span>
          </div>
        </div>
      )}

      {/* Mode 3: Heatmap Only */}
      {compareMode === "heatmap" && (
        <div className="rounded-2xl overflow-hidden border border-slate-200 bg-slate-950 aspect-square max-h-[380px] mx-auto flex items-center justify-center">
          <img
            src={getImageUrl(heatmapUrl)}
            alt={t("scanResult.heatmapImageLabel")}
            className="w-full h-full object-cover"
          />
        </div>
      )}

      {/* "What is this heatmap?" Explanation Box */}
      <div className="rounded-xl bg-[#f8faf5] border border-slate-200/80 p-4 flex items-start gap-3">
        <Info className="w-5 h-5 text-[#166534] shrink-0 mt-0.5" />
        <div className="space-y-1">
          <h4 className="text-xs sm:text-sm font-bold text-slate-900">
            {t("scanResult.whatIsHeatmapTitle")}
          </h4>
          <p className="text-xs text-slate-600 leading-relaxed">
            {t("scanResult.whatIsHeatmapDesc")}
          </p>
        </div>
      </div>
    </Card>
  );
}
