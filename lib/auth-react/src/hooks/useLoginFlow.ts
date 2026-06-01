import { useCallback, useContext, useState } from "react";
import type { AuthUser } from "../AuthProvider";
import { AuthContext } from "../AuthProvider";

export type LoginMethod = "otp" | "password" | "social" | "magic-link" | "totp";
export type TwoFactorType = "totp" | "otp";

export interface IdentifierCheckResult {
  method: LoginMethod;
  /** Whether the account exists already (false = registration path) */
  exists: boolean;
  /** True when the account has 2FA enabled */
  twoFactorEnabled?: boolean;
  /** Detected identifier type from backend */
  identifierType?: "phone" | "email" | "username";
  /** All auth methods enabled for this role */
  availableMethods?: string[];
  /** True when Global OTP Suspension bypassed OTP — login already completed inside the hook */
  otpBypassed?: boolean;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface UseLoginFlowOptions {
  baseURL?: string;
  role?: "customer" | "rider" | "vendor" | "admin";
  onSuccess?: (user: AuthUser, accessToken: string, refreshToken?: string) => void;
  /** Optional function to translate raw API error strings before displaying them */
  translateError?: (raw: string) => string;
  /** Called with the dev-only OTP when it is present in an API response (dev mode only) */
  onDevOtp?: (otp: string) => void;
}

export function useLoginFlow({
  baseURL = "",
  role,
  onSuccess,
  translateError,
  onDevOtp,
}: UseLoginFlowOptions = {}) {
  const ctx = useContext(AuthContext);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [method, setMethod] = useState<LoginMethod | null>(null);
  const [identifier, setIdentifier] = useState<string>("");
  const [twoFactorPending, setTwoFactorPending] = useState(false);
  const [tempToken, setTempToken] = useState<string | null>(null);
  const [twoFactorType, setTwoFactorType] = useState<TwoFactorType | null>(null);
  const [identifierType, setIdentifierType] = useState<"phone" | "email" | "username" | null>(null);

  function clearError() {
    setError(null);
  }

  function applyTranslation(raw: string): string {
    return translateError ? translateError(raw) : raw;
  }

  async function apiFetch<T>(path: string, body: Record<string, unknown>): Promise<ApiResponse<T>> {
    const token = ctx?.tokenStorage.getAccessToken();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const res = await fetch(`${baseURL}${path}`, {
      method: "POST",
      credentials: "include",
      headers,
      body: JSON.stringify(body),
    });
    const json = (await res.json()) as ApiResponse<T>;
    if (!res.ok) {
      throw new Error(json.error ?? json.message ?? `HTTP ${res.status}`);
    }
    return json;
  }

  /**
   * Step 1 — Check whether the identifier (phone/email/username) exists,
   * which login method the server recommends, then trigger OTP delivery
   * when the action is phone/email OTP.
   *
   * @param id - The identifier (phone/email/username)
   * @param metadata - Optional extra fields (e.g. customValues from LoginScreen)
   *                   that are forwarded to both check-identifier and send-otp.
   */
  const initiateLogin = useCallback(
    async (id: string, metadata?: Record<string, unknown>): Promise<IdentifierCheckResult> => {
      setLoading(true);
      setError(null);
      setIdentifier(id);
      try {
        const checkBody: Record<string, unknown> = { identifier: id };
        if (role && role !== "admin") checkBody.role = role;
        if (metadata && Object.keys(metadata).length > 0) {
          Object.assign(checkBody, metadata);
        }

        const res = await apiFetch<
          IdentifierCheckResult & { action?: string; availableMethods?: string[] }
        >("/api/auth/check-identifier", checkBody);
        const raw = (res.data ?? {}) as Record<string, unknown>;

        /* Map the API's action/availableMethods format to the method field
           the LoginScreen step-switcher expects */
        const rawMethod = typeof raw.method === "string" ? (raw.method as LoginMethod) : undefined;
        const rawAction = typeof raw.action === "string" ? raw.action : undefined;
        const rawAvailableMethods = Array.isArray(raw.availableMethods)
          ? (raw.availableMethods as string[])
          : [];
        const rawExists = typeof raw.exists === "boolean" ? raw.exists : false;

        const actionToMethod = (action: string | undefined): LoginMethod => {
          if (action === "login_password") return "password";
          if (action === "send_magic_link") return "magic-link";
          return "otp";
        };
        const derivedMethod: LoginMethod =
          rawMethod ??
          actionToMethod(rawAction) ??
          (rawAvailableMethods.includes("password") && !rawAvailableMethods.includes("phone_otp")
            ? "password"
            : "otp");

        const result: IdentifierCheckResult = {
          method: derivedMethod,
          exists: rawExists,
          twoFactorEnabled:
            typeof raw.twoFactorEnabled === "boolean" ? raw.twoFactorEnabled : undefined,
          identifierType: (raw.identifierType as "phone" | "email" | "username") ?? undefined,
          availableMethods: rawAvailableMethods,
        };
        setMethod(result.method);
        setIdentifierType(result.identifierType ?? null);

        /* ── Trigger phone OTP delivery ────────────────────────────────────
           check-identifier only tells us WHAT to do — it does NOT send the
           OTP.  We must call /auth/send-otp ourselves when the action is a
           phone-OTP flow.  Without this the user would see an OTP input but
           receive nothing on their phone.
        ─────────────────────────────────────────────────────────────────── */
        const action: string = rawAction ?? "";
        if (action === "send_phone_otp" || derivedMethod === "otp") {
          const looksLikePhone = /^[\d\s\-+()]{7,15}$/.test(id.trim());
          if (looksLikePhone) {
            const sendBody: Record<string, unknown> = { phone: id };
            if (role && role !== "admin") sendBody.role = role;
            if (metadata && Object.keys(metadata).length > 0) {
              Object.assign(sendBody, metadata);
            }
            // Fire-and-forget: errors here are surfaced in verifyOtp if OTP wasn't sent
            try {
              const sendRes = await apiFetch<{
                devOtp?: string;
                otpRequired?: boolean;
                accessToken?: string;
                refreshToken?: string;
                user?: AuthUser;
              }>("/api/auth/send-otp", sendBody);
              if (sendRes.data?.devOtp && onDevOtp) onDevOtp(sendRes.data.devOtp);

              // Bypass path: backend issued JWT without needing OTP — log in immediately
              if (sendRes.data?.otpRequired === false && sendRes.data?.accessToken && sendRes.data?.user) {
                ctx?.login(sendRes.data.user, sendRes.data.accessToken);
                onSuccess?.(sendRes.data.user, sendRes.data.accessToken, sendRes.data.refreshToken);
                result.otpBypassed = true;
              }
            } catch (sendErr) {
              const msg = sendErr instanceof Error ? sendErr.message : "Failed to send OTP";
              setError(applyTranslation(msg));
              throw sendErr;
            }
          }
        }

        /* ── Trigger email OTP delivery ────────────────────────────────────
           When the server action is send_email_otp, auto-send the email OTP
           so the user receives it immediately without an extra button press.
        ─────────────────────────────────────────────────────────────────── */
        if (action === "send_email_otp") {
          const sendBody: Record<string, unknown> = { email: id };
          if (role && role !== "admin") sendBody.role = role;
          if (metadata && Object.keys(metadata).length > 0) {
            Object.assign(sendBody, metadata);
          }
          try {
            const sendRes = await apiFetch<{ devOtp?: string }>("/api/auth/send-email-otp", sendBody);
            if (sendRes.data?.devOtp && onDevOtp) onDevOtp(sendRes.data.devOtp);
          } catch (sendErr) {
            const msg = sendErr instanceof Error ? sendErr.message : "Failed to send email OTP";
            setError(applyTranslation(msg));
            throw sendErr;
          }
        }

        return result;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to check identifier";
        // Only set error if not already set (send-otp errors set it above)
        setError((prev) => prev ?? applyTranslation(msg));
        throw err;
      } finally {
        setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [baseURL, role]
  );

  /**
   * Step 2a — Verify OTP (sent via SMS/email).
   * Server expects { phone, otp } — NOT { identifier, otp }.
   */
  const verifyOtp = useCallback(
    async (otp: string): Promise<void> => {
      setLoading(true);
      setError(null);
      try {
        /* Route to email or phone field based on what the identifier was */
        const body: Record<string, unknown> = identifierType === "email"
          ? { email: identifier, otp }
          : { phone: identifier, otp };
        if (role && role !== "admin") body.role = role;

        const res = await apiFetch<{
          user: AuthUser;
          accessToken: string;
          refreshToken?: string;
          twoFactorRequired?: boolean;
          twoFactorType?: string;
          tempToken?: string;
        }>("/api/auth/verify-otp", body);
        const data = res.data!;
        if (data.twoFactorRequired) {
          setTempToken(data.tempToken ?? null);
          setTwoFactorType((data.twoFactorType as TwoFactorType) ?? "totp");
          setTwoFactorPending(true);
          ctx?.setTwoFactorPending(true);
          return;
        }
        ctx?.login(data.user, data.accessToken);
        onSuccess?.(data.user, data.accessToken, data.refreshToken);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "OTP verification failed";
        setError(applyTranslation(msg));
        throw err;
      } finally {
        setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [identifier, identifierType, baseURL, role, onSuccess]
  );

  /**
   * Step 2b — Verify password login.
   * Includes role in the request body so the server can validate role membership.
   */
  const verifyPassword = useCallback(
    async (password: string): Promise<void> => {
      setLoading(true);
      setError(null);
      try {
        const body: Record<string, unknown> = { identifier, password };
        if (role && role !== "admin") body.role = role;

        const res = await apiFetch<{
          user: AuthUser;
          accessToken: string;
          refreshToken?: string;
          twoFactorRequired?: boolean;
          twoFactorType?: string;
          tempToken?: string;
        }>("/api/auth/login", body);
        const data = res.data!;
        if (data.twoFactorRequired) {
          setTempToken(data.tempToken ?? null);
          setTwoFactorType((data.twoFactorType as TwoFactorType) ?? "totp");
          setTwoFactorPending(true);
          ctx?.setTwoFactorPending(true);
          return;
        }
        ctx?.login(data.user, data.accessToken);
        onSuccess?.(data.user, data.accessToken, data.refreshToken);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Password login failed";
        setError(applyTranslation(msg));
        throw err;
      } finally {
        setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [identifier, baseURL, role, onSuccess]
  );

  /**
   * Step 3a — Verify TOTP / 2FA code after initial credential check succeeds.
   * Uses tempToken from the 2FA challenge response, not the identifier.
   */
  const twoFactorVerify = useCallback(
    async (code: string): Promise<void> => {
      setLoading(true);
      setError(null);
      try {
        const res = await apiFetch<{ user: AuthUser; accessToken: string; refreshToken?: string }>(
          "/api/auth/2fa/verify",
          { tempToken, code }
        );
        const data = res.data!;
        setTempToken(null);
        setTwoFactorType(null);
        setTwoFactorPending(false);
        ctx?.setTwoFactorPending(false);
        ctx?.login(data.user, data.accessToken);
        onSuccess?.(data.user, data.accessToken, data.refreshToken);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "2FA verification failed";
        setError(applyTranslation(msg));
        throw err;
      } finally {
        setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tempToken, baseURL, onSuccess]
  );

  /**
   * Step 3b — Verify the second-step login OTP (password-then-OTP flow).
   * Uses tempToken from the requiresOtp challenge response.
   * Endpoint: POST /api/auth/login/verify-otp
   */
  const verifyLoginOtp = useCallback(
    async (otp: string): Promise<void> => {
      setLoading(true);
      setError(null);
      try {
        const res = await apiFetch<{
          user: AuthUser;
          accessToken: string;
          refreshToken?: string;
          twoFactorRequired?: boolean;
          twoFactorType?: string;
          tempToken?: string;
        }>("/api/auth/login/verify-otp", { tempToken, otp });
        const data = res.data!;
        if (data.twoFactorRequired) {
          setTempToken(data.tempToken ?? null);
          setTwoFactorType((data.twoFactorType as TwoFactorType) ?? "totp");
          return;
        }
        setTempToken(null);
        setTwoFactorType(null);
        setTwoFactorPending(false);
        ctx?.setTwoFactorPending(false);
        ctx?.login(data.user, data.accessToken);
        onSuccess?.(data.user, data.accessToken, data.refreshToken);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "OTP verification failed";
        setError(applyTranslation(msg));
        throw err;
      } finally {
        setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tempToken, baseURL, onSuccess]
  );

  return {
    initiateLogin,
    verifyOtp,
    verifyPassword,
    twoFactorVerify,
    verifyLoginOtp,
    loading,
    error,
    setError,
    method,
    twoFactorPending,
    twoFactorType,
    identifierType,
    tempToken,
    clearError,
  };
}
