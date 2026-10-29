import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Bell, CheckCheck, CheckCircle2, ShieldCheck } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useLanguage } from "../../context/LanguageContext";
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "../../services/notificationService";
import { formatTimeAgo } from "../../utils/formatters";

export default function NotificationBell() {
  const { user, isAuthenticated } = useAuth();
  const { lang, t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();

  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const dropdownRef = useRef(null);

  const fetchNotifications = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const data = await getNotifications();
      setNotifications(
        Array.isArray(data?.notifications) ? data.notifications : []
      );
      setUnreadCount(Number(data?.unread_count) || 0);
    } catch {
      // Ignore silent polling errors
    }
  }, [isAuthenticated]);

  // Initial fetch + 30-second polling while logged in
  useEffect(() => {
    if (!isAuthenticated) return;
    let active = true;

    const poll = () => {
      getNotifications()
        .then((data) => {
          if (active) {
            setNotifications(
              Array.isArray(data?.notifications) ? data.notifications : []
            );
            setUnreadCount(Number(data?.unread_count) || 0);
          }
        })
        .catch(() => {
          // Ignore silent polling errors
        });
    };

    poll();
    const intervalId = setInterval(poll, 30000);

    return () => {
      active = false;
      clearInterval(intervalId);
    };
  }, [isAuthenticated, location.pathname]);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const handleToggle = () => {
    if (!open) {
      fetchNotifications();
    }
    setOpen((prev) => !prev);
  };

  const handleNotificationClick = async (notif) => {
    setOpen(false);

    if (!notif.is_read) {
      try {
        await markNotificationRead(notif.id);
        setNotifications((prev) =>
          prev.map((item) =>
            item.id === notif.id ? { ...item, is_read: true } : item
          )
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      } catch {
        // Proceed with navigation even if marking read fails
      }
    }

    if (notif.diagnosis_id) {
      const targetPath =
        user?.role === "officer"
          ? `/officer/review/${notif.diagnosis_id}`
          : `/farmer/scan/${notif.diagnosis_id}`;
      navigate(targetPath);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead();
      setNotifications((prev) =>
        prev.map((item) => ({ ...item, is_read: true }))
      );
      setUnreadCount(0);
    } catch {
      // Ignore error
    }
  };

  if (!isAuthenticated) return null;

  return (
    <div ref={dropdownRef} className="relative">
      <button
        type="button"
        onClick={handleToggle}
        aria-label={t("notifications.title")}
        className="relative inline-flex items-center justify-center w-9 h-9 rounded-xl bg-[#f8faf5] hover:bg-emerald-50 text-slate-700 hover:text-[#166534] border border-slate-200 transition-colors cursor-pointer"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#dc2626] text-white text-[10px] font-extrabold flex items-center justify-center shadow-xs">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-white border border-slate-200/90 shadow-xl shadow-slate-900/10 z-50 overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-2 bg-[#f8faf5]/70">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-extrabold text-slate-900">
                {t("notifications.title")}
              </h3>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-[#166534]">
                  {unreadCount} {t("notifications.unreadBadge")}
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="inline-flex items-center gap-1 text-xs font-bold text-[#166534] hover:text-[#15803d] cursor-pointer"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>{t("notifications.markAllRead")}</span>
              </button>
            )}
          </div>

          {/* Notification Items */}
          <div className="max-h-96 overflow-y-auto divide-y divide-slate-100">
            {notifications.length === 0 ? (
              <div className="py-10 px-4 text-center space-y-2">
                <Bell className="w-7 h-7 text-slate-300 mx-auto" />
                <p className="text-xs font-semibold text-slate-500">
                  {t("notifications.empty")}
                </p>
              </div>
            ) : (
              notifications.map((notif) => {
                const isConfirmed = notif.type === "review_confirmed";
                const title =
                  lang === "si" ? notif.title_si : notif.title_en;
                const message =
                  lang === "si" ? notif.message_si : notif.message_en;

                return (
                  <button
                    key={notif.id}
                    type="button"
                    onClick={() => handleNotificationClick(notif)}
                    className={`w-full text-left px-4 py-3.5 flex items-start gap-3 transition-colors cursor-pointer ${
                      notif.is_read
                        ? "bg-white hover:bg-slate-50"
                        : "bg-emerald-50/50 hover:bg-emerald-50/90"
                    }`}
                  >
                    <div
                      className={`mt-0.5 w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                        isConfirmed
                          ? "bg-emerald-100 text-[#166534]"
                          : "bg-sky-100 text-sky-700"
                      }`}
                    >
                      {isConfirmed ? (
                        <CheckCircle2 className="w-4 h-4" />
                      ) : (
                        <ShieldCheck className="w-4 h-4" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <p
                          className={`text-xs leading-snug ${
                            notif.is_read
                              ? "font-semibold text-slate-800"
                              : "font-extrabold text-slate-900"
                          }`}
                        >
                          {title}
                        </p>
                        {!notif.is_read && (
                          <span className="w-2 h-2 rounded-full bg-[#16a34a] shrink-0 mt-1" />
                        )}
                      </div>

                      <p className="text-xs text-slate-600 leading-relaxed line-clamp-2">
                        {message}
                      </p>

                      <p className="text-[11px] font-medium text-slate-400">
                        {formatTimeAgo(notif.created_at, lang)}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
