import { TwoFactorSetup, TwoFactorVerify } from "@workspace/auth-utils";
import { tDual, type TranslationKey } from "@workspace/i18n";
import {
  ArrowLeft,
  ChevronRight,
  Clock,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Shield,
  ShieldCheck,
  ShieldOff,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "../components/ui/accordion";
import { api, apiFetch } from "../lib/api";
import { useAuth } from "../lib/rider-auth";
import { usePlatformConfig } from "../lib/useConfig";
import { useLanguage } from "../lib/useLanguage";

function getPasswordStrength(pw: string): { level: number; label: TranslationKey; labelEn: string; color: string } {
  if (!pw) return { level: 0, label: "passwordWeak", labelEn: "", color: "" };
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 1) return { level: 1, label: "passwordWeak", labelEn: "Weak", color: "bg-error" };
  if (score <= 2) return { level: 2, label: "passwordFair", labelEn: "Fair", color: "bg-warning" };
  if (score <= 3) return { level: 3, label: "passwordGood", labelEn: "Good", color: "bg-yellow-400" };
  return { level: 4, label: "passwordStrong", labelEn: "Strong", color: "bg-success" };
}

function PasswordChangeSection({
  showToastFn,
  T,
}: {
  showToastFn: (msg: string) => void;
  T: (key: TranslationKey) => string;
}) {
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);
  const [pwError, setPwError] = useState("");
  const strength = getPasswordStrength(newPw);

  const handleChangePassword = async () => {
    setPwError("");
    if (!newPw || newPw.length < 8) {
      setPwError(T("passwordMinLength"));
      return;
    }
    if (newPw !== confirmPw) {
      setPwError(T("passwordsDoNotMatch"));
      return;
    }
    setPwLoading(true);
    try {
      await apiFetch("/auth/set-password", {
        method: "POST",
        body: JSON.stringify({ password: newPw, currentPassword: currentPw || undefined }),
      });
      setCurrentPw("");
      setNewPw("");
      setConfirmPw("");
      showToastFn(T("passwordUpdated"));
    } catch (e: unknown) {
      setPwError(e instanceof Error ? e.message : T("passwordChangeFailed"));
    } finally {
      setPwLoading(false);
    }
  };

  return (
    <div className="px-5 pb-1">
      <div className="space-y-3">
        <div className="relative">
          <input
            type={showCurrent ? "text" : "password"}
            value={currentPw}
            onChange={(e) => setCurrentPw(e.target.value)}
            placeholder={T("currentPasswordHint")}
            className="h-11 w-full rounded-xl border border-white/10 bg-card-dark px-4 pr-10 text-sm transition-all focus:bg-card-dark focus:ring-2 focus:ring-gray-900 focus:outline-none"
          />
          <button
            type="button"
            onClick={() => setShowCurrent(!showCurrent)}
            aria-label={showCurrent ? T("hidePassword") : T("showPassword")}
            className="absolute top-1/2 right-3 -translate-y-1/2 text-[#B0B0B0]"
          >
            {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        <div>
          <div className="relative">
            <input
              type={showNew ? "text" : "password"}
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              placeholder={T("newPasswordLabel")}
              className="h-11 w-full rounded-xl border border-white/10 bg-card-dark px-4 pr-10 text-sm transition-all focus:bg-card-dark focus:ring-2 focus:ring-gray-900 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => setShowNew(!showNew)}
              aria-label={showNew ? T("hidePassword") : T("showPassword")}
              className="absolute top-1/2 right-3 -translate-y-1/2 text-[#B0B0B0]"
            >
              {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {newPw && (
            <div className="mt-1.5">
              <div className="mb-1 flex gap-1">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className={`h-1 flex-1 rounded-full transition-all duration-300 ${i <= strength.level ? strength.color : "bg-border-dark"}`}
                  />
                ))}
              </div>
              <p
                className={`text-[10px] font-bold ${strength.level <= 1 ? "text-error" : strength.level <= 2 ? "text-warning" : strength.level <= 3 ? "text-yellow-600" : "text-success"}`}
              >
                {T(strength.label) || strength.labelEn}
              </p>
            </div>
          )}
        </div>
        <div className="relative">
          <input
            type={showConfirm ? "text" : "password"}
            value={confirmPw}
            onChange={(e) => setConfirmPw(e.target.value)}
            placeholder={T("confirmNewPassword")}
            className="h-11 w-full rounded-xl border border-white/10 bg-card-dark px-4 pr-10 text-sm transition-all focus:bg-card-dark focus:ring-2 focus:ring-gray-900 focus:outline-none"
          />
          <button
            type="button"
            onClick={() => setShowConfirm(!showConfirm)}
            aria-label={showConfirm ? T("hidePassword") : T("showPassword")}
            className="absolute top-1/2 right-3 -translate-y-1/2 text-[#B0B0B0]"
          >
            {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>

        {pwError && (
          <p className="rounded-lg bg-error/10 px-3 py-2 text-xs text-error">{pwError}</p>
        )}

        <button
          onClick={handleChangePassword}
          disabled={pwLoading || !newPw}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand text-sm font-bold text-white transition-colors hover:bg-card-dark disabled:opacity-60"
        >
          {pwLoading ? <Loader2 size={16} className="animate-spin" /> : <Lock size={16} />}
          {pwLoading ? T("pleaseWait") : T("updatePassword")}
        </button>
      </div>
    </div>
  );
}

type ViewState = "main" | "setup" | "verify-disable";

export default function SecuritySettings() {
  const { config } = usePlatformConfig();
  const { language } = useLanguage();
  const { user, refreshUser } = useAuth();
  const T = (key: TranslationKey) => tDual(key, language); // eslint-disable-line react-hooks/exhaustive-deps

  const [view, setView] = useState<ViewState>("main");
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState("");
  const [error, setError] = useState("");
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [backupCodesSaved, setBackupCodesSaved] = useState(false);

  const [is2faEnabled, setIs2faEnabled] = useState(() => !!user?.twoFactorEnabled);

  const [setupData, setSetupData] = useState<{
    qrCodeDataUrl: string;
    secret: string;
    backupCodes: string[];
  } | null>(null);

  const [verifyError, setVerifyError] = useState("");
  const [verifyLoading, setVerifyLoading] = useState(false);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  const showToast = (msg: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast(msg);
    toastTimerRef.current = setTimeout(() => setToast(""), 3500);
  };

  const handleToggle2fa = async () => {
    setError("");
    if (is2faEnabled) {
      setView("verify-disable");
    } else {
      setLoading(true);
      try {
        const data = await api.twoFactorSetup();
        setSetupData({
          qrCodeDataUrl: data.qrDataUrl || data.qrCodeDataUrl || data.qrCode || "",
          secret: data.secret || "",
          backupCodes: data.backupCodes || [],
        });
        setBackupCodesSaved(false);
        setView("setup");
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : T("sendOtpFailed"));
      }
      setLoading(false);
    }
  };

  const handleSetupVerify = useCallback(
    async (code: string) => {
      setVerifyLoading(true);
      setVerifyError("");
      try {
        const res = await api.twoFactorEnable({ code });
        if (res.backupCodes && setupData) {
          setSetupData({ ...setupData, backupCodes: res.backupCodes });
        }
        setIs2faEnabled(true);
        await refreshUser();
        showToast(T("twoFactorEnableSuccess"));
        if (!res.backupCodes || res.backupCodes.length === 0) {
          setView("main");
        }
        /* If backup codes are present, stay on setup screen until rider clicks Done */
      } catch (e: unknown) {
        setVerifyError(e instanceof Error ? e.message : T("verificationFailed"));
      }
      setVerifyLoading(false);
    },
    [T, setupData, refreshUser]
  );

  const handleDisableVerify = useCallback(
    async (code: string) => {
      setVerifyLoading(true);
      setVerifyError("");
      try {
        await api.twoFactorDisable({ code });
        setIs2faEnabled(false);
        await refreshUser();
        setView("main");
        showToast(T("twoFactorDisableSuccess"));
      } catch (e: unknown) {
        setVerifyError(e instanceof Error ? e.message : T("verificationFailed"));
      }
      setVerifyLoading(false);
    },
    [T, refreshUser]
  );

  if (view === "setup" && setupData) {
    const hasBackupCodes = setupData.backupCodes && setupData.backupCodes.length > 0;
    return (
      <div className="min-h-screen bg-page-bg">
        <div
          className="relative overflow-hidden rounded-b-[2rem] bg-gradient-to-b from-gray-900 via-gray-900 to-gray-800 px-5 pb-8"
          style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 3.5rem)" }}
        >
          <div className="absolute top-[-30%] right-[-15%] h-64 w-64 rounded-full bg-card-dark/[0.02]" />
          <div className="absolute bottom-[-20%] left-[-10%] h-48 w-48 rounded-full bg-success/[0.04]" />
          <button
            onClick={() => setView("main")}
            className="relative z-10 mb-3 flex items-center gap-1 text-sm font-semibold text-white/60"
          >
            <ArrowLeft size={14} /> {T("back")}
          </button>
          <h1 className="relative z-10 text-xl font-bold text-white">
            {T("twoFactorAuthentication")}
          </h1>
        </div>
        <div className="relative z-10 -mt-4 space-y-3 px-4">
          <div className="rounded-3xl border border-white/10 bg-card-dark p-5 shadow-sm">
            <TwoFactorSetup
              qrCodeDataUrl={setupData.qrCodeDataUrl}
              secret={setupData.secret}
              backupCodes={setupData.backupCodes}
              onVerify={handleSetupVerify}
              verifyLoading={verifyLoading}
              verifyError={verifyError}
              appName={config.platform.appName}
            />
          </div>
          {is2faEnabled && hasBackupCodes && (
            <div className="space-y-3 rounded-3xl border border-white/10 bg-card-dark p-5 shadow-sm">
              <p className="text-xs leading-relaxed text-[#B0B0B0]">
                {T("twoFaBackupSaveNote")}
              </p>
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={backupCodesSaved}
                  onChange={(e) => setBackupCodesSaved(e.target.checked)}
                  className="h-4 w-4 rounded accent-gray-900"
                />
                <span className="text-sm font-semibold text-[#B0B0B0]">
                  {T("savedBackupCodes")}
                </span>
              </label>
              <button
                onClick={() => {
                  if (backupCodesSaved) setView("main");
                }}
                disabled={!backupCodesSaved}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand text-sm font-bold text-white transition-all disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-brand/40 focus:outline-none"
              >
                <ShieldCheck size={16} /> {T("doneReturnSecurity")}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (view === "verify-disable") {
    return (
      <div className="min-h-screen bg-page-bg">
        <div
          className="relative overflow-hidden rounded-b-[2rem] bg-gradient-to-b from-gray-900 via-gray-900 to-gray-800 px-5 pb-8"
          style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 3.5rem)" }}
        >
          <div className="absolute top-[-30%] right-[-15%] h-64 w-64 rounded-full bg-card-dark/[0.02]" />
          <div className="absolute bottom-[-20%] left-[-10%] h-48 w-48 rounded-full bg-success/[0.04]" />
          <button
            onClick={() => setView("main")}
            className="relative z-10 mb-3 flex items-center gap-1 text-sm font-semibold text-white/60"
          >
            <ArrowLeft size={14} /> {T("back")}
          </button>
          <h1 className="relative z-10 text-xl font-bold text-white">
            {T("twoFactorVerification")}
          </h1>
        </div>
        <div className="relative z-10 -mt-4 px-4">
          <div className="rounded-3xl border border-white/10 bg-card-dark p-5 shadow-sm">
            <TwoFactorVerify
              onVerify={handleDisableVerify}
              verifyLoading={verifyLoading}
              verifyError={verifyError}
              showTrustDevice={false}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-page-bg">
      <div
        className="relative overflow-hidden rounded-b-[2rem] bg-gradient-to-b from-gray-900 via-gray-900 to-gray-800 px-5 pb-8"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 3.5rem)" }}
      >
        <div className="absolute top-[-30%] right-[-15%] h-64 w-64 rounded-full bg-card-dark/[0.02]" />
        <div className="absolute bottom-[-20%] left-[-10%] h-48 w-48 rounded-full bg-success/[0.04]" />
        <div className="relative z-10 mb-2 flex items-center gap-3">
          <Link href="/profile" className="text-white/60 transition-colors hover:text-white">
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-xl font-bold text-white">{T("securitySettings")}</h1>
        </div>
      </div>

      <div className="mx-auto mt-4 max-w-md space-y-4 px-4">
        <Accordion type="multiple" defaultValue={["password", "2fa"]}>
          <AccordionItem
            value="password"
            className="mb-4 overflow-hidden rounded-3xl border border-white/10 bg-card-dark shadow-sm"
          >
            <AccordionTrigger className="px-5 py-4 hover:no-underline">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-blue-500/15">
                  <Lock size={20} className="text-blue-400" />
                </div>
                <div className="text-left">
                  <span className="block text-[15px] font-bold text-white">{T("password")}</span>
                  <span className="text-xs text-[#B0B0B0]">{T("changePasswordSub")}</span>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <PasswordChangeSection showToastFn={showToast} T={T} />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem
            value="login-history"
            className="mb-4 overflow-hidden rounded-3xl border border-white/10 bg-card-dark shadow-sm"
          >
            <AccordionTrigger className="px-5 py-4 hover:no-underline">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-purple-50">
                  <Clock size={20} className="text-purple-500" />
                </div>
                <div className="text-left">
                  <span className="block text-[15px] font-bold text-white">{T("loginHistory")}</span>
                  <span className="text-xs text-[#B0B0B0]">{T("loginHistorySub")}</span>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="px-5 pb-4">
                <p className="mb-3 text-xs leading-relaxed text-[#B0B0B0]">
                  {T("loginHistoryDesc")}
                </p>
                <Link
                  href="/settings/login-history"
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand text-sm font-bold text-white transition-colors hover:bg-card-dark"
                >
                  <Clock size={15} />
                  {T("viewLoginHistory")}
                  <ChevronRight size={14} className="ml-auto" />
                </Link>
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem
            value="2fa"
            className="overflow-hidden rounded-3xl border border-white/10 bg-card-dark shadow-sm"
          >
            <AccordionTrigger className="px-5 py-4 hover:no-underline">
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${is2faEnabled ? "bg-success/15" : "bg-border-dark"}`}
                >
                  {is2faEnabled ? (
                    <ShieldCheck size={20} className="text-success" />
                  ) : (
                    <Shield size={20} className="text-[#B0B0B0]" />
                  )}
                </div>
                <div className="text-left">
                  <span className="block text-[15px] font-bold text-white">
                    {T("twoFactorAuthentication")}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-bold ${is2faEnabled ? "bg-success/15 text-success" : "bg-border-dark text-[#B0B0B0]"}`}
                  >
                    {is2faEnabled ? T("twoFactorEnabled") : T("twoFactorDisabled")}
                  </span>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="px-5 pb-1">
                <p className="mb-4 text-xs leading-relaxed text-[#B0B0B0]">{T("twoFactorDesc")}</p>
                <button
                  onClick={handleToggle2fa}
                  disabled={loading}
                  className={`flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-bold transition-colors disabled:opacity-60 ${
                    is2faEnabled
                      ? "border-2 border-error/30 text-error hover:bg-error/10"
                      : "bg-brand text-white hover:bg-card-dark"
                  }`}
                >
                  {loading ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : is2faEnabled ? (
                    <ShieldOff size={16} />
                  ) : (
                    <ShieldCheck size={16} />
                  )}
                  {loading ? T("pleaseWait") : is2faEnabled ? T("disable2fa") : T("enable2fa")}
                </button>
                {error && (
                  <p className="mt-3 rounded-lg bg-error/10 px-3 py-2 text-sm text-error">
                    {error}
                  </p>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>

      {toast && (
        <div
          className="pointer-events-none fixed top-0 right-0 left-0 z-50 flex justify-center"
          style={{
            paddingTop: "calc(env(safe-area-inset-top,0px) + 12px)",
            paddingLeft: "16px",
            paddingRight: "16px",
          }}
        >
          <div className="pointer-events-auto w-full max-w-sm rounded-2xl bg-brand px-5 py-3 text-center text-sm font-semibold text-white shadow-2xl">
            {toast}
          </div>
        </div>
      )}
    </div>
  );
}
