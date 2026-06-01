import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatCurrency as _sharedFc } from "@workspace/api-zod";
import { tDual } from "@workspace/i18n";
import { AlertTriangle, ArrowLeft, CheckCircle, Info, RefreshCw, ShieldAlert } from "lucide-react";
import { useCallback, useEffect, useRef } from "react";
import { Link } from "wouter";
import { PullToRefresh } from "../components/PullToRefresh";
import { ErrorState } from "../components/ui/ErrorState";
import { toast } from "@/hooks/use-toast";
import { api } from "../lib/api";
import { useAuth } from "../lib/rider-auth";
import { formatDateTz, usePlatformConfig } from "../lib/useConfig";
import { useLanguage } from "../lib/useLanguage";

type Penalty = {
  id: string;
  type: string;
  amount: string | number;
  reason: string | null;
  createdAt: string;
};

function penaltyTypeLabel(type: string): string {
  const map: Record<string, string> = {
    cancellation: "Cancellation",
    late_delivery: "Late Delivery",
    customer_complaint: "Customer Complaint",
    misconduct: "Misconduct",
    ignore: "Ride Ignored",
    cancel: "Order Cancelled",
    late: "Late Delivery",
    conduct: "Conduct Violation",
    fraud: "Fraud Attempt",
  };
  return map[type] ?? type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function penaltyColor(type: string): string {
  const map: Record<string, string> = {
    cancellation: "bg-warning/10 text-warning border-warning/30",
    late_delivery: "bg-warning/10 text-warning border-warning/30",
    customer_complaint: "bg-error/10 text-error border-error/30",
    misconduct: "bg-error/15 text-error border-error/60",
    ignore: "bg-warning/10 text-warning border-warning/30",
    cancel: "bg-warning/10 text-warning border-warning/30",
    late: "bg-warning/10 text-warning border-warning/30",
    conduct: "bg-error/10 text-error border-error/30",
    fraud: "bg-error/15 text-error border-error/60",
  };
  return map[type] ?? "bg-card-dark text-[#B0B0B0] border-white/10";
}

function penaltyIcon(type: string) {
  if (
    type === "conduct" ||
    type === "fraud" ||
    type === "misconduct" ||
    type === "customer_complaint"
  )
    return <AlertTriangle size={16} className="shrink-0" />;
  return <ShieldAlert size={16} className="shrink-0" />;
}

export default function PenaltyHistory() {
  const { config } = usePlatformConfig();
  const { language } = useLanguage();
  const _T = (key: Parameters<typeof tDual>[0]) => tDual(key, language);
  const currency = config.platform?.currencySymbol ?? "Rs.";
  const tz = config.regional?.timezone ?? "Asia/Karachi";
  const qc = useQueryClient();
  const { user } = useAuth();

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["rider-penalty-history"],
    queryFn: () => api.getPenaltyHistory(),
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    staleTime: 0,
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 30_000),
  });

  const penalties: Penalty[] = data?.penalties ?? [];
  const totalDeducted: number =
    typeof data?.total_deducted === "number"
      ? data.total_deducted
      : penalties.reduce((sum, p) => sum + parseFloat(String(p.amount || 0)), 0);

  /* Balance-delta detection: if totalDeducted decreased since last visit
     (a penalty was removed by admin) notify the rider that their balance
     increased and invalidate the wallet cache so the new balance shows. */
  const deltaToastShownRef = useRef(false);
  useEffect(() => {
    if (isLoading || data === undefined) return;
    const storageKey = `ajkm_penalty_total_${user?.id ?? "rider"}`;
    let prev: number | null = null;
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored !== null) prev = parseFloat(stored);
    } catch { /* ignore */ }

    if (prev !== null && !deltaToastShownRef.current && totalDeducted < prev) {
      deltaToastShownRef.current = true;
      toast({ title: "A penalty was reversed — your wallet balance has been updated." });
      void qc.invalidateQueries({ queryKey: ["rider-wallet"] });
    }

    try {
      localStorage.setItem(storageKey, String(totalDeducted));
    } catch { /* ignore */ }
  }, [data, isLoading, totalDeducted, user?.id, qc]);

  const handlePullRefresh = useCallback(async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["rider-penalty-history"] }),
      qc.invalidateQueries({ queryKey: ["rider-wallet"] }),
    ]);
  }, [qc]);

  return (
    <PullToRefresh onRefresh={handlePullRefresh}>
      <div className="min-h-screen bg-card-dark pb-20">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-white/10 bg-card-dark px-4 pt-4 pb-3">
          <Link href="/profile">
            <button className="flex h-9 w-9 items-center justify-center rounded-xl bg-border-dark text-[#B0B0B0] transition-colors hover:bg-[#3A3A3A]">
              <ArrowLeft size={18} />
            </button>
          </Link>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-white">Penalty History</h1>
            <p className="text-xs text-[#B0B0B0]">Your penalty & deduction records</p>
          </div>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-border-dark text-[#B0B0B0] transition-colors hover:bg-[#3A3A3A] disabled:opacity-50"
          >
            <RefreshCw size={16} className={isFetching ? "animate-spin" : ""} />
          </button>
        </div>

        <div className="space-y-4 px-4 pt-4">
          {/* Summary card */}
          {!isLoading && !isError && (
            <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-card-dark p-4 shadow-sm">
              <div>
                <p className="text-xs font-medium tracking-wide text-[#B0B0B0] uppercase">
                  Total Deducted
                </p>
                <p className="mt-0.5 text-2xl font-bold text-error">
                  {currency} {_sharedFc(String(totalDeducted), currency)}
                </p>
                <p className="mt-1 text-xs text-[#B0B0B0]">
                  {penalties.length} record{penalties.length !== 1 ? "s" : ""}
                </p>
              </div>
              {penalties.length === 0 ? (
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-success/10">
                  <CheckCircle size={28} className="text-success" />
                </div>
              ) : (
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-error/10">
                  <ShieldAlert size={28} className="text-error" />
                </div>
              )}
            </div>
          )}

          {/* Info banner */}
          <div className="flex items-start gap-2.5 rounded-xl border border-blue-100 bg-blue-500/10 px-3.5 py-3">
            <Info size={15} className="mt-0.5 shrink-0 text-blue-500" />
            <div className="flex-1">
              <p className="text-xs leading-relaxed text-blue-400">
                Penalties are deducted from your wallet for policy violations such as ignoring ride
                requests, cancelling orders, or conduct issues.
              </p>
              <Link
                href="/chat"
                className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-blue-400 underline underline-offset-2 hover:text-blue-800"
              >
                Contact support if you believe a penalty was applied in error
              </Link>
            </div>
          </div>

          {/* Loading */}
          {isLoading && (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="animate-pulse rounded-xl border border-white/10 bg-card-dark p-4"
                >
                  <div className="mb-2 h-4 w-2/5 rounded bg-border-dark" />
                  <div className="mb-2 h-3 w-3/5 rounded bg-border-dark" />
                  <div className="h-3 w-1/4 rounded bg-border-dark" />
                </div>
              ))}
            </div>
          )}

          {/* Error */}
          {isError && (
            <ErrorState
              title="Could not load penalty history"
              subtitle="Please pull down to retry."
              onRetry={() => refetch()}
            />
          )}

          {/* Empty */}
          {!isLoading && !isError && penalties.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-success/10">
                <CheckCircle size={40} className="text-success" />
              </div>
              <p className="text-lg font-semibold text-white">No Penalties</p>
              <p className="mt-1 max-w-xs text-sm text-[#B0B0B0]">
                Great job! You have a clean record with no penalties.
              </p>
            </div>
          )}

          {/* Penalty list */}
          {!isLoading && !isError && penalties.length > 0 && (
            <div className="space-y-2.5">
              {penalties.map((p) => {
                const amt = parseFloat(String(p.amount || 0));
                const color = penaltyColor(p.type);
                return (
                  <div
                    key={p.id}
                    className="rounded-xl border border-white/10 bg-card-dark p-4 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 flex-1 items-center gap-2.5">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold ${color}`}
                        >
                          {penaltyIcon(p.type)}
                          {penaltyTypeLabel(p.type)}
                        </span>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-base font-bold text-error">
                          − {currency} {_sharedFc(String(amt), currency)}
                        </p>
                      </div>
                    </div>

                    {p.reason && (
                      <p className="mt-2 text-sm leading-relaxed text-[#B0B0B0]">{p.reason}</p>
                    )}

                    <p className="mt-2 text-xs text-[#B0B0B0]">
                      {formatDateTz(
                        p.createdAt,
                        {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        },
                        tz
                      )}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </PullToRefresh>
  );
}
