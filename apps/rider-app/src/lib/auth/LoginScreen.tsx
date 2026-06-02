import { BiometricEnrollOverlay, LoginScreen as SharedLoginScreen, PendingOverlay, RejectedOverlay, ThemeProvider, useAuthTheme } from "@workspace/auth-react";
import { tDual } from "@workspace/i18n";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { api } from "../api";
import { useRiderAuthConfig } from "../AuthConfigContext";
import { normalizeRoles, useAuth as useRiderAuth, type AuthUser } from "../rider-auth";
import { useLanguage } from "../useLanguage";
import { useAppStatus } from "./useAppStatus";
import { facebookLogin, googleOneTap } from "./social-oauth";
import { riderTheme } from "./theme";


type SocialResult = { token: string; user: unknown; refreshToken?: string };

export interface LoginScreenProps {
  onSuccess?: (token: string, profile: unknown) => void;
}

export default function LoginScreen({ onSuccess }: LoginScreenProps) {
  const { login } = useRiderAuth();
  const [, navigate] = useLocation();
  const theme = useAuthTheme();
  const authConfig = useRiderAuthConfig();
  const { language } = useLanguage();
  const { supportPhone } = useAppStatus();
  const [roleError, setRoleError] = useState<string | null>(null);
  const [overlay, setOverlay] = useState<"pending" | "rejected" | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string | undefined>();
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [pendingStatusMsg, setPendingStatusMsg] = useState<string | null>(null);
  const [enrollData, setEnrollData] = useState<{
    token: string; refreshToken: string; profile: unknown;
  } | null>(null);
  /* Pending social-auth 2FA challenge — stored when Google/Facebook returns
     requiresTwoFactor. Shows the same TOTP overlay as password login. */
  const [pendingTwoFactor, setPendingTwoFactor] = useState<{
    twoFactorToken: string;
  } | null>(null);
  const [socialTotpCode, setSocialTotpCode] = useState("");
  const [socialTotpError, setSocialTotpError] = useState<string | null>(null);
  const [socialTotpLoading, setSocialTotpLoading] = useState(false);
  const capturedTokenRef = useRef("");
  const capturedRefreshRef = useRef<string | undefined>(undefined);
  const roleErrorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (roleErrorTimerRef.current) clearTimeout(roleErrorTimerRef.current);
    };
  }, []);

  const finishLogin = useCallback((token: string, profile: unknown, refreshToken: string) => {
    try {
      login(token, profile as AuthUser, refreshToken || undefined);
    } catch {
      api.clearTokens();
      setRoleError(tDual("accessDenied", language));
      return;
    }
    onSuccess?.(token, profile);
    navigate("/");
  }, [login, navigate, onSuccess, language]);

  /**
   * Central post-auth handler. Always calls api.getMe() for the authoritative
   * server profile — never trusts callback payload roles alone — so email OTP's
   * synthetic user object and other spoofed payloads cannot bypass the role gate.
   */
  const handleSuccess = useCallback(async (user: unknown, token: string, refreshToken?: string) => {
    /* Store tokens first so api.getMe() can authenticate the request */
    const rToken = refreshToken ?? api.getRefreshToken() ?? "";
    api.storeTokens(token, rToken || undefined);

    /* Fetch authoritative profile; fall back to callback payload only on
       transient network/server errors.  Auth errors (401/403) mean the token
       is already invalid or the account no longer exists — proceeding with
       the synthetic callback payload would let a deleted/revoked user into the
       app with stale data until the next API call inevitably fails again.     */
    let profile: unknown = user;
    try {
      profile = await api.getMe();
    } catch (e: unknown) {
      api.clearTokens();
      const status = (e as { status?: number }).status;
      const msg =
        status === 401 || status === 403
          ? tDual("sessionExpired", language)
          : ((e as Error)?.message) || tDual("sessionExpired", language);
      setRoleError(msg);
      if (roleErrorTimerRef.current) clearTimeout(roleErrorTimerRef.current);
      roleErrorTimerRef.current = setTimeout(() => {
        roleErrorTimerRef.current = null;
        setRoleError(null);
      }, 3500);
      return;
    }

    /* Approval status gate — pending/rejected riders cannot proceed to dashboard */
    const p = profile as { approvalStatus?: string; rejectionReason?: string | null };
    if (p.approvalStatus === "pending") {
      capturedTokenRef.current = token;
      capturedRefreshRef.current = rToken;
      /* Populate auth context so a reload sees the same state as a fresh login */
      login(token, profile as AuthUser, rToken || undefined);
      setOverlay("pending");
      return;
    }
    if (p.approvalStatus === "rejected") {
      capturedTokenRef.current = token;
      capturedRefreshRef.current = rToken;
      setRejectionReason(p.rejectionReason ?? undefined);
      setOverlay("rejected");
      return;
    }

    /* Fail-closed role guard: reject any account whose roles explicitly exclude rider */
    const roles = normalizeRoles(profile as { roles?: unknown; role?: unknown });
    if (roles.length > 0 && !roles.includes("rider")) {
      api.clearTokens();
      setRoleError(tDual("accessDenied", language));
      if (roleErrorTimerRef.current) clearTimeout(roleErrorTimerRef.current);
      roleErrorTimerRef.current = setTimeout(() => {
        roleErrorTimerRef.current = null;
        setRoleError(null);
      }, 3500);
      return;
    }

    try {
      const { isBiometricAvailable, isBiometricEnabled } = await import("../biometric");
      const [available, enrolled] = await Promise.all([isBiometricAvailable(), isBiometricEnabled()]);
      if (available && !enrolled && rToken) {
        setEnrollData({ token, refreshToken: rToken, profile });
        return;
      }
    } catch { /* biometric unavailable — proceed normally */ }

    finishLogin(token, profile, rToken);
  }, [language, login, navigate, finishLogin]);

  const handleCheckStatus = useCallback(async () => {
    setCheckingStatus(true);
    setPendingStatusMsg(null);
    try {
      const profile = (await api.getMe()) as {
        approvalStatus?: string;
        rejectionReason?: string | null;
      };
      if (profile.approvalStatus === "pending") {
        setPendingStatusMsg(tDual("applicationUnderReview", language));
        return;
      }
      if (profile.approvalStatus === "rejected") {
        setRejectionReason(profile.rejectionReason ?? undefined);
        setOverlay("rejected");
        return;
      }
      const token = capturedTokenRef.current;
      if (token) {
        finishLogin(token, profile, capturedRefreshRef.current ?? "");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "";
      setPendingStatusMsg(msg || tDual("applicationUnderReview", language));
    } finally {
      setCheckingStatus(false);
    }
  }, [language, finishLogin]);

  const handleOverlaySignOut = useCallback(() => {
    api.clearTokens();
    capturedTokenRef.current = "";
    capturedRefreshRef.current = undefined;
    setOverlay(null);
    setRejectionReason(undefined);
  }, []);

  const handleGoogle = async () => {
    const clientId = authConfig.googleClientId;
    if (!clientId) return;
    try {
      const idToken = await googleOneTap(clientId);
      const res = (await api.socialGoogle({ idToken })) as SocialResult & {
        requiresTwoFactor?: boolean;
        twoFactorToken?: string;
      };
      /* Social auth may return a 2FA challenge when the account has TOTP enabled.
         Route through the same TOTP overlay as the password login flow. */
      if (res.requiresTwoFactor && res.twoFactorToken) {
        setSocialTotpCode("");
        setSocialTotpError(null);
        setPendingTwoFactor({ twoFactorToken: res.twoFactorToken });
        return;
      }
      await handleSuccess(res.user, res.token, res.refreshToken);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : tDual("accessDenied", language);
      setRoleError(msg || tDual("accessDenied", language));
      if (roleErrorTimerRef.current) clearTimeout(roleErrorTimerRef.current);
      roleErrorTimerRef.current = setTimeout(() => {
        roleErrorTimerRef.current = null;
        setRoleError(null);
      }, 3500);
    }
  };

  const handleFacebook = async () => {
    const appId = authConfig.facebookAppId;
    if (!appId) return;
    try {
      const accessToken = await facebookLogin(appId);
      const res = (await api.socialFacebook({ accessToken })) as SocialResult & {
        requiresTwoFactor?: boolean;
        twoFactorToken?: string;
      };
      if (res.requiresTwoFactor && res.twoFactorToken) {
        setSocialTotpCode("");
        setSocialTotpError(null);
        setPendingTwoFactor({ twoFactorToken: res.twoFactorToken });
        return;
      }
      await handleSuccess(res.user, res.token, res.refreshToken);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : tDual("accessDenied", language);
      setRoleError(msg || tDual("accessDenied", language));
      if (roleErrorTimerRef.current) clearTimeout(roleErrorTimerRef.current);
      roleErrorTimerRef.current = setTimeout(() => {
        roleErrorTimerRef.current = null;
        setRoleError(null);
      }, 3500);
    }
  };

  const handleSocialTotpSubmit = async () => {
    if (!pendingTwoFactor || socialTotpCode.length < 6) return;
    setSocialTotpLoading(true);
    setSocialTotpError(null);
    try {
      const deviceFingerprint =
        typeof navigator !== "undefined"
          ? btoa(encodeURIComponent(`${navigator.userAgent}${screen.width}x${screen.height}`)).slice(0, 64)
          : undefined;
      const res = (await api.twoFactorVerify({
        code: socialTotpCode,
        tempToken: pendingTwoFactor.twoFactorToken,
        deviceFingerprint,
        trustDevice: false,
      })) as { token?: string; refreshToken?: string; user?: unknown };
      if (!res.token) throw new Error("Verification failed — no token returned");
      setPendingTwoFactor(null);
      setSocialTotpCode("");
      await handleSuccess(res.user, res.token, res.refreshToken);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "";
      setSocialTotpError(msg || tDual("invalidTotpCode", language));
    } finally {
      setSocialTotpLoading(false);
    }
  };

  const handleBiometricSuccess = useCallback(async (storedRefresh: string) => {
    try {
      if (!storedRefresh) throw new Error(tDual("biometricFailed", language));
      api.storeTokens(api.getToken() || "", storedRefresh);
      const status = await api.refreshToken();
      if (status !== "refreshed") throw new Error(tDual("biometricFailed", language));
      const newToken = api.getToken();
      if (!newToken) throw new Error(tDual("biometricFailed", language));
      const rToken = api.getRefreshToken() ?? storedRefresh;
      await handleSuccess(null, newToken, rToken);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : tDual("biometricFailed", language);
      setRoleError(msg);
      if (roleErrorTimerRef.current) clearTimeout(roleErrorTimerRef.current);
      roleErrorTimerRef.current = setTimeout(() => {
        roleErrorTimerRef.current = null;
        setRoleError(null);
      }, 3500);
    }
  }, [language, handleSuccess]);

  const handleEnrollAccept = async () => {
    if (!enrollData) return;
    let biometricSaveFailed = false;
    try {
      const { storeBiometricToken, setBiometricEnabled } = await import("../biometric");
      await storeBiometricToken(enrollData.refreshToken);
      await setBiometricEnabled(true);
    } catch {
      /* Biometric save failed — login still proceeds. We'll surface a brief
         informational banner on the home page via sessionStorage so the user
         knows they can retry from Profile › Security settings.           */
      biometricSaveFailed = true;
    }
    const { token, refreshToken, profile } = enrollData;
    setEnrollData(null);
    if (biometricSaveFailed) {
      try { sessionStorage.setItem("biometric_save_failed", "1"); } catch { }
    }
    finishLogin(token, profile, refreshToken);
  };

  const handleEnrollDecline = () => {
    if (!enrollData) return;
    const { token, refreshToken, profile } = enrollData;
    setEnrollData(null);
    finishLogin(token, profile, refreshToken);
  };

  /* ── Pending approval screen ─────────────────────────────────────────────── */
  if (overlay === "pending") {
    return (
      <ThemeProvider role="rider">
        <PendingOverlay
          onCheckStatus={handleCheckStatus}
          onSignOut={handleOverlaySignOut}
          supportPhone={supportPhone}
          checking={checkingStatus}
        />
        {pendingStatusMsg && (
          <div className="fixed bottom-6 left-1/2 z-50 w-[calc(100%-3rem)] max-w-sm -translate-x-1/2 rounded-xl bg-warning/10 px-4 py-3 text-center text-[13px] font-medium text-warning shadow-lg ring-1 ring-amber-200">
            {pendingStatusMsg}
          </div>
        )}
      </ThemeProvider>
    );
  }

  /* ── Rejected screen ─────────────────────────────────────────────────────── */
  if (overlay === "rejected") {
    return (
      <ThemeProvider role="rider">
        <RejectedOverlay
          rejectionReason={rejectionReason}
          onSignOut={handleOverlaySignOut}
          supportPhone={supportPhone}
        />
      </ThemeProvider>
    );
  }

  /* ── Role-rejection screen ───────────────────────────────────────────────── */
  if (roleError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-surface px-6 py-10 font-[Inter,system-ui,sans-serif] animate-in fade-in duration-200">
        <div className="w-full max-w-sm space-y-6 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-error/10 ring-1 ring-red-500/25">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">{tDual("accessDeniedTitle", language)}</h2>
            <p className="mt-1.5 text-[14px] leading-relaxed text-error/90">{roleError}</p>
          </div>
          <div className="flex flex-col gap-3">
            <button
              onClick={() => setRoleError(null)}
              aria-label={tDual("tryAnotherAccountLink", language)}
              className="flex w-full items-center justify-center rounded-xl bg-brand px-6 py-3 text-[14px] font-bold text-surface transition-all duration-200 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
            >
              {tDual("tryAnotherAccountLink", language)}
            </button>
            <button
              onClick={() => navigate("/")}
              aria-label={tDual("backToLanding", language)}
              className="flex w-full items-center justify-center rounded-xl border border-border bg-muted/30 px-6 py-3 text-[14px] font-medium text-muted-foreground transition-all duration-200 hover:bg-muted/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/20"
            >
              {tDual("backToLanding", language)}
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ── Social-auth TOTP overlay ────────────────────────────────────────────── */
  if (pendingTwoFactor) {
    return (
      <ThemeProvider role="rider">
        <div className="flex min-h-screen flex-col items-center justify-center bg-page-bg px-6">
          <div className="w-full max-w-sm space-y-6 rounded-3xl border border-border bg-card p-8 shadow-2xl">
            <div className="space-y-1 text-center">
              <p className="text-2xl font-black text-foreground">
                {tDual("twoFactorRequired", language)}
              </p>
              <p className="text-sm text-muted-foreground">{tDual("subtitleTotp", language)}</p>
            </div>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={socialTotpCode}
              onChange={(e) => setSocialTotpCode(e.target.value.replace(/\D/g, ""))}
              placeholder="000000"
              aria-label={tDual("enterTotpCode", language)}
              className="w-full rounded-2xl border border-border bg-muted/20 px-4 py-3 text-center text-2xl font-mono tracking-[0.4em] text-foreground placeholder-muted-foreground/30 outline-none focus:border-brand/40 focus:ring-0"
            />
            {socialTotpError && (
              <p className="text-center text-sm text-error" role="alert">{socialTotpError}</p>
            )}
            <button
              disabled={socialTotpLoading || socialTotpCode.length < 6}
              onClick={() => { void handleSocialTotpSubmit(); }}
              aria-label={socialTotpLoading ? tDual("verifyingLabel", language) : tDual("verifyAndContinue", language)}
              className="w-full rounded-2xl bg-rider-primary py-3 text-sm font-bold text-surface disabled:opacity-40"
            >
              {socialTotpLoading ? tDual("verifyingLabel", language) : tDual("verifyAndContinue", language)}
            </button>
            <button
              onClick={() => { setPendingTwoFactor(null); setSocialTotpCode(""); setSocialTotpError(null); }}
              aria-label={tDual("back", language)}
              className="w-full text-center text-sm text-muted-foreground hover:text-foreground"
            >
              {tDual("back", language)}
            </button>
          </div>
        </div>
      </ThemeProvider>
    );
  }

  /* ── Biometric enrollment prompt ─────────────────────────────────────────── */
  if (enrollData) {
    return (
      <ThemeProvider role="rider">
        <BiometricEnrollOverlay onEnroll={handleEnrollAccept} onSkip={handleEnrollDecline} />
      </ThemeProvider>
    );
  }

  const translatedStrings = {
    phoneLabel: tDual("phoneNumber", language),
    continueBtn: tDual("continueBtn", language),
    back: tDual("back", language),
    newHere: tDual("noAccount", language),
    createAccount: tDual("createAccount", language),
    sendMagicLink: tDual("sendMagicLink", language),
    twoFactorLabel: tDual("enterTotpCode", language),
    subtitleTotp: tDual("subtitleTotp", language),
    subtitleLoginOtp: tDual("subtitleLoginOtp", language),
    usePasswordInstead: tDual("usePasswordInstead", language),
    useOtpInstead: tDual("useOtpInstead", language),
    useBackupCode: tDual("useBackupCode", language),
    useAuthAppInstead: tDual("useAuthAppInstead", language),
    trustDevice: tDual("trustDevice", language),
    emailLabel: tDual("emailAddress", language),
    sendingLabel: tDual("sendingLabel", language),
    sendOtpBtn: tDual("sendOtpBtn", language),
    verifyingLabel: tDual("verifyingLabel", language),
    resendInLabel: tDual("resendInLabel", language),
    changeEmailLink: tDual("changeEmail", language),
    invalidEmailError: tDual("enterValidEmail", language),
    incompleteOtpError: tDual("enterSixDigitCode", language),
    identifierRequiredError: tDual("enterIdentifier", language),
    identifierPlaceholder: tDual("enterIdentifierPlaceholder", language),
    identifierHint: tDual("identifierHint", language),
    tryAnotherAccountLink: tDual("tryAnotherAccountLink", language),
    biometricBtnLabel: tDual("loginWithBiometrics", language),
    magicLinkBtnLabel: tDual("magicLinkBtnLabel", language),
  };

  return (
    <div style={{ overflowY: "auto", maxHeight: "100vh" }}>
    <ThemeProvider role="rider" theme={riderTheme}>
      <SharedLoginScreen
        role="rider"
        logoSrc={import.meta.env.BASE_URL + "ajkmart-logo.png"}
        logoAlt="AJKMart"
        smartLogin
        enableBiometric={authConfig.biometricEnabled}
        enableSocial={authConfig.googleEnabled || authConfig.facebookEnabled}
        enableEmailOtp={authConfig.emailEnabled}
        enableMagicLinkModal={authConfig.magicLinkEnabled}
        loginMethodTabs={(() => {
          const tabs: Array<"otp" | "password" | "email"> = [];
          if (authConfig.phoneEnabled) tabs.push("otp");
          if (authConfig.usernamePassword) tabs.push("password");
          if (authConfig.emailEnabled) tabs.push("email");
          return tabs.length > 0 ? tabs : ["otp"];
        })()}
        captureDevOtp
        strings={translatedStrings}
        translateError={(raw) => {
          const map: Record<string, string> = {
            "account has been suspended": tDual("accountBlocked", language),
            "registrations are currently closed": tDual("registrationClosed", language),
            "social login is not configured": tDual("socialLoginNotConfigured", language),
            "session expired": tDual("sessionExpired", language),
            "invalid otp": tDual("invalidOtp", language),
            "invalid credentials": tDual("invalidCredentials", language),
            "linked to google": tDual("linkedToGoogle", language),
            "linked to facebook": tDual("linkedToFacebook", language),
            "not a rider account": tDual("wrongAppRider", language),
            "not registered as rider": tDual("wrongAppRider", language),
            "account is locked": tDual("loginLocked", language),
            "account_locked": tDual("loginLocked", language),
            "too many attempts": tDual("tooManyAttempts", language),
            "too_many_attempts": tDual("tooManyAttempts", language),
            "too many requests": tDual("rateLimitError", language),
          };
          const lc = raw.toLowerCase();
          const hit = Object.keys(map).find(k => lc.includes(k));
          return hit ? map[hit]! : raw;
        }}
        onSuccess={(user, token, refreshToken) => { void handleSuccess(user, token, refreshToken); }}
        onGoogle={authConfig.googleEnabled ? () => { void handleGoogle(); } : undefined}
        onFacebook={authConfig.facebookEnabled ? () => { void handleFacebook(); } : undefined}
        onBiometricSuccess={authConfig.biometricEnabled ? (tok) => { void handleBiometricSuccess(tok); } : undefined}
        onRegisterPress={() => navigate("/register")}
        googleLabel={tDual("signInWithGoogle", language)}
        facebookLabel={tDual("signInWithFacebook", language)}
        socialDividerLabel={tDual("orContinueWith", language)}
      />
      <div style={{ textAlign: "center", padding: "0 0 28px", marginTop: 8 }}>
        <span style={{ color: "rgba(255,255,255,0.65)", fontSize: 13.5 }}>
          {tDual("forgotUsername", language)}{" "}
          <a
            href="/forgot-username"
            onClick={(e) => { e.preventDefault(); navigate("/forgot-username"); }}
            style={{ color: riderTheme.primary, fontWeight: 600, textDecoration: "none" }}
          >
            {tDual("recoverUsername", language)}
          </a>
        </span>
      </div>
    </ThemeProvider>
    </div>
  );
}
