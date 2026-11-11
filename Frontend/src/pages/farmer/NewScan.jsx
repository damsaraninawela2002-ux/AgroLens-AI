import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import {
  AlertCircle,
  Camera,
  CheckCircle2,
  Focus,
  ImagePlus,
  Leaf,
  RefreshCw,
  Sparkles,
  Sun,
  Trash2,
  UploadCloud,
} from "lucide-react";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Spinner from "../../components/ui/Spinner";
import FadeIn from "../../components/common/FadeIn";
import { useLanguage } from "../../context/LanguageContext";
import {
  recordBrowserScan,
  uploadLeafForPrediction,
} from "../../services/predictService";
import { extractErrorMessage } from "../../utils/formatters";

const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/jpg", "image/png"];
const ALLOWED_EXT_REGEX = /\.(jpe?g|png)$/i;

const INFERENCE_MODE = (
  import.meta.env.VITE_INFERENCE_MODE || "browser"
).toLowerCase();

const CROP_OPTIONS = [
  { id: "tomato", icon: "/icons/crops/tomato.svg", labelKey: "newScan.crops.tomato", fallback: "Tomato (තක්කාලි)" },
  { id: "potato", icon: "/icons/crops/potato.svg", labelKey: "newScan.crops.potato", fallback: "Potato (අල)" },
  { id: "pepper", icon: "/icons/crops/pepper.svg", labelKey: "newScan.crops.pepper", fallback: "Bell Pepper (මාළු මිරිස්)" },
];

export default function NewScan() {
  const { t } = useLanguage();
  const navigate = useNavigate();

  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  const [selectedCrop, setSelectedCrop] = useState("");
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const [validationError, setValidationError] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [progressStep, setProgressStep] = useState(0);
  const [isFirstTimeAiLoad, setIsFirstTimeAiLoad] = useState(false);
  const [aiLoadPercent, setAiLoadPercent] = useState(0);

  // Clean up object URL on unmount or change
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  // Animate progress steps in server mode
  useEffect(() => {
    if (!analyzing || INFERENCE_MODE !== "server") {
      return;
    }

    const timer1 = setTimeout(() => setProgressStep(1), 900);
    const timer2 = setTimeout(() => setProgressStep(2), 2100);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [analyzing]);

  const validateAndSelectFile = (selected) => {
    if (!selected) return;
    setValidationError("");

    const isAllowedType =
      ALLOWED_MIME_TYPES.includes((selected.type || "").toLowerCase()) ||
      ALLOWED_EXT_REGEX.test(selected.name || "");

    if (!isAllowedType) {
      const msg = t("newScan.errors.invalidType");
      setValidationError(msg);
      toast.error(msg);
      return;
    }

    if (selected.size > MAX_SIZE_BYTES) {
      const msg = t("newScan.errors.tooLarge");
      setValidationError(msg);
      toast.error(msg);
      return;
    }

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    setFile(selected);
    setPreviewUrl(URL.createObjectURL(selected));
  };

  const handleFileInputChange = (e) => {
    const selected = e.target.files?.[0];
    if (selected) {
      validateAndSelectFile(selected);
    }
    e.target.value = "";
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!analyzing) setDragActive(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (analyzing) return;

    const dropped = e.dataTransfer?.files?.[0];
    if (dropped) {
      validateAndSelectFile(dropped);
    }
  };

  const handleRemoveFile = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(null);
    setPreviewUrl("");
    setValidationError("");
  };

  const navigateToResult = (result) => {
    toast.success(t("newScan.successToast"));
    const diagnosisId = result?.diagnosis?.id;
    if (diagnosisId) {
      navigate(`/farmer/scan/${diagnosisId}`, {
        state: { initialData: result },
      });
    } else {
      navigate("/farmer/history");
    }
  };

  const handleAnalyze = async () => {
    if (!selectedCrop) {
      setValidationError(t("newScan.errors.noCrop"));
      return;
    }
    if (!file) {
      setValidationError(t("newScan.errors.noFile"));
      return;
    }

    setValidationError("");
    setProgressStep(0);
    setAiLoadPercent(0);
    setAnalyzing(true);

    try {
      if (INFERENCE_MODE === "server") {
        const result = await uploadLeafForPrediction(file, selectedCrop);
        navigateToResult(result);
        return;
      }

      // Browser inference mode (lazy-load TensorFlow.js modules only on New Scan)
      const [
        { isModelCached },
        { compressImageForScan },
        { predictLeafInBrowser },
        { generateGradCamInBrowser },
      ] = await Promise.all([
        import("../../ml/modelLoader"),
        import("../../ml/preprocess"),
        import("../../ml/predict"),
        import("../../ml/gradcam"),
      ]);

      const firstVisit = !isModelCached();
      setIsFirstTimeAiLoad(firstVisit);

      // 1. Resize/compress photo in browser (longest side 1024px, JPEG ~0.8)
      const compressed = await compressImageForScan(file, 1024, 0.8);

      // 2. Load model (cached in IndexedDB) and run prediction
      const prediction = await predictLeafInBrowser(
        compressed.imageElement,
        selectedCrop,
        {
          onModelProgress: ({ isFirstLoad, fraction }) => {
            setIsFirstTimeAiLoad(Boolean(isFirstLoad));
            setAiLoadPercent(Math.round((fraction || 0) * 100));
            if ((fraction || 0) >= 1) {
              setProgressStep(1);
            }
          },
        }
      );

      setProgressStep(2);

      // 3. Generate Grad-CAM heatmap overlay in the browser
      const gradcam = await generateGradCamInBrowser(
        compressed.imageElement,
        prediction.predictedIndex
      );

      // 4. Save scan & Grad-CAM on backend without running server-side TensorFlow
      const result = await recordBrowserScan({
        file: compressed.file,
        heatmap: gradcam.file,
        crop: selectedCrop,
        className: prediction.className,
        confidence: prediction.confidence,
        top3: prediction.top3,
        cropMatchScore: prediction.cropMatchScore,
      });

      navigateToResult(result);
    } catch (err) {
      const msg = extractErrorMessage(err, t("newScan.errors.uploadFailed"));
      setValidationError(msg);
      toast.error(msg);
    } finally {
      setAnalyzing(false);
      setProgressStep(0);
      setIsFirstTimeAiLoad(false);
      setAiLoadPercent(0);
    }
  };

  const tips = [
    {
      icon: Leaf,
      title: t("newScan.tips.tip1Title"),
      desc: t("newScan.tips.tip1Desc"),
    },
    {
      icon: Sun,
      title: t("newScan.tips.tip2Title"),
      desc: t("newScan.tips.tip2Desc"),
    },
    {
      icon: Sparkles,
      title: t("newScan.tips.tip3Title"),
      desc: t("newScan.tips.tip3Desc"),
    },
    {
      icon: Focus,
      title: t("newScan.tips.tip4Title"),
      desc: t("newScan.tips.tip4Desc"),
    },
  ];

  const steps =
    INFERENCE_MODE === "server"
      ? [
          t("newScan.progress.step1"),
          t("newScan.progress.step2"),
          t("newScan.progress.step3"),
        ]
      : [
          isFirstTimeAiLoad
            ? t("newScan.progress.preparingAiFirstTime")
            : t("newScan.progress.checkingLeaf"),
          t("newScan.progress.checkingLeaf"),
          t("newScan.progress.step3"),
        ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
          {t("newScan.pageTitle")}
        </h2>
        <p className="text-sm text-slate-600 mt-1">
          {t("newScan.pageSubtitle")}
        </p>
      </div>

      {/* Hidden File & Mobile Camera Inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".jpg,.jpeg,.png,image/jpeg,image/png"
        onChange={handleFileInputChange}
        className="hidden"
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileInputChange}
        className="hidden"
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Upload & Preview Area */}
        <Card className="lg:col-span-7 space-y-5">
          {validationError && (
            <div
              role="alert"
              className="rounded-xl bg-red-50 border border-red-200 p-3.5 flex items-start gap-2.5 text-xs font-semibold text-[#dc2626]"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{validationError}</span>
            </div>
          )}

          {/* Required Crop Selector (3 Large Cards) */}
          <div className="space-y-2.5">
            <label className="flex items-center gap-2 text-sm font-extrabold text-slate-900">
              <Camera className="w-6 h-6 text-[#166534] shrink-0" />
              <span>{t("newScan.selectCropLabel")}</span>
            </label>
            <div
              role="radiogroup"
              aria-label={t("newScan.selectCropLabel")}
              className="grid grid-cols-1 sm:grid-cols-3 gap-3"
            >
              {CROP_OPTIONS.map((cropOpt, idx) => {
                const isSelected = selectedCrop === cropOpt.id;
                return (
                  <FadeIn key={cropOpt.id} delay={idx * 80} className="h-full">
                    <button
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      disabled={analyzing}
                      onClick={() => {
                        setSelectedCrop(cropOpt.id);
                        if (validationError) setValidationError("");
                      }}
                      className={`btn-interactive relative w-full h-full min-h-[48px] flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border-2 text-center leading-[1.7] whitespace-normal break-words transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${
                        isSelected
                          ? "border-[#166534] bg-emerald-50/90 text-[#166534] shadow-sm shadow-[#166534]/15"
                          : "border-slate-200 hover:border-emerald-300 bg-[#f8faf5] text-slate-800"
                      }`}
                    >
                      <img
                        src={cropOpt.icon}
                        alt={t(cropOpt.labelKey) || cropOpt.fallback}
                        width={40}
                        height={40}
                        className="w-10 h-10 object-contain"
                      />
                      <span className="text-xs sm:text-sm font-extrabold leading-snug">
                        {t(cropOpt.labelKey) || cropOpt.fallback}
                      </span>
                      {isSelected && (
                        <CheckCircle2 className="w-5 h-5 text-[#166534] absolute top-2.5 right-2.5" />
                      )}
                    </button>
                  </FadeIn>
                );
              })}
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              {t("newScan.supportedCropsHint")}
            </p>
          </div>

          <div className="border-t border-slate-100 pt-4 space-y-2.5">
            <label className="flex items-center gap-2 text-sm font-extrabold text-slate-900">
              <ImagePlus className="w-6 h-6 text-[#166534] shrink-0" />
              <span>{t("newScan.uploadStepLabel")}</span>
            </label>
          </div>

          {!file ? (
            /* Drag-and-Drop Zone */
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`rounded-2xl border-2 border-dashed p-6 sm:p-10 text-center transition-all cursor-pointer ${
                dragActive
                  ? "border-[#166534] bg-emerald-50/70"
                  : "border-slate-300 hover:border-emerald-400 bg-[#f8faf5]/60 hover:bg-emerald-50/30"
              }`}
            >
              <div className="w-16 h-16 rounded-2xl bg-emerald-100 text-[#166534] flex items-center justify-center mx-auto mb-4 shadow-xs">
                <UploadCloud className="w-8 h-8" />
              </div>

              <h3 className="text-base sm:text-lg font-extrabold text-slate-900">
                {t("newScan.dropzoneTitle")}
              </h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                {t("newScan.dropzoneSubtitle")}
              </p>

              <div
                className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3"
                onClick={(e) => e.stopPropagation()}
              >
                <Button
                  type="button"
                  variant="primary"
                  size="md"
                  icon={ImagePlus}
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full sm:w-auto"
                >
                  {t("newScan.choosePhotoBtn")}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  icon={Camera}
                  onClick={() => cameraInputRef.current?.click()}
                  className="w-full sm:w-auto"
                >
                  {t("newScan.takePhotoBtn")}
                </Button>
              </div>
            </div>
          ) : (
            /* Selected Image Preview */
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    {t("newScan.previewTitle")}
                  </h3>
                  <p className="text-xs text-slate-500 truncate max-w-xs sm:max-w-md">
                    {file.name} • {t("newScan.fileSizeLabel")}:{" "}
                    {(file.size / (1024 * 1024)).toFixed(2)} MB
                  </p>
                </div>

                {!analyzing && (
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      icon={RefreshCw}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {t("newScan.replacePhotoBtn")}
                    </Button>
                    <Button
                      type="button"
                      variant="danger"
                      size="sm"
                      icon={Trash2}
                      onClick={handleRemoveFile}
                    >
                      {t("newScan.removePhotoBtn")}
                    </Button>
                  </div>
                )}
              </div>

              <div className="relative rounded-2xl overflow-hidden bg-slate-950 border border-slate-200 aspect-4/3 max-h-96 flex items-center justify-center">
                <img
                  src={previewUrl}
                  alt="Selected crop leaf"
                  width={400}
                  height={300}
                  className="w-full h-full object-contain"
                />

                {analyzing && (
                  <motion.div
                    initial={{ top: "0%" }}
                    animate={{ top: ["0%", "95%", "0%"] }}
                    transition={{
                      duration: 2.2,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                    className="pointer-events-none absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-[#84cc16] to-transparent shadow-[0_0_20px_#84cc16]"
                  />
                )}
              </div>

              {/* Animated Progress Steps when Analyzing */}
              {analyzing ? (
                <div className="rounded-2xl bg-emerald-950 text-white p-5 space-y-3.5">
                  <div className="flex items-center justify-between gap-2.5 text-sm font-bold text-[#a3e635]">
                    <div className="flex items-center gap-2.5">
                      <Spinner size="sm" className="text-[#a3e635]" />
                      <span>
                        {isFirstTimeAiLoad && progressStep === 0
                          ? t("newScan.progress.preparingAiFirstTime")
                          : t("newScan.progress.checkingLeaf")}
                      </span>
                    </div>
                    {isFirstTimeAiLoad && progressStep === 0 && aiLoadPercent > 0 && (
                      <span className="text-xs font-extrabold text-emerald-200">
                        {aiLoadPercent}%
                      </span>
                    )}
                  </div>

                  {isFirstTimeAiLoad && progressStep === 0 && (
                    <div className="w-full h-2 rounded-full bg-emerald-900 overflow-hidden">
                      <div
                        className="h-full bg-[#84cc16] transition-all duration-200"
                        style={{ width: `${Math.max(8, aiLoadPercent)}%` }}
                      />
                    </div>
                  )}

                  <div className="space-y-2">
                    {steps.map((stepText, idx) => {
                      const isDone = progressStep > idx;
                      const isCurrent = progressStep === idx;
                      return (
                        <div
                          key={idx}
                          className={`flex items-center gap-2.5 text-xs transition-opacity ${
                            isDone || isCurrent
                              ? "opacity-100 font-semibold text-white"
                              : "opacity-45 text-emerald-200"
                          }`}
                        >
                          <CheckCircle2
                            className={`w-4 h-4 shrink-0 ${
                              isDone
                                ? "text-[#84cc16]"
                                : isCurrent
                                ? "text-amber-400 animate-pulse"
                                : "text-slate-500"
                            }`}
                          />
                          <span>{stepText}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <Button
                  variant="primary"
                  size="lg"
                  fullWidth
                  icon={Sparkles}
                  disabled={!selectedCrop || !file || analyzing}
                  onClick={handleAnalyze}
                >
                  {t("newScan.analyzeBtn")}
                </Button>
              )}
            </div>
          )}
        </Card>

        {/* Right: Photo Tips Card */}
        <Card className="lg:col-span-5 bg-gradient-to-b from-emerald-50/70 to-white border-emerald-200/80 space-y-4">
          <div className="flex items-start gap-2.5">
            <Sparkles className="w-6 h-6 text-[#166534] shrink-0 mt-0.5" />
            <div>
              <h3 className="text-lg font-extrabold text-slate-900">
                {t("newScan.tips.title")}
              </h3>
              <p className="text-xs text-slate-600 mt-0.5">
                {t("newScan.tips.subtitle")}
              </p>
            </div>
          </div>

          <div className="space-y-3.5 pt-1">
            {tips.map((tip, idx) => {
              const Icon = tip.icon;
              return (
                <FadeIn key={idx} delay={idx * 80}>
                  <div className="flex items-start gap-3.5 p-3.5 rounded-xl bg-white border border-slate-200/70 shadow-2xs">
                    <div className="w-11 h-11 rounded-xl bg-emerald-100 text-[#166534] flex items-center justify-center shrink-0">
                      <Icon className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">
                        {tip.title}
                      </h4>
                      <p className="text-xs text-slate-600 leading-relaxed mt-0.5">
                        {tip.desc}
                      </p>
                    </div>
                  </div>
                </FadeIn>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}
