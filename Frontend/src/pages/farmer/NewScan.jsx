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
import { useLanguage } from "../../context/LanguageContext";
import { uploadLeafForPrediction } from "../../services/predictService";
import { extractErrorMessage } from "../../utils/formatters";

const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/jpg", "image/png"];
const ALLOWED_EXT_REGEX = /\.(jpe?g|png)$/i;

export default function NewScan() {
  const { t } = useLanguage();
  const navigate = useNavigate();

  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const [validationError, setValidationError] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [progressStep, setProgressStep] = useState(0);

  // Clean up object URL on unmount or change
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  // Animate progress steps while analyzing: 0 -> Uploading, 1 -> Analyzing, 2 -> Generating heatmap
  useEffect(() => {
    if (!analyzing) {
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

  const handleAnalyze = async () => {
    if (!file) {
      setValidationError(t("newScan.errors.noFile"));
      return;
    }

    setValidationError("");
    setProgressStep(0);
    setAnalyzing(true);
    try {
      const result = await uploadLeafForPrediction(file);
      toast.success(t("newScan.successToast"));
      const diagnosisId = result?.diagnosis?.id;
      if (diagnosisId) {
        navigate(`/farmer/scan/${diagnosisId}`, {
          state: { initialData: result },
        });
      } else {
        navigate("/farmer/history");
      }
    } catch (err) {
      const msg = extractErrorMessage(err, t("newScan.errors.uploadFailed"));
      setValidationError(msg);
      toast.error(msg);
    } finally {
      setAnalyzing(false);
      setProgressStep(0);
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

  const steps = [
    t("newScan.progress.step1"),
    t("newScan.progress.step2"),
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

          {!file ? (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`rounded-2xl border-2 border-dashed p-8 sm:p-10 text-center transition-all ${
                dragActive
                  ? "border-[#166534] bg-emerald-50/80 scale-[1.01]"
                  : "border-emerald-300/90 hover:border-[#166534] bg-[#f8faf5]"
              }`}
            >
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-emerald-100/80 text-[#166534] flex items-center justify-center">
                <UploadCloud className="w-8 h-8" />
              </div>

              <h3 className="text-base sm:text-lg font-extrabold text-slate-900">
                {t("newScan.dropzoneTitle")}
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">
                {t("newScan.dropzoneSubtitle")}
              </p>

              <div className="mt-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3">
                <Button
                  variant="primary"
                  icon={ImagePlus}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {t("newScan.choosePhotoBtn")}
                </Button>

                <Button
                  variant="secondary"
                  icon={Camera}
                  onClick={() => cameraInputRef.current?.click()}
                  className="sm:hidden"
                >
                  {t("newScan.takePhotoBtn")}
                </Button>

                <Button
                  variant="outline"
                  icon={Camera}
                  onClick={() => cameraInputRef.current?.click()}
                  className="hidden sm:inline-flex"
                >
                  {t("newScan.takePhotoBtn")}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    {t("newScan.previewTitle")}
                  </h3>
                  <p className="text-xs text-slate-500 truncate max-w-xs">
                    {file.name} • {t("newScan.fileSizeLabel")}:{" "}
                    {(file.size / (1024 * 1024)).toFixed(2)} MB
                  </p>
                </div>

                {!analyzing && (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      icon={RefreshCw}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {t("newScan.replacePhotoBtn")}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={Trash2}
                      onClick={handleRemoveFile}
                      className="!text-[#dc2626] hover:!bg-red-50"
                    >
                      {t("newScan.removePhotoBtn")}
                    </Button>
                  </div>
                )}
              </div>

              {/* Image Preview Container with Scanning Laser Animation */}
              <div className="relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-950 aspect-video sm:aspect-[16/10] flex items-center justify-center">
                <img
                  src={previewUrl}
                  alt="Selected crop leaf"
                  className={`max-h-full max-w-full object-contain transition-opacity duration-300 ${
                    analyzing ? "opacity-65" : "opacity-100"
                  }`}
                />

                {analyzing && (
                  <motion.div
                    initial={{ top: "0%" }}
                    animate={{ top: ["0%", "95%", "0%"] }}
                    transition={{
                      duration: 2.2,
                      repeat: Infinity,
                      ease: "linear",
                    }}
                    className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-[#84cc16] to-transparent shadow-[0_0_20px_#84cc16]"
                  />
                )}
              </div>

              {/* Animated Progress Steps when Analyzing */}
              {analyzing ? (
                <div className="rounded-2xl bg-emerald-950 text-white p-5 space-y-3.5">
                  <div className="flex items-center gap-2.5 text-sm font-bold text-[#a3e635]">
                    <Spinner size="sm" className="text-[#a3e635]" />
                    <span>{t("newScan.progress.title")}</span>
                  </div>

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
          <div>
            <h3 className="text-lg font-extrabold text-slate-900">
              {t("newScan.tips.title")}
            </h3>
            <p className="text-xs text-slate-600 mt-0.5">
              {t("newScan.tips.subtitle")}
            </p>
          </div>

          <div className="space-y-3.5 pt-1">
            {tips.map((tip, idx) => {
              const Icon = tip.icon;
              return (
                <div
                  key={idx}
                  className="flex items-start gap-3.5 p-3.5 rounded-xl bg-white border border-slate-200/70 shadow-2xs"
                >
                  <div className="w-9 h-9 rounded-xl bg-emerald-100 text-[#166534] flex items-center justify-center shrink-0">
                    <Icon className="w-5 h-5" />
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
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}
