import { useEffect, useRef, useState, type FormEvent } from "react";
import type { AuthUser } from "../AuthProvider";

function SpinIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      style={{ flexShrink: 0, animation: "auth-spin 0.8s linear infinite" }}
    >
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  );
}
import { useAuthTheme } from "../context/ThemeContext";
import { useLoginFlow } from "../hooks/useLoginFlow";
import { BiometricEnrollOverlay } from "./AuthOverlay";
import { BiometricPrompt } from "./BiometricPrompt";
import { OtpInput } from "./OtpInput";
import { PasswordInput } from "./PasswordInput";
import { PhoneInput } from "./PhoneInput";
import { SocialButtons } from "./SocialButtons";

export type AppRole = "customer" | "rider" | "vendor" | "admin";

export type CustomField = "vehicleType" | "licenseNumber" | "storeName" | "cnic" | "businessType";

/** All UI strings displayed by the login screen — pass translated values to localise */
export interface LoginScreenStrings {
  phoneLabel: string;
  phonePlaceholder: string;
  continueBtn: string;
  checkingBtn: string;
  passwordLabel: string;
  signInBtn: string;
  signingInBtn: string;
  subtitleIdentifier: string;
  subtitleOtp: string;
  subtitlePassword: string;
  subtitleTwoFactor: string;
  changeNumber: string;
  back: string;
  newHere: string;
  createAccount: string;
  sendMagicLink: string;
  magicLinkSending: string;
  magicLinkSent: string;
  twoFactorLabel: string;
  enterPhoneError: string;
  enterPasswordError: string;
  /** Label/subtitle shown on the TOTP 2FA step */
  subtitleTotp?: string;
  /** Label shown on the login-OTP second-step */
  subtitleLoginOtp?: string;
  /** Authenticator code input label */
  totpLabel?: string;
  /** Link to switch to password from OTP */
  usePasswordInstead?: string;
  /** Link to switch to OTP from password */
  useOtpInstead?: string;
  /** Backup code toggle link (shown when TOTP) */
  useBackupCode?: string;
  /** Backup code toggle link (shown when using backup) */
  useAuthAppInstead?: string;
  /** Trust-device checkbox label */
  trustDevice?: string;
  /** "Forgot password?" link label */
  forgotPasswordLabel?: string;
  /** Heading for the 2FA authenticator step */
  twoFactorAuth?: string;
  /** Label for the authenticator code input */
  enterAuthCode?: string;
  /** Placeholder for the backup code text input */
  backupCodePlaceholder?: string;
  /** Label for email address input field */
  emailLabel?: string;
  /** Loading state label while sending OTP */
  sendingLabel?: string;
  /** Button label for sending email OTP */
  sendOtpBtn?: string;
  /** Loading state label while verifying OTP */
  verifyingLabel?: string;
  /** Cooldown label shown before resend is allowed — use {n} as seconds placeholder */
  resendInLabel?: string;
  /** Link to go back and change email */
  changeEmailLink?: string;
  /** Validation error for invalid email */
  invalidEmailError?: string;
  /** Validation error for incomplete OTP */
  incompleteOtpError?: string;
  /** Validation error when identifier is empty (smart login) */
  identifierRequiredError?: string;
  /** Label for the identifier input in smart login mode */
  identifierPlaceholder?: string;
  /** Placeholder hint for the identifier input in smart login mode */
  identifierHint?: string;
  /** "← Try another account" link shown on OTP and password steps in smart login mode */
  tryAnotherAccountLink?: string;
  /** Biometric prompt label */
  biometricBtnLabel?: string;
  /** Inline magic link panel heading */
  magicLinkBtnLabel?: string;
}

const DEFAULT_STRINGS: LoginScreenStrings = {
  phoneLabel: "Phone number",
  phonePlaceholder: "Enter phone number",
  continueBtn: "Continue",
  checkingBtn: "Checking…",
  passwordLabel: "Password",
  signInBtn: "Sign in",
  signingInBtn: "Signing in…",
  subtitleIdentifier: "Sign in or create an account",
  subtitleOtp: "Enter the OTP sent to your number",
  subtitlePassword: "Enter your password",
  subtitleTwoFactor: "Two-factor authentication",
  changeNumber: "← Change number",
  back: "← Back",
  newHere: "New here?",
  createAccount: "Create account",
  sendMagicLink: "Send magic link instead",
  magicLinkSending: "Sending…",
  magicLinkSent: "Magic link sent — check your email or SMS.",
  twoFactorLabel: "Enter your authenticator code",
  enterPhoneError: "Please enter your phone number",
  enterPasswordError: "Please enter your password",
  twoFactorAuth: "Two-factor authentication",
  enterAuthCode: "Enter your authenticator code",
  backupCodePlaceholder: "Enter backup code",
  emailLabel: "Email address",
  sendingLabel: "Sending…",
  sendOtpBtn: "Send OTP",
  verifyingLabel: "Verifying…",
  resendInLabel: "Resend in {n}s",
  changeEmailLink: "← Change email",
  invalidEmailError: "Enter a valid email address",
  incompleteOtpError: "Enter the complete 6-digit OTP",
  identifierRequiredError: "Please enter your phone, email, or username",
  identifierPlaceholder: "Phone, email, or username",
  identifierHint: "e.g. 03001234567 or name@example.com",
  tryAnotherAccountLink: "← Try another account",
  biometricBtnLabel: "Sign in with biometrics",
  magicLinkBtnLabel: "Sign in with magic link",
};

export interface LoginScreenProps {
  role: AppRole;
  customFields?: CustomField[];
  baseURL?: string;
  onSuccess?: (user: AuthUser, token: string, refreshToken?: string) => void;
  /** Called when an OTP is sent; receives the devOtp string if present in the response (dev only) */
  onOtpSent?: (devOtp?: string) => void;
  onRegisterPress?: () => void;
  enableSocial?: boolean;
  enableMagicLink?: boolean;
  enableBiometric?: boolean;
  onGoogle?: () => void;
  onFacebook?: () => void;
  onMagicLink?: (identifier: string) => void | Promise<void>;
  onBiometricSuccess?: (refreshToken: string) => void;
  className?: string;
  title?: string;
  /** Partial override of any UI string — merged with English defaults */
  strings?: Partial<LoginScreenStrings>;
  /** Translate raw API error messages into the active language */
  translateError?: (raw: string) => string;

  /* ── New optional props (all undefined/false by default) ── */
  /** Logo image URL — shown above the form when provided */
  logoSrc?: string;
  /** Alt text for the logo image (default: "App Logo") */
  logoAlt?: string;
  /** Show Email OTP tab in the method switcher */
  enableEmailOtp?: boolean;
  /** Show inline magic link panel (email input + send button) */
  enableMagicLinkModal?: boolean;
  /** Dev OTP to display in a banner (only rendered when import.meta.env.DEV is true) */
  devOtp?: string;
  /** Controls tab order and visibility — default: ["otp", "password"] */
  loginMethodTabs?: Array<"otp" | "password" | "email">;
  /** Called when user declines biometric enrollment prompt */
  onBiometricEnrollDecline?: () => void;
  /**
   * B2B-style smart flow: single identifier field (phone/email/username),
   * auto-detect type, then show primary method with fallbacks.
   * When false (default), legacy tab-based UI is shown.
   */
  smartLogin?: boolean;
  /** Which social provider is currently loading — maps to per-provider loading state in SocialButtons */
  socialLoadingProvider?: "google" | "facebook" | null;
  /** Translated label for the Google sign-in button (defaults to "Sign in with Google") */
  googleLabel?: string;
  /** Translated label for the Facebook sign-in button (defaults to "Sign in with Facebook") */
  facebookLabel?: string;
  /** Translated label for the social divider (defaults to "Or continue with") */
  socialDividerLabel?: string;

  /* ── Post-auth orchestration (optional) ── */
  /** Google Client ID — when provided the shared component loads GSI and handles social auth internally */
  googleClientId?: string;
  /** Facebook App ID — when provided the shared component loads the FB SDK and handles social auth internally */
  facebookAppId?: string;
  /** Href for the "Forgot password?" link shown on the password step. Defaults to "/forgot-password". Set to null to hide the link. */
  forgotPasswordHref?: string | null;
  /** Fetch authoritative server profile after raw auth — receives the raw access token */
  fetchProfile?: (token: string) => Promise<unknown>;
  /** Validate the fetched profile; return an error string to reject, null to allow */
  roleValidator?: (profile: unknown) => string | null;
  /** Called when roleValidator rejects — use to clear any tokens already stored */
  onRoleRejected?: () => void;
  /** Check whether biometric is available and already enrolled */
  checkBiometricStatus?: () => Promise<{ available: boolean; enrolled: boolean }>;
  /** Enroll the device biometric — called with the refreshToken after successful login */
  enrollBiometric?: (refreshToken: string) => Promise<void>;
  /** When true the component captures devOtp internally (no need to manage devOtp state in the wrapper) */
  captureDevOtp?: boolean;
}

const ROLE_LABELS: Record<AppRole, string> = {
  customer: "AJKMart",
  rider: "Rider Portal",
  vendor: "Vendor Portal",
  admin: "Admin Panel",
};

type Step = "identifier" | "otp" | "password" | "twoFactor";
type LoginMode = "otp" | "password" | "email";

const EMAIL_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

export function LoginScreen({
  role,
  customFields = [],
  baseURL = "",
  onSuccess,
  onOtpSent,
  onRegisterPress,
  enableSocial = false,
  enableMagicLink = false,
  enableBiometric = false,
  onGoogle,
  onFacebook,
  onMagicLink,
  onBiometricSuccess,
  className,
  title,
  strings: stringOverrides,
  translateError,
  logoSrc,
  logoAlt,
  enableEmailOtp = false,
  enableMagicLinkModal = false,
  devOtp,
  loginMethodTabs,
  onBiometricEnrollDecline,
  smartLogin = false,
  socialLoadingProvider,
  googleLabel,
  facebookLabel,
  socialDividerLabel,
  googleClientId,
  facebookAppId,
  fetchProfile,
  roleValidator,
  onRoleRejected,
  checkBiometricStatus,
  enrollBiometric,
  captureDevOtp = false,
  forgotPasswordHref = "/forgot-password",
}: LoginScreenProps) {
  const theme = useAuthTheme();
  const displayTitle = title ?? ROLE_LABELS[role];
  const str: LoginScreenStrings = { ...DEFAULT_STRINGS, ...stringOverrides };

  /* ── Resolve active tab list ── */
  const resolvedTabs: LoginMode[] = (() => {
    const base: LoginMode[] = loginMethodTabs ? [...loginMethodTabs] : ["otp", "password"];
    if (enableEmailOtp && !base.includes("email")) base.push("email");
    return base;
  })();
  const showTabs = resolvedTabs.length > 1;

  /* Edge case: if admin disabled all login methods, still render with the first
     available fallback so the UI doesn't break. */
  const fallbackMode: LoginMode = resolvedTabs[0] ?? "otp";

  const [step, setStep] = useState<Step>("identifier");
  const [loginMode, setLoginMode] = useState<LoginMode>(resolvedTabs[0] ?? "otp");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [customValues, setCustomValues] = useState<Record<string, string>>({});
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [magicLinkLoading, setMagicLinkLoading] = useState(false);

  /* ── Smart-login state ── */
  const [smartIdType, setSmartIdType] = useState<"phone" | "email" | "username" | null>(null);
  const [smartMethods, setSmartMethods] = useState<string[]>([]);

  /* ── Email OTP state ── */
  const [emailAddress, setEmailAddress] = useState("");
  const [emailOtp, setEmailOtp] = useState("");
  const [emailOtpSent, setEmailOtpSent] = useState(false);
  const [emailSending, setEmailSending] = useState(false);
  const [emailVerifying, setEmailVerifying] = useState(false);
  const [emailResendCooldown, setEmailResendCooldown] = useState(0);
  const [emailError, setEmailError] = useState<string | null>(null);

  /* ── Inline magic link modal state ── */
  const [magicEmail, setMagicEmail] = useState("");
  const [magicSent, setMagicSent] = useState(false);
  const [magicSending, setMagicSending] = useState(false);

  /* ── Post-auth orchestration state ── */
  const [roleError, setRoleError] = useState<string | null>(null);
  const [enrollPending, setEnrollPending] = useState<{
    token: string; refreshToken: string; profile: unknown;
  } | null>(null);
  const [internalDevOtp, setInternalDevOtp] = useState<string | undefined>(undefined);
  const [socialLoading, setSocialLoading] = useState<"google" | "facebook" | null>(null);

  /* ── TOTP backup-code / trust-device state ── */
  const [useBackup, setUseBackup] = useState(false);
  const [backupCodeInput, setBackupCodeInput] = useState("");
  const [trustDevice, setTrustDevice] = useState(false);
  const [backupVerifying, setBackupVerifying] = useState(false);

  /* Guard: window is not defined in React Native / Expo environments.
     Default to false (narrow layout) when window is unavailable. */
  const [isWide, setIsWide] = useState(
    typeof window !== "undefined" ? window.innerWidth >= 768 : false
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    function onResize() {
      setIsWide(window.innerWidth >= 768);
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (emailResendCooldown <= 0) return;
    const timer = setTimeout(() => setEmailResendCooldown((v) => v - 1), 1000);
    return () => clearTimeout(timer);
  }, [emailResendCooldown]);

  /* Inject shared auth keyframe styles once */
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

  /* ── Post-auth orchestration ─────────────────────────────────────────────
     Called by every auth path (phone OTP, password, 2FA, email OTP, social).
     Runs: fetchProfile → roleValidator → biometric enrollment → onSuccess.
  ── */
  const handleAuthCompleteRef = useRef<
    (rawUser: AuthUser, token: string, refreshToken?: string) => Promise<void>
  >(async () => {});

  async function handleAuthComplete(rawUser: AuthUser, token: string, refreshToken?: string) {
    let profile: unknown = rawUser;
    if (fetchProfile) {
      try { profile = await fetchProfile(token); } catch { /* use rawUser as fallback */ }
    }
    if (roleValidator) {
      const msg = roleValidator(profile);
      if (msg) {
        onRoleRejected?.();
        setRoleError(msg);
        return;
      }
    }
    if (checkBiometricStatus && enrollBiometric && refreshToken) {
      try {
        const { available, enrolled } = await checkBiometricStatus();
        if (available && !enrolled) {
          setEnrollPending({ token, refreshToken, profile });
          return;
        }
      } catch { /* biometric unavailable — proceed normally */ }
    }
    onSuccess?.(profile as AuthUser, token, refreshToken);
  }
  handleAuthCompleteRef.current = handleAuthComplete;

  const {
    initiateLogin,
    verifyOtp,
    verifyPassword,
    twoFactorVerify,
    verifyLoginOtp,
    loading,
    error,
    setError,
    twoFactorPending,
    twoFactorType,
    clearError,
  } = useLoginFlow({
    baseURL,
    role: role === "admin" ? undefined : role,
    onSuccess: (user, token, rt) => { void handleAuthCompleteRef.current(user, token, rt); },
    translateError,
    onDevOtp: captureDevOtp ? setInternalDevOtp : onOtpSent,
  });

  useEffect(() => {
    if (twoFactorPending) {
      setStep("twoFactor");
    }
  }, [twoFactorPending]);

  async function handleIdentifierSubmit(e: FormEvent) {
    e.preventDefault();
    if (!identifier.trim()) {
      setError(smartLogin ? (str.identifierRequiredError ?? "Please enter your phone, email, or username") : str.enterPhoneError);
      return;
    }
    clearError();
    try {
      const result = await initiateLogin(identifier.trim(), customValues);
      // Bypass: login already completed inside the hook — don't navigate to OTP screen
      if (result.otpBypassed) return;
      if (smartLogin) {
        setSmartIdType(result.identifierType ?? null);
        setSmartMethods(result.availableMethods ?? []);
      }
      if (result.method === "password") setStep("password");
      else setStep("otp");
    } catch (_e) {
      // error is in the hook state
    }
  }

  /* ── Smart-login fallback helpers ── */
  const canUsePassword = smartMethods.includes("password");
  const canUseOtp =
    smartMethods.includes("phone_otp") || smartMethods.includes("email_otp");
  const canUseMagicLink = smartMethods.includes("magic_link");

  function handleSmartFallbackPassword() {
    clearError();
    setStep("password");
  }
  function handleSmartFallbackOtp() {
    clearError();
    if (smartIdType === "email" && enableEmailOtp) {
      setLoginMode("email");
    }
    setStep("otp");
  }
  function handleSmartFallbackMagicLink() {
    clearError();
    if (onMagicLink) {
      void onMagicLink(identifier);
      setMagicLinkSent(true);
    }
  }

  async function handleOtpComplete(otp: string) {
    try {
      await verifyOtp(otp);
    } catch (_e) {
      /* handled by hook */
    }
  }

  async function handlePasswordSubmit(e: FormEvent) {
    e.preventDefault();
    if (!password) {
      setError(str.enterPasswordError);
      return;
    }
    clearError();
    try {
      await verifyPassword(password);
    } catch (_e) {
      /* handled by hook */
    }
  }

  /* ── SDK type shims (scoped to avoid global namespace pollution) ─────── */
  type GsiCb = (r: { credential: string }) => void;
  type GsiNotif = { isNotDisplayed: () => boolean; isSkippedMoment: () => boolean };
  interface GsiAccounts { accounts: { id: { initialize(o: { client_id: string; callback: GsiCb }): void; prompt(fn: (n: GsiNotif) => void): void } } }
  type FbLoginResp = { authResponse?: { accessToken: string } };
  interface FbSDK { init(o: { appId: string; version: string }): void; login(cb: (r: FbLoginResp) => void): void }

  /* ── Internal social auth handlers ─────────────────────────────────────
     When googleClientId / facebookAppId are provided, the shared component
     loads the SDK and calls the social endpoint — no rider-app custom code.
     If neither prop is provided, falls through to the external callback.
  ── */
  async function handleGoogleClick() {
    if (!googleClientId) { onGoogle?.(); return; }
    setSocialLoading("google");
    try {
      const w = window as unknown as { google?: GsiAccounts };
      if (!w.google) {
        await new Promise<void>((res, rej) => {
          const s = document.createElement("script");
          s.src = "https://accounts.google.com/gsi/client"; s.async = true;
          s.onload = () => res(); s.onerror = () => rej(new Error("GSI load failed"));
          document.head.appendChild(s);
        });
      }
      const g = (window as unknown as { google: GsiAccounts }).google;
      const idToken = await new Promise<string>((resolve, reject) => {
        g.accounts.id.initialize({ client_id: googleClientId, callback: (r) => resolve(r.credential) });
        g.accounts.id.prompt((n) => {
          if (n.isNotDisplayed() || n.isSkippedMoment()) reject(new Error("Google sign-in cancelled"));
        });
      });
      const res = await fetch(`${baseURL}/api/auth/social/google`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken, role }),
      });
      if (!res.ok) throw new Error("Google sign-in failed");
      const data = (await res.json()) as { data?: { user: AuthUser; accessToken: string; refreshToken?: string } };
      await handleAuthCompleteRef.current(data.data!.user, data.data!.accessToken, data.data?.refreshToken);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Google sign-in failed");
    } finally { setSocialLoading(null); }
  }

  async function handleFacebookClick() {
    if (!facebookAppId) { onFacebook?.(); return; }
    setSocialLoading("facebook");
    try {
      const w = window as unknown as { FB?: FbSDK };
      if (!w.FB) {
        await new Promise<void>((res, rej) => {
          const s = document.createElement("script");
          s.src = "https://connect.facebook.net/en_US/sdk.js"; s.async = true;
          s.onload = () => res(); s.onerror = () => rej(new Error("FB load failed"));
          document.head.appendChild(s);
        });
      }
      const FB = (window as unknown as { FB: FbSDK }).FB;
      FB.init({ appId: facebookAppId, version: "v18.0" });
      const accessToken = await new Promise<string>((resolve, reject) => {
        FB.login((r) => {
          if (r.authResponse?.accessToken) resolve(r.authResponse.accessToken);
          else reject(new Error("Facebook login cancelled"));
        });
      });
      const res = await fetch(`${baseURL}/api/auth/social/facebook`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken, role }),
      });
      if (!res.ok) throw new Error("Facebook sign-in failed");
      const data = (await res.json()) as { data?: { user: AuthUser; accessToken: string; refreshToken?: string } };
      await handleAuthCompleteRef.current(data.data!.user, data.data!.accessToken, data.data?.refreshToken);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Facebook sign-in failed");
    } finally { setSocialLoading(null); }
  }

  async function handleTwoFactor(code: string) {
    try {
      await twoFactorVerify(code);
    } catch (_e) {
      /* handled by hook */
    }
  }

  async function handleLoginOtp(otp: string) {
    try {
      await verifyLoginOtp(otp);
    } catch (_e) {
      /* handled by hook */
    }
  }

  async function handleBackupCode() {
    if (!backupCodeInput.trim()) return;
    setBackupVerifying(true);
    try {
      await twoFactorVerify(backupCodeInput.trim());
    } catch (_e) {
      /* handled by hook */
    } finally {
      setBackupVerifying(false);
    }
  }

  async function handleMagicLink() {
    if (!identifier.trim() || magicLinkLoading) return;
    setMagicLinkLoading(true);
    try {
      await onMagicLink?.(identifier.trim());
      setMagicLinkSent(true);
    } catch (_e) {
      /* caller handles errors */
    } finally {
      setMagicLinkLoading(false);
    }
  }

  /* ── Email OTP handlers ── */
  async function handleSendEmailOtp() {
    if (!EMAIL_REGEX.test(emailAddress)) {
      setEmailError(str.invalidEmailError ?? "Enter a valid email address");
      return;
    }
    setEmailError(null);
    setEmailSending(true);
    try {
      const res = await fetch(`${baseURL}/api/auth/email-otp/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailAddress }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(body.message ?? "Failed to send email OTP");
      }
      setEmailOtp("");
      setEmailOtpSent(true);
      setEmailResendCooldown(60);
    } catch (e) {
      setEmailError(e instanceof Error ? e.message : "Failed to send email OTP");
    } finally {
      setEmailSending(false);
    }
  }

  async function handleVerifyEmailOtp(otpValue?: string) {
    const code = otpValue ?? emailOtp;
    if (code.length !== 6) {
      setEmailError(str.incompleteOtpError ?? "Enter the complete 6-digit OTP");
      return;
    }
    setEmailError(null);
    setEmailVerifying(true);
    try {
      const res = await fetch(`${baseURL}/api/auth/email-otp/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailAddress, otp: code }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(body.message ?? "OTP verification failed");
      }
      const data = (await res.json()) as { token?: string; accessToken?: string; refreshToken?: string };
      const token = (data.accessToken ?? data.token ?? "") as string;
      void handleAuthCompleteRef.current({ id: "", email: emailAddress, roles: [role] } as unknown as AuthUser, token, data.refreshToken);
    } catch (e) {
      setEmailError(e instanceof Error ? e.message : "OTP verification failed");
      setEmailOtp("");
    } finally {
      setEmailVerifying(false);
    }
  }

  /* ── Inline magic link modal handler ── */
  async function handleSendMagicLink() {
    if (!EMAIL_REGEX.test(magicEmail) || magicSending) return;
    setMagicSending(true);
    try {
      await onMagicLink?.(magicEmail);
      setMagicSent(true);
    } catch (_e) {
      /* caller handles errors */
    } finally {
      setMagicSending(false);
    }
  }

  /* ── Tab switch: reset relevant step state ── */
  function handleTabSwitch(mode: LoginMode) {
    setLoginMode(mode);
    clearError();
    setEmailError(null);
    if (mode !== "email") {
      setEmailOtpSent(false);
      setEmailOtp("");
    }
    if (step !== "identifier" && mode !== "email") {
      setStep("identifier");
    }
  }

  const s = {
    outer: {
      minHeight: "100vh",
      display: "flex",
      flexDirection: "row" as const,
    },
    leftPanel: {
      display: isWide ? "flex" : "none",
      flexDirection: "column" as const,
      justifyContent: "center",
      alignItems: "center",
      flex: "0 0 42%",
      background: `linear-gradient(135deg, ${theme.primary} 0%, ${theme.primaryDark} 100%)`,
      padding: "48px 40px",
      gap: "16px",
    },
    leftTitle: {
      fontSize: "32px",
      fontWeight: 800,
      color: theme.onPrimary,
      textAlign: "center" as const,
      margin: 0,
    },
    leftSubtitle: {
      fontSize: "16px",
      color: theme.onPrimary,
      opacity: 0.82,
      textAlign: "center" as const,
      margin: 0,
      lineHeight: "1.5",
    },
    rightPanel: {
      flex: 1,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: theme.background,
      padding: "24px 16px",
    },
    card: {
      width: "100%",
      maxWidth: "400px",
      background: theme.surface,
      borderRadius: "16px",
      padding: "32px 28px",
      boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
      display: "flex",
      flexDirection: "column" as const,
      gap: "20px",
    },
    header: { textAlign: "center" as const },
    title: { fontSize: "22px", fontWeight: 800, color: theme.text, margin: "0 0 4px" },
    subtitle: { fontSize: "14px", color: theme.textMuted, margin: 0 },
    label: {
      fontSize: "13px",
      fontWeight: 600,
      color: theme.text,
      marginBottom: "4px",
      display: "block",
    },
    input: {
      width: "100%",
      padding: "12px",
      border: `2px solid ${theme.border}`,
      borderRadius: "8px",
      fontSize: "15px",
      outline: "none",
      boxSizing: "border-box" as const,
      transition: "border-color 0.15s, box-shadow 0.15s",
      background: theme.background,
      color: theme.text,
    },
    select: {
      width: "100%",
      padding: "12px",
      border: `2px solid ${theme.border}`,
      borderRadius: "8px",
      fontSize: "15px",
      outline: "none",
      boxSizing: "border-box" as const,
      transition: "border-color 0.15s, box-shadow 0.15s",
      background: theme.surface,
      color: theme.text,
    },
    btnPrimary: {
      width: "100%",
      padding: "13px",
      borderRadius: "8px",
      border: "none",
      background: theme.primary,
      color: theme.onPrimary,
      fontWeight: 700,
      fontSize: "15px",
      cursor: "pointer",
      transition: "opacity 0.15s, filter 0.15s, transform 0.1s",
    },
    btnDisabled: { opacity: 0.55, cursor: "not-allowed", transform: "none", filter: "none" },
    errorBox: {
      background: theme.errorBackground,
      border: `1px solid ${theme.errorBorder}`,
      borderRadius: "10px",
      padding: "12px 14px",
      color: theme.error,
      fontSize: "13px",
      display: "flex",
      alignItems: "center",
      gap: "8px",
      lineHeight: 1.4,
    },
    link: {
      background: "none",
      border: "none",
      color: theme.primary,
      cursor: "pointer",
      fontSize: "13px",
      fontWeight: 600,
      padding: "0",
      textAlign: "center" as const,
      transition: "opacity 0.15s",
    },
    footerRow: { textAlign: "center" as const, fontSize: "13px", color: theme.textMuted },
    magicLinkRow: {
      textAlign: "center" as const,
      fontSize: "13px",
      color: theme.textMuted,
      marginTop: "-8px",
    },
    tabRow: {
      display: "flex",
      gap: "6px",
      background: theme.background,
      borderRadius: "10px",
      padding: "4px",
    },
    tabBtn: (active: boolean): React.CSSProperties => ({
      flex: 1,
      padding: "8px 0",
      borderRadius: "7px",
      border: "none",
      background: active ? theme.primary : "transparent",
      color: active ? theme.onPrimary : theme.textMuted,
      fontWeight: active ? 700 : 500,
      fontSize: "13px",
      cursor: "pointer",
      transition: "background 0.15s, color 0.15s",
    }),
    devOtpBanner: {
      background: theme.primaryLight,
      border: `1px solid ${theme.primary}`,
      borderRadius: "8px",
      padding: "8px 12px",
      marginBottom: "0",
      fontSize: "13px",
      color: theme.primary,
    },
    magicLinkPanel: {
      background: theme.background,
      border: `1px solid ${theme.border}`,
      borderRadius: "10px",
      padding: "14px",
      display: "flex",
      flexDirection: "column" as const,
      gap: "10px",
    },
    magicLinkPanelLabel: {
      fontSize: "13px",
      fontWeight: 600,
      color: theme.text,
      margin: 0,
    },
  } as const;

  function renderCustomFields() {
    return customFields.map((field) => {
      if (field === "vehicleType") {
        return (
          <div key={field}>
            <label style={s.label}>Vehicle Type</label>
            <select
              className="auth-input"
              style={s.select}
              value={customValues["vehicleType"] ?? ""}
              onChange={(e) => setCustomValues({ ...customValues, vehicleType: e.target.value })}
            >
              <option value="">Select vehicle</option>
              <option value="motorcycle">Motorcycle</option>
              <option value="car">Car</option>
              <option value="van">Van / Pickup</option>
              <option value="truck">Truck</option>
            </select>
          </div>
        );
      }
      if (field === "licenseNumber") {
        return (
          <div key={field}>
            <label style={s.label}>License Number</label>
            <input
              className="auth-input"
              style={s.input}
              type="text"
              placeholder="e.g. LHR-12345"
              value={customValues["licenseNumber"] ?? ""}
              onChange={(e) => setCustomValues({ ...customValues, licenseNumber: e.target.value })}
            />
          </div>
        );
      }
      if (field === "storeName") {
        return (
          <div key={field}>
            <label style={s.label}>Store Name</label>
            <input
              className="auth-input"
              style={s.input}
              type="text"
              placeholder="Your business name"
              value={customValues["storeName"] ?? ""}
              onChange={(e) => setCustomValues({ ...customValues, storeName: e.target.value })}
            />
          </div>
        );
      }
      if (field === "cnic") {
        return (
          <div key={field}>
            <label style={s.label}>CNIC</label>
            <input
              className="auth-input"
              style={s.input}
              type="text"
              placeholder="12345-1234567-1"
              value={customValues["cnic"] ?? ""}
              onChange={(e) => setCustomValues({ ...customValues, cnic: e.target.value })}
            />
          </div>
        );
      }
      if (field === "businessType") {
        return (
          <div key={field}>
            <label style={s.label}>Business Type</label>
            <select
              className="auth-input"
              style={s.select}
              value={customValues["businessType"] ?? ""}
              onChange={(e) => setCustomValues({ ...customValues, businessType: e.target.value })}
            >
              <option value="">Select type</option>
              <option value="retail">Retail</option>
              <option value="wholesale">Wholesale</option>
              <option value="restaurant">Restaurant / Food</option>
              <option value="pharmacy">Pharmacy</option>
              <option value="grocery">Grocery</option>
              <option value="other">Other</option>
            </select>
          </div>
        );
      }
      return null;
    });
  }

  const TAB_LABELS: Record<LoginMode, string> = {
    otp: "Phone OTP",
    password: "Password",
    email: "Email OTP",
  };

  return (
    <div style={s.outer} className={className}>
      {/* Left brand panel — visible only on wide screens */}
      <div style={s.leftPanel}>
        <p style={s.leftTitle}>{displayTitle}</p>
        <p style={s.leftSubtitle}>
          {role === "customer" && "Shop, eat, ride — all in one app"}
          {role === "rider" && "Manage deliveries and rides on the go"}
          {role === "vendor" && "Grow your business with AJKMart"}
          {role === "admin" && "Platform administration & control"}
        </p>
      </div>

      {/* Right panel — form */}
      <div style={s.rightPanel}>
        <div style={s.card}>
          {/* Logo */}
          {logoSrc && (
            <div style={{ textAlign: "center" }}>
              <img
                src={logoSrc}
                alt={logoAlt ?? "App Logo"}
                style={{ height: 48, objectFit: "contain", marginBottom: 16 }}
              />
            </div>
          )}

          {/* Header */}
          <div style={s.header}>
            <h1 style={s.title}>{displayTitle}</h1>
            <p style={s.subtitle}>
              {loginMode === "email"
                ? emailOtpSent
                  ? (str.subtitleOtp ?? "Enter the OTP sent to your email")
                  : (str.subtitleIdentifier ?? "Sign in with your email address")
                : step === "identifier" && (smartLogin ? (str.identifierPlaceholder ?? "Phone, email, or username") : str.subtitleIdentifier)}
              {step === "otp" && loginMode !== "email" && (
                smartLogin && smartIdType === "phone"
                  ? `Enter the OTP sent to ${identifier}`
                  : str.subtitleOtp
              )}
              {step === "password" && str.subtitlePassword}
              {step === "twoFactor" && str.subtitleTwoFactor}
            </p>
          </div>

          {/* Dev OTP banner */}
          {devOtp && (
            <div style={s.devOtpBanner}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ flexShrink: 0, marginRight: 6 }}>
                <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>
              </svg>
              Dev OTP: <strong>{devOtp}</strong>
            </div>
          )}

          {/* Tab switcher (hidden in smart-login mode) */}
          {showTabs && step === "identifier" && !smartLogin && (
            <div style={s.tabRow} role="tablist">
              {resolvedTabs.map((tab) => (
                <button
                  key={tab}
                  type="button"
                  role="tab"
                  aria-selected={loginMode === tab}
                  style={s.tabBtn(loginMode === tab)}
                  onClick={() => handleTabSwitch(tab)}
                >
                  {TAB_LABELS[tab]}
                </button>
              ))}
            </div>
          )}

          {/* Error */}
          {error && (
            <div style={s.errorBox} role="alert" aria-live="assertive">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ flexShrink: 0, marginTop: 1 }}>
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          {/* Email OTP error */}
          {loginMode === "email" && emailError && (
            <div style={s.errorBox} role="alert" aria-live="assertive">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ flexShrink: 0, marginTop: 1 }}>
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>{emailError}</span>
            </div>
          )}

          {/* ── Email OTP flow ── */}
          {loginMode === "email" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {!emailOtpSent ? (
                <>
                  <div>
                    <label style={s.label}>{str.emailLabel ?? "Email address"}</label>
                    <input
                      className="auth-input"
                      style={s.input}
                      type="email"
                      placeholder="you@example.com"
                      value={emailAddress}
                      onChange={(e) => setEmailAddress(e.target.value)}
                      autoComplete="email"
                    />
                  </div>
                  <button
                    type="button"
                    style={{ ...s.btnPrimary, ...(emailSending ? s.btnDisabled : {}) }}
                    disabled={emailSending}
                    onClick={() => void handleSendEmailOtp()}
                  >
                    {emailSending ? (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 8, justifyContent: "center" }}>
                        <SpinIcon size={17} /> {str.sendingLabel ?? "Sending…"}
                      </span>
                    ) : (
                      str.sendOtpBtn ?? "Send OTP"
                    )}
                  </button>
                </>
              ) : (
                <>
                  <OtpInput
                    label={str.subtitleOtp ?? "Enter the 6-digit code sent to your email"}
                    onComplete={(code) => void handleVerifyEmailOtp(code)}
                    autoSubmit
                  />
                  {emailVerifying && (
                    <p style={{ textAlign: "center", fontSize: "13px", color: theme.textMuted }}>
                      {str.verifyingLabel ?? "Verifying…"}
                    </p>
                  )}
                  <p style={{ textAlign: "center", fontSize: "13px", color: theme.textMuted }}>
                    {emailResendCooldown > 0 ? (
                      <span>{(str.resendInLabel ?? "Resend in {n}s").replace("{n}", String(emailResendCooldown))}</span>
                    ) : (
                      <button
                        type="button"
                        style={s.link}
                        onClick={() => {
                          setEmailOtpSent(false);
                          setEmailOtp("");
                          setEmailError(null);
                        }}
                      >
                        {str.changeEmailLink ?? "← Change email"}
                      </button>
                    )}
                  </p>
                </>
              )}
              {showTabs && (
                <button
                  type="button"
                  style={s.link}
                  onClick={() => handleTabSwitch(resolvedTabs[0] ?? "otp")}
                >
                  ← Back
                </button>
              )}
            </div>
          )}

          {/* ── Standard OTP / Password flows (unchanged when loginMode !== "email") ── */}
          {loginMode !== "email" && (
            <>
              {/* Step: Identifier */}
              {step === "identifier" && (
                <form
                  onSubmit={(e) => void handleIdentifierSubmit(e)}
                  style={{ display: "flex", flexDirection: "column", gap: "16px" }}
                >
                  <div>
                    <label style={s.label}>
                      {smartLogin ? (str.identifierPlaceholder ?? "Phone, email, or username") : str.phoneLabel}
                    </label>
                    {smartLogin ? (
                      <input
                        className="auth-input"
                        style={s.input}
                        type="text"
                        placeholder={str.identifierHint ?? "e.g. 03001234567 or name@example.com"}
                        value={identifier}
                        onChange={(e) => setIdentifier(e.target.value)}
                        autoComplete="username"
                        autoFocus
                      />
                    ) : (
                      <PhoneInput
                        value={identifier}
                        onChange={(e164) => {
                          setIdentifier(e164);
                        }}
                      />
                    )}
                  </div>
                  {renderCustomFields()}
                  <button
                    type="submit"
                    style={{ ...s.btnPrimary, ...(loading ? s.btnDisabled : {}) }}
                    disabled={loading}
                  >
                    {loading ? (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 8, justifyContent: "center" }}>
                        <SpinIcon size={17} /> {str.checkingBtn}
                      </span>
                    ) : (
                      str.continueBtn
                    )}
                  </button>
                  {enableMagicLink && onMagicLink && (
                    <p style={s.magicLinkRow}>
                      {magicLinkSent ? (
                        <span>{str.magicLinkSent}</span>
                      ) : (
                        <button
                          type="button"
                          style={{ ...s.link, ...(magicLinkLoading ? { opacity: 0.55, cursor: "not-allowed" } : {}) }}
                          disabled={magicLinkLoading}
                          onClick={() => void handleMagicLink()}
                        >
                          {magicLinkLoading ? (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, justifyContent: "center" }}>
                              <SpinIcon size={15} /> {str.magicLinkSending}
                            </span>
                          ) : (
                            str.sendMagicLink
                          )}
                        </button>
                      )}
                    </p>
                  )}
                  {enableBiometric && (
                    <BiometricPrompt
                      onSuccess={(token) => {
                        onBiometricSuccess?.(token);
                      }}
                      onDismiss={onBiometricEnrollDecline}
                      label={str.biometricBtnLabel ?? "Sign in with biometrics"}
                    />
                  )}
                  {enableSocial && (
                    <SocialButtons
                      onGoogle={onGoogle ?? (() => {})}
                      onFacebook={onFacebook ?? (() => {})}
                      googleLoading={socialLoadingProvider === "google"}
                      facebookLoading={socialLoadingProvider === "facebook"}
                      googleLabel={googleLabel}
                      facebookLabel={facebookLabel}
                      label={socialDividerLabel}
                    />
                  )}
                  {onRegisterPress && (
                    <p style={s.footerRow}>
                      {str.newHere}{" "}
                      <button type="button" style={s.link} onClick={onRegisterPress}>
                        {str.createAccount}
                      </button>
                    </p>
                  )}

                  {/* Inline magic link panel */}
                  {enableMagicLinkModal && (
                    <div style={s.magicLinkPanel}>
                      <p style={s.magicLinkPanelLabel}>{str.magicLinkBtnLabel ?? "Sign in with magic link"}</p>
                      {magicSent ? (
                        <p style={{ fontSize: "13px", color: theme.primary, margin: 0, display: "flex", alignItems: "center", gap: 6 }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                          {str.magicLinkSent ?? "Magic link sent — check your inbox."}
                        </p>
                      ) : (
                        <>
                          <input
                            className="auth-input"
                            style={s.input}
                            type="email"
                            placeholder="you@example.com"
                            value={magicEmail}
                            onChange={(e) => setMagicEmail(e.target.value)}
                            autoComplete="email"
                          />
                          <button
                            type="button"
                            style={{ ...s.btnPrimary, ...(magicSending ? s.btnDisabled : {}) }}
                            disabled={magicSending}
                            onClick={() => void handleSendMagicLink()}
                          >
                            {magicSending ? (
                              <span style={{ display: "inline-flex", alignItems: "center", gap: 8, justifyContent: "center" }}>
                                <SpinIcon size={17} /> {str.magicLinkSending}
                              </span>
                            ) : (
                              str.sendMagicLink
                            )}
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </form>
              )}

              {/* Step: OTP */}
              {step === "otp" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  <OtpInput
                    onComplete={(otp) => void handleOtpComplete(otp)}
                    onResend={() => void initiateLogin(identifier)}
                    autoSubmit
                  />
                  {/* Smart-login fallbacks */}
                  {smartLogin && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {canUsePassword && (
                        <button type="button" style={s.link} onClick={handleSmartFallbackPassword}>
                          {str.usePasswordInstead ?? "Use password instead"}
                        </button>
                      )}
                      {canUseMagicLink && (
                        <button type="button" style={s.link} onClick={handleSmartFallbackMagicLink}>
                          {str.sendMagicLink}
                        </button>
                      )}
                    </div>
                  )}
                  <button
                    type="button"
                    style={s.link}
                    onClick={() => {
                      clearError();
                      setStep("identifier");
                    }}
                  >
                    {smartLogin ? (str.tryAnotherAccountLink ?? "← Try another account") : str.changeNumber}
                  </button>
                </div>
              )}

              {/* Step: Password */}
              {step === "password" && (
                <form
                  onSubmit={(e) => void handlePasswordSubmit(e)}
                  style={{ display: "flex", flexDirection: "column", gap: "16px" }}
                >
                  <PasswordInput
                    value={password}
                    onChange={setPassword}
                    label={str.passwordLabel}
                    showStrength={false}
                    autoComplete="current-password"
                  />
                  {forgotPasswordHref != null && (
                    <div style={{ textAlign: "right", marginTop: "-8px" }}>
                      <a
                        href={forgotPasswordHref}
                        style={{ fontSize: "13px", color: theme.primary, fontWeight: 600, textDecoration: "none" }}
                      >
                        {str.forgotPasswordLabel ?? "Forgot password?"}
                      </a>
                    </div>
                  )}
                  <button
                    type="submit"
                    style={{ ...s.btnPrimary, ...(loading ? s.btnDisabled : {}) }}
                    disabled={loading}
                  >
                    {loading ? (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 8, justifyContent: "center" }}>
                        <SpinIcon size={17} /> {str.signingInBtn}
                      </span>
                    ) : (
                      str.signInBtn
                    )}
                  </button>
                  {/* Smart-login fallbacks */}
                  {smartLogin && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: -6 }}>
                      {canUseOtp && (
                        <button type="button" style={s.link} onClick={handleSmartFallbackOtp}>
                          {str.useOtpInstead ?? (smartIdType === "phone" ? "Get OTP instead" : "Use email OTP instead")}
                        </button>
                      )}
                      {canUseMagicLink && (
                        <button type="button" style={s.link} onClick={handleSmartFallbackMagicLink}>
                          {str.sendMagicLink}
                        </button>
                      )}
                    </div>
                  )}
                  <button
                    type="button"
                    style={s.link}
                    onClick={() => {
                      clearError();
                      setStep("identifier");
                    }}
                  >
                    {smartLogin ? (str.tryAnotherAccountLink ?? "← Try another account") : str.back}
                  </button>
                </form>
              )}

              {/* Step: 2FA — login-OTP second step or TOTP authenticator */}
              {step === "twoFactor" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  {twoFactorType === "otp" ? (
                    <>
                      <p style={{ margin: 0, fontSize: "14px", color: theme.textMuted }}>
                        {str.subtitleLoginOtp ?? "Enter the OTP sent to verify your identity"}
                      </p>
                      <OtpInput
                        onComplete={(otp) => void handleLoginOtp(otp)}
                        autoSubmit
                      />
                      <p style={{ margin: 0, textAlign: "center", fontSize: "13px" }}>
                        <button
                          type="button"
                          style={s.link}
                          onClick={() => { clearError(); setStep("identifier"); }}
                        >
                          {str.back}
                        </button>
                      </p>
                    </>
                  ) : (
                    <>
                      <p style={{ margin: 0, fontSize: "14px", fontWeight: 600 }}>
                        {str.twoFactorAuth ?? str.subtitleTwoFactor}
                      </p>
                      {!useBackup ? (
                        <>
                          <OtpInput
                            label={str.enterAuthCode ?? str.subtitleTotp ?? str.twoFactorLabel}
                            onComplete={(code) => void handleTwoFactor(code)}
                            autoSubmit
                          />
                          <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", cursor: "pointer" }}>
                            <input
                              type="checkbox"
                              checked={trustDevice}
                              onChange={e => setTrustDevice(e.target.checked)}
                              style={{ cursor: "pointer" }}
                            />
                            {str.trustDevice ?? "Trust this device for 30 days"}
                          </label>
                          <p style={{ margin: 0, textAlign: "center", fontSize: "13px" }}>
                            <button
                              type="button"
                              style={s.link}
                              onClick={() => { setUseBackup(true); setBackupCodeInput(""); clearError(); }}
                            >
                              {str.useBackupCode ?? "Use a backup code"}
                            </button>
                          </p>
                        </>
                      ) : (
                        <>
                          <input
                            type="text"
                            value={backupCodeInput}
                            onChange={e => setBackupCodeInput(e.target.value)}
                            placeholder={str.backupCodePlaceholder ?? "Enter backup code"}
                            style={{ padding: "10px 12px", border: "1px solid #ccc", borderRadius: "6px", fontSize: "14px", width: "100%", boxSizing: "border-box" }}
                            autoFocus
                            onKeyDown={e => { if (e.key === "Enter") void handleBackupCode(); }}
                          />
                          <button
                            type="button"
                            onClick={() => void handleBackupCode()}
                            disabled={backupVerifying || !backupCodeInput.trim()}
                            style={{ ...s.btnPrimary, opacity: (backupVerifying || !backupCodeInput.trim()) ? 0.6 : 1 }}
                          >
                            {backupVerifying ? (str.verifyingLabel ?? "Verifying…") : (str.signInBtn ?? "Sign in")}
                          </button>
                          <p style={{ margin: 0, textAlign: "center", fontSize: "13px" }}>
                            <button
                              type="button"
                              style={s.link}
                              onClick={() => { setUseBackup(false); setBackupCodeInput(""); clearError(); }}
                            >
                              {str.useAuthAppInstead ?? "Use authenticator app instead"}
                            </button>
                          </p>
                        </>
                      )}
                      <p style={{ margin: 0, textAlign: "center", fontSize: "13px" }}>
                        <button
                          type="button"
                          style={s.link}
                          onClick={() => { clearError(); setUseBackup(false); setBackupCodeInput(""); setStep("identifier"); }}
                        >
                          {str.back}
                        </button>
                      </p>
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
