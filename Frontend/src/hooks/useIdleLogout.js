import { useCallback, useEffect, useRef, useState } from "react";

const DEFAULT_IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const DEFAULT_WARNING_BEFORE_MS = 60 * 1000; // 1 minute before logout

export default function useIdleLogout({
  enabled = false,
  idleTimeoutMs = DEFAULT_IDLE_TIMEOUT_MS,
  warningBeforeMs = DEFAULT_WARNING_BEFORE_MS,
  onIdleLogout,
} = {}) {
  const [showWarning, setShowWarning] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(
    Math.ceil(warningBeforeMs / 1000)
  );

  const deadlineRef = useRef(Date.now() + idleTimeoutMs);
  const warningShownRef = useRef(false);
  const onIdleLogoutRef = useRef(onIdleLogout);

  useEffect(() => {
    onIdleLogoutRef.current = onIdleLogout;
  }, [onIdleLogout]);

  const resetTimer = useCallback(() => {
    deadlineRef.current = Date.now() + idleTimeoutMs;
    warningShownRef.current = false;
    setShowWarning(false);
    setRemainingSeconds(Math.ceil(warningBeforeMs / 1000));
  }, [idleTimeoutMs, warningBeforeMs]);

  const staySignedIn = useCallback(() => {
    resetTimer();
  }, [resetTimer]);

  const logoutNow = useCallback(() => {
    warningShownRef.current = false;
    setShowWarning(false);
    if (typeof onIdleLogoutRef.current === "function") {
      onIdleLogoutRef.current();
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      setShowWarning(false);
      warningShownRef.current = false;
      return undefined;
    }

    deadlineRef.current = Date.now() + idleTimeoutMs;

    const handleActivity = () => {
      // Once the warning modal is visible, require clicking "Stay signed in"
      if (warningShownRef.current) return;
      deadlineRef.current = Date.now() + idleTimeoutMs;
    };

    const activityEvents = [
      "mousemove",
      "mousedown",
      "keydown",
      "touchstart",
      "scroll",
    ];

    activityEvents.forEach((eventName) => {
      window.addEventListener(eventName, handleActivity, { passive: true });
    });

    const intervalId = window.setInterval(() => {
      const msLeft = deadlineRef.current - Date.now();

      if (msLeft <= 0) {
        window.clearInterval(intervalId);
        warningShownRef.current = false;
        setShowWarning(false);
        if (typeof onIdleLogoutRef.current === "function") {
          onIdleLogoutRef.current();
        }
        return;
      }

      if (msLeft <= warningBeforeMs) {
        warningShownRef.current = true;
        setShowWarning(true);
        setRemainingSeconds(Math.max(1, Math.ceil(msLeft / 1000)));
      }
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
      activityEvents.forEach((eventName) => {
        window.removeEventListener(eventName, handleActivity);
      });
    };
  }, [enabled, idleTimeoutMs, warningBeforeMs]);

  return {
    showWarning,
    remainingSeconds,
    staySignedIn,
    logoutNow,
  };
}
