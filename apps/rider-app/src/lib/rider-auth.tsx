import { createLogger } from "@/lib/logger";
import { useQueryClient } from "@tanstack/react-query";
import {
  AuthProvider as SharedAuthProvider,
  useAuthContext,
  useTokenRefresh,
  type AuthUser as SharedAuthUser,
} from "@workspace/auth-react";
import { tDual } from "@workspace/i18n";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useLocation } from "wouter";
import { api, getRiderTokenStorage, tokenStoreReady } from "./api";
import {
  clearDashboardCache,
  clearRideHistoryCache,
  clearActiveRideCache,
  loadDashboardCache,
  loadRideHistoryCache,
  loadActiveRideCache,
  saveDashboardCache,
} from "./dashboardCache";
import { getRiderApiBase } from "./envValidation";
import { saveFeatureRulesCache, clearFeatureRulesCache, loadFeatureRulesCache } from "./featureGate";
import { executeLogoutSequence } from "./logoutSequence";
const log = createLogger("[auth]");

/**
 * Returns true when the error represents a network-level failure (server
 * unreachable, DNS, CORS preflight, timeout) rather than an HTTP-level
 * rejection (401, 403, 422 …).  Used at startup so a temporary outage does
 * not clear a valid cached session and force the rider back to login.
 */
function isNetworkUnreachable(err: unknown): boolean {
  /* fetch() itself threw — no HTTP response was received at all */
  if (err instanceof TypeError) return true;
  const e = err as Record<string, unknown>;
  /* No numeric status → error came before an HTTP response (timeout, abort
     already handled separately, ECONNREFUSED, etc.) */
  if (typeof e.status !== "number") return true;
  /* 5xx → server reached but failing; keep session so rider can retry */
  if (e.status >= 500) return true;
  return false;
}

export function normalizeRoles(u: { roles?: unknown; role?: unknown }): string[] {
  if (Array.isArray(u.roles)) return u.roles as string[];
  if (typeof u.role === "string") return [u.role];
  return [];
}

/**
 * Extracts the `sub` claim from a JWT without verifying the signature.
 * Safe to use on the client — we only need the user ID so the socket
 * can connect and the rider can receive real-time approval updates.
 */
export function decodeJwtSub(token: string): string {
  try {
    const parts = token.split(".");
    if (parts.length !== 3 || !parts[1]) return "";
    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"))) as Record<string, unknown>;
    return typeof payload.sub === "string" ? payload.sub : "";
  } catch {
    return "";
  }
}

export interface AuthUser {
  id: string;
  phone: string;
  name?: string;
  email?: string;
  avatar?: string;
  isOnline: boolean;
  walletBalance: string;
  isRestricted?: boolean;
  approvalStatus?: string;
  rejectionReason?: string | null;
  roles: string[];
  createdAt?: string;
  lastLoginAt?: string;
  stats: {
    deliveriesToday: number;
    earningsToday: number;
    totalDeliveries: number;
    totalEarnings: number;
    rating?: number;
  };
  cnic?: string;
  city?: string;
  address?: string;
  emergencyContact?: string;
  vehicleType?: string;
  vehiclePlate?: string;
  vehiclePhoto?: string;
  vehicleRegNo?: string;
  drivingLicense?: string;
  bankName?: string;
  bankAccount?: string;
  bankAccountTitle?: string;
  twoFactorEnabled?: boolean;
  cnicDocUrl?: string | null;
  cnicBackDocUrl?: string | null;
  licenseDocUrl?: string | null;
  regDocUrl?: string | null;
  dailyGoal?: number | null;
  cnicProvided?: boolean;
  phoneVerified?: boolean;
  emailVerified?: boolean;
  documentsSubmitted?: boolean;
  documentsApproved?: boolean;
  kycStatus?: string;
  idCardNumber?: string | null;
}

interface AuthCtx {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  storageError: boolean;
  /** True when startup validate-token / getMe() failed with a network / 5xx error.
   *  The cached token is preserved so the rider's session survives a retry. */
  apiUnreachable: boolean;
  /** Last successful getMe() snapshot loaded from IndexedDB when the network is
   *  unreachable. Non-null only when apiUnreachable === true and a prior session
   *  cached data is available. The UI should render a read-only dashboard. */
  cachedDashboard: AuthUser | null;
  /** Re-attempt the startup validate-token / getMe() without a full page reload. */
  retryConnection: () => void;
  twoFactorPending: boolean;
  setTwoFactorPending: (v: boolean) => void;
  login: (token: string, user: AuthUser, refreshToken?: string) => void;
  logout: (redirectPath?: string) => void;
  refreshUser: () => Promise<void>;
  sessionExpired: boolean;
  /** Reason code forwarded from the API 401 response body (e.g. "session_expired",
   *  "admin_revoked", "device_change"). Null when the reason is unknown. */
  sessionExpiredReason: string | null;
  clearSessionExpired: () => void;
  /** Re-fetch feature rules from the server and persist them to localStorage.
   *  Call this when checkGate returns cacheWasEmpty=true so a fresh-session
   *  rider is not permanently blocked while the cache is being hydrated. */
  refreshFeatureRules: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);
export function useAuth(): AuthCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used inside RiderAuthProvider");
  return ctx;
}

export function RiderAuthProvider({ children }: { children: ReactNode }) {
  return (
    <SharedAuthProvider
      baseURL={getRiderApiBase()}
      role="rider"
      storageType="web"
      refreshEndpoint="/auth/refresh"
      disableStartupRefresh={true}
    >
      <RiderAuthInner>{children}</RiderAuthInner>
    </SharedAuthProvider>
  );
}

function RiderAuthInner({ children }: { children: ReactNode }) {
  const sharedAuth = useAuthContext();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [storageError, setStorageError] = useState(false);
  const [apiUnreachable, setApiUnreachable] = useState(false);
  const [cachedDashboard, setCachedDashboard] = useState<AuthUser | null>(null);
  /* Incrementing this counter re-triggers the startup validate-token / getMe()
     effect so the rider can retry without a full page reload. */
  const [retryKey, setRetryKey] = useState(0);
  const [twoFactorPending, setTwoFactorPending] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [sessionExpiredReason, setSessionExpiredReason] = useState<string | null>(null);
  const refreshUserInflightRef = useRef<Promise<void> | null>(null);

  /* Stable refs so callbacks can always access the latest sharedAuth / navigate
     without becoming effect or useCallback dependencies. This breaks the circular
     dependency loop that previously caused the startup effect to re-run every time
     sharedAuth.login() was called inside it. */
  const sharedAuthRef = useRef(sharedAuth);
  sharedAuthRef.current = sharedAuth;
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;

  /* Gap 4: For token_expired, navigate to GuestLanding with ?reason=expired so
     GuestLanding can show a brief toast instead of the full-screen overlay.
     All other reason codes keep the existing SessionExpiredOverlay on /login. */
  const handleSdkLogout = useCallback((reason?: string) => {
    const resolvedReason = reason ?? "token_expired";
    api.clearTokens();
    setToken(null);
    setUser(null);
    sharedAuthRef.current.logout();
    if (resolvedReason === "token_expired") {
      navigateRef.current("/?reason=expired");
    } else {
      setSessionExpiredReason(resolvedReason);
      setSessionExpired(true);
      navigateRef.current("/login");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useTokenRefresh({
    tokenStorage: getRiderTokenStorage(),
    baseURL: getRiderApiBase(),
    refreshEndpoint: "/auth/refresh",
    leewaySeconds: 60,
    onLogout: handleSdkLogout,
    onRefresh: (newTok: string) => {
      setToken(newTok);
    },
  });

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      /* Reset unreachable flag at the start of each attempt so the retry path
         starts fresh without stale state from the previous attempt. */
      setApiUnreachable(false);
      setCachedDashboard(null);
      setLoading(true);
      try {
        await tokenStoreReady;
      } catch (storeErr) {
        log.error("tokenStoreReady failed:", storeErr);
        api.clearTokens();
        setStorageError(true);
        setLoading(false);
        return;
      }
      if (controller.signal.aborted) return;
      const t = api.getToken();
      if (!t) {
        setLoading(false);
        return;
      }
      setToken(t);
      try {
        /* Gap 2: Use POST /api/auth/validate-token as the first validation step
           before fetching the full profile. On 200 the token is confirmed valid;
           only then do we call getMe() to populate the rider profile.
           On 401 the resiClient attempts a cookie-refresh; if that succeeds the
           request is retried automatically. If the refresh also fails, triggerLogout
           fires and the error propagates to the catch block below. */
        await api.validateToken(controller.signal);
        if (controller.signal.aborted) return;

        /* Token is confirmed valid — now populate the rider profile. */
        const u = await api.getMe(controller.signal);
        if (controller.signal.aborted) return;
        const roles = normalizeRoles(u);
        if (roles.length > 0 && !roles.includes("rider")) {
          api.clearTokens();
          setToken(null);
          setLoading(false);
          return;
        }
        u.roles = roles;
        /* Use the ref so this call does NOT become an effect dependency.
           Previously, sharedAuth was listed in deps here, but calling
           sharedAuth.login() inside the effect updated AuthProvider state →
           new sharedAuth reference → effect re-ran → infinite loop that caused
           rapid concurrent API calls and "Token already refreshed" 401s. */
        sharedAuthRef.current.login(
          { id: u.id, phone: u.phone, email: u.email, role: "rider" } satisfies SharedAuthUser,
          t
        );
        setUser(u);
        /* Gap 3: Persist the successful profile snapshot for offline read-only mode. */
        saveDashboardCache(u).catch(() => { /* non-critical */ });
        /* Fetch and cache feature rules immediately after login for client-side gate checks */
        api.getAvailableFeatures().then((result) => {
          saveFeatureRulesCache(u.id, result.features);
        }).catch(() => { /* non-critical — background refresh will retry */ });
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") return;
        const e = err as Record<string, unknown>;
        if (e.code === "APPROVAL_PENDING") {
          /* Decode the JWT sub claim so the socket can connect and the rider
             receives real-time rider:approval_update events from the server. */
          setUser({
            id: decodeJwtSub(t),
            phone: "",
            isOnline: false,
            walletBalance: "0",
            roles: [],
            approvalStatus: "pending",
            stats: { deliveriesToday: 0, earningsToday: 0, totalDeliveries: 0, totalEarnings: 0 },
          });
          return;
        }
        if (e.code === "APPROVAL_REJECTED") {
          setUser({
            id: decodeJwtSub(t),
            phone: "",
            isOnline: false,
            walletBalance: "0",
            roles: [],
            approvalStatus: "rejected",
            rejectionReason: (e.rejectionReason as string | undefined) ?? null,
            stats: { deliveriesToday: 0, earningsToday: 0, totalDeliveries: 0, totalEarnings: 0 },
          });
          return;
        }
        if (isNetworkUnreachable(err)) {
          /* Network / 5xx failure — preserve the token so the session survives
             a temporary outage.  The app will surface a retry screen or the cached
             dashboard instead of bouncing the rider to the login page. */
          log.warn("startup validation failed with network error — keeping token, checking cache", err);
          setApiUnreachable(true);
          /* Gap 3: Load the last successful dashboard snapshot from IndexedDB.
             If found, the UI will render a read-only dashboard with a banner. */
          loadDashboardCache<AuthUser>()
            .then((cached) => {
              if (cached) {
                log.info("Loaded cached dashboard snapshot for offline read-only mode");
                setCachedDashboard(cached);
              }
            })
            .catch(() => { /* non-critical */ });
          /* Seed ride history and active ride caches into React Query so
             History.tsx and Active.tsx can render without a network request. */
          loadRideHistoryCache<{ history: unknown[]; hasMore: boolean }>()
            .then((cachedHistory) => {
              if (cachedHistory) {
                log.info("Seeding cached ride history into React Query for offline mode");
                queryClient.setQueryData(["rider-history", "all", "all"], {
                  pages: [cachedHistory],
                  pageParams: [0],
                });
              }
            })
            .catch(() => { /* non-critical */ });
          loadActiveRideCache<unknown>()
            .then((cachedActive) => {
              if (cachedActive !== null) {
                log.info("Seeding cached active ride into React Query for offline mode");
                queryClient.setQueryData(["rider-active"], cachedActive);
              }
            })
            .catch(() => { /* non-critical */ });
          /* Do NOT clear the token or navigate to /login. */
          return;
        }
        /* HTTP 4xx (401, 403, …) — the token is invalid; clear it as before. */
        api.clearTokens();
        setToken(null);
      } finally {
        setLoading(false);
      }
    })();
    return () => controller.abort();
  // sharedAuth is intentionally omitted from deps — the effect uses sharedAuthRef.current
  // so it never re-runs when sharedAuth reference changes (which would create an infinite
  // loop: login() updates AuthProvider state → new sharedAuth ref → effect re-runs → repeat).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retryKey]);

  useEffect(() => {
    /* clearAuth uses refs so sharedAuth / navigate are never stale, and this
       effect runs exactly once on mount (no deps). Previously the [sharedAuth, navigate]
       dep array caused the callback to be re-registered on every AuthProvider render,
       opening a window where the old callback was torn down before the new one was
       attached — during which a triggerLogout() would silently drop. */
    const clearAuth = (reason?: string) => {
      setSessionExpired(false);
      setSessionExpiredReason(null);
      api.clearTokens();
      setToken(null);
      setUser(null);
      sharedAuthRef.current.logout();
      /* Gap 4: token_expired → GuestLanding toast; other reasons → SessionExpiredOverlay */
      if (reason === "token_expired" || !reason) {
        navigateRef.current("/?reason=expired");
      } else {
        setSessionExpiredReason(reason);
        setSessionExpired(true);
        navigateRef.current("/login");
      }
    };
    /* triggerLogout() now passes the reason directly to this callback (preferred path),
       so the CustomEvent is NOT also dispatched. This eliminates the double-clearAuth
       race that previously caused the session-expired overlay to appear immediately
       after a valid login when the callback had no-reason but event had "session_expired". */
    const unregister = api.registerLogoutCallback((reason?: string) => clearAuth(reason));
    /* Fallback: handle the CustomEvent for any code paths that still dispatch it
       (e.g. no callback registered yet at boot, or future extensions). */
    const handleLogoutEvent = (ev: Event) => {
      const detail = (ev as CustomEvent<{ reason?: string }>).detail;
      clearAuth(detail?.reason ?? undefined);
    };
    window.addEventListener("ajkmart:logout", handleLogoutEvent);
    return () => {
      unregister();
      window.removeEventListener("ajkmart:logout", handleLogoutEvent);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = (t: string, u: AuthUser, refreshToken?: string) => {
    setSessionExpired(false);
    setSessionExpiredReason(null);
    const roles = normalizeRoles(u);
    if (roles.length > 0 && !roles.includes("rider"))
      throw new Error(tDual("ridersOnlyError", "en"));
    u.roles = roles;
    queryClient.clear();
    api.storeTokens(t, refreshToken);
    sharedAuth.login(
      { id: u.id, phone: u.phone, email: u.email, role: "rider" } satisfies SharedAuthUser,
      t
    );
    setToken(t);
    setUser(u);
    /* Fetch and cache feature rules immediately after login for client-side gate checks.
       Hydrate localStorage so checkGate() works on the very first action after login. */
    api.getAvailableFeatures().then((result) => {
      saveFeatureRulesCache(u.id, result.features);
    }).catch(() => { /* non-critical */ });
  };

  const logout = (redirectPath = "/login") => {
    const userId = user?.id;
    executeLogoutSequence(api, () => {
      try {
        sessionStorage.clear();
      } catch (error) { console.debug('[RiderAuth] sessionStorage.clear failed (non-critical):', error); }
      if (userId) clearFeatureRulesCache(userId);
      sharedAuth.logout();
      setToken(null);
      setUser(null);
      setCachedDashboard(null);
      clearDashboardCache().catch(() => { /* non-critical */ });
      clearRideHistoryCache().catch(() => { /* non-critical */ });
      clearActiveRideCache().catch(() => { /* non-critical */ });
      queryClient.clear();
      navigate(redirectPath);
    });
  };

  const refreshUser = useCallback(async () => {
    if (refreshUserInflightRef.current) return refreshUserInflightRef.current;
    const p = (async () => {
      try {
        const u = await api.getMe();
        const roles = normalizeRoles(u);
        if (roles.length > 0 && !roles.includes("rider")) {
          api.clearTokens();
          setToken(null);
          setUser(null);
          sharedAuth.logout();
          return;
        }
        u.roles = roles;
        setUser(u);
      } catch (err) {
        log.warn("refreshUser failed:", err);
        try {
          window.dispatchEvent(new Event("ajkmart:refresh-user-failed"));
        } catch (_e) {
          /* ignore dispatch errors in SSR/test environments */
        }
      } finally {
        refreshUserInflightRef.current = null;
      }
    })();
    refreshUserInflightRef.current = p;
    return p;
  }, [sharedAuth]);

  const clearSessionExpired = useCallback(() => {
    setSessionExpired(false);
    setSessionExpiredReason(null);
  }, []);

  const refreshFeatureRules = useCallback(async () => {
    const currentUser = user;
    if (!currentUser?.id) return;
    /* Skip the fetch if the cache is already populated — another call beat us here. */
    const existing = loadFeatureRulesCache(currentUser.id);
    if (existing) return;
    try {
      const result = await api.getAvailableFeatures();
      saveFeatureRulesCache(currentUser.id, result.features);
    } catch (err) {
      log.warn("[auth] refreshFeatureRules failed:", err);
    }
  }, [user]);

  const retryConnection = useCallback(() => {
    /* Re-run the startup getMe() effect without a full page reload.
       Also flush any stale React Query cache so the retry starts clean. */
    queryClient.clear();
    setRetryKey((k) => k + 1);
  }, [queryClient]);

  return (
    <Ctx.Provider
      value={{
        user,
        token,
        loading,
        storageError,
        apiUnreachable,
        cachedDashboard,
        retryConnection,
        twoFactorPending,
        setTwoFactorPending,
        login,
        logout,
        refreshUser,
        sessionExpired,
        sessionExpiredReason,
        clearSessionExpired,
        refreshFeatureRules,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}
