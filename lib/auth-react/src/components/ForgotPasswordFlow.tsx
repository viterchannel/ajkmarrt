import { useEffect, useState } from "react";
import { useAuthTheme } from "../context/ThemeContext";
import { useRateLimitCountdown } from "../hooks/useRateLimitCountdown";
import { useForgotPasswordFlow, type UseForgotPasswordFlowOptions } from "../hooks/useForgotPasswordFlow";
import { OtpInput } from "./OtpInput";
import { PasswordInput } from "./PasswordInput";

export interface ForgotPasswordStrings {
  title: string;
  chooseMethod: string;
  phoneMethod: string;
  emailMethod: string;
  sendOtp: string;
  enterOtp: string;
  resendOtp: string;
  newPassword: string;
  confirmPassword: string;
  passwordsNoMatch: string;
  submit: string;
  success: string;
  successSubtitle: string;
  goToSignIn: string;
  redirectingIn: string;
  twoFactorTitle: string;
  backBtn: string;
  phoneLabel: string;
  emailLabel: string;
  minPasswordHint: string;
  repeatPasswordHint: string;
  backupCodeLabel: string;
  verifyBtn: string;
  totpSubtitle: string;
  minPasswordError: string;
}

const DEFAULT_STRINGS: ForgotPasswordStrings = {
  title: "Reset Password",
  chooseMethod: "How would you like to reset your password?",
  phoneMethod: "Phone OTP",
  emailMethod: "Email OTP",
  sendOtp: "Send OTP",
  enterOtp: "Enter the 6-digit OTP sent to you",
  resendOtp: "Resend OTP",
  newPassword: "New Password",
  confirmPassword: "Confirm Password",
  passwordsNoMatch: "Passwords do not match",
  submit: "Reset Password",
  success: "Password reset successfully!",
  successSubtitle: "You can now sign in with your new password.",
  goToSignIn: "Go to Sign In",
  redirectingIn: "Redirecting in",
  twoFactorTitle: "Two-Factor Verification",
  backBtn: "← Back",
  phoneLabel: "Phone Number",
  emailLabel: "Email Address",
  minPasswordHint: "Min 8 characters",
  repeatPasswordHint: "Repeat your password",
  backupCodeLabel: "Or enter backup code",
  verifyBtn: "Verify",
  totpSubtitle: "Enter the 6-digit code from your authenticator app",
  minPasswordError: "Password must be at least 8 characters",
};

export interface ForgotPasswordFlowProps extends UseForgotPasswordFlowOptions {
  logoSrc?: string;
  logoAlt?: string;
  strings?: Partial<ForgotPasswordStrings>;
}

function SpinIcon() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      style={{ flexShrink: 0 }}
    >
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83">
        <animateTransform
          attributeName="transform"
          type="rotate"
          from="0 12 12"
          to="360 12 12"
          dur="0.8s"
          repeatCount="indefinite"
        />
      </path>
    </svg>
  );
}

function CheckIcon({ color }: { color: string }) {
  return (
    <svg
      width="56"
      height="56"
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="9 12 11 14 15 10" />
    </svg>
  );
}

export function ForgotPasswordFlow({
  role,
  api,
  onSuccess,
  logoSrc,
  logoAlt,
  strings: customStrings,
}: ForgotPasswordFlowProps) {
  const theme = useAuthTheme();
  const S = { ...DEFAULT_STRINGS, ...customStrings };

  useEffect(() => {
    const id = "auth-shared-keyframes";
    if (typeof document !== "undefined" && !document.getElementById(id)) {
      const style = document.createElement("style");
      style.id = id;
      style.textContent = `
        @keyframes auth-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes auth-fade-in { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
        .auth-input:focus-visible, .auth-input:focus { outline: none; border-color: var(--auth-focus, currentColor); box-shadow: 0 0 0 3px var(--auth-focus-ring, rgba(0,0,0,0.08)); }
        .auth-input-wrapper:focus-within { border-color: var(--auth-focus, currentColor); box-shadow: 0 0 0 3px var(--auth-focus-ring, rgba(0,0,0,0.08)); }
      `;
      document.head.appendChild(style);
    }
  }, []);

  const { step, method, loading, error, actions } = useForgotPasswordFlow({
    role,
    api,
    onSuccess,
  });

  const { isRateLimited, secondsLeft, triggerRateLimit } = useRateLimitCountdown();

  const [contact, setContact] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [totpCode, setTotpCode] = useState("");

  const REDIRECT_SECONDS = 5;
  const [countdown, setCountdown] = useState(REDIRECT_SECONDS);

  useEffect(() => {
    if (step !== "success") return;
    setCountdown(REDIRECT_SECONDS);
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          onSuccess?.();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [step]);

  const displayError = localError ?? error;

  const pageStyle: React.CSSProperties = {
    minHeight: "100vh",
    background: theme.background,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "24px 16px",
  };

  const cardStyle: React.CSSProperties = {
    background: theme.surface,
    border: `1px solid ${theme.border}`,
    borderRadius: 20,
    padding: "28px 24px",
    width: "100%",
    maxWidth: 420,
    boxShadow: `0 20px 60px ${theme.primary}12`,
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    height: 48,
    padding: "0 16px",
    borderRadius: 12,
    background: theme.background,
    border: `1.5px solid ${theme.border}`,
    color: theme.text,
    fontSize: 14,
    outline: "none",
    boxSizing: "border-box",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: theme.primary,
    marginBottom: 6,
  };

  function primaryBtn(disabled = false): React.CSSProperties {
    return {
      width: "100%",
      height: 48,
      borderRadius: 12,
      border: "none",
      background: disabled
        ? `${theme.primary}60`
        : `linear-gradient(135deg, ${theme.primary}, ${theme.primaryDark})`,
      color: theme.onPrimary,
      fontSize: 15,
      fontWeight: 700,
      cursor: disabled ? "not-allowed" : "pointer",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      opacity: disabled ? 0.7 : 1,
    };
  }

  const logoEl = logoSrc ? (
    <img
      src={logoSrc}
      alt={logoAlt ?? "Logo"}
      style={{ height: 40, objectFit: "contain", marginBottom: 20, display: "block", margin: "0 auto 20px" }}
    />
  ) : null;

  const errorBox = displayError ? (
    <div
      role="alert"
      style={{
        background: theme.errorBackground,
        border: `1px solid ${theme.errorBorder}`,
        borderRadius: 10,
        padding: "12px 14px",
        marginBottom: 14,
        fontSize: 13,
        color: theme.error,
        display: "flex",
        alignItems: "center",
        gap: 8,
        lineHeight: 1.4,
      }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ flexShrink: 0, marginTop: 1 }}>
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      <span>{displayError}</span>
    </div>
  ) : null;

  /* ── Step: choose-method ──────────────────────────────────────────────── */
  if (step === "choose-method") {
    return (
      <div style={pageStyle}>
        <div style={cardStyle}>
          {logoEl}
          <h2 style={{ color: theme.text, fontSize: 20, fontWeight: 800, margin: "0 0 6px", textAlign: "center" }}>
            {S.title}
          </h2>
          <p style={{ color: theme.textMuted, fontSize: 14, textAlign: "center", margin: "0 0 24px", lineHeight: 1.5 }}>
            {S.chooseMethod}
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <button
              onClick={() => actions.selectMethod("phone")}
              style={{
                padding: "14px 20px",
                borderRadius: 12,
                border: `2px solid ${method === "phone" ? theme.primary : theme.border}`,
                background: method === "phone" ? `${theme.primary}12` : theme.surface,
                color: theme.text,
                fontSize: 15,
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={method === "phone" ? theme.primary : theme.textMuted} strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0 }}>
                <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
                <line x1="12" y1="18" x2="12.01" y2="18" />
              </svg>
              {S.phoneMethod}
            </button>
            <button
              onClick={() => actions.selectMethod("email")}
              style={{
                padding: "14px 20px",
                borderRadius: 12,
                border: `2px solid ${method === "email" ? theme.primary : theme.border}`,
                background: method === "email" ? `${theme.primary}12` : theme.surface,
                color: theme.text,
                fontSize: 15,
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={method === "email" ? theme.primary : theme.textMuted} strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0 }}>
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                <polyline points="22,6 12,13 2,6" />
              </svg>
              {S.emailMethod}
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ── Step: send-otp ───────────────────────────────────────────────────── */
  if (step === "send-otp") {
    const isDisabled = loading || isRateLimited;

    async function handleSend() {
      setLocalError(null);
      if (!contact.trim()) {
        setLocalError(method === "phone" ? S.phoneLabel : S.emailLabel);
        return;
      }
      try {
        await actions.sendOtp(contact.trim());
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Failed to send OTP";
        const status = (e as Record<string, unknown>)?.status as number | undefined;
        if (status === 429 || /rate limit|too many/i.test(msg)) {
          triggerRateLimit(60);
        }
      }
    }

    return (
      <div style={pageStyle}>
        <div style={cardStyle}>
          {logoEl}
          <button
            onClick={actions.reset}
            style={{ background: "none", border: "none", color: theme.textMuted, fontSize: 13, cursor: "pointer", marginBottom: 16, padding: 0, display: "flex", alignItems: "center", gap: 4 }}
          >
            {S.backBtn}
          </button>
          <h2 style={{ color: theme.text, fontSize: 20, fontWeight: 800, margin: "0 0 20px" }}>
            {S.title}
          </h2>
          {errorBox}
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>{method === "phone" ? S.phoneLabel : S.emailLabel}</label>
            <input
              type={method === "phone" ? "tel" : "email"}
              value={contact}
              onChange={(e) => { setContact(e.target.value); setLocalError(null); }}
              placeholder={method === "phone" ? "03XXXXXXXXX" : "your@email.com"}
              style={inputStyle}
              className="auth-input"
              disabled={isDisabled}
            />
          </div>
          {isRateLimited && (
            <p style={{ color: theme.error, fontSize: 13, marginBottom: 10 }}>
              Too many attempts. Try again in {secondsLeft}s
            </p>
          )}
          <button
            onClick={handleSend}
            disabled={isDisabled}
            style={primaryBtn(isDisabled)}
          >
            {loading ? <SpinIcon /> : null} {S.sendOtp}
          </button>
        </div>
      </div>
    );
  }

  /* ── Step: enter-otp ──────────────────────────────────────────────────── */
  if (step === "enter-otp") {
    async function handleOtpComplete(otp: string) {
      setLocalError(null);
      await actions.verifyOtp(otp);
    }

    async function handleResend() {
      setLocalError(null);
      await actions.sendOtp(contact.trim());
    }

    return (
      <div style={pageStyle}>
        <div style={cardStyle}>
          {logoEl}
          <button
            onClick={() => actions.reset()}
            style={{ background: "none", border: "none", color: theme.textMuted, fontSize: 13, cursor: "pointer", marginBottom: 16, padding: 0, display: "flex", alignItems: "center", gap: 4 }}
          >
            {S.backBtn}
          </button>
          <h2 style={{ color: theme.text, fontSize: 20, fontWeight: 800, margin: "0 0 8px", textAlign: "center" }}>
            {S.title}
          </h2>
          <p style={{ color: theme.textMuted, fontSize: 14, textAlign: "center", margin: "0 0 24px" }}>
            {S.enterOtp}
          </p>
          {errorBox}
          <OtpInput
            length={6}
            onComplete={handleOtpComplete}
            onResend={handleResend}
            resendCooldown={60}
            isLoading={loading}
            error={displayError}
            autoSubmit={false}
          />
        </div>
      </div>
    );
  }

  /* ── Step: new-password ───────────────────────────────────────────────── */
  if (step === "new-password") {
    async function handleSubmit() {
      setLocalError(null);
      if (password.length < 8) {
        setLocalError(S.minPasswordError);
        return;
      }
      if (password !== confirm) {
        setLocalError(S.passwordsNoMatch);
        return;
      }
      await actions.setNewPassword(password);
    }

    return (
      <div style={pageStyle}>
        <div style={cardStyle}>
          {logoEl}
          <h2 style={{ color: theme.text, fontSize: 20, fontWeight: 800, margin: "0 0 20px" }}>
            {S.title}
          </h2>
          {errorBox}
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>{S.newPassword}</label>
            <PasswordInput
              value={password}
              onChange={setPassword}
              showStrength
              placeholder={S.minPasswordHint}
              autoComplete="new-password"
              disabled={loading}
            />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>{S.confirmPassword}</label>
            <PasswordInput
              value={confirm}
              onChange={setConfirm}
              placeholder={S.repeatPasswordHint}
              autoComplete="new-password"
              disabled={loading}
            />
          </div>
          <button onClick={handleSubmit} disabled={loading} style={primaryBtn(loading)}>
            {loading ? <SpinIcon /> : null} {S.submit}
          </button>
        </div>
      </div>
    );
  }

  /* ── Step: totp-verify ────────────────────────────────────────────────── */
  if (step === "totp-verify") {
    async function handleTotpComplete(code: string) {
      setLocalError(null);
      await actions.verifyTotp(code);
    }

    return (
      <div style={pageStyle}>
        <div style={cardStyle}>
          {logoEl}
          <h2 style={{ color: theme.text, fontSize: 20, fontWeight: 800, margin: "0 0 8px", textAlign: "center" }}>
            {S.twoFactorTitle}
          </h2>
          <p style={{ color: theme.textMuted, fontSize: 14, textAlign: "center", margin: "0 0 24px" }}>
            {S.totpSubtitle}
          </p>
          {errorBox}
          <OtpInput
            length={6}
            onComplete={handleTotpComplete}
            isLoading={loading}
            error={displayError}
            autoSubmit={false}
          />
          <div style={{ marginTop: 16 }}>
            <label style={labelStyle}>{S.backupCodeLabel}</label>
            <input
              type="text"
              value={totpCode}
              onChange={(e) => setTotpCode(e.target.value)}
              placeholder="xxxxxxxx-xxxx-xxxx"
              style={inputStyle}
              disabled={loading}
            />
            <button
              onClick={() => handleTotpComplete(totpCode)}
              disabled={loading || !totpCode}
              style={{ ...primaryBtn(loading || !totpCode), marginTop: 10 }}
            >
              {loading ? <SpinIcon /> : null} {S.verifyBtn}
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ── Step: success ────────────────────────────────────────────────────── */
  if (step === "success") {
    return (
      <div style={pageStyle}>
        <div style={{ ...cardStyle, textAlign: "center" }}>
          {logoEl}
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
            <CheckIcon color={theme.primary} />
          </div>
          <h2 style={{ color: theme.text, fontSize: 22, fontWeight: 800, margin: "0 0 10px" }}>
            {S.success}
          </h2>
          <p style={{ color: theme.textMuted, fontSize: 14, lineHeight: 1.6, margin: "0 0 24px" }}>
            {S.successSubtitle}
          </p>
          <button
            onClick={() => onSuccess?.()}
            style={primaryBtn(false)}
          >
            {S.goToSignIn}
          </button>
          <p style={{ color: theme.textMuted, fontSize: 12, marginTop: 14 }}>
            {S.redirectingIn} {countdown}s…
          </p>
        </div>
      </div>
    );
  }

  return null;
}
