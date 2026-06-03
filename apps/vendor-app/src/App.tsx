import { createLogger } from "@/lib/logger";
import { useVersionCheck } from "@/hooks/useVersionCheck";
import { QueryClientProvider } from "@tanstack/react-query";
const log = createLogger("[App]");
import {
  AlertTriangle,
  ArrowLeft,
  Ban,
  BellOff,
  ChartPie,
  CheckCircle2,
  Lock,
  Megaphone,
  Search,
  Wifi,
  X,
} from "lucide-react";
import React, { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Route, Switch, useLocation, Router as WouterRouter } from "wouter";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { Toaster } from "./components/ui/toaster";
import { ThemeProvider } from "./lib/auth/ThemeContext";
import { ThemeProvider as AjkThemeProvider } from "@workspace/theme";
import { GlobalThemeProvider } from "@workspace/theme";
import { vendorTheme } from "./lib/auth/theme";
import { markOrderSeen, playOrderSound, wasOrderSeenRecently } from "./lib/notificationSound";
import { consumePendingNotificationTap, registerPush, type PushErrorHandler } from "./lib/push";
import {
  connectVendorSocket,
  disconnectVendorSocket,
  onNewOrder,
  onOrderUpdate,
  type VendorNewOrderEvent,
} from "./lib/socket";
import { useCurrency, usePlatformConfig } from "./lib/useConfig";
import { useLanguage } from "./lib/useLanguage";
import { AuthProvider, useAuth } from "./lib/vendor-auth";
import { VendorVerificationGateProvider, useVendorVerificationGate } from "./lib/VendorVerificationGateContext";
import { VendorVerificationGateModal } from "./components/VendorVerificationGateModal";
import { saveFeatureRulesCache } from "./lib/featureGate";

import { Capacitor } from "@capacitor/core";
import { initAnalytics } from "./lib/analytics";
import { api, setApiTimeoutMs } from "./lib/api";
import { initErrorReporter } from "./lib/error-reporter";
import { initSentry } from "./lib/sentry";

import { AnnouncementBar } from "./components/AnnouncementBar";
import { NewOrderBanner } from "./components/NewOrderBanner";
import { BottomNav } from "./components/BottomNav";
import { MaintenanceScreen } from "./components/MaintenanceScreen";
import { PopupEngine } from "./components/PopupEngine";
import { PwaInstallBanner } from "./components/PwaInstallBanner";
import { PushPermissionBanner } from "./components/PushPermissionBanner";
import { SideNav } from "./components/SideNav";
import { vendorEnv } from "./lib/envValidation";
import { BOTTOM_PADDING } from "./lib/ui";
import { queryClient } from "./lib/queryClient";

/* ── Auth screens: eagerly loaded (needed before user is known) ── */
import ForgotPassword from "./pages/ForgotPassword";
import GuestLanding from "./pages/GuestLanding";
import JoinSelect from "./pages/JoinSelect";
import Login from "./pages/Login";
import Register from "./pages/Register";

/* ── Dashboard: eagerly loaded (first screen after login) ── */
import Dashboard from "./pages/Dashboard";

/* ── Secondary pages: lazy loaded (only fetched when navigated to) ── */
const Orders = lazy(() => import("./pages/Orders"));
const Products = lazy(() => import("./pages/Products"));
const Store = lazy(() => import("./pages/Store"));
const Profile = lazy(() => import("./pages/Profile"));
const Wallet = lazy(() => import("./pages/Wallet"));
const Analytics = lazy(() => import("./pages/Analytics"));
const Notifications = lazy(() => import("./pages/Notifications"));
const Reviews = lazy(() => import("./pages/Reviews"));
const Promos = lazy(() => import("./pages/Promos"));
const Campaigns = lazy(() => import("./pages/Campaigns"));
const Chat = lazy(() => import("./pages/Chat"));

/* ── Shared skeleton shown while a lazy page loads ── */
function PageSkeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-4 p-4">
      <div className="h-8 w-2/5 rounded-xl bg-gray-200" />
      <div className="h-32 w-full rounded-2xl bg-gray-100" />
      <div className="h-24 w-full rounded-2xl bg-gray-100" />
      <div className="h-24 w-full rounded-2xl bg-gray-100" />
    </div>
  );
}

/* ── ID Card Gate Modal ────────────────────────────────────────────────────
   Shown when a vendor is authenticated but has not yet submitted their CNIC
   number. Blocks all navigation until the vendor submits a valid CNIC.
   The modal cannot be dismissed — it is a hard prerequisite gate. ── */
function IdCardGateModal({
  onSubmitted,
}: {
  onSubmitted: () => void;
}) {
  const [cnic, setCnic] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function fmtCnic(v: string) {
    const d = v.replace(/\D/g, "").slice(0, 13);
    if (d.length <= 5) return d;
    if (d.length <= 12) return `${d.slice(0, 5)}-${d.slice(5)}`;
    return `${d.slice(0, 5)}-${d.slice(5, 12)}-${d.slice(12)}`;
  }
  function isValidCnic(v: string) {
    return /^\d{5}-\d{7}-\d$/.test(v);
  }

  const handleSubmit = async () => {
    if (!isValidCnic(cnic)) {
      setError("Please enter your CNIC in XXXXX-XXXXXXX-X format");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await api.setIdCard(cnic);
      onSubmitted();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to save CNIC. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(6,10,20,0.97)",
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
          background: "#0B1022",
          border: "1px solid #1A2E4A",
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
            background: "rgba(26,86,219,0.12)",
            border: "1px solid rgba(26,86,219,0.3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 20px",
          }}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#1A56DB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="5" width="20" height="14" rx="2" />
            <line x1="2" y1="10" x2="22" y2="10" />
            <line x1="6" y1="13" x2="6" y2="13" />
            <line x1="10" y1="13" x2="10" y2="13" />
            <line x1="14" y1="13" x2="14" y2="13" />
            <line x1="18" y1="13" x2="18" y2="13" />
          </svg>
        </div>
        <h2 style={{ color: "#E2E8F0", fontSize: 20, fontWeight: 700, textAlign: "center", margin: "0 0 8px" }}>
          ID Verification Required
        </h2>
        <p style={{ color: "#6B7280", fontSize: 13, lineHeight: 1.6, textAlign: "center", margin: "0 0 24px" }}>
          Please enter your CNIC number to continue. This is required to verify your identity before using the app.
        </p>
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>
            CNIC Number *
          </label>
          <input
            type="text"
            inputMode="numeric"
            placeholder="XXXXX-XXXXXXX-X"
            maxLength={15}
            value={cnic}
            onChange={(e) => { setCnic(fmtCnic(e.target.value)); setError(""); }}
            style={{
              width: "100%",
              height: 48,
              padding: "0 14px",
              borderRadius: 12,
              background: "rgba(255,255,255,0.06)",
              border: `1.5px solid ${error ? "#ef4444" : cnic && isValidCnic(cnic) ? "#1A56DB" : "rgba(255,255,255,0.12)"}`,
              color: "#E2E8F0",
              fontSize: 16,
              fontWeight: 600,
              letterSpacing: "0.04em",
              outline: "none",
              boxSizing: "border-box",
            }}
          />
          {error && (
            <p style={{ color: "#ef4444", fontSize: 11, margin: "6px 0 0", fontWeight: 600 }}>
              {error}
            </p>
          )}
          {cnic && isValidCnic(cnic) && (
            <p style={{ color: "#1A56DB", fontSize: 11, margin: "6px 0 0", fontWeight: 600 }}>
              Valid CNIC format
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
            background: "linear-gradient(135deg, #1A56DB, #0E3A8A)",
            color: "#fff",
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
              Saving…
            </>
          ) : (
            "Submit CNIC"
          )}
        </button>
        <p style={{ color: "#4B5563", fontSize: 11, textAlign: "center", marginTop: 12, lineHeight: 1.5 }}>
          Your CNIC is encrypted and stored securely. It will only be used for identity verification.
        </p>
      </div>
    </div>
  );
}

const MAINTENANCE_GRACE_MS = 5 * 60 * 1000; /* 5-minute grace period */

function PendingApprovalScreen({
  supportPhone,
  onRefresh,
  onSignOut,
}: {
  supportPhone?: string;
  onRefresh: () => Promise<void>;
  onSignOut: () => void;
}) {
  const [checking, setChecking] = useState(false);
  const [checkedOnce, setCheckedOnce] = useState(false);

  const handleCheckStatus = async () => {
    setChecking(true);
    try {
      await onRefresh();
      setCheckedOnce(true);
    } finally {
      setChecking(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0F1117",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        style={{
          background: "#161B22",
          border: "1px solid #252D3A",
          borderRadius: 22,
          padding: "32px 24px",
          maxWidth: 380,
          width: "100%",
          textAlign: "center",
          boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
        }}
      >
        <div
          style={{
            width: 68,
            height: 68,
            borderRadius: 18,
            background: "rgba(249,115,22,0.12)",
            border: "1px solid rgba(249,115,22,0.3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 18px",
          }}
        >
          <svg
            width="30"
            height="30"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#F97316"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        </div>
        <h2 style={{ color: "#E2E8F0", fontSize: 20, fontWeight: 800, margin: "0 0 8px" }}>
          Application Pending
        </h2>
        <p style={{ color: "#6B7280", fontSize: 14, lineHeight: 1.6, margin: "0 0 8px" }}>
          Your vendor account is pending admin approval. You will be notified once your account is
          approved.
        </p>
        {checkedOnce && (
          <p style={{ color: "#9CA3AF", fontSize: 13, margin: "0 0 16px" }}>
            Still pending — please check back later.
          </p>
        )}
        <button
          onClick={handleCheckStatus}
          disabled={checking}
          style={{
            display: "block",
            width: "100%",
            padding: "12px 0",
            marginBottom: 10,
            borderRadius: 12,
            background: "linear-gradient(135deg, #F97316, #EA580C)",
            color: "#fff",
            fontWeight: 700,
            fontSize: 14,
            cursor: checking ? "not-allowed" : "pointer",
            opacity: checking ? 0.7 : 1,
            border: "none",
          }}
        >
          {checking ? "Checking…" : "Check Approval Status"}
        </button>
        {supportPhone && (
          <a
            href={`tel:${supportPhone}`}
            style={{
              display: "block",
              width: "100%",
              padding: "11px 0",
              marginBottom: 10,
              borderRadius: 12,
              background: "transparent",
              border: "1px solid #374151",
              color: "#9CA3AF",
              fontWeight: 600,
              fontSize: 14,
              textDecoration: "none",
            }}
          >
            Contact Support
          </a>
        )}
        <button
          onClick={onSignOut}
          style={{
            width: "100%",
            padding: "11px 0",
            borderRadius: 12,
            border: "1px solid #252D3A",
            background: "#0F1117",
            color: "#6B7280",
            fontWeight: 600,
            fontSize: 14,
            cursor: "pointer",
          }}
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}

function KycGate({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  if (user?.kycStatus === "verified") return <>{children}</>;
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-100 text-3xl">
          <Lock size={28} className="text-amber-600" />
        </div>
        <h2 className="mb-2 text-lg font-extrabold text-gray-800">
          Identity Verification Required
        </h2>
        <p className="mb-4 text-sm leading-relaxed text-gray-500">
          Complete KYC verification to unlock this feature and other premium capabilities.
        </p>
        <div className="mb-5 space-y-1.5 rounded-xl bg-gray-50 p-3 text-left">
          {[
            { label: "Business Analytics", icon: ChartPie },
            { label: "Discount Promotions", icon: Megaphone },
            { label: "Ad Campaigns", icon: Megaphone },
            { label: "Wallet Withdrawals", icon: Wallet },
          ].map(({ label, icon: Icon }) => (
            <div key={label} className="flex items-center gap-2 text-sm text-gray-600">
              <span className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-orange-100 text-[10px] font-bold text-orange-500">
                <CheckCircle2 size={12} />
              </span>
              <span>{label}</span>
            </div>
          ))}
        </div>
        {user?.kycStatus === "pending" ? (
          <div className="rounded-xl bg-blue-50 p-3 text-center">
            <p className="text-sm font-bold text-blue-700">Verification Under Review</p>
            <p className="mt-1 text-xs text-blue-500">
              Our team will notify you within 24 hours once your documents are approved.
            </p>
          </div>
        ) : (
          <button
            onClick={() => navigate("/profile")}
            className="h-11 w-full rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 text-sm font-bold text-white"
          >
            Verify My Identity →
          </button>
        )}
      </div>
    </div>
  );
}

/* ── Magic link deep-link handler ─────────────────────────────────────
   Vendor clicks the email link → lands on /auth/magic-link?token=<raw>
   Verifies the token, stores credentials, then delegates to the standard
   handleSuccess path so APPROVAL_PENDING / APPROVAL_REJECTED overlays
   are shown correctly (same as any other successful login). ── */
function MagicLinkPage() {
  const { login } = useAuth();
  const [, navigate] = useLocation();
  const [status, setStatus] = useState<"loading" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    if (!token) {
      setStatus("error");
      setErrorMsg("Invalid magic link — no token found. Please request a new one.");
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
            login(accessToken, { approvalStatus: "pending" } as never, refreshToken);
            navigate("/", { replace: true });
            return;
          }
          if (code === "APPROVAL_REJECTED") {
            const reason = (e.rejectionReason as string) || "";
            login(
              accessToken,
              { approvalStatus: "rejected", rejectionReason: reason } as never,
              refreshToken
            );
            navigate("/", { replace: true });
            return;
          }
          if (code === "ACCOUNT_BANNED") {
            api.clearTokens();
            setStatus("error");
            setErrorMsg("Your account has been permanently banned. Please contact support.");
            return;
          }
          setStatus("error");
          setErrorMsg("We couldn't verify your account. Please try logging in directly.");
          return;
        }
        if (profile.approvalStatus === "pending") {
          login(accessToken, profile as never, refreshToken);
          navigate("/", { replace: true });
          return;
        }
        if (profile.approvalStatus === "rejected") {
          login(accessToken, profile as never, refreshToken);
          navigate("/", { replace: true });
          return;
        }
        login(accessToken, profile as never, refreshToken);
        navigate("/", { replace: true });
      } catch (e: unknown) {
        setStatus("error");
        setErrorMsg(
          e instanceof Error ? e.message : "Magic link verification failed. Please request a new one."
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
          background: "#0f172a",
          color: "#fff",
          fontFamily: "Inter, sans-serif",
        }}
      >
        <div style={{ fontSize: 40 }}>🔗</div>
        <p style={{ margin: 0, textAlign: "center", color: "#f87171", maxWidth: 320 }}>
          {errorMsg}
        </p>
        <button
          onClick={() => navigate("/login", { replace: true })}
          style={{
            marginTop: 8,
            padding: "10px 24px",
            borderRadius: 10,
            border: "none",
            background: "#1A56DB",
            color: "#fff",
            fontWeight: 700,
            cursor: "pointer",
            fontSize: 14,
          }}
        >
          Go to Login
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
        background: "#0f172a",
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          border: "4px solid #1e293b",
          borderTopColor: "#1A56DB",
          borderRadius: "50%",
          animation: "spin 0.8s linear infinite",
        }}
      />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function AppRoutes() {
  const { user, loading, logout, storageError, sessionExpired, clearSessionExpired, refreshUser } =
    useAuth();
  const { config } = usePlatformConfig();
  const { symbol: currencySymbol } = useCurrency();
  useLanguage(); /* initialises RTL + language from API on mount */

  const [needsIdCard, setNeedsIdCard] = React.useState(false);
  const [idCardGateChecked, setIdCardGateChecked] = React.useState(false);

  useEffect(() => {
    if (!user || idCardGateChecked) return;
    api.getNeedsIdCard()
      .then(({ needsIdCard: n }) => {
        setNeedsIdCard(n);
        setIdCardGateChecked(true);
      })
      .catch(() => {
        setIdCardGateChecked(true);
      });
  }, [user, idCardGateChecked]);

  /* ── Fetch and cache vendor feature rules for client-side gate checks ── */
  useEffect(() => {
    if (!user?.id) return;
    api.getFeatureRules()
      .then((result) => {
        saveFeatureRulesCache(user.id, result.features);
      })
      .catch(() => { /* non-critical — gate falls back to allow */ });
  }, [user?.id]);

  useEffect(() => {
    initErrorReporter();
  }, []);

  useEffect(() => {
    return () => {
      queryClient.clear();
    };
  }, []);

  const prevUserRef = React.useRef(user);
  useEffect(() => {
    if (prevUserRef.current != null && user == null) {
      queryClient.clear();
    }
    prevUserRef.current = user;
  }, [user]);

  /* ── Apply network/retry settings from platform config on startup ── */
  useEffect(() => {
    const net = config?.network;
    if (!net) return;
    if (typeof net.apiTimeoutMs === "number") setApiTimeoutMs(net.apiTimeoutMs);
  }, [config]);

  /* ── Sentry + Analytics init from platform config ── */
  useEffect(() => {
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
    if (integ.analytics && integ.analyticsTrackingId) {
      initAnalytics(
        integ.analyticsPlatform,
        integ.analyticsTrackingId,
        integ.analyticsDebug ?? false
      );
    }
  }, [config?.integrations]);

  const [location, navigate] = useLocation();

  /* ── Cold-start notification tap: consume any tap captured before auth loaded ──
     When the vendor taps a new-order push notification from a killed app, the
     pushNotificationActionPerformed listener fires at module-load time and
     stashes the data.  We drain it here once the session is ready. */
  useEffect(() => {
    if (!user) return;
    const pending = consumePendingNotificationTap();
    if (pending?.orderId) {
      /* Fire-and-forget prefetch: seed the per-order cache so Orders.tsx
         renders the tapped order detail instantly from cache.
         Navigation is immediate — never blocked by network or prefetch outcome. */
      const orderId = pending.orderId;
      queryClient
        .prefetchQuery({
          queryKey: ["vendor-order", orderId],
          queryFn: () => api.getVendorOrder(orderId),
          staleTime: 30_000,
        })
        .catch((err) => {
          log.warn("[App] push registration failed:", err);
        });
      navigate(`/orders/${orderId}`);
    } else if (pending) {
      navigate("/orders");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, navigate]);

  /* ── Global Socket.IO lifecycle — connect on login, disconnect on logout ──
     Single shared socket (via connectVendorSocket singleton) so all pages
     receive real-time order events regardless of which route is active.
     The NewOrderBanner is mounted here at app-root level so it appears on
     every page — not just /orders. */
  const [newOrder, setNewOrder] = useState<VendorNewOrderEvent | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    connectVendorSocket(user.id);
    const unsubOrder = onNewOrder((order) => {
      setNewOrder(order);
      playOrderSound();
      void queryClient.invalidateQueries({ queryKey: ["vendor-orders"] });
      void queryClient.invalidateQueries({ queryKey: ["vendor-stats"] });
      void queryClient.invalidateQueries({ queryKey: ["vendor-notifs-count"] });
      void queryClient.invalidateQueries({ queryKey: ["vendor-notifications"] });
    });
    const unsubOrderUpdate = onOrderUpdate(() => {
      void queryClient.invalidateQueries({ queryKey: ["vendor-notifs-count"] });
      void queryClient.invalidateQueries({ queryKey: ["vendor-notifications"] });
    });
    return () => {
      unsubOrder();
      unsubOrderUpdate();
      disconnectVendorSocket();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  /* ── Push registration error state: shown as a dismissable banner ── */
  const [pushError, setPushError] = useState<
    "permission_denied" | "registration_failed" | "network_error" | null
  >(null);

  /* ── FCM foreground notification banner ── */
  const [fcmNotif, setFcmNotif] = useState<{
    title: string;
    body: string;
    orderId?: string;
  } | null>(null);
  const fcmCleanupRef = useRef<{ remove: () => void } | null>(null);
  const fcmDismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!user) return undefined;
    const onForeground = (title: string, body: string, data?: Record<string, string>) => {
      /* Play a short notification sound for new-order events.
         Deduplicate against the Socket.IO handler: if both FCM and Socket.IO
         deliver the same order within 5 seconds, only the first arrival plays
         sound / shows a banner. */
      const notifType = data?.type ?? "";
      if (notifType === "new_order" || notifType === "order_status") {
        const orderId = data?.orderId;
        if (orderId) {
          if (wasOrderSeenRecently(orderId)) {
            /* Already handled by the Socket.IO path — skip duplicate alert */
            return;
          }
          markOrderSeen(orderId);
        }

        try {
          const AudioContextCtor =
            (
              window as Window & {
                AudioContext?: typeof AudioContext;
                webkitAudioContext?: typeof AudioContext;
              }
            ).AudioContext ||
            (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
          if (!AudioContextCtor) return;
          const ctx = new AudioContextCtor();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.type = "sine";
          osc.frequency.setValueAtTime(880, ctx.currentTime);
          gain.gain.setValueAtTime(0.3, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
          osc.start(ctx.currentTime);
          osc.stop(ctx.currentTime + 0.4);
        } catch (err) {
          log.warn("[App] notification sound failed:", err);
        }
      }
      /* Banner copy for cancellation and settlement types */
      let displayTitle = title;
      let displayBody = body;
      if (notifType === "order_cancelled") {
        displayTitle = "Order Cancelled";
        displayBody = body || "An order has been cancelled.";
      } else if (notifType === "payment_settlement") {
        displayTitle = "Payment Settled";
        displayBody = body || "A payment has been settled to your wallet.";
      }
      setFcmNotif({ title: displayTitle, body: displayBody, orderId: data?.orderId });
      if (fcmDismissTimer.current) clearTimeout(fcmDismissTimer.current);
      fcmDismissTimer.current = setTimeout(() => setFcmNotif(null), 5000);
    };
    /* When the vendor taps a push notification (background state), navigate
       to the specific order if orderId is provided. */
    const onNotificationTap = (data: Record<string, string>) => {
      if (data.orderId) {
        navigate(`/orders/${data.orderId}`);
      } else {
        navigate("/orders");
      }
    };
    const onPushError: PushErrorHandler = (reason) => {
      setPushError(reason);
    };

    if (Capacitor.isNativePlatform()) {
      registerPush(onForeground, onNotificationTap, onPushError)
        .then((cleanup) => {
          if (cleanup) fcmCleanupRef.current = cleanup;
        })
        .catch((err) => {
          log.warn("[App] push registration failed:", err);
        });
      return () => {
        fcmCleanupRef.current?.remove();
        if (fcmDismissTimer.current) clearTimeout(fcmDismissTimer.current);
      };
    }
    if (typeof Notification !== "undefined" && Notification.requestPermission) {
      Notification.requestPermission()
        .then((perm) => {
          if (perm === "granted") {
            registerPush(undefined, undefined, onPushError).catch((err) => {
              log.warn("[App] push registration failed:", err);
            });
          } else if (perm === "denied") {
            setPushError("permission_denied");
          }
        })
        .catch((err) => {
          log.warn("[App] push registration failed:", err);
        });
    }

    /* Re-register whenever the vendor tab regains focus so tokens stay fresh
       and any rotation that happened while backgrounded is picked up. */
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        registerPush(undefined, undefined, onPushError).catch((err) => {
          log.warn("[App] push registration failed:", err);
        });
        refreshUser().catch((err) => {
          log.warn("[App] refreshUser failed:", err);
        });
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    /* Listen for SW_NAVIGATE messages from the service worker notificationclick handler.
       Normalize via URL() so both absolute URLs and path strings are handled safely. */
    const onSwMessage = (event: MessageEvent) => {
      if (event.data?.type === "SW_NAVIGATE" && event.data?.path) {
        try {
          const fullUrl = new URL(event.data.path as string, window.location.origin);
          const base = (import.meta.env.BASE_URL || "/vendor").replace(/\/$/, "");
          const appPath = fullUrl.pathname.replace(new RegExp(`^${base}`), "") || "/";
          navigate(appPath);
        } catch (err) {
          log.warn("[App] notification sound failed:", err);
        }
      }
    };
    navigator.serviceWorker?.addEventListener("message", onSwMessage);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      navigator.serviceWorker?.removeEventListener("message", onSwMessage);
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, navigate]);

  const maintenanceSince = useRef<number | null>(null);
  const [maintenanceBlocked, setMaintenanceBlocked] = useState(false);
  const [maintenanceSecs, setMaintenanceSecs] = useState(0);

  useEffect(() => {
    if (config.platform.appStatus !== "maintenance") {
      maintenanceSince.current = null;
      setMaintenanceBlocked(false);
      return;
    }
    if (maintenanceSince.current == null) {
      maintenanceSince.current = Date.now();
    }
    const tick = () => {
      const elapsed = Date.now() - (maintenanceSince.current ?? Date.now());
      const remaining = Math.max(0, Math.ceil((MAINTENANCE_GRACE_MS - elapsed) / 1000));
      setMaintenanceSecs(remaining);
      if (elapsed >= MAINTENANCE_GRACE_MS) setMaintenanceBlocked(true);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [config.platform.appStatus]);

  if (!loading && !user) {
    if (sessionExpired)
      return (
        <SessionExpiredOverlay
          onLogin={() => {
            clearSessionExpired();
            navigate("/login");
          }}
        />
      );
    if (location === "/auth/magic-link") return <MagicLinkPage />;
    if (location === "/join") return <JoinSelect />;
    if (location === "/register") return <Register />;
    if (location === "/login") return <Login />;
    if (location === "/forgot-password") return <ForgotPassword />;
    return <GuestLanding />;
  }

  if (loading)
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#0F1117",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              width: 80,
              height: 80,
              borderRadius: 24,
              background: "linear-gradient(135deg, #F97316, #EA580C)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 20px",
              boxShadow: "0 8px 32px rgba(249,115,22,0.4)",
            }}
          >
            <svg
              width="38"
              height="38"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#fff"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
          </div>
          <div
            style={{
              width: 32,
              height: 32,
              border: "3px solid #F97316",
              borderTopColor: "transparent",
              borderRadius: "50%",
              margin: "0 auto 16px",
              animation: "spin 0.8s linear infinite",
            }}
          />
          <p style={{ color: "#E2E8F0", fontWeight: 700, fontSize: 17, margin: "0 0 4px" }}>
            Loading Vendor Portal…
          </p>
          <p style={{ color: "#6B7280", fontSize: 13, margin: 0 }}>
            {config.platform.appName} Business Partner
          </p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );

  if (storageError)
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#0F1117",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 16,
        }}
      >
        <div
          style={{
            background: "#161B22",
            border: "1px solid #252D3A",
            borderRadius: 20,
            padding: "28px 24px",
            maxWidth: 380,
            width: "100%",
            textAlign: "center",
            boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
          }}
        >
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 16,
              background: "rgba(239,68,68,0.12)",
              border: "1px solid rgba(239,68,68,0.3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 18px",
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
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <h2 style={{ color: "#E2E8F0", fontSize: 20, fontWeight: 700, margin: "0 0 8px" }}>
            Storage Error
          </h2>
          <p style={{ color: "#6B7280", fontSize: 14, lineHeight: 1.6, margin: "0 0 20px" }}>
            Could not access browser storage. Please enable cookies and local storage for this site.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              width: "100%",
              height: 48,
              borderRadius: 12,
              border: "none",
              background: "linear-gradient(135deg, #F97316, #EA580C)",
              color: "#fff",
              fontSize: 15,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Reload
          </button>
        </div>
      </div>
    );

  if (!user) return <Login />;

  if (needsIdCard && idCardGateChecked)
    return (
      <IdCardGateModal
        onSubmitted={() => {
          setNeedsIdCard(false);
          refreshUser();
        }}
      />
    );

  /* ── Approval status guards — shown after session rehydration ── */
  const supportPhone =
    ((config.platform as Record<string, unknown>)?.supportPhone as string | undefined) ||
    ((config.content as Record<string, unknown>)?.supportPhone as string | undefined);

  if (user.approvalStatus === "pending")
    return (
      <PendingApprovalScreen
        supportPhone={supportPhone}
        onRefresh={refreshUser}
        onSignOut={() => {
          try {
            logout();
          } finally {
            window.location.reload();
          }
        }}
      />
    );

  if (user.approvalStatus === "rejected")
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#0F1117",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}
      >
        <div
          style={{
            background: "#161B22",
            border: "1px solid #252D3A",
            borderRadius: 22,
            padding: "32px 24px",
            maxWidth: 380,
            width: "100%",
            textAlign: "center",
            boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
          }}
        >
          <div
            style={{
              width: 68,
              height: 68,
              borderRadius: 18,
              background: "rgba(239,68,68,0.12)",
              border: "1px solid rgba(239,68,68,0.3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 18px",
            }}
          >
            <svg
              width="30"
              height="30"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#ef4444"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          </div>
          <h2 style={{ color: "#E2E8F0", fontSize: 20, fontWeight: 800, margin: "0 0 8px" }}>
            Application Rejected
          </h2>
          <p style={{ color: "#6B7280", fontSize: 14, lineHeight: 1.6, margin: "0 0 8px" }}>
            Your vendor account application was not approved.
          </p>
          {user.rejectionReason && (
            <p style={{ color: "#fca5a5", fontSize: 13, fontWeight: 600, margin: "0 0 20px" }}>
              Reason: {user.rejectionReason}
            </p>
          )}
          {supportPhone && (
            <a
              href={`tel:${supportPhone}`}
              style={{
                display: "block",
                width: "100%",
                padding: "12px 0",
                marginBottom: 10,
                borderRadius: 12,
                background: "linear-gradient(135deg, #F97316, #EA580C)",
                color: "#fff",
                fontWeight: 700,
                fontSize: 14,
                textDecoration: "none",
              }}
            >
              Contact Support
            </a>
          )}
          <button
            onClick={() => {
              try {
                logout();
              } finally {
                window.location.reload();
              }
            }}
            style={{
              width: "100%",
              padding: "11px 0",
              borderRadius: 12,
              border: "1px solid #252D3A",
              background: "#0F1117",
              color: "#6B7280",
              fontWeight: 600,
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            Sign Out
          </button>
        </div>
      </div>
    );

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-gray-100 dark:bg-[#060A14]">
      {/* ── Maintenance overlay: shown immediately but blocks after 5-min grace ── */}
      {config.platform.appStatus === "maintenance" && maintenanceBlocked && (
        <MaintenanceScreen
          message={config.content.maintenanceMsg}
          appName={config.platform.appName}
        />
      )}
      {config.platform.appStatus === "maintenance" &&
        !maintenanceBlocked &&
        maintenanceSecs > 0 && (
          <div className="fixed inset-x-0 top-0 z-50 bg-amber-500 px-4 py-2 text-center text-xs font-bold text-white shadow">
            <AlertTriangle size={12} className="inline" /> {config.platform.appName} is in maintenance mode. Full screen in{" "}
            {Math.floor(maintenanceSecs / 60)}:{String(maintenanceSecs % 60).padStart(2, "0")}
          </div>
        )}
      {/* ── Limited-service banner: non-blocking strip shown when app_status = "limited" ── */}
      {config.platform.appStatus === "limited" && (
        <div className="fixed inset-x-0 top-0 z-50 bg-orange-400 px-4 py-2 text-center text-xs font-bold text-white shadow">
          <AlertTriangle size={12} className="inline" /> Limited service — some features may be temporarily unavailable
        </div>
      )}

      {/* ── Push registration error banner ── */}
      {pushError && (
        <div className="fixed top-0 right-0 left-0 z-[10001] flex items-center gap-3 bg-amber-500 px-4 py-2.5 text-xs font-semibold text-white shadow-md">
          <span className="flex-1">
            {pushError === "permission_denied"
              ? "Order notifications are blocked. Go to browser settings → Site Settings → Notifications → Allow."
              : pushError === "network_error"
                ? "Could not register for notifications. Check your connection."
                : "Notification registration failed. Go to Settings → Test Notification to retry."}
          </span>
          <button
            onClick={() => setPushError(null)}
            className="flex-shrink-0 text-lg leading-none font-bold text-white/80 hover:text-white"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* ── FCM foreground notification banner ── */}
      {fcmNotif && (
        <button
          onClick={() => {
            if (fcmNotif.orderId) navigate(`/orders/${fcmNotif.orderId}`);
            setFcmNotif(null);
          }}
          className="fixed top-4 right-4 left-4 z-[10000] rounded-2xl bg-orange-600 px-4 py-3 text-left text-sm font-semibold text-white shadow-xl"
        >
          <div className="truncate font-bold">{fcmNotif.title}</div>
          <div className="truncate text-xs opacity-90">{fcmNotif.body}</div>
        </button>
      )}

      {/* ── Announcement bar (top, dismissable) ── */}
      <AnnouncementBar message={config.content.announcement} />
      <PopupEngine />

      <div className="flex flex-1 overflow-hidden">
        {/* ── Desktop Sidebar (hidden on mobile) ── */}
        <div className="hidden md:flex md:w-64 md:flex-shrink-0">
          <SideNav />
        </div>

        {/* ── Main Content ── */}
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <div
            className="scroll-momentum flex-1 overflow-y-auto"
            style={{ paddingBottom: BOTTOM_PADDING }}
            id="main-scroll"
          >
            <div className="md:mx-auto md:max-w-5xl md:px-6 md:pb-8">
              <Switch>
                <Route path="/">
                  <ErrorBoundary>
                    <Dashboard />
                  </ErrorBoundary>
                </Route>
                <Suspense fallback={<PageSkeleton />}>
                  <Route path="/orders/:id">
                    {(params) => (
                      <ErrorBoundary key={`order-${params.id}`}>
                        <Orders targetOrderId={params.id} />
                      </ErrorBoundary>
                    )}
                  </Route>
                  <Route path="/orders">
                    <ErrorBoundary>
                      <Orders />
                    </ErrorBoundary>
                  </Route>
                  <Route path="/products">
                    <ErrorBoundary>
                      <Products />
                    </ErrorBoundary>
                  </Route>
                  <Route path="/wallet">
                    <ErrorBoundary>
                      <Wallet />
                    </ErrorBoundary>
                  </Route>
                  <Route path="/analytics">
                    <ErrorBoundary>
                      <KycGate>
                        <Analytics />
                      </KycGate>
                    </ErrorBoundary>
                  </Route>
                  <Route path="/reviews">
                    <ErrorBoundary>
                      <Reviews />
                    </ErrorBoundary>
                  </Route>
                  <Route path="/promos">
                    <ErrorBoundary>
                      <KycGate>
                        <Promos />
                      </KycGate>
                    </ErrorBoundary>
                  </Route>
                  <Route path="/campaigns">
                    <ErrorBoundary>
                      <KycGate>
                        <Campaigns />
                      </KycGate>
                    </ErrorBoundary>
                  </Route>
                  <Route path="/chat">
                    <ErrorBoundary>
                      <Chat />
                    </ErrorBoundary>
                  </Route>
                  <Route path="/store">
                    <ErrorBoundary>
                      <Store />
                    </ErrorBoundary>
                  </Route>
                  <Route path="/notifications">
                    <ErrorBoundary>
                      <Notifications />
                    </ErrorBoundary>
                  </Route>
                  <Route path="/profile">
                    <ErrorBoundary>
                      <Profile />
                    </ErrorBoundary>
                  </Route>
                </Suspense>
                <Route>
                  <ErrorBoundary>
                    <div className="flex h-64 items-center justify-center">
                      <div className="text-center">
                        <Search size={40} className="mx-auto mb-3 text-gray-400" />
                        <p className="text-lg font-extrabold text-gray-700">Page not found</p>
                        <p className="mt-1 text-sm text-gray-400">This page doesn't exist</p>
                        <a
                          href="/"
                          className="mt-4 inline-flex h-10 items-center gap-1 rounded-xl bg-orange-500 px-6 text-sm font-bold text-white"
                        >
                          <ArrowLeft size={14} /> Go Home
                        </a>
                      </div>
                    </div>
                  </ErrorBoundary>
                </Route>
              </Switch>
            </div>
          </div>

          {/* Global New Order Banner — visible on every page */}
          <NewOrderBanner
            order={newOrder}
            currencySymbol={currencySymbol}
            onDismiss={() => setNewOrder(null)}
          />

          {/* Mobile Bottom Nav */}
          <BottomNav />
        </div>
      </div>
    </div>
  );
}

/* ── Session Expired Overlay ── */
function SessionExpiredOverlay({ onLogin }: { onLogin: () => void }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0F1117",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        style={{
          background: "#161B22",
          border: "1px solid #252D3A",
          borderRadius: 20,
          padding: "32px 24px",
          maxWidth: 380,
          width: "100%",
          textAlign: "center",
          boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
        }}
      >
        <div
          style={{
            width: 68,
            height: 68,
            borderRadius: 18,
            background: "rgba(249,115,22,0.12)",
            border: "1px solid rgba(249,115,22,0.3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 18px",
          }}
        >
          <svg
            width="30"
            height="30"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#F97316"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>
        <h2 style={{ color: "#E2E8F0", fontSize: 20, fontWeight: 800, margin: "0 0 8px" }}>
          Session Expired
        </h2>
        <p style={{ color: "#6B7280", fontSize: 14, lineHeight: 1.6, margin: "0 0 24px" }}>
          Your session has expired for security reasons. Please sign in again to continue.
        </p>
        <button
          onClick={onLogin}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "100%",
            height: 48,
            borderRadius: 12,
            border: "none",
            background: "linear-gradient(135deg, #F97316, #EA580C)",
            color: "#fff",
            fontWeight: 700,
            fontSize: 15,
            cursor: "pointer",
            boxSizing: "border-box",
          }}
        >
          Sign In Again
        </button>
      </div>
    </div>
  );
}

const VersionCheckInit = React.memo(function VersionCheckInit() {
  useVersionCheck();
  return null;
});

const SplashScreen = React.lazy(() => import("./pages/SplashScreen"));
const OnboardingScreen = React.lazy(() => import("./pages/Onboarding"));

function AppShell() {
  const [splashDone, setSplashDone] = React.useState(false);
  const [onboardingDone, setOnboardingDone] = React.useState(() => {
    try { return localStorage.getItem("vendor_onboarding_done") === "1"; } catch { return false; }
  });

  if (!splashDone) {
    return (
      <React.Suspense fallback={null}>
        <SplashScreen onDone={() => setSplashDone(true)} />
      </React.Suspense>
    );
  }
  if (!onboardingDone) {
    return (
      <React.Suspense fallback={null}>
        <OnboardingScreen
          onDone={() => {
            try { localStorage.setItem("vendor_onboarding_done", "1"); } catch { /* ignore */ }
            setOnboardingDone(true);
          }}
        />
      </React.Suspense>
    );
  }
  return (
    <>
      <AppRoutes />
      <VendorGateModalRoot />
    </>
  );
}

export default function App() {
  return (
    <GlobalThemeProvider appRole="vendor">
    <AjkThemeProvider appRole="vendor" defaultTheme="dark-blue" storageKey="vendor_theme">
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <VersionCheckInit />
          <AuthProvider>
            <VendorVerificationGateProvider>
            <ThemeProvider theme={vendorTheme}>
            <Toaster />
            <WouterRouter
              base={(() => {
                /* Use BASE_URL exactly as Vite computed it from vite.config's
                 `base` option:
                   "/"        → ""        (app mounted at site root)
                   "/vendor/" → "/vendor" (path-routed behind a proxy)
                 The previous logic forced "/vendor" whenever BASE_URL was
                 "/", which broke standalone deployments by mounting every
                 route under a non-existent /vendor prefix. */
                const raw = vendorEnv.baseUrl || "";
                if (!raw || typeof raw !== "string") return "";
                return raw.replace(/\/$/, "");
              })()}
            >
              <AppShell />
            </WouterRouter>
            <PwaInstallBanner />
            <PushPermissionBanner />
            </ThemeProvider>
            </VendorVerificationGateProvider>
          </AuthProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </AjkThemeProvider>
    </GlobalThemeProvider>
  );
}

function VendorGateModalRoot() {
  const { blockedVerifications, clearBlockedVerifications } = useVendorVerificationGate();
  if (blockedVerifications.length === 0) return null;
  return (
    <VendorVerificationGateModal
      missingVerifications={blockedVerifications}
      onClose={clearBlockedVerifications}
    />
  );
}
