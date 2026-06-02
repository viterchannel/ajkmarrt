import { createLogger } from "@/lib/logger";
import { ShimmerBlock } from "@/components/ui/shimmer";
import { useMutation } from "@tanstack/react-query";
import { formatCurrency as _sharedFcD } from "@workspace/api-zod";
import { tDual, type TranslationKey } from "@workspace/i18n";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle,
  ChevronRight,
  Landmark,
  Loader2,
  Smartphone,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { api, apiFetch } from "../../lib/api";
import { useCurrency } from "../../lib/useConfig";
import { useLanguage } from "../../lib/useLanguage";
import { checkSufficientBalance } from "../../lib/wallet/validation";
import type { PayMethod } from "./WithdrawModal";
const log = createLogger("[DepositModal]");
const INPUT =
  "w-full h-12 px-4 bg-card-dark border border-white/10 rounded-xl text-sm focus:outline-none focus:border-teal-400 focus:bg-card-dark transition-colors";

function MethodLogo({ id }: { id: string }) {
  if (id === "jazzcash") return <Smartphone size={28} className="text-error" />;
  if (id === "easypaisa") return <Smartphone size={28} className="text-success" />;
  return <Landmark size={28} className="text-blue-500" />;
}

export default function DepositModal({
  minBalance,
  balance,
  onClose,
  onSuccess,
}: {
  minBalance: number;
  balance: number;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { language } = useLanguage();
  const T = (key: TranslationKey) => tDual(key, language);
  const { symbol: currencySymbol } = useCurrency();
  const fc = (n: string | number | null | undefined) =>
    _sharedFcD(n != null ? String(n) : (n as null | undefined), currencySymbol);
  const [amount, setAmount] = useState("");
  const [selectedMethod, setMethod] = useState<PayMethod | null>(null);
  const [txId, setTxId] = useState("");
  const [senderAcNo, setSenderAcNo] = useState("");
  const [note, setNote] = useState("");
  const [step, setStep] = useState<"amount" | "method" | "details" | "confirm" | "done">("amount");
  const [err, setErr] = useState("");
  const [methods, setMethods] = useState<PayMethod[]>([]);
  const [loadingMethods, setLoadingMethods] = useState(true);
  const [methodsError, setMethodsError] = useState(false);

  /* Reset modal state when component unmounts (parent closes modal) */
  useEffect(() => {
    return () => {
      setStep("amount");
      setAmount("");
      setMethod(null);
      setTxId("");
      setSenderAcNo("");
      setNote("");
      setErr("");
    };
  }, []);

  useEffect(() => {
    const abortCtrl = new AbortController();
    type ApiMethod = {
      id: string;
      label?: string;
      logo?: string;
      description?: string;
      manualNumber?: string;
      iban?: string;
    };
    apiFetch("/payments/methods", { signal: abortCtrl.signal })
      .then((data: { methods?: ApiMethod[] }) => {
        if (abortCtrl.signal.aborted) return;
        const depositable: PayMethod[] = (data.methods || [])
          .filter((m) => ["jazzcash", "easypaisa", "bank"].includes(m.id))
          .map((m) => ({ ...m, label: m.label ?? m.id, logo: m.logo ?? m.id }));
        if (depositable.length === 0) {
          setMethodsError(true);
        } else {
          setMethods(depositable);
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

  const suggestAmt = minBalance > balance ? Math.ceil(minBalance - balance + 50) : 500;

  const mut = useMutation({
    mutationFn: () =>
      api.submitDeposit({
        amount: Number(amount),
        paymentMethod: selectedMethod?.id ?? "",
        accountNumber: senderAcNo.trim() || undefined,
        transactionId: txId,
        note,
      }),
    onSuccess: () => {
      void import("@/lib/analytics").then(({ trackEvent: te }) =>
        te("wallet_topup", { amount: Number(amount), method: selectedMethod?.id ?? "" })
      );
      setStep("done");
    },
    onError: (e: Error) => setErr(e.message),
  });

  const goToMethod = () => {
    const amt = Number(amount);
    if (!amount || isNaN(amt) || amt < 100) {
      setErr(`${T("minimumDeposit")}: ${currencySymbol} 100`);
      return;
    }
    const shortfall = Math.max(0, minBalance - balance);
    if (shortfall > 0) {
      const gapCheck = checkSufficientBalance(amt, shortfall);
      if (!gapCheck.valid) {
        setErr(T("depositShortfallHint").replace("{amount}", fc(shortfall)));
        return;
      }
    }
    setErr("");
    setStep("method");
  };

  const goToDetails = (m: PayMethod) => {
    setMethod(m);
    setTxId("");
    setNote("");
    setErr("");
    setStep("details");
  };

  const goToConfirm = () => {
    if (!txId.trim()) {
      setErr(T("txIdRequiredHint"));
      return;
    }
    if (!senderAcNo.trim()) {
      setErr(T("senderRequiredHint"));
      return;
    }
    if (selectedMethod?.id === "jazzcash" || selectedMethod?.id === "easypaisa") {
      const cleanPhone = senderAcNo.replace(/[\s-]/g, "");
      if (!/^0[3]\d{9}$/.test(cleanPhone)) {
        setErr(T("validMobileHint"));
        return;
      }
    }
    if (selectedMethod?.id === "bank") {
      const cleaned = senderAcNo.replace(/[\s-]/g, "").toUpperCase();
      const isIban = /^PK\d{2}[A-Z]{4}\d{16}$/.test(cleaned);
      const isAccountNo = /^\d{8,20}$/.test(cleaned);
      if (!isIban && !isAccountNo) {
        setErr(T("validIbanHint"));
        return;
      }
    }
    setErr("");
    setStep("confirm");
  };

  const STEP_LABELS = ["amount", "method", "details", "confirm"];
  const stepIdx = STEP_LABELS.indexOf(step);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={T("walletDeposit")}
    >
      <div
        className="flex max-h-[93vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl bg-card-dark shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-shrink-0 justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-border-dark" />
        </div>
        {step !== "done" && stepIdx >= 0 && (
          <div className="flex-shrink-0 px-6 pb-3">
            <div className="mt-1 flex gap-1.5" role="progressbar" aria-valuenow={stepIdx + 1} aria-valuemax={STEP_LABELS.length}>
              {STEP_LABELS.map((_, i) => (
                <div
                  key={i}
                  className={`h-1 flex-1 rounded-full transition-all ${i <= stepIdx ? "bg-brand" : "bg-border-dark"}`}
                />
              ))}
            </div>
            <p className="mt-1 text-right text-[10px] text-[#B0B0B0]">
              {T("step")} {stepIdx + 1}/{STEP_LABELS.length}
            </p>
          </div>
        )}
        <div className="flex-1 overflow-y-auto">
          {/* DONE */}
          {step === "done" && (
            <div className="p-8 text-center">
              <div className="mx-auto mb-5 flex h-24 w-24 items-center justify-center rounded-full bg-success/15">
                <CheckCircle size={52} className="text-success" />
              </div>
              <h3 className="text-2xl font-extrabold text-white">{T("depositSubmitted")}</h3>
              <p className="mt-2 text-sm text-[#B0B0B0]">{T("adminVerifyWallet24h")}</p>
              <div className="mt-5 space-y-3 rounded-2xl bg-success/10 p-5 text-left">
                <div className="flex justify-between text-sm">
                  <span className="text-[#B0B0B0]">{T("methodLabel")}</span>
                  <span className="flex items-center gap-1.5 font-bold">
                    <MethodLogo id={selectedMethod?.id ?? ""} /> {selectedMethod?.label}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[#B0B0B0]">{T("txIdLabel")}</span>
                  <span className="font-mono font-bold">{txId}</span>
                </div>
                <div className="flex items-center justify-between border-t border-success/20 pt-2">
                  <span className="font-semibold text-[#B0B0B0]">{T("amountLabel")}</span>
                  <span className="text-2xl font-extrabold text-teal-600">
                    {fc(Number(amount))}
                  </span>
                </div>
              </div>
              <button
                onClick={() => {
                  onSuccess();
                  onClose();
                }}
                className="mt-5 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-success font-extrabold text-white"
              >
                <CheckCircle size={20} /> {T("done")}
              </button>
            </div>
          )}

          {/* AMOUNT STEP */}
          {step === "amount" && (
            <div className="p-6">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-xl font-extrabold text-white">{T("walletDeposit")}</h3>
                <button
                  onClick={onClose}
                  aria-label={T("close")}
                  className="flex h-9 w-9 items-center justify-center rounded-xl bg-border-dark text-[#B0B0B0]"
                >
                  <X size={18} />
                </button>
              </div>
              {minBalance > balance && (
                <div className="mb-4 rounded-2xl border border-warning/30 bg-warning/10 p-4">
                  <div className="mb-1 flex items-center gap-2">
                    <AlertTriangle size={14} className="text-warning" />
                    <p className="text-xs font-bold text-warning">{T("balanceLow")}</p>
                  </div>
                  <p className="text-xs text-warning">
                    {T("cashOrdersMinHint")
                      .replace("{amount}", fc(minBalance))
                      .replace("{balance}", fc(balance))}
                  </p>
                  <p className="mt-0.5 text-xs text-warning">
                    {T("suggestedDepositHint").replace("{amount}", fc(suggestAmt))}
                  </p>
                </div>
              )}
              <p className="mb-4 text-sm text-[#B0B0B0]">{T("howMuchDeposit")}</p>
              <div className="relative mb-2">
                <span className="absolute top-1/2 left-4 -translate-y-1/2 text-sm font-bold text-[#B0B0B0]">
                  {currencySymbol}
                </span>
                <input
                  value={amount}
                  onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ""))}
                  inputMode="numeric"
                  placeholder="0"
                  aria-label={T("depositAmount")}
                  className={`${INPUT} pl-12 text-2xl font-extrabold`}
                />
              </div>
              <div className="mb-4 flex gap-2">
                {[suggestAmt, 1000, 2000, 5000]
                  .filter((v, i, arr) => arr.indexOf(v) === i)
                  .map((v) => (
                    <button
                      key={v}
                      onClick={() => setAmount(String(v))}
                      aria-label={`${T("depositAmount")} ${fc(v)}`}
                      className="flex-1 rounded-xl bg-border-dark py-2 text-xs font-bold text-[#B0B0B0] active:bg-brand/20 active:text-brand"
                    >
                      {fc(v)}
                    </button>
                  ))}
              </div>
              {err && (
                <div className="mb-3 flex items-center gap-2 rounded-xl bg-error/10 px-4 py-2.5" role="alert">
                  <AlertTriangle size={14} className="text-error" />
                  <p className="text-sm font-semibold text-error">{err}</p>
                </div>
              )}
              <button
                onClick={goToMethod}
                className="mt-1 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-success font-extrabold text-white"
              >
                {T("nextPaymentMethod")} <ChevronRight size={18} />
              </button>
            </div>
          )}

          {/* METHOD STEP */}
          {step === "method" && (
            <div className="p-6">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-xl font-extrabold text-white">{T("paymentMethod")}</h3>
                <button
                  onClick={onClose}
                  aria-label={T("close")}
                  className="flex h-9 w-9 items-center justify-center rounded-xl bg-border-dark text-[#B0B0B0]"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="mb-5 rounded-2xl bg-success/10 px-4 py-3">
                <p className="text-xs font-medium text-teal-600">{T("depositAmount")}</p>
                <p className="text-3xl font-extrabold text-success">{fc(Number(amount))}</p>
              </div>
              <p className="mb-3 text-sm text-[#B0B0B0]">{T("whereToDeposit")}</p>
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
                      className="flex w-full items-center gap-4 rounded-2xl border-2 border-white/10 bg-card-dark p-4 text-left transition-all hover:border-brand hover:bg-brand/10 active:scale-[0.98]"
                    >
                      <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-card-dark shadow-sm">
                        <MethodLogo id={m.id} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-extrabold text-white">{m.label}</p>
                        <p className="mt-0.5 text-xs text-[#B0B0B0]">
                          {m.description || m.label}
                        </p>
                        {(m.manualNumber || m.iban) && (
                          <p className="mt-1 text-xs font-semibold text-teal-600">
                            {m.manualNumber || m.iban}
                          </p>
                        )}
                      </div>
                      <ChevronRight size={20} className="text-[#B0B0B0]" />
                    </button>
                  ))}
                </div>
              )}
              <button
                onClick={() => setStep("amount")}
                aria-label={T("back")}
                className="mt-4 flex w-full items-center justify-center gap-1 py-2 text-center text-sm font-medium text-[#B0B0B0]"
              >
                <ArrowLeft size={14} /> {T("back")}
              </button>
            </div>
          )}

          {/* DETAILS STEP */}
          {step === "details" && selectedMethod && (
            <div className="p-6">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-xl font-extrabold text-white">
                  <MethodLogo id={selectedMethod.id} /> {selectedMethod.label}
                </h3>
                <button
                  onClick={onClose}
                  aria-label={T("close")}
                  className="flex h-9 w-9 items-center justify-center rounded-xl bg-border-dark text-[#B0B0B0]"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="mb-4 rounded-2xl border border-success/20 bg-success/10 p-4">
                <p className="mb-2 text-xs font-bold text-teal-600">{T("companyAccountDetails")}:</p>
                {selectedMethod.manualNumber && (
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-xs text-success">{T("accountNumber")}</span>
                    <span className="font-mono text-sm font-extrabold text-teal-800">
                      {selectedMethod.manualNumber}
                    </span>
                  </div>
                )}
                {selectedMethod.manualName && (
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-xs text-success">{T("accountName")}</span>
                    <span className="text-sm font-bold text-teal-800">
                      {selectedMethod.manualName}
                    </span>
                  </div>
                )}
                {selectedMethod.iban && (
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-xs text-success">{T("ibanOrAccount")}</span>
                    <span className="font-mono text-xs font-extrabold break-all text-teal-800">
                      {selectedMethod.iban}
                    </span>
                  </div>
                )}
                {selectedMethod.accountTitle && (
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-xs text-success">{T("accountName")}</span>
                    <span className="text-sm font-bold text-teal-800">
                      {selectedMethod.accountTitle}
                    </span>
                  </div>
                )}
                {selectedMethod.accountNumber && (
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-xs text-success">{T("accountNumber")}</span>
                    <span className="font-mono text-sm font-extrabold text-teal-800">
                      {selectedMethod.accountNumber}
                    </span>
                  </div>
                )}
                {selectedMethod.bankName && (
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-xs text-success">{T("bankName")}</span>
                    <span className="text-sm font-bold text-teal-800">
                      {selectedMethod.bankName}
                    </span>
                  </div>
                )}
                <div className="mt-2 border-t border-teal-200 pt-2">
                  <p className="text-xs text-success">
                    {selectedMethod.manualInstructions ||
                      selectedMethod.instructions ||
                      T("transferFirstHint")}
                  </p>
                </div>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="mb-1.5 block text-xs font-bold tracking-wider text-[#B0B0B0] uppercase">
                    {selectedMethod.id === "bank" ? T("senderIbanLabel") : T("yourPhoneSender")}
                  </label>
                  <input
                    value={senderAcNo}
                    onChange={(e) => setSenderAcNo(e.target.value)}
                    placeholder={
                      selectedMethod.id === "bank" ? T("yourIbanAccountNo") : "03XX-XXXXXXX"
                    }
                    aria-label={selectedMethod.id === "bank" ? T("senderIbanLabel") : T("yourPhoneSender")}
                    className={INPUT}
                  />
                  <p className="mt-1 text-[10px] text-[#B0B0B0]">{T("senderRequiredHint")}</p>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-bold tracking-wider text-[#B0B0B0] uppercase">
                    {T("txIdLabel")} *
                  </label>
                  <input
                    value={txId}
                    onChange={(e) => setTxId(e.target.value)}
                    placeholder="e.g. T12345678"
                    aria-label={T("txIdLabel")}
                    className={INPUT}
                  />
                  <p className="mt-1 text-[10px] text-[#B0B0B0]">{T("txIdHintNote")}</p>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-bold tracking-wider text-[#B0B0B0] uppercase">
                    {T("noteOptional")}
                  </label>
                  <input
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder={T("additionalInfoPlaceholder")}
                    aria-label={T("noteOptional")}
                    className={INPUT}
                  />
                </div>
              </div>
              {err && (
                <div className="mt-3 flex items-center gap-2 rounded-xl bg-error/10 px-4 py-2.5" role="alert">
                  <AlertTriangle size={14} className="text-error" />
                  <p className="text-sm font-semibold text-error">{err}</p>
                </div>
              )}
              <div className="mt-5 flex gap-3">
                <button
                  onClick={() => setStep("method")}
                  aria-label={T("back")}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-2xl border-2 border-white/10 py-3 text-sm font-bold text-[#B0B0B0]"
                >
                  <ArrowLeft size={14} /> {T("back")}
                </button>
                <button
                  onClick={goToConfirm}
                  className="flex flex-[2] items-center justify-center gap-2 rounded-2xl bg-success py-3 text-sm font-extrabold text-white"
                >
                  {T("reviewAndSubmit")} <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* CONFIRM STEP */}
          {step === "confirm" && selectedMethod && (
            <div className="p-6">
              <h3 className="mb-1 text-xl font-extrabold text-white">{T("confirmDeposit")}</h3>
              <p className="mb-5 text-sm text-[#B0B0B0]">{T("reviewConfirm")}</p>
              <div className="mb-4 space-y-3 rounded-2xl border border-success/20 bg-success/10 p-5">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[#B0B0B0]">{T("amountLabel")}</span>
                  <span className="text-3xl font-extrabold text-teal-600">
                    {fc(Number(amount))}
                  </span>
                </div>
                <div className="h-px bg-success/15" />
                <div className="flex justify-between text-sm">
                  <span className="text-[#B0B0B0]">{T("methodLabel")}</span>
                  <span className="flex items-center gap-1.5 font-bold">
                    <MethodLogo id={selectedMethod.id} /> {selectedMethod.label}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[#B0B0B0]">{T("txIdLabel")}</span>
                  <span className="font-mono font-bold">{txId}</span>
                </div>
                {note && (
                  <div className="flex justify-between text-sm">
                    <span className="text-[#B0B0B0]">{T("noteOptional")}</span>
                    <span className="font-bold">{note}</span>
                  </div>
                )}
              </div>
              <div className="mb-4 flex gap-2 rounded-xl border border-warning/20 bg-warning/10 p-3">
                <AlertTriangle size={14} className="mt-0.5 flex-shrink-0 text-warning" />
                <p className="text-xs font-medium text-warning">{T("txIdHintNote")}</p>
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
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-2xl border-2 border-white/10 py-3 text-sm font-bold text-[#B0B0B0]"
                >
                  <ArrowLeft size={14} /> {T("edit")}
                </button>
                <button
                  onClick={() => mut.mutate()}
                  disabled={mut.isPending}
                  aria-label={T("submitDeposit")}
                  className="flex flex-[2] items-center justify-center gap-2 rounded-2xl bg-success py-3 text-sm font-extrabold text-white disabled:opacity-60"
                >
                  {mut.isPending ? (
                    <>
                      <Loader2 size={16} className="animate-spin" /> {T("submitting")}
                    </>
                  ) : (
                    <>
                      <CheckCircle size={16} /> {T("submitDeposit")}
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
