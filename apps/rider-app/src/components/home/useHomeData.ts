import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { tDual, type TranslationKey } from "@workspace/i18n";
import { useAuth } from "../../lib/rider-auth";
import { usePlatformConfig } from "../../lib/useConfig";
import { useLanguage } from "../../lib/useLanguage";
import { api, type Order, type Ride } from "../../lib/api";
import { useSocket } from "../../lib/socket";
import { useFeatureGate } from "../../lib/useFeatureGate";
import { useVerificationGate } from "../../lib/VerificationGateContext";
import { useNetworkQuality, getPollingIntervalForTier } from "../../hooks/useNetworkQuality";
import { recordUsage } from "../../lib/featureGate";
import { enqueueAction } from "../../lib/offline/queueManager";
import {
  addDismissed,
  clearAllDismissed,
  enqueue,
  removeDismissed,
  sweepAndLoadDismissed,
} from "../../lib/gpsQueue";
import {
  getSilenceMode,
  getSilenceRemaining,
  isAudioLocked,
  isSilenced,
  playRequestSound,
  setSilenceMode,
  unlockAudio,
} from "../../lib/notificationSound";
import { haversineMeters } from "../dashboard/helpers";
import { logRideEvent } from "../../lib/rideUtils";
import { trackEvent } from "../../lib/analytics";
import { toast } from "../../hooks/use-toast";
import { createLogger } from "../../lib/logger";
import {
  parseNewOrderPayload,
  parseOrderAcceptedPayload,
  parseOrderCancelledPayload,
  parseCounterResultPayload,
  parseRideAssignedPayload,
} from "../../lib/socketEvents";
import { useLocation } from "wouter";

const log = createLogger("[useHomeData]");
const ACCEPT_TIMEOUT_SEC = 90;

export interface UseHomeDataReturn {
  /* Auth & user */
  user: ReturnType<typeof useAuth>["user"];
  authLoading: boolean;
  refreshUser: () => Promise<void>;
  refreshFeatureRules: () => Promise<void>;
  greeting: string;
  lastSeenLabel: string;
  currency: string;
  T: (key: TranslationKey) => string;

  /* Online state */
  effectiveOnline: boolean;
  toggling: boolean;
  toggleOnline: () => Promise<void>;
  doActualToggle: () => Promise<void>;
  blockingReason: string | null;
  showOfflineConfirm: boolean;
  setShowOfflineConfirm: (v: boolean) => void;
  onlineSince: number | null;

  /* Sound */
  silenceOn: boolean;
  toggleSilence: () => void;
  silenced: boolean;
  silenceRemaining: number;
  showSilenceMenu: boolean;
  setShowSilenceMenu: (v: boolean) => void;
  setSilenced: (v: boolean) => void;
  setSilenceRemaining: (v: number) => void;
  audioLocked: boolean;
  setAudioLocked: (v: boolean) => void;
  unlockAudioCtx: () => void;

  /* Socket & network */
  socketConnected: boolean;
  isNetworkOffline: boolean;
  zoneWarning: string | null;
  setZoneWarning: (v: string | null) => void;
  wakeLockWarning: boolean;
  setWakeLockWarning: (v: boolean) => void;
  onRetryConnect: () => void;

  /* GPS */
  gpsWarning: string | null;
  setGpsWarning: (v: string | null) => void;

  /* Requests */
  requestsLoading: boolean;
  requestsError: boolean;
  totalRequests: number;
  visibleOrders: Order[];
  visibleRides: Ride[];
  requestsServerTime: string | null;
  newFlash: boolean;
  srAnnouncement: string;

  /* Dismissed */
  dismissed: Set<string>;
  setDismissed: React.Dispatch<React.SetStateAction<Set<string>>>;
  onClearDismissed: () => void;
  onDismiss: (id: string) => void;

  /* Active task */
  hasActiveTask: boolean;
  activeData: { order?: any; ride?: any } | null;

  /* Earnings / stats */
  earningsData: any;
  cancelStatsData: any;
  ignoreStatsData: any;

  /* Profile banner */
  profileBannerDismissed: boolean;
  setProfileBannerDismissed: (v: boolean) => void;

  /* Verification */
  verifStatus: any;
  verifLoaded: boolean;
  availableFeatures: any;

  /* Config */
  config: any;
  language: string;

  /* Accept actions */
  onAcceptOrder: (id: string) => void;
  onRejectOrder: (id: string) => void;
  onAcceptRide: (id: string) => void;
  onCounterRide: (id: string, fare: number) => Promise<void>;
  onRejectOffer: (id: string) => void;
  onIgnoreRide: (id: string) => void;
  acceptOrderPending: boolean;
  rejectOrderPending: boolean;
  acceptRidePending: boolean;
  acceptingRideId: string | null;
  acceptingOrderId: string | null;
  counterRidePending: boolean;
  rejectOfferPending: boolean;
  ignoreRidePending: boolean;

  /* Pull refresh */
  handlePullRefresh: () => Promise<void>;

  /* Rider notice */
  riderNotice: string;
  riderNoticeDismissed: boolean;
  onDismissRiderNotice: () => void;

  /* Tab visibility */
  tabVisible: boolean;

  /* Biometric */
  runWithBiometricGate: (action: () => void) => Promise<void>;

  /* Feature gates */
  acceptOrderGate: ReturnType<typeof useFeatureGate>;
  acceptRideGate: ReturnType<typeof useFeatureGate>;
  showFeatureBlocked: (feature: string, missing: string[], fallback?: string | null, reason?: "not_accessible" | "daily_limit_exceeded") => void;

  /* Network tier */
  networkTier: string;
}

export function useHomeData(): UseHomeDataReturn {
  const { user, refreshUser, loading: authLoading, refreshFeatureRules } = useAuth();
  const acceptOrderGate = useFeatureGate("accept_order");
  const acceptRideGate = useFeatureGate("accept_ride");
  const [, setLocation] = useLocation();
  const { tier: networkTier, isOffline: isNetworkOffline } = useNetworkQuality();
  const { config } = usePlatformConfig();
  const { language } = useLanguage();
  const T = useCallback((key: TranslationKey) => tDual(key, language), [language]);
  const currency = config.platform.currencySymbol ?? "Rs.";
  const qc = useQueryClient();

  const [toggling, setToggling] = useState(false);
  const [tabVisible, setTabVisible] = useState(!document.hidden);
  const [newFlash, setNewFlash] = useState(false);
  const [srAnnouncement, setSrAnnouncement] = useState("");
  const [dismissed, setDismissed] = useState<Set<string>>(new Set<string>());
  const [profileBannerDismissed, setProfileBannerDismissed] = useState(() => {
    try { return sessionStorage.getItem("_ajkm_profileBannerDismissed") === "1"; } catch { return false; }
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
  const [blockingReason, setBlockingReason] = useState<string | null>(null);
  const [audioLocked, setAudioLocked] = useState(false);
  const [silenceOn, setSilenceOn] = useState(getSilenceMode());
  const [silenced, setSilenced] = useState(isSilenced());
  const [silenceRemaining, setSilenceRemaining] = useState(getSilenceRemaining());
  const [showSilenceMenu, setShowSilenceMenu] = useState(false);
  const [wakeLockWarning, setWakeLockWarning] = useState(false);
  const [optimisticOnline, setOptimisticOnline] = useState<boolean | null>(null);
  const effectiveOnline = optimisticOnline != null ? optimisticOnline : !!user?.isOnline;
  const [showOfflineConfirm, setShowOfflineConfirm] = useState(false);
  const [zoneWarning, setZoneWarning] = useState<string | null>(null);
  const [gpsWarning, setGpsWarning] = useState<string | null>(null);
  const [riderNoticeDismissed, setRiderNoticeDismissed] = useState(() => {
    try { return sessionStorage.getItem("_ajkm_riderNoticeDismissed") === "1"; } catch { return false; }
  });

  const { addBlockedVerifications } = useVerificationGate();
  const { socket: sharedSocket, connected: socketConnected, setRiderPosition } = useSocket();

  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  const prevIdsRef = useRef<Set<string>>(new Set());
  const soundIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const announceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasUnseenRequestsRef = useRef(false);
  const totalRequestsRef = useRef(0);
  const lastToggleRef = useRef<number>(0);
  const pendingOnlineTargetRef = useRef<boolean | null>(null);
  const gpsWarningRef = useRef<string | null>(null);
  const biometricClearedRef = useRef(false);
  const batteryRef = useRef<number | undefined>(undefined);
  const lastVerifUpdatedAtRef = useRef<string | null>(null);

  const setGpsWarningWithRef = useCallback((val: string | null) => {
    gpsWarningRef.current = val;
    setGpsWarning(val);
  }, []);

  const TOGGLE_DEBOUNCE_MS = 1000;

  /* Queries */
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

  useEffect(() => {
    const newTs = verifStatus?.updatedAt ?? null;
    if (newTs !== null && lastVerifUpdatedAtRef.current !== null && newTs !== lastVerifUpdatedAtRef.current) {
      void refreshUser?.();
    }
    if (newTs !== null) lastVerifUpdatedAtRef.current = newTs;
  }, [verifStatus?.updatedAt, refreshUser]);

  useEffect(() => {
    let mounted = true;
    void sweepAndLoadDismissed().then((ids) => {
      if (mounted && ids.size > 0) setDismissed(ids);
    });
    setAudioLocked(isAudioLocked());
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    const handler = () => { unlockAudio(); setAudioLocked(false); };
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

  useEffect(() => {
    if (!silenced) return;
    const t = setInterval(() => {
      const rem = getSilenceRemaining();
      setSilenceRemaining(rem);
      if (rem <= 0) { setSilenced(false); setShowSilenceMenu(false); }
    }, 1000);
    return () => clearInterval(t);
  }, [silenced]);

  useEffect(() => {
    if (!user) return;
    setLastSeenOnlineAt((prev) => prev ?? new Date().toISOString());
  }, [user]);

  /* Seed onlineSince from API when no sessionStorage value and user is online */
  useEffect(() => {
    if (!user?.isOnline) return;
    try {
      const stored = sessionStorage.getItem("_ajkm_onlineSince");
      if (!stored) {
        const apiTs = (user as any)?.onlineSince;
        if (apiTs && typeof apiTs === "number" && apiTs > 0) {
          setOnlineSince(apiTs);
          sessionStorage.setItem("_ajkm_onlineSince", String(apiTs));
        }
      }
    } catch { /* sessionStorage unavailable */ }
  }, [user?.isOnline, (user as any)?.onlineSince]);

  useEffect(() => {
    if (!user) { setBlockingReason(null); return; }
    const phoneVerified = verifLoaded ? verifStatus?.phoneVerified : user?.phoneVerified;
    const approvalStatus = user?.approvalStatus;
    const minBal = config.rider?.minBalance ?? 0;
    const walletBal = Number(user?.walletBalance) || 0;
    if (!phoneVerified) setBlockingReason("phone_not_verified");
    else if (approvalStatus && approvalStatus !== "approved") setBlockingReason("account_not_approved");
    else if (minBal > 0 && walletBal < minBal) setBlockingReason("insufficient_wallet_balance");
    else setBlockingReason(null);
  }, [user, verifStatus, config.rider?.minBalance, verifLoaded]);

  /* Earnings */
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

  const { data: requestsData, isLoading: requestsLoading, isError: requestsError } = useQuery({
    queryKey: ["rider-requests"],
    queryFn: () => api.getRequests(),
    refetchInterval: tabVisible && effectiveOnline ? Math.max(getPollingIntervalForTier(networkTier), 30_000) : 120_000,
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

  const allOrders: Order[] = requestsData?.orders || [];
  const allRides: Ride[] = requestsData?.rides || [];
  const requestsServerTime: string | null = requestsData?._serverTime ?? null;

  useEffect(() => {
    if (!requestsData) return;
    const serverIds = new Set<string>([...allOrders.map((o) => o.id), ...allRides.map((r) => r.id)]);
    setDismissed((prev) => {
      const next = new Set([...prev].filter((id) => serverIds.has(id)));
      if (next.size === prev.size) return prev;
      [...prev].filter((id) => !serverIds.has(id)).forEach((id) => removeDismissed(id));
      return next;
    });
  }, [requestsData, allOrders, allRides]);

  const currentIdsSig = useMemo(() =>
    [...allOrders.map((o) => o.id), ...allRides.map((r) => r.id)].sort().join(","),
    [allOrders, allRides]
  );

  useEffect(() => {
    if (flashTimerRef.current) { clearTimeout(flashTimerRef.current); flashTimerRef.current = null; }
    if (announceTimerRef.current) { clearTimeout(announceTimerRef.current); announceTimerRef.current = null; }

    const currentIds = new Set<string>(currentIdsSig.split(",").filter(Boolean));
    const prevIds = prevIdsRef.current;
    let hasNew = false;
    let newCount = 0;
    currentIds.forEach((id) => { if (!prevIds.has(id)) { hasNew = true; newCount++; } });

    if (hasNew && currentIds.size > 0) {
      setNewFlash(true);
      flashTimerRef.current = setTimeout(() => setNewFlash(false), 2500);
      const locked = isAudioLocked();
      setAudioLocked(locked);
      if (!locked) playRequestSound();
      hasUnseenRequestsRef.current = true;
      const msg = newCount === 1 ? "New request available" : `${newCount} new requests available`;
      setSrAnnouncement("");
      announceTimerRef.current = setTimeout(() => setSrAnnouncement(msg), 50);
    }

    if (currentIds.size === 0) {
      hasUnseenRequestsRef.current = false;
      if (soundIntervalRef.current) { clearInterval(soundIntervalRef.current); soundIntervalRef.current = null; }
    } else if (hasUnseenRequestsRef.current) {
      if (soundIntervalRef.current) { clearInterval(soundIntervalRef.current); soundIntervalRef.current = null; }
      soundIntervalRef.current = setInterval(() => {
        if (hasUnseenRequestsRef.current && !getSilenceMode() && !isSilenced() && !document.hidden && !isAudioLocked())
          playRequestSound();
      }, 8000);
    }
    prevIdsRef.current = currentIds;
  }, [currentIdsSig]);

  useEffect(() => {
    const handler = () => {
      const visible = !document.hidden;
      setTabVisible(visible);
      if (visible) {
        setAudioLocked(isAudioLocked());
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
    if (!("wakeLock" in navigator)) { setWakeLockWarning(true); return; }
    let sentinel: any = null;
    let cancelled = false;
    const acquire = async () => {
      try {
        if (cancelled || document.hidden) return;
        sentinel = await (navigator as any).wakeLock.request("screen");
        setWakeLockWarning(false);
      } catch (err) {
        log.error({ err: err instanceof Error ? err.message : String(err) }, "[Home] wakeLock error");
      }
    };
    void acquire();
    return () => {
      cancelled = true;
      sentinel?.release?.().catch(() => {});
    };
  }, [effectiveOnline, tabVisible]);

  useEffect(() => {
    const handleLogout = () => { setDismissed(new Set()); void clearAllDismissed(); };
    window.addEventListener("ajkmart:logout", handleLogout);
    return () => window.removeEventListener("ajkmart:logout", handleLogout);
  }, []);

  useEffect(() => {
    const handlePersistFail = () => {
      toast({ title: "Action queued offline — reopen the app to ensure it is saved.", variant: "destructive" });
    };
    window.addEventListener("ajkm:queue-persistence-failed", handlePersistFail);
    return () => window.removeEventListener("ajkm:queue-persistence-failed", handlePersistFail);
  }, []);

  useEffect(() => {
    if (typeof navigator === "undefined" || !("getBattery" in navigator)) return;
    let mounted = true;
    let batt: any;
    const onLevelChange = () => { if (batt) batteryRef.current = Math.round(batt.level * 100); };
    (navigator as any).getBattery().then((b: any) => {
      if (!mounted) return;
      batt = b;
      batteryRef.current = Math.round(b.level * 100);
      b.addEventListener("levelchange", onLevelChange);
    }).catch(() => {});
    return () => {
      mounted = false;
      batt?.removeEventListener?.("levelchange", onLevelChange);
    };
  }, []);

  /* GPS */
  useEffect(() => {
    if (!user?.isOnline || hasActiveTask || !user?.id) return;
    if (!navigator?.geolocation) return;
    let lastSentTime = 0;
    let lastLat: number | null = null;
    let lastLng: number | null = null;
    const MIN_DISTANCE_METERS = 25;
    const DEBOUNCE_MS = 1000;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const now = Date.now();
        const { latitude, longitude, accuracy, speed, heading } = pos.coords;
        const _gpsThreshold = config?.security?.minGpsAccuracy ?? 5;
        const isMockGps = accuracy < _gpsThreshold && speed === 0 && heading == null;
        if (isMockGps) {
          setGpsWarningWithRef("Suspicious GPS accuracy detected. Please disable mock location apps.");
          return;
        }
        if (latitude < 23.5 || latitude > 37.1 || longitude < 60.8 || longitude > 77.8) {
          setGpsWarningWithRef("Your location appears to be outside the service area.");
          toast({ title: "Your location appears to be outside the service area.", variant: "destructive" });
          return;
        }
        if (now - lastSentTime < DEBOUNCE_MS) return;
        setRiderPosition(latitude, longitude);
        if (lastLat != null && lastLng != null) {
          const dist = haversineMeters(lastLat, lastLng, latitude, longitude);
          if (dist < MIN_DISTANCE_METERS) return;
        }
        if (lastLat == null) { lastLat = latitude; lastLng = longitude; lastSentTime = now; return; }
        lastSentTime = now; lastLat = latitude; lastLng = longitude;
        const locationData = { latitude, longitude, accuracy: accuracy ?? undefined, speed: speed ?? undefined, heading: heading ?? undefined, batteryLevel: batteryRef.current };
        const queuedPing = { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, timestamp: new Date().toISOString(), ...locationData };
        if (!navigator.onLine) {
          enqueue(queuedPing).catch(() => toast({ title: T("gpsLocationError"), variant: "destructive" }));
          return;
        }
        api.updateLocation(locationData).then(() => {
          if (gpsWarningRef.current) setGpsWarningWithRef(null);
        }).catch((err: Error & { code?: string }) => {
          const msg = err.message || "";
          const isSpoofError = msg.toLowerCase().includes("spoof") || msg.toLowerCase().includes("mock");
          const isOutOfRegion = err.code === "GPS_OUT_OF_REGION" || msg.toLowerCase().includes("outside the service region") || msg.toLowerCase().includes("gps_out_of_region");
          if (isOutOfRegion) {
            setGpsWarningWithRef("Your location appears to be outside the service area.");
            toast({ title: "Your location appears to be outside the service area.", variant: "destructive" });
          } else if (isSpoofError) {
            setGpsWarningWithRef(`GPS Spoof Detected: ${msg}`);
          } else {
            enqueue(queuedPing).catch(() => toast({ title: T("gpsLocationError"), variant: "destructive" }));
            setGpsWarningWithRef(T("gpsLocationError"));
          }
        });
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) setGpsWarningWithRef(T("gpsNotAvailable"));
        else if (error.code === error.POSITION_UNAVAILABLE) setGpsWarningWithRef(T("gpsNotAvailable"));
        else setGpsWarningWithRef(T("gpsLocationError"));
      },
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 30_000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [user?.isOnline, hasActiveTask, user?.id, config?.security?.minGpsAccuracy, setRiderPosition, T, setGpsWarningWithRef]);

  const orders = useMemo(() => allOrders.filter((o) => !dismissed.has(o.id)), [allOrders, dismissed]);
  const rides = useMemo(() => allRides.filter((r) => !dismissed.has(r.id)), [allRides, dismissed]);
  const visibleOrders = useMemo(() => {
    const features = config?.features ?? {};
    return orders.filter((o) => {
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

  const dismiss = useCallback((id: string) => {
    void addDismissed(id);
    setDismissed((prev) => {
      const next = new Set([...prev, id]);
      const serverIds = new Set<string>([...allOrders.map((o) => o.id), ...allRides.map((r) => r.id)]);
      const remainingVisible = [...serverIds].filter((sid) => !next.has(sid));
      if (remainingVisible.length === 0) {
        hasUnseenRequestsRef.current = false;
        if (soundIntervalRef.current) { clearInterval(soundIntervalRef.current); soundIntervalRef.current = null; }
      }
      return next;
    });
  }, [allOrders, allRides]);

  const stopRequestSoundIfEmpty = () => {
    const remainingCount = allOrders.length + allRides.length;
    if (remainingCount <= 1) {
      hasUnseenRequestsRef.current = false;
      if (soundIntervalRef.current) { clearInterval(soundIntervalRef.current); soundIntervalRef.current = null; }
    }
  };

  /* Mutations */
  const acceptOrderMut = useMutation({
    mutationFn: (id: string) => api.acceptOrder(id),
    onSuccess: (_: unknown, id: string) => {
      removeDismissed(id).catch(() => {});
      setDismissed((prev) => { const next = new Set([...prev]); next.delete(id); return next; });
      qc.setQueryData(["rider-requests"], (old: any) => {
        if (!old) return old;
        return { ...old, orders: (old.orders ?? []).filter((o: any) => o.id !== id) };
      });
      stopRequestSoundIfEmpty();
      void qc.invalidateQueries({ queryKey: ["rider-active"] });
      toast({ title: T("orderAcceptedActiveTab") });
    },
    onError: (e: any, id) => {
      if (e?.status === 409 || /already taken|already accepted/i.test(e?.message || "")) {
        dismiss(id);
        qc.setQueryData(["rider-requests"], (old: any) => {
          if (!old) return old;
          return { ...old, orders: (old.orders || []).filter((o: any) => o.id !== id) };
        });
        toast({ title: T("orderAlreadyTaken"), variant: "destructive" });
      } else if (e?.status === 403 && e?.reason) {
        setBlockingReason(e.reason);
        toast({ title: e.message || T("couldNotAcceptOrder"), variant: "destructive" });
      } else {
        const looksLikeNetErr = /network|fetch|timeout|offline/i.test(e?.message || "");
        if (looksLikeNetErr) enqueueAction("accept_order", id, {}).catch(() => {});
        toast({ title: e.message || T("couldNotAcceptOrder"), variant: "destructive" });
      }
    },
    onSettled: () => {
      setAcceptingOrderId(null);
      void qc.invalidateQueries({ queryKey: ["rider-requests"] });
    },
  });

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
      removeDismissed(id).catch(() => {});
      setDismissed((prev) => { const next = new Set([...prev]); next.delete(id); return next; });
      qc.setQueryData(["rider-requests"], (old: any) => {
        if (!old) return old;
        return { ...old, rides: (old.rides ?? []).filter((r: any) => r.id !== id) };
      });
      stopRequestSoundIfEmpty();
      void qc.invalidateQueries({ queryKey: ["rider-active"] });
      logRideEvent(id, "accepted", (msg, isErr) => toast({ title: msg, variant: isErr ? "destructive" : "default" }));
      trackEvent("ride_accepted", { ride_id: id });
      toast({ title: T("rideAcceptedActiveTab") });
    },
    onError: (e: any, id) => {
      if (e?.status === 409 || /already taken|already accepted/i.test(e?.message || "")) {
        dismiss(id);
        qc.setQueryData(["rider-requests"], (old: any) => {
          if (!old) return old;
          return { ...old, rides: (old.rides || []).filter((r: any) => r.id !== id) };
        });
        toast({ title: T("rideAlreadyTaken"), variant: "destructive" });
      } else if (e?.status === 403 && e?.reason) {
        setBlockingReason(e.reason);
        toast({ title: e.message || T("couldNotAcceptRide"), variant: "destructive" });
      } else {
        const looksLikeNetErr = /network|fetch|timeout|offline/i.test(e?.message || "");
        if (looksLikeNetErr) enqueueAction("accept_ride", id, {}).catch(() => {});
        toast({ title: e.message || T("couldNotAcceptRide"), variant: "destructive" });
      }
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ["rider-requests"] });
    },
  });

  const counterRideMut = useMutation({
    mutationFn: ({ id, counterFare }: { id: string; counterFare: number }) => api.counterRide(id, { counterFare }),
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

  const ignoreRideMut = useMutation({
    mutationFn: (id: string) => api.ignoreRide(id),
    onSuccess: (data: any, id: string) => {
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

  /* Biometric gate */
  const runWithBiometricGate = useCallback(async (action: () => void) => {
    if (biometricClearedRef.current) { action(); return; }
    try {
      const { isBiometricAvailable, verifyBiometric } = await import("../../lib/biometric");
      const available = await isBiometricAvailable();
      if (!available) { action(); return; }
      const passed = await verifyBiometric("Confirm ride acceptance");
      if (passed) { biometricClearedRef.current = true; action(); }
      else toast({ title: "Biometric check failed — please try again", variant: "destructive" });
    } catch { action(); }
  }, []);

  /* Toggle online */
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
      if (lastToggleRef.current !== now) { cancelled = true; return; }
      if (!isMountedRef.current) return;
      const confirmedOnline = (result as any)?.isOnline ?? newStatus;
      setOptimisticOnline(confirmedOnline);
      if (confirmedOnline) {
        const ts = Date.now();
        setOnlineSince(ts);
        try { sessionStorage.setItem("_ajkm_onlineSince", String(ts)); } catch {}
      } else {
        setOnlineSince(null);
        try { sessionStorage.removeItem("_ajkm_onlineSince"); } catch {}
      }
      if (result?.serviceZoneWarning) setZoneWarning(result.serviceZoneWarning);
      else setZoneWarning(null);
      await refreshUser().then(() => {
        if (lastToggleRef.current === now && isMountedRef.current) setLastSeenOnlineAt(new Date().toISOString());
      }).catch(() => {});
      if (!isMountedRef.current || lastToggleRef.current !== now) return;
      succeeded = true;
      toast({ title: newStatus ? T("youAreNowOnline") : T("youAreNowOffline") });
    } catch (e: unknown) {
      if (!isMountedRef.current || cancelled || lastToggleRef.current !== now) return;
      const isNetworkError = !navigator.onLine || (e instanceof Error && (e.message === "Failed to fetch" || e.message.toLowerCase().includes("networkerror") || e.message.toLowerCase().includes("network request failed")));
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
  }, [refreshUser, T]);

  const toggleOnline = useCallback(async () => {
    const now = Date.now();
    if (toggling || now - lastToggleRef.current < TOGGLE_DEBOUNCE_MS) return;
    lastToggleRef.current = now;
    const goingOnline = !effectiveOnline;
    const phoneVerifiedFresh = verifLoaded ? verifStatus?.phoneVerified : user?.phoneVerified;
    if (goingOnline && !phoneVerifiedFresh) {
      toast({ title: "Verify your phone number to go online", variant: "destructive" });
      return;
    }
    const emailVerifiedFresh = verifLoaded ? verifStatus?.emailVerified : user?.emailVerified;
    if (goingOnline && user?.email && !emailVerifiedFresh) {
      toast({ title: "Verify your email address to go online", variant: "destructive" });
      return;
    }
    if (effectiveOnline && totalRequestsRef.current > 0) {
      setShowOfflineConfirm(true);
      return;
    }
    await doActualToggle();
  }, [toggling, effectiveOnline, doActualToggle, user, verifLoaded, verifStatus]);

  const toggleSilence = () => {
    const next = !getSilenceMode();
    setSilenceMode(next);
    setSilenceOn(next);
    toast({ title: next ? "Silence mode ON — no alert sounds" : "Silence mode OFF — sounds enabled" });
  };

  const unlockAudioCtx = () => { unlockAudio(); setAudioLocked(false); };
  const onRetryConnect = () => sharedSocket?.connect();

  const handlePullRefresh = useCallback(async () => {
    await Promise.allSettled([
      qc.invalidateQueries({ queryKey: ["rider-requests"] }),
      qc.invalidateQueries({ queryKey: ["rider-active"] }),
      refreshUser(),
    ]);
  }, [qc, refreshUser]);

  const onClearDismissed = () => { setDismissed(new Set()); void clearAllDismissed(); };
  const onDismiss = useCallback((id: string) => dismiss(id), [dismiss]);

  const onDismissRiderNotice = () => {
    try { sessionStorage.setItem("_ajkm_riderNoticeDismissed", "1"); } catch {}
    setRiderNoticeDismissed(true);
  };

  const showFeatureBlocked = useCallback((featureName: string, missing: string[], _fallbackMsg?: string | null, reason?: "not_accessible" | "daily_limit_exceeded") => {
    if (reason !== "daily_limit_exceeded" && missing.length > 0) addBlockedVerifications(missing);
  }, [addBlockedVerifications]);

  /* Socket handlers */
  useEffect(() => {
    if (!sharedSocket) return;
    const handleNewRequest = (raw: unknown) => {
      const payload = parseNewOrderPayload(raw);
      if (!payload?.order_id) { void qc.invalidateQueries({ queryKey: ["rider-requests"] }); return; }
      const timerSec = payload.timer ?? ACCEPT_TIMEOUT_SEC;
      const elapsedMs = Math.max(0, ACCEPT_TIMEOUT_SEC - timerSec) * 1000;
      const syntheticCreatedAt = new Date(Date.now() - elapsedMs).toISOString();
      const syntheticRide: Ride = { id: payload.order_id, status: "pending", fare: payload.fare ?? undefined, pickupAddress: payload.pickup ?? undefined, dropAddress: payload.drop ?? undefined, createdAt: syntheticCreatedAt };
      qc.setQueryData(["rider-requests"], (old: any) => {
        const existingOrders = old?.orders ?? [];
        const existingRides = old?.rides ?? [];
        if (existingRides.some((r: any) => r.id === payload.order_id)) return old;
        return { ...old, orders: existingOrders, rides: [syntheticRide, ...existingRides], _serverTime: old?._serverTime ?? new Date().toISOString() };
      });
      void qc.invalidateQueries({ queryKey: ["rider-requests"] });
      if (!isAudioLocked()) playRequestSound();
    };
    const handleStateChange = () => {
      void qc.invalidateQueries({ queryKey: ["rider-requests"] });
      void qc.invalidateQueries({ queryKey: ["rider-active"] });
    };
    const handleCompletionEvent = () => {
      void qc.invalidateQueries({ queryKey: ["rider-requests"] });
      void qc.invalidateQueries({ queryKey: ["rider-active"] });
      void qc.invalidateQueries({ queryKey: ["rider-earnings"] });
    };
    const handleRideAssigned = (raw: unknown) => {
      const payload = parseRideAssignedPayload(raw);
      if (!payload) return;
      void qc.invalidateQueries({ queryKey: ["rider-requests"] });
      void qc.invalidateQueries({ queryKey: ["rider-active"] });
      setLocation("/active");
    };
    const handleOrderCancelled = (raw: unknown) => {
      if (!isMountedRef.current) return;
      const payload = parseOrderCancelledPayload(raw);
      const cancelledId = payload?.order_id;
      if (cancelledId) {
        qc.setQueryData(["rider-requests"], (old: any) => {
          if (!old) return old;
          return { ...old, orders: (old.orders ?? []).filter((o: any) => o.id !== cancelledId), rides: (old.rides ?? []).filter((r: any) => r.id !== cancelledId) };
        });
      } else void qc.invalidateQueries({ queryKey: ["rider-requests"] });
      const reason = payload?.reason;
      trackEvent("ride_cancelled", { request_id: cancelledId ?? "unknown", reason: reason ?? "" });
      toast({ title: reason ? `Order cancelled: ${reason}` : T("requestCancelled"), variant: "destructive" });
    };
    const handleOrderAccepted = (raw: unknown) => {
      if (!isMountedRef.current) return;
      const payload = parseOrderAcceptedPayload(raw);
      const acceptedId = payload?.order_id ?? payload?.ride_id ?? payload?.id;
      if (acceptedId) {
        qc.setQueryData(["rider-requests"], (old: any) => {
          if (!old) return old;
          return { ...old, orders: (old.orders ?? []).filter((o: any) => o.id !== acceptedId), rides: (old.rides ?? []).filter((r: any) => r.id !== acceptedId) };
        });
      } else void qc.invalidateQueries({ queryKey: ["rider-requests"] });
      toast({ title: "Sorry, this order was taken.", variant: "destructive" });
    };
    const handleCounterAccepted = (raw: unknown) => {
      if (!isMountedRef.current) return;
      const payload = parseCounterResultPayload(raw);
      const acceptedId = payload?.ride_id ?? payload?.order_id ?? payload?.id;
      if (acceptedId) {
        qc.setQueryData(["rider-requests"], (old: any) => {
          if (!old) return old;
          return { ...old, orders: (old.orders ?? []).filter((o: any) => o.id !== acceptedId), rides: (old.rides ?? []).filter((r: any) => r.id !== acceptedId) };
        });
      }
      void qc.invalidateQueries({ queryKey: ["rider-requests"] });
      void qc.invalidateQueries({ queryKey: ["rider-active"] });
      toast({ title: "Counter accepted! Go to active task." });
    };
    const handleCounterDeclined = (raw: unknown) => {
      if (!isMountedRef.current) return;
      const payload = parseCounterResultPayload(raw);
      const declinedId = payload?.ride_id ?? payload?.order_id ?? payload?.id;
      if (declinedId) {
        qc.setQueryData(["rider-requests"], (old: any) => {
          if (!old) return old;
          return { ...old, orders: (old.orders ?? []).filter((o: any) => o.id !== declinedId), rides: (old.rides ?? []).filter((r: any) => r.id !== declinedId) };
        });
      } else void qc.invalidateQueries({ queryKey: ["rider-requests"] });
      toast({ title: "Customer declined your counter offer.", variant: "destructive" });
    };
    sharedSocket.on("rider:new_request", handleNewRequest);
    sharedSocket.on("new:request", handleNewRequest);
    sharedSocket.on("new_order", handleNewRequest);
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
      sharedSocket.off("new_order", handleNewRequest);
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
  }, [sharedSocket, qc, T, setLocation]);

  /* Greeting */
  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return T("goodMorning");
    if (h < 17) return T("goodAfternoon");
    return T("goodEvening");
  }, [T]);

  const lastSeenLabel = useMemo(() => {
    if (!lastSeenOnlineAt) return "Syncing profile…";
    return new Date(lastSeenOnlineAt).toLocaleString("en-PK", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  }, [lastSeenOnlineAt]);

  /* Accept callbacks */
  const onAcceptOrder = (id: string) => {
    if (isNetworkOffline) { toast({ title: "No internet — cannot accept while offline", variant: "destructive" }); return; }
    if (!acceptOrderGate.isLoading && !acceptOrderGate.accessible) {
      if (acceptOrderGate.cacheWasEmpty) { toast({ title: "Checking your account status…" }); void refreshFeatureRules(); return; }
      showFeatureBlocked("Accept Orders", acceptOrderGate.missingVerifications, null, acceptOrderGate.reason);
      return;
    }
    void runWithBiometricGate(() => {
      setAcceptingOrderId(id);
      acceptOrderMut.mutate(id, { onSettled: () => setAcceptingOrderId(null), onSuccess: () => { if (user?.id) recordUsage(user.id, "accept_order"); } });
    });
  };

  const onRejectOrder = (id: string) => rejectOrderMut.mutate(id);

  const onAcceptRide = (id: string) => {
    if (isNetworkOffline) { toast({ title: "No internet — cannot accept while offline", variant: "destructive" }); return; }
    if (!acceptRideGate.isLoading && !acceptRideGate.accessible) {
      if (acceptRideGate.cacheWasEmpty) { toast({ title: "Checking your account status…" }); void refreshFeatureRules(); return; }
      showFeatureBlocked("Accept Rides", acceptRideGate.missingVerifications, null, acceptRideGate.reason);
      return;
    }
    void runWithBiometricGate(() => {
      setAcceptingId(id);
      acceptRideMut.mutate(id, { onSettled: () => setAcceptingId(null), onSuccess: () => { if (user?.id) recordUsage(user.id, "accept_ride"); } });
    });
  };

  const onCounterRide = async (id: string, fare: number) => counterRideMut.mutateAsync({ id, counterFare: fare });
  const onRejectOffer = (id: string) => rejectOfferMut.mutate(id);
  const onIgnoreRide = (id: string) => ignoreRideMut.mutate(id);

  return {
    user, authLoading, refreshUser, refreshFeatureRules, greeting, lastSeenLabel, currency, T,
    effectiveOnline, toggling, toggleOnline, doActualToggle, blockingReason, showOfflineConfirm, setShowOfflineConfirm, onlineSince,
    silenceOn, toggleSilence, silenced, silenceRemaining, showSilenceMenu, setShowSilenceMenu, setSilenced, setSilenceRemaining, audioLocked, setAudioLocked, unlockAudioCtx,
    socketConnected, isNetworkOffline, zoneWarning, setZoneWarning, wakeLockWarning, setWakeLockWarning, onRetryConnect,
    gpsWarning, setGpsWarning,
    requestsLoading, requestsError, totalRequests, visibleOrders, visibleRides, requestsServerTime, newFlash, srAnnouncement,
    dismissed, setDismissed, onClearDismissed, onDismiss,
    hasActiveTask, activeData,
    earningsData, cancelStatsData, ignoreStatsData,
    profileBannerDismissed, setProfileBannerDismissed,
    verifStatus, verifLoaded, availableFeatures,
    config, language,
    onAcceptOrder, onRejectOrder, onAcceptRide, onCounterRide, onRejectOffer, onIgnoreRide,
    acceptOrderPending: acceptOrderMut.isPending,
    rejectOrderPending: rejectOrderMut.isPending,
    acceptRidePending: acceptRideMut.isPending,
    acceptingRideId: acceptingId,
    acceptingOrderId: acceptingOrderId,
    counterRidePending: counterRideMut.isPending,
    rejectOfferPending: rejectOfferMut.isPending,
    ignoreRidePending: ignoreRideMut.isPending,
    handlePullRefresh,
    riderNotice: config.content.riderNotice,
    riderNoticeDismissed,
    onDismissRiderNotice,
    tabVisible,
    runWithBiometricGate,
    acceptOrderGate, acceptRideGate,
    showFeatureBlocked,
    networkTier,
  };
}
