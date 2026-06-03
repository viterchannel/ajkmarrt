import { createLogger } from "@/lib/logger";
import { trackEvent } from "@/lib/analytics";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { tDual, type TranslationKey } from "@workspace/i18n";
import { AlertTriangle, Bike, MapPin, MessageSquare, RefreshCw, WifiOff, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { api } from "../lib/api";
import { saveActiveRideCache } from "../lib/dashboardCache";
import { enqueue } from "../lib/gpsQueue";
import { executeLogoutSequence } from "../lib/logoutSequence";
import { enqueueAction, useQueueStatus } from "../lib/offline/queueManager";
import { useAuth } from "../lib/rider-auth";
import { logRideEvent } from "../lib/rideUtils";
import { useSocket } from "../lib/socket";
import { uploadProofPhoto } from "../lib/uploadProofPhoto";
import { getRiderModules, usePlatformConfig } from "../lib/useConfig";
import { useLanguage } from "../lib/useLanguage";
const log = createLogger("[Active]");

import {
  compressImage,
  ElapsedBadge,
  haversineDistance,
  RIDE_STEPS,
  SkeletonActive,
} from "../components/active/ActiveHelpers";
import { ActiveModals, CancellationReasonModal, PostDeliverySheet } from "../components/active/ActiveModals";
import { ActiveOrderPanel } from "../components/active/ActiveOrderPanel";
import { ActiveRidePanel } from "../components/active/ActiveRidePanel";
import {
  parseOrderCancelledPayload,
  parseRideCancelledPayload,
  parseRideOtpPayload,
  parseRideOtpVerifiedPayload,
} from "../lib/socketEvents";

export default function Active() {
  const qc = useQueryClient();
  const { config } = usePlatformConfig();
  const { user, apiUnreachable } = useAuth();
  const { language } = useLanguage();
  const T = (key: TranslationKey) => tDual(key, language);
  const currency = config.platform.currencySymbol ?? "Rs.";
  const ORDER_LABELS = [T("goToStore"), T("pickedUp"), T("delivered")];
  const RIDE_LABELS = [T("acceptOrder"), T("atPickup"), T("inTransit"), T("done")];
  const [syncFailedCount, setSyncFailedCount] = useState(0);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpInput, setOtpInput] = useState("");
  const [cancelTarget, setCancelTarget] = useState<"order" | "ride">("order");
  const [proofPhoto, setProofPhoto] = useState<string | null>(null);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofFileName, setProofFileName] = useState<string>("");
  const [proofUploading, setProofUploading] = useState(false);
  const [proofStagedForRetry, setProofStagedForRetry] = useState(false);
  const [showNoPhotoWarning, setShowNoPhotoWarning] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [rideProofFile, setRideProofFile] = useState<File | null>(null);
  const [rideProofPhoto, setRideProofPhoto] = useState<string | null>(null);
  const [rideProofUploading, setRideProofUploading] = useState(false);
  const ridePhotoInputRef = useRef<HTMLInputElement>(null);
  const [otpAttempts, setOtpAttempts] = useState(0);
  const [showFeedbackSheet, setShowFeedbackSheet] = useState(false);
  const [feedbackEntityId, setFeedbackEntityId] = useState("");
  const [feedbackKind, setFeedbackKind] = useState<"order" | "ride">("order");
  const [feedbackEarningsMsg, setFeedbackEarningsMsg] = useState("");
  const [showCancelledModal, setShowCancelledModal] = useState(false);
  const [cancelledBy, setCancelledBy] = useState<"customer" | "admin" | "system" | null>(null);
  const [cancelledReason, setCancelledReason] = useState<string | null>(null);
  const [hasPendingSync, setHasPendingSync] = useState(false);
  const queueStatus = useQueueStatus();
  const [pressedBtn, setPressedBtn] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [riderPos, setRiderPos] = useState<{ lat: number; lng: number } | null>(null);
  const [riderReplies, setRiderReplies] = useState<
    Array<{ text: string; ts: string; from: "rider" }>
  >([]);
  const [showAdminChat, setShowAdminChat] = useState(false);
  const [chatReply, setChatReply] = useState("");
  const { socket: sharedSocket, setRiderPosition, setSlowGps, setCurrentTripId, adminChatMessages } = useSocket();

  const socketRef = useRef<typeof sharedSocket>(null);
  useEffect(() => {
    socketRef.current = sharedSocket;
  }, [sharedSocket]);

  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  /* Derive the combined message list: incoming admin messages from the shared
     context (persisted across navigation) merged with rider-sent replies
     (local-only, intentionally reset when the component unmounts). */
  const adminMessages = useMemo(
    () =>
      [
        ...adminChatMessages.map((m) => ({ text: m.message, ts: m.sentAt, from: "admin" as const })),
        ...riderReplies,
      ].sort((a, b) => (a.ts < b.ts ? -1 : 1)),
    [adminChatMessages, riderReplies]
  );

  /* Show the chat overlay whenever a new admin message arrives. */
  const prevAdminCountRef = useRef(0);
  useEffect(() => {
    if (adminChatMessages.length > prevAdminCountRef.current) {
      setShowAdminChat(true);
      prevAdminCountRef.current = adminChatMessages.length;
    }
  }, [adminChatMessages.length]);

  /* Wrapper passed to ActiveModals so rider replies append to riderReplies only. */
  const setAdminMessages = useCallback(
    (
      fn: (
        prev: Array<{ text: string; ts: string; from: "rider" | "admin" }>
      ) => Array<{ text: string; ts: string; from: "rider" | "admin" }>
    ) => {
      setRiderReplies((prevReplies) => {
        const combined = [
          ...adminChatMessages.map((m) => ({ text: m.message, ts: m.sentAt, from: "admin" as const })),
          ...prevReplies,
        ].sort((a, b) => (a.ts < b.ts ? -1 : 1));
        const result = fn(combined);
        return result.filter((m): m is { text: string; ts: string; from: "rider" } => m.from === "rider");
      });
    },
    [adminChatMessages]
  );

  /* S3: Surface socket transport errors as a dismissible toast so the rider
     knows updates may be delayed without a hard UI block. */
  useEffect(() => {
    if (!sharedSocket) return;
    const reconnectTimerRef = { current: null as ReturnType<typeof setTimeout> | null };
    const onSocketError = (err: Error) => {
      if (!isMountedRef.current) return;
      log.warn({ err: err?.message }, "[Active] Socket transport error");
      toast({ title: T("connectionErrorStatusDelayed"), variant: "destructive" });
      /* Attempt reconnect after a brief back-off so the rider regains live
         status updates without needing to reload the page. */
      if (sharedSocket && !sharedSocket.connected) {
        if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = setTimeout(() => {
          if (isMountedRef.current) sharedSocket.connect();
        }, 3000);
      }
    };
    sharedSocket.on("error", onSocketError);
    return () => {
      sharedSocket.off("error", onSocketError);
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    };
  }, [sharedSocket]);

  useEffect(() => {
    if (!sharedSocket) return;
    const onOrderUpdate = () => {
      if (!isMountedRef.current) return;
      void qc.invalidateQueries({ queryKey: ["rider-active"] });
    };
    sharedSocket.on("order:update", onOrderUpdate);
    sharedSocket.on("order:assigned", onOrderUpdate);
    sharedSocket.on("ride:assigned", onOrderUpdate);
    return () => {
      sharedSocket.off("order:update", onOrderUpdate);
      sharedSocket.off("order:assigned", onOrderUpdate);
      sharedSocket.off("ride:assigned", onOrderUpdate);
    };
  }, [sharedSocket, qc]);

  /* Listen for ride/order cancellation pushed by customer or admin — show
     a modal with the cancellation reason so the rider is never left confused
     about why their active task disappeared. */
  useEffect(() => {
    if (!sharedSocket) return;
    const onCancelled = (raw: unknown) => {
      if (!isMountedRef.current) return;
      const payload = parseRideCancelledPayload(raw);
      if (!payload) {
        void qc.invalidateQueries({ queryKey: ["rider-active"] });
        return;
      }
      const by = payload.cancelledBy ?? null;
      const reason = payload.reason ?? null;
      setCancelledBy(by);
      setCancelledReason(reason);
      setShowCancelledModal(true);
      void qc.invalidateQueries({ queryKey: ["rider-active"] });
      void qc.invalidateQueries({ queryKey: ["rider-requests"] });
      void qc.invalidateQueries({ queryKey: ["rider-earnings"] });
    };
    /* order_cancelled — server-emitted event (no colon) for pending orders
       cancelled before or during an active ride. Uses dedicated Zod schema
       to validate the snake_case payload shape; falls back to cache
       invalidation on malformed payloads so the UI never gets stuck. */
    const onOrderCancelled = (raw: unknown) => {
      if (!isMountedRef.current) return;
      const payload = parseOrderCancelledPayload(raw);
      const reason = payload?.reason ?? null;
      setCancelledBy(null);
      setCancelledReason(reason);
      setShowCancelledModal(true);
      void qc.invalidateQueries({ queryKey: ["rider-active"] });
      void qc.invalidateQueries({ queryKey: ["rider-requests"] });
      void qc.invalidateQueries({ queryKey: ["rider-earnings"] });
    };
    sharedSocket.on("ride:cancelled", onCancelled);
    sharedSocket.on("order:cancelled", onCancelled);
    sharedSocket.on("rider:ride-cancelled", onCancelled);
    sharedSocket.on("rider:order-cancelled", onCancelled);
    sharedSocket.on("order_cancelled", onOrderCancelled);
    return () => {
      sharedSocket.off("ride:cancelled", onCancelled);
      sharedSocket.off("order:cancelled", onCancelled);
      sharedSocket.off("rider:ride-cancelled", onCancelled);
      sharedSocket.off("rider:order-cancelled", onCancelled);
      sharedSocket.off("order_cancelled", onOrderCancelled);
    };
  }, [sharedSocket, qc]);

  /* ride:otp_verified — customer has successfully verified OTP; advance the
     stepper to the next step and mark the ride as otpVerified in the cache
     so the UI unlocks the "Start Trip" / "In Transit" action without a reload. */
  useEffect(() => {
    if (!sharedSocket) return;
    const onOtpVerified = (raw: unknown) => {
      if (!isMountedRef.current) return;
      const data = parseRideOtpVerifiedPayload(raw);
      if (!data) return;
      type ActiveCache =
        | { order?: Record<string, unknown>; ride?: Record<string, unknown> }
        | null
        | undefined;
      qc.setQueryData(["rider-active"], (old: ActiveCache) => {
        if (!old) return old;
        const ride = old.ride;
        if (!ride || ride["id"] !== data.rideId) return old;
        /* Advance to in_transit status so the stepper moves forward */
        return { ...old, ride: { ...ride, otpVerified: true, status: "in_transit" } };
      });
    };
    sharedSocket.on("ride:otp_verified", onOtpVerified);
    return () => {
      sharedSocket.off("ride:otp_verified", onOtpVerified);
    };
  }, [sharedSocket, qc]);

  useEffect(() => {
    if (!sharedSocket) return;
    const onRideOtp = (raw: unknown) => {
      if (!isMountedRef.current) return;
      const data = parseRideOtpPayload(raw);
      if (!data) return;
      /* The real shape returned by api.getActive() and cached under
         ["rider-active"] is: { order?: {...}, ride?: {...} }
         Update ride.otp in-place so the OTP button gate becomes active
         without waiting for the next polling interval. */
      type ActiveCache =
        | { order?: Record<string, unknown>; ride?: Record<string, unknown> }
        | null
        | undefined;
      qc.setQueryData(["rider-active"], (old: ActiveCache) => {
        if (!old) return old;
        const ride = old.ride;
        if (!ride || ride["id"] !== data.rideId) return old;
        return { ...old, ride: { ...ride, tripOtp: data.otp, otpVerified: false } };
      });
    };
    sharedSocket.on("ride:otp", onRideOtp);
    return () => {
      sharedSocket.off("ride:otp", onRideOtp);
    };
  }, [sharedSocket, qc]);

  type QueuedUpdate = { kind: "location" | "status"; run: () => Promise<unknown> };
  const pendingUpdatesRef = useRef<QueuedUpdate[]>([]);
  const queueUpdate = (update: QueuedUpdate) => {
    pendingUpdatesRef.current = [
      ...pendingUpdatesRef.current.filter((u) => u.kind !== update.kind),
      update,
    ];
  };

  const refetchRef = useRef<(() => void) | null>(null);
  const TRef = useRef<((key: TranslationKey) => string) | null>(null);
  const retrySyncRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const goOffline = () => setIsOffline(true);
    const goOnline = () => {
      setIsOffline(false);
      setSyncFailedCount(0);
      setHasPendingSync(false);
      const pending = [...pendingUpdatesRef.current];
      pendingUpdatesRef.current = [];
      const locationUpdates = pending.filter((item) => item.kind === "location");
      const statusUpdates = pending.filter((item) => item.kind === "status");
      if (locationUpdates.length > 0) {
        const latest = locationUpdates[locationUpdates.length - 1]!;
        latest.run().catch((err) => {
          log.error(
            { err: err instanceof Error ? err.message : String(err) },
            "[Active] latest.run failed"
          );
        });
      }
      if (statusUpdates.length > 0) {
        pendingUpdatesRef.current.push(...statusUpdates);
        retrySyncRef.current?.();
      }
      refetchRef.current?.();
    };
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
    };
  }, [qc]);

  /* Show a warning toast when the offline queue falls back to in-memory storage
     (IndexedDB unavailable). The action is queued but will not survive a reload. */
  useEffect(() => {
    const handlePersistFail = () => {
      toast({
        title: T("offlineActionQueued"),
        variant: "destructive",
      });
    };
    window.addEventListener("ajkm:queue-persistence-failed", handlePersistFail);
    return () => window.removeEventListener("ajkm:queue-persistence-failed", handlePersistFail);
  }, []);

  TRef.current = T;

  const [tabVisible, setTabVisible] = useState(!document.hidden);
  useEffect(() => {
    const handler = () => setTabVisible(!document.hidden);
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, []);

  const drainStatusQueue = () => {
    const allPending = [...pendingUpdatesRef.current];
    const statusUpdates = allPending.filter((item) => item.kind === "status");
    if (statusUpdates.length === 0) return;
    pendingUpdatesRef.current = allPending.filter((item) => item.kind === "location");
    setSyncFailedCount(0);
    /* Sequential drain preserves status-transition order (accepted → in_transit →
       completed). Using Promise.allSettled would fire all in parallel and could
       apply a later transition before an earlier one is acknowledged server-side. */
    void (async () => {
      const failed: typeof statusUpdates = [];
      let anySuccess = false;
      for (const item of statusUpdates) {
        try {
          await item.run();
          anySuccess = true;
        } catch (err) {
          log.error(
            { err: err instanceof Error ? err.message : String(err) },
            "Status update failed — will retry"
          );
          failed.push(item);
          /* Stop draining: later transitions depend on this one succeeding. */
          break;
        }
      }
      if (failed.length > 0) {
        pendingUpdatesRef.current.push(...failed);
        setSyncFailedCount(failed.length);
      }
      if (anySuccess) {
        void qc.invalidateQueries({ queryKey: ["rider-active"] });
        void qc.invalidateQueries({ queryKey: ["rider-history"] });
        void qc.invalidateQueries({ queryKey: ["rider-earnings"] });
        void qc.invalidateQueries({ queryKey: ["rider-requests"] });
        toast({ title: TRef.current?.("statusUpdated") ?? T("statusUpdated") });
      }
    })();
  };
  retrySyncRef.current = drainStatusQueue;

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["rider-active"],
    queryFn: () => api.getActive(),
    refetchInterval: tabVisible ? 8000 : false,
    staleTime: 60_000,
  });
  refetchRef.current = refetch;

  /* Save active ride snapshot to IndexedDB after every successful online fetch
     so the last known state is available after an offline reload. */
  useEffect(() => {
    if (isOffline) return;
    if (data === undefined) return;
    saveActiveRideCache(data ?? null).catch(() => { /* non-critical */ });
  }, [data, isOffline]);

  useEffect(() => {
    if (tabVisible) void refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabVisible]);

  const [, navigate] = useLocation();
  const [gpsWarning, setGpsWarning] = useState<string | null>(null);
  const gpsWarningRef = useRef<string | null>(null);
  const [showProximityWarning, setShowProximityWarning] = useState(false);
  /* Tracks consecutive server-confirmed GPS spoof rejections (422 with GPS_SPOOF_DETECTED).
     After GPS_SPOOF_HARD_BLOCK_THRESHOLD consecutive rejections the session is revoked
     and the rider is logged out — not just warned. */
  const GPS_SPOOF_HARD_BLOCK_THRESHOLD = 3;
  const spoofHardBlockCountRef = useRef(0);

  const setGpsWarningWithRef = (val: string | null) => {
    gpsWarningRef.current = val;
    setGpsWarning(val);
  };

  const batteryRef = useRef<number | undefined>(undefined);
  const minGpsIntervalMsRef = useRef(5_000);
  const activeDataRef = useRef(data);
  /** Stable GPS options object — extracted to a ref so the watchPosition call
   *  never sees a new object reference between renders, preventing unnecessary
   *  watcher teardown/restart while an active ride is in progress. */
  const gpsOptionsRef = useRef<PositionOptions>({
    enableHighAccuracy: true,
    maximumAge: 10_000,
    timeout: 20_000,
  });
  activeDataRef.current = data;

  useEffect(() => {
    type BatteryManager = {
      level: number;
      addEventListener: (ev: string, cb: () => void) => void;
      removeEventListener: (ev: string, cb: () => void) => void;
    };
    let batt: BatteryManager | undefined;
    let mounted = true;
    const onLevelChange = () => {
      if (batt) batteryRef.current = batt.level;
    };
    (navigator as unknown as { getBattery?: () => Promise<BatteryManager> })
      .getBattery?.()
      .then((b) => {
        if (!mounted) return;
        batt = b;
        batteryRef.current = b.level;
        b.addEventListener("levelchange", onLevelChange);
      })
      .catch((err) => {
        log.warn(
          { err: err instanceof Error ? err.message : String(err) },
          "[Active] Battery API unavailable — battery level will not be tracked"
        );
      });
    return () => {
      mounted = false;
      batt?.removeEventListener("levelchange", onLevelChange);
    };
  }, []);

  useEffect(() => {
    if (data?.order && !data?.ride) setCancelTarget("order");
    else if (data?.ride && !data?.order) setCancelTarget("ride");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!data?.order, !!data?.ride]);

  /* Keep socket context aware of the current tripId so the heartbeat payload
     always includes it — used by admin-fleet for vehicle tracking overlays. */
  useEffect(() => {
    const rideId = data?.ride?.id ?? null;
    setCurrentTripId(rideId);
    return () => {
      setCurrentTripId(null);
    };
  }, [data?.ride?.id, setCurrentTripId]);

  useEffect(() => {
    if (!riderPos || !data?.order) {
      setShowProximityWarning(false);
      return;
    }
    const vendorLat = (data.order as Record<string, unknown>).vendorLat as number | undefined;
    const vendorLng = (data.order as Record<string, unknown>).vendorLng as number | undefined;
    if (!vendorLat || !vendorLng) {
      setShowProximityWarning(false);
      return;
    }
    const dist = haversineDistance(riderPos.lat, riderPos.lng, vendorLat, vendorLng) * 1000;
    setShowProximityWarning(
      dist > 500 &&
        !data.order.status?.startsWith("picked") &&
        data.order.status !== "out_for_delivery"
    );
  }, [riderPos, data?.order]);

  useEffect(() => {
    const hasActiveWork = !!(data?.order || data?.ride);
    if (!hasActiveWork || !user?.id) return;
    if (!navigator?.geolocation) return;
    /* gpsTracking module flag — when disabled by admin the watchPosition loop
       must not start so no coordinates are collected or sent to the server. */
    if (!getRiderModules(config).gpsTracking) return;
    let lastSentTime = 0;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        if (!isMountedRef.current) return;
        setRiderPos({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setRiderPosition(pos.coords.latitude, pos.coords.longitude);
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const batteryLow = typeof batteryRef.current === "number" && batteryRef.current < 0.2;
        let isFar = false;
        const active = activeDataRef.current;
        if (active?.order) {
          const o = active.order as Record<string, unknown>;
          const wLat = (o.dropoffLat ?? o.pickupLat) as number | undefined;
          const wLng = (o.dropoffLng ?? o.pickupLng) as number | undefined;
          if (wLat && wLng) isFar = haversineDistance(lat, lng, wLat, wLng) > 2;
        } else if (active?.ride) {
          const r = active.ride as Record<string, unknown>;
          const wLat = (r.dropoffLat ?? r.pickupLat) as number | undefined;
          const wLng = (r.dropoffLng ?? r.pickupLng) as number | undefined;
          if (wLat && wLng) isFar = haversineDistance(lat, lng, wLat, wLng) > 2;
        }
        const slow = batteryLow || isFar;
        minGpsIntervalMsRef.current = slow ? 30_000 : 5_000;
        setSlowGps(slow);
        const now = Date.now();
        if (now - lastSentTime < minGpsIntervalMsRef.current) return;
        lastSentTime = now;
        /* Heuristic mock-GPS check: accuracy below the configurable threshold
           combined with zero speed and no heading is a strong mock-location
           signal. Threshold comes from platform config (default: 5 m) so ops
           can tune it without a code deploy. Server-side spoof detection is
           the authoritative gate. */
        const _gpsThreshold = config?.security?.minGpsAccuracy ?? 5;
        const isMockGps =
          pos.coords.accuracy < _gpsThreshold && pos.coords.speed === 0 && pos.coords.heading == null;
        if (isMockGps) {
          if (isMountedRef.current)
            setGpsWarningWithRef(
              T("suspiciousGps")
            );
          return;
        }
        const gpsPayload = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy ?? undefined,
          speed: pos.coords.speed ?? undefined,
          heading: pos.coords.heading ?? undefined,
          rideId: activeDataRef.current?.ride?.id ?? undefined,
        };
        const queuedPing = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          timestamp: new Date().toISOString(),
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy ?? undefined,
          speed: pos.coords.speed ?? undefined,
          heading: pos.coords.heading ?? undefined,
        };
        const doUpdate = () =>
          api
            .updateLocation(gpsPayload)
            .then(() => {
              if (isMountedRef.current && gpsWarningRef.current) setGpsWarningWithRef(null);
            })
            .catch((err: unknown) => {
              if (!isMountedRef.current) return;
              const msg = err instanceof Error ? err.message : "";
              const isSpoofError =
                msg.toLowerCase().includes("spoof") || msg.toLowerCase().includes("mock");
              if (isSpoofError) {
                spoofHardBlockCountRef.current += 1;
                if (spoofHardBlockCountRef.current >= GPS_SPOOF_HARD_BLOCK_THRESHOLD) {
                  log.warn(
                    { count: spoofHardBlockCountRef.current },
                    "[Active] GPS spoof hard block — logging out rider"
                  );
                  executeLogoutSequence(api, () => { /* state cleared by navigation */ });
                  navigate("/login");
                  return;
                }
                setGpsWarningWithRef(T("mockLocationDetected"));
              } else {
                spoofHardBlockCountRef.current = 0;
                enqueue(queuedPing).catch((err) => {
                  log.error(
                    { err: err instanceof Error ? err.message : String(err) },
                    "[Active] GPS ping enqueue (spoof error) failed"
                  );
                });
                setGpsWarningWithRef(
                  TRef.current?.("gpsLocationError") ??
                    T("locationNotTracked")
                );
              }
            });
        if (!navigator.onLine) {
          enqueue(queuedPing).catch((err) => {
            log.error(
              { err: err instanceof Error ? err.message : String(err) },
              "[Active] GPS ping enqueue (offline) failed"
            );
          });
          queueUpdate({ kind: "location", run: doUpdate });
        } else if (socketRef.current?.connected) {
          /* Online and socket connected — emit the dedicated location_update
             event so the server persists the position and re-broadcasts to
             admin-fleet. The heartbeat in SocketProvider handles liveness;
             this event carries the full GPS payload for fleet tracking. */
          socketRef.current.emit("rider:location_update", {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy ?? undefined,
            speed: pos.coords.speed ?? undefined,
            heading: pos.coords.heading ?? undefined,
            rideId: activeDataRef.current?.ride?.id ?? undefined,
            timestamp: new Date().toISOString(),
          });
        } else {
          /* Online but socket disconnected — fall back to REST so the location
             is still recorded even without a live socket connection. */
          void doUpdate();
        }
      },
      () => {
        if (!isMountedRef.current) return;
        setGpsWarningWithRef(
          TRef.current?.("gpsNotAvailable") ??
            "GPS not available — please enable location in Settings"
        );
      },
      gpsOptionsRef.current
    );
    return () => navigator.geolocation.clearWatch(watchId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!data?.order, !!data?.ride, user?.id]);

  /* GPS drain handler is registered globally in App.tsx for the full session
     lifetime — registering a second one here would overwrite it and nullify it
     when this component unmounts, breaking batch uploads on other pages. */

  /* WakeLock fallback: on devices/browsers that don't support the Screen Wake Lock
     API, a silent 1ms vibration every 15 seconds keeps the screen from dimming and
     GPS from being throttled by the OS while an active ride or order is in progress.
     The interval is stopped when the component unmounts or the active work ends. */
  useEffect(() => {
    const hasActiveWork = !!(data?.order || data?.ride);
    if (!hasActiveWork) return;
    if (!("vibrate" in navigator)) return;
    if ("wakeLock" in navigator) return;
    const id = setInterval(() => {
      try { navigator.vibrate(1); } catch { /* vibrate not available — no-op */ }
    }, 15_000);
    return () => clearInterval(id);
  }, [!!data?.order, !!data?.ride]);

  const handlePhotoCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setProofFileName(file.name);
    let compressed: File = file;
    try {
      compressed = await compressImage(file, 1920, 1.5 * 1024 * 1024);
    } catch (err) {
      log.error(
        { err: err instanceof Error ? err.message : String(err) },
        "[Active] compressImage failed — using original"
      );
    }
    setProofFile(compressed);
    const compressForPreview = (dataUrl: string): Promise<string> =>
      new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          const scale = Math.min(1, 1280 / img.width);
          const canvas = document.createElement("canvas");
          canvas.width = Math.round(img.width * scale);
          canvas.height = Math.round(img.height * scale);
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            resolve(dataUrl);
            return;
          }
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL("image/jpeg", 0.7));
        };
        img.onerror = () => resolve(dataUrl);
        img.src = dataUrl;
      });
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const raw = ev.target?.result as string;
      if (!raw) return;
      const preview = await compressForPreview(raw);
      setProofPhoto(preview);
      setProofStagedForRetry(false);
    };
    reader.onerror = () => {
      setProofFileName("");
      setProofFile(null);
    };
    reader.readAsDataURL(file);
  };

  const handleMarkDelivered = async (id: string, forceNoPhoto = false) => {
    if (!proofPhoto && !forceNoPhoto && !proofStagedForRetry) {
      setShowNoPhotoWarning(true);
      return;
    }
    setShowNoPhotoWarning(false);
    if (proofPhoto && !navigator.onLine) {
      /* Offline with a photo already in state as a base64 DataURL.
         The backend accepts proofPhoto as a base64 DataURL directly (not just a
         server URL), so we can enqueue the full delivery payload right now without
         uploading to the server first. The queue will replay it when reconnected. */
      setHasPendingSync(true);
      toast({ title: T("offlineDeliveryQueued"), variant: "destructive" });
      enqueueAction("update_order", id, { status: "delivered", proofPhoto }).catch((err) => {
        log.error(
          { err: err instanceof Error ? err.message : String(err) },
          "[Active] enqueueAction deliver-offline failed"
        );
      });
      return;
    }
    let photoUrl: string | undefined;
    if (proofFile) {
      setProofUploading(true);
      try {
        const uploadRes = await api.uploadProof(proofFile);
        if (typeof uploadRes?.url !== "string" || !uploadRes.url.trim())
          throw new Error(T("photoUploadNoUrl"));
        photoUrl = uploadRes.url;
      } catch (e: unknown) {
        const status = (e && typeof e === "object" && "status" in e) ? (e as { status?: number }).status : undefined;
        if (status === 400 || status === 413) {
          toast({ title: T("photoTooLarge"), variant: "destructive" });
        } else {
          const isNetworkErr = !status;
          if (isNetworkErr) {
            setProofStagedForRetry(true);
            toast({ title: T("photoUploadHeld"), variant: "destructive" });
          } else {
            toast({ title: e instanceof Error ? e.message : T("photoUploadFailed"), variant: "destructive" });
          }
        }
        /* BUG FIX: clear photo preview so user knows upload failed and
           can retake without confusion.  Keep proofFile staged for retry. */
        setProofPhoto(null);
        setProofUploading(false);
        return;
      }
      setProofUploading(false);
      setProofStagedForRetry(false);
    }
    if (!navigator.onLine) {
      setHasPendingSync(true);
      toast({ title: T("offlineUpdateQueued"), variant: "destructive" });
      enqueueAction("update_order", id, {
        status: "delivered",
        ...(photoUrl ? { proofPhotoUrl: photoUrl } : {}),
      }).catch((err) => {
        log.error(
          { err: err instanceof Error ? err.message : String(err) },
          "[Active] enqueueAction deliver-offline (post-upload) failed"
        );
      });
      return;
    }
    updateOrderMut.mutate({ id, status: "delivered", photoUrl });
  };

  const handleRidePhotoCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    let compressed: File = file;
    try {
      compressed = await compressImage(file, 1920, 1.5 * 1024 * 1024);
    } catch (err) {
      log.error(
        { err: err instanceof Error ? err.message : String(err) },
        "[Active] ride compressImage failed — using original"
      );
    }
    setRideProofFile(compressed);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const raw = ev.target?.result as string;
      if (raw) setRideProofPhoto(raw);
    };
    reader.onerror = () => { setRideProofFile(null); setRideProofPhoto(null); };
    reader.readAsDataURL(file);
  };

  const handleCompleteRide = async (id: string) => {
    let photoUrl: string | undefined;
    if (rideProofFile) {
      setRideProofUploading(true);
      try {
        photoUrl = await uploadProofPhoto(rideProofFile);
      } catch (e: unknown) {
        const status = (e && typeof e === "object" && "status" in e) ? (e as { status?: number }).status : undefined;
        if (status === 400 || status === 413) {
          toast({ title: T("photoTooLarge"), variant: "destructive" });
        } else {
          toast({ title: e instanceof Error ? e.message : T("uploadFailed"), variant: "destructive" });
        }
        setRideProofUploading(false);
        return;
      }
      setRideProofUploading(false);
    }
    updateRideMut.mutate({ id, status: "completed", proofPhotoUrl: photoUrl });
  };

  const mapMutationError = (e: Error, t: typeof T): string => {
    const lower = (e?.message ?? "").toLowerCase();
    if (lower.includes("offline") || lower.includes("network"))
      return t("networkUnavailable");
    if (lower.includes("timeout")) return t("requestTimedOut");
    /* Pass through the server's actual message when available — it is more
       informative than the generic fallback (e.g. "Profile incomplete — please
       add vehicle photo", "Too many ride accept attempts. Please wait a moment.") */
    if (e?.message) return e.message;
    return t("somethingWentWrong") as string;
  };

  const updateOrderMut = useMutation({
    /* NOTE: The offline guard lives in handleMarkDelivered (which returns early
       and enqueues there). This mutationFn is therefore only reached when
       navigator.onLine was true at call-time. If the network drops mid-flight,
       onError's network-error branch enqueues the action (single enqueue,
       guarded by context.enqueued). No synthetic-success path needed here. */
    mutationFn: ({ id, status, photoUrl }: { id: string; status: string; photoUrl?: string }) =>
      api.updateOrder(id, status, photoUrl),
    onMutate: () => ({ enqueued: false }),

    onSuccess: (_, vars) => {
      void qc.invalidateQueries({ queryKey: ["rider-active"] });
      void qc.invalidateQueries({ queryKey: ["rider-history"] });
      void qc.invalidateQueries({ queryKey: ["rider-earnings"] });
      void qc.invalidateQueries({ queryKey: ["rider-requests"] });
      if (vars.status === "delivered") {
        trackEvent("ride_completed", { order_id: vars.id, type: "order" });
        setHasPendingSync(false);
        setProofPhoto(null);
        setProofFileName("");
        setProofFile(null);
        setProofStagedForRetry(false);
        if (photoInputRef.current) photoInputRef.current.value = "";
        setFeedbackEntityId(vars.id);
        setFeedbackKind("order");
        setFeedbackEarningsMsg(T("orderDeliveredEarnings"));
        setShowFeedbackSheet(true);
      } else if (vars.status === "cancelled") {
        setProofPhoto(null);
        setProofFile(null);
        setProofFileName("");
        setProofStagedForRetry(false);
        toast({ title: T("orderCancelledMsg") });
      } else {
        toast({ title: T("statusUpdated") });
      }
    },
    onError: (e: Error, vars, context) => {
      const looksLikeNetworkErr = /network|fetch|timeout|offline/i.test(e?.message || "");
      if (looksLikeNetworkErr && context?.enqueued === false)
        enqueueAction("update_order", vars.id, {
          status: vars.status,
          ...(vars.photoUrl ? { proofPhotoUrl: vars.photoUrl } : {}),
        }).catch((err) => {
          log.error(
            { err: err instanceof Error ? err.message : String(err) },
            "[Active] enqueueAction update_order (network error retry) failed"
          );
        });
      toast({ title: mapMutationError(e, T), variant: "destructive" });
    },
    onSettled: () => {
      setShowCancelConfirm(false);
    },
  });

  const updateRideMut = useMutation({
    mutationFn: ({
      id,
      status,
      lat,
      lng,
      proofPhotoUrl,
    }: {
      id: string;
      status: string;
      lat?: number;
      lng?: number;
      proofPhotoUrl?: string;
    }) => {
      const loc = lat != null && lng != null ? { lat, lng } : undefined;
      return api.updateRide(id, status, loc, proofPhotoUrl);
    },
    onMutate: () => ({ enqueued: false }),
    onSuccess: (_, vars) => {
      void qc.invalidateQueries({ queryKey: ["rider-active"] });
      void qc.invalidateQueries({ queryKey: ["rider-history"] });
      void qc.invalidateQueries({ queryKey: ["rider-earnings"] });
      void qc.invalidateQueries({ queryKey: ["rider-requests"] });
      logRideEvent(vars.id, vars.status, (msg, isErr) => toast({ title: msg, variant: isErr ? "destructive" : "default" }));
      if (vars.status === "completed") {
        setHasPendingSync(false);
        setRideProofFile(null);
        setRideProofPhoto(null);
        if (ridePhotoInputRef.current) ridePhotoInputRef.current.value = "";
        setFeedbackEntityId(vars.id);
        setFeedbackKind("ride");
        setFeedbackEarningsMsg(T("rideCompletedEarnings"));
        setShowFeedbackSheet(true);
      } else if (vars.status === "cancelled") toast({ title: T("rideCancelledMsg") });
      else toast({ title: T("statusUpdated") });
    },
    onError: (e: Error, vars, context) => {
      const looksLikeNetworkErr = /network|fetch|timeout|offline/i.test(e?.message || "");
      if (looksLikeNetworkErr && context?.enqueued === false) {
        const loc =
          vars.lat != null && vars.lng != null ? { lat: vars.lat, lng: vars.lng } : undefined;
        enqueueAction("update_ride", vars.id, {
          status: vars.status,
          ...(loc ?? {}),
          ...(vars.proofPhotoUrl ? { proofPhotoUrl: vars.proofPhotoUrl } : {}),
        }).catch(
          (err) => {
            log.error(
              { err: err instanceof Error ? err.message : String(err) },
              "[Active] enqueueAction update_ride (network error retry) failed"
            );
          }
        );
      }
      toast({ title: mapMutationError(e, T), variant: "destructive" });
    },
    onSettled: () => {
      setShowCancelConfirm(false);
    },
  });

  /* Reset OTP attempt counter whenever the active ride changes — covers both
     "new ride assigned" and "current ride completes/cancelled". */
  useEffect(() => {
    setOtpAttempts(0);
  }, [data?.ride?.id]);

  const verifyOtpMut = useMutation({
    mutationFn: ({ id, otp }: { id: string; otp: string }) => api.verifyRideOtp(id, otp),
    onSuccess: () => {
      setShowOtpModal(false);
      setOtpInput("");
      setOtpAttempts(0);
      void qc.invalidateQueries({ queryKey: ["rider-active"] });
      toast({ title: T("otpVerified") });
    },
    onError: (e: Error) => {
      /* Only count genuine wrong-code errors toward the 3-attempt lockout.
         Network failures, server errors, and other non-OTP errors should not
         consume an attempt — the rider is not at fault for those. */
      const isWrongOtp = /invalid|wrong|incorrect|mismatch|expired|otp/i.test(e?.message ?? "");
      if (isWrongOtp) {
        setOtpAttempts((prev) => prev + 1);
      }
      toast({ title: e.message || (T("somethingWentWrong") as string), variant: "destructive" });
    },
  });

  if (isLoading) return <SkeletonActive />;

  const order = data?.order;
  const ride = data?.ride;

  if (!order && !ride)
    return (
      <>
        <div className="flex min-h-screen flex-col bg-page-bg">
          <div
            className="page-header-gradient relative overflow-hidden rounded-b-[2rem] bg-card px-5 pb-10"
            style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 3.5rem)" }}
          >
            <div className="absolute -top-20 -right-20 h-72 w-72 rounded-full bg-success/[0.04]" />
            <div className="absolute bottom-10 -left-16 h-56 w-56 rounded-full bg-muted/[0.3]" />
            <div className="relative">
              <h1 className="text-2xl font-extrabold tracking-tight text-foreground">{T("activeTask")}</h1>
              <p className="mt-0.5 text-sm text-muted-foreground">{T("noCurrentAssignment")}</p>
            </div>
          </div>
          {syncFailedCount > 0 && !isOffline && (
            <div className="mx-4 mt-4 flex items-center gap-3 rounded-3xl border border-error/60 bg-gradient-to-r from-red-50 to-orange-50 p-3.5 shadow-sm">
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-error/15">
                <AlertTriangle size={18} className="text-error" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs leading-snug font-extrabold text-error">
                  {syncFailedCount} status update{syncFailedCount > 1 ? "s" : ""} could not be synced
                  — tap to retry manually.
                </p>
              </div>
              <button
                onClick={() => retrySyncRef.current?.()}
                className="flex flex-shrink-0 items-center gap-1.5 rounded-2xl bg-error px-3 py-2 text-xs font-bold text-white shadow-md shadow-error/30 transition-transform active:scale-95"
              >
                <RefreshCw size={13} /> Retry
              </button>
            </div>
          )}
          <div className="flex flex-1 items-center justify-center p-6">
            <div className="text-center">
              <div className="mx-auto mb-6 flex h-28 w-28 items-center justify-center rounded-[2rem] border border-border bg-muted/30 shadow-inner">
                <Bike size={52} className="text-muted-foreground" />
              </div>
              <h2 className="text-xl font-extrabold text-muted-foreground">{T("noActiveTask")}</h2>
              <p className="mx-auto mt-2 max-w-[260px] text-sm leading-relaxed text-muted-foreground">
                {T("acceptFromHome")}
              </p>
              <button
                onClick={() => refetch()}
                className="mx-auto mt-6 flex items-center gap-2 rounded-xl bg-brand px-7 py-3.5 text-sm font-bold text-black shadow-sm transition-transform active:scale-[0.97]"
              >
                <RefreshCw size={15} /> {T("refresh")}
              </button>
            </div>
          </div>
        </div>
        {/* Render the post-delivery feedback sheet even when there is no longer
            an active task — the query invalidation clears order/ride immediately
            after delivery/completion, so the sheet must exist outside that guard. */}
        <PostDeliverySheet
          show={showFeedbackSheet}
          kind={feedbackKind}
          entityId={feedbackEntityId}
          earningsMsg={feedbackEarningsMsg}
          onDone={() => setShowFeedbackSheet(false)}
          currency={currency}
        />
      </>
    );

  const orderStep = !order
    ? 0
    : order.status === "delivered"
      ? 2
      : order.status === "picked_up" || order.status === "out_for_delivery"
        ? 1
        : 0;
  const rideStep = ride ? Math.max(0, RIDE_STEPS.indexOf(ride.status)) : 0;
  const startedAt = order?.acceptedAt || ride?.acceptedAt || null;
  const riderEarningPct = config.rides?.riderEarningPct ?? config.finance?.riderEarningPct ?? 0;

  return (
    <div className="min-h-screen bg-page-bg">
      {/* Header */}
      <div
        className="page-header-gradient relative overflow-hidden rounded-b-[2rem] bg-card px-5 pb-7"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 3.5rem)" }}
      >
        <div className="absolute -top-20 -right-20 h-72 w-72 rounded-full bg-success/[0.04]" />
        <div className="absolute bottom-10 -left-16 h-56 w-56 rounded-full bg-foreground/[0.02]" />
        <div className="absolute top-1/2 left-1/2 h-32 w-32 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground/[0.015]" />
        <div className="relative mx-auto max-w-2xl flex items-start justify-between gap-3">
          <div className="flex-1">
            <div className="mb-1.5 flex items-center gap-2">
              <div className="h-2.5 w-2.5 animate-pulse rounded-full bg-success shadow-sm shadow-green-400" />
              <span className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">
                Live
              </span>
            </div>
            <h1 className="text-2xl font-black tracking-tight text-foreground">
              {order ? T("activeDelivery") : T("activeRide")}
            </h1>
            <p className="mt-1 text-sm font-medium text-muted-foreground">
              {order
                ? `${order.type} ${T("order")} — ${order.status === "picked_up" || order.status === "out_for_delivery" ? T("deliveringToCustomer") : T("pickUpFromStore")}`
                : `${ride?.type || T("ride")} ${T("rideInProgress")}`}
            </p>
          </div>
          <ElapsedBadge startIso={startedAt} />
        </div>
      </div>

      {/* Status banners */}
      <div className="mx-auto w-full max-w-2xl">
      {isOffline && (
        <div className="mx-4 mt-3 flex items-center gap-3 rounded-3xl border border-error/40 bg-error/10 p-3.5">
          <div className="flex h-9 w-9 flex-shrink-0 animate-pulse items-center justify-center rounded-xl bg-error/15">
            <WifiOff size={18} className="text-error" />
          </div>
          <div className="flex-1">
            <p className="text-xs font-extrabold text-error">
              You're offline
              {pendingUpdatesRef.current.length > 0
                ? ` — ${pendingUpdatesRef.current.length} update${pendingUpdatesRef.current.length > 1 ? "s" : ""} queued`
                : ""}
            </p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-error/80">
              Updates will retry automatically when reconnected.
            </p>
          </div>
        </div>
      )}
      {(apiUnreachable || isOffline) && data && (
        <div className="mx-4 mt-2 flex items-center gap-2 rounded-2xl border border-warning/30 bg-warning/10 px-3.5 py-2.5">
          <WifiOff size={13} className="flex-shrink-0 text-warning" />
          <p className="text-[11px] font-semibold text-warning">
            Offline — showing last known state
          </p>
        </div>
      )}

      {syncFailedCount > 0 && !isOffline && (
        <div className="mx-4 mt-3 flex items-center gap-3 rounded-3xl border border-error/40 bg-error/10 p-3.5">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-error/15">
            <AlertTriangle size={18} className="text-error" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs leading-snug font-extrabold text-error">
              {syncFailedCount} status update{syncFailedCount > 1 ? "s" : ""} could not be synced.
            </p>
          </div>
          <button
            onClick={() => retrySyncRef.current?.()}
            className="flex flex-shrink-0 items-center gap-1.5 rounded-2xl bg-error px-3 py-2 text-xs font-bold text-white shadow-md shadow-error/30 transition-transform active:scale-95"
          >
            <RefreshCw size={13} /> Retry
          </button>
        </div>
      )}

      {gpsWarning && (
        <div className="mx-4 mt-3 flex animate-[slideDown_0.3s_ease-out] items-start gap-3 rounded-3xl border border-warning/30 bg-warning/10 p-3.5">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-warning/15">
            <AlertTriangle size={18} className="text-warning" />
          </div>
          <div className="flex-1">
            <p className="text-xs font-extrabold text-warning">{T("gpsWarningTitle")}</p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-warning/80">{gpsWarning}</p>
          </div>
          <button
            onClick={() => setGpsWarning(null)}
            className="flex h-7 w-7 items-center justify-center rounded-lg bg-warning/15 text-warning transition-colors active:bg-warning/20"
            aria-label={T("dismiss")}
          >
            <X size={13} />
          </button>
        </div>
      )}

      {showProximityWarning && (
        <div className="mx-4 mt-3 flex animate-[slideDown_0.3s_ease-out] items-center gap-3 rounded-3xl border border-warning/30 bg-warning/10 p-3.5">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-warning/15">
            <MapPin size={18} className="text-warning" />
          </div>
          <div className="flex-1">
            <p className="text-xs font-extrabold text-warning">{T("farFromStoreTitle")}</p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-warning/80">
              {T("farFromStoreMsg")}
            </p>
          </div>
        </div>
      )}

      {/* Admin chat banner */}
      {adminMessages.length > 0 && (
        <div className="mx-4 mt-3 flex animate-[slideDown_0.3s_ease-out] items-center gap-3 rounded-3xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3 shadow-lg">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-black/20">
            <MessageSquare size={16} className="text-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-extrabold text-foreground">{T("messageFromAdmin")}</p>
            <p className="mt-0.5 truncate text-[11px] leading-relaxed text-blue-100">
              {adminMessages[adminMessages.length - 1]?.text ?? T("newMessage")}
            </p>
          </div>
          <button
            onClick={() => setShowAdminChat(true)}
            className="flex-shrink-0 rounded-lg bg-black/20 px-2.5 py-1 text-xs font-bold text-blue-100"
          >
            View
          </button>
          <button
            onClick={() => setAdminMessages(() => [])}
            className="flex-shrink-0 text-xs text-muted-foreground hover:text-foreground"
            aria-label={T("dismiss")}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Pending sync indicator — shown when a delivery/completion was queued offline */}
      {(hasPendingSync || queueStatus.pendingCount > 0) && (
        <div className="mx-4 mt-3 flex animate-[slideDown_0.3s_ease-out] items-center gap-3 rounded-3xl border border-warning/40 bg-warning/10 p-3.5">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-warning/15">
            <RefreshCw size={16} className="animate-spin text-warning" />
          </div>
          <div className="min-w-0 flex-1">
            {queueStatus.syncing ? (
              <>
                <p className="text-xs font-extrabold text-warning">{T("syncingLabel")}</p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-warning/80">
                  Uploading queued completion to server.
                </p>
              </>
            ) : (
              <>
                <p className="text-xs font-extrabold text-warning">{T("pendingSyncLabel")}</p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-warning/80">
                  Completion queued offline — will sync automatically when reconnected.
                </p>
              </>
            )}
          </div>
          {queueStatus.syncing && (
            <span className="flex-shrink-0 rounded-full bg-warning/20 px-2 py-0.5 text-[10px] font-bold text-warning">
              Syncing
            </span>
          )}
        </div>
      )}
      </div>

      {/* Main content */}
      <div className="mx-auto w-full max-w-2xl space-y-4 px-4 py-4">
        {order && (
          <ActiveOrderPanel
            order={order as Record<string, unknown>}
            orderStep={orderStep}
            ORDER_LABELS={ORDER_LABELS}
            riderPos={riderPos}
            currency={currency}
            deliveryFeeConfig={config.deliveryFee}
            riderEarningPct={riderEarningPct}
            startedAt={startedAt}
            updateOrderMut={updateOrderMut}
            proofPhoto={proofPhoto}
            proofFile={proofFile}
            proofFileName={proofFileName}
            proofUploading={proofUploading}
            proofStagedForRetry={proofStagedForRetry}
            setProofPhoto={setProofPhoto}
            setProofFile={setProofFile}
            setProofFileName={setProofFileName}
            setShowNoPhotoWarning={setShowNoPhotoWarning}
            photoInputRef={photoInputRef}
            handlePhotoCapture={handlePhotoCapture}
            handleMarkDelivered={handleMarkDelivered}
            setCancelTarget={setCancelTarget}
            setShowCancelConfirm={setShowCancelConfirm}
            pressedBtn={pressedBtn}
            setPressedBtn={setPressedBtn}
            T={T}
            config={config as { features?: { sos?: boolean } }}
          />
        )}

        {ride && (
          <ActiveRidePanel
            ride={ride as Record<string, unknown>}
            rideStep={rideStep}
            RIDE_LABELS={RIDE_LABELS}
            riderPos={riderPos}
            currency={currency}
            riderEarningPct={riderEarningPct}
            startedAt={startedAt}
            config={
              config as {
                rides?: { riderEarningPct?: number };
                finance: { riderEarningPct?: number };
                features?: { sos?: boolean };
              }
            }
            updateRideMut={updateRideMut}
            handleCompleteRide={handleCompleteRide}
            rideProofPhoto={rideProofPhoto}
            rideProofFile={rideProofFile}
            rideProofUploading={rideProofUploading}
            ridePhotoInputRef={ridePhotoInputRef}
            handleRidePhotoCapture={handleRidePhotoCapture}
            setRideProofPhoto={setRideProofPhoto}
            setRideProofFile={setRideProofFile}
            setShowOtpModal={setShowOtpModal}
            setOtpInput={setOtpInput}
            setCancelTarget={setCancelTarget}
            setShowCancelConfirm={setShowCancelConfirm}
            pressedBtn={pressedBtn}
            setPressedBtn={setPressedBtn}
            T={T}
          />
        )}
      </div>

      <CancellationReasonModal
        show={showCancelledModal}
        cancelledBy={cancelledBy}
        reason={cancelledReason}
        onDone={() => {
          setShowCancelledModal(false);
          setCancelledBy(null);
          setCancelledReason(null);
        }}
      />

      <ActiveModals
        showOtpModal={showOtpModal}
        showCancelConfirm={showCancelConfirm}
        showNoPhotoWarning={showNoPhotoWarning}
        showAdminChat={showAdminChat}
        cancelTarget={cancelTarget}
        otpInput={otpInput}
        setOtpInput={setOtpInput}
        setShowOtpModal={setShowOtpModal}
        setShowCancelConfirm={setShowCancelConfirm}
        setShowNoPhotoWarning={setShowNoPhotoWarning}
        setShowAdminChat={setShowAdminChat}
        chatReply={chatReply}
        setChatReply={setChatReply}
        adminMessages={adminMessages}
        setAdminMessages={setAdminMessages}
        socketRef={socketRef}
        order={order as Record<string, unknown> | null}
        ride={ride as Record<string, unknown> | null}
        updateOrderMut={updateOrderMut}
        updateRideMut={updateRideMut}
        verifyOtpMut={verifyOtpMut}
        handleMarkDelivered={handleMarkDelivered}
        proofUploading={proofUploading}
        otpAttempts={otpAttempts}
        feedbackSheet={{
          show: showFeedbackSheet,
          kind: feedbackKind,
          entityId: feedbackEntityId,
          earningsMsg: feedbackEarningsMsg,
          onDone: () => setShowFeedbackSheet(false),
          currency,
        }}
        T={T}
      />
    </div>
  );
}
