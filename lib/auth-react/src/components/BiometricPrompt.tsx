import { useEffect, useState } from "react";
import { useAuthTheme } from "../context/ThemeContext";

export interface BiometricPromptProps {
  /** Called when biometric auth succeeds — receives the stored refresh token */
  onSuccess: (refreshToken: string) => void;
  onDismiss?: () => void;
  /**
   * Called when the user taps "Continue with password to enroll" in the
   * `not-enrolled` state. Lets the host app navigate to the password step
   * with enrollment intent. Falls back to `onDismiss` when not provided.
   */
  onEnrollPress?: () => void;
  /**
   * Called when no stored token is found after a *successful* biometric auth.
   * Receives a `storeToken` function so the caller can supply and persist
   * a token (e.g. after a password login). If not provided, the component
   * shows a "Set up biometrics" CTA with instructions.
   */
  onEnroll?: (storeToken: (token: string) => Promise<void>) => Promise<void>;
  label?: string;
  className?: string;
  storageKey?: string;
}

type BiometricState =
  | "checking"
  | "unavailable"
  | "web-unsupported"
  | "not-enrolled"
  | "enrolling"
  | "ready"
  | "prompting"
  | "success"
  | "error";

/** Structured result from the native biometric + secure-store flow */
type NativeAuthResult =
  | { status: "success"; token: string }
  | { status: "auth-failed" } // biometric dismissed / cancelled / failed
  | { status: "token-missing" } // biometric passed, but no token in secure store
  | { status: "unavailable" }; // Expo LocalAuth module not present

function isNativeBiometricAvailable(): boolean {
  const g = globalThis as Record<string, unknown>;
  return !!(g["__ExpoLocalAuthentication"] || g["ExpoModulesCore"]);
}

function isWebAuthnAvailable(): boolean {
  return typeof window !== "undefined" && "PublicKeyCredential" in window;
}

async function storeTokenInSecureStore(key: string, token: string): Promise<void> {
  const g = globalThis as Record<string, unknown>;
  const SecureStore = g["__ExpoSecureStore"] as
    | { setItemAsync: (k: string, v: string) => Promise<void> }
    | undefined;
  if (SecureStore) await SecureStore.setItemAsync(key, token);
}

/**
 * Attempt native biometric authentication and return a structured result.
 * Distinct outcomes:
 *   - `unavailable`    — Expo LocalAuth module not registered
 *   - `auth-failed`    — biometric prompt shown but user canceled / failed
 *   - `token-missing`  — biometric succeeded, but no token in secure store yet
 *   - `success`        — biometric succeeded and token retrieved
 */
async function authenticateNative(storageKey: string): Promise<NativeAuthResult> {
  const g = globalThis as Record<string, unknown>;
  const LocalAuth = g["__ExpoLocalAuthentication"] as
    | { authenticateAsync: (opts: { promptMessage: string }) => Promise<{ success: boolean }> }
    | undefined;

  if (!LocalAuth) return { status: "unavailable" };

  const result = await LocalAuth.authenticateAsync({
    promptMessage: "Authenticate to sign in",
  });

  if (!result.success) return { status: "auth-failed" };

  // Biometric passed — now try to retrieve the stored token
  const SecureStore = g["__ExpoSecureStore"] as
    | { getItemAsync: (k: string) => Promise<string | null> }
    | undefined;

  const token = SecureStore ? await SecureStore.getItemAsync(storageKey) : null;

  return token ? { status: "success", token } : { status: "token-missing" };
}

export function BiometricPrompt({
  onSuccess,
  onDismiss,
  onEnrollPress,
  onEnroll,
  label = "Sign in with biometrics",
  className,
  storageKey = "ajk_refresh_token_biometric",
}: BiometricPromptProps) {
  const t = useAuthTheme();
  const [state, setState] = useState<BiometricState>("checking");
  const [errorMsg, setErrorMsg] = useState("");

  const s = {
    card: {
      display: "flex",
      flexDirection: "column" as const,
      alignItems: "center",
      gap: "16px",
      padding: "28px 24px",
      border: `1.5px solid ${t.border}`,
      borderRadius: "16px",
      background: t.surface,
      textAlign: "center" as const,
      maxWidth: "340px",
      margin: "0 auto",
      boxShadow: `0 8px 48px ${t.primary}10`,
    },
    icon: { fontSize: "40px", lineHeight: 1 },
    title: { fontSize: "16px", fontWeight: 700, color: t.text, margin: 0 },
    subtitle: { fontSize: "13px", color: t.textMuted, margin: 0 },
    btnPrimary: {
      width: "100%",
      padding: "13px",
      borderRadius: "12px",
      border: "none",
      background: `linear-gradient(135deg, ${t.primary}, ${t.primaryDark})`,
      color: t.onPrimary,
      fontWeight: 700,
      fontSize: "14px",
      cursor: "pointer",
      transition: "opacity 0.15s, filter 0.15s",
    },
    btnSecondary: {
      background: "none",
      border: "none",
      color: t.textMuted,
      fontSize: "13px",
      cursor: "pointer",
      padding: "4px 0",
      transition: "color 0.15s",
    },
    errorText: { fontSize: "13px", color: t.error, margin: 0 },
  };

  useEffect(() => {
    if (isNativeBiometricAvailable()) {
      setState("ready");
    } else if (isWebAuthnAvailable()) {
      // WebAuthn is present in the browser but full server-challenge integration
      // is not yet implemented — surface a clear message instead of silently
      // returning null.
      setState("web-unsupported");
    } else {
      setState("unavailable");
    }
  }, []);

  async function handlePrompt() {
    setState("prompting");
    setErrorMsg("");
    try {
      const result = await authenticateNative(storageKey);

      switch (result.status) {
        case "success":
          setState("success");
          onSuccess(result.token);
          break;

        case "auth-failed":
          // Biometric prompt was shown but the user canceled or failed —
          // stay on the error/retry path, never trigger enrollment.
          setState("error");
          setErrorMsg("Biometric authentication failed or was cancelled. Please try again.");
          break;

        case "token-missing":
          // Biometric auth *succeeded* but there is no stored token yet.
          // This is the enrollment case: offer to set one up.
          if (onEnroll) {
            setState("enrolling");
            const storeToken = async (newToken: string) => {
              await storeTokenInSecureStore(storageKey, newToken);
            };
            await onEnroll(storeToken);
            setState("ready");
          } else {
            setState("not-enrolled");
          }
          break;

        case "unavailable":
          // Native module disappeared between mount and prompt — surface as error
          setState("error");
          setErrorMsg("Biometric authentication is no longer available.");
          break;
      }
    } catch (err) {
      setState("error");
      setErrorMsg(err instanceof Error ? err.message : "Authentication failed");
    }
  }

  if (state === "checking") return null;

  if (state === "unavailable") {
    return (
      <div style={s.card} className={className}>
        <span style={s.icon}><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={t.textMuted} strokeWidth="2" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></span>
        <p style={s.title}>Biometrics unavailable</p>
        <p style={s.subtitle}>Biometric authentication is not available on this device.</p>
        {onDismiss && (
          <button type="button" style={s.btnSecondary} onClick={onDismiss}>
            Use another method
          </button>
        )}
      </div>
    );
  }

  if (state === "web-unsupported") {
    return (
      <div style={s.card} className={className}>
        <span style={s.icon}><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={t.textMuted} strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg></span>
        <p style={s.title}>Not supported in this browser</p>
        <p style={s.subtitle}>
          Biometric sign-in requires the native app. Use the AJKMart app on your phone to enable
          fingerprint or face login.
        </p>
        {onDismiss && (
          <button type="button" style={s.btnSecondary} onClick={onDismiss}>
            Use password instead
          </button>
        )}
      </div>
    );
  }

  if (state === "not-enrolled") {
    return (
      <div style={s.card} className={className}>
        <span style={s.icon}><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={t.textMuted} strokeWidth="2" strokeLinecap="round"><path d="M12 2a10 10 0 0 0-10 10c0 5.523 4.477 10 10 10s10-4.477 10-10A10 10 0 0 0 12 2z"/><path d="M12 6v6l4 2"/></svg></span>
        <p style={s.title}>Set up biometrics</p>
        <p style={s.subtitle}>
          No biometric credential is stored yet. Sign in with your password first to enable
          fingerprint or face login.
        </p>
        <button
          type="button"
          style={s.btnPrimary}
          onClick={onEnrollPress ?? onDismiss}
          aria-label="Continue with password to enroll biometrics"
        >
          Continue with password to enroll
        </button>
        <button
          type="button"
          style={s.btnSecondary}
          onClick={onDismiss}
          aria-label="Dismiss biometric enrollment"
        >
          Maybe later
        </button>
      </div>
    );
  }

  return (
    <div style={s.card} className={className}>
      <span style={s.icon}>
        {state === "success" ? (
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={t.success ?? "#22C55E"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="9 12 11 14 15 10"/></svg>
        ) : state === "enrolling" ? (
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={t.warning ?? t.primary} strokeWidth="2" strokeLinecap="round"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
        ) : (
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={t.textMuted} strokeWidth="2" strokeLinecap="round"><path d="M12 2a10 10 0 0 0-10 10c0 5.523 4.477 10 10 10s10-4.477 10-10A10 10 0 0 0 12 2z"/><path d="M12 6v6l4 2"/></svg>
        )}
      </span>
      <p style={s.title}>{label}</p>
      <p style={s.subtitle}>
        {state === "prompting"
          ? "Waiting for biometric…"
          : state === "enrolling"
            ? "Setting up biometrics…"
            : state === "success"
              ? "Authenticated!"
              : "Use fingerprint or face recognition to sign in quickly."}
      </p>
      {state === "error" && <p style={s.errorText}>{errorMsg}</p>}
      {(state === "ready" || state === "error") && (
        <button type="button" style={s.btnPrimary} onClick={() => void handlePrompt()}>
          {state === "error" ? "Try again" : "Authenticate"}
        </button>
      )}
      {onDismiss && state !== "prompting" && state !== "enrolling" && state !== "success" && (
        <button type="button" style={s.btnSecondary} onClick={onDismiss}>
          Use password instead
        </button>
      )}
    </div>
  );
}
