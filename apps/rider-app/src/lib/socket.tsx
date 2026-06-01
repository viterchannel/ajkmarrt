import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { io, type Socket } from "socket.io-client";
import { api, registerTokenRefreshCallback, tokenStoreReady } from "./api";

import { createLogger } from "@/lib/logger";
import { getRiderSocketOrigin } from "./envValidation";
import { batchDrainGpsQueue, clearQueue, dequeueAll } from "./gpsQueue";
import { syncQueue } from "./offline/queueManager";
import { useAuth } from "./rider-auth";
import { parseAdminChatPayload, type AdminChatPayload } from "./socketEvents";
import {
  loadAdminChatMessages,
  loadAdminChatUnread,
  persistAdminChatMessages,
  persistAdminChatUnread,
} from "./adminChatStore";
import { getRiderModules, usePlatformConfig } from "./useConfig";
import { saveFeatureRulesCache } from "./featureGate";
const log = createLogger("[socket]");

export type AdminChatMessage = AdminChatPayload & { id: string };

/** Haversine great-circle distance in metres between two WGS-84 coordinates. */
function haversineMetres(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

type SocketContextType = {
  socket: Socket | null;
  connected: boolean;
  setRiderPosition: (lat: number, lng: number) => void;
  batteryLevel: number | undefined;
  setSlowGps: (slow: boolean) => void;
  setCurrentTripId: (tripId: string | null) => void;
  adminChatMessages: AdminChatMessage[];
  adminChatUnread: number;
  clearAdminChatUnread: () => void;
};

const SocketContext = createContext<SocketContextType>({
  socket: null,
  connected: false,
  setRiderPosition: () => {},
  batteryLevel: undefined,
  setSlowGps: () => {},
  setCurrentTripId: () => {},
  adminChatMessages: [],
  adminChatUnread: 0,
  clearAdminChatUnread: () => {},
});

export function useSocket() {
  return useContext(SocketContext);
}

export function SocketProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { config } = usePlatformConfig();
  const qc = useQueryClient();

  /* Tracks whether this provider is still mounted — used to guard async
     callbacks (e.g. api.getRequests after reconnect) so we never call
     setState after unmount. */
  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  /* Ref keeps the current gpsTracking flag accessible inside intervals/callbacks
     without creating new closure captures on every render. */
  const gpsTrackingRef = useRef(true);
  useEffect(() => {
    gpsTrackingRef.current = getRiderModules(config).gpsTracking;
  }, [config]);

  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const [adminChatMessages, setAdminChatMessages] = useState<AdminChatMessage[]>(() =>
    loadAdminChatMessages()
  );
  const [adminChatUnread, setAdminChatUnread] = useState<number>(() => loadAdminChatUnread());

  const clearAdminChatUnread = useCallback(() => {
    setAdminChatUnread(0);
  }, []);

  /* Persist admin chat messages to localStorage whenever they change */
  useEffect(() => {
    persistAdminChatMessages(adminChatMessages);
  }, [adminChatMessages]);

  /* Persist admin chat unread count to localStorage whenever it changes */
  useEffect(() => {
    persistAdminChatUnread(adminChatUnread);
  }, [adminChatUnread]);

  /* Cached position fed by Home.tsx / Active.tsx watchPosition — no separate GPS listener here */
  const lastLatRef = useRef<number | undefined>(undefined);
  const lastLngRef = useRef<number | undefined>(undefined);
  /* Slow-GPS flag set by Active.tsx when battery is low or rider is far from waypoint */
  const slowGpsRef = useRef(false);
  const lastHeartbeatMsRef = useRef(0);

  /* Active ride/trip ID — set by Active.tsx when a ride is in progress */
  const currentTripIdRef = useRef<string | null>(null);

  /* Called from watchPosition callbacks in Home.tsx and Active.tsx */
  const setRiderPosition = useCallback((lat: number, lng: number) => {
    lastLatRef.current = lat;
    lastLngRef.current = lng;
  }, []);

  /* Called by Active.tsx to signal battery-aware slow-down mode */
  const setSlowGps = useCallback((slow: boolean) => {
    slowGpsRef.current = slow;
  }, []);

  /* Called by Active.tsx when an active ride starts/ends so the heartbeat
     payload always includes the current tripId for admin-fleet tracking. */
  const setCurrentTripId = useCallback((tripId: string | null) => {
    currentTripIdRef.current = tripId;
  }, []);

  useEffect(() => {
    /* Abort flag — prevents socket creation if the effect is cleaned up
       before tokenStoreReady resolves (e.g. fast logout at startup). */
    let cancelled = false;
    /* Teardown function populated by the async setup; called synchronously
       by the effect cleanup so React always gets a prompt disconnect. */
    let teardown: (() => void) | undefined;

    void (async () => {
      /* Wait until persisted tokens are loaded from Preferences storage so
         we never connect with a stale (or missing) token read at mount time. */
      await tokenStoreReady;
      if (cancelled) return;

      const token = api.getToken();
      if (!token || !user?.id) return;

      const socketOrigin = getRiderSocketOrigin() ?? window.location.origin;

      const s = io(socketOrigin, {
        path: "/api/socket.io",
        auth: { token },
        transports: ["websocket", "polling"],
        reconnection: true,
        reconnectionDelay: 2000,
        reconnectionDelayMax: 20000,
        reconnectionAttempts: Infinity,
        /* withCredentials lets the browser attach the HttpOnly refresh cookie
           to the polling-transport handshake. The websocket transport does
           not require it but enabling here is harmless and keeps both
           transports symmetric for any cookie-aware server middleware. */
        withCredentials: true,
      });
      socketRef.current = s;
      setSocket(s);

      s.on("connect", () => {
        log.info({ socketId: s.id }, "Socket connected — draining offline action queue");
        setConnected(true);
        syncQueue().catch((err) => log.warn({ err }, "syncQueue failed after socket connect"));
        if (gpsTrackingRef.current) {
          /* GPS tracking enabled — flush queued pings to the server */
          batchDrainGpsQueue();
        } else {
          /* GPS tracking disabled — silently discard queued pings so they are
             never sent to the server even when connectivity is restored. */
          void dequeueAll().then((pings) => {
            if (pings.length > 0) {
              log.info({ count: pings.length }, "gpsTracking disabled — discarding queued GPS pings");
              void clearQueue(pings.map((p) => p.id));
            }
          });
        }
        /* Announce rider presence to the server immediately after connect so
           the server can join the rider to their notification room. */
        if (user?.id) {
          s.emit("rider:online", { riderId: user.id });
        }
        /* Reconnect ride-request sync: fetch any pending requests that were
           broadcast while the socket was disconnected and populate the React
           Query cache so Home.tsx never misses a queued ride/order. */
        void api.getRequests().then((data) => {
          if (!isMountedRef.current) return;
          qc.setQueryData(["rider-requests"], data);
          log.info(
            { rides: data.rides.length, orders: data.orders.length },
            "Reconnect sync — pending requests fetched and cache populated"
          );
        }).catch((err) => {
          log.warn({ err }, "Reconnect sync — failed to fetch pending requests after socket connect");
        });
      });
      s.on("disconnect", (reason) => {
        log.warn({ reason }, "Socket disconnected");
        /* Emit rider:offline as a best-effort liveness signal before updating
           local state.  For transport-level drops (ping timeout / transport close)
           the emit will not reach the server — that is expected; the server will
           detect the offline state via heartbeat expiry.  For server-initiated
           kicks ("io server disconnect") the connection is already torn down
           server-side, so the emit is a harmless no-op. */
        if (user?.id) {
          s.emit("rider:offline", { riderId: user.id, reason });
        }
        setConnected(false);
        /* "io server disconnect" means the server explicitly kicked this client
           (e.g. auth revoked / token invalidated). Fully disconnect so the
           socket does not attempt automatic reconnection with stale credentials.
           The token refresh + new socket lifecycle will reconnect when ready. */
        if (reason === "io server disconnect") {
          s.disconnect();
        }
      });
      s.on("connect_error", (err) => {
        log.warn({ message: err.message }, "Socket connection error");
        setConnected(false);
      });
      s.on("error", (err: Error) => {
        log.warn({ message: err?.message }, "Socket transport error");
        setConnected(false);
      });

      /* Single authoritative admin:chat listener — persists across page navigation
         because SocketProvider lives for the entire session. */
      s.on("admin:chat", (raw: unknown) => {
        const msg = parseAdminChatPayload(raw);
        if (!msg) return;
        const newMsg: AdminChatMessage = {
          ...msg,
          id: `admin-${msg.sentAt}-${Math.random().toString(36).slice(2)}`,
        };
        setAdminChatMessages((prev) => [...prev, newMsg]);
        setAdminChatUnread((prev) => prev + 1);
      });

      /* S1 / T4: On token refresh, reconnect the socket so the new auth token
         is sent on the next handshake. socket.io's typings model `auth` as
         `string | object`, so we narrow once via a typed local rather than
         re-casting at every read site. The cast is kept inside one helper so a
         future socket.io upgrade only needs to delete this block. */
      type AuthBag = { token?: string };
      const readSocketAuth = (): AuthBag => {
        const a = (s as { auth?: unknown }).auth;
        return (a && typeof a === "object" ? (a as AuthBag) : {}) as AuthBag;
      };
      const writeSocketAuth = (next: AuthBag) => {
        (s as { auth?: unknown }).auth = next;
      };
      /* Immediate reconnect when a token refresh completes — eliminates the gap
         where real-time messages are missed between token refresh and the next
         polling tick. Registered on every socket lifecycle so the callback always
         references the current socket instance. */
      const handleTokenRefresh = () => {
        const freshToken = api.getToken();
        if (!freshToken) return;
        writeSocketAuth({ ...readSocketAuth(), token: freshToken });
        s.disconnect();
        s.connect();
      };
      const unregisterRefreshCallback = registerTokenRefreshCallback(handleTokenRefresh);

      /* Polling fallback: detect token changes that don't come through the
         callback (e.g. token set by other code paths). Interval reduced to 5 s
         so the reconnect happens within 5 seconds at most. */
      const tokenRefreshInterval = setInterval(() => {
        const freshToken = api.getToken();
        const current = readSocketAuth().token;
        if (freshToken && freshToken !== current) {
          writeSocketAuth({ ...readSocketAuth(), token: freshToken });
          s.disconnect();
          s.connect();
        }
      }, 5_000);

      /* Store teardown so the synchronous effect cleanup can call it even if
         the async setup finished after React triggered the cleanup. */
      teardown = () => {
        unregisterRefreshCallback();
        clearInterval(tokenRefreshInterval);
        /* Emit rider:offline before disconnecting so the server is immediately
           notified on intentional teardown (logout / component unmount).
           Guard with s.connected so we never queue an emit that would fire
           on the next reconnect with stale context. */
        if (user?.id && s.connected) {
          s.emit("rider:offline", { riderId: user.id, reason: "client_disconnect" });
        }
        s.removeAllListeners(); /* S4: Remove all listeners on cleanup */
        s.disconnect();
        socketRef.current = null;
        setSocket(null);
        setConnected(false);
        /* Clear chat state so it never bleeds across user sessions on a shared device */
        setAdminChatMessages([]);
        setAdminChatUnread(0);
        persistAdminChatMessages([]);
        persistAdminChatUnread(0);
      };

      /* If effect was cleaned up while we were awaiting, tear down immediately. */
      if (cancelled) teardown();
    })();

    return () => {
      cancelled = true;
      teardown?.();
    };
  }, [user?.id]);

  /* Shared battery source for Home.tsx and heartbeat pings.
     batteryLevelRef is used by the heartbeat interval (no re-render needed there).
     batteryLevelState drives the context value so consumers actually see updates —
     reading batteryLevelRef.current directly in the Provider JSX would always
     yield the initial undefined because refs don't trigger re-renders. */
  const batteryLevelRef = useRef<number | undefined>(undefined);
  const [batteryLevelState, setBatteryLevelState] = useState<number | undefined>(undefined);

  /* Initialize battery listener once at mount */
  useEffect(() => {
    type BatteryManager = {
      level: number;
      addEventListener: (event: string, cb: () => void) => void;
      removeEventListener: (event: string, cb: () => void) => void;
    };
    let batt: BatteryManager | undefined;
    let mounted = true;
    const onLevelChange = () => {
      if (batt) {
        batteryLevelRef.current = batt.level;
        setBatteryLevelState(batt.level);
      }
    };
    (navigator as unknown as { getBattery?: () => Promise<BatteryManager> })
      .getBattery?.()
      .then((b) => {
        if (!mounted) return;
        batt = b;
        batteryLevelRef.current = batt.level;
        setBatteryLevelState(batt.level);
        batt.addEventListener("levelchange", onLevelChange);
      })
      .catch((err) => {
        log.warn({ err: err instanceof Error ? err.message : String(err) }, "Battery API unavailable — battery level will not be reported in heartbeats");
      });
    return () => {
      mounted = false;
      batt?.removeEventListener("levelchange", onLevelChange);
    };
  }, []);

  /* Platform-configurable heartbeat cadence and minimum movement distance.
     Fetched once after the socket connects; defaults match the platform setting
     defaults so the rider app works without a server round-trip at startup. */
  const heartbeatIntervalMsRef = useRef(10_000);
  /* Mirrors heartbeatIntervalMsRef but is never overridden by stationary-mode logic.
     Used to restore the platform-configured interval when movement resumes. */
  const baseHeartbeatIntervalMsRef = useRef(10_000);
  const heartbeatMinDistanceMRef = useRef(25);

  /* Last position at which we sent a heartbeat — used for 25 m deduplication. */
  const lastHeartbeatLatRef = useRef<number | undefined>(undefined);
  const lastHeartbeatLngRef = useRef<number | undefined>(undefined);

  /* Stationary-mode tracking: counts continuous ms without ≥10 m movement.
     When stationaryMsRef exceeds 60 000 ms (and no active ride) the heartbeat
     cadence drops to 30 s to save battery.  A ≥10 m movement resets both refs
     and restores the platform-configured cadence immediately. */
  const stationaryMsRef = useRef(0);
  const lastStationaryLatRef = useRef<number | undefined>(undefined);
  const lastStationaryLngRef = useRef<number | undefined>(undefined);

  /* Fetch platform settings once when socket connects so the heartbeat cadence
     and minimum movement distance are driven by admin-configurable values. */
  useEffect(() => {
    if (!connected) return;
    api
      .getSettings()
      .then((settings: unknown) => {
        if (!settings || typeof settings !== "object") return;
        const rows = (settings as Record<string, unknown>).settings;
        if (!Array.isArray(rows)) return;
        for (const row of rows as Array<{ key: string; value: string }>) {
          if (row.key === "rider_heartbeat_interval_ms") {
            const v = parseInt(row.value, 10);
            if (!isNaN(v) && v >= 1_000) {
              heartbeatIntervalMsRef.current = v;
              baseHeartbeatIntervalMsRef.current = v;
            }
          }
          if (row.key === "rider_heartbeat_min_distance_m") {
            const v = parseFloat(row.value);
            if (!isNaN(v) && v >= 0) heartbeatMinDistanceMRef.current = v;
          }
        }
        log.info(
          {
            intervalMs: heartbeatIntervalMsRef.current,
            minDistanceM: heartbeatMinDistanceMRef.current,
          },
          "Heartbeat config loaded from platform settings"
        );
      })
      .catch((err: unknown) => {
        log.warn(
          { err },
          "Failed to fetch platform settings for heartbeat config — using defaults"
        );
      });
  }, [connected]);

  /* Periodic feature-rules refresh — runs every 5 minutes while the socket is
     connected so that admin-side approval/suspension changes propagate to the
     client within one poll cycle without requiring a full logout/re-login.
     saveFeatureRulesCache dispatches FEATURE_RULES_UPDATED_EVENT which causes
     any mounted useFeatureGate hooks to re-evaluate the gate result. */
  useEffect(() => {
    if (!connected || !user?.id) return;
    const userId = user.id;
    const FIVE_MINUTES_MS = 5 * 60 * 1000;
    const id = setInterval(() => {
      api
        .getAvailableFeatures()
        .then((result) => {
          if (isMountedRef.current) {
            saveFeatureRulesCache(userId, result.features);
            log.info({ count: result.features.length }, "Periodic feature rules refresh completed");
          }
        })
        .catch((err: unknown) => {
          log.warn({ err }, "Periodic feature rules refresh failed — will retry on next cycle");
        });
    }, FIVE_MINUTES_MS);
    return () => clearInterval(id);
  }, [connected, user?.id]);

  /* Heartbeat effect - keyed on the socket instance so connect listeners rebind */
  useEffect(() => {
    const s = socket;
    if (!s || !user?.isOnline) return;

    const emitHeartbeat = () => {
      if (!s?.connected) return;
      const now = Date.now();

      /* ── Stationary-mode detection (runs every 1 s tick) ─────────────────
         During an active ride the interval is always locked to the fast base
         rate (10 s) regardless of movement, so stationary detection is skipped.
         Otherwise: track whether the rider has moved ≥ 10 m from the position
         recorded at the last stationarity check.  When stationary for ≥ 60 s
         the heartbeat cadence drops to 30 s to preserve battery.  The first
         ≥ 10 m movement resets the counter and restores the base cadence. */
      const STATIONARY_DISTANCE_M = 10;
      const STATIONARY_TIMEOUT_MS = 60_000;
      const STATIONARY_INTERVAL_MS = 30_000;

      const stationaryLat = lastLatRef.current;
      const stationaryLng = lastLngRef.current;
      if (!currentTripIdRef.current && stationaryLat !== undefined && stationaryLng !== undefined) {
        if (lastStationaryLatRef.current === undefined) {
          lastStationaryLatRef.current = stationaryLat;
          lastStationaryLngRef.current = stationaryLng;
        } else {
          const stationaryMoved = haversineMetres(
            lastStationaryLatRef.current,
            lastStationaryLngRef.current!,
            stationaryLat,
            stationaryLng
          );
          if (stationaryMoved >= STATIONARY_DISTANCE_M) {
            /* Movement detected — reset counter and restore base interval */
            stationaryMsRef.current = 0;
            lastStationaryLatRef.current = stationaryLat;
            lastStationaryLngRef.current = stationaryLng;
            if (!slowGpsRef.current) {
              heartbeatIntervalMsRef.current = baseHeartbeatIntervalMsRef.current;
            }
          } else {
            /* No meaningful movement — accumulate stationary time (≈1 s per tick) */
            stationaryMsRef.current += 1_000;
            if (stationaryMsRef.current >= STATIONARY_TIMEOUT_MS && !slowGpsRef.current) {
              heartbeatIntervalMsRef.current = STATIONARY_INTERVAL_MS;
            }
          }
        }
      }

      /* ── Effective interval calculation ───────────────────────────────────
         Priority (highest first):
           1. Active ride / in_transit  →  base rate (10 s) — accuracy critical
           2. Slow-GPS mode (external)  →  30 s
           3. Background tab (hidden)   →  60 s  (PWA battery saving)
           4. Stationary ≥ 60 s         →  30 s  (heartbeatIntervalMsRef updated above)
           5. Normal                    →  base rate (platform-configured, default 10 s)
      */
      let minHeartbeatMs: number;
      if (currentTripIdRef.current) {
        /* Active ride — lock to fast rate for accuracy */
        minHeartbeatMs = baseHeartbeatIntervalMsRef.current;
      } else if (slowGpsRef.current) {
        minHeartbeatMs = 30_000;
      } else if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        /* Background tab with no active trip — reduce to 60 s */
        minHeartbeatMs = 60_000;
      } else {
        /* Normal or stationary — heartbeatIntervalMsRef already updated above */
        minHeartbeatMs = heartbeatIntervalMsRef.current;
      }
      if (now - lastHeartbeatMsRef.current < minHeartbeatMs) return;

      /* Heartbeat always fires on the interval for server-side liveness.
         25 m gate only controls whether the cached coordinate is refreshed —
         the emit happens regardless so ghost-rider cleanup never evicts an
         online-but-stationary rider. */
      const lat = lastLatRef.current;
      const lng = lastLngRef.current;

      /* Decide which coordinates to include in this heartbeat:
         - First beat with GPS → use current position and cache it.
         - Subsequent beats where rider moved ≥ minDistance → update cache, send fresh coords.
         - Subsequent beats where rider moved < minDistance → re-send last cached position
           (server still receives a heartbeat; no stale-marker false-positive). */
      let coordsToSend: { latitude: number; longitude: number } | undefined;
      let freshCoords = false;
      if (lat !== undefined && lng !== undefined) {
        if (
          lastHeartbeatLatRef.current === undefined ||
          lastHeartbeatLngRef.current === undefined
        ) {
          lastHeartbeatLatRef.current = lat;
          lastHeartbeatLngRef.current = lng;
          coordsToSend = { latitude: lat, longitude: lng };
          freshCoords = true;
        } else {
          const moved = haversineMetres(
            lastHeartbeatLatRef.current,
            lastHeartbeatLngRef.current,
            lat,
            lng
          );
          if (moved >= heartbeatMinDistanceMRef.current) {
            lastHeartbeatLatRef.current = lat;
            lastHeartbeatLngRef.current = lng;
            coordsToSend = { latitude: lat, longitude: lng };
            freshCoords = true;
          } else {
            /* Re-use last-cached position so coord field is always present */
            coordsToSend = {
              latitude: lastHeartbeatLatRef.current,
              longitude: lastHeartbeatLngRef.current,
            };
          }
        }
      }

      lastHeartbeatMsRef.current = now;

      const gpsEnabled = gpsTrackingRef.current;
      s.emit("rider:heartbeat", {
        batteryLevel: batteryLevelRef.current,
        isOnline: true,
        timestamp: new Date().toISOString(),
        /* vehicleType from user profile for admin-fleet vehicle icon rendering */
        vehicleType: (user as unknown as Record<string, unknown> | null)?.vehicleType as
          | string
          | undefined,
        /* currentTripId set by Active.tsx when a ride is in progress */
        tripId: currentTripIdRef.current ?? undefined,
        action: currentTripIdRef.current ? "in_trip" : "idle",
        /* Only include GPS coordinates when the gpsTracking module is enabled.
           The liveness heartbeat still fires so ghost-rider cleanup never evicts
           an online-but-tracking-disabled rider. */
        ...(gpsEnabled ? coordsToSend : {}),
      });
      /* Emit rider:location_update only when GPS tracking is enabled AND the
         position is genuinely fresh (first beat or rider moved ≥ minDistance)
         so the server's location log only records real movement. */
      if (gpsEnabled && freshCoords && coordsToSend) {
        s.emit("rider:location_update", {
          lat: coordsToSend.latitude,
          lng: coordsToSend.longitude,
          ts: new Date().toISOString(),
        });
      }
    };

    s.off("connect", emitHeartbeat);
    s.on("connect", emitHeartbeat);
    emitHeartbeat();
    /* Poll at 1 s — actual emit is gated by interval + distance checks above */
    const heartbeatInterval = setInterval(emitHeartbeat, 1_000);

    return () => {
      clearInterval(heartbeatInterval);
      s.off("connect", emitHeartbeat);
    };
  }, [socket, user]);

  return (
    <SocketContext.Provider
      value={{
        socket,
        connected,
        setRiderPosition,
        batteryLevel: batteryLevelState,
        setSlowGps,
        setCurrentTripId,
        adminChatMessages,
        adminChatUnread,
        clearAdminChatUnread,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
}
