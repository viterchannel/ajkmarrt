import { createLogger } from "@/lib/logger";
import { createResilientFetcher } from "@workspace/api-client-react";
import { createAuthClient } from "@workspace/auth-react";
import { getAttestToken } from "./attestation";
import { reportApiError } from "./error-reporter";
import { getRiderApiBase } from "./envValidation";
const log = createLogger("[api]");

const BASE = getRiderApiBase();

/* PWA4: Centralized base URL getter used by socket.tsx and error-reporter.ts to ensure sync */
export function getApiBase(): string {
  return BASE;
}

const TOKEN_KEY = "ajkmart_rider_token";
const REFRESH_KEY = "ajkmart_rider_refresh_token";

/* ── Secure token storage ──────────────────────────────────────────────────────
   Access tokens are stored in @capacitor/preferences (secure plugin) on native.
   In-memory cache avoids repeated async reads during a session.

   Migration: on first boot, if an existing token is found in localStorage,
   it is moved to Preferences and deleted from localStorage.

   Refresh tokens are carried by an HttpOnly cookie (no localStorage). */

let _inMemoryAccessToken = "";
let _inMemoryRefreshToken = "";

/* One-time purge of legacy refresh-token persistence. */
try {
  if (typeof localStorage !== "undefined") {
    localStorage.removeItem(REFRESH_KEY);
  }
} catch (err) {
  log.warn(
    { err: err instanceof Error ? err.message : String(err) },
    "[api] legacy localStorage purge failed — non-critical"
  );
}

/* ── Preferences-backed async token storage ── */
async function preferencesSet(key: string, value: string): Promise<void> {
  try {
    const { Preferences } = await import("@capacitor/preferences");
    await Preferences.set({ key, value });
  } catch (err) {
    log.warn(
      { key, err: err instanceof Error ? err.message : String(err) },
      "[api] preferencesSet failed — token persistence unavailable"
    );
  }
}

async function preferencesGet(key: string): Promise<string> {
  try {
    const { Preferences } = await import("@capacitor/preferences");
    const { value } = await Preferences.get({ key });
    return value ?? "";
  } catch (err) {
    log.warn(
      { key, err: err instanceof Error ? err.message : String(err) },
      "[api] preferencesGet failed — returning empty string"
    );
    return "";
  }
}

async function preferencesRemove(key: string): Promise<void> {
  try {
    const { Preferences } = await import("@capacitor/preferences");
    await Preferences.remove({ key });
  } catch (err) {
    log.warn(
      { key, err: err instanceof Error ? err.message : String(err) },
      "[api] preferencesRemove failed — non-critical"
    );
  }
}

/* One-time migration: move any token from localStorage → Preferences at boot.
   Exported as a promise so AuthProvider can await it before reading the token —
   avoids treating a valid persisted session as "no token" when the async load
   hasn't completed yet (critical on app restart).
   Errors propagate to the caller so the AuthProvider can surface a visible
   auth failure rather than silently treating the session as unauthenticated. */
export const tokenStoreReady: Promise<void> = (async () => {
  try {
    if (typeof localStorage === "undefined") return;
    const legacy = localStorage.getItem(TOKEN_KEY);
    if (legacy) {
      _inMemoryAccessToken = legacy;
      await preferencesSet(TOKEN_KEY, legacy);
      localStorage.removeItem(TOKEN_KEY);
    } else {
      _inMemoryAccessToken = await preferencesGet(TOKEN_KEY);
    }
    /* Restore persisted refresh token (stored by localSet on every login/refresh).
       Without this, a page reload/app restart would lose the refresh token from
       memory — forcing the user to re-authenticate even with a valid session. */
    _inMemoryRefreshToken = await preferencesGet(REFRESH_KEY);
  } catch (err) {
    /* M-13: Preferences plugin unavailable (e.g. native plugin not yet initialized
       on first install). Resolve gracefully — auth flow will prompt re-login. */
    log.warn(
      { err: err instanceof Error ? err.message : String(err) },
      "[api] tokenStoreReady failed — session may require re-authentication"
    );
  }
})();

/* ── BroadcastChannel for cross-tab token sync ─────────────────────────────
   When the access token is refreshed in one tab, other open tabs receive the
   updated token so they don't fall back to an expired JWT and get 401s.     */
const _tokenChannel: BroadcastChannel | null = (() => {
  try {
    return typeof BroadcastChannel !== "undefined"
      ? new BroadcastChannel("ajkmart_rider_token_sync")
      : null;
  } catch {
    return null;
  }
})();

if (_tokenChannel) {
  _tokenChannel.onmessage = (ev: MessageEvent<unknown>) => {
    const data = ev.data as { type?: string; token?: string };
    if (data?.type === "token_updated" && typeof data.token === "string" && data.token) {
      _inMemoryAccessToken = data.token;
    }
  };
}

/* Access token helpers — Preferences-backed, with in-memory cache */
function sessionGet(): string {
  return _inMemoryAccessToken;
}
function sessionSet(value: string): void {
  _inMemoryAccessToken = value;
  preferencesSet(TOKEN_KEY, value).catch((err) => {
    log.warn(
      { err: err instanceof Error ? err.message : String(err) },
      "[api] sessionSet persistence failed"
    );
  });
  /* Notify other open tabs that the token has been refreshed */
  try {
    _tokenChannel?.postMessage({ type: "token_updated", token: value });
    // eslint-disable-next-line ajk-local/no-silent-catch
  } catch (error) {
    /* BroadcastChannel post can fail if the channel was closed — non-critical */
    console.warn("[api] BroadcastChannel post failed:", error);
  }
}
function sessionRemove(): void {
  _inMemoryAccessToken = "";
  preferencesRemove(TOKEN_KEY).catch((err) => {
    log.warn(
      { err: err instanceof Error ? err.message : String(err) },
      "[api] sessionRemove persistence failed"
    );
  });
}

/* Refresh token helpers — Preferences-backed (identical to access token approach).
   Persisting the refresh token via Capacitor Preferences ensures sessions survive
   app restarts/PWA reload. The server also delivers it as an HttpOnly cookie, but
   the Preferences copy is the source of truth for the POST-body refresh call.   */
function localGet(): string {
  return _inMemoryRefreshToken;
}
function localSet(value: string): void {
  _inMemoryRefreshToken = value;
  preferencesSet(REFRESH_KEY, value).catch((err) => {
    log.warn(
      { err: err instanceof Error ? err.message : String(err) },
      "[api] localSet persistence failed"
    );
  });
}
function localRemove(): void {
  _inMemoryRefreshToken = "";
  preferencesRemove(REFRESH_KEY).catch((err) => {
    log.warn(
      { err: err instanceof Error ? err.message : String(err) },
      "[api] localRemove persistence failed"
    );
  });
}

/* ── Rider token storage — Preferences-backed with in-memory cache ───────────
   Exported so rider-auth.tsx can pass it to useTokenRefresh (SDK hook) without
   duplicating the Preferences integration. */
export const riderTokenStorage = {
  getAccessToken: sessionGet,
  setAccessToken: sessionSet,
  removeAccessToken: sessionRemove,
  getRefreshToken: localGet,
  setRefreshToken: localSet,
  removeRefreshToken: localRemove,
  clear: () => {
    sessionRemove();
    localRemove();
  },
};

/** Returns the shared rider token storage instance for use in SDK hooks. */
export function getRiderTokenStorage() {
  return riderTokenStorage;
}

/* ── Shared SDK auth client (typed HTTP client from @workspace/auth-react) ── */
export const authClient = createAuthClient({
  baseURL: BASE,
  tokenStorage: riderTokenStorage,
});

/* Read the access token from Preferences-backed in-memory cache. */
function getToken(): string {
  return sessionGet();
}

function getRefreshToken(): string {
  return localGet();
}

/* Sweep localStorage for any stale rider auth keys from older app versions. */
function sweepLegacyTokens(): void {
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      if (key === TOKEN_KEY || key === REFRESH_KEY) continue;
      if (key.startsWith("rider_") || key.startsWith("ajkmart_rider")) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((k) => {
      try {
        localStorage.removeItem(k);
      } catch (err) {
        log.warn(
          { key: k, err: err instanceof Error ? err.message : String(err) },
          "[api] sweepLegacyTokens removeItem failed"
        );
      }
    });
  } catch (err) {
    log.warn(
      { err: err instanceof Error ? err.message : String(err) },
      "[api] sweepLegacyTokens failed — non-critical"
    );
  }
}

function clearTokens(): void {
  sessionRemove();
  localRemove();
  sweepLegacyTokens();
  _inMemoryAccessToken = "";
  _inMemoryRefreshToken = "";
}

/* ── Module-level token-refresh callbacks ─────────────────────────────────────
   Registered by socket.tsx (and any other consumer) to be notified immediately
   when a token refresh succeeds — enabling instant socket reconnection rather
   than waiting for the next polling tick. */
const _tokenRefreshCallbacks = new Set<() => void>();

export function registerTokenRefreshCallback(fn: () => void): () => void {
  _tokenRefreshCallbacks.add(fn);
  return () => {
    _tokenRefreshCallbacks.delete(fn);
  };
}

/* ── Module-level logout callback ─────────────────────────────────────────────
   The auth context registers this callback at mount time. Using a module-level
   reference avoids coupling to React's event system and guarantees the logout
   fires regardless of which component is mounted or whether the CustomEvent
   listener has been attached yet. */
let _logoutCallback: ((reason?: string) => void) | null = null;

/* ── Last 401 reason capture ───────────────────────────────────────────────────
   The `on401` callback in _resiClient fires when a 401 response is received,
   BEFORE the token refresh is attempted. We read the response body here and
   store any reason/code so that if the refresh ultimately fails and we call
   triggerLogout(), we can forward a meaningful reason code rather than the
   generic "session_expired". Cleared after use to avoid stale values. */
let _last401Reason: string | null = null;

function _capture401Reason(body: unknown): void {
  try {
    const b = body as Record<string, unknown> | null;
    if (!b || typeof b !== "object") return;
    const dataBlock = b.data as Record<string, unknown> | undefined;
    const reason =
      (b.reason as string | undefined) ??
      (dataBlock?.reason as string | undefined) ??
      (b.code as string | undefined) ??
      (dataBlock?.code as string | undefined) ??
      null;
    _last401Reason = reason;
  } catch {
    /* non-critical */
  }
}

export function registerLogoutCallback(fn: (reason?: string) => void): () => void {
  _logoutCallback = fn;
  return () => {
    if (_logoutCallback === fn) _logoutCallback = null;
  };
}

function triggerLogout(fallbackReason: string) {
  /* Use the reason captured from the 401 response body (if any), falling back
     to the generic reason supplied by the caller. Clear after use so the stale
     reason cannot bleed into a subsequent, unrelated auth flow. */
  const reason = _last401Reason ?? fallbackReason;
  _last401Reason = null;
  clearTokens();
  if (_logoutCallback) {
    /* Preferred path: pass the reason directly so clearAuth can show the
       correct UI (overlay vs toast) without a second CustomEvent dispatch.
       Skipping the event avoids the double-trigger race that caused the
       session-expired overlay to flash immediately after a fresh login. */
    _logoutCallback(reason);
  } else {
    /* Fallback: no React callback registered yet (e.g. very early boot).
       Dispatch the CustomEvent so the listener in rider-auth can handle it. */
    try {
      window.dispatchEvent(new CustomEvent("ajkmart:logout", { detail: { reason } }));
    } catch (err) {
      log.warn(
        { err: err instanceof Error ? err.message : String(err) },
        "[api] dispatchEvent(ajkmart:logout) failed — non-critical"
      );
    }
  }
}

export interface ApiError extends Error {
  status?: number;
  responseData?: { existingAccount?: boolean; [key: string]: unknown };
}

export function isApiError(e: unknown): e is ApiError {
  return e instanceof Error && ("status" in e || "responseData" in e);
}

/* ── Configurable network settings ────────────────────────────────────────────
   These are updated at startup by the platform config. Defaults match the
   hardcoded values that were previously used so existing behaviour is preserved
   when the platform config cannot be fetched. */
let _apiTimeoutMs = 30_000;

export function setApiTimeoutMs(ms: number): void {
  if (Number.isFinite(ms) && ms > 0) _apiTimeoutMs = Math.min(ms, 300_000);
}

/* ── Resilient API fetcher (createResilientFetcher from @workspace/api-client-react) ──
   Single instance providing: Bearer injection, timeout, 401→refresh (mutex)→retry,
   per-endpoint circuit breaker, and 5xx exponential-backoff retry.
   No manual circuit-breaker or retry loop needed in apiFetch — all handled here.
   setToken fires _tokenRefreshCallbacks (socket reconnect) and sweeps stale localStorage.
   _resiClient.refresh() exposes the mutex-guarded refresh for api.refreshToken.        */
const CB_DEFAULT_RETRIES = 3;
/* Captures the raw JSON envelope (before data-unwrapping) for the most recent
   successful response. Used by apiFetch's _returnEnvelope mode so callers that
   need top-level envelope fields (e.g. _serverTime) can retrieve them without
   a second request.  Safe for rider's single-context, one-at-a-time usage. */
let _lastRawJson: unknown = undefined;
const _resiClient = createResilientFetcher({
  baseUrl: BASE,
  getToken: () => sessionGet() || null,
  setToken: (token: string | null) => {
    if (token) sessionSet(token);
    sweepLegacyTokens();
    _tokenRefreshCallbacks.forEach((fn) => {
      try {
        fn();
      } catch (err) {
        log.warn(
          { err: err instanceof Error ? err.message : String(err) },
          "[api] tokenRefreshCallback threw — non-critical"
        );
      }
    });
  },
  getRefreshToken: localGet,
  setRefreshToken: localSet,
  on401: _capture401Reason,
  onRefreshFailed: (isTransient: boolean) => {
    if (!isTransient) triggerLogout("token_expired");
  },
  refreshEndpoint: `${BASE}/auth/refresh`,
  timeoutMs: () => _apiTimeoutMs,
  credentialsMode: "include",
  maxRetries: CB_DEFAULT_RETRIES,
  failureThreshold: 3,
  cooldownMs: 30_000,
  onRawJson: (json: unknown) => {
    _lastRawJson = json;
    /* Capture CSRF token from every auth response so Preferences stays current.
       storeCsrfToken is a hoisted function declaration — safe to call here. */
    const csrfInBody = (json as Record<string, unknown>).csrfToken;
    if (typeof csrfInBody === "string" && csrfInBody) {
      storeCsrfToken(csrfInBody).catch((err: unknown) => {
        log.debug("[api] CSRF token store failed:", err);
      });
    }
  },
});

interface ApiEnvelope<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  code?: string;
}

/* T1: Rider request-feed types are imported from @workspace/api-zod (generated
   from the OpenAPI spec). RiderOrder / RiderRide have all rider-facing fields
   with monetary values typed as string for precision safety. They are re-exported
   here as `Order` / `Ride` so existing consumers (Home.tsx etc.) need no changes. */
export interface Order {
  id: string;
  status: string;
  total?: string | number | null;
  type?: string | null;
  createdAt: string;
  itemCount?: number | null;
  item_count?: number | null;
  distanceKm?: string | number | null;
  distance_km?: string | number | null;
  deliveryAddress?: string | null;
  delivery_address?: string | null;
  vendorStoreName?: string | null;
  vendor_store_name?: string | null;
  vendorLat?: string | number | null;
  vendorLng?: string | number | null;
  deliveryLat?: string | number | null;
  deliveryLng?: string | number | null;
}
export interface Ride {
  id: string;
  status: string;
  fare?: string | number | null;
  type?: string | null;
  createdAt: string;
  offeredFare?: number | string | null;
  bargainNote?: string | null;
  distance?: string | number | null;
  pickupAddress?: string | null;
  dropAddress?: string | null;
  pickupLat?: string | number | null;
  pickupLng?: string | number | null;
  dropLat?: string | number | null;
  dropLng?: string | number | null;
  riderDistanceKm?: number | null;
  riderEtaMin?: number | null;
  dispatchedRiderId?: string | null;
  vehicleType?: string | null;
  isParcel?: boolean | null;
  isPoolRide?: boolean | null;
  myBid?: { fare: number | string } | null;
  paymentMethod?: string | null;
}
export interface RiderRequestsResponse {
  orders: Order[];
  rides: Ride[];
  _serverTime: string | null;
}

/* ── CSRF token — Preferences-backed ──────────────────────────────────────────
   Capacitor does not expose HttpOnly cookies to JavaScript, so document.cookie
   is not a reliable source of the CSRF token in native contexts. Instead, we
   read the `csrfToken` field that the server returns in auth response bodies,
   persist it in @capacitor/preferences, and hold an in-memory copy for fast
   synchronous access in `apiFetch`. Falls back to document.cookie on web builds
   where the HttpOnly cookie is readable by XHR but Preferences is unavailable. */
const CSRF_KEY = "ajkmart_rider_csrf_token";
let _inMemoryCsrfToken = "";
let _csrfPrefetchDone = false;

export async function storeCsrfToken(token: string): Promise<void> {
  if (!token) return;
  _inMemoryCsrfToken = token;
  await preferencesSet(CSRF_KEY, token).catch((err: unknown) => {
    log.debug("[api] CSRF prefs store failed:", err);
  });
}

/* Load persisted CSRF token from Preferences into memory (called from tokenStoreReady). */
export const csrfStoreReady: Promise<void> = (async () => {
  try {
    _inMemoryCsrfToken = await preferencesGet(CSRF_KEY);
  } catch {
    /* Fall back to document.cookie on failure */
    try {
      const match = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]+)/);
      if (match) _inMemoryCsrfToken = decodeURIComponent(match[1]!);
    } catch (e) {
      log.debug("[api] document.cookie unavailable:", e);
    }
  }
})();

function readCsrfFromCookie(): string {
  /* Primary: in-memory value sourced from auth response body via storeCsrfToken */
  if (_inMemoryCsrfToken) return _inMemoryCsrfToken;
  /* Fallback: document.cookie (web-only; unreliable in Capacitor) */
  try {
    const match = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]+)/);
    return match ? decodeURIComponent(match[1]!) : "";
  } catch {
    return "";
  }
}

/* L-08: Generic type parameter enables typed callers (e.g. apiFetch<{token:string}>("..."))
   while defaulting to `any` so all existing untyped call-sites remain valid. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function apiFetch<T = any>(
  path: string,
  opts: RequestInit = {},
  _returnEnvelope = false
): Promise<T> {
  /* Ensure the token store has been seeded from Preferences before any request fires.
     tokenStoreReady resolves once the persisted access + refresh tokens are loaded.
     Without this guard, the first request after a cold restart fires without a token. */
  await tokenStoreReady;
  /* M-06: Also await CSRF hydration so state-mutating requests on native
     Capacitor (where document.cookie is unavailable) always carry a valid
     CSRF token loaded from Preferences rather than an empty fallback string. */
  await csrfStoreReady;

  const isFormData = opts.body instanceof FormData;
  const method = (opts.method ?? "GET").toUpperCase();
  const isStateMutating = ["POST", "PUT", "PATCH", "DELETE"].includes(method);

  /* M-07: If the token store is empty on the first state-mutating request
     (e.g. cold app start before any login), prefetch /api/auth/config once
     so the server sets the CSRF cookie, then re-read it.  This avoids the
     "first POST always fails CSRF validation" problem on fresh installs.   */
  let csrfToken = isStateMutating ? readCsrfFromCookie() : "";
  if (isStateMutating && !csrfToken && !_csrfPrefetchDone) {
    let prefetchOk = false;
    try {
      /* Use absolute BASE URL so the prefetch works in non-browser / native
         Capacitor contexts where relative paths resolve incorrectly.        */
      const cfgRes = await fetch(`${BASE}/auth/config`, { credentials: "include" });
      if (cfgRes.ok) {
        /* Parse the response body and extract csrfToken for Capacitor native
           environments where document.cookie is not reliably readable.      */
        try {
          const cfgJson = await cfgRes.json() as Record<string, unknown>;
          const bodyToken = (cfgJson.data as Record<string, unknown> | undefined)?.csrfToken;
          if (typeof bodyToken === "string" && bodyToken) {
            await storeCsrfToken(bodyToken);
          }
        } catch {
          /* Non-critical — fall through to cookie-based fallback below.    */
        }
        /* Mark done only on a successful 2xx so a transient failure (e.g.
           503) does not permanently suppress future prefetch attempts.      */
        _csrfPrefetchDone = true;
        prefetchOk = true;
        csrfToken = readCsrfFromCookie();
      }
    } catch {
      /* Network failure — prefetchOk stays false, handled below.           */
    }
    if (!prefetchOk) {
      /* Fail fast rather than silently sending a tokenless mutating request.
         The next attempt will retry the prefetch (_csrfPrefetchDone = false).*/
      throw new Error(
        "Unable to initialize session. Please check your connection and try again."
      );
    }
    if (!csrfToken) {
      /* Prefetch succeeded but token still absent — server unavailable or
         cookie/Preferences write failed.  Fail fast so the caller can show
         a user-readable error rather than sending a tokenless POST.         */
      throw new Error(
        "Session could not be initialized. Please restart the app and try again."
      );
    }
  }

  /* Attach the session-attestation token (Play Integrity / App Attest) when
     available.  The server validates it on sensitive endpoints.  On web builds
     getAttestToken() returns "" immediately (no-op), adding zero latency.     */
  let attestToken = "";
  try {
    attestToken = await getAttestToken();
  } catch {
    /* attestation unavailable — continue without the header */
  }

  const mergedOpts: RequestInit = {
    ...opts,
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
      ...(attestToken ? { "X-Attest-Token": attestToken } : {}),
      ...((opts.headers as Record<string, string>) || {}),
    },
  };

  try {
    const result = await _resiClient.fetch(path, mergedOpts);
    /* _returnEnvelope: caller wants the full server envelope (e.g. _serverTime).
       _lastRawJson is populated by the onRawJson callback before data-unwrapping. */
    return (_returnEnvelope ? _lastRawJson : result) as T;
  } catch (err: unknown) {
    /* Custom 403 handling: distinguish auth denials (force logout) from
       business-rule blocks (approval pending, feature disabled, etc.).
       _resiClient throws { status, responseData } on non-ok responses. */
    const e = err as { status?: number; responseData?: Record<string, unknown> };
    if (e.status === 403 && e.responseData) {
      const body = e.responseData;
      const msg = (body.error as string) || "";
      /* code and rejectionReason may live at top level OR inside body.data */
      const code =
        (body.code as string) ||
        ((body.data as Record<string, unknown> | undefined)?.code as string) ||
        "";
      const rejectionReason =
        body.rejectionReason ??
        (body.data as Record<string, unknown> | undefined)?.rejectionReason ??
        null;
      const approvalStatus =
        body.approvalStatus ??
        (body.data as Record<string, unknown> | undefined)?.approvalStatus ??
        null;
      /* Machine-readable blocking reason — e.g. phone_not_verified, account_not_approved,
         insufficient_wallet_balance.  May live at top level or inside body.data. */
      const reason =
        (body.reason as string | undefined) ??
        ((body.data as Record<string, unknown> | undefined)?.reason as string | undefined) ??
        null;
      /* APPROVAL_PENDING and APPROVAL_REJECTED are NOT auth failures — do not force logout */
      const AUTH_DENY_CODES = [
        "AUTH_REQUIRED",
        "ROLE_DENIED",
        "TOKEN_INVALID",
        "TOKEN_EXPIRED",
        "ACCOUNT_BANNED",
      ];
      const AUTH_DENY_PHRASES = [
        "access denied",
        "forbidden",
        "unauthorized",
        "authentication required",
        "token invalid",
        "token expired",
      ];
      const isAuthDenial =
        AUTH_DENY_CODES.includes(code) ||
        AUTH_DENY_PHRASES.some((p) => msg.toLowerCase().startsWith(p));
      if (isAuthDenial) triggerLogout("access_denied");
      /* Feature-access / verification gate metadata — passed through so UI
         can open a VerificationGateModal instead of a generic toast. */
      const blocked =
        !!(body.blocked) ||
        !!((body.data as Record<string, unknown> | undefined)?.blocked);
      const requiredVerifications: string[] = Array.isArray(body.requiredVerifications)
        ? (body.requiredVerifications as string[])
        : Array.isArray((body.data as Record<string, unknown> | undefined)?.requiredVerifications)
          ? ((body.data as Record<string, unknown>).requiredVerifications as string[])
          : [];
      const missingVerifications: string[] = Array.isArray(body.missingVerifications)
        ? (body.missingVerifications as string[])
        : Array.isArray((body.data as Record<string, unknown> | undefined)?.missingVerifications)
          ? ((body.data as Record<string, unknown>).missingVerifications as string[])
          : [];
      throw Object.assign(new Error(msg || "Access denied"), {
        status: 403,
        code,
        reason,
        rejectionReason,
        approvalStatus,
        blocked,
        requiredVerifications,
        missingVerifications,
      });
    }
    /* For non-auth errors, fire the error reporter then re-throw unchanged. */
    const status = e.status ?? 0;
    if (status && status !== 401) {
      try {
        reportApiError(path, status, (err as Error).message || "Request failed");
      } catch (reportErr) {
        log.warn(
          { err: reportErr instanceof Error ? reportErr.message : String(reportErr) },
          "[api] error reporter threw — non-critical"
        );
      }
    }
    throw err;
  }
}

export const api = {
  /* Auth */
  sendOtp: (
    phone: string,
    captchaToken?: string,
    preferredChannel?: string,
    signal?: AbortSignal
  ) =>
    apiFetch("/auth/send-otp", {
      method: "POST",
      body: JSON.stringify({
        phone,
        captchaToken,
        ...(preferredChannel ? { preferredChannel } : {}),
      }),
      ...(signal ? { signal } : {}),
    }),
  verifyOtp: (phone: string, otp: string, deviceFingerprint?: string, captchaToken?: string) =>
    apiFetch("/auth/verify-otp", {
      method: "POST",
      body: JSON.stringify({ phone, otp, role: "rider", deviceFingerprint, captchaToken }),
    }),
  sendEmailOtp: (email: string, captchaToken?: string) =>
    apiFetch("/auth/send-email-otp", {
      method: "POST",
      body: JSON.stringify({ email, captchaToken }),
    }),
  verifyEmailOtp: (email: string, otp: string, deviceFingerprint?: string, captchaToken?: string) =>
    apiFetch("/auth/verify-email-otp", {
      method: "POST",
      body: JSON.stringify({ email, otp, role: "rider", deviceFingerprint, captchaToken }),
    }),
  loginUsername: (
    identifier: string,
    password: string,
    captchaToken?: string,
    deviceFingerprint?: string
  ) =>
    apiFetch("/auth/login", {
      method: "POST",
      body: JSON.stringify({
        identifier,
        password,
        role: "rider",
        captchaToken,
        deviceFingerprint,
      }),
    }),
  checkAvailable: (
    data: { phone?: string; email?: string; username?: string },
    signal?: AbortSignal
  ) =>
    apiFetch("/auth/check-available", {
      method: "POST",
      body: JSON.stringify(data),
      ...(signal ? { signal } : {}),
    }),
  logout: (refreshToken?: string) =>
    apiFetch("/auth/logout", { method: "POST", body: JSON.stringify({ refreshToken }) }).finally(
      clearTokens
    ),

  registerRider: (data: {
    name: string;
    phone?: string;
    email?: string;
    cnic?: string;
    vehicleType: string;
    vehicleRegistration?: string;
    drivingLicense: string;
    password?: string;
    captchaToken?: string;
    username?: string;
    address?: string;
    area?: string;
    city?: string;
    emergencyContact?: string;
    vehiclePlate?: string;
    vehiclePhoto?: string;
    documents?: string;
    registrationLat?: number;
    registrationLng?: number;
    deviceMeta?: Record<string, unknown>;
  }) =>
    apiFetch("/auth/register", {
      method: "POST",
      body: JSON.stringify({ ...data, role: "rider", vehicleRegNo: data.vehicleRegistration ?? data.vehiclePlate }),
    }),
  emailRegisterRider: (data: {
    name: string;
    phone?: string;
    email?: string;
    cnic?: string;
    vehicleType: string;
    vehicleRegistration?: string;
    drivingLicense: string;
    password: string;
    captchaToken?: string;
    username?: string;
    address?: string;
    city?: string;
    emergencyContact?: string;
    vehiclePlate?: string;
    vehiclePhoto?: string;
    documents?: string;
  }) =>
    apiFetch("/auth/email-register", {
      method: "POST",
      body: JSON.stringify({ ...data, role: "rider", vehicleRegNo: data.vehicleRegistration ?? data.vehiclePlate }),
    }),
  verifyTotpCode: (code: string, phone: string, captchaToken?: string) =>
    apiFetch("/auth/verify-otp", {
      method: "POST",
      body: JSON.stringify({ phone, otp: code, role: "rider", captchaToken }),
    }),
  /**
   * GET /service-zones/public (legacy — use getActiveZones for service-filtered results)
   * Returns admin-configured cities and their zone/area names.
   * No auth required — safe to call on the registration form.
   */
  getPublicZones: (): Promise<{
    cities: string[];
    zones: { city: string; areas: string[] }[];
  }> => apiFetch("/service-zones/public") as Promise<{
    cities: string[];
    zones: { city: string; areas: string[] }[];
  }>,

  /**
   * GET /locations/active-cities?service=rides
   * Returns only active cities+areas that apply to the given service type.
   * Rider registration should use service="rides".
   */
  getActiveZones: (service: "rides" | "orders" | "parcel"): Promise<{
    cities: string[];
    zones: { city: string; areas: string[] }[];
  }> => apiFetch(`/locations/active-cities?service=${service}`) as Promise<{
    cities: string[];
    zones: { city: string; areas: string[] }[];
  }>,

  uploadFile: (data: { file: string; filename?: string; mimeType?: string }) =>
    apiFetch("/uploads", { method: "POST", body: JSON.stringify(data) }),
  /* Multipart/form-data upload — avoids large base64 payload; used for delivery proof.
     Calls /uploads/proof which is gated by riderAuth and handles multipart parsing. */
  uploadProof: (file: File) => {
    const form = new FormData();
    form.append("file", file, file.name || "proof.jpg");
    form.append("purpose", "delivery_proof");
    return apiFetch("/uploads/proof", { method: "POST", body: form });
  },
  /* Pre-fetch a registration upload session token once and reuse across multiple uploads. */
  getRegistrationUploadToken: async (): Promise<string> => {
    const tokenRes = await apiFetch("/uploads/register-token", { method: "POST" });
    const token: string = tokenRes?.token ?? "";
    if (!token) throw new Error("Failed to obtain upload session token");
    return token;
  },
  /* Upload a single document using a pre-fetched token (avoids fetching a new token per file). */
  uploadRegistrationDocWithToken: async (file: File, uploadToken: string) => {
    const form = new FormData();
    form.append("file", file, file.name || "document.jpg");
    return apiFetch("/uploads/register", {
      method: "POST",
      body: form,
      headers: { "x-upload-token": uploadToken },
    });
  },
  /* XHR-based upload that reports real byte-level upload progress (0–100).
     Uses XMLHttpRequest instead of fetch because the Fetch API does not
     expose upload progress events. Auth and CSRF headers are attached manually. */
  uploadRegistrationDocWithProgress: async (
    file: File,
    uploadToken: string,
    onProgress?: (pct: number) => void
  ): Promise<{ url?: string; downloadToken?: string; filename?: string; size?: number }> => {
    await tokenStoreReady;
    const accessToken = sessionGet();
    const csrfToken = readCsrfFromCookie();
    return new Promise((resolve, reject) => {
      const form = new FormData();
      form.append("file", file, file.name || "document.jpg");
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${BASE}/uploads/register`, true);
      xhr.withCredentials = true;
      if (accessToken) xhr.setRequestHeader("Authorization", `Bearer ${accessToken}`);
      if (csrfToken) xhr.setRequestHeader("X-CSRF-Token", csrfToken);
      xhr.setRequestHeader("x-upload-token", uploadToken);
      if (onProgress && xhr.upload) {
        xhr.upload.onprogress = (ev) => {
          if (ev.lengthComputable && ev.total > 0) {
            onProgress(Math.min(99, Math.round((ev.loaded / ev.total) * 100)));
          }
        };
      }
      xhr.onerror = () => reject(new Error("Network error during upload"));
      xhr.onload = () => {
        if (onProgress) onProgress(100);
        let parsed: Record<string, unknown> | null = null;
        try {
          parsed = xhr.responseText
            ? (JSON.parse(xhr.responseText) as Record<string, unknown>)
            : null;
        } catch {
          parsed = null;
        }
        if (xhr.status >= 200 && xhr.status < 300) {
          const body = parsed?.data ? (parsed.data as Record<string, unknown>) : (parsed ?? {});
          resolve(
            body as { url?: string; downloadToken?: string; filename?: string; size?: number }
          );
        } else {
          const msg =
            (parsed as { error?: string } | null)?.error ?? `Upload failed (${xhr.status})`;
          reject(Object.assign(new Error(msg), { status: xhr.status }));
        }
      };
      xhr.send(form);
    });
  },
  uploadRegistrationDoc: async (file: File) => {
    /* Obtain a short-lived upload session token (required by the server
       to bind the upload to an active onboarding flow). */
    const fetchToken = async () => {
      const tokenRes = await apiFetch("/uploads/register-token", { method: "POST" });
      const token: string = tokenRes?.token ?? "";
      if (!token) throw new Error("Failed to obtain upload session token");
      return token;
    };
    const doUpload = async (uploadToken: string) => {
      const form = new FormData();
      form.append("file", file, file.name || "document.jpg");
      return apiFetch("/uploads/register", {
        method: "POST",
        body: form,
        headers: { "x-upload-token": uploadToken },
      });
    };
    const firstToken = await fetchToken();
    try {
      return await doUpload(firstToken);
    } catch (e: unknown) {
      const status = (e as { status?: number })?.status;
      /* Retry on 401 (expired JWT) and 403 (consumed/invalid nonce). */
      if (status === 401 || status === 403) {
        const freshToken = await fetchToken();
        return doUpload(freshToken);
      }
      throw e;
    }
  },
  /* Request a KYC review from the rider's already-uploaded registration documents. */
  requestKycReview: () => apiFetch("/riders/kyc/request", { method: "POST" }),
  recoverUsername: (phone: string) =>
    apiFetch("/auth/recover-username", { method: "POST", body: JSON.stringify({ phone }) }) as Promise<{ masked: string | null }>,
  forgotPassword: (data: {
    method: "phone" | "email";
    phone?: string;
    email?: string;
    captchaToken?: string;
  }) => apiFetch("/auth/forgot-password", { method: "POST", body: JSON.stringify(data) }),
  verifyResetOtp: (data: { phone?: string; email?: string; otp: string; captchaToken?: string }) =>
    apiFetch("/auth/verify-reset-otp", { method: "POST", body: JSON.stringify(data) }),
  resetPassword: (data: {
    resetToken: string;
    newPassword: string;
    totpCode?: string;
    captchaToken?: string;
  }) => apiFetch("/auth/reset-password", { method: "POST", body: JSON.stringify(data) }),
  socialGoogle: (data: { idToken: string; deviceMeta?: Record<string, unknown> }) =>
    apiFetch("/auth/social/google", {
      method: "POST",
      body: JSON.stringify({ ...data, role: "rider" }),
    }),
  socialFacebook: (data: { accessToken: string; deviceMeta?: Record<string, unknown> }) =>
    apiFetch("/auth/social/facebook", {
      method: "POST",
      body: JSON.stringify({ ...data, role: "rider" }),
    }),
  magicLinkVerify: (data: { token: string }) =>
    apiFetch("/auth/magic-link/verify", { method: "POST", body: JSON.stringify(data) }),
  twoFactorSetup: () => apiFetch("/auth/2fa/setup"),
  twoFactorEnable: (data: { code: string }) =>
    apiFetch("/auth/2fa/verify-setup", { method: "POST", body: JSON.stringify(data) }),
  twoFactorVerify: (data: {
    code: string;
    tempToken?: string;
    deviceFingerprint?: string;
    trustDevice?: boolean;
  }) => apiFetch("/auth/2fa/verify", { method: "POST", body: JSON.stringify(data) }),
  twoFactorRecovery: (data: {
    backupCode: string;
    tempToken?: string;
    deviceFingerprint?: string;
  }) => apiFetch("/auth/2fa/recovery", { method: "POST", body: JSON.stringify(data) }),
  twoFactorDisable: (data: { code: string }) =>
    apiFetch("/auth/2fa/disable", { method: "POST", body: JSON.stringify(data) }),
  sendMagicLink: (email: string, deviceMeta?: Record<string, unknown>) =>
    apiFetch("/auth/magic-link/send", {
      method: "POST",
      body: JSON.stringify({ email, ...(deviceMeta ? { deviceMeta } : {}) }),
    }),

  validateToken: (signal?: AbortSignal) =>
    apiFetch("/auth/validate-token", {
      method: "POST",
      body: "{}",
      ...(signal ? { signal } : {}),
    }),

  /* Token helpers */
  storeTokens: (token: string, refreshToken?: string) => {
    /* Store access token in Preferences; refresh token in-memory only */
    sessionSet(token);
    if (refreshToken) localSet(refreshToken);
    /* Sweep all stale legacy rider access keys from localStorage */
    sweepLegacyTokens();
  },
  clearTokens,
  getToken,
  getRefreshToken,
  /* Mutex-guarded token refresh — all callers share a single in-flight promise
     so concurrent refresh attempts never race each other. */
  refreshToken: () => _resiClient.refresh(),
  registerLogoutCallback,

  /* Rider */
  getMe: (signal?: AbortSignal) => apiFetch("/riders/me?appRole=rider", signal ? { signal } : {}),
  setOnline: (isOnline: boolean): Promise<{ isOnline: boolean; serviceZoneWarning?: string }> =>
    apiFetch("/riders/status", { method: "PATCH", body: JSON.stringify({ online: isOnline }) }),
  updateProfile: (
    data: Record<string, unknown>
  ): Promise<{ success: boolean; pendingVerification?: boolean }> =>
    apiFetch("/riders/profile", { method: "PATCH", body: JSON.stringify(data) }),
  setDailyGoal: (dailyGoal: number): Promise<{ success: boolean }> =>
    apiFetch("/riders/goal", { method: "PATCH", body: JSON.stringify({ dailyGoal }) }),
  getRequests: (): Promise<RiderRequestsResponse> =>
    apiFetch("/riders/requests", {}, true).then(
      (env: ApiEnvelope<{ orders: Order[]; rides: Ride[] }> & { serverTime?: string }) => {
        const payload = env.data ?? { orders: [], rides: [] };
        return {
          orders: payload.orders ?? [],
          rides: payload.rides ?? [],
          _serverTime: env.serverTime ?? null,
        };
      }
    ),
  getActive: () => apiFetch("/riders/active"),
  acceptOrder: (id: string) =>
    apiFetch(`/riders/orders/${id}/accept`, { method: "POST", body: "{}" }),
  rejectOrder: (id: string, reason?: string) =>
    apiFetch(`/riders/orders/${id}/reject`, {
      method: "POST",
      body: JSON.stringify({ reason: reason || "not_interested" }),
    }),
  updateOrder: (id: string, status: string, proofPhotoUrl?: string) =>
    apiFetch(`/riders/orders/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status, ...(proofPhotoUrl ? { proofPhotoUrl } : {}) }),
    }),
  acceptRide: (id: string) =>
    apiFetch(`/riders/rides/${id}/accept`, { method: "POST", body: "{}" }),
  updateRide: (id: string, status: string, loc?: { lat: number; lng: number }, proofPhotoUrl?: string) =>
    apiFetch(`/riders/rides/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status, ...(loc || {}), ...(proofPhotoUrl ? { proofPhotoUrl } : {}) }),
    }),
  verifyRideOtp: (id: string, otp: string): Promise<{ success: boolean }> =>
    apiFetch(`/riders/rides/${id}/verify-otp`, { method: "POST", body: JSON.stringify({ otp }) }),
  counterRide: (id: string, data: { counterFare: number; note?: string }) =>
    apiFetch(`/riders/rides/${id}/counter`, { method: "POST", body: JSON.stringify(data) }),
  rejectOffer: (id: string) =>
    apiFetch(`/riders/rides/${id}/reject-offer`, { method: "POST", body: "{}" }),
  ignoreRide: (id: string) =>
    apiFetch(`/riders/rides/${id}/ignore`, { method: "POST", body: "{}" }),
  getCancelStats: () => apiFetch("/riders/cancel-stats"),
  getIgnoreStats: () => apiFetch("/riders/ignore-stats"),
  getPenaltyHistory: () => apiFetch("/riders/penalty-history"),
  getSupportMessages: (): Promise<{
    messages: Array<{
      id: string;
      userId: string;
      message: string;
      isFromSupport: boolean;
      createdAt: string;
    }>;
  }> => apiFetch("/support-chat/messages"),
  sendSupportMessage: (message: string): Promise<{
    message: {
      id: string;
      userId: string;
      message: string;
      isFromSupport: boolean;
      createdAt: string;
    };
  }> =>
    apiFetch("/support-chat/messages", {
      method: "POST",
      body: JSON.stringify({ message }),
    }),
  getHistory: (
    opts: {
      limit?: number;
      offset?: number;
      kind?: "all" | "order" | "ride" | "parcel";
      period?: "all" | "today" | "week" | "month";
    } = {}
  ): Promise<{
    history: Array<{
      id: string;
      kind: "order" | "ride";
      type: string;
      status: string;
      earnings: number;
      amount: number;
      address?: string;
      createdAt: string;
      proofPhoto?: string;
      origin?: string;
      destination?: string;
      fare?: number;
      distance?: string | number;
      duration?: number;
    }>;
    hasMore: boolean;
    total: number;
    limit: number;
    offset: number;
  }> => {
    const params = new URLSearchParams();
    if (opts.limit !== undefined) params.set("limit", String(opts.limit));
    if (opts.offset !== undefined) params.set("offset", String(opts.offset));
    if (opts.kind && opts.kind !== "all") params.set("kind", opts.kind);
    if (opts.period && opts.period !== "all") params.set("period", opts.period);
    const qs = params.toString();
    return apiFetch(`/riders/history${qs ? `?${qs}` : ""}`);
  },
  getEarningsSummary: (): Promise<{
    todayEarned: number;
    weekEarned: number;
    monthEarned: number;
    totalEarned: number;
    totalWithdrawn: number;
  }> => apiFetch("/riders/earnings/summary"),
  getEarnings: (): Promise<{
    today: {
      earnings: number;
      deliveries: number;
      breakdown?: {
        food: { earnings: number; count: number };
        parcel: { earnings: number; count: number };
        rides: { earnings: number; count: number };
      };
    };
    yesterday?: {
      earnings: number;
      deliveries: number;
    };
    week: {
      earnings: number;
      deliveries: number;
      breakdown?: {
        food: { earnings: number; count: number };
        parcel: { earnings: number; count: number };
        rides: { earnings: number; count: number };
      };
    };
    month: {
      earnings: number;
      deliveries: number;
      breakdown?: {
        food: { earnings: number; count: number };
        parcel: { earnings: number; count: number };
        rides: { earnings: number; count: number };
      };
    };
    dailyGoal: number | null;
  }> => apiFetch("/riders/earnings"),
  getMonthlyStatements: (months = 6): Promise<{
    months: Array<{
      year: number;
      month: number;
      label: string;
      grossEarnings: number;
      commission: number;
      netEarnings: number;
      deliveries: number;
    }>;
  }> => apiFetch(`/riders/earnings/monthly?months=${months}`),
  getMyReviews: () => apiFetch("/riders/reviews"),

  /* Location */
  updateLocation: (data: {
    latitude: number;
    longitude: number;
    accuracy?: number;
    speed?: number;
    heading?: number;
    batteryLevel?: number;
    mockProvider?: boolean;
    rideId?: string;
  }) => apiFetch("/riders/location", { method: "PATCH", body: JSON.stringify(data) }),
  batchLocation: (
    pings: Array<{
      timestamp: string;
      latitude: number;
      longitude: number;
      accuracy?: number;
      speed?: number;
      heading?: number;
      batteryLevel?: number;
      mockProvider?: boolean;
      action?: string | null;
    }>
  ) =>
    apiFetch("/riders/location/batch", {
      method: "POST",
      body: JSON.stringify({ locations: pings }),
    }),

  /* Wallet */
  /**
   * @deprecated Use {@link getWalletPage} instead. `getWallet` fetches all
   * transactions in one non-paginated response (`?legacy=1`) and will be
   * removed in a future release. Callers should migrate to the
   * cursor-paginated `getWalletPage` API.
   */
  getWallet: () => apiFetch("/riders/wallet/transactions?legacy=1"),
  /* getWalletPage — cursor-paginated. Returns `{ balance, items, nextCursor, limit }`.
     Pass `cursor` (opaque string from the previous response) to fetch the
     next page. Pass `limit` (1–200) to control page size; default 50. */
  getWalletPage: (
    opts: {
      cursor?: string | null;
      limit?: number;
      type?: string | null;
    } = {}
  ): Promise<{
    balance: number;
    items: Array<{
      id: string;
      type: string;
      amount: number;
      description?: string | null;
      reference?: string | null;
      createdAt: string;
      [k: string]: unknown;
    }>;
    nextCursor: string | null;
    limit: number;
  }> => {
    const params = new URLSearchParams();
    if (opts.limit != null) params.set("limit", String(opts.limit));
    if (opts.cursor != null) params.set("cursor", opts.cursor);
    if (opts.type != null) params.set("type", opts.type);
    const qs = params.toString();
    return apiFetch(`/riders/wallet/transactions${qs ? `?${qs}` : ""}`);
  },
  getMinBalance: () => apiFetch("/riders/wallet/min-balance"),
  withdrawWallet: (data: {
    amount: number;
    bankName: string;
    accountNumber: string;
    accountTitle: string;
    paymentMethod?: string;
    note?: string;
    instant?: boolean;
  }): Promise<{ transactionId?: string; [k: string]: unknown }> =>
    apiFetch("/riders/wallet/withdraw", { method: "POST", body: JSON.stringify(data) }),
  submitDeposit: (data: {
    amount: number;
    paymentMethod: string;
    transactionId: string;
    accountNumber?: string;
    note?: string;
  }) => apiFetch("/riders/wallet/deposit", { method: "POST", body: JSON.stringify(data) }),
  getDeposits: () => apiFetch("/riders/wallet/deposits"),

  /* COD Remittance */
  getPopularCities: (): Promise<{ cities: string[] }> => apiFetch("/maps/popular-cities"),
  getCodSummary: () => apiFetch("/riders/cod-summary"),
  submitCodRemittance: (data: {
    amount: number;
    paymentMethod: string;
    accountNumber: string;
    transactionId?: string;
    note?: string;
  }) => apiFetch("/riders/cod/remit", { method: "POST", body: JSON.stringify(data) }),

  /* Notifications */
  getNotifications: () => apiFetch("/riders/notifications"),
  markAllRead: () => apiFetch("/riders/notifications/read-all", { method: "PATCH", body: "{}" }),
  markOneRead: (id: string) =>
    apiFetch(`/riders/notifications/${id}/read`, { method: "PATCH", body: "{}" }),

  /* Settings */
  getSettings: () => apiFetch("/settings"),
  updateSettings: (data: Record<string, unknown>) =>
    apiFetch("/settings", { method: "PUT", body: JSON.stringify(data) }),

  /* AI Assistant */
  aiChat: (message: string, history?: Array<{ role: "user" | "assistant"; content: string }>) =>
    apiFetch("/riders/ai-chat", { method: "POST", body: JSON.stringify({ message, history }) }),

  /* Generic fetch — exposed on the api object so Chat (and other surfaces that
     migrated off their own apiFetch copy) can call api.apiFetch(...) and
     transparently get the auth refresh, timeout, and error-reporter integration.
     Closes C1/C3 by removing all parallel apiFetch implementations. */
  apiFetch,

  /* L-09: Missing endpoints that exist on the backend but had no client-side
     counterpart, causing callers to use raw apiFetch with raw strings. */
  deleteAccount: (reason?: string) =>
    apiFetch("/riders/account", {
      method: "DELETE",
      body: JSON.stringify({ reason: reason ?? "" }),
    }),
  submitFeedback: (data: { category: string; message: string; rating?: number }) =>
    apiFetch("/riders/feedback", { method: "POST", body: JSON.stringify(data) }),
  getVehicleTypes: (): Promise<{ types: Array<{ key: string; label: string; icon?: string }> }> =>
    apiFetch("/riders/vehicle-types"),

  /* Progressive Verification */
  sendPhoneVerifyOtp: (): Promise<{ message: string; devOtp?: string; alreadyVerified?: boolean }> =>
    apiFetch("/verify/phone/send", { method: "POST", body: "{}" }),
  confirmPhoneVerifyOtp: (otp: string): Promise<{ verified: boolean; alreadyVerified?: boolean; message: string }> =>
    apiFetch("/verify/phone/confirm", { method: "POST", body: JSON.stringify({ otp }) }),
  sendEmailVerifyOtp: (): Promise<{ message: string; alreadyVerified?: boolean }> =>
    apiFetch("/verify/email/send", { method: "POST", body: "{}" }),
  confirmEmailVerifyOtp: (otp: string): Promise<{ verified: boolean; alreadyVerified?: boolean; message: string }> =>
    apiFetch("/verify/email/confirm", { method: "POST", body: JSON.stringify({ otp }) }),
  uploadVerifyDocuments: (formData: FormData): Promise<{ submitted: boolean; message: string; alreadyApproved?: boolean }> =>
    apiFetch("/verify/documents", { method: "POST", body: formData }),
  getVerificationStatus: (): Promise<{
    phoneVerified: boolean;
    emailVerified: boolean;
    documentsSubmitted: boolean;
    documentsApproved: boolean;
    kycStatus: string;
    verificationBonusClaimed?: boolean;
    kycRejectedDocs?: string[] | null;
    kycRejectionReason?: string | null;
    updatedAt?: string | null;
  }> => apiFetch("/users/verification-status"),
  getAvailableFeatures: (): Promise<{
    features: Array<{
      featureName: string;
      accessible: boolean;
      requiredVerifications: string[];
      missingVerifications: string[];
      fallbackMsg: string | null;
      maxDailyLimit: number;
    }>;
  }> => apiFetch("/users/available-features"),
  getNeedsIdCard: (): Promise<{ needsIdCard: boolean }> => apiFetch("/users/needs-id-card"),
  setIdCard: (idCardNumber: string): Promise<{ set: boolean }> =>
    apiFetch("/users/set-id-card", { method: "POST", body: JSON.stringify({ idCardNumber }) }),
};
