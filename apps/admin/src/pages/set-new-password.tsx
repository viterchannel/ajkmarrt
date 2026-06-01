import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useAdminAuth } from "@/lib/adminAuthContext";
import {
  computeStrength,
  STRENGTH_META,
  validateStrength,
} from "@/lib/auth/passwordStrength";
import { ArrowRight, Eye, EyeOff, KeyRound, Loader2, LogOut, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";

export default function SetNewPassword() {
  const [, navigate] = useLocation();
  const { state, changePassword, logout } = useAdminAuth();
  const { toast } = useToast();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!state.isLoading && !state.accessToken) navigate("/login");
  }, [state.isLoading, state.accessToken, navigate]);

  const strengthLevel = computeStrength(newPassword);
  const sm = STRENGTH_META[strengthLevel];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (newPassword !== confirmPassword) {
      setError("The two new passwords do not match.");
      return;
    }
    const strengthError = validateStrength(newPassword);
    if (strengthError) {
      setError(strengthError);
      return;
    }
    if (newPassword === currentPassword) {
      setError("Your new password must be different from your current password.");
      return;
    }
    setSubmitting(true);
    try {
      await changePassword(currentPassword, newPassword);
      toast({ title: "Password updated", description: "Welcome aboard. You're all set." });
      navigate("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to change password");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSignOut() {
    try {
      await logout();
    } finally {
      navigate("/login");
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-[#0f1117] px-4">
      <div className="w-full max-w-[420px]">
        <div className="mb-7 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/30">
            <KeyRound className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Set new password</h1>
          <p className="mt-1.5 text-[13px] text-white/50">Update your admin password anytime</p>
        </div>

        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.04] p-7 shadow-2xl backdrop-blur-md">
          <div className="mb-5 flex items-start gap-3 rounded-xl border border-indigo-400/20 bg-indigo-400/8 px-4 py-3">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-indigo-400" />
            <p className="text-[12px] leading-snug text-white/50">
              This step is optional — your current password keeps working until you change it.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <label
                htmlFor="snp-current"
                className="block text-[11px] font-semibold tracking-widest text-white/40 uppercase"
              >
                Current password
              </label>
              <div className="relative">
                <Input
                  id="snp-current"
                  type={showCurrent ? "text" : "password"}
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Your current password"
                  className="h-11 rounded-xl border-white/10 bg-white/[0.06] pr-10 text-sm text-white placeholder:text-white/25 focus:border-indigo-400/60 focus:bg-white/[0.08] focus:ring-indigo-400/15"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent((v) => !v)}
                  aria-label={showCurrent ? "Hide password" : "Show password"}
                  className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-white/30 transition-colors hover:text-white/60"
                >
                  {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="snp-new"
                className="block text-[11px] font-semibold tracking-widest text-white/40 uppercase"
              >
                New password
              </label>
              <div className="relative">
                <Input
                  id="snp-new"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min 8 chars, 1 uppercase, 1 number"
                  className="h-11 rounded-xl border-white/10 bg-white/[0.06] pr-10 text-sm text-white placeholder:text-white/25 focus:border-indigo-400/60 focus:bg-white/[0.08] focus:ring-indigo-400/15"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-white/30 transition-colors hover:text-white/60"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {newPassword.length > 0 && (
                <div className="space-y-1.5 pt-0.5">
                  <div className="flex gap-1">
                    {([1, 2, 3, 4] as const).map((bar) => (
                      <div
                        key={bar}
                        className={`h-1 flex-1 rounded-full transition-all duration-300 ${strengthLevel >= bar ? sm.bar : "bg-white/10"}`}
                      />
                    ))}
                  </div>
                  {strengthLevel > 0 && (
                    <p className={`text-[11px] font-semibold ${sm.text}`}>{sm.label}</p>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="snp-confirm"
                className="block text-[11px] font-semibold tracking-widest text-white/40 uppercase"
              >
                Confirm password
              </label>
              <div className="relative">
                <Input
                  id="snp-confirm"
                  type={showConfirm ? "text" : "password"}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter the new password"
                  className="h-11 rounded-xl border-white/10 bg-white/[0.06] pr-10 text-sm text-white placeholder:text-white/25 focus:border-indigo-400/60 focus:bg-white/[0.08] focus:ring-indigo-400/15"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((v) => !v)}
                  aria-label={showConfirm ? "Hide password" : "Show password"}
                  className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-white/30 transition-colors hover:text-white/60"
                >
                  {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && (
              <p className="rounded-lg border border-red-500/20 bg-red-500/8 px-3 py-2 text-[13px] text-red-400 animate-in slide-in-from-top-1 duration-200">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting || !currentPassword || !newPassword || !confirmPassword}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-2.5 text-[14px] font-bold text-white shadow-lg shadow-indigo-500/25 transition-all duration-200 hover:bg-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60 disabled:opacity-50"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  Update password <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleSignOut}
              className="flex w-full items-center justify-center gap-1.5 text-[12px] font-medium text-white/30 transition-colors hover:text-white/60"
            >
              <LogOut className="h-3.5 w-3.5" /> Sign out instead
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
