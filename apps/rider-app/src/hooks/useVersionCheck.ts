import { createLogger } from "@/lib/logger";
import { useEffect, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
const log = createLogger("[version-check]");

const STORAGE_KEY = "ajk_rider_server_epoch";
const VERSION_KEY = "ajk_rider_app_version";
const POLL_INTERVAL_MS = 30_000;

interface HealthData {
  serverEpoch?: number;
  appVersion?: string;
  minVersion?: string;
  latestVersion?: string;
  androidStoreUrl?: string;
  iosStoreUrl?: string;
}

export interface ForceUpdateState {
  required: boolean;
  androidStoreUrl: string | null;
  iosStoreUrl: string | null;
}

async function fetchHealth(): Promise<HealthData | null> {
  try {
    const res = await fetch("/api/health", { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as HealthData;
  } catch (err) {
    console.warn("[artifacts/rider-app/src/hooks/useVersionCheck.ts]", err);
    return null;
  } // eslint-disable-line no-console
}

/** Parse the major segment of a semver string (e.g. "2.3.1" → 2). */
function parseMajor(version: string): number {
  const match = version.match(/^(\d+)/);
  return match ? parseInt(match[1]!, 10) : 0;
}

function hardReload(): void {
  try {
    sessionStorage.clear();
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(VERSION_KEY);
  } catch (err) {
    console.warn("[artifacts/rider-app/src/hooks/useVersionCheck.ts]", err);
  } // eslint-disable-line no-console
  window.location.reload();
}

/**
 * Opens the appropriate app-store URL for the platform.
 * On native Capacitor, tries @capacitor/browser first; falls back to window.open.
 * On web, uses window.open.
 */
async function openStoreUrl(url: string): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    try {
      const { Browser } = await import("@capacitor/browser");
      await Browser.open({ url });
      return;
    } catch {
      /* @capacitor/browser not installed or failed — fall through to window.open */
    }
  }
  try {
    window.open(url, "_blank", "noopener,noreferrer");
  } catch {
    /* non-critical */
  }
}

export function useVersionCheck(): ForceUpdateState {
  const reloadScheduled = useRef(false);
  const [forceUpdate, setForceUpdate] = useState<ForceUpdateState>({
    required: false,
    androidStoreUrl: null,
    iosStoreUrl: null,
  });

  useEffect(() => {
    async function check() {
      if (reloadScheduled.current) return;

      const health = await fetchHealth();
      if (!health) return;

      const {
        serverEpoch: epoch,
        appVersion,
        androidStoreUrl,
        iosStoreUrl,
      } = health;

      /* ── Semver-aware version comparison ───────────────────────────────
         Only a MAJOR version increment forces an update. Minor / patch
         changes are silently noted so transient deploys never cause
         reload loops during active sessions.                             */
      if (appVersion) {
        const storedVersion = localStorage.getItem(VERSION_KEY);
        if (storedVersion == null) {
          localStorage.setItem(VERSION_KEY, appVersion);
          log.debug(`initial appVersion stored: ${appVersion}`);
        } else if (storedVersion !== appVersion) {
          const storedMajor = parseMajor(storedVersion);
          const currentMajor = parseMajor(appVersion);
          log.debug(
            `version changed ${storedVersion} → ${appVersion} (major: ${storedMajor} → ${currentMajor})`
          );
          localStorage.setItem(VERSION_KEY, appVersion);
          if (currentMajor > storedMajor) {
            log.debug("major version bump — triggering force-update screen");
            reloadScheduled.current = true;
            clearInterval(timer);
            /* Gap 1: If store URLs are present, show the blocking update screen.
               Fall back to hardReload when they are absent (old server behaviour). */
            if (androidStoreUrl || iosStoreUrl) {
              setForceUpdate({
                required: true,
                androidStoreUrl: androidStoreUrl ?? null,
                iosStoreUrl: iosStoreUrl ?? null,
              });
            } else {
              hardReload();
            }
            return;
          }
        }
      }

      /* ── Epoch-based fallback (non-version deploys) ────────────────── */
      if (typeof epoch !== "number") return;
      const storedEpoch = localStorage.getItem(STORAGE_KEY);
      if (storedEpoch == null) {
        localStorage.setItem(STORAGE_KEY, String(epoch));
        return;
      }
      if (Number(storedEpoch) !== epoch) {
        log.debug(`serverEpoch changed (${storedEpoch} → ${epoch}) — scheduling reload`);
        localStorage.setItem(STORAGE_KEY, String(epoch));
        /* Do NOT reload while the rider has an active delivery/ride in progress.
           Reloading mid-trip loses GPS state, offline queue, and the active task UI.
           Instead mark the reload as pending and let the next poll (when they are
           no longer on /active) actually trigger it. */
        if (window.location.pathname.startsWith("/active")) {
          log.debug("epoch changed but rider is on /active — deferring reload until task is done");
          return;
        }
        reloadScheduled.current = true;
        clearInterval(timer);
        hardReload();
      }
    }

    void check();
    const timer = setInterval(check, POLL_INTERVAL_MS);

    return () => clearInterval(timer);
  }, []);

  return forceUpdate;
}

export { openStoreUrl };
