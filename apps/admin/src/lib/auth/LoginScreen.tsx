import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { OtpInput } from "@workspace/auth-react";
import {
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  Loader2,
  Mail,
  Phone,
  ShieldCheck,
  ShoppingBag,
  UserRound,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useAdminAuth } from "../adminAuthContext";
import { useTheme } from "./ThemeContext";
import { useAppStatus } from "./useAppStatus";
import { useAuth } from "./useAuth";
import { useRateLimitCountdown } from "./useRateLimitCountdown";

export interface LoginScreenProps {
  onSuccess?: () => void;
}

type Step = "credentials" | "mfa";

function _sessionSeconds(rememberMe: boolean) {
  return rememberMe ? 60 * 60 * 24 * 7 : 60 * 60 * 8;
}

/* ── Shared micro-components ──────────────────────────────────────────── */

function AuthLabel({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <label
      htmlFor={htmlFor}
      className="block text-[11px] font-semibold tracking-widest text-white/40 uppercase"
    >
      {children}
    </label>
  );
}

function AuthBackLink({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 text-[12px] font-medium text-white/40 transition-colors hover:text-white/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20"
    >
      <ArrowLeft className="h-3.5 w-3.5" />
      {children}
    </button>
  );
}

function AuthErrorBanner({ children }: { children: React.ReactNode }) {
  return (
    <div
      role="alert"
      className="rounded-xl border border-red-500/20 bg-red-500/[0.08] px-3 py-2.5 text-[13px] leading-snug text-red-400 animate-in slide-in-from-top-1 duration-200"
    >
      {children}
    </div>
  );
}

/* ── Step fade wrapper ────────────────────────────────────────────────── */
function FadeStep({ children }: { children: React.ReactNode }) {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-1 duration-200">
      {children}
    </div>
  );
}

export function LoginScreen({ onSuccess }: LoginScreenProps) {
  const { loginWithPassword, isLoading } = useAuth();
  const { maintenance, maintenanceMsg, supportPhone, supportEmail } = useAppStatus();
  const { isRateLimited, secondsLeft, triggerRateLimit } = useRateLimitCountdown();
  const theme = useTheme();
  const [, setLocation] = useLocation();
  const { state, logout } = useAdminAuth();
  const { toast: _toast } = useToast();
  const totpInputRef = useRef<HTMLInputElement>(null);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [totp, setTotp] = useState("");
  const [tempToken, setTempToken] = useState<string | null>(null);
  const [step, setStep] = useState<Step>("credentials");
  const [error, setError] = useState<string | null>(state.error);
  const [sessionExpiredOpen, setSessionExpiredOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);

  const errorText = useMemo(() => {
    if (!state.error) return error;
    if (state.error.toLowerCase().includes("session expired")) return "Session expired";
    return state.error;
  }, [error, state.error]);

  useEffect(() => {
    if (step !== "mfa") return;
    const timer = setTimeout(() => totpInputRef.current?.focus(), 50);
    return () => clearTimeout(timer);
  }, [step]);

  useEffect(() => {
    if (state.error?.toLowerCase().includes("session expired")) {
      setSessionExpiredOpen(true);
    }
  }, [state.error]);

  useEffect(() => {
    if (state.user && state.accessToken) {
      onSuccess?.();
      if (!onSuccess) setLocation("/dashboard");
    }
  }, [state.user, state.accessToken, onSuccess, setLocation]);

  async function handleCredentialsSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!username.trim() || !password.trim()) return;
    if (isRateLimited) return;
    const result = await loginWithPassword(username.trim(), password, undefined, undefined);
    if (result.error === "mfa_required") {
      setTempToken(result.data?.tempToken ?? null);
      setStep("mfa");
      setTotp("");
      return;
    }
    if (!result.success) {
      if (result.error?.toLowerCase().includes("locked") && result.retryAfter)
        triggerRateLimit(result.retryAfter);
      setError(result.error ?? "Login failed");
    } else {
      void import("@/lib/analytics").then(({ trackEvent: te }) =>
        te("admin_login", { method: "password" })
      );
    }
  }

  async function handleMfaSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!totp.trim() || !tempToken) return;
    const result = await loginWithPassword(username.trim(), password, totp, tempToken);
    if (!result.success) setError(result.error ?? "Invalid code");
  }

  async function handleLogout() {
    setLogoutOpen(false);
    await logout();
    setLocation("/login");
  }

  /* ── Maintenance screen ──────────────────────────────────────────────── */
  if (maintenance) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#0f1117] px-4">
        <div className="w-full max-w-[400px] rounded-2xl border border-white/[0.07] bg-white/[0.04] p-7 shadow-2xl backdrop-blur-md">
          <div className="mb-4 flex justify-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/30">
              <ShoppingBag className="h-7 w-7 text-white" />
            </div>
          </div>
          <h1 className="text-center text-2xl font-extrabold text-white">AJKMart Admin</h1>
          <p className="mt-2.5 text-center text-[13px] leading-relaxed text-white/50">
            {maintenanceMsg ?? "The admin panel is temporarily unavailable."}
          </p>
          {(supportPhone || supportEmail) && (
            <div className="mt-4 rounded-xl border border-white/[0.07] bg-white/[0.03] p-3.5 text-[13px] text-white/50">
              {supportPhone && (
                <div className="flex items-center gap-2">
                  <Phone className="h-3.5 w-3.5 shrink-0 text-white/30" />
                  {supportPhone}
                </div>
              )}
              {supportEmail && (
                <div className="mt-1 flex items-center gap-2">
                  <Mail className="h-3.5 w-3.5 shrink-0 text-white/30" />
                  {supportEmail}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ── Main login card ─────────────────────────────────────────────────── */
  return (
    <div className="grid min-h-screen place-items-center bg-[#0f1117] px-4 py-8">
      <div className="w-full max-w-[448px]">
        <div className="mb-7 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/30">
            <ShieldCheck className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-[28px] font-extrabold text-white">AJKMart Admin</h1>
          <p className="mt-2 text-[13px] text-white/55">
            {step === "credentials" ? "Sign in to continue" : "Two-factor verification"}
          </p>
        </div>

        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-7 shadow-[0_24px_70px_rgba(0,0,0,0.45)] backdrop-blur-md">
          {errorText && <AuthErrorBanner>{errorText}</AuthErrorBanner>}

          {step === "credentials" ? (
            <FadeStep>
              <form onSubmit={handleCredentialsSubmit} className="mt-4 grid gap-4">
                <div className="space-y-1.5">
                  <AuthLabel htmlFor="ls-username">Username or Email</AuthLabel>
                  <div className="relative">
                    <UserRound className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-white/28" />
                    <Input
                      id="ls-username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      autoComplete="username"
                      placeholder="admin@example.com"
                      className="h-11 rounded-xl border-white/10 bg-white/[0.06] pl-10 text-sm text-white placeholder:text-white/25 focus:border-indigo-400/60 focus:bg-white/[0.08] focus:ring-indigo-400/15"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <AuthLabel htmlFor="ls-password">Password</AuthLabel>
                  <div className="relative">
                    <Input
                      id="ls-password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="current-password"
                      placeholder="Enter your password"
                      className="h-11 rounded-xl border-white/10 bg-white/[0.06] pr-10 text-sm text-white placeholder:text-white/25 focus:border-indigo-400/60 focus:bg-white/[0.08] focus:ring-indigo-400/15"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-white/35 transition-colors hover:text-white/60 focus-visible:outline-none"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <label className="flex cursor-pointer items-center gap-2.5 text-[13px] text-white/72">
                    <Checkbox
                      checked={rememberMe}
                      onCheckedChange={(v) => setRememberMe(Boolean(v))}
                    />
                    Remember me
                  </label>
                  <span className="text-[12px] text-white/35">
                    {rememberMe ? "7-day session" : "8-hour session"}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setLocation("/forgot-password")}
                  className="justify-self-start border-none bg-transparent p-0 text-[13px] font-semibold text-indigo-400 transition-colors hover:text-indigo-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/40"
                >
                  Forgot Password?
                </button>

                <button
                  type="submit"
                  disabled={isLoading || isRateLimited || !username.trim() || !password.trim()}
                  className="flex h-[46px] w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 text-[14px] font-extrabold text-white shadow-lg shadow-indigo-500/25 transition-all duration-200 hover:bg-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60 disabled:opacity-50"
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : isRateLimited ? (
                    `Try again in ${secondsLeft}s`
                  ) : (
                    <>Sign In <ArrowRight className="h-4 w-4" /></>
                  )}
                </button>
              </form>
            </FadeStep>
          ) : (
            <FadeStep>
              <form onSubmit={handleMfaSubmit} className="mt-4 grid gap-4">
                <div className="rounded-2xl border border-indigo-400/22 bg-indigo-400/[0.08] px-4 py-3.5 text-[13px] leading-relaxed text-white/86">
                  Enter the 6-digit code from your authenticator app.
                </div>

                <OtpInput length={6} onComplete={setTotp} label="Authenticator code" />

                <p className="text-[12px] leading-relaxed text-white/38">
                  Resend not available — check your authenticator app.
                </p>

                <button
                  type="button"
                  onClick={() => setLocation("/forgot-password")}
                  className="justify-self-start border-none bg-transparent p-0 text-[13px] font-semibold text-indigo-400 transition-colors hover:text-indigo-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/40"
                >
                  Lost access to authenticator? Use backup code
                </button>

                <div className="flex gap-2.5">
                  <button
                    type="button"
                    onClick={() => { setStep("credentials"); setTempToken(null); setTotp(""); }}
                    className="flex h-[42px] items-center gap-1.5 rounded-xl border border-white/12 bg-white/[0.04] px-4 text-[13px] font-bold text-white/80 transition-all duration-200 hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={totp.length !== 6 || isLoading}
                    className="flex h-[42px] flex-1 items-center justify-center gap-2 rounded-xl bg-indigo-600 text-[14px] font-extrabold text-white transition-all duration-200 hover:bg-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60 disabled:opacity-50"
                  >
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify"}
                  </button>
                </div>
              </form>
            </FadeStep>
          )}

          <div className="mt-5 flex items-center gap-2.5 text-[12px] text-white/35">
            <Mail className="h-3.5 w-3.5 shrink-0" />
            Contact support if you cannot access your account.
          </div>
        </div>
      </div>

      <Dialog open={sessionExpiredOpen} onOpenChange={setSessionExpiredOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogTitle>Session expired</DialogTitle>
          <DialogDescription>Please sign in again to continue.</DialogDescription>
          <div className="grid gap-2.5">
            <button
              type="button"
              onClick={() => { setSessionExpiredOpen(false); setLocation("/login"); }}
              className="h-11 rounded-xl bg-indigo-600 font-semibold text-white transition-all duration-200 hover:bg-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60"
            >
              Sign in
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={logoutOpen} onOpenChange={setLogoutOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogTitle>Sign out?</DialogTitle>
          <DialogDescription>
            You will need to sign in again to access the admin panel.
          </DialogDescription>
          <div className="flex justify-end gap-2.5">
            <button
              type="button"
              onClick={() => setLogoutOpen(false)}
              className="h-10 rounded-xl border border-white/10 px-4 text-[13px] font-medium text-white/70 transition-colors hover:bg-white/[0.06]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="h-10 rounded-xl bg-red-600 px-4 text-[13px] font-semibold text-white transition-all duration-200 hover:bg-red-500"
            >
              Sign Out
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default LoginScreen;
