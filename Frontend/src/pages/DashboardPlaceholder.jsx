import { useState } from "react";
import toast from "react-hot-toast";
import {
  CheckCircle2,
  Flame,
  MapPin,
  Microscope,
  ShieldCheck,
  Sparkles,
  Upload,
} from "lucide-react";
import Card from "../components/ui/Card";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { API_BASE_URL } from "../services/api";
import { predictLeafDisease } from "../services/authService";
import {
  extractErrorMessage,
  formatConfidence,
  formatDiseaseKey,
} from "../utils/formatters";

export default function DashboardPlaceholder() {
  const { user } = useAuth();
  const { lang, t } = useLanguage();

  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);

  const role = user?.role || "farmer";

  const titleByRole = {
    farmer: t("dashboard.farmerTitle"),
    officer: t("dashboard.officerTitle"),
    admin: t("dashboard.adminTitle"),
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setScanResult(null);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleRunScan = async () => {
    if (!selectedFile) return;
    setScanning(true);
    try {
      const data = await predictLeafDisease(selectedFile);
      setScanResult(data);
      toast.success("AI Leaf Diagnosis & Grad-CAM Complete!");
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setScanning(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <Card className="bg-gradient-to-r from-[#052e16] via-[#14532d] to-[#166534] text-white border-none p-7 sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-2">
            <Badge variant="lime" icon={Sparkles}>
              {t("dashboard.comingSoonBadge")}
            </Badge>
            <h1 className="text-2xl sm:text-3xl font-extrabold">
              {titleByRole[role] || titleByRole.farmer}
            </h1>
            <p className="text-sm text-emerald-100/90">
              {t("dashboard.welcome")},{" "}
              <span className="font-bold text-white">{user?.full_name}</span> •{" "}
              {t("dashboard.placeholderDesc")}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 border border-white/15 text-xs font-semibold">
              <ShieldCheck className="w-4 h-4 text-[#a3e635]" />
              <span>
                {t("dashboard.roleBadge")}: {role.toUpperCase()}
              </span>
            </span>
            {user?.district && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 border border-white/15 text-xs font-semibold">
                <MapPin className="w-4 h-4 text-[#a3e635]" />
                <span>
                  {t("dashboard.districtBadge")}: {user.district}
                </span>
              </span>
            )}
          </div>
        </div>
      </Card>

      {/* Farmer Quick Leaf Scan Widget (Connected to POST /api/predict) */}
      {role === "farmer" ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <Card className="lg:col-span-5 space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-[#166534] flex items-center justify-center">
                <Microscope className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {t("dashboard.quickUploadTitle")}
                </h2>
                <p className="text-xs text-slate-500">
                  POST /api/predict • MobileNetV2 + Grad-CAM
                </p>
              </div>
            </div>

            <p className="text-sm text-slate-600 leading-relaxed">
              {t("dashboard.quickUploadDesc")}
            </p>

            <label className="flex flex-col items-center justify-center border-2 border-dashed border-emerald-300 hover:border-[#166534] rounded-2xl p-6 bg-emerald-50/40 cursor-pointer transition-colors">
              <Upload className="w-8 h-8 text-[#166534] mb-2" />
              <span className="text-sm font-bold text-[#166534]">
                {t("dashboard.selectImageBtn")}
              </span>
              <span className="text-xs text-slate-500 mt-1">
                JPG, JPEG, PNG (Max 5MB)
              </span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/jpg"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>

            {previewUrl && (
              <div className="space-y-3">
                <img
                  src={previewUrl}
                  alt="Selected leaf preview"
                  className="w-full h-48 object-cover rounded-xl border border-slate-200"
                />
                <Button
                  variant="primary"
                  fullWidth
                  loading={scanning}
                  onClick={handleRunScan}
                >
                  {scanning
                    ? t("dashboard.scanning")
                    : t("dashboard.runScanBtn")}
                </Button>
              </div>
            )}
          </Card>

          <Card className="lg:col-span-7">
            {scanResult ? (
              <div className="space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Detected Condition
                    </p>
                    <h3 className="text-xl font-extrabold text-slate-900">
                      {lang === "si" && scanResult.treatment?.disease_name_si
                        ? scanResult.treatment.disease_name_si
                        : scanResult.treatment?.disease_name_en ||
                          formatDiseaseKey(
                            scanResult.diagnosis?.predicted_class
                          )}
                    </h3>
                  </div>
                  <Badge
                    variant={
                      scanResult.diagnosis?.confidence >= 70
                        ? "success"
                        : "warning"
                    }
                    icon={CheckCircle2}
                  >
                    Confidence:{" "}
                    {formatConfidence(scanResult.diagnosis?.confidence, 2)} (
                    {scanResult.diagnosis?.status})
                  </Badge>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-bold text-slate-600 mb-1.5">
                      Original Uploaded Leaf
                    </p>
                    <img
                      src={`${API_BASE_URL}${scanResult.diagnosis?.image_url}`}
                      alt="Uploaded leaf"
                      className="w-full h-48 object-cover rounded-xl border border-slate-200"
                    />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-600 mb-1.5 flex items-center gap-1.5">
                      <Flame className="w-4 h-4 text-[#dc2626]" />
                      <span>Grad-CAM Explainability Heatmap</span>
                    </p>
                    <img
                      src={`${API_BASE_URL}${scanResult.diagnosis?.heatmap_url}`}
                      alt="Grad-CAM heatmap"
                      className="w-full h-48 object-cover rounded-xl border border-slate-200"
                    />
                  </div>
                </div>

                {scanResult.treatment && (
                  <div className="rounded-xl bg-[#f8faf5] border border-slate-200/80 p-4 space-y-2 text-xs sm:text-sm">
                    <p className="font-bold text-[#166534]">
                      {lang === "si"
                        ? scanResult.treatment.treatment_si
                        : scanResult.treatment.treatment_en}
                    </p>
                    <p className="text-xs text-slate-500 italic">
                      {scanResult.disclaimer}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="h-full min-h-[260px] flex flex-col items-center justify-center text-center p-6 text-slate-500">
                <Flame className="w-10 h-10 text-slate-300 mb-3" />
                <p className="text-sm font-semibold text-slate-700">
                  No Leaf Scan Selected Yet
                </p>
                <p className="text-xs text-slate-500 max-w-sm mt-1">
                  Select a leaf image on the left and click &ldquo;
                  {t("dashboard.runScanBtn")}&rdquo; to view the live MobileNetV2
                  diagnosis and Grad-CAM heatmap.
                </p>
              </div>
            )}
          </Card>
        </div>
      ) : (
        <Card className="text-center py-12 space-y-3">
          <Badge variant="warning">{t("dashboard.comingSoonModule")}</Badge>
          <h2 className="text-xl font-bold text-slate-900">
            {titleByRole[role]}
          </h2>
          <p className="text-sm text-slate-600 max-w-md mx-auto">
            {t("dashboard.placeholderDesc")}
          </p>
        </Card>
      )}
    </div>
  );
}
