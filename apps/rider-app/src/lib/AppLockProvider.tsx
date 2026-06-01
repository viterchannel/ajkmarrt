/**
 * AppLockProvider — idle-timeout screen lock for native Capacitor builds.
 *
 * Tracks the timestamp of the last user interaction (touch / pointer / key).
 * When the idle threshold elapses (default 5 minutes, configurable via
 * Capacitor Preferences key "ajkmart_rider_lock_timeout_sec") a full-screen
 * lock overlay is rendered on top of all other UI.
 *
 * The lock is dismissed by a successful biometric (or device-PIN fallback)
 * authentication via the existing @aparajita/capacitor-biometric-auth plugin.
 *
 * On web / browser builds, where biometric is unavailable, the lock is a
 * no-op so dev flows and PWA-browser users are unaffected.
 */

import { createLogger } from "@/lib/logger";
import { Capacitor } from "@capacitor/core";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { verifyBiometric } from "./biometric";

const log = createLogger("[AppLock]");

const LOCK_TIMEOUT_KEY = "ajkmart_rider_lock_timeout_sec";
const DEFAULT_TIMEOUT_SEC = 5 * 60;
const MIN_TIMEOUT_SEC = 60;

async function getLockTimeoutSec(): Promise<number> {
  try {
    const { Preferences } = await import("@capacitor/preferences");
    const { value } = await Preferences.get({ key: LOCK_TIMEOUT_KEY });
    if (value) {
      const n = parseInt(value, 10);
      if (Number.isFinite(n) && n >= MIN_TIMEOUT_SEC) return n;
    }
  } catch {
    /* Preferences unavailable — use default */
  }
  return DEFAULT_TIMEOUT_SEC;
}

export async function setLockTimeoutSec(sec: number): Promise<void> {
  const clamped = Math.max(MIN_TIMEOUT_SEC, sec);
  try {
    const { Preferences } = await import("@capacitor/preferences");
    await Preferences.set({ key: LOCK_TIMEOUT_KEY, value: String(clamped) });
  } catch (err) {
    log.warn("Failed to persist lock timeout:", err);
  }
}

interface AppLockContextValue {
  locked: boolean;
  lockTimeoutSec: number;
  setLockTimeout: (sec: number) => Promise<void>;
}

const AppLockContext = createContext<AppLockContextValue>({
  locked: false,
  lockTimeoutSec: DEFAULT_TIMEOUT_SEC,
  setLockTimeout: async () => {},
});

export function useAppLock() {
  return useContext(AppLockContext);
}

const INTERACTION_EVENTS = [
  "touchstart",
  "touchend",
  "pointerdown",
  "keydown",
  "click",
  "scroll",
] as const;

export function AppLockProvider({ children }: { children: ReactNode }) {
  const isNative = Capacitor.isNativePlatform();

  const [locked, setLocked] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [lockTimeoutSec, setLockTimeoutSecState] = useState(DEFAULT_TIMEOUT_SEC);
  const lastActivityRef = useRef(Date.now());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* Load persisted timeout on mount */
  useEffect(() => {
    if (!isNative) return;
    getLockTimeoutSec().then((sec) => {
      setLockTimeoutSecState(sec);
    }).catch(() => {});
  }, [isNative]);

  const resetActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
  }, []);

  /* Track user interactions to update the last-activity timestamp */
  useEffect(() => {
    if (!isNative) return;
    const handler = () => resetActivity();
    for (const ev of INTERACTION_EVENTS) {
      window.addEventListener(ev, handler, { passive: true });
    }
    return () => {
      for (const ev of INTERACTION_EVENTS) {
        window.removeEventListener(ev, handler);
      }
    };
  }, [isNative, resetActivity]);

  /* Polling check for idle timeout — runs every 10 seconds */
  useEffect(() => {
    if (!isNative) return;
    timerRef.current = setInterval(() => {
      if (locked) return;
      const idleSec = (Date.now() - lastActivityRef.current) / 1000;
      if (idleSec >= lockTimeoutSec) {
        log.info({ idleSec, lockTimeoutSec }, "[AppLock] idle threshold reached — locking");
        setLocked(true);
      }
    }, 10_000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isNative, locked, lockTimeoutSec]);

  /* Handle app returning to foreground — check idle immediately */
  useEffect(() => {
    if (!isNative) return;
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        if (locked) return;
        const idleSec = (Date.now() - lastActivityRef.current) / 1000;
        if (idleSec >= lockTimeoutSec) {
          log.info({ idleSec }, "[AppLock] app foregrounded after idle — locking");
          setLocked(true);
        }
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [isNative, locked, lockTimeoutSec]);

  const handleUnlock = useCallback(async () => {
    if (unlocking) return;
    setUnlocking(true);
    try {
      const success = await verifyBiometric("Unlock AJKMart Rider");
      if (success) {
        resetActivity();
        setLocked(false);
        log.info("[AppLock] unlocked via biometric");
      } else {
        log.warn("[AppLock] biometric failed or cancelled — lock remains");
      }
    } catch (err) {
      log.warn("[AppLock] biometric error:", err);
    } finally {
      setUnlocking(false);
    }
  }, [unlocking, resetActivity]);

  const setLockTimeout = useCallback(async (sec: number) => {
    await setLockTimeoutSec(sec);
    setLockTimeoutSecState(Math.max(MIN_TIMEOUT_SEC, sec));
  }, []);

  return (
    <AppLockContext.Provider value={{ locked, lockTimeoutSec, setLockTimeout }}>
      {children}
      {locked && isNative && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(11,14,17,0.98)",
            backdropFilter: "blur(12px)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 99999,
            padding: 24,
            gap: 20,
          }}
        >
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: "50%",
              background: "rgba(240,185,11,0.12)",
              border: "1.5px solid rgba(240,185,11,0.3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--color-brand)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>

          <div style={{ textAlign: "center" }}>
            <h2
              style={{
                color: "#E8E9EF",
                fontSize: 22,
                fontWeight: 700,
                margin: "0 0 8px",
                fontFamily: "Inter, sans-serif",
              }}
            >
              App Locked
            </h2>
            <p
              style={{
                color: "#6B7280",
                fontSize: 14,
                lineHeight: 1.6,
                margin: 0,
                maxWidth: 280,
                fontFamily: "Inter, sans-serif",
              }}
            >
              Your session has been locked due to inactivity. Please authenticate to continue.
            </p>
          </div>

          <button
            onClick={() => void handleUnlock()}
            disabled={unlocking}
            style={{
              marginTop: 8,
              width: "100%",
              maxWidth: 320,
              height: 52,
              borderRadius: 14,
              border: "none",
              background: unlocking
                ? "rgba(240,185,11,0.4)"
                : "linear-gradient(135deg, var(--color-brand), var(--color-brand-hover))",
              color: "var(--color-surface)",
              fontSize: 15,
              fontWeight: 700,
              cursor: unlocking ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              fontFamily: "Inter, sans-serif",
              transition: "opacity 0.2s",
            }}
          >
            {unlocking ? (
              <>
                <div
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: "50%",
                    border: "2.5px solid rgba(11,14,17,0.3)",
                    borderTopColor: "var(--color-surface)",
                    animation: "spin 0.7s linear infinite",
                  }}
                />
                Authenticating…
              </>
            ) : (
              <>
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
                Unlock with Biometric / PIN
              </>
            )}
          </button>

          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}
    </AppLockContext.Provider>
  );
}
