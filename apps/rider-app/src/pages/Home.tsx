import { createLogger } from "@/lib/logger";
import { trackEvent } from "@/lib/analytics";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "@/hooks/use-toast";
import { PullToRefresh } from "../components/PullToRefresh";
import { getPollingIntervalForTier, useNetworkQuality } from "../hooks/useNetworkQuality";
const log = createLogger("[Home]");

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { tDual } from "@workspace/i18n";
import { AlertTriangle, ArrowUpRight, CheckCircle, ChevronRight, Clock, Lock, Smartphone, Wallet, Wifi, Zap } from "lucide-react";
import { Link, useLocation } from "wouter";
import { haversineMeters } from "../components/dashboard/helpers";
import { api, type Order, type Ride } from "../lib/api";
import {
  addDismissed,
  clearAllDismissed,
  enqueue,
  removeDismissed,
  sweepAndLoadDismissed,
} from "../lib/gpsQueue";
import {
  getSilenceMode,
  getSilenceRemaining,
  isAudioLocked,
  isSilenced,
  playRequestSound,
  setSilenceMode,
  unlockAudio,
} from "../lib/notificationSound";
import { recordUsage } from "../lib/featureGate";
import { useFeatureGate } from "../lib/useFeatureGate";
import { useVerificationGate } from "../lib/VerificationGateContext";
import { enqueueAction } from "../lib/offline/queueManager";
import { useAuth } from "../lib/rider-auth";
import { logRideEvent } from "../lib/rideUtils";
import { useSocket } from "../lib/socket";
import {
  parseNewOrderPayload,
  parseOrderAcceptedPayload,
  parseOrderCancelledPayload,
  parseCounterResultPayload,
  parseRideAssignedPayload,
} from "../lib/socketEvents";
import { usePlatformConfig } from "../lib/useConfig";
import { useLanguage } from "../lib/useLanguage";

import {
  ACCEPT_TIMEOUT_SEC,
  ActiveTaskBanner,
  FixedBanners,
  InlineWarnings,
  KycStatusBanner,
  LiveClock,
  OfflineConfirmDialog,
  OnlineToggleCard,
  RequestListHeader,
  SilenceControls,
  SkeletonHome,
  StatsGrid,
  formatCurrency,
} from "../components/dashboard";
import { GoalSection } from "../components/home/GoalSection";
import { HomeRequestList } from "../components/home/HomeRequestList";
import { TodaySummaryWidget } from "../components/home/TodaySummaryWidget";

export default function Home() {
  const { user, refreshUser, loading: authLoading, refreshFeatureRules } = useAuth();
  const acceptOrderGate = useFeatureGate("accept_order");
  const acceptRideGate = useFeatureGate("accept_ride");
  const [, setLocation] = useLocation();
  const { tier: networkTier, isOffline: isNetworkOffline } = useNetworkQuality();

  const { config } = usePlatformConfig();
  const { language } = useLanguage();
  const T = useCallback((key: Parameters<typeof tDual>[0]) => tDual(key, language), [language]);
  const currency = config.platform.currencySymbol ?? "Rs.";
  const qc = useQueryClient();
  const [toggling, setToggling] = useState(false);
  const [tabVisible, setTabVisible] = useState(!document.hidden);
  const [newFlash, setNewFlash] = useState(false);
  const [srAnnouncement, setSrAnnouncement] = useState("");
  const [dismissed, setDismissed] = useState<Set<string>>(new Set<string>());
  const [profileBannerDismissed, setProfileBannerDismissed] = useState(() => {
    try {
      return sessionStorage.getItem("_ajkm_profileBannerDismissed") === "1";
    } catch {
      return false;
    }
  });
  const [lastSeenOnlineAt, setLastSeenOnlineAt] = useState<string | null>(null);
  const [onlineSince, setOnlineSince] = useState<number | null>(() => {
    try {
      const stored = sessionStorage.getItem("_ajkm_onlineSince");
      return stored ? parseInt(stored, 10) : null;
    } catch { return null; }
  });
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [acceptingOrderId, setAcceptingOrderId] = useState<string | null>(null);

  /* Blocking gate reason — set proactively from user profile and also
     reactively when a 403 returns a machine-readable reason.
     Values: "phone_not_verified" | "account_not_approved" | "insufficient_wallet_balance" | null */
  const [blockingReason, setBlockingReason] = useState<string | null>(null);

  const [audioLocked, setAudioLocked] = useState(false);

  const { addBlockedVerifications } = useVerificationGate();

  /* Show a one-time warning when document upload failed silently during registration */
  useEffect(() => {
    try {
      if (sessionStorage.getItem("reg_doc_upload_warning") === "1") {
        sessionStorage.removeItem("reg_doc_upload_warning");
        toast({
          title: "Documents not uploaded",
          description: "Your ID documents couldn't be uploaded during registration. Please upload them from your Profile page to complete KYC verification.",
          variant: "destructive",
          duration: 8000,
        });
      }
      if (sessionStorage.getItem("biometric_save_failed") === "1") {
        sessionStorage.removeItem("biometric_save_failed");
        toast({
          title: "Biometric not saved",
          description: "Could not save biometric login. You can enable it later from Profile › Security Settings.",
          duration: 6000,
        });
      }
    } catch { }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const { data: availableFeatures } = useQuery({
    queryKey: ["rider-available-features"],
    queryFn: () => api.getAvailableFeatures(),
    staleTime: 0,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    enabled: !!user?.id,
  });

  const { data: verifStatus, isSuccess: verifLoaded } = useQuery({
    queryKey: ["rider-verification-status-home"],
    queryFn: () => api.getVerificationStatus(),
    staleTime: 0,
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
    enabled: !!user?.id,
  });

  /* Etag push-refresh: when the server bumps updatedAt (e.g. admin verifies phone)
     the next poll picks up the new timestamp and immediately triggers a full profile
     re-fetch — so the rider app reflects admin actions within one polling cycle.  */
  const lastVerifUpdatedAtRef = useRef<string | null>(null);
  useEffect(() => {
    const newTs = verifStatus?.updatedAt ?? null;
    if (
      newTs !== null &&
      lastVerifUpdatedAtRef.current !== null &&
      newTs !== lastVerifUpdatedAtRef.current
    ) {
      void refreshUser?.();
    }
    if (newTs !== null) lastVerifUpdatedAtRef.current = newTs;
  }, [verifStatus?.updatedAt]);

  useEffect(() => {
    let mounted = true;
    void sweepAndLoadDismissed().then((ids) => {
      if (mounted && ids.size > 0) setDismissed(ids);
    });
    /* Check audio lock state on mount */
    setAudioLocked(isAudioLocked());
    return () => { mounted = false; };
  }, []);

  const [silenceOn, setSilenceOn] = useState(getSilenceMode());
  const prevIdsRef = useRef<Set<string>>(new Set());
  const soundIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const announceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasUnseenRequestsRef = useRef(false);
  const [silenced, setSilenced] = useState(isSilenced());
  const [silenceRemaining, setSilenceRemaining] = useState(getSilenceRemaining());
  const [showSilenceMenu, setShowSilenceMenu] = useState(false);

  useEffect(() => {
    const handler = () => {
      unlockAudio();
      setAudioLocked(false);
    };
    document.addEventListener("click", handler, { once: true });
    document.addEventListener("touchstart", handler, { once: true });
    return () => {
      if (soundIntervalRef.current) clearInterval(soundIntervalRef.current);
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
      if (announceTimerRef.current) clearTimeout(announceTimerRef.current);
      document.removeEventListener("click", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, []);

  const { socket: sharedSocket, connected: socketConnected, setRiderPosition } = useSocket();

  useEffect(() => {
    if (!silenced) return;
    const t = setInterval(() => {
      const rem = getSilenceRemaining();
      setSilenceRemaining(rem);
      if (rem <= 0) {
        setSilenced(false);
        setShowSilenceMenu(false);
      }
    }, 1000);
    return () => clearInterval(t);
  }, [silenced]);

  const [wakeLockWarning, setWakeLockWarning] = useState(false);
  const [optimisticOnline, setOptimisticOnline] = useState<boolean | null>(null);
  const effectiveOnline = optimisticOnline != null ? optimisticOnline : !!user?.isOnline;

  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  /* Session-scoped biometric gate for ride/order acceptance.
     Set to true once the rider passes the prompt so subsequent accepts in the
     same session are seamless (no repeated prompts). Reset to false on logout
     (component unmount). */
  const biometricClearedRef = useRef(false);

  /* Wraps an accept action with a one-per-session biometric check.
     - If biometrics are not available/enrolled on this device: proceed silently.
     - If cleared already this session: proceed immediately.
     - On prompt failure: show toast, block the action (do not proceed). */
  const runWithBiometricGate = useCallback(async (action: () => void): Promise<void> => {
    if (biometricClearedRef.current) {
      action();
      return;
    }
    try {
      const { isBiometricAvailable, verifyBiometric } = await import("../lib/biometric");
      /* Use the device-level availability check (hardware + OS enrollment),
         not the user's login-preference flag, so the gate fires for all
         riders with biometrics enrolled on the device. */
      const available = await isBiometricAvailable();
      if (!available) {
        action();
        return;
      }
      const passed = await verifyBiometric("Confirm ride acceptance");
      if (passed) {
        biometricClearedRef.current = true;
        action();
      } else {
        toast({ title: "Biometric check failed — please try again", variant: "destructive" });
      }
    } catch {
      /* Biometric module unavailable or threw — fail-open so the rider
         is not permanently blocked from accepting rides on unsupported devices. */
      action();
    }
  }, []);

  const TOGGLE_DEBOUNCE_MS = 1000;
  const lastToggleRef = useRef<number>(0);
  /* Ref kept in sync with the derived totalRequests value (defined after the
     query hooks below). Using a ref avoids both a forward-reference TypeScript
     error and a stale closure inside toggleOnline's useCallback. */
  const totalRequestsRef = useRef(0);
  /* Sync-queue for the online toggle: when PATCH /rider/online fails due to a
     network outage we keep the optimistic state alive and store the intended
     target here.  A window 'online' listener retries the PATCH on reconnect. */
  const pendingOnlineTargetRef = useRef<boolean | null>(null);

  const [showOfflineConfirm, setShowOfflineConfirm] = useState(false);
  const [zoneWarning, setZoneWarning] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    setLastSeenOnlineAt((prev) => prev ?? new Date().toISOString());
  }, [user]);

  /* Proactively compute the active blocking gate from rider profile flags.
     Priority mirrors the server-side 3-gate check order:
       1. phone verification  2. account approval  3. wallet balance
     Uses fresh verifStatus from server (refreshed every 60s + on focus) so
     that admin-side verification is reflected without a full logout/login. */
  useEffect(() => {
    if (!user) { setBlockingReason(null); return; }
    const phoneVerified = verifLoaded ? verifStatus!.phoneVerified : (user as { phoneVerified?: boolean }).phoneVerified;
    const approvalStatus = (user as { approvalStatus?: string }).approvalStatus;
    const minBal = config.rider?.minBalance ?? 0;
    const walletBal = Number(user.walletBalance) || 0;
    if (!phoneVerified) {
      setBlockingReason("phone_not_verified");
    } else if (approvalStatus && approvalStatus !== "approved") {
      setBlockingReason("account_not_approved");
    } else if (minBal > 0 && walletBal < minBal) {
      setBlockingReason("insufficient_wallet_balance");
    } else {
      setBlockingReason(null);
    }
  }, [user, verifStatus, config.rider?.minBalance]);

  const doActualToggle = useCallback(async () => {
    const now = Date.now();
    lastToggleRef.current = now;
    setToggling(true);
    const newStatus = !effectiveOnline;
    setOptimisticOnline(newStatus);
    let succeeded = false;
    let cancelled = false;
    try {
      const result = await api.setOnline(newStatus);
      /* If a newer toggle happened while this request was in-flight, drop its
         side-effects so the UI never oscillates between two concurrent calls. */
      if (lastToggleRef.current !== now) { cancelled = true; return; }
      if (!isMountedRef.current) return;
      /* Reconcile optimistic state with server-confirmed value immediately so
         a fast double-tap always shows the correct state even before refreshUser. */
      const confirmedOnline = (result as { isOnline?: boolean } | null)?.isOnline ?? newStatus;
      setOptimisticOnline(confirmedOnline);
      if (confirmedOnline) {
        const ts = Date.now();
        setOnlineSince(ts);
        try { sessionStorage.setItem("_ajkm_onlineSince", String(ts)); } catch {}
      } else {
        setOnlineSince(null);
        try { sessionStorage.removeItem("_ajkm_onlineSince"); } catch {}
      }
      if (result?.serviceZoneWarning) {
        setZoneWarning(result.serviceZoneWarning);
      } else {
        setZoneWarning(null);
      }
      await refreshUser()
        .then(() => {
          if (lastToggleRef.current === now && isMountedRef.current) {
            setLastSeenOnlineAt(new Date().toISOString());
          }
        })
        .catch((err) => {
          log.error(
            { err: err instanceof Error ? err.message : String(err) },
            "[Home] refreshUser failed"
          );
        });
      if (!isMountedRef.current || lastToggleRef.current !== now) return;
      succeeded = true;
      toast({ title: newStatus ? T("youAreNowOnline") : T("youAreNowOffline") });
    } catch (e: unknown) {
      if (!isMountedRef.current || cancelled || lastToggleRef.current !== now) return;
      /* Network-error detection: if the browser is offline or the error looks
         like a fetch failure, keep the optimistic state and queue for retry on
         reconnect.  Any other error (4xx/5xx) rolls back immediately. */
      const isNetworkError =
        !navigator.onLine ||
        (e instanceof Error &&
          (e.message === "Failed to fetch" ||
            e.message.toLowerCase().includes("networkerror") ||
            e.message.toLowerCase().includes("network request failed")));
      if (isNetworkError) {
        pendingOnlineTargetRef.current = newStatus;
        toast({ title: "You're offline — will sync when reconnected", variant: "destructive" });
      } else {
        setOptimisticOnline(!newStatus);
        pendingOnlineTargetRef.current = null;
        toast({ title: e instanceof Error ? e.message : T("somethingWentWrong"), variant: "destructive" });
      }
    } finally {
      if (isMountedRef.current && !cancelled && lastToggleRef.current === now) {
        if (succeeded) setOptimisticOnline(null);
        setToggling(false);
      }
    }
  }, [effectiveOnline, refreshUser, T]);

  /* Reconnect handler: retry a queued online/offline toggle when the browser
     comes back online.  Uses window 'online' event so it fires even before the
     socket reconnects. */
  useEffect(() => {
    const handleReconnect = async () => {
      if (pendingOnlineTargetRef.current === null) return;
      const target = pendingOnlineTargetRef.current;
      pendingOnlineTargetRef.current = null;
      try {
        await api.setOnline(target);
        if (isMountedRef.current) {
          await refreshUser().catch(() => {});
          setOptimisticOnline(null);
          toast({ title: target ? T("youAreNowOnline") : T("youAreNowOffline") });
        }
      } catch {
        if (isMountedRef.current) {
          setOptimisticOnline(!target);
          toast({ title: T("somethingWentWrong"), variant: "destructive" });
        }
      }
    };
    window.addEventListener("online", handleReconnect);
    return () => window.removeEventListener("online", handleReconnect);
  }, [api, refreshUser, T]);

  const toggleOnline = useCallback(async () => {
    const now = Date.now();
    if (toggling || now - lastToggleRef.current < TOGGLE_DEBOUNCE_MS) return;
    lastToggleRef.current = now;

    /* Feature gate: phone must be verified before a rider can go online.
       Use fresh verifStatus (polled from server) to reflect admin-side verification. */
    const goingOnline = !effectiveOnline;
    const phoneVerifiedFresh = verifLoaded ? verifStatus!.phoneVerified : (user as { phoneVerified?: boolean } | null)?.phoneVerified;
    if (goingOnline && !phoneVerifiedFresh) {
      toast({ title: "Verify your phone number to go online", variant: "destructive" });
      return;
    }
    /* Feature gate: email must be verified (when provided) before going online. */
    const emailVerifiedFresh = verifLoaded ? verifStatus!.emailVerified : (user as { emailVerified?: boolean } | null)?.emailVerified;
    if (
      goingOnline &&
      (user as { email?: string } | null)?.email &&
      !emailVerifiedFresh
    ) {
      toast({ title: "Verify your email address to go online", variant: "destructive" });
      return;
    }

    if (effectiveOnline && totalRequestsRef.current > 0) {
      setShowOfflineConfirm(true);
      return;
    }

    await doActualToggle();
  }, [toggling, effectiveOnline, doActualToggle, user]);

  const { data: earningsData } = useQuery({
    queryKey: ["rider-earnings"],
    queryFn: () => api.getEarnings(),
    refetchInterval: tabVisible ? 60000 : false,
    enabled: tabVisible,
  });

  const { data: activeData } = useQuery({
    queryKey: ["rider-active"],
    queryFn: () => api.getActive(),
    refetchInterval: tabVisible ? 8000 : false,
    staleTime: 60_000,
    enabled: effectiveOnline && tabVisible,
  });
  const hasActiveTask = !!(activeData?.order || activeData?.ride);

  const {
    data: requestsData,
    isLoading: requestsLoading,
    isError: requestsError,
  } = useQuery({
    queryKey: ["rider-requests"],
    queryFn: () => api.getRequests(),
    /* Socket is now the primary real-time path (new_order / order_cancelled events).
       REST polling is demoted to a long fallback (30 s minimum) so we still
       recover from any missed socket events without hammering the server. */
    refetchInterval:
      tabVisible && effectiveOnline
        ? Math.max(getPollingIntervalForTier(networkTier), 30_000)
        : 120_000,
    staleTime: 60_000,
    enabled: effectiveOnline,
  });

  const { data: cancelStatsData } = useQuery({
    queryKey: ["rider-cancel-stats"],
    queryFn: () => api.getCancelStats(),
    refetchInterval: tabVisible ? 120000 : false,
    staleTime: 60000,
  });

  const { data: ignoreStatsData } = useQuery({
    queryKey: ["rider-ignore-stats"],
    queryFn: () => api.getIgnoreStats(),
    refetchInterval: tabVisible ? 120000 : false,
    staleTime: 60000,
  });

  const allOrders: Order[] = requestsData?.orders || []; // eslint-disable-line react-hooks/exhaustive-deps
  const allRides: Ride[] = requestsData?.rides || []; // eslint-disable-line react-hooks/exhaustive-deps
  /* Server time from the API envelope — used to offset AcceptCountdown for clock drift */
  const requestsServerTime: string | null = requestsData?._serverTime ?? null;

  /* Sync dismissed set with server: drop dismissed IDs no longer on server */
  useEffect(() => {
    if (!requestsData) return;
    const serverIds = new Set<string>([
      ...allOrders.map((o) => o.id),
      ...allRides.map((r) => r.id),
    ]);
    setDismissed((prev) => {
      /* Keep only IDs that still exist on the server */
      const next = new Set([...prev].filter((id) => serverIds.has(id)));
      if (next.size === prev.size) return prev;
      [...prev].filter((id) => !serverIds.has(id)).forEach((id) => removeDismissed(id));
      return next;
    });
  }, [requestsData]); // eslint-disable-line react-hooks/exhaustive-deps

  /* New-request flash — pulse the header text; ring around the card container */
  const currentIdsSig = [...allOrders.map((o) => o.id), ...allRides.map((r) => r.id)]
    .sort()
    .join(",");
  useEffect(() => {
    /* Clear stale flash / announce timers before each run so overlapping
       request waves don't leave dangling timeouts from previous effect runs. */
    if (flashTimerRef.current) {
      clearTimeout(flashTimerRef.current);
      flashTimerRef.current = null;
    }
    if (announceTimerRef.current) {
      clearTimeout(announceTimerRef.current);
      announceTimerRef.current = null;
    }

    const currentIds = new Set<string>(currentIdsSig.split(",").filter(Boolean));
    const prevIds = prevIdsRef.current;
    let hasNew = false;
    let newCount = 0;
    currentIds.forEach((id) => {
      if (!prevIds.has(id)) { hasNew = true; newCount++; }
    });

    if (hasNew && currentIds.size > 0) {
      setNewFlash(true);
      flashTimerRef.current = setTimeout(() => setNewFlash(false), 2500);
      /* Recheck audio lock before playing — policy may have changed since mount */
      const locked = isAudioLocked();
      setAudioLocked(locked);
      if (!locked) playRequestSound();
      hasUnseenRequestsRef.current = true;
      /* Announce new requests to screen readers */
      const msg =
        newCount === 1 ? "New request available" : `${newCount} new requests available`;
      setSrAnnouncement("");
      announceTimerRef.current = setTimeout(() => setSrAnnouncement(msg), 50);
    }

    if (currentIds.size === 0) {
      hasUnseenRequestsRef.current = false;
      if (soundIntervalRef.current) {
        clearInterval(soundIntervalRef.current);
        soundIntervalRef.current = null;
      }
    } else if (hasUnseenRequestsRef.current) {
      if (soundIntervalRef.current) {
        clearInterval(soundIntervalRef.current);
        soundIntervalRef.current = null;
      }
      soundIntervalRef.current = setInterval(() => {
        if (
          hasUnseenRequestsRef.current &&
          !getSilenceMode() &&
          !isSilenced() &&
          !document.hidden &&
          !isAudioLocked()
        )
          playRequestSound();
      }, 8000);
    }

    prevIdsRef.current = currentIds;
  }, [currentIdsSig]);

  /* On tab re-focus: purge expired dismissed entries, then refetch */
  useEffect(() => {
    const handler = () => {
      const visible = !document.hidden;
      setTabVisible(visible);
      if (visible) {
        /* Recheck audio lock — browser may re-suspend AudioContext while hidden */
        setAudioLocked(isAudioLocked());
        /* Sweep expired dismissed entries before triggering the refetch */
        void sweepAndLoadDismissed().then((freshIds) => {
          if (!isMountedRef.current) return;
          setDismissed(freshIds);
          void qc.invalidateQueries({ queryKey: ["rider-requests"] });
          void qc.invalidateQueries({ queryKey: ["rider-active"] });
        });
      }
    };
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, [qc]);

  useEffect(() => {
    if (!effectiveOnline || !tabVisible) return;
    if (!("wakeLock" in navigator)) {
      setWakeLockWarning(true);
      return;
    }

    let sentinel: WakeLockSentinel | null = null;
    let cancelled = false;

    const acquire = async () => {
      try {
        if (cancelled || document.hidden) return;
        sentinel = await (
          navigator as Navigator & {
            wakeLock: { request(type: string): Promise<WakeLockSentinel> };
          }
        ).wakeLock.request("screen");
        setWakeLockWarning(false);
      } catch (err) {
        log.error(
          { err: err instanceof Error ? err.message : String(err) },
          "[Home] GPS watchPosition error"
        );
      }
    };

    void acquire();

    return () => {
      cancelled = true;
      sentinel?.release().catch((err) => {
        log.error(
          { err: err instanceof Error ? err.message : String(err) },
          "[Home] sentinel release failed"
        );
      });
    };
  }, [effectiveOnline, tabVisible]);

  useEffect(() => {
    const handleLogout = () => {
      setDismissed(new Set());
      void clearAllDismissed();
    };
    window.addEventListener("ajkmart:logout", handleLogout);
    return () => window.removeEventListener("ajkmart:logout", handleLogout);
  }, []);

  /* Show a warning toast when the offline queue falls back to in-memory storage
     (IndexedDB unavailable). The action is queued but will not survive a reload. */
  useEffect(() => {
    const handlePersistFail = () => {
      toast({ title: "Action queued offline — reopen the app to ensure it is saved.", variant: "destructive" });
    };
    window.addEventListener("ajkm:queue-persistence-failed", handlePersistFail);
    return () => window.removeEventListener("ajkm:queue-persistence-failed", handlePersistFail);
  }, []);

  const [gpsWarning, setGpsWarning] = useState<string | null>(null);
  const gpsWarningRef = useRef<string | null>(null);

  const setGpsWarningWithRef = useCallback((val: string | null) => {
    gpsWarningRef.current = val;
    setGpsWarning(val);
  }, []);

  const batteryRef = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (typeof navigator === "undefined" || !("getBattery" in navigator)) return;
    type BattMgr = {
      level: number;
      addEventListener: (e: string, cb: () => void) => void;
      removeEventListener: (e: string, cb: () => void) => void;
    };
    let mounted = true;
    let batt: BattMgr | undefined;
    const onLevelChange = () => {
      if (batt) batteryRef.current = Math.round(batt.level * 100);
    };
    (navigator as unknown as { getBattery: () => Promise<BattMgr> })
      .getBattery()
      .then((b) => {
        if (!mounted) return;
        batt = b;
        batteryRef.current = Math.round(b.level * 100);
        b.addEventListener("levelchange", onLevelChange);
      })
      .catch((err) => {
        log.error(
          { err: err instanceof Error ? err.message : String(err) },
          "[Home] GPS ping enqueue failed"
        );
      });
    return () => {
      mounted = false;
      batt?.removeEventListener("levelchange", onLevelChange);
    };
  }, []);

  /* Socket event listeners — invalidate queries on new or changed requests */
  useEffect(() => {
    if (!sharedSocket) return;
    const handleNewRequest = (raw: unknown) => {
      const payload = parseNewOrderPayload(raw);
      if (!payload?.order_id) {
        void qc.invalidateQueries({ queryKey: ["rider-requests"] });
        return;
      }
      const timerSec = payload.timer ?? ACCEPT_TIMEOUT_SEC;
      const elapsedMs = Math.max(0, ACCEPT_TIMEOUT_SEC - timerSec) * 1000;
      const syntheticCreatedAt = new Date(Date.now() - elapsedMs).toISOString();
      const syntheticRide: import("../lib/api").Ride = {
        id: payload.order_id,
        status: "pending",
        fare: payload.fare ?? undefined,
        pickupAddress: payload.pickup ?? undefined,
        dropAddress: payload.drop ?? undefined,
        createdAt: syntheticCreatedAt,
      };
      qc.setQueryData(
        ["rider-requests"],
        (old: { orders?: import("../lib/api").Order[]; rides?: import("../lib/api").Ride[]; _serverTime?: string | null } | undefined) => {
          const existingOrders = old?.orders ?? [];
          const existingRides = old?.rides ?? [];
          if (existingRides.some((r) => r.id === payload.order_id)) return old;
          return {
            ...old,
            orders: existingOrders,
            rides: [syntheticRide, ...existingRides],
            _serverTime: old?._serverTime ?? new Date().toISOString(),
          };
        }
      );
      void qc.invalidateQueries({ queryKey: ["rider-requests"] });
      if (!isAudioLocked()) playRequestSound();
    };
    /* Also listen for admin/customer-driven state changes */
    const handleStateChange = () => {
      void qc.invalidateQueries({ queryKey: ["rider-requests"] });
      void qc.invalidateQueries({ queryKey: ["rider-active"] });
    };
    /* Invalidate earnings immediately when a delivery or ride completes so the
       Home screen progress bar updates within seconds instead of waiting for the
       60-second polling cycle. The mutations in Active.tsx also call this on the
       happy-path; this socket handler covers cases where the update arrives via
       server push (e.g. admin marks delivered, or another tab completes the task). */
    const handleCompletionEvent = () => {
      void qc.invalidateQueries({ queryKey: ["rider-requests"] });
      void qc.invalidateQueries({ queryKey: ["rider-active"] });
      void qc.invalidateQueries({ queryKey: ["rider-earnings"] });
    };
    /* ride:assigned — server pushes the assigned ride summary to the rider.
       We validate the payload shape before invalidating queries so malformed
       payloads can never trigger unexpected re-renders. */
    const handleRideAssigned = (raw: unknown) => {
      const payload = parseRideAssignedPayload(raw);
      if (!payload) return;
      void qc.invalidateQueries({ queryKey: ["rider-requests"] });
      void qc.invalidateQueries({ queryKey: ["rider-active"] });
      /* Navigate to the Active page so the rider sees the assigned ride
         immediately without having to tap the bottom nav. */
      setLocation("/active");
    };
    /* new_order — real-time ride/order request pushed by the server.
       Socket is the primary path for showing the accept UI. We:
       1. Inject a synthetic Ride into the rider-requests cache immediately
          so the accept card and countdown appear before the REST refetch
          completes. The `createdAt` is back-calculated from payload.timer so
          AcceptCountdown displays exactly `timer` seconds remaining on first
          render.
       2. Schedule a background invalidation to replace the synthetic entry
          with full server data (addresses, fare, etc.) once the refetch lands.
       If the payload fails validation we fall back to a plain invalidation. */
    const handleNewOrder = (raw: unknown) => {
      const payload = parseNewOrderPayload(raw);
      if (!payload) {
        void qc.invalidateQueries({ queryKey: ["rider-requests"] });
        return;
      }
      const timerSec = payload.timer ?? ACCEPT_TIMEOUT_SEC;
      /* Back-calculate createdAt so elapsed = ACCEPT_TIMEOUT_SEC - timerSec,
         which makes AcceptCountdown show exactly timerSec remaining. */
      const elapsedMs = Math.max(0, ACCEPT_TIMEOUT_SEC - timerSec) * 1000;
      const syntheticCreatedAt = new Date(Date.now() - elapsedMs).toISOString();
      const syntheticRide: import("../lib/api").Ride = {
        id: payload.order_id,
        status: "pending",
        fare: payload.fare ?? undefined,
        pickupAddress: payload.pickup ?? undefined,
        dropAddress: payload.drop ?? undefined,
        createdAt: syntheticCreatedAt,
      };
      log.info(
        { orderId: payload.order_id, timerSec, syntheticCreatedAt },
        "[Home] new_order — injecting synthetic ride into cache"
      );
      /* Merge synthetic ride into existing cache so existing requests are preserved */
      qc.setQueryData(
        ["rider-requests"],
        (old: { orders?: import("../lib/api").Order[]; rides?: import("../lib/api").Ride[]; _serverTime?: string | null } | undefined) => {
          const existingOrders = old?.orders ?? [];
          const existingRides = old?.rides ?? [];
          /* Don't add a duplicate if the REST poll already fetched this ride */
          if (existingRides.some((r) => r.id === payload.order_id)) return old;
          return {
            ...old,
            orders: existingOrders,
            rides: [syntheticRide, ...existingRides],
            _serverTime: old?._serverTime ?? new Date().toISOString(),
          };
        }
      );
      /* Background refetch replaces the synthetic entry with full server data */
      void qc.invalidateQueries({ queryKey: ["rider-requests"] });
    };
    /* order_cancelled — pending request withdrawn before rider accepts.
       Remove from the cache optimistically and show a dismissible toast so the
       rider is not left looking at an already-gone request card. */
    const handleOrderCancelled = (raw: unknown) => {
      if (!isMountedRef.current) return;
      const payload = parseOrderCancelledPayload(raw);
      const cancelledId = payload?.order_id;
      if (cancelledId) {
        qc.setQueryData(
          ["rider-requests"],
          (old: { orders?: { id: string }[]; rides?: { id: string }[] } | undefined) => {
            if (!old) return old;
            return {
              ...old,
              orders: (old.orders ?? []).filter((o) => o.id !== cancelledId),
              rides: (old.rides ?? []).filter((r) => r.id !== cancelledId),
            };
          }
        );
      } else {
        void qc.invalidateQueries({ queryKey: ["rider-requests"] });
      }
      const reason = payload?.reason;
      trackEvent("ride_cancelled", { request_id: cancelledId ?? "unknown", reason: reason ?? "" });
      toast({ title: reason ? `Order cancelled: ${reason}` : T("requestCancelled"), variant: "destructive" });
    };
    /* order_accepted / ride:accepted — another rider won the request.
       Remove the card from the feed optimistically and inform this rider. */
    const handleOrderAccepted = (raw: unknown) => {
      if (!isMountedRef.current) return;
      const payload = parseOrderAcceptedPayload(raw);
      const acceptedId = payload?.order_id ?? payload?.ride_id ?? payload?.id;
      if (acceptedId) {
        qc.setQueryData(
          ["rider-requests"],
          (old: { orders?: { id: string }[]; rides?: { id: string }[] } | undefined) => {
            if (!old) return old;
            return {
              ...old,
              orders: (old.orders ?? []).filter((o) => o.id !== acceptedId),
              rides: (old.rides ?? []).filter((r) => r.id !== acceptedId),
            };
          }
        );
      } else {
        void qc.invalidateQueries({ queryKey: ["rider-requests"] });
      }
      toast({ title: "Sorry, this order was taken.", variant: "destructive" });
    };
    /* ride:counter_accepted / counter_offer_accepted — customer accepted the
       rider's counter offer.  Navigate to active by invalidating both caches. */
    const handleCounterAccepted = (raw: unknown) => {
      if (!isMountedRef.current) return;
      const payload = parseCounterResultPayload(raw);
      const acceptedId = payload?.ride_id ?? payload?.order_id ?? payload?.id;
      if (acceptedId) {
        qc.setQueryData(
          ["rider-requests"],
          (old: { orders?: { id: string }[]; rides?: { id: string }[] } | undefined) => {
            if (!old) return old;
            return {
              ...old,
              orders: (old.orders ?? []).filter((o) => o.id !== acceptedId),
              rides: (old.rides ?? []).filter((r) => r.id !== acceptedId),
            };
          }
        );
      }
      void qc.invalidateQueries({ queryKey: ["rider-requests"] });
      void qc.invalidateQueries({ queryKey: ["rider-active"] });
      toast({ title: "Counter accepted! Go to active task." });
    };
    /* ride:counter_declined / counter_offer_declined — customer declined the
       rider's counter offer.  Remove the card and inform the rider. */
    const handleCounterDeclined = (raw: unknown) => {
      if (!isMountedRef.current) return;
      const payload = parseCounterResultPayload(raw);
      const declinedId = payload?.ride_id ?? payload?.order_id ?? payload?.id;
      if (declinedId) {
        qc.setQueryData(
          ["rider-requests"],
          (old: { orders?: { id: string }[]; rides?: { id: string }[] } | undefined) => {
            if (!old) return old;
            return {
              ...old,
              orders: (old.orders ?? []).filter((o) => o.id !== declinedId),
              rides: (old.rides ?? []).filter((r) => r.id !== declinedId),
            };
          }
        );
      } else {
        void qc.invalidateQueries({ queryKey: ["rider-requests"] });
      }
      toast({ title: "Customer declined your counter offer.", variant: "destructive" });
    };
    sharedSocket.on("rider:new_request", handleNewRequest);
    sharedSocket.on("new:request", handleNewRequest);
    sharedSocket.on("new_order", handleNewOrder);
    sharedSocket.on("ride:assigned", handleRideAssigned);
    sharedSocket.on("rider:request-cancelled", handleStateChange);
    sharedSocket.on("order_cancelled", handleOrderCancelled);
    sharedSocket.on("order_accepted", handleOrderAccepted);
    sharedSocket.on("ride:accepted", handleOrderAccepted);
    sharedSocket.on("ride:counter_accepted", handleCounterAccepted);
    sharedSocket.on("counter_offer_accepted", handleCounterAccepted);
    sharedSocket.on("ride:counter_declined", handleCounterDeclined);
    sharedSocket.on("counter_offer_declined", handleCounterDeclined);
    sharedSocket.on("rider:ride-updated", handleCompletionEvent);
    sharedSocket.on("rider:order-updated", handleCompletionEvent);
    return () => {
      sharedSocket.off("rider:new_request", handleNewRequest);
      sharedSocket.off("new:request", handleNewRequest);
      sharedSocket.off("new_order", handleNewOrder);
      sharedSocket.off("ride:assigned", handleRideAssigned);
      sharedSocket.off("rider:request-cancelled", handleStateChange);
      sharedSocket.off("order_cancelled", handleOrderCancelled);
      sharedSocket.off("order_accepted", handleOrderAccepted);
      sharedSocket.off("ride:accepted", handleOrderAccepted);
      sharedSocket.off("ride:counter_accepted", handleCounterAccepted);
      sharedSocket.off("counter_offer_accepted", handleCounterAccepted);
      sharedSocket.off("ride:counter_declined", handleCounterDeclined);
      sharedSocket.off("counter_offer_declined", handleCounterDeclined);
      sharedSocket.off("rider:ride-updated", handleCompletionEvent);
      sharedSocket.off("rider:order-updated", handleCompletionEvent);
    };
  }, [sharedSocket, qc, T]);

  /* GPS watch — idle Home screen, no active task.
     The socket heartbeat (socket.tsx) is the sole liveness signal.
     REST pings here only update the stored coordinate when position changes
     meaningfully; they are not keepalive traffic. Memoized haversineMeters
     from helpers.ts is used so no redundant trig runs per position event. */
  useEffect(() => {
    if (!user?.isOnline || hasActiveTask || !user?.id) return;
    if (!navigator?.geolocation) return;

    let lastSentTime = 0;
    let lastLat: number | null = null;
    let lastLng: number | null = null;
    /* Only send REST location updates on meaningful movement. No time-based
       periodic fallback — the socket heartbeat is the sole liveness signal. */
    const MIN_DISTANCE_METERS = 25;
    /* Minimum interval to debounce burst callbacks from the OS */
    const DEBOUNCE_MS = 1000;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const now = Date.now();
        const { latitude, longitude, accuracy, speed, heading } = pos.coords;

        /* Heuristic mock-GPS check: accuracy below the configurable threshold
           combined with zero speed and no heading is a strong mock-location
           signal. Threshold comes from platform config (default: 5 m) so ops
           can tune it without a code deploy. Server-side spoof detection is
           the authoritative gate. */
        const _gpsThreshold = config?.security?.minGpsAccuracy ?? 5;
        const isMockGps = accuracy < _gpsThreshold && speed === 0 && heading == null;
        if (isMockGps) {
          setGpsWarningWithRef(
            "Suspicious GPS accuracy detected. Please disable mock location apps."
          );
          return;
        }

        /* Pakistan hard bounding box — client-side pre-filter mirrors gpsSpoof.ts.
           Drop the ping and show a rider-facing toast so the issue is visible. */
        if (
          latitude < 23.5 || latitude > 37.1 ||
          longitude < 60.8 || longitude > 77.8
        ) {
          setGpsWarningWithRef("Your location appears to be outside the service area.");
          toast({ title: "Your location appears to be outside the service area.", variant: "destructive" });
          return;
        }

        if (now - lastSentTime < DEBOUNCE_MS) return;

        /* Always update the shared socket position cache so the heartbeat
           has a fresh position without running its own GPS listener */
        setRiderPosition(latitude, longitude);

        /* memoized haversine — skip REST ping if position hasn't changed meaningfully */
        if (lastLat != null && lastLng != null) {
          const dist = haversineMeters(lastLat, lastLng, latitude, longitude);
          if (dist < MIN_DISTANCE_METERS) return;
        }
        /* No previous position — record it but don't send a keepalive ping;
           the socket heartbeat already signals liveness to the server. */
        if (lastLat == null) {
          lastLat = latitude;
          lastLng = longitude;
          lastSentTime = now;
          return;
        }

        lastSentTime = now;
        lastLat = latitude;
        lastLng = longitude;
        const locationData = {
          latitude,
          longitude,
          accuracy: accuracy ?? undefined,
          speed: speed ?? undefined,
          heading: heading ?? undefined,
          batteryLevel: batteryRef.current,
        };
        const queuedPing = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          timestamp: new Date().toISOString(),
          ...locationData,
        };

        if (!navigator.onLine) {
          enqueue(queuedPing).catch((err) => {
            log.error(
              { err: err instanceof Error ? err.message : String(err) },
              "[Home] GPS ping enqueue failed"
            );
            /* H-02: Toast so the rider knows location tracking silently failed. */
            toast({ title: T("gpsLocationError"), variant: "destructive" });
          });
          return;
        }

        api
          .updateLocation(locationData)
          .then(() => {
            if (gpsWarningRef.current) setGpsWarningWithRef(null);
          })
          .catch((err: Error & { code?: string }) => {
            const msg = err.message || "";
            const isSpoofError =
              msg.toLowerCase().includes("spoof") || msg.toLowerCase().includes("mock");
            const isOutOfRegion =
              err.code === "GPS_OUT_OF_REGION" ||
              msg.toLowerCase().includes("outside the service region") ||
              msg.toLowerCase().includes("gps_out_of_region");
            if (isOutOfRegion) {
              setGpsWarningWithRef("Your location appears to be outside the service area.");
              toast({ title: "Your location appears to be outside the service area.", variant: "destructive" });
            } else if (isSpoofError) {
              setGpsWarningWithRef(`GPS Spoof Detected: ${msg}`);
            } else {
              enqueue(queuedPing).catch((err) => {
                log.error(
                  { err: err instanceof Error ? err.message : String(err) },
                  "[Home] GPS ping enqueue failed"
                );
                /* H-02: Toast on GPS enqueue failure so it's visible, not just a warning bar. */
                toast({ title: T("gpsLocationError"), variant: "destructive" });
              });
              setGpsWarningWithRef(T("gpsLocationError"));
            }
          });
      },
      (error: GeolocationPositionError) => {
        if (error.code === error.PERMISSION_DENIED) {
          /* Rider denied location access — Settings must be opened manually. */
          log.warn("[Home] GPS permission denied by user");
          setGpsWarningWithRef(T("gpsNotAvailable"));
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          /* Hardware/network can't determine position — likely GPS off. */
          setGpsWarningWithRef(T("gpsNotAvailable"));
        } else {
          /* TIMEOUT — transient signal loss; use the less alarming message. */
          setGpsWarningWithRef(T("gpsLocationError"));
        }
      },
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 30_000 }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [user?.isOnline, hasActiveTask, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  /* PF5: Memoize the filtered request lists so unrelated re-renders (e.g.
     typing into a controlled input on Home, GPS-driven `setGpsWarning`
     updates) don't re-allocate these arrays and force every request card to
     re-render. The dismissed set is a stable identity within React state, so
     including it as a dep is correct. T2: typed callbacks instead of `any`. */
  const orders = useMemo(
    () => allOrders.filter((o: Order) => !dismissed.has(o.id)),
    [allOrders, dismissed]
  );
  const rides = useMemo(
    () => allRides.filter((r: Ride) => !dismissed.has(r.id)),
    [allRides, dismissed]
  );
  const visibleOrders = useMemo(() => {
    const features = config?.features ?? {};
    return orders.filter((o: Order) => {
      const t = o.type ?? "";
      if (t === "food" && features.food === false) return false;
      if (t === "mart" && features.mart === false) return false;
      if (t === "van" && features.van === false) return false;
      return true;
    });
  }, [orders, config]);
  const visibleRides = useMemo(() => {
    const features = config?.features ?? {};
    return features.rides === false ? [] : rides;
  }, [rides, config]);
  const totalRequests = visibleOrders.length + visibleRides.length;
  totalRequestsRef.current = totalRequests;

  const dismiss = useCallback(
    (id: string) => {
      void addDismissed(id);
      setDismissed((prev) => {
        const next = new Set([...prev, id]);
        const serverIds = new Set<string>([
          ...allOrders.map((o) => o.id),
          ...allRides.map((r) => r.id),
        ]);
        const remainingVisible = [...serverIds].filter((sid) => !next.has(sid));
        if (remainingVisible.length === 0) {
          hasUnseenRequestsRef.current = false;
          if (soundIntervalRef.current) {
            clearInterval(soundIntervalRef.current);
            soundIntervalRef.current = null;
          }
        }
        return next;
      });
    },
    [allOrders, allRides]
  );

  const stopRequestSoundIfEmpty = () => {
    const remainingCount = allOrders.length + allRides.length;
    if (remainingCount <= 1) {
      hasUnseenRequestsRef.current = false;
      if (soundIntervalRef.current) {
        clearInterval(soundIntervalRef.current);
        soundIntervalRef.current = null;
      }
    }
  };

  /* O2: Order/Ride accept mutations.
     - We invalidate `rider-requests` in `onSettled` so both the win path
       (server returns the order) and the loss path (409 race / "already
       taken") trigger a refetch from a single place. The previous code
       invalidated in `onError` and `onSuccess` separately, which meant the
       409 race could briefly show a "ghost" accepted card before the refetch
       completed.
     - We never navigate to /active from here; the rider's BottomNav handles
       routing. This avoids the original bug where the loser of a race
       navigated to /active and saw a 404. */
  const acceptOrderMut = useMutation({
    mutationFn: (id: string) => api.acceptOrder(id),
    onSuccess: (_: unknown, id: string) => {
      /* Accepted items should NOT be added to the dismissed set (dismissed = rejected by rider).
         Remove the id from dismissed persistence if it was there, and prune cache directly. */
      removeDismissed(id).catch((err: unknown) => {
        log.debug("[Home] removeDismissed order accept failed:", err);
      });
      setDismissed((prev) => {
        const next = new Set([...prev]);
        next.delete(id);
        return next;
      });
      qc.setQueryData(
        ["rider-requests"],
        (old: { orders?: { id: string }[]; rides?: { id: string }[] } | undefined) => {
          if (!old) return old;
          return { ...old, orders: (old.orders ?? []).filter((o) => o.id !== id) };
        }
      );
      stopRequestSoundIfEmpty();
      void qc.invalidateQueries({ queryKey: ["rider-active"] });
      toast({ title: T("orderAcceptedActiveTab") });
    },
    onError: (e: Error & { status?: number; reason?: string }, id) => {
      if (e?.status === 409 || /already taken|already accepted/i.test(e?.message || "")) {
        dismiss(id);
        qc.setQueryData(
          ["rider-requests"],
          (old: { orders?: { id: string }[]; rides?: { id: string }[] } | undefined) => {
            if (!old) return old;
            return { ...old, orders: (old.orders || []).filter((o) => o.id !== id) };
          }
        );
        toast({ title: T("orderAlreadyTaken"), variant: "destructive" });
      } else if (e?.status === 403 && e?.reason) {
        /* Server told us exactly which gate is blocking — surface the matching banner */
        setBlockingReason(e.reason);
        toast({ title: e.message || T("couldNotAcceptOrder"), variant: "destructive" });
      } else {
        /* Persist to IndexedDB queue so the accept survives connectivity loss */
        const looksLikeNetErr = /network|fetch|timeout|offline/i.test(e?.message || "");
        if (looksLikeNetErr)
          enqueueAction("accept_order", id, {}).catch((err) => {
            log.error(
              { err: err instanceof Error ? err.message : String(err) },
              "[Home] enqueueAction accept_order failed"
            );
          });
        toast({ title: e.message || T("couldNotAcceptOrder"), variant: "destructive" });
      }
    },
    onSettled: () => {
      setAcceptingOrderId(null);
      void qc.invalidateQueries({ queryKey: ["rider-requests"] });
    },
  });

  const showFeatureBlocked = useCallback(
    (_featureName: string, missing: string[], _fallbackMsg?: string | null, reason?: "not_accessible" | "daily_limit_exceeded") => {
      if (reason !== "daily_limit_exceeded" && missing.length > 0) {
        addBlockedVerifications(missing);
      }
    },
    [addBlockedVerifications]
  );

  const rejectOrderMut = useMutation({
    mutationFn: (id: string) => api.rejectOrder(id),
    onSuccess: (_: unknown, id: string) => {
      dismiss(id);
      void qc.invalidateQueries({ queryKey: ["rider-requests"] });
      trackEvent("ride_declined", { request_id: id, type: "order" });
      toast({ title: T("orderRejected") });
    },
    onError: (e: Error) => {
      void qc.invalidateQueries({ queryKey: ["rider-requests"] });
      toast({ title: e.message || T("couldNotRejectOrder"), variant: "destructive" });
    },
  });

  const acceptRideMut = useMutation({
    mutationFn: (id: string) => api.acceptRide(id),
    onSuccess: (_: unknown, id: string) => {
      /* Accepted items should NOT be added to the dismissed set (dismissed = rejected by rider).
         Remove the id from dismissed persistence if it was there, and prune cache directly. */
      removeDismissed(id).catch((err: unknown) => {
        log.debug("[Home] removeDismissed ride accept failed:", err);
      });
      setDismissed((prev) => {
        const next = new Set([...prev]);
        next.delete(id);
        return next;
      });
      qc.setQueryData(
        ["rider-requests"],
        (old: { orders?: { id: string }[]; rides?: { id: string }[] } | undefined) => {
          if (!old) return old;
          return { ...old, rides: (old.rides ?? []).filter((r) => r.id !== id) };
        }
      );
      stopRequestSoundIfEmpty();
      void qc.invalidateQueries({ queryKey: ["rider-active"] });
      logRideEvent(id, "accepted", (msg, isErr) => toast({ title: msg, variant: isErr ? "destructive" : "default" }));
      trackEvent("ride_accepted", { ride_id: id });
      toast({ title: T("rideAcceptedActiveTab") });
    },
    onError: (e: Error & { status?: number; reason?: string }, id) => {
      if (e?.status === 409 || /already taken|already accepted/i.test(e?.message || "")) {
        dismiss(id);
        qc.setQueryData(
          ["rider-requests"],
          (old: { orders?: { id: string }[]; rides?: { id: string }[] } | undefined) => {
            if (!old) return old;
            return { ...old, rides: (old.rides || []).filter((r) => r.id !== id) };
          }
        );
        toast({ title: T("rideAlreadyTaken"), variant: "destructive" });
      } else if (e?.status === 403 && e?.reason) {
        /* Server told us exactly which gate is blocking — surface the matching banner */
        setBlockingReason(e.reason);
        toast({ title: e.message || T("couldNotAcceptRide"), variant: "destructive" });
      } else {
        /* Persist to IndexedDB queue so the accept survives connectivity loss */
        const looksLikeNetErr = /network|fetch|timeout|offline/i.test(e?.message || "");
        if (looksLikeNetErr)
          enqueueAction("accept_ride", id, {}).catch((err) => {
            log.error(
              { err: err instanceof Error ? err.message : String(err) },
              "[Home] enqueueAction accept_ride failed"
            );
          });
        toast({ title: e.message || T("couldNotAcceptRide"), variant: "destructive" });
      }
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ["rider-requests"] });
    },
  });

  const counterRideMut = useMutation({
    mutationFn: ({ id, counterFare }: { id: string; counterFare: number }) =>
      api.counterRide(id, { counterFare }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["rider-requests"] });
      toast({ title: T("counterOfferSent") });
    },
    onError: (e: Error) => {
      void qc.invalidateQueries({ queryKey: ["rider-requests"] });
      toast({ title: e.message || T("counterOfferFailed"), variant: "destructive" });
    },
  });

  const rejectOfferMut = useMutation({
    mutationFn: (id: string) => api.rejectOffer(id),
    onSuccess: (_: unknown, id: string) => {
      dismiss(id);
      void qc.invalidateQueries({ queryKey: ["rider-requests"] });
      trackEvent("ride_declined", { request_id: id, type: "ride" });
      toast({ title: T("rideSkipped") });
    },
    onError: (e: Error) => {
      void qc.invalidateQueries({ queryKey: ["rider-requests"] });
      toast({ title: e.message, variant: "destructive" });
    },
  });

  interface IgnorePenaltyData {
    ignorePenalty?: { penaltyApplied?: number; restricted?: boolean; dailyIgnores?: number };
    penaltyApplied?: number;
    restricted?: boolean;
    dailyIgnores?: number;
  }

  const ignoreRideMut = useMutation({
    mutationFn: (id: string) => api.ignoreRide(id),
    onSuccess: (data: IgnorePenaltyData, id: string) => {
      dismiss(id);
      void qc.invalidateQueries({ queryKey: ["rider-requests"] });
      const p = data?.ignorePenalty ?? data;
      if ((p?.penaltyApplied ?? 0) > 0) {
        toast({ title: `Ignored — ${currency} ${p.penaltyApplied} penalty deducted!${p.restricted ? " Account restricted." : ""}`, variant: "destructive" });
      } else {
        toast({ title: `Ride ignored (${p?.dailyIgnores || "?"} today).` });
      }
    },
    onError: (e: Error) => {
      void qc.invalidateQueries({ queryKey: ["rider-requests"] });
      toast({ title: e.message || "Ignore failed", variant: "destructive" });
    },
  });

  const toggleSilence = () => {
    const next = !getSilenceMode();
    setSilenceMode(next);
    setSilenceOn(next);
    toast({ title: next ? "Silence mode ON — no alert sounds" : "Silence mode OFF — sounds enabled" });
  };

  /* Pull-to-refresh: invalidate live request feed + active task + re-sync
     the rider's own profile so balance / status changes show immediately. */
  const handlePullRefresh = useCallback(async () => {
    await Promise.allSettled([
      qc.invalidateQueries({ queryKey: ["rider-requests"] }),
      qc.invalidateQueries({ queryKey: ["rider-active"] }),
      refreshUser(),
    ]);
  }, [qc, refreshUser]);

  if (authLoading) return <SkeletonHome />;

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return T("goodMorning");
    if (h < 17) return T("goodAfternoon");
    return T("goodEvening");
  })();
  const lastSeenOnlineLabel = lastSeenOnlineAt
    ? new Date(lastSeenOnlineAt).toLocaleString("en-PK", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "Syncing profile…";

  /* Count how many top-fixed banners are currently active (28 px each).
     This must mirror the logic in FixedBanners so the header always sits
     below the last visible banner regardless of how many are showing. */
  const BANNER_H_PX = 28;
  const topBannerCount =
    (!socketConnected && effectiveOnline ? 1 : 0) +
    (!!zoneWarning && effectiveOnline ? 1 : 0) +
    (audioLocked && effectiveOnline ? 1 : 0);
  const topBannerOffsetPx = topBannerCount * BANNER_H_PX;

  return (
    <PullToRefresh
      onRefresh={handlePullRefresh}
      accentColor="var(--color-brand)"
      className="flex min-h-screen animate-[fadeIn_0.3s_ease-out] flex-col bg-page-bg"
    >
      {/* Screen-reader live region — announces incoming requests without visual impact */}
      <div role="status" aria-live="assertive" aria-atomic="true" className="sr-only">
        {srAnnouncement}
      </div>
      <FixedBanners
        socketConnected={socketConnected}
        effectiveOnline={effectiveOnline}
        zoneWarning={zoneWarning}
        onDismissZone={() => setZoneWarning(null)}
        wakeLockWarning={wakeLockWarning}
        onDismissWakeLock={() => setWakeLockWarning(false)}
        audioLocked={audioLocked}
        onUnlockAudio={() => {
          unlockAudio();
          setAudioLocked(false);
        }}
        onRetryConnect={() => sharedSocket?.connect()}
        T={T}
      />

      <header
        className="relative overflow-hidden rounded-b-[2rem] bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 px-4 pb-6 text-white sm:px-6 sm:pb-8"
        style={{
          paddingTop: `calc(env(safe-area-inset-top, 0px) + 3.5rem + ${topBannerOffsetPx}px)`,
        }}
      >
        <div className="absolute -top-20 -right-20 h-72 w-72 rounded-full bg-success/[0.04]" />
        <div className="absolute bottom-10 -left-16 h-56 w-56 rounded-full bg-white/[0.02]" />
        <div className="absolute top-1/2 right-1/4 h-32 w-32 rounded-full bg-white/[0.015]" />

        <div className="relative mx-auto max-w-2xl">
          <div className="mb-5 flex items-start justify-between">
            <div>
              <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold tracking-widest text-white/40 uppercase">
                <Clock size={11} /> <LiveClock /> · AJKMart Rider
              </p>
              {user?.id && (
                <p className="mb-0.5 font-mono text-[10px] font-bold tracking-widest text-white/30 uppercase">
                  {`AJK-${user.id.replace(/-/g, "").slice(0, 8).toUpperCase()}`}
                </p>
              )}
              <h1
                className={`text-[20px] leading-tight font-extrabold tracking-tight transition-colors sm:text-[22px] ${newFlash ? "text-success" : "text-white"}`}
              >
                {greeting}, {user?.name?.split(" ")[0] || "Rider"} 👋
              </h1>
              <p className="mt-1 text-[11px] font-medium text-white/65">
                Last seen online • {lastSeenOnlineLabel}
              </p>
              {newFlash && (
                <p className="mt-0.5 flex animate-pulse items-center gap-1 text-[11px] font-bold text-success">
                  <span className="h-1.5 w-1.5 rounded-full bg-success" />
                  New request available!
                </p>
              )}
            </div>
            <Link
              href="/wallet"
              className="flex flex-shrink-0 flex-col items-end"
              aria-label="View wallet balance"
            >
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.06] px-3 py-2 text-right backdrop-blur-sm sm:px-3.5">
                <p className="text-[9px] font-bold tracking-wider text-white/40 uppercase">
                  {T("wallet")}
                </p>
                <p className="text-base leading-tight font-extrabold sm:text-lg">
                  {formatCurrency(user?.walletBalance ?? "0", currency)}
                </p>
              </div>
            </Link>
          </div>

          <OnlineToggleCard
            effectiveOnline={effectiveOnline}
            toggling={toggling}
            silenceOn={silenceOn}
            blockingReason={blockingReason}
            onToggleOnline={toggleOnline}
            onToggleSilence={toggleSilence}
            T={T}
          />

          <SilenceControls
            silenced={silenced}
            silenceRemaining={silenceRemaining}
            showSilenceMenu={showSilenceMenu}
            onSetShowSilenceMenu={setShowSilenceMenu}
            onSetSilenced={setSilenced}
            onSetSilenceRemaining={setSilenceRemaining}
          />

          <StatsGrid
            deliveriesToday={user?.stats?.deliveriesToday || 0}
            acceptanceRate={
              cancelStatsData?.cancelRate != null
                ? Math.max(0, 100 - cancelStatsData.cancelRate)
                : null
            }
            rating={user?.stats?.rating ?? null}
            maxDeliveries={config.rider?.maxDeliveries ?? 3}
          />
        </div>
      </header>

      <main className="relative z-10 mx-auto w-full max-w-2xl space-y-3 px-3 pt-4 pb-[calc(4rem+env(safe-area-inset-bottom,0px))] sm:px-4">
        <InlineWarnings
          gpsWarning={gpsWarning}
          onDismissGps={() => setGpsWarning(null)}
          isRestricted={!!user?.isRestricted}
          riderNotice={config.content.riderNotice}
          riderNoticeDismissed={dismissed.has("rider-notice")}
          onDismissRiderNotice={() => {
            void addDismissed("rider-notice");
            setDismissed((prev) => {
              const next = new Set(prev);
              next.add("rider-notice");
              return next;
            });
          }}
          cancelStatsData={cancelStatsData}
          ignoreStatsData={ignoreStatsData}
          currency={currency}
          minBalance={config.rider?.minBalance ?? 0}
          walletBalance={Number(user?.walletBalance) || 0}
        />

        {/* ── Blocking gate banners ─────────────────────────────────────────────
            Proactively surfaced from rider profile flags AND reactively set
            when an accept returns a 403 with a machine-readable reason.
            Non-dismissible because the gate must be resolved to accept rides. */}
        {blockingReason === "phone_not_verified" && (
          <div
            className="flex items-start gap-3 rounded-2xl border-2 border-brand/40 bg-brand/10 px-4 py-3.5 shadow-sm"
            role="alert"
          >
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-brand/15">
              <Smartphone size={18} className="text-brand" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-extrabold text-brand">Verify your phone number</p>
              <p className="mt-0.5 text-xs leading-relaxed text-brand/80">
                Phone verification is required before you can accept rides.
              </p>
              <Link
                href="/profile"
                className="mt-1.5 flex items-center gap-1 text-[10px] font-bold text-brand underline underline-offset-2"
              >
                Verify <ArrowUpRight size={10} />
              </Link>
            </div>
          </div>
        )}

        {blockingReason === "account_not_approved" && (
          <div
            className="flex items-start gap-3 rounded-2xl border-2 border-warning/40 bg-warning/10 px-4 py-3.5 shadow-sm"
            role="alert"
          >
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-warning/15">
              <Lock size={18} className="text-warning" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-extrabold text-warning">Account pending admin approval</p>
              <p className="mt-0.5 text-xs leading-relaxed text-warning/80">
                Your account is under review. You will be notified once approved and can then
                accept rides.
              </p>
            </div>
          </div>
        )}

        {blockingReason === "insufficient_wallet_balance" && (
          <Link href="/wallet">
            <div
              className="flex cursor-pointer items-start gap-3 rounded-2xl border-2 border-error/40 bg-error/10 px-4 py-3.5 shadow-sm transition-transform active:scale-[0.98]"
              role="alert"
            >
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-error/15">
                <Wallet size={18} className="text-error" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-extrabold text-error">
                  Top up wallet — minimum {currency} {Math.round(config.rider?.minBalance ?? 0)} required
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-error/80">
                  Your balance:{" "}
                  <strong>
                    {currency} {Math.round(Number(user?.walletBalance) || 0)}
                  </strong>
                  . You need at least{" "}
                  <strong>
                    {currency} {Math.round(config.rider?.minBalance ?? 0)}
                  </strong>{" "}
                  to accept cash orders.
                </p>
                <p className="mt-1.5 flex items-center gap-1 text-[10px] font-bold text-error">
                  Top Up <ArrowUpRight size={10} />
                </p>
              </div>
            </div>
          </Link>
        )}

        {/* KYC status banner — shows when kycStatus !== 'approved' so riders
            know exactly which documents are still missing before they can
            accept rides. Non-dismissible because it blocks ride acceptance. */}
        <KycStatusBanner
          kycStatus={user?.kycStatus}
          vehicleType={user?.vehicleType}
          vehiclePhoto={user?.vehiclePhoto}
          drivingLicense={user?.drivingLicense}
          rejectionReason={user?.rejectionReason}
        />

        {/* Progressive Verification banner — shows locked features */}
        {(() => {
          if (!availableFeatures?.features) return null;
          const locked = availableFeatures.features.filter((f) => !f.accessible);
          if (locked.length === 0) return null;
          const missingSet = new Set<string>();
          locked.forEach((f) => f.missingVerifications.forEach((v) => missingSet.add(v)));
          const missingList = Array.from(missingSet);
          if (missingList.length === 0) return null;
          return (
            <div className="flex items-start gap-3 rounded-2xl border border-warning/20 bg-warning/10 px-4 py-3">
              <Lock size={15} className="mt-0.5 flex-shrink-0 text-warning" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-warning">
                  Complete verification to unlock all features
                </p>
                <div className="mt-1 space-y-0.5">
                  {missingList.map((v) => (
                    <p key={v} className="flex items-center gap-1 text-[10px] text-warning/80">
                      <span className="h-1 w-1 flex-shrink-0 rounded-full bg-warning" />
                      {v === "phone_verified" && "Phone number not verified"}
                      {v === "email_verified" && "Email address not verified"}
                      {v === "documents_approved" && "CNIC documents not approved"}
                      {v === "phone" && "Phone number not verified"}
                      {v === "email" && "Email address not verified"}
                      {v === "documents" && "CNIC documents not approved"}
                      {!["phone_verified", "email_verified", "documents_approved", "phone", "email", "documents"].includes(v) && v}
                    </p>
                  ))}
                </div>
                <Link
                  to="/profile"
                  className="mt-1.5 inline-block text-[10px] font-bold text-warning underline underline-offset-2"
                >
                  Go to Profile →
                </Link>
              </div>
            </div>
          );
        })()}

        {/* Incomplete profile banner — dismissible per session */}
        {(() => {
          const hasBankInfo = !!(user?.bankName && user?.bankAccount);
          const kycStatus = (user as { kycStatus?: string } | null)?.kycStatus ?? "none";
          const kycVerified = kycStatus === "verified" || kycStatus === "pending";
          const phoneVerified = !!(verifLoaded ? verifStatus!.phoneVerified : (user as { phoneVerified?: boolean } | null)?.phoneVerified);
          const emailVerified = !!(verifLoaded ? verifStatus!.emailVerified : (user as { emailVerified?: boolean } | null)?.emailVerified);
          const showBankBanner = !hasBankInfo;
          const showKycBanner = config.wallet?.kycRequired && !kycVerified;
          const showPhoneBanner = !phoneVerified;
          const showEmailBanner = !!(user?.email) && !emailVerified;
          if (profileBannerDismissed || (!showBankBanner && !showKycBanner && !showPhoneBanner && !showEmailBanner)) return null;

          const dismissBanner = () => {
            try {
              sessionStorage.setItem("_ajkm_profileBannerDismissed", "1");
            } catch (err) {
              log.warn("[Home] sessionStorage.setItem failed:", err);
            }
            setProfileBannerDismissed(true);
          };

          return (
            <div className="flex items-start gap-3 rounded-2xl border border-warning/30 bg-warning/10 px-4 py-3">
              <AlertTriangle size={15} className="mt-0.5 flex-shrink-0 text-warning" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-warning">
                  Complete your profile to unlock withdrawals
                </p>
                <div className="mt-1 space-y-0.5">
                  {showPhoneBanner && (
                    <p className="flex items-center gap-1 text-[10px] text-warning">
                      <span className="h-1 w-1 flex-shrink-0 rounded-full bg-warning" />
                      Phone number not verified
                    </p>
                  )}
                  {showEmailBanner && (
                    <p className="flex items-center gap-1 text-[10px] text-warning">
                      <span className="h-1 w-1 flex-shrink-0 rounded-full bg-warning" />
                      Email address not verified
                    </p>
                  )}
                  {showBankBanner && (
                    <p className="flex items-center gap-1 text-[10px] text-warning">
                      <span className="h-1 w-1 flex-shrink-0 rounded-full bg-warning" />
                      Bank account not added
                    </p>
                  )}
                  {showKycBanner && (
                    <p className="flex items-center gap-1 text-[10px] text-warning">
                      <span className="h-1 w-1 flex-shrink-0 rounded-full bg-warning" />
                      KYC not verified
                    </p>
                  )}
                </div>
                <Link
                  to="/profile"
                  className="mt-1.5 text-[10px] font-bold text-warning underline underline-offset-2"
                >
                  Go to Profile →
                </Link>
              </div>
              <button
                onClick={dismissBanner}
                className="flex-shrink-0 p-0.5 text-warning transition-colors hover:text-warning"
                aria-label="Dismiss banner"
              >
                ✕
              </button>
            </div>
          );
        })()}

        <TodaySummaryWidget
          todayEarned={earningsData?.today?.earnings ?? user?.stats?.earningsToday ?? 0}
          todayRides={earningsData?.today?.deliveries ?? user?.stats?.deliveriesToday ?? 0}
          onlineSince={onlineSince}
          isOnline={effectiveOnline}
          currency={currency}
          language={language}
        />

        <GoalSection
          adminGoal={config.rider?.dailyGoal ?? 5000}
          personalGoal={earningsData?.dailyGoal ?? user?.dailyGoal ?? null}
          todayEarnings={earningsData?.today?.earnings ?? user?.stats?.earningsToday ?? 0}
          currency={currency}
          T={T}
          refreshUser={refreshUser}
        />

        {config.content.trackerBannerEnabled &&
          hasActiveTask &&
          config.content.trackerBannerPosition === "top" && (
            <ActiveTaskBanner activeData={activeData} variant="green" />
          )}

        {user?.isOnline ? (
          <>
            {hasActiveTask && !config.content.trackerBannerEnabled && (
              <ActiveTaskBanner activeData={activeData} variant="amber" />
            )}

            <div
              className={`overflow-hidden rounded-3xl shadow-sm transition-all duration-300 ${newFlash ? "ring-4 ring-green-400 ring-offset-2 ring-offset-page-bg" : ""}`}
            >
              <RequestListHeader totalRequests={totalRequests} T={T} />
              <HomeRequestList
                requestsLoading={requestsLoading}
                requestsError={requestsError}
                totalRequests={totalRequests}
                dismissed={dismissed}
                onClearDismissed={() => {
                  setDismissed(new Set());
                  void clearAllDismissed();
                }}
                orders={visibleOrders}
                rides={visibleRides}
                currency={currency}
                config={config}
                onAcceptOrder={(id) => {
                  if (isNetworkOffline) {
                    toast({ title: "No internet — cannot accept while offline", variant: "destructive" });
                    return;
                  }
                  /* Client-side gate (cached rules + local usage counter) */
                  if (!acceptOrderGate.isLoading && !acceptOrderGate.accessible) {
                    if (acceptOrderGate.cacheWasEmpty) {
                      toast({ title: "Checking your account status…" });
                      void refreshFeatureRules();
                      return;
                    }
                    showFeatureBlocked(
                      "Accept Orders",
                      acceptOrderGate.missingVerifications,
                      null,
                      acceptOrderGate.reason
                    );
                    return;
                  }
                  void runWithBiometricGate(() => {
                    setAcceptingOrderId(id);
                    acceptOrderMut.mutate(id, {
                      onSettled: () => setAcceptingOrderId(null),
                      onSuccess: () => {
                        if (user?.id) recordUsage(user.id, "accept_order");
                      },
                    });
                  });
                }}
                onRejectOrder={(id) => rejectOrderMut.mutate(id)}
                onAcceptRide={(id) => {
                  if (isNetworkOffline) {
                    toast({ title: "No internet — cannot accept while offline", variant: "destructive" });
                    return;
                  }
                  /* Client-side gate (cached rules + local usage counter).
                     Cache is absent (fresh login, private browsing, cleared storage) →
                     trigger a background fetch and show a transient notice. The server
                     will still enforce the gate if the rider is truly ineligible. */
                  if (!acceptRideGate.isLoading && !acceptRideGate.accessible) {
                    if (acceptRideGate.cacheWasEmpty) {
                      toast({ title: "Checking your account status…" });
                      void refreshFeatureRules();
                      return;
                    }
                    showFeatureBlocked(
                      "Accept Rides",
                      acceptRideGate.missingVerifications,
                      null,
                      acceptRideGate.reason
                    );
                    return;
                  }
                  void runWithBiometricGate(() => {
                    setAcceptingId(id);
                    acceptRideMut.mutate(id, {
                      onSettled: () => setAcceptingId(null),
                      onSuccess: () => {
                        if (user?.id) recordUsage(user.id, "accept_ride");
                      },
                    });
                  });
                }}
                onCounterRide={(id, fare) => counterRideMut.mutateAsync({ id, counterFare: fare })}
                onRejectOffer={(id) => rejectOfferMut.mutate(id)}
                onIgnoreRide={(id) => ignoreRideMut.mutate(id)}
                onDismiss={dismiss}
                isOffline={isNetworkOffline}
                acceptOrderPending={acceptOrderMut.isPending}
                rejectOrderPending={rejectOrderMut.isPending}
                acceptRidePending={acceptRideMut.isPending}
                acceptingRideId={acceptingId}
                acceptingOrderId={acceptingOrderId}
                counterRidePending={counterRideMut.isPending}
                rejectOfferPending={rejectOfferMut.isPending}
                ignoreRidePending={ignoreRideMut.isPending}
                requestsServerTime={requestsServerTime}
                userId={user?.id || ""}
                isRestricted={!!user?.isRestricted || user?.approvalStatus === "rejected"}
                onRetry={() => qc.invalidateQueries({ queryKey: ["rider-requests"] })}
                T={T}
              />
            </div>
          </>
        ) : (
          <div className="animate-[slideUp_0.3s_ease-out] rounded-3xl border border-white/10 bg-card-dark p-8 text-center shadow-sm sm:p-10">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-border-dark sm:h-20 sm:w-20">
              <Wifi size={32} className="text-[#B0B0B0]" />
            </div>
            <p className="text-base font-extrabold tracking-tight text-[#B0B0B0] sm:text-lg">
              You are Offline
            </p>
            <p className="mt-1.5 text-sm text-[#B0B0B0]">
              Toggle the switch above to start accepting orders
            </p>
            <button
              onClick={toggleOnline}
              disabled={toggling}
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-brand px-6 py-3 text-sm font-bold text-white shadow-sm shadow-brand/20 transition-all hover:bg-brand-hover active:scale-[0.98] disabled:opacity-60"
              aria-label="Go online to start accepting orders"
            >
              <Zap size={16} /> Go Online
            </button>
          </div>
        )}

        {config.content.trackerBannerEnabled &&
          hasActiveTask &&
          config.content.trackerBannerPosition === "bottom" && (
            <div className="mt-3">
              <ActiveTaskBanner activeData={activeData} variant="green" />
            </div>
          )}
      </main>



      {hasActiveTask && !config.content.trackerBannerEnabled && (
        <Link
          href="/active"
          className="fixed right-4 bottom-[calc(env(safe-area-inset-bottom,0px)+72px)] left-4 z-30 block animate-[slideUp_0.3s_ease-out] rounded-2xl bg-gradient-to-r from-green-500 to-emerald-600 px-4 py-3 shadow-lg shadow-green-300/40 transition-transform active:scale-[0.98]"
          aria-label="Go to active task"
        >
          <div className="mx-auto flex max-w-md items-center gap-2.5">
            <div className="h-2.5 w-2.5 flex-shrink-0 animate-pulse rounded-full bg-white" />
            <p className="flex-1 truncate text-sm font-extrabold text-white">
              {T("youHaveActiveTask")}
            </p>
            <ChevronRight size={14} className="flex-shrink-0 text-white/80" />
          </div>
        </Link>
      )}

      {showOfflineConfirm && (
        <OfflineConfirmDialog
          totalRequests={totalRequests}
          onStayOnline={() => setShowOfflineConfirm(false)}
          onGoOffline={async () => {
            setShowOfflineConfirm(false);
            await doActualToggle();
          }}
        />
      )}
    </PullToRefresh>
  );
}
