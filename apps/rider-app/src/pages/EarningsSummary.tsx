import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatCurrency as _sharedFc } from "@workspace/api-zod";
import { tDual } from "@workspace/i18n";
import {
  ArrowLeft,
  CheckCircle,
  Clock,
  TrendingUp,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import EarningsBarChart from "../components/earnings/EarningsBarChart";
import { PullToRefresh } from "../components/PullToRefresh";
import { ErrorState } from "../components/ui/ErrorState";
import { ShimmerBlock } from "../components/ui/shimmer";
import { api } from "../lib/api";
import { usePlatformConfig } from "../lib/useConfig";
import { useLanguage } from "../lib/useLanguage";

function fc(n: string | number | null | undefined, symbol = "Rs.") {
  return _sharedFc(n != null ? String(n) : (n as null | undefined), symbol);
}

type PayoutTx = {
  id: string;
  type: string;
  amount: number | string;
  description?: string | null;
  reference?: string | null;
  createdAt: string;
  paymentMethod?: string | null;
};

function PayoutStatusBadge({ reference }: { reference?: string | null }) {
  const ref = reference ?? "pending";
  if (ref.startsWith("paid:")) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-bold text-success">
        <CheckCircle size={10} /> paid
      </span>
    );
  }
  if (ref.startsWith("rejected:")) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-error/15 px-2 py-0.5 text-[10px] font-bold text-error">
        <XCircle size={10} /> rejected
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-warning/15 px-2 py-0.5 text-[10px] font-bold text-warning">
      <Clock size={10} className="animate-pulse" /> processing
    </span>
  );
}


function StatCard({
  label,
  value,
  sub,
  highlight,
}: {
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-3xl p-5 shadow-sm ${
        highlight
          ? "bg-brand"
          : "border border-white/10 bg-card-dark"
      }`}
    >
      <p className={`text-xs font-semibold ${highlight ? "text-black/60" : "text-[#B0B0B0]"}`}>
        {label}
      </p>
      <p className={`mt-1 text-2xl font-extrabold ${highlight ? "text-black" : "text-white"}`}>
        {value}
      </p>
      {sub && (
        <p className={`mt-0.5 text-[10px] ${highlight ? "text-black/50" : "text-[#B0B0B0]"}`}>
          {sub}
        </p>
      )}
    </div>
  );
}

const PAGE_SIZE = 20;

export default function EarningsSummary() {
  const [, navigate] = useLocation();
  const { config } = usePlatformConfig();
  const { language } = useLanguage();
  const T = (key: Parameters<typeof tDual>[0]) => tDual(key, language);
  const currency = config.platform.currencySymbol ?? "Rs.";
  const qc = useQueryClient();
  const loaderRef = useRef<HTMLDivElement | null>(null);

  const { data: earningsData, isLoading: earningsLoading, isError: earningsError } = useQuery({
    queryKey: ["rider-earnings"],
    queryFn: () => api.getEarnings(),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  /* Unfiltered wallet query — used for the 7-day earnings chart */
  const {
    data: walletChartData,
    isLoading: walletChartLoading,
  } = useQuery({
    queryKey: ["rider-earnings-summary-wallet-chart"],
    queryFn: () => api.getWalletPage({ limit: 100 }),
    staleTime: 30_000,
  });

  const chartTxs = walletChartData?.items ?? [];

  /* Withdrawal-only infinite query — used for payout history */
  const {
    data: walletData,
    isLoading: walletLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useInfiniteQuery({
    queryKey: ["rider-earnings-summary-wallet"],
    queryFn: ({ pageParam }: { pageParam: string | null }) =>
      api.getWalletPage({ cursor: pageParam ?? undefined, limit: PAGE_SIZE, type: "withdraw" }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    staleTime: 30_000,
  });

  const payouts = walletData?.pages.flatMap((p) => p.items) ?? [];

  const handlePullRefresh = useCallback(async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["rider-earnings"] }),
      qc.invalidateQueries({ queryKey: ["rider-earnings-summary-wallet-chart"] }),
      qc.invalidateQueries({ queryKey: ["rider-earnings-summary-wallet"] }),
    ]);
  }, [qc]);

  const todayEarnings = earningsData?.today?.earnings ?? 0;
  const weekEarnings = earningsData?.week?.earnings ?? 0;
  const todayTrips = earningsData?.today?.deliveries ?? 0;
  const weekTrips = earningsData?.week?.deliveries ?? 0;

  /* Infinite scroll — auto-fetch next page when loader sentinel enters viewport */
  useEffect(() => {
    const el = loaderRef.current;
    if (!el || !hasNextPage || isFetchingNextPage) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          fetchNextPage();
        }
      },
      { rootMargin: "200px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  return (
    <PullToRefresh onRefresh={handlePullRefresh} className="min-h-screen bg-page-bg">
      <div
        className="relative overflow-hidden rounded-b-[2rem] bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 px-5 pb-8"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 3.5rem)" }}
      >
        <button
          onClick={() => navigate("/earnings")}
          className="mb-4 flex items-center gap-2 text-sm font-semibold text-[#B0B0B0] active:text-white"
          aria-label="Back to earnings"
        >
          <ArrowLeft size={16} /> Earnings
        </button>
        <div className="flex items-center gap-2">
          <TrendingUp size={20} className="text-brand" />
          <h1 className="text-2xl font-extrabold tracking-tight text-white">Summary</h1>
        </div>
        <p className="mt-1 text-xs text-white/40">Today & this week at a glance</p>
      </div>

      <div className="space-y-4 px-4 pt-4 pb-8">
        {earningsLoading ? (
          <div className="grid grid-cols-2 gap-3">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="space-y-2 rounded-3xl border border-white/10 bg-card-dark p-5">
                <ShimmerBlock className="h-3 w-16 rounded-full" />
                <ShimmerBlock className="h-7 w-24 rounded-full" />
              </div>
            ))}
          </div>
        ) : earningsError ? (
          <ErrorState
            title={T("somethingWentWrong")}
            subtitle={T("checkInternetRetry")}
            onRetry={() => qc.invalidateQueries({ queryKey: ["rider-earnings"] })}
            retryLabel={T("retry")}
          />
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              label="Today's Earnings"
              value={fc(todayEarnings, currency)}
              sub={`${todayTrips} trip${todayTrips !== 1 ? "s" : ""}`}
              highlight
            />
            <StatCard
              label="Week Earnings"
              value={fc(weekEarnings, currency)}
              sub={`${weekTrips} trip${weekTrips !== 1 ? "s" : ""}`}
            />
            <StatCard label="Today's Trips" value={String(todayTrips)} sub="completed" />
            <StatCard label="Week Trips" value={String(weekTrips)} sub="completed" />
          </div>
        )}

        {walletChartLoading ? (
          <div className="rounded-3xl border border-white/10 bg-card-dark p-5">
            <ShimmerBlock className="mb-4 h-4 w-28 rounded-full" />
            <div className="flex h-20 items-end gap-2">
              {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
                  <div className="w-full max-w-[24px] animate-pulse rounded-md bg-border-dark" style={{ height: Math.random() * 40 + 10 }} />
                  <ShimmerBlock className="h-2 w-5 rounded-full" />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <EarningsBarChart transactions={chartTxs} currency={currency} />
        )}

        <div className="rounded-3xl border border-white/10 bg-card-dark overflow-hidden shadow-sm">
          <div className="flex items-center justify-between px-5 py-4 bg-card-dark/50">
            <p className="text-sm font-bold text-white">Payout History</p>
            {payouts.length > 0 && (
              <span className="rounded-full bg-border-dark px-2 py-0.5 text-[10px] font-bold text-[#B0B0B0]">
                {payouts.length}
              </span>
            )}
          </div>

          {walletLoading ? (
            <div className="divide-y divide-white/5">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-center justify-between px-5 py-4">
                  <div className="space-y-1.5">
                    <ShimmerBlock className="h-3 w-24 rounded-full" />
                    <ShimmerBlock className="h-2.5 w-16 rounded-full" />
                  </div>
                  <ShimmerBlock className="h-4 w-16 rounded-full" />
                </div>
              ))}
            </div>
          ) : payouts.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <p className="text-sm font-bold text-[#B0B0B0]">No payouts yet</p>
              <p className="mt-0.5 text-xs text-[#B0B0B0]">
                Withdrawal requests will appear here
              </p>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {payouts.map((tx) => {
                const date = new Date(tx.createdAt).toLocaleDateString("en-PK", {
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                });
                const desc = (tx.description ?? "").replace("Withdrawal — ", "");
                const bank = desc.split(" · ")[0] || "Withdrawal";
                return (
                  <div key={tx.id} className="flex items-center justify-between px-5 py-4">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-white">{bank}</p>
                      <p className="mt-0.5 text-[10px] text-[#B0B0B0]">{date}</p>
                      <div className="mt-1">
                        <PayoutStatusBadge reference={tx.reference} />
                      </div>
                    </div>
                    <p className="ml-3 flex-shrink-0 text-right text-base font-extrabold text-white">
                      −{fc(Number(tx.amount), currency)}
                    </p>
                  </div>
                );
              })}
              {hasNextPage && (
                <div ref={loaderRef} className="px-5 py-4 text-center">
                  <button
                    onClick={() => fetchNextPage()}
                    disabled={isFetchingNextPage}
                    className="text-xs font-bold text-brand disabled:opacity-50"
                  >
                    {isFetchingNextPage ? "Loading…" : "Load more"}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </PullToRefresh>
  );
}
