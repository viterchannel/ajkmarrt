import { openStoreUrl, useVersionCheck } from "@/hooks/useVersionCheck";
import { createLogger } from "@/lib/logger";
import { RIDER_TOKENS } from "@/lib/useThemeTokens";
import { Capacitor } from "@capacitor/core";
import { QueryClientProvider, useQuery, useQueryClient } from "@tanstack/react-query";
import { tDual, type TranslationKey } from "@workspace/i18n";
import { isValidCnic } from "@workspace/phone-utils";
import { XCircle } from "lucide-react";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Route, Switch, useLocation, Router as WouterRouter } from "wouter";
import { AnnouncementBar } from "./components/AnnouncementBar";
import { BottomNav } from "./components/BottomNav";
import { VerificationGateModal } from "./components/VerificationGateModal";
import { ApprovalGateOverlay } from "./components/ApprovalGateOverlay";
import { ModuleDisabledScreen, SessionExpiredScreen } from "./components/ErrorScreens";
import { VerificationGateProvider, useVerificationGate } from "./lib/VerificationGateContext";
import { useGlobal403Handler } from "./lib/useGlobal403Handler";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { MaintenanceScreen } from "./components/MaintenanceScreen";
import { PopupEngine } from "./components/PopupEngine";
import { PwaInstallBanner } from "./components/PwaInstallBanner";
import { PushPermissionBanner } from "./components/PushPermissionBanner";
import { Toaster } from "./components/ui/toaster";
import { NetworkStatusBanner } from "./components/NetworkStatusBanner";
import { PageShimmer } from "./components/ui/shimmer";
import { ThemeConfigProvider } from "./components/ThemeConfigProvider";
import { RiderAuthConfigProvider } from "./lib/AuthConfigContext";
import { initAnalytics, trackEvent, identifyUser, resetUser, trackPageView } from "./lib/analytics";
import { api, apiFetch, getApiBase, setApiTimeoutMs } from "./lib/api";
import { ThemeProvider } from "./lib/auth/ThemeContext";
import { riderTheme } from "./lib/auth/theme";
import { riderEnv } from "./lib/envValidation";
import { initErrorReporter } from "./lib/error-reporter";
import { initAudioContextRevival } from "./lib/notificationSound";
import { setGeofencePolygon, setMaxSpeedKmh } from "./lib/gps/validation";
import {
  registerDrainHandler,
  setDismissedRequestTtlSec,
  setGpsQueueMax,
  type QueuedPing,
} from "./lib/gpsQueue";
import {
  PermanentQueueError,
  clearDeadLetterEntry,
  getDeadLetterQueue,
  registerActionExecutor,
  subscribeAnyActionSuccess,
  syncQueue,
  type ExecutorResult,
  type QueuedAction,
} from "./lib/offline/queueManager";
import { toast } from "@/hooks/use-toast";
import { consumePendingNotificationTap, registerPush } from "./lib/push";
import { RiderAuthProvider, useAuth, type AuthUser } from "./lib/rider-auth";
import { AppLockProvider } from "./lib/AppLockProvider";
import { runAttestation } from "./lib/attestation";
import { initSentry, setSentryUser, clearSentryUser } from "./lib/sentry";
import { initCrashlytics, setCrashlyticsUser, clearCrashlyticsUser } from "./lib/crashlytics";
import { initPerformanceMonitoring } from "./lib/performance";
import { SocketProvider, useSocket } from "./lib/socket";
import { parseKycStatusChangedPayload, parseRiderApprovalUpdatePayload, parseRiderLocationAckPayload } from "./lib/socketEvents";
import { getRiderModules, usePlatformConfig } from "./lib/useConfig";
import { useBrandTheme } from "./lib/useBrandTheme";
import { useTheme } from "./lib/useTheme";
import { LanguageProvider, useLanguage } from "./lib/useLanguage";
import { FontSizeProvider } from "./lib/FontSizeContext";
import { queryClient } from "@/lib/queryClient";
const log = createLogger("[App]");

/* PF4 / R3: All pages are lazy-loaded so the initial bundle only downloads
   the app shell, providers, and routing logic. Each page (and its transitive
   imports, including Leaflet for Active/Home) is fetched on-demand the first
   time the user navigates to that route. Suspense fallbacks are already in
   place at all three render paths (unauthenticated, VanDriver, authenticated). */
const Active = lazy(() => import("./pages/Active"));
const Home = lazy(() => import("./pages/Home"));
const Login = lazy(() => import("./pages/Login"));
const Profile = lazy(() => import("./pages/Profile"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ForgotUsername = lazy(() => import("./pages/ForgotUsername"));
const GuestLanding = lazy(() => import("./pages/GuestLanding"));
const Register = lazy(() => import("./pages/Register"));
const JoinSelect = lazy(() => import("./pages/JoinSelect"));
const NotFound = lazy(() => import("./pages/not-found"));
const History = lazy(() => import("./pages/History"));
const Earnings = lazy(() => import("./pages/Earnings"));
const Wallet = lazy(() => import("./pages/Wallet"));
const Notifications = lazy(() => import("./pages/Notifications"));
const SecuritySettings = lazy(() => import("./pages/SecuritySettings"));
const LoginHistory = lazy(() => import("./pages/LoginHistory"));
const GuestDashboard = lazy(() => import("./pages/GuestDashboard"));
const VanDriver = lazy(() => import("./pages/VanDriver"));
const Chat = lazy(() => import("./pages/Chat"));
const Reviews = lazy(() => import("./pages/Reviews"));
const PenaltyHistory = lazy(() => import("./pages/PenaltyHistory"));
const EarningsSummary = lazy(() => import("./pages/EarningsSummary"));
const Help = lazy(() => import("./pages/Help"));
const Settings = lazy(() => import("./pages/Settings"));

/* PWA5: Capacitor-aware base resolution. `BASE_URL` may be `./` or a
   `capacitor://` URL on native; resolving against `window.location.origin`
   normalises it to a usable pathname for wouter regardless of platform. */
/**
 * RedirectTo — lightweight client-side redirect for legacy / alias routes.
 * Replaces the current history entry so the back button skips the alias.
 * Uses wouter's useLocation (already imported at the top of this file).
 */
function RedirectTo({ to }: { to: string }) {
  const [, navigate] = useLocation();
  const { user, loading } = useAuth();
  
  useEffect(() => {
    /* Wait until auth context has settled (loading complete) before redirecting */
    if (!loading) {
      navigate(to, { replace: true });
    }
  }, [to, navigate, loading]);
  
  /* Show nothing while auth is loading to prevent flickering */
  if (loading) return null;
  
  return null;
}

/**
 * ModuleDisabled — shown when a rider navigates directly to a route whose
 * platform module has been disabled (e.g. /wallet when modules.wallet = false).
 * Uses the reusable ErrorScreen component for consistent styling and theme compliance.
 */
function ModuleDisabled() {
  const { language } = useLanguage();
  const T = (key: TranslationKey) => tDual(key, language);
  return <ModuleDisabledScreen T={T} />;
}

function getRouterBase(): string {
  try {
    const raw = riderEnv.baseUrl || "/";
    const u = new URL(raw, window.location.origin);
    return u.pathname.replace(/\/$/, "");
  } catch {
    return "";
  }
}

/* U5: Splash deadline — if `getMe` hangs longer than this, the splash screen
   surfaces a retry CTA so the user is never stuck on the spinner forever. */
const SPLASH_DEADLINE_MS = 15_000;

/* P4: Track once-per-tab whether we've already requested notification
   permission so we don't re-prompt on every `user` change. The browser will
   silently no-op after a "denied" decision, but the call still emits a console
   warning that the error reporter would otherwise capture (PF1).
   We persist this flag in sessionStorage (rather than a module-level let) so
   that HMR reloads in dev and React StrictMode double-invocations don't
   accidentally re-prompt within the same browser tab session. */
const NOTIF_ASKED_KEY = "_ajkm_notifPermissionAsked";


/* Maps API 401 reason codes to i18n TranslationKeys for SessionExpiredOverlay. */
const SESSION_EXPIRY_KEY_MAP: Record<
  string,
  { titleKey: TranslationKey; detailKey: TranslationKey }
> = {
  token_expired: { titleKey: "sessionExpiredTitle", detailKey: "sessionExpiredDetail" },
  session_expired: { titleKey: "sessionExpiredTitle", detailKey: "sessionExpiredDetail" },
  admin_revoked: { titleKey: "sessionRevokedByAdmin", detailKey: "sessionRevokedByAdminDetail" },
  admin_revocation: { titleKey: "sessionRevokedByAdmin", detailKey: "sessionRevokedByAdminDetail" },
  device_change: { titleKey: "sessionNewDevice", detailKey: "sessionNewDeviceDetail" },
  new_device: { titleKey: "sessionNewDevice", detailKey: "sessionNewDeviceDetail" },
  token_revoked: { titleKey: "sessionRevoked", detailKey: "sessionRevokedDetail" },
};

function SessionExpiredOverlay({
  onDismiss,
  reason,
}: {
  onDismiss: () => void;
  reason: string | null;
}) {
  const { language } = useLanguage();
  const T = (key: TranslationKey) => tDual(key, language);
  const keys =
    (reason != null && reason !== "" ? SESSION_EXPIRY_KEY_MAP[reason] : undefined) ??
    SESSION_EXPIRY_KEY_MAP["session_expired"];
  const msg = { title: T(keys!.titleKey), detail: T(keys!.detailKey) };
  return (
    <SessionExpiredScreen
      onDismiss={onDismiss}
      title={msg.title}
      detail={msg.detail}
    />
  );
}

/* ── KYC Banner ─────────────────────────────────────────────────────────
   Reusable banner displayed when an admin approves or rejects the rider's
   KYC. Extracted to avoid duplicating the JSX in the VanDriver and the
   standard authenticated route trees. ── */
function KycBanner({
  kycBanner,
  onDismiss,
}: {
  kycBanner: { status: "approved" | "rejected"; reason: string | null };
  onDismiss: () => void;
}) {
  const { language } = useLanguage();
  const T = (key: TranslationKey) => tDual(key, language);
  return (
    <button
      onClick={onDismiss}
      aria-label={kycBanner.status === "approved" ? T("kycApproved") : T("kycRejected")}
      className={`w-full rounded-2xl px-4 py-3 text-left text-sm font-semibold text-foreground shadow-xl ${kycBanner.status === "approved" ? "bg-success/90" : "bg-error/90"}`}
    >
      <div className="font-bold">
        {kycBanner.status === "approved" ? T("kycApproved") : T("kycRejected")}
      </div>
      {kycBanner.reason && (
        <div className="mt-0.5 truncate text-xs opacity-90">{kycBanner.reason}</div>
      )}
      <div className="mt-0.5 text-xs opacity-75">{T("tapToViewProfile")}</div>
    </button>
  );
}

/* ── Magic link deep-link handler ─────────────────────────────────────
   Rider clicks the email link → lands on /auth/magic-link?token=<raw>
   We verify the token, store JWT credentials, fetch the real profile,
   and navigate to the home screen. Pending approval / banned states are
   surfaced as an inline error message so the rider is never stuck. ── */
function MagicLinkPage() {
  const { login } = useAuth();
  const [, navigate] = useLocation();
  const { language } = useLanguage();
  const T = (key: TranslationKey) => tDual(key, language);
  const [status, setStatus] = useState<"loading" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    if (!token) {
      setStatus("error");
      setErrorMsg(T("magicLinkInvalid"));
      return;
    }
    void (async () => {
      try {
        const res = (await api.magicLinkVerify({ token })) as Record<string, unknown>;
        const accessToken = (res.accessToken ?? res.token) as string;
        const refreshToken = (res.refreshToken ?? res.refresh_token) as string | undefined;
        api.storeTokens(accessToken, refreshToken);
        let profile: Record<string, unknown>;
        try {
          profile = (await api.getMe()) as Record<string, unknown>;
        } catch (err: unknown) {
          const e = err as Record<string, unknown>;
          const code = (e.code as string) || "";
          if (code === "APPROVAL_PENDING") {
            api.clearTokens();
            setStatus("error");
            setErrorMsg(T("approvalPendingMsg"));
            return;
          }
          if (code === "APPROVAL_REJECTED") {
            api.clearTokens();
            const rejReason = (e.rejectionReason as string) || "";
            setStatus("error");
            setErrorMsg(rejReason ? `${T("approvalRejectedMsg")} ${rejReason}` : T("approvalRejectedMsg"));
            return;
          }
          if (code === "ACCOUNT_BANNED") {
            api.clearTokens();
            setStatus("error");
            setErrorMsg(T("accountBannedMsg"));
            return;
          }
          setStatus("error");
          setErrorMsg(T("verifyAccountFailed"));
          return;
        }
        if (profile.approvalStatus === "pending" || profile.approvalStatus === "pending_review") {
          api.clearTokens();
          setStatus("error");
          setErrorMsg(T("approvalPendingMsg"));
          return;
        }
        if (profile.approvalStatus === "rejected") {
          api.clearTokens();
          const rejReason2 = (profile.rejectionReason as string) || "";
          setStatus("error");
          setErrorMsg(rejReason2 ? `${T("approvalRejectedMsg")} ${rejReason2}` : T("approvalRejectedMsg"));
          return;
        }
        api.clearTokens();
        login(accessToken, profile as unknown as AuthUser, refreshToken);
        navigate("/", { replace: true });
      } catch (e: unknown) {
        setStatus("error");
        setErrorMsg(
          e instanceof Error ? e.message : T("magicLinkVerifyFailed")
        );
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (status === "error") {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          gap: 16,
          padding: 24,
          background: "var(--color-surface)",
          color: "var(--color-foreground)",
          fontFamily: "Inter, sans-serif",
        }}
      >
        <div style={{ fontSize: 40 }}>🔗</div>
        <p style={{ margin: 0, textAlign: "center", color: "var(--color-error)", maxWidth: 320 }}>
          {errorMsg}
        </p>
        <button
          onClick={() => navigate("/login", { replace: true })}
          aria-label={T("goToLogin")}
          style={{
            marginTop: 8,
            padding: "10px 24px",
            borderRadius: 10,
            border: "none",
            background: "var(--color-brand)",
            color: "var(--color-surface)",
            fontWeight: 700,
            cursor: "pointer",
            fontSize: 14,
          }}
        >
          {T("goToLogin")}
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--color-surface)",
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          border: "4px solid var(--color-border-dark)",
          borderTopColor: "var(--color-brand)",
          borderRadius: "50%",
          animation: "spin 0.8s linear infinite",
        }}
      />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

/* ── ID Card Gate Modal ────────────────────────────────────────────────────
   Shown when a rider is authenticated but has not yet submitted their CNIC
   number. Blocks all navigation until the rider submits a valid CNIC.
   The modal cannot be dismissed — it is a hard prerequisite gate. ── */
function IdCardGateModal({
  onSubmitted,
}: {
  onSubmitted: () => void;
}) {
  const { language } = useLanguage();
  const T = (key: TranslationKey) => tDual(key, language);
  const [cnic, setCnic] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function fmtCnic(v: string) {
    const d = v.replace(/\D/g, "").slice(0, 13);
    if (d.length < 5) return d;
    if (d.length < 12) return `${d.slice(0, 5)}-${d.slice(5)}`;
    return `${d.slice(0, 5)}-${d.slice(5, 12)}-${d.slice(12, 13)}`;
  }

  const handleSubmit = async () => {
    if (!isValidCnic(cnic)) {
      setError(T("cnicFormatError"));
      return;
    }
    setSaving(true);
    setError("");
    try {
      await api.setIdCard(cnic);
      onSubmitted();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : T("cnicSaveFailed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(11,14,17,0.97)",
        backdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9998,
        padding: 16,
      }}
    >
      <div
        style={{
          background: "var(--color-card-dark)",
          border: "1px solid var(--color-border-dark)",
          borderRadius: 24,
          padding: "32px 24px",
          width: "100%",
          maxWidth: 360,
          boxShadow: "0 24px 64px rgba(0,0,0,0.8)",
        }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: "50%",
            background: RIDER_TOKENS.brandAlpha(0.12),
            border: `1px solid ${RIDER_TOKENS.brandAlpha(0.3)}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 20px",
          }}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--color-brand)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="5" width="20" height="14" rx="2" />
            <line x1="2" y1="10" x2="22" y2="10" />
          </svg>
        </div>
        <h2 style={{ color: "var(--color-foreground)", fontSize: 20, fontWeight: 700, textAlign: "center", margin: "0 0 8px" }}>
          {T("idVerificationRequired")}
        </h2>
        <p style={{ color: RIDER_TOKENS.textSecondary, fontSize: 13, lineHeight: 1.6, textAlign: "center", margin: "0 0 24px" }}>
          {T("cnicEnterToVerify")}
        </p>
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--color-muted-foreground)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>
            {T("cnicNumberLabel")}
          </label>
          <input
            type="text"
            inputMode="numeric"
            placeholder="XXXXX-XXXXXXX-X"
            maxLength={15}
            aria-label="CNIC Number input"
            value={cnic}
            onChange={(e) => { setCnic(fmtCnic(e.target.value)); setError(""); }}
            style={{
              width: "100%",
              height: 48,
              padding: "0 14px",
              borderRadius: 12,
              background: "var(--color-muted)",
              border: `1.5px solid ${error ? "var(--color-error)" : cnic && isValidCnic(cnic) ? "var(--color-brand)" : "var(--color-border)"}`,
              color: "var(--color-foreground)",
              fontSize: 16,
              fontWeight: 600,
              letterSpacing: "0.04em",
              outline: "none",
              boxSizing: "border-box",
            }}
          />
          {error && (
            <p style={{ color: "var(--color-error)", fontSize: 11, margin: "6px 0 0", fontWeight: 600 }}>
              {error}
            </p>
          )}
          {cnic && isValidCnic(cnic) && (
            <p style={{ color: "var(--color-brand)", fontSize: 11, margin: "6px 0 0", fontWeight: 600 }}>
              {T("validCnicFormat")}
            </p>
          )}
        </div>
        <button
          onClick={handleSubmit}
          disabled={saving || !cnic}
          style={{
            width: "100%",
            height: 48,
            borderRadius: 12,
            border: "none",
            background: "linear-gradient(135deg, var(--color-brand), var(--color-brand-hover))",
            color: "var(--color-surface)",
            fontSize: 15,
            fontWeight: 700,
            cursor: saving || !cnic ? "not-allowed" : "pointer",
            opacity: saving || !cnic ? 0.6 : 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
          }}
        >
          {saving ? (
            <>
              <div style={{ width: 16, height: 16, borderRadius: "50%", border: "2px solid rgba(0,0,0,0.3)", borderTopColor: "rgba(0,0,0,0.8)", animation: "spin 0.8s linear infinite" }} />
              {T("saving")}
            </>
          ) : (
            T("submitCnic")
          )}
        </button>
        <p style={{ color: "var(--color-muted-foreground)", fontSize: 11, textAlign: "center", marginTop: 12, lineHeight: 1.5 }}>
          {T("cnicEncryptedNote")}
        </p>
      </div>
    </div>
  );
}

export { VerificationGateModal } from "./components/VerificationGateModal";

/**
 * Shared push-notification routing helper. Accepts a navigate function so it
 * can be used from both the cold-start tap effect and the live FCM handler
 * without duplicating the routing table in two separate useEffect closures.
 */
function routeByNotifData(
  data: Record<string, string>,
  navigate: (path: string) => void
): void {
  const type = data.type ?? "";
  if (type === "wallet" || type === "wallet_credit" || type === "wallet_debit") {
    navigate("/wallet");
    return;
  }
  if (type === "ai_chat" || type === "ai_response") {
    navigate("/chat?tab=ai");
    return;
  }
  if (type === "chat" || type === "support" || type === "admin_message") {
    navigate("/chat");
    return;
  }
  if (type === "penalty") {
    navigate("/penalty-history");
    return;
  }
  if (type === "review") {
    navigate("/reviews");
    return;
  }
  if (type === "kyc_approved" || type === "kyc_rejected") {
    navigate("/profile");
    return;
  }
  if (type === "withdrawal" || type === "withdrawal_processed") {
    navigate("/earnings");
    return;
  }
  if (type === "offline_reminder") {
    navigate("/");
    return;
  }
  if (
    data.rideId ||
    data.orderId ||
    type === "ride_request" ||
    type === "new_ride" ||
    type === "order_request" ||
    type === "new_order"
  ) {
    navigate("/active");
  }
}

function AppRoutes() {
  const {
    user: _user,
    loading,
    storageError,
    apiUnreachable,
    cachedDashboard,
    retryConnection,
    logout,
    sessionExpired,
    sessionExpiredReason,
    clearSessionExpired,
    refreshUser,
  } = useAuth();

  /* Gap 3: When the network is unreachable but a cached dashboard snapshot
     exists, use it as the effective user so the authenticated routes render.
     This enables read-only mode instead of the full maintenance screen. */
  const user = (apiUnreachable && cachedDashboard) ? cachedDashboard : _user;
  const isOfflineCachedMode = apiUnreachable && !!cachedDashboard;
  const { config } = usePlatformConfig();
  useTheme();   /* Apply theme class (light/dark) to <html> — must run globally */
  useBrandTheme();
  const modules = getRiderModules(config);
  const { language } = useLanguage();
  const qc = useQueryClient();
  const T = (key: TranslationKey) => tDual(key, language);

  useEffect(() => {
    return registerDrainHandler(async (pings: QueuedPing[]) => {
      await api.batchLocation(pings.map(({ id, ...rest }) => rest));
    });
  }, []);

  useEffect(() => {
    registerActionExecutor(async (action: QueuedAction) => {
      /* Pass X-Idempotency-Key so the server can de-duplicate replayed offline
         actions. The action UUID is stable across retries and survives tab close
         via IndexedDB persistence. */
      const idemHdr = { "X-Idempotency-Key": action.id };

      /* run() wraps each API call to enforce the ExecutorResult contract:
         - apiFetch (and all API helpers built on it) throw { status } for every
           non-2xx HTTP response.  Catching that throw is how failures are detected.
         - HTTP 4xx (except 429): re-thrown as PermanentQueueError → dead-letter.
         - HTTP 429 / network / 5xx: re-thrown as-is → transient retry.
         - If fn() resolves without throwing, the HTTP response was necessarily 2xx;
           only then does run() return { ok: true } to confirm success to syncQueue. */
      async function run(fn: () => Promise<unknown>): Promise<ExecutorResult> {
        try {
          await fn();
        } catch (err: unknown) {
          const status = (err as { status?: number })?.status;
          if (typeof status === "number" && status >= 400 && status < 500 && status !== 429) {
            /* HTTP 4xx (not 429): permanent rejection. Move to dead-letter. */
            throw new PermanentQueueError(
              `Server rejected action '${action.type}' (HTTP ${status}) — will not retry`,
              status
            );
          }
          /* Transient (network error, 5xx, 429): re-throw so the queue bumps
             the retry counter and halts the drain until the next sync. */
          throw err;
        }
        /* fn() resolved without throwing → the underlying HTTP call returned 2xx.
           Return explicit confirmation so syncQueue only removes on verified success. */
        return { ok: true };
      }

      let result: ExecutorResult = { ok: true };

      switch (action.type) {
        case "accept_order":
          result = await run(() =>
            apiFetch(`/riders/orders/${action.entityId}/accept`, {
              method: "POST",
              body: "{}",
              headers: idemHdr,
            })
          );
          break;
        case "accept_ride":
          result = await run(() =>
            apiFetch(`/riders/rides/${action.entityId}/accept`, {
              method: "POST",
              body: "{}",
              headers: idemHdr,
            })
          );
          break;
        case "update_order": {
          const { status, proofPhoto } = action.payload as { status: string; proofPhoto?: string };
          /* proofPhoto may be either a server URL (online upload) or a base64 DataURL
             (queued offline); the backend accepts both forms. */
          result = await run(() =>
            apiFetch(`/riders/orders/${action.entityId}/status`, {
              method: "PATCH",
              body: JSON.stringify({ status, ...(proofPhoto ? { proofPhoto } : {}) }),
              headers: idemHdr,
            })
          );
          break;
        }
        case "update_ride": {
          const { status, lat, lng } = action.payload as {
            status: string;
            lat?: number;
            lng?: number;
          };
          const loc = lat !== undefined && lng !== undefined ? { lat, lng } : {};
          result = await run(() =>
            apiFetch(`/riders/rides/${action.entityId}/status`, {
              method: "PATCH",
              body: JSON.stringify({ status, ...loc }),
              headers: idemHdr,
            })
          );
          break;
        }
        case "complete_trip": {
          /* complete_trip is enqueued by VanDriver when a van trip completion
             fails offline. entityId = scheduleId, payload.date = trip date. */
          const { date } = action.payload as { date: string };
          result = await run(() =>
            apiFetch(`/van/driver/schedules/${action.entityId}/date/${date}/complete`, {
              method: "PATCH",
              body: "{}",
              headers: idemHdr,
            })
          );
          break;
        }
        case "board_passenger": {
          /* board_passenger is enqueued by VanDriver when a boarding PATCH
             fails offline. entityId = bookingId, payload.boardedAt = ISO timestamp. */
          const { boardedAt } = action.payload as { boardedAt: string };
          result = await run(() =>
            apiFetch(`/van/driver/bookings/${action.entityId}/board`, {
              method: "PATCH",
              body: JSON.stringify({ boarded: true, boardedAt }),
              headers: idemHdr,
            })
          );
          break;
        }

        case "withdraw": {
          /* withdraw is enqueued by WithdrawModal when the rider taps "Queue
             for later" while offline. entityId = riderId (used only for grouping).
             payload mirrors the withdrawWallet API body. On 4xx the action is
             moved to the dead-letter store (PermanentQueueError) so it doesn't
             block the queue forever. */
          const withdrawPayload = action.payload as {
            amount: number;
            bankName: string;
            accountNumber: string;
            accountTitle: string;
            paymentMethod?: string;
            note?: string;
            instant?: boolean;
          };
          result = await run(() =>
            api.withdrawWallet({
              ...withdrawPayload,
            })
          );
          break;
        }

        default:
          log.warn(
            { type: (action as { type: string }).type },
            "Unknown offline action type in sync queue — skipping"
          );
          break;
      }

      return result;
    });
    syncQueue().catch((err) => {
      log.warn("Offline queue sync failed on mount:", err);
    });

    /* PWA7: Sync the offline queue whenever the tab regains visibility
       (e.g. user switches back to the app tab) or when the device comes
       back online. This catches the gap where actions were queued while
       the tab was hidden/offline and the socket reconnect event may not
       have fired yet. */
    const onVisible = () => {
      if (!document.hidden && navigator.onLine) {
        syncQueue().catch((err) => log.warn({ err }, "syncQueue on visibility change failed"));
        refreshUser().catch((err) => log.warn({ err }, "refreshUser on visibility change failed"));
      }
    };
    const onOnline = () => {
      syncQueue().catch((err) => log.warn({ err }, "syncQueue on window online failed"));
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onOnline);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onOnline);
    };
  }, []);

  /* ── Dead-letter toast: surface permanently-failed offline actions to the rider ──
     After each syncQueue drain, poll IndexedDB for new dead-letter entries.
     Each entry that has not yet been dismissed gets a toast, then is cleared.
     For ride/order actions we also invalidate the active-ride query so the UI
     reverts any stale optimistic state to the server's authoritative view. */
  useEffect(() => {
    let mounted = true;
    async function checkDeadLetters() {
      try {
        const entries = await getDeadLetterQueue();
        if (!mounted || entries.length === 0) return;
        for (const entry of entries) {
          const type = entry.action.type;

          /* Action-specific messages give the rider a clear explanation of what
             happened rather than a generic "could not be completed" notice. */
          let message: string;
          if (type === "update_ride") {
            message =
              "A ride status update was rejected by the server — the current ride state has been refreshed.";
          } else if (type === "update_order") {
            message =
              "An order status update was rejected by the server — the current order state has been refreshed.";
          } else if (type === "accept_ride") {
            message =
              "This ride was cancelled or no longer available while you were offline.";
          } else if (type === "accept_order") {
            message =
              "This order was cancelled or no longer available while you were offline.";
          } else {
            const actionLabel = type.replace(/_/g, " ");
            message = `Action "${actionLabel}" could not be completed and has been cleared.`;
          }

          toast({ title: "Action failed", description: message, variant: "destructive" });

          /* Invalidate the active-ride query so Active.tsx re-fetches the real
             server state, reverting any stale optimistic UI. */
          if (
            type === "update_ride" ||
            type === "update_order" ||
            type === "accept_ride" ||
            type === "accept_order"
          ) {
            queryClient.invalidateQueries({ queryKey: ["rider-active"] }).catch((err) => { log.debug({ err }, "rider-active invalidate after dead-letter non-critical"); });
          }

          await clearDeadLetterEntry(entry.id).catch((err) => { log.debug({ err }, "clearDeadLetterEntry non-critical"); });
        }
      } catch {
        /* dead-letter read failures are non-critical */
      }
    }
    /* Check on mount and subscribe to every successful flush */
    checkDeadLetters();
    const unsub = subscribeAnyActionSuccess(() => checkDeadLetters());
    return () => {
      mounted = false;
      unsub();
    };
  }, []);

  /* ── Log successfully-synced offline actions to the server (fire-and-forget) ──
     After each action is flushed, POST a lightweight record to the server so
     it lands in the offline_actions DB table for ops visibility. */
  useEffect(() => {
    const unsub = subscribeAnyActionSuccess((action) => {
      apiFetch("/riders/offline-actions/log", {
        method: "POST",
        body: JSON.stringify({
          id: action.id,
          actionType: action.type,
          entityId: action.entityId,
          payload: action.payload ?? {},
          processedAt: new Date().toISOString(),
        }),
      }).catch((err) => log.warn({ err }, "Failed to log offline action to server"));
    });
    return unsub;
  }, []);

  /* ── Auto-retry when device comes back online during API-unreachable state ──
     When the startup getMe() failed with a network error, the rider sees the
     "Cannot connect to server" screen. If their internet recovers, we call
     retryConnection() automatically so they don't need to tap Retry manually.
     The listener is only registered while apiUnreachable is true and is
     cleaned up as soon as the state resolves (or the component unmounts). */
  useEffect(() => {
    if (!apiUnreachable) return;
    const handleOnline = () => {
      log.info("Device came back online — auto-retrying connection");
      retryConnection();
    };
    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("online", handleOnline);
    };
  }, [apiUnreachable, retryConnection]);

  useEffect(() => {
    initErrorReporter();
    return initAudioContextRevival();
  }, []);

  /* ── Device attestation (Play Integrity / App Attest) ────────────────────
     Run once on app mount when a user is authenticated. On native builds
     this sends a platform attestation token to /api/rider/attest so the
     server can issue a short-lived session-attestation claim.  On web the
     runAttestation() call is a no-op that resolves immediately. */
  useEffect(() => {
    if (!user) return;
    const base = getApiBase();
    void runAttestation(base).catch((err: unknown) => {
      log.warn("[App] attestation failed — non-critical:", err);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    return () => {
      queryClient.clear();
    };
  }, []);

  /* ── Apply network/retry settings from platform config on startup ── */
  useEffect(() => {
    const net = config?.network;
    if (!net) return;
    if (typeof net.apiTimeoutMs === "number") setApiTimeoutMs(net.apiTimeoutMs);
    if (typeof net.riderGpsQueueMax === "number") setGpsQueueMax(net.riderGpsQueueMax);
    if (typeof net.riderDismissedRequestTtlSec === "number")
      setDismissedRequestTtlSec(net.riderDismissedRequestTtlSec);
  }, [config]);

  /* ── Wire platform-config geofence + speed threshold into GPS validation ── */
  useEffect(() => {
    const poly = config?.geofence?.polygon;
    if (Array.isArray(poly) && poly.length >= 3) {
      setGeofencePolygon(poly);
    } else {
      setGeofencePolygon(null);
    }
    /* Reset to default (200 km/h) when platform config does not supply a value
       so stale thresholds from a previous config load don't carry over. */
    setMaxSpeedKmh(config?.security?.maxSpeedKmh ?? 200);
  }, [config?.geofence, config?.security?.maxSpeedKmh]);

  /* ── Sentry + Analytics + Crashlytics + Performance init ── */
  useEffect(() => {
    void initCrashlytics();
    initPerformanceMonitoring();
    const integ = config?.integrations;
    if (!integ) return;
    if (integ.sentry && integ.sentryDsn) {
      initSentry(
        integ.sentryDsn,
        integ.sentryEnvironment,
        integ.sentrySampleRate,
        integ.sentryTracesSampleRate
      );
    }
    const platform = integ.analyticsPlatform ?? "";
    const isGa4 = platform === "google" || platform === "ga4" || platform === "google_analytics";
    const trackingId =
      isGa4
        ? (integ.ga4MeasurementId || integ.analyticsTrackingId || "")
        : platform === "mixpanel"
          ? (integ.mixpanelToken || integ.analyticsTrackingId || "")
          : (integ.analyticsTrackingId || "");
    if (integ.analytics && trackingId) {
      initAnalytics(platform, trackingId, integ.analyticsDebug ?? false);
    }
  }, [config?.integrations]);

  /* ── User identity: associate rider ID with analytics + crash reports ── */
  const prevUserIdRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (user?.id) {
      identifyUser(String(user.id));
      void setCrashlyticsUser(String(user.id));
      /* Fire login event only on the null → authenticated transition */
      if (prevUserIdRef.current == null || prevUserIdRef.current === "") {
        trackEvent("login", { method: "otp" });
      }
    } else if (user === null) {
      resetUser();
      void clearCrashlyticsUser();
    }
    prevUserIdRef.current = user?.id ?? (user === null ? null : undefined);
  }, [user?.id, user]);

  /* ── Cold-start notification tap: consume any tap captured before auth loaded ──
     Handles two cases:
     (a) pushNotificationActionPerformed fired at module-load (killed-app tap)
         → drained from _pendingTapData via consumePendingNotificationTap.
     (b) getDeliveredNotifications reveals a notification the rider hasn't
         dismissed yet (backgrounded app case on some Android builds).
     Routes based on data.type so future push types (wallet, etc.) land
     on the correct screen rather than always going to /active. */
  useEffect(() => {
    if (!user) return;
    const pending = consumePendingNotificationTap();
    if (pending && Object.keys(pending).length > 0) {
      routeByNotifData(pending, navigate);
      return;
    }
    if (Capacitor.isNativePlatform()) {
      import("@capacitor/push-notifications")
        .then(({ PushNotifications }) => {
          PushNotifications.getDeliveredNotifications()
            .then(({ notifications }) => {
              const first = notifications[0];
              if (first?.data) routeByNotifData(first.data as Record<string, string>, navigate);
            })
            .catch((err) => {
              log.warn("getDeliveredNotifications failed:", err);
            });
        })
        .catch((err) => {
          log.warn("PushNotifications import failed:", err);
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  /* ── FCM foreground notification banner ── */
  const [fcmNotif, setFcmNotif] = useState<{ title: string; body: string } | null>(null);
  const fcmCleanupRef = useRef<{ remove: () => void } | null>(null);
  const fcmDismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intendedRouteRef = useRef<string | null>(null);
  const [location, navigate] = useLocation();

  /* Analytics: track SPA route changes as page_view events so client-side
     navigation appears in GA4 / Mixpanel (GA4's send_page_view only fires
     on the initial load; subsequent wouter navigations need explicit calls). */
  useEffect(() => {
    trackPageView(location);
  }, [location]);

  /* Deep-link guard: capture the current path when an unauthenticated user
     lands on a protected route (e.g. via a push-notification deep link).
     After the user logs in, we redirect them to the originally-intended path. */
  const PUBLIC_PATHS = ["/", "/login", "/register", "/join", "/forgot-password", "/forgot-username", "/auth/magic-link"];
  useEffect(() => {
    if (!loading && !user && !PUBLIC_PATHS.includes(location)) {
      intendedRouteRef.current = location;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user, location]);

  useEffect(() => {
    if (user && intendedRouteRef.current) {
      const dest = intendedRouteRef.current;
      intendedRouteRef.current = null;
      navigate(dest, { replace: true });
    }
  }, [user, navigate]);

  /* P4: Only request notification permission when it's still in the "default"
     state. After the user has explicitly granted or denied it, we never re-ask
     — modern browsers silently no-op anyway and the call would emit warnings
     that the global error reporter (PF1) would amplify. We also gate by a
     module-level flag so back-to-back logins/logouts in the same tab don't
     re-prompt on each `user` change.
     On native Capacitor builds registerPush() uses FCM directly and handles
     permission prompts itself — the Notification API guard is bypassed via the
     Capacitor.isNativePlatform() check inside push.ts. */
  useEffect(() => {
    if (!user) return undefined;
    const onForeground = (title: string, body: string) => {
      setFcmNotif({ title, body });
      if (fcmDismissTimer.current) clearTimeout(fcmDismissTimer.current);
      fcmDismissTimer.current = setTimeout(() => setFcmNotif(null), 5000);
    };
    /* When the rider taps a push notification (background / killed app), navigate
       to the appropriate screen based on the notification type. */
    const onNotificationTap = (data: Record<string, string>) =>
      routeByNotifData(data, navigate);
    if (Capacitor.isNativePlatform()) {
      registerPush(onForeground, onNotificationTap)
        .then((cleanup) => {
          if (cleanup) fcmCleanupRef.current = cleanup;
        })
        .catch((err) => {
          log.warn("Push registration failed (native):", err);
        });
      return () => {
        fcmCleanupRef.current?.remove();
        if (fcmDismissTimer.current) clearTimeout(fcmDismissTimer.current);
      };
    }
    if (typeof Notification === "undefined") return undefined;
    if (!Notification.requestPermission) return undefined;
    if (sessionStorage.getItem(NOTIF_ASKED_KEY)) return undefined;
    if (Notification.permission !== "default") {
      if (Notification.permission === "granted")
        registerPush().catch((err) => {
          log.warn("Push registration failed (already granted):", err);
        });
      return undefined;
    }
    sessionStorage.setItem(NOTIF_ASKED_KEY, "1");
    Notification.requestPermission()
      .then((perm) => {
        if (perm === "granted")
          registerPush().catch((err) => {
            log.warn("Push registration failed after permission grant:", err);
          });
      })
      .catch((err) => {
        log.warn("Notification.requestPermission() failed:", err);
      });
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  /* ── KYC status change socket listener ──────────────────────────────────────
     Listens for kyc_status_changed events pushed by the server when an admin
     approves or rejects a rider's KYC submission.  Shows a persistent in-app
     banner so the rider is notified immediately without needing to refresh.
     ── rider_location_ack socket listener ────────────────────────────────────
     Receives server confirmation of location updates. No UI side-effect needed;
     logged for debugging and server protocol compliance. */
  const [kycBanner, setKycBanner] = useState<{ status: "approved" | "rejected"; reason: string | null } | null>(null);
  const { socket: appSocket } = useSocket();
  useEffect(() => {
    if (!appSocket) return;
    const onKycStatusChanged = (raw: unknown) => {
      const payload = parseKycStatusChangedPayload(raw);
      if (!payload) return;
      if (payload.status !== "approved" && payload.status !== "rejected") return;
      /* Persistent banner — stays visible until the rider taps it or navigates away.
         No auto-dismiss timer: KYC decisions are important enough to require explicit
         rider acknowledgement before disappearing. */
      setKycBanner({ status: payload.status, reason: payload.reason ?? null });
      /* Fire a foreground browser notification so the rider is notified even if
         the app is in the background tab. Only fires if permission was already
         granted (the app requests permission in the push registration flow). */
      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        const title = payload.status === "approved" ? T("kycApproved") : T("kycRejected");
        const body =
          payload.reason
            ? `Status: ${payload.status}. ${payload.reason}`
            : `Your KYC has been ${payload.status}.`;
        try {
          new Notification(title, { body, tag: "kyc_status" });
        } catch (err) {
          log.warn({ err }, "[App] Failed to show KYC Notification");
        }
      }
    };
    const onLocationAck = (raw: unknown) => {
      const payload = parseRiderLocationAckPayload(raw);
      log.debug({ orderId: payload?.order_id ?? null }, "[App] rider_location_ack received");
    };
    appSocket.on("kyc_status_changed", onKycStatusChanged);
    appSocket.on("rider_location_ack", onLocationAck);
    return () => {
      appSocket.off("kyc_status_changed", onKycStatusChanged);
      appSocket.off("rider_location_ack", onLocationAck);
    };
  }, [appSocket]);

  /* ── rider:approval_update socket listener ────────────────────────────────
     Handles approval decisions pushed to a rider who is in the rejected state
     (the pending state is handled by ApprovalGateOverlay's own listener).
     When the admin re-approves a rejected account, retryConnection() re-runs
     the auth flow so the rider enters the main app without a manual refresh. */
  useEffect(() => {
    if (!appSocket) return;
    if (user?.approvalStatus !== "rejected") return;
    const onApprovalUpdate = (raw: unknown) => {
      const payload = parseRiderApprovalUpdatePayload(raw);
      if (!payload) return;
      if (payload.status === "approved" || payload.status === "rejected") {
        setTimeout(() => retryConnection(), 1200);
      }
    };
    appSocket.on("rider:approval_update", onApprovalUpdate);
    return () => {
      appSocket.off("rider:approval_update", onApprovalUpdate);
    };
  }, [appSocket, user?.approvalStatus, retryConnection]);

  /* ── rider:profile_updated — phone/email verification synced from admin ──
     Emitted by the server after an admin manually verifies a rider's phone or
     email. Calling refreshUser() fetches fresh /me data so the rider sees the
     updated phoneVerified / emailVerified flags without a manual app restart. */
  useEffect(() => {
    if (!appSocket || !user) return;
    const onProfileUpdated = () => {
      refreshUser().catch((err) => log.warn({ err }, "[App] refreshUser on profile_updated failed"));
    };
    appSocket.on("rider:profile_updated", onProfileUpdated);
    return () => {
      appSocket.off("rider:profile_updated", onProfileUpdated);
    };
  }, [appSocket, user, refreshUser]);

  /* ── rider:account_status — block/unblock synced from admin ─────────────
     Emitted by the server after an admin restricts or unrestricts a rider.
     Refreshing user data causes the isRestricted guard in AppRoutes to
     redirect the rider to the Suspended screen (or back to the app) immediately
     without waiting for the next natural /me poll. */
  useEffect(() => {
    if (!appSocket || !user) return;
    const onAccountStatus = () => {
      refreshUser().catch((err) => log.warn({ err }, "[App] refreshUser on account_status failed"));
    };
    appSocket.on("rider:account_status", onAccountStatus);
    return () => {
      appSocket.off("rider:account_status", onAccountStatus);
    };
  }, [appSocket, user, refreshUser]);

  /* Show a subtle toast whenever refreshUser fails persistently */
  const [needsIdCard, setNeedsIdCard] = useState(false);
  const [idCardGateChecked, setIdCardGateChecked] = useState(false);

  useEffect(() => {
    if (!user || idCardGateChecked) return;
    if (user.approvalStatus === "pending" || user.approvalStatus === "rejected" || user.isRestricted) return;
    api.getNeedsIdCard()
      .then(({ needsIdCard: n }) => {
        setNeedsIdCard(n);
        setIdCardGateChecked(true);
      })
      .catch(() => {
        setIdCardGateChecked(true);
      });
  }, [user, idCardGateChecked]);

  const [refreshFailToast, setRefreshFailToast] = useState(false);
  const refreshFailTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const handler = () => {
      setRefreshFailToast(true);
      if (refreshFailTimer.current) clearTimeout(refreshFailTimer.current);
      refreshFailTimer.current = setTimeout(() => setRefreshFailToast(false), 4000);
    };
    window.addEventListener("ajkmart:refresh-user-failed", handler);
    return () => {
      window.removeEventListener("ajkmart:refresh-user-failed", handler);
      if (refreshFailTimer.current) clearTimeout(refreshFailTimer.current);
    };
  }, []);

  /* PWA6: Global offline event surfaces a hint to the user immediately rather
     than waiting for the per-request 30s timeout to fire. Offline-aware pages
     (Active.tsx) maintain their own AbortControllers; this listener is purely
     for user feedback and does not abort cross-page requests (which would
     cause double-fire bugs in a single-page-app context). */
  const [offlineHint, setOfflineHint] = useState(false);
  useEffect(() => {
    const onOffline = () => setOfflineHint(true);
    const onOnline = () => setOfflineHint(false);
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    setOfflineHint(typeof navigator !== "undefined" && navigator.onLine === false);
    return () => {
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
    };
  }, []);

  /* U5: Splash deadline — if loading remains true past SPLASH_DEADLINE_MS,
     show a retry button. We don't unblock automatically because `loading=true`
     might mean a legitimately slow `getMe`; we just give the user an escape. */
  const [splashTimedOut, setSplashTimedOut] = useState(false);
  useEffect(() => {
    if (!loading) {
      setSplashTimedOut(false);
      return;
    }
    const id = setTimeout(() => setSplashTimedOut(true), SPLASH_DEADLINE_MS);
    return () => clearTimeout(id);
  }, [loading]);

  if (storageError)
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "var(--color-surface)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}
      >
        <div
          style={{
            background: "var(--color-card-dark)",
            border: "1px solid var(--color-border-dark)",
            borderRadius: 20,
            padding: "32px 24px",
            maxWidth: 360,
            width: "100%",
            textAlign: "center",
            boxShadow: "0 24px 64px rgba(0,0,0,0.6)",
          }}
        >
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 16,
              background: "rgba(244, 67, 54, 0.12)",
              border: "1px solid rgba(244, 67, 54, 0.3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 20px",
            }}
          >
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#ef4444"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <h2 style={{ color: "var(--color-foreground)", fontSize: 20, fontWeight: 700, margin: "0 0 8px" }}>
            {T("secureStorageUnavailable")}
          </h2>
          <p style={{ color: RIDER_TOKENS.textSecondary, fontSize: 14, lineHeight: 1.6, margin: "0 0 24px" }}>
            {T("loginCredentialsCannot")}
          </p>
          <button
            onClick={() => window.location.reload()}
            aria-label={T("retry")}
            style={{
              width: "100%",
              height: 46,
              borderRadius: 12,
              border: "none",
              background: "linear-gradient(135deg, var(--color-brand), var(--color-brand-hover))",
              color: "var(--color-surface)",
              fontSize: 15,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {T("retry")}
          </button>
        </div>
      </div>
    );

  if (loading)
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "var(--color-surface)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ textAlign: "center", padding: "0 24px" }}>
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: 22,
              background: "linear-gradient(135deg, var(--color-brand), var(--color-brand-hover))",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 20px",
              boxShadow: `0 8px 28px ${RIDER_TOKENS.brandAlpha(0.35)}`,
            }}
          >
            <svg
              width="36"
              height="36"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--color-surface)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="5.5" cy="17.5" r="3.5" />
              <circle cx="18.5" cy="17.5" r="3.5" />
              <path d="M15 6H12L9 17.5" />
              <path d="M12 6l4 4-4 4" />
              <path d="M5.5 17.5L9 10l3 3" />
              <path d="M18.5 17.5L16 10h-3" />
            </svg>
          </div>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              border: "3px solid var(--color-border-dark)",
              borderTopColor: "var(--color-brand)",
              animation: "spin 0.8s linear infinite",
              margin: "0 auto",
            }}
          />
          <p style={{ color: "var(--color-foreground)", marginTop: 16, fontWeight: 600, fontSize: 15 }}>
            {T("loadingRiderPortal")}
          </p>
          {splashTimedOut && (
            <div
              style={{
                marginTop: 20,
                background: "var(--color-muted)",
                borderRadius: 16,
                padding: 16,
                maxWidth: 280,
                margin: "20px auto 0",
                border: "1px solid var(--color-border-dark)",
              }}
            >
              <p style={{ color: RIDER_TOKENS.textSecondary, fontSize: 13, marginBottom: 12 }}>
                {T("couldntReachServer")}
              </p>
              <button
                onClick={() => window.location.reload()}
                style={{
                  width: "100%",
                  height: 40,
                  borderRadius: 10,
                  border: "none",
                  background: "var(--color-brand)",
                  color: "var(--color-surface)",
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                {T("retry")}
              </button>
            </div>
          )}
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );

  if (apiUnreachable && !isOfflineCachedMode)
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "var(--color-surface)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}
      >
        <div
          style={{
            background: "var(--color-card-dark)",
            border: "1px solid var(--color-border-dark)",
            borderRadius: 20,
            padding: "32px 24px",
            maxWidth: 360,
            width: "100%",
            textAlign: "center",
            boxShadow: "0 24px 64px rgba(0,0,0,0.6)",
          }}
        >
          {/* Brand label */}
          <p
            style={{
              margin: "0 0 20px",
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.2em",
              color: "var(--color-border)",
              textTransform: "uppercase",
            }}
          >
            AJKMart Rider
          </p>

          {/* Icon ring */}
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 18,
              background: "rgba(240,185,11,0.10)",
              border: "1px solid rgba(240,185,11,0.25)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 20px",
            }}
          >
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--color-brand)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="1" y1="1" x2="23" y2="23" />
              <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
              <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
              <path d="M10.71 5.05A16 16 0 0 1 22.56 9" />
              <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
              <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
              <line x1="12" y1="20" x2="12.01" y2="20" />
            </svg>
          </div>

          {/* Title */}
          <h1
            style={{
              margin: "0 0 8px",
              fontSize: 18,
              fontWeight: 700,
              color: "rgba(232,233,239,0.9)",
              letterSpacing: "-0.01em",
            }}
          >
            {T("cannotConnectServer")}
          </h1>

          {/* Description */}
          <p
            style={{
              margin: "0 0 24px",
              fontSize: 14,
              lineHeight: 1.6,
              color: RIDER_TOKENS.textSecondary,
            }}
          >
            {T("checkConnectionRetry")}
          </p>

          {/* Retry button */}
          <button
            onClick={retryConnection}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "100%",
              height: 48,
              borderRadius: 12,
              border: "none",
              background: "linear-gradient(135deg, var(--color-brand), var(--color-brand-hover))",
              color: "var(--color-surface)",
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
              marginBottom: 10,
            }}
          >
            {T("retry")}
          </button>

          {/* Secondary: hard reload */}
          <button
            onClick={() => window.location.reload()}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "100%",
              height: 48,
              borderRadius: 12,
              border: "1px solid var(--color-border)",
              background: "var(--color-muted)",
              color: "var(--color-muted-foreground)",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {T("reloadApp")}
          </button>
        </div>
      </div>
    );

  if (!user)
    return (
      <>
        {sessionExpired && (
          <SessionExpiredOverlay
            reason={sessionExpiredReason}
            onDismiss={() => {
              /* Capture the current path before navigating to /login so that
                 after the rider re-authenticates, App.tsx's intendedRouteRef
                 effect redirects them back to where they were.              */
              if (!PUBLIC_PATHS.includes(location)) {
                intendedRouteRef.current = location;
              }
              clearSessionExpired();
              navigate("/login");
            }}
          />
        )}
        {!sessionExpired && (
          <Suspense fallback={<PageShimmer />}>
            <Switch>
              <Route path="/" component={GuestLanding} />
              <Route path="/guest-dashboard">{() => <GuestDashboard />}</Route>
              <Route path="/join">{() => <JoinSelect />}</Route>
              <Route path="/auth/magic-link">{() => <ErrorBoundary><MagicLinkPage /></ErrorBoundary>}</Route>
              <Route path="/register">{() => <Register />}</Route>
              <Route path="/forgot-password" component={ForgotPassword} />
              <Route path="/forgot-username" component={ForgotUsername} />
              <Route path="/login">{() => <Login />}</Route>
              <Route>
                <GuestLanding />
              </Route>
            </Switch>
          </Suspense>
        )}
      </>
    );

  /* S-Sec10: When entering a non-active branch (pending / rejected /
     maintenance) clear cached query data so a brief route swap can't read
     the previous active session's `rider-active` cache. We do this in a
     module-scope effect so it runs once per branch entry. */
  const supportPhone = (config.content as { supportPhone?: string } | undefined)?.supportPhone;

  /* ── Approval status guard — shown after session rehydration if still pending/rejected ── */
  if (user.approvalStatus === "pending" || user.approvalStatus === "pending_review") return <ApprovalGateOverlay />;

  if (user.approvalStatus === "rejected") {
    qc.clear(); /* S-Sec10 */
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface p-6">
        <div className="w-full max-w-sm rounded-3xl bg-card p-8 text-center shadow-xl">
          <div className="mb-4 flex items-center justify-center text-5xl text-error">
            <XCircle size={48} />
          </div>
          <h2 className="mb-2 text-xl font-bold text-foreground">{T("accountRejected")}</h2>
          <p className="mb-2 text-sm leading-relaxed text-muted-foreground">
            {T("accountRejectedMsg")}
          </p>
          {user.rejectionReason && (
            <p className="mb-6 text-sm font-medium text-error">
              {T("reason")}: {user.rejectionReason}
            </p>
          )}
          {supportPhone && (
            <a
              href={`tel:${supportPhone}`}
              className="mb-2 block w-full rounded-2xl bg-success py-3 text-sm font-semibold text-white transition-colors hover:bg-success/90"
            >
              {T("contactSupport")}
            </a>
          )}
          <button
            onClick={() => {
              logout("/register");
            }}
            className="mb-2 w-full rounded-2xl bg-brand py-3 text-sm font-semibold text-surface transition-colors hover:bg-brand/90"
          >
            {T("reApply")}
          </button>
          <button
            onClick={() => logout()}
            className="w-full rounded-2xl bg-muted py-3 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted/80"
          >
            {T("signOutLabel")}
          </button>
        </div>
      </div>
    );
  }

  if (user.isRestricted) {
    qc.clear(); /* S-Sec10 */
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface p-6">
        <div className="w-full max-w-sm rounded-3xl bg-card p-8 text-center shadow-xl">
          <div className="mb-4 text-5xl">
            <span>🚫</span>
          </div>
          <h2 className="mb-2 text-xl font-bold text-foreground">{T("accountSuspended")}</h2>
          <p className="mb-6 text-sm leading-relaxed text-muted-foreground">
            {T("accountSuspendedMsg")}
          </p>
          {supportPhone && (
            <a
              href={`tel:${supportPhone}`}
              className="mb-2 block w-full rounded-2xl bg-success py-3 text-sm font-semibold text-white transition-colors hover:bg-success/90"
            >
              {T("contactSupport")}
            </a>
          )}
          <button
            onClick={() => logout()}
            className="w-full rounded-2xl bg-muted py-3 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted/80"
          >
            {T("signOutLabel")}
          </button>
        </div>
      </div>
    );
  }

  if (needsIdCard && idCardGateChecked)
    return (
      <IdCardGateModal
        onSubmitted={() => {
          setNeedsIdCard(false);
          refreshUser();
        }}
      />
    );

  if (config.platform.appStatus === "maintenance") {
    qc.clear(); /* S-Sec10 */
    return (
      <MaintenanceScreen
        message={config.content.maintenanceMsg}
        appName={config.platform.appName}
      />
    );
  }

  const isLimited = config.platform.appStatus === "limited";

  const userRoles: string[] = Array.isArray(user.roles) ? user.roles : [];
  const isVanDriver =
    userRoles.includes("van_driver") || user.vehicleType === "van" || user.vehicleType === "bus";

  if (isVanDriver) {
    return (
      <div className="relative mx-auto flex min-h-screen max-w-md flex-col">
        {isOfflineCachedMode && (
          <div className="pointer-events-none fixed inset-x-0 top-0 z-50 bg-warning px-4 py-2 text-center text-xs font-bold text-foreground shadow">
            No internet — showing last known data
          </div>
        )}
        {isLimited && !isOfflineCachedMode && (
          <div className="pointer-events-none fixed inset-x-0 top-0 z-50 bg-warning px-4 py-2 text-center text-xs font-bold text-foreground shadow">
            ⚠️ Limited service — some features may be temporarily unavailable
          </div>
        )}
        {refreshFailToast && (
          <div className="pointer-events-none fixed top-4 left-1/2 z-[9999] -translate-x-1/2 rounded-full bg-warning px-4 py-2 text-xs font-bold text-foreground shadow-lg">
            {/* U1: At minimum the dynamic data piece is i18n-aware via T("offline"); the
                static refresh-failure phrase is platform-config copy that follows
                the rest of admin-driven content (config.content), not the bundled
                i18n keys. We keep the English string here intentionally rather than
                add a new bundled key just for this one toast. */}
            Connection issue — profile sync failed
          </div>
        )}
        {offlineHint && (
          <div className="pointer-events-none fixed top-12 left-1/2 z-[9999] -translate-x-1/2 rounded-full bg-brand px-4 py-2 text-xs font-bold text-surface shadow-lg">
            {T("offline")}
          </div>
        )}
        <div className="fixed top-0 inset-x-0 z-[10000] flex flex-col gap-1 p-2 pointer-events-none">
          {kycBanner && (
            <div className="pointer-events-auto">
              <KycBanner
                kycBanner={kycBanner}
                onDismiss={() => { setKycBanner(null); navigate("/profile"); }}
              />
            </div>
          )}
          {fcmNotif && (
            <button
              onClick={() => setFcmNotif(null)}
              className="pointer-events-auto w-full rounded-2xl bg-success/90 px-4 py-3 text-left text-sm font-semibold text-foreground shadow-xl"
            >
              <div className="truncate font-bold">{fcmNotif.title}</div>
              <div className="truncate text-xs opacity-90">{fcmNotif.body}</div>
            </button>
          )}
        </div>
        <NetworkStatusBanner />
        <div className="flex-1">
          <Suspense fallback={<PageShimmer />}>
            <VanDriver />
          </Suspense>
        </div>
      </div>
    );
  }

  return (
    <VerificationGateProvider>
    <div className="relative mx-auto flex min-h-screen w-full flex-col bg-page-bg sm:max-w-[540px] sm:shadow-2xl sm:ring-1 sm:ring-border/20 md:max-w-[680px] lg:max-w-[780px]">
      {isOfflineCachedMode && (
        <div className="pointer-events-none fixed inset-x-0 top-0 z-50 bg-warning px-4 py-2 text-center text-xs font-bold text-foreground shadow">
          No internet — showing last known data
        </div>
      )}
      {isLimited && !isOfflineCachedMode && (
        <div className="pointer-events-none fixed inset-x-0 top-0 z-50 bg-warning px-4 py-2 text-center text-xs font-bold text-foreground shadow">
          ⚠️ Limited service — some features may be temporarily unavailable
        </div>
      )}
      {refreshFailToast && (
        <div className="pointer-events-none fixed top-4 left-1/2 z-[9999] -translate-x-1/2 rounded-full bg-warning px-4 py-2 text-xs font-bold text-foreground shadow-lg">
          Connection issue — profile sync failed
        </div>
      )}
      {offlineHint && (
        <div className="pointer-events-none fixed top-12 left-1/2 z-[9999] -translate-x-1/2 rounded-full bg-brand px-4 py-2 text-xs font-bold text-surface shadow-lg">
          {T("offline")}
        </div>
      )}
      <div className="fixed top-0 inset-x-0 z-[10000] flex flex-col gap-1 p-2 pointer-events-none">
        {kycBanner && (
          <div className="pointer-events-auto">
            <KycBanner
              kycBanner={kycBanner}
              onDismiss={() => { setKycBanner(null); navigate("/profile"); }}
            />
          </div>
        )}
        {fcmNotif && (
          <button
            onClick={() => setFcmNotif(null)}
            className="pointer-events-auto w-full rounded-2xl bg-success/90 px-4 py-3 text-left text-sm font-semibold text-foreground shadow-xl"
          >
            <div className="truncate font-bold">{fcmNotif.title}</div>
            <div className="truncate text-xs opacity-90">{fcmNotif.body}</div>
          </button>
        )}
      </div>
      <NetworkStatusBanner />
      <Global403Handler />
      <AppVerificationOverlay />

      {/* U2: Cap the announcement bar at a compact strip; long messages scroll
          internally rather than consuming a third of the viewport. */}
      <div className="sticky top-0 z-50 flex max-h-[80px] flex-col overflow-y-auto">
        <AnnouncementBar message={config.content.announcement} />
      </div>
      <PopupEngine />

      <div
        className="flex-1"
        style={{ paddingBottom: "calc(64px + max(8px, env(safe-area-inset-bottom, 8px)))" }}
      >
        <Suspense fallback={null}>
          <Switch>
            <Route path="/">
              {() => (
                <ErrorBoundary>
                  <Home />
                </ErrorBoundary>
              )}
            </Route>
            <Route path="/active">
              {() => (
                <ErrorBoundary>
                  <Active />
                </ErrorBoundary>
              )}
            </Route>
            <Route path="/history">
              {() =>
                modules.history ? (
                  <ErrorBoundary>
                    <History />
                  </ErrorBoundary>
                ) : (
                  <ModuleDisabled />
                )
              }
            </Route>
            <Route path="/earnings">
              {() =>
                modules.earnings ? (
                  <ErrorBoundary>
                    <Earnings />
                  </ErrorBoundary>
                ) : (
                  <ModuleDisabled />
                )
              }
            </Route>
            <Route path="/earnings/summary">
              {() =>
                modules.earnings ? (
                  <ErrorBoundary>
                    <EarningsSummary />
                  </ErrorBoundary>
                ) : (
                  <ModuleDisabled />
                )
              }
            </Route>
            <Route path="/wallet">
              {() =>
                modules.wallet ? (
                  <ErrorBoundary>
                    <Wallet />
                  </ErrorBoundary>
                ) : (
                  <ModuleDisabled />
                )
              }
            </Route>
            <Route path="/notifications">
              {() => (
                <ErrorBoundary>
                  <Notifications />
                </ErrorBoundary>
              )}
            </Route>
            <Route path="/profile">
              {() => (
                <ErrorBoundary>
                  <Profile />
                </ErrorBoundary>
              )}
            </Route>
            <Route path="/settings/security">
              {() => (
                <ErrorBoundary>
                  <SecuritySettings />
                </ErrorBoundary>
              )}
            </Route>
            <Route path="/settings/login-history">
              {() => (
                <ErrorBoundary>
                  <LoginHistory />
                </ErrorBoundary>
              )}
            </Route>
            {/* /security is a legacy alias — canonical path is /settings/security */}
            <Route path="/security">{() => <RedirectTo to="/settings/security" />}</Route>
            <Route path="/van">
              {() =>
                config.features.van !== false ? (
                  <ErrorBoundary>
                    <VanDriver />
                  </ErrorBoundary>
                ) : (
                  <ModuleDisabled />
                )
              }
            </Route>
            {/* /van-driver is a legacy alias — canonical path is /van */}
            <Route path="/van-driver">{() => <RedirectTo to="/van" />}</Route>
            <Route path="/chat">
              {() =>
                modules.supportChat ? (
                  <ErrorBoundary>
                    <Chat />
                  </ErrorBoundary>
                ) : (
                  <ModuleDisabled />
                )
              }
            </Route>
            <Route path="/chat/:id">
              {() =>
                modules.supportChat ? (
                  <ErrorBoundary>
                    <Chat />
                  </ErrorBoundary>
                ) : (
                  <ModuleDisabled />
                )
              }
            </Route>
            <Route path="/reviews">
              {() =>
                config.features.reviews !== false ? (
                  <ErrorBoundary>
                    <Reviews />
                  </ErrorBoundary>
                ) : (
                  <ModuleDisabled />
                )
              }
            </Route>
            <Route path="/penalty-history">
              {() => (
                <ErrorBoundary>
                  <PenaltyHistory />
                </ErrorBoundary>
              )}
            </Route>
            <Route path="/help">
              {() => (
                <ErrorBoundary>
                  <Help />
                </ErrorBoundary>
              )}
            </Route>
            <Route path="/settings">
              {() => (
                <ErrorBoundary>
                  <Settings />
                </ErrorBoundary>
              )}
            </Route>
            {/* /dashboard is a legacy alias — canonical root is / */}
            <Route path="/dashboard">{() => <RedirectTo to="/" />}</Route>
            <Route component={NotFound} />
          </Switch>
        </Suspense>
      </div>
      <BottomNav />
    </div>
    </VerificationGateProvider>
  );
}

/* Gap 1: Blocking screen shown when a major-version update is required.
   Uses fixed positioning so it covers the app regardless of mount location.
   On native Capacitor, the "Update App" button opens the platform store URL.
   On web, a banner with a direct link is shown instead. */
function ForceUpdateScreen({
  androidUrl,
  iosUrl,
}: {
  androidUrl: string | null;
  iosUrl: string | null;
}) {
  const { language } = useLanguage();
  const T = (key: TranslationKey) => tDual(key, language);
  const isNative = Capacitor.isNativePlatform();
  const platform = Capacitor.getPlatform();
  const storeUrl =
    platform === "ios"
      ? (iosUrl ?? androidUrl)
      : (androidUrl ?? iosUrl);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(11,14,17,0.98)",
        backdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 99999,
        padding: 24,
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      <div
        style={{
          background: "var(--color-card-dark, #1a1d23)",
          border: "1px solid var(--color-border)",
          borderRadius: 24,
          padding: "36px 28px",
          width: "100%",
          maxWidth: 360,
          textAlign: "center",
          boxShadow: "0 24px 64px rgba(0,0,0,0.8)",
        }}
      >
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: 20,
            background: "linear-gradient(135deg, var(--color-brand), var(--color-brand-hover))",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 24px",
            boxShadow: "0 8px 28px rgba(240,185,11,0.35)",
          }}
        >
          <svg
            width="36"
            height="36"
            viewBox="0 0 24 24"
            fill="none"
            stroke="rgba(11,14,17,0.9)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
          </svg>
        </div>
        <h2 style={{ color: "var(--color-foreground)", fontSize: 22, fontWeight: 800, margin: "0 0 10px" }}>
          {T("updateRequired")}
        </h2>
        <p style={{ color: RIDER_TOKENS.textSecondary, fontSize: 14, lineHeight: 1.6, margin: "0 0 28px" }}>
          {T("updateAvailableMsg")}
        </p>
        {storeUrl ? (
          isNative ? (
            <button
              onClick={() => openStoreUrl(storeUrl)}
              style={{
                width: "100%",
                height: 52,
                borderRadius: 14,
                border: "none",
                background: "linear-gradient(135deg, var(--color-brand), var(--color-brand-hover))",
                color: "rgba(11,14,17,0.95)",
                fontSize: 16,
                fontWeight: 800,
                cursor: "pointer",
                letterSpacing: "-0.01em",
              }}
            >
              {T("updateApp")}
            </button>
          ) : (
            <a
              href={storeUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "100%",
                height: 52,
                borderRadius: 14,
                background: "linear-gradient(135deg, var(--color-brand), var(--color-brand-hover))",
                color: "rgba(11,14,17,0.95)",
                fontSize: 16,
                fontWeight: 800,
                textDecoration: "none",
                letterSpacing: "-0.01em",
              }}
            >
              {T("downloadLatestVersion")}
            </a>
          )
        ) : (
          <p style={{ color: "var(--color-muted-foreground)", fontSize: 13 }}>
            {T("updateFromAppStore")}
          </p>
        )}
      </div>
    </div>
  );
}

function VersionCheckInit() {
  const forceUpdate = useVersionCheck();
  if (forceUpdate.required) {
    return (
      <ForceUpdateScreen
        androidUrl={forceUpdate.androidStoreUrl}
        iosUrl={forceUpdate.iosStoreUrl}
      />
    );
  }
  return null;
}

const SplashScreen = lazy(() => import("./pages/SplashScreen"));
const OnboardingScreen = lazy(() => import("./pages/Onboarding"));

function Global403Handler() {
  useGlobal403Handler();
  return null;
}

function AppVerificationOverlay() {
  const { language } = useLanguage();
  const T = (key: TranslationKey) => tDual(key, language);
  const { blockedVerifications, clearBlockedVerifications } = useVerificationGate();
  const [location, navigate] = useLocation();
  const { user } = useAuth();

  const { data: availableFeatures } = useQuery({
    queryKey: ["rider-available-features"],
    queryFn: () => api.getAvailableFeatures(),
    staleTime: 60_000,
    refetchInterval: 120_000,
    enabled: !!user?.id && blockedVerifications.length > 0,
  });

  useEffect(() => {
    if (!availableFeatures?.features?.length) return;
    const allAccessible = (
      availableFeatures.features as Array<{ accessible?: boolean }>
    ).every((f) => f.accessible !== false);
    if (allAccessible) clearBlockedVerifications();
  }, [availableFeatures, clearBlockedVerifications]);

  if (blockedVerifications.length === 0) return null;

  const onProfilePage = location === "/profile" || location.startsWith("/profile/");

  return (
    <>
      <div className="pointer-events-auto fixed inset-x-0 top-0 z-[9988] flex items-center justify-between gap-2 bg-amber-500 px-4 py-2 text-xs font-bold text-amber-950 shadow">
        <span>{T("verificationRequiredBanner")}</span>
        <button
          onClick={() => navigate("/profile")}
          className="shrink-0 rounded-full bg-amber-950/15 px-3 py-1 text-[11px] font-extrabold text-amber-950"
        >
          {T("completeVerification")}
        </button>
      </div>
      {!onProfilePage && (
        <VerificationGateModal
          missingVerifications={blockedVerifications}
          dismissible={false}
          onClose={() => navigate("/profile")}
        />
      )}
    </>
  );
}

function AppShell() {
  const [splashDone, setSplashDone] = useState(false);
  const [onboardingDone, setOnboardingDone] = useState(() => {
    try { return localStorage.getItem("rider_onboarding_done") === "1"; } catch { return false; }
  });

  if (!splashDone) {
    return (
      <Suspense fallback={null}>
        <SplashScreen onDone={() => setSplashDone(true)} />
      </Suspense>
    );
  }
  if (!onboardingDone) {
    return (
      <Suspense fallback={null}>
        <OnboardingScreen
          onDone={() => {
            try { localStorage.setItem("rider_onboarding_done", "1"); } catch { /* ignore */ }
            trackEvent("registration_funnel", { step: "onboarding_complete" });
            setOnboardingDone(true);
          }}
        />
      </Suspense>
    );
  }
  return <AppRoutes />;
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <VersionCheckInit />
        <LanguageProvider>
          <FontSizeProvider>
            <RiderAuthConfigProvider>
              <RiderAuthProvider>
                <ThemeProvider theme={riderTheme}>
                  <ThemeConfigProvider>
                    <AppLockProvider>
                      <SocketProvider>
                        <WouterRouter base={getRouterBase()}>
                          <AppShell />
                        </WouterRouter>
                        <Toaster />
                        <PwaInstallBanner />
                        <PushPermissionBanner />
                      </SocketProvider>
                    </AppLockProvider>
                  </ThemeConfigProvider>
                </ThemeProvider>
              </RiderAuthProvider>
            </RiderAuthConfigProvider>
          </FontSizeProvider>
        </LanguageProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
