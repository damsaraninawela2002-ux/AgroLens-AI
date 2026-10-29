import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock,
  Filter,
  MapPin,
  RefreshCw,
  Sprout,
  User,
} from "lucide-react";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Badge from "../../components/ui/Badge";
import { useAuth } from "../../context/AuthContext";
import { useLanguage } from "../../context/LanguageContext";
import { getPendingDiagnoses } from "../../services/officerService";
import { SRI_LANKAN_DISTRICTS } from "../../utils/constants";
import {
  extractErrorMessage,
  formatConfidence,
  formatDiseaseKey,
  formatTimeAgo,
  getConfidenceTone,
  getImageUrl,
} from "../../utils/formatters";
import OfficerWaitingApprovalCard from "../../components/officer/OfficerWaitingApprovalCard";

export default function ReviewQueue() {
  const { user } = useAuth();
  const { lang, t } = useLanguage();

  const [districtFilter, setDistrictFilter] = useState("my_district");
  const [cropFilter, setCropFilter] = useState("");
  const [page, setPage] = useState(1);
  const limit = 12;

  const [data, setData] = useState({
    items: [],
    total: 0,
    page: 1,
    pages: 1,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const userDistrict = user?.district;
  const isUnapprovedOfficer =
    user?.role === "officer" && user?.is_approved === false;

  const fetchQueue = useCallback(async () => {
    if (isUnapprovedOfficer) return;
    setLoading(true);
    setError("");
    try {
      const districtParam =
        districtFilter === "my_district"
          ? userDistrict
          : districtFilter === "all"
          ? "all"
          : districtFilter;

      const res = await getPendingDiagnoses({
        district: districtParam,
        crop: cropFilter || undefined,
        page,
        limit,
      });

      setData({
        items: Array.isArray(res?.items) ? res.items : [],
        total: Number(res?.total) || 0,
        page: Number(res?.page) || 1,
        pages: Number(res?.pages) || 1,
      });
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [districtFilter, cropFilter, page, userDistrict, isUnapprovedOfficer]);

  useEffect(() => {
    if (isUnapprovedOfficer) return;
    let active = true;
    const districtParam =
      districtFilter === "my_district"
        ? userDistrict
        : districtFilter === "all"
        ? "all"
        : districtFilter;

    getPendingDiagnoses({
      district: districtParam,
      crop: cropFilter || undefined,
      page,
      limit,
    })
      .then((res) => {
        if (active) {
          setData({
            items: Array.isArray(res?.items) ? res.items : [],
            total: Number(res?.total) || 0,
            page: Number(res?.page) || 1,
            pages: Number(res?.pages) || 1,
          });
          setError("");
        }
      })
      .catch((err) => {
        if (active) {
          setError(extractErrorMessage(err));
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [districtFilter, cropFilter, page, userDistrict, isUnapprovedOfficer]);

  if (isUnapprovedOfficer) {
    return <OfficerWaitingApprovalCard />;
  }

  const handleDistrictChange = (e) => {
    setDistrictFilter(e.target.value);
    setPage(1);
  };

  const handleCropChange = (cropVal) => {
    setCropFilter(cropVal);
    setPage(1);
  };

  const cropTabs = [
    { value: "", label: t("officer.queue.allCropsOption") },
    { value: "Tomato", label: t("officer.queue.cropTomato") },
    { value: "Potato", label: t("officer.queue.cropPotato") },
    { value: "Pepper", label: t("officer.queue.cropPepper") },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
            {t("officer.queue.pageTitle")}
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            {t("officer.queue.pageSubtitle")}
          </p>
        </div>

        <Badge variant="warning" icon={Clock}>
          {data.total} {t("status.pending_review")}
        </Badge>
      </div>

      {/* Filters Card */}
      <Card padding="p-4 sm:p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Crop Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
            <Sprout className="w-4 h-4 text-[#166534] shrink-0 mr-1" />
            {cropTabs.map((tab) => {
              const active = cropFilter === tab.value;
              return (
                <button
                  key={tab.value || "all"}
                  type="button"
                  onClick={() => handleCropChange(tab.value)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                    active
                      ? "bg-[#166534] text-white shadow-xs"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200/70"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* District Dropdown Filter */}
          <div className="flex items-center gap-2.5">
            <label
              htmlFor="queue-district-filter"
              className="text-xs font-bold text-slate-600 inline-flex items-center gap-1.5 shrink-0"
            >
              <Filter className="w-3.5 h-3.5 text-[#166534]" />
              <span>{t("officer.queue.districtFilterLabel")}:</span>
            </label>
            <select
              id="queue-district-filter"
              value={districtFilter}
              onChange={handleDistrictChange}
              className="w-full sm:w-56 rounded-xl bg-[#f8faf5] px-3.5 py-2 text-xs sm:text-sm font-semibold text-slate-900 border border-slate-200 focus:outline-none focus:border-[#166534] focus:bg-white cursor-pointer"
            >
              <option value="my_district">
                {t("officer.queue.myDistrictOption")} ({user?.district})
              </option>
              <option value="all">
                {t("officer.queue.allDistrictsOption")}
              </option>
              <optgroup label="Sri Lankan Districts">
                {SRI_LANKAN_DISTRICTS.map((d) => (
                  <option key={d.value} value={d.value}>
                    {lang === "si" ? `${d.labelSi} (${d.labelEn})` : d.labelEn}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>
        </div>
      </Card>

      {/* Error State */}
      {error && (
        <Card className="border-red-200 bg-red-50/60 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-[#dc2626]">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <span className="text-sm font-semibold">{error}</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            icon={RefreshCw}
            onClick={fetchQueue}
          >
            {t("dashboard.error.retryBtn")}
          </Button>
        </Card>
      )}

      {/* Loading Skeletons */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} className="space-y-4">
              <div className="flex items-center gap-3.5">
                <div className="w-20 h-20 rounded-2xl bg-slate-200 animate-pulse shrink-0" />
                <div className="space-y-2 flex-1">
                  <div className="h-4 w-3/4 bg-slate-200 rounded animate-pulse" />
                  <div className="h-3 w-1/2 bg-slate-100 rounded animate-pulse" />
                  <div className="h-5 w-20 bg-slate-200 rounded-full animate-pulse" />
                </div>
              </div>
              <div className="h-9 w-full bg-slate-100 rounded-xl animate-pulse" />
            </Card>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && data.items.length === 0 && (
        <Card className="py-16 px-6 text-center max-w-lg mx-auto space-y-4">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-50 text-[#166534] flex items-center justify-center">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-extrabold text-slate-900">
              {t("officer.queue.emptyTitle")}
            </h3>
            <p className="text-xs sm:text-sm text-slate-600">
              {t("officer.queue.emptySubtitle")}
            </p>
          </div>
        </Card>
      )}

      {/* Queue Cards Grid */}
      {!loading && data.items.length > 0 && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {data.items.map((item) => {
              const tone = getConfidenceTone(item.confidence);

              return (
                <Card
                  key={item.id}
                  hover
                  className="flex flex-col justify-between gap-4"
                >
                  <div className="space-y-3.5">
                    {/* Top: Thumbnail + Confidence Badge + Waiting Time */}
                    <div className="flex items-start gap-3.5">
                      <img
                        src={getImageUrl(item.image_url)}
                        alt={formatDiseaseKey(item.predicted_class, lang)}
                        className="w-20 h-20 rounded-2xl object-cover border border-slate-200 shrink-0 bg-slate-100"
                      />

                      <div className="min-w-0 flex-1 space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <Badge variant={tone.badgeVariant}>
                            {formatConfidence(item.confidence, 1)}
                          </Badge>
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500">
                            <Clock className="w-3 h-3 text-amber-600" />
                            <span>{formatTimeAgo(item.created_at, lang)}</span>
                          </span>
                        </div>

                        <h3 className="text-sm font-extrabold text-slate-900 leading-snug line-clamp-2">
                          {formatDiseaseKey(item.predicted_class, lang)}
                        </h3>
                      </div>
                    </div>

                    {/* Farmer & District Info */}
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2 text-xs text-slate-600">
                      <span className="inline-flex items-center gap-1.5 truncate font-semibold text-slate-800">
                        <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">{item.farmer_name}</span>
                      </span>

                      <span className="inline-flex items-center gap-1 shrink-0 text-slate-500">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        <span>{item.district}</span>
                      </span>
                    </div>
                  </div>

                  <Link to={`/officer/review/${item.id}`}>
                    <Button
                      variant="primary"
                      size="sm"
                      fullWidth
                      icon={ArrowRight}
                      iconPosition="right"
                    >
                      {t("officer.queue.reviewNowBtn")}
                    </Button>
                  </Link>
                </Card>
              );
            })}
          </div>

          {/* Pagination */}
          {data.pages > 1 && (
            <div className="flex items-center justify-between gap-4 pt-2">
              <Button
                variant="outline"
                size="sm"
                icon={ArrowLeft}
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                {t("officer.queue.prevPage")}
              </Button>

              <span className="text-xs font-bold text-slate-600">
                {t("officer.queue.pageInfo")} {data.page} / {data.pages}
              </span>

              <Button
                variant="outline"
                size="sm"
                icon={ArrowRight}
                iconPosition="right"
                disabled={page >= data.pages}
                onClick={() => setPage((p) => Math.min(data.pages, p + 1))}
              >
                {t("officer.queue.nextPage")}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
