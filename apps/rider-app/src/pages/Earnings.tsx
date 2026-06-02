import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatCurrency as _sharedFcE } from "@workspace/api-zod";
import { tDual } from "@workspace/i18n";
import {
  ArrowRight,
  BarChart2,
  Calendar,
  Car,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  ClipboardList,
  CreditCard,
  FileText,
  Package,
  Pencil,
  Receipt,
  Share2,
  Star,
  Target,
  TrendingDown,
  TrendingUp,
  UtensilsCrossed,
  Wallet,
  X,
} from "lucide-react";
import React, { useCallback, useEffect, useState } from "react";
import EarningsBarChart from "../components/earnings/EarningsBarChart";
import { useLocation } from "wouter";
import { PullToRefresh } from "../components/PullToRefresh";
import { ErrorState } from "../components/ui/ErrorState";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "../components/ui/accordion";
import { ShimmerBlock } from "../components/ui/shimmer";
import { api } from "../lib/api";
import { useAuth } from "../lib/rider-auth";
import { usePlatformConfig } from "../lib/useConfig";
import { useLanguage } from "../lib/useLanguage";

type RideKindFilter = "all" | "food" | "parcel" | "rides";

type HistoryItem = {
  id: string;
  type?: string | null;
  kind?: string | null;
  status?: string;
  total?: string | number | null;
  fare?: string | number | null;
  amount?: string | number | null;
  createdAt: string;
  orderId?: string | null;
  origin?: string | null;
  destination?: string | null;
  distance?: string | number | null;
  duration?: number | null;
  vendorStoreName?: string | null;
  deliveryAddress?: string | null;
};

const KIND_ICONS: Record<string, React.ReactElement> = {
  food: <UtensilsCrossed size={14} className="text-warning" />,
  parcel: <Package size={14} className="text-blue-400" />,
  rides: <Car size={14} className="text-purple-400" />,
  ride: <Car size={14} className="text-purple-400" />,
};

const KIND_LABELS: Record<string, string> = {
  food: "Food",
  parcel: "Parcel",
  rides: "Ride",
  ride: "Ride",
};

function CompletedRidesList({
  formatCurrency,
  currency,
}: {
  formatCurrency: (n: string | number | null | undefined) => string;
  currency: string;
}) {
  const { language } = useLanguage();
  const T = (key: Parameters<typeof tDual>[0]) => tDual(key, language);
  const queryClient = useQueryClient();
  const [kindFilter, setKindFilter] = useState<RideKindFilter>("all");
  const [offset, setOffset] = useState(0);
  const [allItems, setAllItems] = useState<HistoryItem[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [selectedRide, setSelectedRide] = useState<HistoryItem | null>(null);

  const PAGE_SIZE = 10;

  const { data, isFetching, isError } = useQuery({
    queryKey: ["rider-completed-rides", kindFilter, offset],
    queryFn: () => {
      const kindMap: Record<string, "order" | "ride" | "parcel"> = {
        food: "order",
        rides: "ride",
        parcel: "parcel",
      };
      return api.getHistory({
        kind: kindFilter === "all" ? undefined : kindMap[kindFilter],
        limit: PAGE_SIZE,
        offset,
      }) as Promise<{ history: HistoryItem[]; hasMore: boolean; total: number }>;
    },
    staleTime: 30_000,
    retry: 1,
  });

  /* Accumulate pages into allItems — must be useEffect so it re-runs whenever
     the query result or offset changes, not just on initial mount. */
  useEffect(() => {
    if (data?.history) {
      if (offset === 0) {
        setAllItems(data.history);
      } else {
        setAllItems((prev) => {
          const ids = new Set(prev.map((i) => i.id));
          return [...prev, ...data.history.filter((i) => !ids.has(i.id))];
        });
      }
      setHasMore(data.hasMore ?? false);
    }
  }, [data, offset]);

  /* When filter changes, reset to first page and invalidate cache */
  const handleKindChange = (k: RideKindFilter) => {
    if (k === kindFilter) return;
    setAllItems([]);
    setOffset(0);
    setKindFilter(k);
    /* Invalidate query cache to ensure fresh data on filter change */
    void queryClient.invalidateQueries({ queryKey: ["rider-completed-rides", k] });
  };

  /* Always render from the accumulated list; fall back to current page only on
     the very first load before useEffect has had a chance to run. */
  const itemsToShow: HistoryItem[] =
    allItems.length > 0 ? allItems : (data?.history ?? []);

  const totalShown = itemsToShow.length;

  const KIND_TABS: { key: RideKindFilter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "food", label: "Food" },
    { key: "parcel", label: "Parcel" },
    { key: "rides", label: "Rides" },
  ];

  const formatDate = (d: string) => {
    try {
      return new Date(d).toLocaleDateString("en-PK", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return d;
    }
  };

  const getAmount = (item: HistoryItem) =>
    item.total ?? item.fare ?? item.amount ?? null;

  const getKind = (item: HistoryItem) =>
    item.kind ?? item.type ?? "rides";

  const handleShare = async (ride: HistoryItem) => {
    const kind = getKind(ride);
    const amt = getAmount(ride);
    const text = [
      `=== AJKMart Rider Receipt ===`,
      `Order: #${(ride.orderId ?? ride.id).slice(-8).toUpperCase()}`,
      `Service: ${KIND_LABELS[kind] ?? kind}`,
      `Amount: ${formatCurrency(amt)}`,
      `Date: ${formatDate(ride.createdAt)}`,
      ...(ride.origin ? [`From: ${ride.origin}`] : []),
      ...(ride.destination ? [`To: ${ride.destination}`] : []),
      ...(ride.deliveryAddress ? [`Delivery: ${ride.deliveryAddress}`] : []),
      ...(ride.distance ? [`Distance: ${Number(ride.distance).toFixed(1)} km`] : []),
      `Powered by AJKMart Rider`,
    ].join("\n");

    if (navigator.share) {
      try {
        await navigator.share({ title: "AJKMart Ride Receipt", text });
      } catch {
        /* cancelled */
      }
    } else {
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        /* not available */
      }
    }
  };

  return (
    <div className="rounded-3xl border border-border bg-card shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 bg-card">
        <p className="flex items-center gap-1.5 text-sm font-bold text-foreground">
          <Receipt size={14} className="text-foreground" /> Completed Rides
        </p>
      </div>

      {/* Filter bar */}
      <div className="flex gap-1 mx-4 mb-3 rounded-full border border-border bg-background p-1">
        {KIND_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => handleKindChange(tab.key)}
            className={`flex-1 rounded-full py-2 text-[11px] font-bold transition-all ${
              kindFilter === tab.key
                ? "bg-brand text-black shadow-sm"
                : "text-muted-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* List */}
      {isFetching && offset === 0 ? (
        <div className="divide-y divide-border/30">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3 px-5 py-3.5">
              <div className="h-8 w-8 animate-pulse rounded-xl bg-muted" />
              <div className="flex-1 space-y-1.5">
                <div className="h-2.5 w-28 animate-pulse rounded-full bg-muted" />
                <div className="h-2 w-20 animate-pulse rounded-full bg-muted" />
              </div>
              <div className="h-3 w-16 animate-pulse rounded-full bg-muted" />
            </div>
          ))}
        </div>
      ) : isError ? (
        <div className="px-5 py-8 text-center">
          <p className="text-sm font-bold text-muted-foreground">{T("couldNotLoadRides")}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{T("checkConnectionRetry")}</p>
        </div>
      ) : itemsToShow.length === 0 ? (
        <div className="px-5 py-8 text-center">
          <ClipboardList size={28} className="mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm font-bold text-muted-foreground">{T("noCompletedRidesYet")}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Your ride history will appear here</p>
        </div>
      ) : (
        <div className="divide-y divide-border/30">
          {itemsToShow.map((item) => {
            const kind = getKind(item);
            const amt = getAmount(item);
            return (
              <button
                key={item.id}
                onClick={() => setSelectedRide(item)}
                className="flex w-full items-center gap-3 px-5 py-3.5 text-left active:bg-muted transition-colors"
              >
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-muted">
                  {KIND_ICONS[kind] ?? <ClipboardList size={14} className="text-muted-foreground" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-foreground truncate">
                    #{(item.orderId ?? item.id).slice(-8).toUpperCase()}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {KIND_LABELS[kind] ?? kind} · {formatDate(item.createdAt)}
                  </p>
                </div>
                <div className="flex-shrink-0 text-right">
                  <p className="text-sm font-extrabold text-success">
                    +{formatCurrency(amt)}
                  </p>
                  <ChevronRight size={13} className="ml-auto text-muted-foreground" />
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Load more */}
      {!isError && totalShown > 0 && data?.hasMore && (
        <div className="px-5 pb-4 pt-2">
          <button
            onClick={() => setOffset((o) => o + PAGE_SIZE)}
            disabled={isFetching}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-border py-3 text-sm font-bold text-muted-foreground active:bg-muted disabled:opacity-50"
          >
            {isFetching ? "Loading…" : "Load more"}
          </button>
        </div>
      )}

      {/* Receipt bottom sheet */}
      {selectedRide && (
        <div
          className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setSelectedRide(null)}
        >
          <div
            className="w-full max-w-md rounded-t-3xl bg-card shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-center pt-3 pb-1">
              <div className="h-1 w-10 rounded-full bg-muted" />
            </div>
            <div className="p-6">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
                    {KIND_ICONS[getKind(selectedRide)] ?? <ClipboardList size={16} className="text-muted-foreground" />}
                  </div>
                  <div>
                    <p className="text-base font-extrabold text-foreground">
                      #{(selectedRide.orderId ?? selectedRide.id).slice(-8).toUpperCase()}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {KIND_LABELS[getKind(selectedRide)] ?? getKind(selectedRide)}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedRide(null)}
                  className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted text-muted-foreground"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-3 rounded-2xl border border-success/20 bg-success/5 p-4">
                {[
                  { label: "Amount Earned", value: `+${formatCurrency(getAmount(selectedRide))}`, bold: true, color: "text-success" },
                  { label: "Date", value: formatDate(selectedRide.createdAt), bold: false, color: "text-foreground" },
                  ...(selectedRide.origin ? [{ label: "From", value: selectedRide.origin, bold: false, color: "text-foreground" }] : []),
                  ...(selectedRide.destination ? [{ label: "To", value: selectedRide.destination, bold: false, color: "text-foreground" }] : []),
                  ...(selectedRide.deliveryAddress ? [{ label: "Delivery", value: selectedRide.deliveryAddress, bold: false, color: "text-foreground" }] : []),
                  ...(selectedRide.distance ? [{ label: "Distance", value: `${Number(selectedRide.distance).toFixed(1)} km`, bold: false, color: "text-foreground" }] : []),
                  ...(selectedRide.vendorStoreName ? [{ label: "Restaurant", value: selectedRide.vendorStoreName, bold: false, color: "text-foreground" }] : []),
                ].map((row) => (
                  <div key={row.label} className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">{row.label}</span>
                    <span className={`text-sm ${row.bold ? "font-extrabold" : "font-semibold"} ${row.color} max-w-[60%] text-right truncate`}>
                      {row.value}
                    </span>
                  </div>
                ))}
              </div>

              <button
                onClick={() => handleShare(selectedRide)}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-success py-3.5 text-sm font-extrabold text-foreground active:opacity-80"
              >
                <Share2 size={15} /> Share Receipt
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SkeletonEarnings() {
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2 rounded-3xl border border-border bg-card p-5 shadow-sm">
          <ShimmerBlock className="h-3 w-16 rounded-full" />
          <ShimmerBlock className="h-8 w-28 rounded-full" />
          <ShimmerBlock className="h-2.5 w-20 rounded-full" />
        </div>
        <div className="space-y-2 rounded-3xl border border-border bg-card p-5 shadow-sm">
          <ShimmerBlock className="h-3 w-16 rounded-full" />
          <ShimmerBlock className="h-8 w-12 rounded-full" />
          <ShimmerBlock className="h-2.5 w-16 rounded-full" />
        </div>
      </div>
      <div className="space-y-3 rounded-3xl border border-border bg-card p-5 shadow-sm">
        <ShimmerBlock className="h-3 w-24 rounded-full" />
        <ShimmerBlock className="h-3.5 w-full rounded-full" />
        <ShimmerBlock className="h-2.5 w-28 rounded-full" />
      </div>
      <div className="rounded-3xl border border-border bg-card p-5 shadow-sm">
        <ShimmerBlock className="mb-3 h-3 w-24 rounded-full" />
        <div className="grid grid-cols-2 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="space-y-2 rounded-2xl bg-muted p-4">
              <ShimmerBlock className="mx-auto h-6 w-16 rounded-full" />
              <ShimmerBlock className="mx-auto h-2.5 w-20 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
type Period = "today" | "week" | "month";

export default function Earnings() {
  const [, navigate] = useLocation();
  const { user, refreshUser } = useAuth();
  const { config } = usePlatformConfig();
  const { language } = useLanguage();
  const T = (key: Parameters<typeof tDual>[0]) => tDual(key, language);
  const currency = config.platform.currencySymbol ?? "Rs.";
  const formatCurrency = (n: string | number | null | undefined) =>
    _sharedFcE(n != null ? String(n) : (n as null | undefined), currency);
  const riderKeepPct = config.rider?.keepPct ?? config.finance.riderEarningPct ?? 80;
  const [period, setPeriod] = useState<Period>("week");
  const qc = useQueryClient();

  const [showGoalModal, setShowGoalModal] = useState(false);
  const [goalInput, setGoalInput] = useState("");
  const [goalError, setGoalError] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["rider-earnings"],
    queryFn: () => api.getEarnings(),
    refetchInterval: 60000,
    staleTime: 30_000,
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 30_000),
  });

  const { data: walletChartData } = useQuery({
    queryKey: ["rider-earnings-chart-wallet"],
    queryFn: () => api.getWalletPage({ limit: 100 }),
    staleTime: 30_000,
  });
  const chartTxs = walletChartData?.items ?? [];

  const { data: pendingWithdrawData } = useQuery({
    queryKey: ["rider-pending-withdrawals"],
    queryFn: () => api.getWalletPage({ limit: 20, type: "withdraw" }),
    staleTime: 60_000,
  });
  const pendingWithdrawTotal = (pendingWithdrawData?.items ?? [])
    .filter((tx) => {
      const ref = tx.reference ?? "";
      return !ref.startsWith("paid:") && !ref.startsWith("rejected:");
    })
    .reduce((s, tx) => s + Number(tx.amount), 0);

  type PeriodBreakdown = {
    food: { earnings: number; count: number };
    parcel: { earnings: number; count: number };
    rides: { earnings: number; count: number };
  };
  type PeriodData = { earnings: number; deliveries: number; breakdown?: PeriodBreakdown };
  const periodData: PeriodData = (data?.[period as keyof typeof data] as PeriodData) || {
    earnings: 0,
    deliveries: 0,
  };

  const adminDailyGoal = config.rider?.dailyGoal ?? 0;
  const personalDailyGoal: number | null = data?.dailyGoal ?? user?.dailyGoal ?? null;
  const dailyGoal = personalDailyGoal ?? adminDailyGoal;
  const isPersonalGoal = personalDailyGoal != null && personalDailyGoal !== undefined;

  const todayPct =
    dailyGoal > 0 ? Math.min(100, Math.round(((data?.today?.earnings || 0) / dailyGoal) * 100)) : 0;

  const totalDeliveries = user?.stats?.totalDeliveries || 0;
  const totalEarnings = user?.stats?.totalEarnings || 0;
  const avgPerDelivery =
    periodData.deliveries > 0 ? periodData.earnings / periodData.deliveries : 0;

  const rating = user?.stats?.rating ?? 5;
  const ratingLabel =
    rating >= 4.8
      ? T("riderRatingExcellent")
      : rating >= 4.5
        ? T("riderRatingVeryGood")
        : rating >= 4.0
          ? T("riderRatingGood")
          : T("riderRatingNeedsWork");

  const PERIOD_TABS: { key: Period; label: string }[] = [
    { key: "today", label: T("today") },
    { key: "week", label: T("thisWeek") },
    { key: "month", label: T("thisMonth") },
  ];

  const [expandedMonth, setExpandedMonth] = useState<string | null>(null);

  const { data: monthlyData, isLoading: monthlyLoading } = useQuery({
    queryKey: ["rider-monthly-statements"],
    queryFn: () => api.getMonthlyStatements(6),
    staleTime: 5 * 60_000,
    retry: 1,
  });

  const monthlyStatements = monthlyData?.months ?? [];

  const handlePullRefresh = useCallback(async () => {
    await qc.invalidateQueries({ queryKey: ["rider-earnings"] });
    await qc.invalidateQueries({ queryKey: ["rider-monthly-statements"] });
    await qc.invalidateQueries({ queryKey: ["rider-earnings-chart-wallet"] });
    await qc.invalidateQueries({ queryKey: ["rider-pending-withdrawals"] });
  }, [qc]);

  const goalMutation = useMutation({
    mutationFn: (dailyGoalValue: number | null) => api.updateProfile({ dailyGoal: dailyGoalValue }),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["rider-earnings"] }),
        refreshUser().catch(() => {
          /* non-fatal — earnings display will still update via React Query */
        }),
      ]);
      setGoalError(null);
      setShowGoalModal(false);
    },
    onError: () => {
      setGoalError(T("saveFailedMsg"));
    },
  });

  const openGoalModal = () => {
    setGoalInput(personalDailyGoal ? String(Math.round(personalDailyGoal)) : "");
    setGoalError(null);
    setShowGoalModal(true);
  };

  const handleSaveGoal = () => {
    /* Strip locale-specific thousands separators (commas, periods used as group
       separators) before parsing so "1,500" and "1.500" parse correctly. */
    const normalized = goalInput.replace(/,/g, "").trim();
    if (goalInput.trim() === "") {
      goalMutation.mutate(null);
    } else {
      /* Use Number() + isFinite to reject scientific notation strings like
         "1e9abc", NaN, ±Infinity, and the hardware minus key producing negatives.
         Math.floor ensures the server always receives a whole integer. */
      const num = Number(normalized);
      if (!isFinite(num) || num < 0) {
        setGoalError(T("enterValidAmount"));
      } else {
        const parsed = Math.floor(num);
        if (parsed < 1) {
          setGoalError(T("goalTooLow"));
        } else if (parsed > 999999) {
          setGoalError(T("goalTooHigh"));
        } else {
          goalMutation.mutate(parsed);
        }
      }
    }
  };

  return (
    <PullToRefresh onRefresh={handlePullRefresh} className="min-h-screen bg-page-bg">
      <div
        className="page-header-gradient relative overflow-hidden rounded-b-[2rem] bg-card px-5 pb-8"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 3.5rem)" }}
      >
        <div className="absolute -top-20 -right-20 h-72 w-72 rounded-full bg-success/[0.04]" />
        <div className="absolute bottom-10 -left-16 h-56 w-56 rounded-full bg-foreground/[0.02]" />
        <div className="relative mx-auto max-w-2xl">
          <p className="mb-1 text-xs font-semibold tracking-widest text-muted-foreground uppercase">
            {T("incomePerformance")}
          </p>
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground">{T("earnings")}</h1>

          <div className="mt-5 rounded-2xl border border-border bg-card p-5 shadow-lg">
            <p className="flex items-center gap-1.5 text-xs font-semibold tracking-widest text-muted-foreground uppercase">
              <Wallet size={13} /> {T("walletBalance")}
            </p>
            <p className="mt-2 text-[28px] leading-tight font-extrabold text-foreground">
              {formatCurrency(user?.walletBalance ?? "0")}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">{T("earningsAfterDelivery")}</p>
            {pendingWithdrawTotal > 0 && (
              <p className="mt-1.5 text-[11px] font-semibold text-warning">
                Pending payout: {formatCurrency(pendingWithdrawTotal)}
              </p>
            )}
            <button
              onClick={() => navigate("/wallet")}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-brand py-3 text-sm font-black text-black active:opacity-80 transition-opacity"
            >
              <Wallet size={15} /> Withdraw <ArrowRight size={15} />
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-2xl space-y-4 px-4 pt-4">
        <button
          onClick={() => navigate("/earnings/summary")}
          className="flex w-full items-center justify-between rounded-2xl border border-brand/30 bg-brand/10 px-4 py-3 active:opacity-80"
        >
          <div className="flex items-center gap-2.5">
            <BarChart2 size={16} className="text-brand" />
            <span className="text-sm font-bold text-brand">{T("viewEarningsSummary")}</span>
          </div>
          <ChevronDown size={14} className="-rotate-90 text-brand" />
        </button>

        <div className="flex gap-1 rounded-full border border-border bg-card p-1 shadow-sm">
          {PERIOD_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setPeriod(tab.key)}
              className={`flex-1 rounded-full py-2.5 text-xs font-bold transition-all ${period === tab.key ? "bg-brand text-black shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <SkeletonEarnings />
        ) : isError ? (
          <ErrorState
            title={T("somethingWentWrong")}
            subtitle={T("checkInternetRetry")}
            onRetry={() => qc.invalidateQueries({ queryKey: ["rider-earnings"] })}
            retryLabel={T("retry")}
          />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-3xl border border-border bg-card p-5 shadow-sm">
                <p className="text-xs font-semibold text-muted-foreground">{T("earnings")}</p>
                <p className="mt-1 text-3xl font-extrabold text-success">{formatCurrency(periodData.earnings)}</p>
                {period === "today" && data?.yesterday != null && (
                  <div className="mt-1 flex items-center gap-1">
                    {data.today.earnings >= data.yesterday.earnings ? (
                      <>
                        <TrendingUp size={11} className="text-success flex-shrink-0" />
                        <p className="text-[11px] text-success truncate">
                          {formatCurrency(data.today.earnings - data.yesterday.earnings)} more than yesterday
                        </p>
                      </>
                    ) : (
                      <>
                        <TrendingDown size={11} className="text-error flex-shrink-0" />
                        <p className="text-[11px] text-error truncate">
                          {formatCurrency(data.yesterday.earnings - data.today.earnings)} less than yesterday
                        </p>
                      </>
                    )}
                  </div>
                )}
                {period !== "today" && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {riderKeepPct}% {T("deliveries").toLowerCase()}
                  </p>
                )}
              </div>
              <div className="rounded-3xl border border-border bg-card p-5 shadow-sm">
                <p className="text-sm font-medium text-muted-foreground">{T("deliveries")}</p>
                <p className="mt-1 text-3xl font-extrabold text-foreground">{periodData.deliveries}</p>
                <p className="mt-1 text-xs text-muted-foreground">{T("completedLabel")}</p>
              </div>
            </div>

            {/* Commission Breakdown — collapsible accordion */}
            {periodData.earnings > 0 && (
              <Accordion type="single" collapsible>
                <AccordionItem
                  value="commission"
                  className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
                >
                  <AccordionTrigger className="px-5 py-4 hover:no-underline">
                    <span className="text-sm font-bold text-foreground">Commission Breakdown</span>
                  </AccordionTrigger>
                  <AccordionContent className="pt-0 pb-0">
                    {(() => {
                      const net = periodData.earnings;
                      const gross = riderKeepPct > 0 ? parseFloat((net / (riderKeepPct / 100)).toFixed(2)) : net;
                      const fee = parseFloat((gross - net).toFixed(2));
                      const feePct = gross > 0 ? Math.round((fee / gross) * 100) : 0;
                      return (
                        <div className="divide-y divide-border/30">
                          {[
                            { label: "Gross Fare", value: formatCurrency(gross), color: "text-foreground" },
                            { label: `Platform Fee (${feePct}%)`, value: `−${formatCurrency(fee)}`, color: "text-error/70" },
                            { label: "You Keep", value: formatCurrency(net), color: "text-success font-extrabold" },
                          ].map((row) => (
                            <div key={row.label} className="flex items-center justify-between px-5 py-3.5">
                              <span className="text-sm text-muted-foreground">{row.label}</span>
                              <span className={`text-sm font-bold ${row.color}`}>{row.value}</span>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            )}
          </>
        )}

        {/* 7-day earnings bar chart */}
        <EarningsBarChart transactions={chartTxs} currency={currency} />

        <div className="rounded-3xl border border-border bg-card p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="flex items-center gap-1.5 text-sm font-bold text-foreground">
                <Target size={14} className="text-foreground" />
                {T("dailyGoal")}
                {isPersonalGoal && (
                  <span className="rounded-full bg-brand px-1.5 py-0.5 text-[9px] font-bold tracking-wider text-black uppercase">
                    {T("personalBadge")}
                  </span>
                )}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Target: {formatCurrency(dailyGoal)}/day
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={openGoalModal}
                className="rounded-xl bg-muted p-1.5 text-muted-foreground transition-colors hover:bg-muted active:bg-muted"
                aria-label="Edit daily goal"
              >
                <Pencil size={13} />
              </button>
              <div className="text-right">
                <p className="text-lg font-extrabold text-foreground">{todayPct}%</p>
                <p className="text-xs text-muted-foreground">
                  {formatCurrency(data?.today?.earnings || 0)}
                </p>
              </div>
            </div>
          </div>
          <div className="h-3.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={`h-3.5 rounded-full transition-all duration-700 ${todayPct >= 100 ? "bg-success" : "bg-muted/40"}`}
              style={{ width: `${todayPct}%` }}
            />
          </div>
          {todayPct >= 100 ? (
            <p className="mt-2.5 flex items-center gap-1 text-xs font-bold text-success">
              <CheckCircle size={12} /> {T("dailyGoalReached")}
            </p>
          ) : (
            <p className="mt-2.5 text-xs text-muted-foreground">
              {formatCurrency(dailyGoal - (data?.today?.earnings || 0))} {T("moreToGoal")}
            </p>
          )}
        </div>

        <div className="rounded-3xl border border-border bg-card p-5 shadow-sm">
          <p className="mb-3.5 flex items-center gap-1.5 text-sm font-bold text-foreground">
            <BarChart2 size={14} className="text-foreground" /> {T("performance")}
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-background p-4 text-center">
              <p className="text-2xl font-extrabold text-foreground">{totalDeliveries}</p>
              <p className="mt-1 flex items-center justify-center gap-1 text-xs font-semibold text-muted-foreground">
                <ClipboardList size={11} /> {T("totalDeliveries")}
              </p>
            </div>
            <div className="rounded-2xl bg-background p-4 text-center">
              <p className="text-2xl font-extrabold text-foreground">
                {formatCurrency(avgPerDelivery)}
              </p>
              <p className="mt-1 flex items-center justify-center gap-1 text-xs font-semibold text-muted-foreground">
                <TrendingUp size={11} /> {T("avgPerDelivery")}
              </p>
            </div>
            <div className="rounded-2xl bg-background p-4 text-center">
              <p className="text-2xl font-extrabold text-foreground">
                {formatCurrency(totalEarnings)}
              </p>
              <p className="mt-1 flex items-center justify-center gap-1 text-xs font-semibold text-muted-foreground">
                <CreditCard size={11} /> {T("allTimeEarned")}
              </p>
            </div>
            <div className="rounded-2xl bg-background p-4 text-center">
              <div className="flex items-center justify-center gap-1">
                <p className="text-2xl font-extrabold text-foreground">{rating.toFixed(1)}</p>
                <Star size={18} className="fill-yellow-400 text-yellow-400" />
              </div>
              <p className="mt-1 text-xs font-semibold text-muted-foreground">{ratingLabel}</p>
            </div>
          </div>
        </div>

        {!isLoading && !isError && periodData.breakdown && (
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <p className="mb-4 flex items-center gap-1.5 text-sm font-bold text-foreground">
              <BarChart2 size={14} className="text-foreground" /> {T("byServiceType")}
            </p>
            {(() => {
              const bd = periodData.breakdown;
              const totalEarned = bd.food.earnings + bd.parcel.earnings + bd.rides.earnings;
              const items = [
                {
                  label: "Food",
                  emoji: "🍔",
                  earnings: bd.food.earnings,
                  count: bd.food.count,
                  border: "border-orange-500/20",
                  bg: "bg-orange-500/10",
                  text: "text-orange-400",
                  bar: "bg-orange-400",
                },
                {
                  label: "Parcel",
                  emoji: "📦",
                  earnings: bd.parcel.earnings,
                  count: bd.parcel.count,
                  border: "border-blue-500/20",
                  bg: "bg-blue-500/10",
                  text: "text-blue-400",
                  bar: "bg-blue-400",
                },
                {
                  label: "Rides",
                  emoji: "🛵",
                  earnings: bd.rides.earnings,
                  count: bd.rides.count,
                  border: "border-success/20",
                  bg: "bg-success/10",
                  text: "text-success",
                  bar: "bg-success",
                },
              ];
              return (
                <div className="grid grid-cols-3 gap-3">
                  {items.map((item) => {
                    const pct = totalEarned > 0 ? Math.round((item.earnings / totalEarned) * 100) : 0;
                    return (
                      <div key={item.label} className={`${item.bg} border ${item.border} rounded-2xl p-3 flex flex-col gap-2`}>
                        <div className="flex items-center justify-between">
                          <span className="text-base">{item.emoji}</span>
                          <span className={`text-[9px] font-bold ${item.text}`}>{pct}%</span>
                        </div>
                        <p className={`text-sm font-extrabold ${item.text}`}>
                          {formatCurrency(item.earnings)}
                        </p>
                        <p className="text-[9px] font-semibold text-muted-foreground">{item.count} jobs · {item.label}</p>
                        <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
                          <div className={`h-1 rounded-full ${item.bar}`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        )}

        {!isLoading && (
          <Accordion type="single" collapsible defaultValue="breakdown">
            <AccordionItem
              value="breakdown"
              className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm"
            >
              <AccordionTrigger className="bg-card px-5 py-4 hover:no-underline">
                <span className="text-sm font-bold text-foreground">
                  {period === "today"
                    ? `${T("today")} Breakdown`
                    : period === "week"
                      ? `${T("thisWeek")} Breakdown`
                      : T("thisMonthBreakdown")}
                </span>
              </AccordionTrigger>
              <AccordionContent className="pt-0 pb-0">
                <div className="divide-y divide-border/30">
                  {[
                    {
                      label: `${T("totalEarned")} (${riderKeepPct}%)`,
                      value: formatCurrency(periodData.earnings),
                      color: "text-success",
                    },
                    {
                      label: `${T("deliveries")} ${T("completedLabel")}`,
                      value: String(periodData.deliveries),
                      color: "text-foreground",
                    },
                    {
                      label: T("avgPerDelivery"),
                      value: formatCurrency(avgPerDelivery),
                      color: "text-foreground",
                    },
                  ].map((row) => (
                    <div key={row.label} className="flex items-center justify-between px-5 py-3.5">
                      <span className="text-sm text-muted-foreground">{row.label}</span>
                      <span className={`text-sm font-extrabold ${row.color}`}>{row.value}</span>
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        )}

        {/* Monthly Tax Summary */}
        <div className="rounded-3xl border border-border bg-card shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 bg-card">
            <p className="flex items-center gap-1.5 text-sm font-bold text-foreground">
              <FileText size={14} className="text-foreground" /> {T("monthlyTaxSummary")}
            </p>
            <span className="rounded-full bg-brand px-2 py-0.5 text-[9px] font-bold tracking-wider text-black uppercase">
              {T("lastSixMonths")}
            </span>
          </div>

          {monthlyLoading ? (
            <div className="divide-y divide-border/30">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-center justify-between px-5 py-3.5">
                  <div className="h-3 w-20 animate-pulse rounded-full bg-muted" />
                  <div className="h-3 w-16 animate-pulse rounded-full bg-muted" />
                </div>
              ))}
            </div>
          ) : monthlyStatements.length === 0 ? (
            <div className="px-5 py-8 text-center">
              <Calendar size={28} className="mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm font-bold text-muted-foreground">{T("noMonthlyDataYet")}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Complete deliveries to see monthly summaries</p>
            </div>
          ) : (
            <div className="divide-y divide-border/30">
              {monthlyStatements.map((m) => {
                const monthKey = `${m.year}-${String(m.month).padStart(2, "0")}`;
                const isOpen = expandedMonth === monthKey;
                const commPct = m.grossEarnings > 0
                  ? Math.round((m.commission / m.grossEarnings) * 100)
                  : 0;
                return (
                  <div key={monthKey}>
                    <button
                      onClick={() => setExpandedMonth(isOpen ? null : monthKey)}
                      className="flex w-full items-center justify-between px-5 py-3.5 text-left active:bg-muted"
                    >
                      <div className="flex items-center gap-2">
                        {isOpen ? (
                          <ChevronUp size={14} className="text-muted-foreground" />
                        ) : (
                          <ChevronDown size={14} className="text-muted-foreground" />
                        )}
                        <div>
                          <p className="text-sm font-bold text-foreground">{m.label}</p>
                          <p className="text-[10px] text-muted-foreground">{m.deliveries} deliveries</p>
                        </div>
                      </div>
                      <p className="text-sm font-extrabold text-success">
                        +{formatCurrency(m.netEarnings)}
                      </p>
                    </button>

                    {isOpen && (
                      <div className="border-t border-border/30 bg-card px-5 pb-4 pt-3">
                        <div className="space-y-2 mb-4">
                          {[
                            { label: "Gross Earnings", value: formatCurrency(m.grossEarnings), color: "text-foreground" },
                            { label: `Platform Commission (${commPct}%)`, value: `−${formatCurrency(m.commission)}`, color: "text-error" },
                            { label: "Net Earnings", value: formatCurrency(m.netEarnings), color: "text-success" },
                            { label: "Deliveries Completed", value: String(m.deliveries), color: "text-foreground" },
                          ].map((row) => (
                            <div key={row.label} className="flex items-center justify-between">
                              <span className="text-xs text-muted-foreground">{row.label}</span>
                              <span className={`text-xs font-extrabold ${row.color}`}>{row.value}</span>
                            </div>
                          ))}
                        </div>
                        <button
                          onClick={async () => {
                            const text = [
                              `=== ${m.label} Earnings Statement ===`,
                              `Gross Earnings: ${formatCurrency(m.grossEarnings)}`,
                              `Platform Commission: −${formatCurrency(m.commission)}`,
                              `Net Earnings: ${formatCurrency(m.netEarnings)}`,
                              `Deliveries Completed: ${m.deliveries}`,
                              `Generated: ${new Date().toLocaleString()}`,
                              "Powered by AJKMart Rider",
                            ].join("\n");
                            if (navigator.share) {
                              try {
                                await navigator.share({ title: `${m.label} Statement`, text });
                              } catch { /* cancelled */ }
                            } else {
                              try {
                                await navigator.clipboard.writeText(text);
                              } catch { /* not available */ }
                            }
                          }}
                          className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-2.5 text-xs font-bold text-black active:opacity-80"
                        >
                          <Share2 size={13} /> Share Statement
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Completed Rides List */}
        <CompletedRidesList formatCurrency={formatCurrency} currency={currency} />

        <Accordion type="single" collapsible>
          <AccordionItem
            value="how-it-works"
            className="overflow-hidden rounded-3xl border-0 bg-brand"
          >
            <AccordionTrigger className="px-5 py-4 hover:no-underline [&>svg]:text-black/40">
              <span className="flex items-center gap-1.5 text-sm font-bold text-black">
                <CreditCard size={14} className="text-black/60" /> {T("howEarningsWork")}
              </span>
            </AccordionTrigger>
            <AccordionContent className="pt-0">
              <div className="space-y-2 px-5 pb-1">
                {[
                  T("keepPercentage").replace("{pct}", String(riderKeepPct)),
                  T("earningsCreditedInstantly"),
                  T("withdrawAnytime"),
                  T("processedWithin"),
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-2.5">
                    <CheckCircle size={13} className="mt-0.5 flex-shrink-0 text-black/60" />
                    <p className="text-xs leading-relaxed font-medium text-black/70">{item}</p>
                  </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>

      {showGoalModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center">
          <div className="w-full max-w-sm rounded-t-3xl bg-card p-6 shadow-2xl sm:rounded-3xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-base font-extrabold text-foreground">{T("setDailyGoalTitle")}</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Admin default: {formatCurrency(adminDailyGoal)}/day
                </p>
              </div>
              <button
                onClick={() => setShowGoalModal(false)}
                className="rounded-xl bg-muted p-2 text-muted-foreground transition-colors hover:bg-muted"
              >
                <X size={16} />
              </button>
            </div>

            <div className="mb-4">
              <label className="mb-1.5 block text-xs font-bold tracking-wider text-muted-foreground uppercase">
                Your Personal Goal ({currency})
              </label>
              <div className="flex items-center overflow-hidden rounded-2xl border-2 border-border transition-colors focus-within:border-brand/50">
                <span className="px-3 text-sm font-bold text-muted-foreground">{currency}</span>
                <input
                  type="number"
                  min="1"
                  max="999999"
                  step="1"
                  value={goalInput}
                  onChange={(e) => {
                    const val = e.target.value;
                    setGoalInput(val);
                    if (val.trim() === "") {
                      setGoalError(null);
                    } else {
                      const normalized = val.replace(/,/g, "").trim();
                      /* Number() + isFinite rejects scientific-notation strings,
                         NaN, ±Infinity, and negatives from the hardware minus key.
                         Math.floor floors fractions (e.g. 0.5 → 0) before range
                         checks so the live error matches what handleSaveGoal sends. */
                      const num = Number(normalized);
                      if (!isFinite(num) || num < 0) {
                        setGoalError(T("enterValidAmount"));
                      } else {
                        const parsed = Math.floor(num);
                        if (parsed < 1) {
                          setGoalError(T("goalTooLow"));
                        } else if (parsed > 999999) {
                          setGoalError(T("goalTooHigh"));
                        } else {
                          setGoalError(null);
                        }
                      }
                    }
                  }}
                  placeholder={String(Math.round(adminDailyGoal))}
                  className="flex-1 bg-transparent py-3 pr-3 text-lg font-extrabold text-foreground outline-none"
                  autoFocus
                />
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">
                Leave blank to use the admin default ({formatCurrency(adminDailyGoal)}).
              </p>
            </div>

            {goalError && (
              <p className="mb-3 px-1 text-xs font-semibold text-error">{goalError}</p>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => setShowGoalModal(false)}
                className="flex-1 rounded-2xl border border-border py-3 text-sm font-bold text-muted-foreground transition-colors hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveGoal}
                disabled={goalMutation.isPending || (goalError !== null && goalInput.trim() !== "")}
                className="flex-1 rounded-2xl bg-brand py-3 text-sm font-bold text-black transition-colors disabled:opacity-60"
              >
                {goalMutation.isPending ? "Saving…" : T("saveGoal")}
              </button>
            </div>

            {isPersonalGoal && (
              <button
                onClick={() => goalMutation.mutate(null)}
                disabled={goalMutation.isPending}
                className="mt-2 w-full py-2.5 text-xs font-bold text-error transition-colors hover:text-error disabled:opacity-60"
              >
                {T("resetToAdminDefault")}
              </button>
            )}
          </div>
        </div>
      )}
    </PullToRefresh>
  );
}
