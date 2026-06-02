import { createLogger } from "@/lib/logger";
import { ShimmerBlock } from "@/components/ui/shimmer";
import { useMutation } from "@tanstack/react-query";
import { formatCurrency as _sharedFcR } from "@workspace/api-zod";
import { tDual, type TranslationKey } from "@workspace/i18n";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle,
  ChevronRight,
  Clock,
  Landmark,
  Lightbulb,
  Loader2,
  Smartphone,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { api, apiFetch } from "../../lib/api";
import { useAuth } from "../../lib/rider-auth";
import { useCurrency } from "../../lib/useConfig";
import { useLanguage } from "../../lib/useLanguage";
import {
  checkPromoStackable,
  checkSufficientBalance,
  validatePromo,
  type PromoCode,
} from "../../lib/wallet/validation";
import type { PayMethod } from "./WithdrawModal";
const log = createLogger("[RemittanceModal]");
const INPUT =
  "w-full h-12 px-4 bg-card border border-border rounded-xl text-sm focus:outline-none focus:border-blue-400 focus:bg-card transition-colors";

function MethodLogo({ id }: { id: string }) {
  if (id === "jazzcash") return <Smartphone size={28} className="text-error" />;
  if (id === "easypaisa") return <Smartphone size={28} className="text-success" />;
  return <Landmark size={28} className="text-blue-500" />;
}

export default function RemittanceModal({
  netOwed,
  codCollected,
  pendingFullRemittance = false,
  onClose,
  onSuccess,
}: {
  netOwed: number;
  codCollected?: number;
  pendingFullRemittance?: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { user } = useAuth();
  const { language } = useLanguage();
  const T = (key: TranslationKey) => tDual(key, language);
  const { symbol: currencySymbol } = useCurrency();
  const fc = (n: string | number | null | undefined) =>
    _sharedFcR(n != null ? String(n) : (n as null | undefined), currencySymbol);
  const [step, setStep] = useState<"method" | "details" | "confirm" | "done">("method");
  const [method, setMethod] = useState<PayMethod | null>(null);
  const [amount, setAmount] = useState(String(Math.ceil(netOwed)));
  const [acNo, setAcNo] = useState("");
  const [txId, setTxId] = useState("");
  const [note, setNote] = useState("");
  const [bonusCode, setBonusCode] = useState("");
  const [err, setErr] = useState("");
  const [methods, setMethods] = useState<PayMethod[]>([]);
  const [loadingMethods, setLoadingMethods] = useState(true);
  const [methodsError, setMethodsError] = useState(false);

  useEffect(() => {
    const abortCtrl = new AbortController();
    type ApiMethod = { id: string; label?: string; logo?: string; description?: string };
    apiFetch("/payments/methods", { signal: abortCtrl.signal })
      .then((data: { methods?: ApiMethod[] }) => {
        if (abortCtrl.signal.aborted) return;
        const ms: PayMethod[] = (data.methods || [])
          .filter((m) => ["jazzcash", "easypaisa", "bank"].includes(m.id))
          .map((m) => ({ ...m, label: m.label ?? m.id, logo: m.logo ?? m.id }));
        if (ms.length === 0) {
          setMethodsError(true);
        } else {
          setMethods(ms);
        }
      })
      .catch((err: Error) => {
        if (abortCtrl.signal.aborted) return;
        log.warn("Failed to load payment methods:", err.message);
        setMethodsError(true);
      })
      .finally(() => { if (!abortCtrl.signal.aborted) setLoadingMethods(false); });
    return () => abortCtrl.abort();
  }, []);

  const mut = useMutation({
    mutationFn: () =>
      api.submitCodRemittance({
        amount: Number(amount),
        paymentMethod: method?.id ?? "",
        accountNumber: acNo,
        transactionId: txId,
        note,
      }),
    onSuccess: () => setStep("done"),
    onError: (e: Error) => setErr(e.message),
  });

  const goToDetails = (m: PayMethod) => {
    setMethod(m);
    setAcNo(m.manualNumber || m.iban || "");
    setErr("");
    setStep("details");
  };

  const goToConfirm = () => {
    const amt = Number(amount);
    if (!amount || isNaN(amt) || amt < 1) {
      setErr(T("amountMinOneHint").replace("{sym}", currencySymbol));
      return;
    }
    if (codCollected != null && amt > codCollected) {
      setErr(T("amountExceedsCodHint").replace("{amount}", fc(codCollected)));
      return;
    }
    if (amt > netOwed) {
      setErr(T("amountExceedsOwedHint").replace("{amount}", fc(netOwed)));
      return;
    }
    if (pendingFullRemittance && amt >= netOwed) {
      setErr(T("fullRemittancePendingHint"));
      return;
    }
    const balanceCheck = checkSufficientBalance(netOwed, amt);
    if (!balanceCheck.valid) {
      setErr(T(balanceCheck.reason as TranslationKey));
      return;
    }
    if (!acNo.trim()) {
      setErr(T("accountPhoneRequired"));
      return;
    }
    if (!txId.trim()) {
      setErr(T("txRefRequired"));
      return;
    }
    /* Promo / bonus code validation — riders may optionally enter a platform-
       issued bonus code for COD remittance campaigns.
       checkPromoStackable ensures they cannot apply more than one promo at a time.
       validatePromo checks expiry and per-user usage limits client-side before
       the mutation hits the server (server also validates; this is a first-pass
       guard that gives immediate, translated feedback). */
    if (bonusCode.trim()) {
      const activeBonuses: PromoCode[] = [{ id: bonusCode.trim() }];
      const stackCheck = checkPromoStackable(activeBonuses);
      if (!stackCheck.valid) {
        setErr(T(stackCheck.reason as TranslationKey));
        return;
      }
      const promoEntry: PromoCode = { id: bonusCode.trim() };
      const promoCheck = validatePromo(promoEntry, user?.id ?? "");
      if (!promoCheck.valid) {
        setErr(T(promoCheck.reason as TranslationKey));
        return;
      }
    }
    setErr("");
    setStep("confirm");
  };

  const STEP_LABELS = ["method", "details", "confirm"];
  const stepIdx = STEP_LABELS.indexOf(step);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={T("remitCodCash")}
    >
      <div
        className="flex max-h-[93vh] w-full max-w-md flex-col rounded-t-3xl bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-shrink-0 justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-muted" />
        </div>
        {step !== "done" && stepIdx >= 0 && (
          <div className="flex-shrink-0 px-6 pb-3">
            <div className="mt-1 flex gap-1.5" role="progressbar" aria-valuenow={stepIdx + 1} aria-valuemax={STEP_LABELS.length}>
              {STEP_LABELS.map((_, i) => (
                <div
                  key={i}
                  className={`h-1 flex-1 rounded-full transition-all ${i <= stepIdx ? "bg-blue-500" : "bg-muted"}`}
                />
              ))}
            </div>
            <p className="mt-1 text-right text-[10px] text-muted-foreground">
              {T("step")} {stepIdx + 1}/{STEP_LABELS.length}
            </p>
          </div>
        )}
        <div className="flex-1 overflow-y-auto">
          {/* DONE */}
          {step === "done" && (
            <div className="p-8 text-center">
              <div className="mx-auto mb-5 flex h-24 w-24 items-center justify-center rounded-full bg-blue-500/15">
                <CheckCircle size={52} className="text-blue-500" />
              </div>
              <h3 className="text-2xl font-extrabold text-foreground">{T("remittanceSubmitted")}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{T("remittanceAdminVerify")}</p>
              <div className="mt-5 space-y-3 rounded-2xl bg-blue-500/10 p-5 text-left">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{T("methodLabel")}</span>
                  <span className="flex items-center gap-1.5 font-bold">
                    <MethodLogo id={method?.id ?? ""} /> {method?.label}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{T("toAccount")}</span>
                  <span className="font-mono font-bold">{acNo}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{T("txRef")}</span>
                  <span className="font-mono font-bold">{txId}</span>
                </div>
                <div className="flex items-center justify-between border-t border-blue-100 pt-2">
                  <span className="font-semibold text-muted-foreground">{T("amountRemitted")}</span>
                  <span className="text-2xl font-extrabold text-blue-400">
                    {fc(Number(amount))}
                  </span>
                </div>
              </div>
              <button
                onClick={() => {
                  onSuccess();
                  onClose();
                }}
                className="mt-5 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 font-extrabold text-white"
              >
                <CheckCircle size={20} /> {T("done")}
              </button>
            </div>
          )}

          {/* CONFIRM */}
          {step === "confirm" && (
            <div className="p-6">
              <h3 className="mb-1 text-xl font-extrabold text-foreground">{T("confirmRemittance")}</h3>
              <p className="mb-5 text-sm text-muted-foreground">{T("reviewConfirm")}</p>
              <div className="mb-4 space-y-3 rounded-2xl border border-blue-100 bg-blue-500/10 p-5">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{T("amountLabel")}</span>
                  <span className="text-3xl font-extrabold text-blue-400">
                    {fc(Number(amount))}
                  </span>
                </div>
                <div className="h-px bg-blue-500/15" />
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{T("methodLabel")}</span>
                  <span className="flex items-center gap-1.5 font-bold">
                    <MethodLogo id={method?.id ?? ""} /> {method?.label}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{T("toAccount")}</span>
                  <span className="font-mono font-bold">{acNo}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{T("txRef")}</span>
                  <span className="font-mono font-bold">{txId}</span>
                </div>
              </div>
              {err && (
                <div className="mb-3 flex items-center gap-2 rounded-xl bg-error/10 px-4 py-2.5" role="alert">
                  <AlertTriangle size={14} className="text-error" />
                  <p className="text-sm font-semibold text-error">{err}</p>
                </div>
              )}
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setStep("details");
                    setErr("");
                  }}
                  aria-label={T("edit")}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-2xl border-2 border-border py-3 text-sm font-bold text-muted-foreground"
                >
                  <ArrowLeft size={14} /> {T("edit")}
                </button>
                <button
                  onClick={() => mut.mutate()}
                  disabled={mut.isPending}
                  aria-label={T("submitRemittance")}
                  className="flex flex-[2] items-center justify-center gap-2 rounded-2xl bg-blue-600 py-3 text-sm font-extrabold text-white disabled:opacity-60"
                >
                  {mut.isPending ? (
                    <>
                      <Loader2 size={16} className="animate-spin" /> {T("submitting")}
                    </>
                  ) : (
                    <>
                      <CheckCircle size={16} /> {T("submitRemittance")}
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* DETAILS */}
          {step === "details" && method && (
            <div className="p-6">
              <button
                onClick={() => setStep("method")}
                aria-label={T("back")}
                className="mb-4 flex items-center gap-1 text-sm font-semibold text-muted-foreground"
              >
                <ArrowLeft size={14} /> {T("back")}
              </button>
              <h3 className="mb-4 flex items-center gap-2 text-xl font-extrabold text-foreground">
                <MethodLogo id={method.id} /> {method.label}
              </h3>

              {/* Admin-configured destination account (read-only) */}
              {(method.manualNumber || method.iban || method.instructions) && (
                <div className="mb-4 space-y-2 rounded-2xl border border-blue-500/30 bg-blue-500/10 p-4">
                  <p className="text-xs font-bold tracking-wide text-blue-400 uppercase">
                    {T("sendToCompany")}
                  </p>
                  {method.accountTitle && (
                    <div className="flex justify-between text-sm">
                      <span className="font-medium text-blue-500">{T("accountName")}</span>
                      <span className="font-bold text-blue-900">{method.accountTitle}</span>
                    </div>
                  )}
                  {(method.manualNumber || method.iban) && (
                    <div className="flex justify-between text-sm">
                      <span className="font-medium text-blue-500">
                        {method.id === "bank" ? T("ibanOrAccount") : T("phone")}
                      </span>
                      <span className="font-mono font-bold text-blue-900">
                        {method.iban || method.manualNumber}
                      </span>
                    </div>
                  )}
                  {method.bankName && (
                    <div className="flex justify-between text-sm">
                      <span className="font-medium text-blue-500">{T("bankName")}</span>
                      <span className="font-bold text-blue-900">{method.bankName}</span>
                    </div>
                  )}
                  {method.instructions && (
                    <p className="mt-1 border-t border-blue-500/30 pt-2 text-xs text-blue-400">
                      {method.instructions}
                    </p>
                  )}
                </div>
              )}

              <div className="space-y-3">
                <div>
                  <p className="mb-1.5 text-xs font-bold tracking-wider text-muted-foreground uppercase">
                    {T("amountLabel")} ({currencySymbol}) *
                  </p>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={amount}
                    min={1}
                    max={Math.ceil(netOwed)}
                    onChange={(e) => {
                      setAmount(e.target.value);
                      setErr("");
                    }}
                    aria-label={T("amountLabel")}
                    className={INPUT}
                    placeholder="0"
                  />
                </div>
                <div>
                  <p className="mb-1.5 text-xs font-bold tracking-wider text-muted-foreground uppercase">
                    {method.id === "bank" ? T("yourAccountNoSender") : T("yourPhoneSender")} *
                  </p>
                  <input
                    value={acNo}
                    onChange={(e) => {
                      setAcNo(e.target.value);
                      setErr("");
                    }}
                    placeholder={method.id === "bank" ? T("yourIbanAccountNo") : "03XX-XXXXXXX"}
                    aria-label={method.id === "bank" ? T("yourAccountNoSender") : T("yourPhoneSender")}
                    className={INPUT}
                  />
                </div>
                <div>
                  <p className="mb-1.5 text-xs font-bold tracking-wider text-muted-foreground uppercase">
                    {T("txReference")} *
                  </p>
                  <input
                    value={txId}
                    onChange={(e) => {
                      setTxId(e.target.value);
                      setErr("");
                    }}
                    placeholder="JazzCash/EasyPaisa TxID"
                    aria-label={T("txReference")}
                    className={INPUT}
                  />
                  <p className="mt-1 text-[10px] text-muted-foreground">{T("txIdFromSms")}</p>
                </div>
                <div>
                  <p className="mb-1.5 text-xs font-bold tracking-wider text-muted-foreground uppercase">
                    {T("bonusCodeOptional")}
                  </p>
                  <input
                    value={bonusCode}
                    onChange={(e) => {
                      setBonusCode(e.target.value.toUpperCase());
                      setErr("");
                    }}
                    placeholder={T("bonusCodePlaceholder")}
                    aria-label={T("bonusCodeOptional")}
                    className={INPUT}
                  />
                  <p className="mt-1 text-[10px] text-muted-foreground">{T("bonusCodeHint")}</p>
                </div>
                <div>
                  <p className="mb-1.5 text-xs font-bold tracking-wider text-muted-foreground uppercase">
                    {T("noteOptional")}
                  </p>
                  <input
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder={T("additionalInfoPlaceholder")}
                    aria-label={T("noteOptional")}
                    className={INPUT}
                  />
                </div>
                {err && (
                  <div className="flex items-center gap-2 rounded-xl bg-error/10 px-4 py-2.5" role="alert">
                    <AlertTriangle size={14} className="text-error" />
                    <p className="text-sm font-semibold text-error">{err}</p>
                  </div>
                )}
                <button
                  onClick={goToConfirm}
                  className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 font-extrabold text-white"
                >
                  {T("reviewAndSubmit")} <ChevronRight size={18} />
                </button>
              </div>
            </div>
          )}

          {/* METHOD SELECTION */}
          {step === "method" && (
            <div className="p-6">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-xl font-extrabold text-foreground">{T("remitCodCash")}</h3>
                <button
                  onClick={onClose}
                  aria-label={T("close")}
                  className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted text-muted-foreground"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="mb-5 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 p-5 text-white">
                <p className="text-sm text-blue-200">{T("codOwed")}</p>
                <p className="mt-0.5 text-4xl font-extrabold">{fc(netOwed)}</p>
                <p className="mt-2 text-xs text-blue-300">{T("remitToCompany")}</p>
              </div>
              {pendingFullRemittance ? (
                <div className="mb-5 flex items-start gap-3 rounded-2xl border border-warning/30 bg-warning/10 p-4">
                  <Clock size={18} className="mt-0.5 flex-shrink-0 text-warning" />
                  <div>
                    <p className="text-sm font-bold text-warning">{T("remittancePendingTitle")}</p>
                    <p className="mt-1 text-xs text-warning">{T("remittancePendingDetail")}</p>
                  </div>
                </div>
              ) : null}
              <p className="mb-4 text-sm text-muted-foreground">{T("selectMethodPrompt")}</p>
              {loadingMethods ? (
                <div className="space-y-3">
                  {[1, 2].map((i) => (
                    <ShimmerBlock key={i} className="h-20 rounded-2xl" />
                  ))}
                </div>
              ) : methodsError ? (
                <div className="rounded-2xl border border-error/20 bg-error/10 p-5 text-center">
                  <AlertTriangle size={28} className="mx-auto mb-2 text-error" />
                  <p className="text-sm font-bold text-error">{T("paymentMethodsUnavailable")}</p>
                  <p className="mt-1 text-xs text-error">{T("contactSupportForMethods")}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {methods.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => goToDetails(m)}
                      aria-label={m.label}
                      className="flex w-full items-center gap-4 rounded-2xl border-2 border-border bg-card p-4 text-left transition-all hover:border-blue-400 hover:bg-blue-500/10 active:scale-[0.98]"
                    >
                      <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-card shadow-sm">
                        <MethodLogo id={m.id} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-extrabold text-foreground">{m.label}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{m.description}</p>
                      </div>
                      <ChevronRight size={20} className="text-muted-foreground" />
                    </button>
                  ))}
                </div>
              )}
              <div className="mt-4 flex gap-2 rounded-xl border border-warning/20 bg-warning/10 p-3">
                <Lightbulb size={14} className="mt-0.5 flex-shrink-0 text-warning" />
                <p className="text-xs font-medium text-warning">{T("transferFirstHint")}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
