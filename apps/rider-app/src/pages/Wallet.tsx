import { createLogger } from "@/lib/logger";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatCurrency as _sharedFcW } from "@workspace/api-zod";
import { tDual, type TranslationKey } from "@workspace/i18n";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { PullToRefresh } from "../components/PullToRefresh";
import { ErrorState } from "../components/ui/ErrorState";
import WithdrawModal from "../components/wallet/WithdrawModal";
import { api } from "../lib/api";
import { recordUsage } from "../lib/featureGate";
import { useFeatureGate } from "../lib/useFeatureGate";
import { useSocket } from "../lib/socket";
import { useAuth } from "../lib/rider-auth";
import { formatDateTz, usePlatformConfig } from "../lib/useConfig";
import { ConfigFeatureGate } from "../components/ConfigFeatureGate";
import { useLanguage } from "../lib/useLanguage";
const log = createLogger("[Wallet]");
/* W3: Each wallet modal owns its own state and is conditionally mounted —
   we ensure that flipping `showWithdraw`/`showDeposit`/`showRemittance` to
   false unmounts the modal so its `useState` defaults reset on next open.
   The render below already does this via `{showWithdraw && <WithdrawModal …>}`
   guards, so reopening the modal yields a fresh instance with empty inputs. */
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  Banknote,
  BarChart3,
  Building2,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Clock,
  CreditCard,
  Eye,
  EyeOff,
  Gift,
  Heart,
  Landmark,
  Lock,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Star,
  TrendingUp,
  Wallet2,
  XCircle,
} from "lucide-react";
import DepositModal from "../components/wallet/DepositModal";
import RemittanceModal from "../components/wallet/RemittanceModal";
import { toast } from "@/hooks/use-toast";
import { VerificationGateModal } from "../components/VerificationGateModal";

/* C-03: Config-driven decimal formatting.
   ISO 4217 currencies that have no sub-unit (0 decimal places).
   All others default to 2 decimal places.
   The active currency code comes from platform config (e.g. "PKR", "USD"),
   ensuring this stays in sync with any currency the admin configures.       */
const ZERO_DECIMAL_CURRENCIES = new Set([
  "PKR", "JPY", "KRW", "VND", "IDR", "CLP", "ISK", "MGA", "PYG", "RWF", "UGX",
  "BIF", "DJF", "GNF", "KMF", "LAK", "MNT", "XAF", "XOF", "XPF",
]);

function currencyFractionDigits(currencyCode?: string | null): number {
  if (!currencyCode) return 2;
  return ZERO_DECIMAL_CURRENCIES.has(currencyCode.toUpperCase()) ? 0 : 2;
}

function normalizeCurrencyAmount(
  n: string | number | null | undefined,
  currencyCode?: string | null
): string | null | undefined {
  if (n == null) return n as null | undefined;
  const num = typeof n === "number" ? n : parseFloat(String(n));
  if (isNaN(num)) return String(n);
  return num.toFixed(currencyFractionDigits(currencyCode));
}

/* fc() — formats a monetary value using the platform-configured currency.
   Pass currencySymbol for the display symbol and currencyCode (ISO 4217) to
   determine decimal precision. The third param is optional for backward compat
   with call sites inside sub-components that only have the symbol. */
const fc = (
  n: string | number | null | undefined,
  currencySymbol = "Rs.",
  currencyCode?: string | null
) => _sharedFcW(normalizeCurrencyAmount(n, currencyCode), currencySymbol);
const fd = (d: string | Date, tz?: string) =>
  formatDateTz(
    d,
    { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" },
    tz ?? "Asia/Karachi"
  );
const fdr = (d: string | Date) => {
  const diff = Date.now() - new Date(d).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return "just now";
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};
function dateGroupLabel(d: string): string {
  const now = new Date();
  const dt = new Date(d);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (dt >= today) return "today_group";
  if (dt >= yesterday) return "yesterday_group";
  const weekAgo = new Date(today);
  weekAgo.setDate(today.getDate() - 7);
  if (dt >= weekAgo) return "thisWeek_group";
  return dt.toLocaleDateString("en-PK", { month: "long", year: "numeric" });
}
function TxIcon({ type }: { type: string }) {
  const base = "w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0";
  if (type === "credit")
    return (
      <div className={`${base} bg-success/10`}>
        <TrendingUp size={18} className="text-success" />
      </div>
    );
  if (type === "bonus")
    return (
      <div className={`${base} bg-blue-500/10`}>
        <Gift size={18} className="text-blue-400" />
      </div>
    );
  if (type === "loyalty")
    return (
      <div className={`${base} bg-purple-500/10`}>
        <Star size={18} className="text-purple-400" />
      </div>
    );
  if (type === "cashback")
    return (
      <div className={`${base} bg-pink-500/10`}>
        <Heart size={18} className="text-pink-600" />
      </div>
    );
  if (type === "platform_fee")
    return (
      <div className={`${base} bg-warning/10`}>
        <Building2 size={18} className="text-warning" />
      </div>
    );
  if (type === "deposit")
    return (
      <div className={`${base} bg-success/10`}>
        <ArrowDownToLine size={18} className="text-teal-600" />
      </div>
    );
  if (type === "cod_remittance")
    return (
      <div className={`${base} bg-blue-500/10`}>
        <Banknote size={18} className="text-blue-400" />
      </div>
    );
  if (type === "cash_collection")
    return (
      <div className={`${base} bg-blue-500/10`}>
        <Banknote size={18} className="text-blue-400" />
      </div>
    );
  return (
    <div className={`${base} bg-error/10`}>
      <ArrowUpFromLine size={18} className="text-error" />
    </div>
  );
}

function txMeta(type: string) {
  if (type === "credit")
    return { labelKey: "earnings" as TranslationKey, badge: "bg-success/15 text-success" };
  if (type === "bonus")
    return { labelKey: "bonus" as TranslationKey, badge: "bg-blue-500/15 text-blue-400" };
  if (type === "loyalty")
    return { labelKey: "loyalty" as TranslationKey, badge: "bg-purple-100 text-purple-700" };
  if (type === "cashback")
    return { labelKey: "cashback" as TranslationKey, badge: "bg-pink-500/15 text-pink-700" };
  if (type === "platform_fee")
    return { labelKey: "platformFare" as TranslationKey, badge: "bg-warning/15 text-warning" };
  if (type === "deposit")
    return { labelKey: "deposit" as TranslationKey, badge: "bg-success/15 text-success" };
  if (type === "cod_remittance")
    return { labelKey: "remittanceLabel" as TranslationKey, badge: "bg-blue-500/15 text-blue-400" };
  if (type === "cash_collection")
    return { labelKey: "collected" as TranslationKey, badge: "bg-blue-500/15 text-blue-400" };
  return { labelKey: "withdraw" as TranslationKey, badge: "bg-error/15 text-error" };
}

function MethodIcon({ method }: { method: string | null }) {
  if (!method) return <Landmark size={16} className="text-blue-500" />;
  const m = method.toLowerCase();
  if (m.includes("jazzcash")) return <Smartphone size={16} className="text-error" />;
  if (m.includes("easypaisa")) return <Smartphone size={16} className="text-success" />;
  return <Landmark size={16} className="text-blue-500" />;
}

function EarningsChart({ transactions }: { transactions: WalletTx[] }) {
  const { language } = useLanguage();
  const T = (key: TranslationKey) => tDual(key, language);
  const { config: chartConfig } = usePlatformConfig();
  const chartCurrency = chartConfig.platform.currencySymbol ?? "Rs.";
  const chartCurrencyCode = chartConfig.platform.currencyCode ?? null;
  const days = useMemo(() => {
    const result: { label: string; amount: number; date: string }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      d.setHours(0, 0, 0, 0);
      const next = new Date(d);
      next.setDate(next.getDate() + 1);
      const earned = transactions
        .filter(
          (t) => t.type === "credit" && new Date(t.createdAt) >= d && new Date(t.createdAt) < next
        )
        .reduce((s, t) => s + Number(t.amount), 0);
      result.push({
        label: i === 0 ? T("today") : d.toLocaleDateString("en-PK", { weekday: "short" }),
        amount: earned,
        date: d.toLocaleDateString("en-PK", { day: "numeric", month: "short" }),
      });
    }
    return result;
  }, [transactions]); // eslint-disable-line react-hooks/exhaustive-deps

  const maxVal = Math.max(...days.map((d) => d.amount), 1);
  const weekTotal = days.reduce((s, d) => s + d.amount, 0);
  const bestIdx = days.reduce((best, d, i) => (d.amount > days[best]!.amount ? i : best), 0);

  return (
    <div className="rounded-3xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 size={15} className="text-muted-foreground" />
          <p className="text-sm font-bold text-foreground">{T("sevenDayEarnings")}</p>
        </div>
        <p className="text-base font-black text-brand">{fc(weekTotal, chartCurrency, chartCurrencyCode)}</p>
      </div>
      <div className="flex h-20 items-end gap-3">
        {days.map((d, i) => (
          <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
            <div className="flex w-full items-end justify-center" style={{ height: 56 }}>
              <div
                className={`w-full max-w-[20px] rounded-md transition-all duration-500 ${
                  i === bestIdx ? "bg-brand" : "bg-muted/20"
                }`}
                style={{ height: Math.max((d.amount / maxVal) * 56, d.amount > 0 ? 4 : 2) }}
                title={`${d.date}: ${fc(d.amount, chartCurrency, chartCurrencyCode)}`}
              />
            </div>
            <p
              className={`text-[10px] font-semibold ${i === bestIdx ? "text-brand" : "text-muted-foreground"}`}
            >
              {d.label}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function PendingRequestCard({ tx }: { tx: WalletTx }) {
  const { language } = useLanguage();
  const T = (key: TranslationKey) => tDual(key, language);
  const { config: cardConfig } = usePlatformConfig();
  const cardCurrency = cardConfig.platform.currencySymbol ?? "Rs.";
  const cardCurrencyCode = cardConfig.platform.currencyCode ?? null;
  const parsed = (() => {
    const parts = (tx.description || "").replace("Withdrawal — ", "").split(" · ");
    return {
      bank: parts[0] || "—",
      account: parts[1] || "—",
      title: parts[2] || "—",
      note: parts[3] || "",
    };
  })();

  const ref = tx.reference ?? "pending";
  const status =
    ref === "pending"
      ? "pending"
      : ref.startsWith("paid:")
        ? "paid"
        : ref.startsWith("rejected:")
          ? "rejected"
          : "pending";
  const refNo = ref.startsWith("paid:")
    ? ref.slice(5)
    : ref.startsWith("rejected:")
      ? ref.slice(9)
      : "";
  const isBankTransfer =
    tx.paymentMethod === "bank" ||
    tx.paymentMethod === "bank_transfer" ||
    (!tx.paymentMethod &&
      parsed.bank &&
      !parsed.bank.toLowerCase().includes("jazz") &&
      !parsed.bank.toLowerCase().includes("easypaisa") &&
      !parsed.bank.toLowerCase().includes("easy"));

  const statusConfig = {
    pending: {
      label: T("processing"),
      icon: <Clock size={11} />,
      bg: "bg-warning/10",
      border: "border-warning/30",
      badge: "bg-warning/15 text-warning",
      dot: "bg-warning",
    },
    paid: {
      label: T("paid"),
      icon: <CheckCircle size={11} />,
      bg: "bg-success/10",
      border: "border-success/30",
      badge: "bg-success/15 text-success",
      dot: "bg-success",
    },
    rejected: {
      label: T("rejected"),
      icon: <XCircle size={11} />,
      bg: "bg-error/10",
      border: "border-error/30",
      badge: "bg-error/15 text-error",
      dot: "bg-error",
    },
  }[status] ?? {
    label: T("processing"),
    icon: <Clock size={11} />,
    bg: "bg-warning/10",
    border: "border-warning/30",
    badge: "bg-warning/15 text-warning",
    dot: "bg-warning",
  };

  return (
    <div className={`${statusConfig.bg} border ${statusConfig.border} rounded-2xl p-4`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-card shadow-sm">
            <MethodIcon method={tx.paymentMethod || parsed.bank} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-black text-foreground">{parsed.bank}</p>
            <p className="mt-0.5 font-mono text-xs text-muted-foreground">{parsed.account}</p>
          </div>
        </div>
        <div className="flex-shrink-0 text-right">
          <p className="text-lg font-black text-foreground">{fc(Number(tx.amount), cardCurrency, cardCurrencyCode)}</p>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${statusConfig.badge} inline-flex items-center gap-1`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${statusConfig.dot} ${status === "pending" ? "animate-pulse" : ""}`}
            />
            {statusConfig.icon} {statusConfig.label}
          </span>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
        <p className="text-[10px] text-muted-foreground">
          {fd(tx.createdAt)} · {fdr(tx.createdAt)}
        </p>
        {refNo && status !== "rejected" && (
          <p className="text-[10px] font-bold text-muted-foreground">
            {isBankTransfer ? "UTR" : "Ref"}: {refNo}
          </p>
        )}
      </div>
      {status === "rejected" && refNo && (
        <div className="mt-2 rounded-xl bg-card/70 px-3 py-2">
          <p className="text-xs font-medium text-error">
            {T("reason")}: {refNo}
          </p>
          <p className="mt-0.5 text-[10px] text-error">{T("amountRefunded")}</p>
        </div>
      )}
      {status === "pending" && (
        <p className="mt-2 text-[10px] font-medium text-warning">{T("adminProcess24h")}</p>
      )}
    </div>
  );
}

type WalletTx = {
  id: string;
  type: string;
  amount: string | number;
  description?: string;
  reference?: string;
  createdAt: string;
  paymentMethod?: string;
};

interface DepositItem {
  id: string;
  status: string;
  method?: string;
  createdAt: string;
  note?: string;
  amount: number | string;
}

type TxFilter = "all" | "credit" | "debit" | "bonus" | "fees";


function SkeletonWallet() {
  return (
    <div className="min-h-screen bg-page-bg">
      <div
        className="relative overflow-hidden rounded-b-[2rem] page-header-gradient bg-card px-5 pb-8"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 3.5rem)" }}
      >
        <div className="absolute top-0 right-0 h-64 w-64 translate-x-1/3 -translate-y-1/2 rounded-full bg-muted/20" />
        <div className="absolute bottom-0 left-0 h-44 w-44 -translate-x-1/4 translate-y-1/2 rounded-full bg-muted/20" />
        <div className="relative">
          <div className="mb-6 flex animate-pulse items-center justify-between">
            <div className="h-3 w-24 rounded bg-muted/20" />
            <div className="h-8 w-8 rounded-full bg-card/5" />
          </div>
          <div className="mb-6 h-12 w-52 animate-pulse rounded-xl bg-muted/20" />
          <div className="mb-5 flex animate-pulse gap-3">
            <div className="h-16 flex-1 rounded-2xl bg-card/5" />
            <div className="h-16 flex-1 rounded-2xl bg-card/5" />
            <div className="h-16 flex-1 rounded-2xl bg-card/5" />
          </div>
          <div className="flex animate-pulse gap-3">
            <div className="h-13 flex-1 rounded-2xl bg-card/15" />
            <div className="h-13 flex-1 rounded-2xl bg-muted/20" />
          </div>
        </div>
      </div>
      <div className="-mt-4 space-y-4 px-5 py-5">
        <div className="animate-pulse rounded-3xl border border-border bg-card p-5 shadow-sm">
          <div className="mb-4 h-4 w-32 rounded bg-muted" />
          <div className="flex h-20 items-end gap-3">
            {[20, 35, 15, 45, 30, 50, 25].map((h, i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
                <div
                  className="w-full max-w-[20px] rounded-md bg-muted"
                  style={{ height: `${h}px` }}
                />
                <div className="h-2 w-4 rounded bg-muted" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Wallet() {
  useLocation();
  const { user, refreshUser } = useAuth();
  const withdrawGate = useFeatureGate("withdraw_money");
  const { config } = usePlatformConfig();
  const currency = config.platform.currencySymbol ?? "Rs.";
  /* C-03: ISO 4217 currency code from platform config — drives decimal precision in fc(). */
  const currencyCode = config.platform.currencyCode ?? null;
  const tz = config.regional?.timezone ?? "Asia/Karachi";
  const _fd = (d: string | Date) =>
    formatDateTz(d, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }, tz);
  const riderKeepPct = config.rider?.keepPct ?? config.finance.riderEarningPct;
  const minPayout = config.rider?.minPayout ?? config.finance.minRiderPayout;
  const maxPayout = config.rider?.maxPayout ?? 0;
  const withdrawalEnabled = config.rider?.withdrawalEnabled !== false;
  const depositEnabled = config.rider?.depositEnabled !== false;
  const minBalanceFallback = config.rider?.minBalance ?? 0;
  const procDays = config.wallet?.withdrawalProcessingDays ?? 2;
  const qc = useQueryClient();
  const { socket: sharedSocket } = useSocket();

  const [showWithdraw, setShowWithdraw] = useState(false);
  const [showRemittance, setShowRemittance] = useState(false);
  const [showDeposit, setShowDeposit] = useState(false);
  const [showVerifGateModal, setShowVerifGateModal] = useState(false);
  const [verifGateMissing, setVerifGateMissing] = useState<string[]>([]);
  const [verifGateMsg, setVerifGateMsg] = useState<string | undefined>(undefined);
  const [verifGateDismissible, setVerifGateDismissible] = useState(true);
  const [filter, setFilter] = useState<TxFilter>("all");
  const [showRequests, setShowRequests] = useState(true);
  const [showCodHistory, setShowCodHistory] = useState(false);
  const [balanceHidden, setBalanceHidden] = useState(false);
  /* W2: sentinel observed at the bottom of the transactions list to trigger
     fetchNextPage. Kept as a ref so the IntersectionObserver re-binds only
     when the sentinel mounts/unmounts, not on every render. */
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  /* W5: Real-time wallet balance updates via socket.
     Invalidates the wallet query cache when the server emits a wallet event
     so the balance and transaction list refresh without a manual pull-to-refresh. */
  useEffect(() => {
    if (!sharedSocket) return;
    const onWalletUpdate = () => {
      void qc.invalidateQueries({ queryKey: ["rider-wallet"] });
    };
    sharedSocket.on("wallet:update", onWalletUpdate);
    sharedSocket.on("wallet:transaction", onWalletUpdate);
    return () => {
      sharedSocket.off("wallet:update", onWalletUpdate);
      sharedSocket.off("wallet:transaction", onWalletUpdate);
    };
  }, [sharedSocket, qc]);

  /* W2: Cursor-paginated wallet history with infinite scroll. The first page
     also carries the canonical `balance`. Subsequent pages append to the
     visible list; the IntersectionObserver below auto-loads the next page
     when the sentinel scrolls into view. */
  const PAGE_SIZE = 50;
  const { data, isLoading, isError, refetch, fetchNextPage, hasNextPage, isFetchingNextPage, dataUpdatedAt } =
    useInfiniteQuery({
      queryKey: ["rider-wallet"],
      queryFn: ({ pageParam }) =>
        api.getWalletPage({ cursor: pageParam ?? null, limit: PAGE_SIZE }),
      initialPageParam: null as string | null,
      getNextPageParam: (lastPage) => lastPage?.nextCursor ?? undefined,
      staleTime: 30_000,
      refetchInterval: 30000,
      enabled: config.features.wallet,
    });

  const { language } = useLanguage();
  const T = (key: TranslationKey) => tDual(key, language);

  const FILTER_TABS_LOCAL = [
    { key: "all" as TxFilter, label: T("all") },
    { key: "credit" as TxFilter, label: T("earnings") },
    { key: "debit" as TxFilter, label: T("withdraw") },
    { key: "bonus" as TxFilter, label: T("bonus" as TranslationKey) },
    { key: "fees" as TxFilter, label: T("platformFare") },
  ];

  const resolveGroupLabel = (g: string) => {
    if (g === "today_group") return T("today");
    if (g === "yesterday_group") return T("yesterday");
    if (g === "thisWeek_group") return T("thisWeek");
    return g;
  };

  /* COD summary is low-urgency — 60 s polling is sufficient and avoids
     hammering the server simultaneously with the wallet transaction feed. */
  const { data: codData, refetch: refetchCod } = useQuery({
    queryKey: ["rider-cod"],
    queryFn: () => api.getCodSummary(),
    staleTime: 60_000,
    refetchInterval: 60_000,
    enabled: config.features.wallet,
  });

  /* C-02: Server-side earnings aggregates — replaces the scroll-dependent
     client-side sums that were incomplete until the rider scrolled all pages. */
  const { data: earningsSummary } = useQuery({
    queryKey: ["rider-earnings-summary"],
    queryFn: () => api.getEarningsSummary(),
    staleTime: 60_000,
    refetchInterval: 60_000,
    enabled: config.features.wallet,
  });

  /* Progressive Verification: feature access for withdrawals */
  const { data: availableFeatures } = useQuery({
    queryKey: ["rider-available-features"],
    queryFn: () => api.getAvailableFeatures(),
    staleTime: 60_000,
    refetchInterval: 120_000,
    enabled: config.features.wallet && !!user?.id,
  });

  const [showDeposits, setShowDeposits] = useState(false);
  const { data: depositsData, refetch: refetchDeposits } = useQuery<
    { deposits?: DepositItem[] } | DepositItem[] | null
  >({
    queryKey: ["rider-deposits"],
    queryFn: () => api.getDeposits(),
    enabled: showDeposits && config.features.wallet,
    staleTime: 30000,
  });

  /* Live minBalance: fetched eagerly so DepositModal always shows the admin-configured value,
     not the potentially-stale value baked into the platform config response. */
  const { data: minBalanceData } = useQuery({
    queryKey: ["rider-min-balance"],
    queryFn: () => api.getMinBalance(),
    staleTime: 60000,
    enabled: config.features.wallet,
  });
  const minBalance = (minBalanceData?.minBalance ?? minBalanceFallback) as number;

  /* W2: Flatten paged results into a single transactions array. Balance is
     authoritative on the FIRST page only (each subsequent page also returns
     the live balance, but using the first page avoids tiny flicker as later
     pages stream in). Aggregates below (today/week/total) sum the loaded
     pages — same behaviour as before, but now extends as the rider scrolls. */
  const pages = data?.pages ?? [];
  const transactions: WalletTx[] = useMemo(() => {
    const out: WalletTx[] = [];
    for (const p of pages) {
      const items = (p?.items ?? []) as WalletTx[];
      for (const it of items) out.push(it);
    }
    return out;
  }, [pages]);
  const balanceFromServer = pages[0]?.balance;
  const balance = balanceFromServer ?? "0";
  const balanceNum = balanceFromServer != null ? Number(balanceFromServer) : 0;

  /* H-06: Real stale detection — compare wallet query's last successful fetch
     timestamp against now. If data is older than 5 minutes, show the "cached"
     badge to prompt the rider to pull-to-refresh. `dataUpdatedAt` is 0 when
     the query has never loaded successfully (treated as not stale). */
  const STALE_THRESHOLD_MS = 5 * 60 * 1000;
  const isBalanceStale = dataUpdatedAt > 0 && (Date.now() - dataUpdatedAt) > STALE_THRESHOLD_MS;

  /* C-02: Use server-aggregated totals from the dedicated summary endpoint.
     Fall back to 0 while the query is loading so the UI doesn't flicker. */
  const todayEarned = earningsSummary?.todayEarned ?? 0;
  const weekEarned = earningsSummary?.weekEarned ?? 0;
  const totalEarned = earningsSummary?.totalEarned ?? 0;
  const totalWithdrawn = earningsSummary?.totalWithdrawn ?? 0;
  const promoBalance = useMemo(
    () =>
      transactions
        .filter((t) => ["bonus", "cashback", "loyalty"].includes(t.type))
        .reduce((s, t) => s + Math.max(0, Number(t.amount)), 0),
    [transactions]
  );

  const withdrawalRequests = transactions.filter(
    (t) =>
      t.type === "debit" &&
      t.description?.startsWith("Withdrawal") &&
      !t.reference?.startsWith("refund:")
  );
  const pendingRequests = withdrawalRequests.filter(
    (t) => !t.reference || t.reference === "pending"
  );
  const pendingAmt = pendingRequests.reduce((s, t) => s + Number(t.amount), 0);

  const codNetOwed = codData?.netOwed ?? 0;
  const codCollected = codData?.totalCollected ?? 0;
  const codVerified = codData?.totalVerified ?? 0;
  const codOrderCount = codData?.codOrderCount ?? 0;
  const codRemittances: WalletTx[] = codData?.remittances ?? [];
  const codPending = codRemittances.filter(
    (r) => !r.reference || r.reference === "pending" || r.reference == null
  );
  const hasPendingFullRemittance =
    codNetOwed > 0 && codPending.some((r) => Number(r.amount) >= codNetOwed);

  const filtered = useMemo(() => {
    if (filter === "all") return transactions;
    if (filter === "bonus")
      return transactions.filter(
        (t) => t.type === "bonus" || t.type === "loyalty" || t.type === "cashback"
      );
    if (filter === "fees") return transactions.filter((t) => t.type === "platform_fee");
    if (filter === "debit") return transactions.filter((t) => t.type === "debit");
    return transactions.filter((t) => t.type === filter);
  }, [filter, transactions]);

  const groupedTx = useMemo(() => {
    const groups: { label: string; items: WalletTx[] }[] = [];
    const groupMap = new Map<string, WalletTx[]>();
    for (const t of filtered) {
      const g = dateGroupLabel(t.createdAt);
      if (!groupMap.has(g)) {
        const items: WalletTx[] = [];
        groupMap.set(g, items);
        groups.push({ label: g, items });
      }
      groupMap.get(g)?.push(t);
    }
    return groups;
  }, [filtered]);

  const handlePullRefresh = useCallback(async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["rider-wallet"] }),
      qc.invalidateQueries({ queryKey: ["rider-cod"] }),
      qc.invalidateQueries({ queryKey: ["rider-earnings-summary"] }),
    ]);
  }, [qc]);

  /* W2: Auto-load next page when the sentinel scrolls into view. We re-bind
     the observer whenever `hasNextPage` flips so that once we exhaust the
     dataset we stop spending CPU on intersection callbacks. */
  useEffect(() => {
    if (!hasNextPage) return;
    const node = loadMoreRef.current;
    if (!node) return;
    const obs = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && !isFetchingNextPage) {
            void fetchNextPage();
            break;
          }
        }
      },
      { rootMargin: "200px" }
    );
    obs.observe(node);
    return () => obs.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  if (isLoading) {
    return <SkeletonWallet />;
  }

  if (isError) {
    return (
      <div className="flex min-h-screen flex-col bg-page-bg">
        <div
          className="rounded-b-[2rem] page-header-gradient bg-card px-5 pb-10"
          style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 3.5rem)" }}
        >
          <p className="mb-1 text-xs font-semibold tracking-widest text-muted-foreground uppercase">
            {T("walletBalance")}
          </p>
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground">{T("wallet")}</h1>
        </div>
        <div className="-mt-4 flex flex-1 items-center justify-center">
          <ErrorState
            title={T("somethingWentWrong")}
            subtitle={T("checkInternetRetry")}
            onRetry={() => refetch()}
            retryLabel={T("retry")}
          />
        </div>
      </div>
    );
  }

  if (!config.features.wallet) {
    return (
      <div className="min-h-screen bg-page-bg">
        <div
          className="rounded-b-[2rem] page-header-gradient bg-card px-5 pb-10"
          style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 3.5rem)" }}
        >
          <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
            {T("wallet")}
          </p>
        </div>
        <div className="-mt-4 px-5">
          <div className="rounded-3xl border border-border bg-card p-10 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-card">
              <Lock size={32} className="text-muted-foreground" />
            </div>
            <h3 className="mb-2 text-lg font-black text-foreground">{T("walletDisabled")}</h3>
            <p className="text-sm text-muted-foreground">{T("withdrawalsDisabled")}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <PullToRefresh onRefresh={handlePullRefresh} className="min-h-screen bg-page-bg pb-[calc(4rem+env(safe-area-inset-bottom,0px))]">
      <div
        className="relative overflow-hidden rounded-b-[2rem] page-header-gradient bg-card px-5 pb-8"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 3.5rem)" }}
      >
        <div className="absolute top-0 right-0 h-72 w-72 translate-x-1/3 -translate-y-1/2 rounded-full bg-success/[0.04]" />
        <div className="absolute bottom-0 left-0 h-48 w-48 -translate-x-1/4 translate-y-1/2 rounded-full bg-muted/20" />
        <div className="absolute top-1/2 right-8 h-24 w-24 rounded-full bg-success/[0.03]" />

        <div className="relative">
          <div className="mb-1 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
                {T("availableBalance")}
              </p>
            </div>
            <button
              onClick={() => setBalanceHidden((v) => !v)}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-card/5 transition-colors active:bg-muted/20"
            >
              {balanceHidden ? (
                <EyeOff size={13} className="text-muted-foreground" />
              ) : (
                <Eye size={13} className="text-muted-foreground" />
              )}
            </button>
          </div>

          <div className="mb-1 flex items-end gap-3">
            <p className="text-[42px] leading-none font-black tracking-tight text-foreground">
              {balanceHidden ? (
                "••••••"
              ) : isLoading ? (
                <span className="animate-pulse text-[28px] text-muted-foreground">loading...</span>
              ) : (
                fc(balance, currency, currencyCode)
              )}
            </p>
            {isBalanceStale && !balanceHidden && (
              <div className="mb-2 flex items-center gap-1 rounded-full bg-warning/15 px-2 py-0.5">
                <AlertTriangle size={9} className="text-warning" />
                <span className="text-[10px] font-bold text-warning">{T("cached")}</span>
              </div>
            )}
          </div>

          <div className="mb-5 flex items-center gap-2">
            {user?.isOnline && (
              <div className="flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5">
                <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" />
                <span className="text-[10px] font-bold text-success">
                  {T("online" as TranslationKey)}
                </span>
              </div>
            )}
            {pendingAmt > 0 && (
              <div className="flex items-center gap-1 rounded-full bg-warning/15 px-2 py-0.5">
                <Clock size={9} className="text-warning" />
                <span className="text-[10px] font-bold text-warning">
                  {fc(pendingAmt, currency, currencyCode)} {T("pending")}
                </span>
              </div>
            )}
          </div>

          <div className="mb-3 grid grid-cols-3 gap-2.5">
            <div className="rounded-2xl border border-border/60 bg-muted/20 px-3 py-2.5 backdrop-blur-sm">
              <p className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                {T("earnedToday")}
              </p>
              <p className="mt-0.5 text-sm font-black text-success">
                {balanceHidden ? "••••" : fc(todayEarned, currency, currencyCode)}
              </p>
            </div>
            <div className="rounded-2xl border border-border/60 bg-muted/20 px-3 py-2.5 backdrop-blur-sm">
              <p className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                {T("yourShare" as TranslationKey)}
              </p>
              <p className="mt-0.5 text-sm font-black text-foreground">{riderKeepPct}%</p>
            </div>
            <div className="rounded-2xl border border-border/60 bg-muted/20 px-3 py-2.5 backdrop-blur-sm">
              <p className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                {T("totalWithdrawn")}
              </p>
              <p className="mt-0.5 text-sm font-black text-muted-foreground">
                {fc(totalWithdrawn, currency, currencyCode)}
              </p>
            </div>
          </div>

          {promoBalance > 0 && (
            <div className="mb-5 flex items-center justify-between rounded-2xl border border-purple-400/20 bg-gradient-to-br from-purple-600/25 to-indigo-600/20 px-4 py-3.5 backdrop-blur-sm">
              <div>
                <p className="flex items-center gap-1 text-[10px] font-bold tracking-wider text-purple-300 uppercase">
                  <Sparkles size={9} /> {T("promoBalance")}
                </p>
                <p className="mt-0.5 text-xl font-black text-foreground">
                  {balanceHidden ? "••••" : fc(promoBalance, currency, currencyCode)}
                </p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">{T("bonusesCashbackLoyalty")}</p>
              </div>
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl border border-purple-400/20 bg-purple-500/20">
                <Sparkles size={16} className="text-purple-300" />
              </div>
            </div>
          )}

          {minBalance > 0 && balanceNum < minBalance && (
            <div className="mb-4 flex items-center gap-2.5 rounded-2xl border border-warning/15 bg-warning/15 px-3.5 py-2.5">
              <AlertTriangle size={14} className="flex-shrink-0 text-warning" />
              <div>
                <p className="text-xs font-bold text-warning">
                  {T("cashMinBalance")}: {fc(minBalance, currency, currencyCode)}
                </p>
                <p className="text-[10px] text-warning/60">
                  {currency} {Math.round(minBalance - balanceNum)} {T("moreNeeded")}
                </p>
              </div>
            </div>
          )}

          {procDays > 0 && (
            <p className="mb-3 flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <Clock size={9} className="text-muted-foreground" />
              {T("walletProcessingTime")}: {procDays * 24}–{procDays * 24 + 24}h
            </p>
          )}

          {(() => {
            const kycRequired = config.wallet?.kycRequired === true;
            const kycVerified = (user as { kycStatus?: string } | null)?.kycStatus === "verified";
            const hasBankInfo = !!(user?.bankName && user?.bankAccount);
            const kycBlocked = kycRequired && !kycVerified;
            const bankBlocked = !hasBankInfo;

            /* Progressive Verification: check if withdraw feature is accessible */
            const withdrawRule = availableFeatures?.features?.find((f) => f.featureName === "withdraw_money");
            const withdrawFeatureBlocked = withdrawRule ? !withdrawRule.accessible : false;
            const withdrawMissing = withdrawRule?.missingVerifications ?? [];
            const withdrawBlocked = withdrawFeatureBlocked || kycBlocked || bankBlocked;

            return (
              <>
                {/* Bank info gate */}
                {bankBlocked && withdrawalEnabled && (
                  <div className="mb-3 flex items-start gap-2.5 rounded-2xl border border-warning/20 bg-warning/15 px-3.5 py-3">
                    <AlertTriangle size={14} className="mt-0.5 flex-shrink-0 text-warning" />
                    <div>
                      <p className="text-xs font-bold text-warning">{T("bankAccountRequiredHeader")}</p>
                      <p className="mt-0.5 text-[10px] text-warning/70">
                        {T("addBankDetailsHint")}
                      </p>
                    </div>
                  </div>
                )}

                {/* KYC gate */}
                {kycBlocked && withdrawalEnabled && (
                  <div className="mb-3 flex items-start gap-2.5 rounded-2xl border border-blue-500/20 bg-blue-500/15 px-3.5 py-3">
                    <ShieldCheck size={14} className="mt-0.5 flex-shrink-0 text-blue-400" />
                    <div>
                      <p className="text-xs font-bold text-blue-300">KYC verification required</p>
                      <p className="mt-0.5 text-[10px] text-blue-400/70">
                        Your documents must be verified before withdrawing. Status:{" "}
                        <span className="font-semibold capitalize">
                          {(user as { kycStatus?: string } | null)?.kycStatus ?? "none"}
                        </span>
                        .
                      </p>
                    </div>
                  </div>
                )}

                {/* Progressive Verification gate */}
                {withdrawFeatureBlocked && withdrawalEnabled && (
                  <div className="mb-3 flex items-start gap-2.5 rounded-2xl border border-warning/20 bg-warning/15 px-3.5 py-3">
                    <Lock size={14} className="mt-0.5 flex-shrink-0 text-warning" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-warning">Verification required</p>
                      <div className="mt-1 space-y-0.5">
                        {withdrawMissing.map((v) => (
                          <p key={v} className="flex items-center gap-1 text-[10px] text-warning/70">
                            <span className="h-1 w-1 flex-shrink-0 rounded-full bg-warning" />
                            {v === "phone_verified" && "Phone number not verified"}
                            {v === "email_verified" && "Email address not verified"}
                            {v === "documents_approved" && "CNIC documents not approved"}
                            {v === "phone" && "Phone number not verified"}
                            {v === "email" && "Email address not verified"}
                            {v === "documents" && "CNIC documents not approved"}
                            {!["phone_verified", "email_verified", "documents_approved", "phone", "email", "documents"].includes(v) && v}
                          </p>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex gap-2.5">
                  <ConfigFeatureGate
                    feature="instantPayout"
                    fallback={
                      <button
                        disabled
                        className="flex flex-1 cursor-not-allowed items-center justify-center gap-2 rounded-2xl border border-border bg-card/10 py-3.5 text-sm font-bold text-muted-foreground"
                      >
                        <Lock size={14} /> Payout Unavailable
                      </button>
                    }
                  >
                  {withdrawalEnabled && !withdrawBlocked ? (
                    <button
                      onClick={() => {
                        /* Client-side gate — blocks for not_accessible and daily_limit_exceeded */
                        if (!withdrawGate.isLoading && !withdrawGate.accessible) {
                          if (withdrawGate.reason === "daily_limit_exceeded") {
                            setVerifGateMissing([]);
                            setVerifGateMsg("You have reached your daily withdrawal limit. Please try again tomorrow.");
                            setVerifGateDismissible(true);
                          } else {
                            /* not_accessible: missing verification — hard gate, not dismissible */
                            setVerifGateMissing(withdrawGate.missingVerifications.length > 0 ? withdrawGate.missingVerifications : withdrawMissing);
                            setVerifGateMsg(undefined);
                            setVerifGateDismissible(false);
                          }
                          setShowVerifGateModal(true);
                          return;
                        }
                        setShowWithdraw(true);
                      }}
                      className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-card py-3.5 text-sm font-black text-foreground shadow-lg shadow-white/10 transition-all active:bg-muted"
                    >
                      <ArrowUpFromLine size={15} /> {T("withdraw")}
                    </button>
                  ) : withdrawalEnabled && withdrawFeatureBlocked && !kycBlocked && !bankBlocked ? (
                    <button
                      onClick={() => {
                        setVerifGateMissing(withdrawMissing);
                        setVerifGateMsg(undefined);
                        setVerifGateDismissible(false);
                        setShowVerifGateModal(true);
                      }}
                      className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-card py-3.5 text-sm font-black text-foreground shadow-lg shadow-white/10 transition-all active:bg-muted"
                    >
                      <Lock size={14} /> {T("verificationRequired")}
                    </button>
                  ) : withdrawalEnabled ? (
                    <button
                      disabled
                      className="flex flex-1 cursor-not-allowed items-center justify-center gap-2 rounded-2xl border border-border bg-card/10 py-3.5 text-sm font-bold text-muted-foreground"
                    >
                      <Lock size={14} />{" "}
                      {bankBlocked
                        ? "Add Bank Info"
                        : kycBlocked
                          ? "KYC Required"
                          : T("withdrawalsPaused")}
                    </button>
                  ) : (
                    <button
                      disabled
                      className="flex flex-1 cursor-not-allowed items-center justify-center gap-2 rounded-2xl border border-border bg-card/10 py-3.5 text-sm font-bold text-muted-foreground"
                    >
                      <Lock size={14} /> {T("withdrawalsPaused")}
                    </button>
                  )}
                  </ConfigFeatureGate>
                  {depositEnabled && (
                    <button
                      onClick={() => setShowDeposit(true)}
                      className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-white/[0.08] bg-muted/20 py-3.5 text-sm font-bold text-foreground backdrop-blur-sm transition-all active:bg-card/15"
                    >
                      <ArrowDownToLine size={15} /> {T("deposit")}
                    </button>
                  )}
                </div>

                {!withdrawalEnabled && (
                  <div className="mt-3 flex items-center gap-2 rounded-2xl border border-error/15 bg-error/15 px-3 py-2">
                    <XCircle size={12} className="flex-shrink-0 text-error" />
                    <p className="text-[10px] font-medium text-error/70">
                      {T("withdrawalsDisabled")}
                    </p>
                  </div>
                )}
              </>
            );
          })()}
        </div>
      </div>

      <div className="-mt-3 space-y-4 px-5 py-5">
        <div className="rounded-3xl border border-border bg-card p-4 shadow-sm">
          <div className="grid grid-cols-3 divide-x divide-gray-100">
            {[
              {
                label: T("earnedToday"),
                value: fc(todayEarned, currency, currencyCode),
                color: "text-success",
                icon: <TrendingUp size={13} className="text-success" />,
              },
              {
                label: T("earnedThisWeek"),
                value: fc(weekEarned, currency, currencyCode),
                color: "text-blue-400",
                icon: <BarChart3 size={13} className="text-blue-500" />,
              },
              {
                label: T("totalEarned"),
                value: fc(totalEarned, currency, currencyCode),
                color: "text-violet-600",
                icon: <Wallet2 size={13} className="text-violet-500" />,
              },
            ].map((s, i) => (
              <div
                key={s.label}
                className={`text-center ${i === 0 ? "pr-3" : i === 2 ? "pl-3" : "px-3"}`}
              >
                <div className="mb-1 flex items-center justify-center gap-1">{s.icon}</div>
                <p className={`text-sm font-black ${s.color}`}>{s.value}</p>
                <p className="mt-0.5 text-[9px] leading-tight font-semibold text-muted-foreground">
                  {s.label}
                </p>
              </div>
            ))}
          </div>
        </div>

        <EarningsChart transactions={transactions} />

        {codOrderCount > 0 && (
          <div
            className={`overflow-hidden rounded-3xl border shadow-sm ${codNetOwed > 0 ? "border-blue-100 bg-card" : "border-success/20 bg-card"}`}
          >
            <div className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-2xl ${codNetOwed > 0 ? "bg-blue-500/10" : "bg-success/10"}`}
                >
                  <Banknote
                    size={20}
                    className={codNetOwed > 0 ? "text-blue-400" : "text-success"}
                  />
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">{T("codCashBalance")}</p>
                  <p className="text-[10px] text-muted-foreground">{T("cashOnDelivery")}</p>
                </div>
              </div>
              <div className="text-right">
                <p
                  className={`text-xl font-black ${codNetOwed > 0 ? "text-blue-400" : "text-success"}`}
                >
                  {fc(codNetOwed, currency, currencyCode)}
                </p>
                <p className="flex items-center justify-end gap-1 text-[10px] text-muted-foreground">
                  {codNetOwed > 0 ? (
                    T("remitCodCashBtn")
                  ) : (
                    <>
                      <CheckCircle size={10} className="text-success" /> {T("allClear")}
                    </>
                  )}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 border-t border-border/30 px-5 pt-3 pb-3 text-center">
              <div className="rounded-xl bg-card py-2">
                <p className="text-xs font-black text-foreground">{fc(codCollected, currency, currencyCode)}</p>
                <p className="text-[9px] font-medium text-muted-foreground">{T("collected")}</p>
              </div>
              <div className="rounded-xl bg-card py-2">
                <p className="text-xs font-black text-success">{fc(codVerified, currency, currencyCode)}</p>
                <p className="text-[9px] font-medium text-muted-foreground">{T("verified")}</p>
              </div>
              <div className="rounded-xl bg-card py-2">
                <p
                  className={`text-xs font-black ${codNetOwed > 0 ? "text-blue-400" : "text-muted-foreground"}`}
                >
                  {fc(codNetOwed, currency, currencyCode)}
                </p>
                <p className="text-[9px] font-medium text-muted-foreground">{T("owed")}</p>
              </div>
            </div>

            {codPending.length > 0 && (
              <div className="mx-5 mb-3 flex items-center gap-2 rounded-xl border border-warning/20 bg-warning/10 px-3 py-2">
                <div className="h-1.5 w-1.5 flex-shrink-0 animate-pulse rounded-full bg-warning" />
                <p className="text-xs font-semibold text-warning">
                  {codPending.length} {T("remitPending")}
                </p>
              </div>
            )}

            {hasPendingFullRemittance && (
              <div className="mx-5 mb-2 flex items-center gap-2 rounded-xl border border-warning/30 bg-warning/10 px-3 py-2">
                <Clock size={13} className="flex-shrink-0 text-warning" />
                <p className="text-xs font-semibold text-warning">
                  A remittance is already pending admin verification
                </p>
              </div>
            )}
            <div className="flex gap-2 px-5 pb-4">
              {codNetOwed > 0 && (
                <button
                  onClick={() => setShowRemittance(true)}
                  className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-brand py-3 text-sm font-black text-foreground transition-colors active:bg-card"
                >
                  <Banknote size={16} /> {T("remitCodCashBtn")}
                </button>
              )}
              <button
                onClick={() => setShowCodHistory(!showCodHistory)}
                className={`${codNetOwed > 0 ? "w-auto px-4" : "flex-1"} flex items-center justify-center gap-1.5 rounded-2xl border border-border bg-muted py-3 text-sm font-bold text-muted-foreground transition-colors active:bg-muted`}
              >
                {showCodHistory ? (
                  <>
                    <ChevronUp size={14} /> {T("hide")}
                  </>
                ) : (
                  T("history")
                )}
              </button>
            </div>

            {showCodHistory && codRemittances.length > 0 && (
              <div className="divide-y divide-gray-50 border-t border-border">
                {codRemittances.map((r) => {
                  const ref = r.reference ?? "pending";
                  const st =
                    ref === "pending"
                      ? "pending"
                      : ref.startsWith("verified:")
                        ? "verified"
                        : ref.startsWith("rejected:")
                          ? "rejected"
                          : "pending";
                  const stBadge =
                    st === "pending"
                      ? "bg-warning/15 text-warning"
                      : st === "verified"
                        ? "bg-success/15 text-success"
                        : "bg-error/15 text-error";
                  const stIcon =
                    st === "pending" ? (
                      <Clock size={10} />
                    ) : st === "verified" ? (
                      <CheckCircle size={10} />
                    ) : (
                      <XCircle size={10} />
                    );
                  const stLabel =
                    st === "pending"
                      ? T("pending")
                      : st === "verified"
                        ? T("verified")
                        : T("rejected");
                  const parts = (r.description || "").replace("COD Remittance — ", "").split(" · ");
                  return (
                    <div key={r.id} className="flex items-center gap-3 px-5 py-3.5">
                      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-2xl bg-blue-500/10">
                        <Banknote size={16} className="text-blue-400" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-foreground">
                          {parts[0] || "Remittance"}
                        </p>
                        <div className="mt-0.5 flex items-center gap-1.5">
                          <p className="text-[10px] text-muted-foreground">
                            {new Date(r.createdAt).toLocaleDateString("en-PK", {
                              day: "numeric",
                              month: "short",
                            })}
                          </p>
                          <span
                            className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-bold ${stBadge}`}
                          >
                            {stIcon} {stLabel}
                          </span>
                        </div>
                      </div>
                      <p className="flex-shrink-0 text-sm font-black text-blue-400">
                        {fc(Number(r.amount), currency, currencyCode)}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
          <button
            className="flex w-full items-center justify-between px-5 py-4"
            onClick={() => {
              setShowDeposits((v) => !v);
              if (!showDeposits) void refetchDeposits();
            }}
          >
            <div className="flex items-center gap-2.5">
              <ArrowDownToLine size={16} className="text-success" />
              <span className="text-sm font-bold text-foreground">{T("depositHistory")}</span>
            </div>
            {showDeposits ? (
              <ChevronUp size={16} className="text-muted-foreground" />
            ) : (
              <ChevronDown size={16} className="text-muted-foreground" />
            )}
          </button>
          {showDeposits && (
            <div className="border-t border-border/30">
              {!depositsData ? (
                <div className="flex items-center justify-center px-5 py-8">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-border border-t-foreground/40" />
                </div>
              ) : (
                (() => {
                  const depositList: DepositItem[] = Array.isArray(depositsData)
                    ? (depositsData as DepositItem[])
                    : ((depositsData as { deposits?: DepositItem[] }).deposits ?? []);
                  if (depositList.length === 0)
                    return (
                      <div className="px-5 py-8 text-center">
                        <p className="text-sm font-medium text-muted-foreground">{T("noDepositsYet")}</p>
                      </div>
                    );
                  return (
                    <div className="divide-y divide-gray-50">
                      {depositList.map((dep: DepositItem) => {
                        const st =
                          dep.status === "verified"
                            ? "verified"
                            : dep.status === "rejected"
                              ? "rejected"
                              : "pending";
                        const stBadge =
                          st === "pending"
                            ? "bg-warning/15 text-warning"
                            : st === "verified"
                              ? "bg-success/15 text-success"
                              : "bg-error/15 text-error";
                        const stIcon =
                          st === "pending" ? (
                            <Clock size={10} />
                          ) : st === "verified" ? (
                            <CheckCircle size={10} />
                          ) : (
                            <XCircle size={10} />
                          );
                        return (
                          <div key={dep.id} className="flex items-center gap-3 px-5 py-3.5">
                            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-2xl bg-success/10">
                              <ArrowDownToLine size={16} className="text-success" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-semibold text-foreground">
                                {dep.method || "Deposit"}
                              </p>
                              <div className="mt-0.5 flex items-center gap-1.5">
                                <p className="text-[10px] text-muted-foreground">
                                  {new Date(dep.createdAt).toLocaleDateString("en-PK", {
                                    day: "numeric",
                                    month: "short",
                                    year: "numeric",
                                  })}
                                </p>
                                <span
                                  className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-bold ${stBadge}`}
                                >
                                  {stIcon} {st === "pending" ? T("pending") : st === "verified" ? T("verified") : T("rejected")}
                                </span>
                              </div>
                              {dep.note && (
                                <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
                                  {dep.note}
                                </p>
                              )}
                            </div>
                            <p className="flex-shrink-0 text-sm font-black text-success">
                              {fc(Number(dep.amount), currency, currencyCode)}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()
              )}
            </div>
          )}
        </div>

        {withdrawalRequests.length > 0 && (
          <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
            <button
              className="flex w-full items-center justify-between px-5 py-4"
              onClick={() => setShowRequests(!showRequests)}
            >
              <div className="flex items-center gap-2.5">
                <span className="text-sm font-bold text-foreground">{T("withdrawalRequests")}</span>
                {pendingRequests.length > 0 && (
                  <span className="flex items-center gap-1 rounded-full bg-warning/15 px-2 py-0.5 text-[10px] font-bold text-warning">
                    <Clock size={9} /> {pendingRequests.length} {T("pending")}
                  </span>
                )}
              </div>
              {showRequests ? (
                <ChevronUp size={16} className="text-muted-foreground" />
              ) : (
                <ChevronDown size={16} className="text-muted-foreground" />
              )}
            </button>
            {showRequests && (
              <div className="space-y-3 border-t border-border/30 px-4 pt-3 pb-4">
                {withdrawalRequests.map((tx) => (
                  <PendingRequestCard key={tx.id} tx={tx} />
                ))}
                <div className="flex gap-2 rounded-xl border border-blue-100 bg-blue-500/10 p-3">
                  <ShieldCheck size={14} className="mt-0.5 flex-shrink-0 text-blue-500" />
                  <p className="text-xs font-medium text-blue-400">
                    {T("processingTime")}: {procDays * 24}–{procDays * 24 + 24}h.{" "}
                    {T("adminApproveNotify")}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {withdrawalRequests.length === 0 && (
          <div className="rounded-3xl border border-border bg-card p-5 shadow-sm">
            <p className="mb-4 flex items-center gap-2 text-sm font-bold text-foreground">
              <Sparkles size={15} className="text-success" /> {T("howItWorks")}
            </p>
            <div className="space-y-3">
              {[
                {
                  step: "1",
                  icon: <TrendingUp size={14} className="text-success" />,
                  title: T("completeDeliveries"),
                  desc: `${riderKeepPct}% ${T("earningsAddedInstantly")}`,
                },
                {
                  step: "2",
                  icon: <Wallet2 size={14} className="text-success" />,
                  title: T("buildBalance"),
                  desc: `${T("minToWithdraw")}: ${fc(minPayout, currency, currencyCode)}`,
                },
                {
                  step: "3",
                  icon: <ArrowUpFromLine size={14} className="text-success" />,
                  title: T("requestWithdrawal"),
                  desc: T("selectPaymentMethod"),
                },
                {
                  step: "4",
                  icon: <CheckCircle size={14} className="text-success" />,
                  title: T("receivePayment"),
                  desc: `${procDays * 24}–${procDays * 24 + 24}h ${T("transferTime")}`,
                },
              ].map((s) => (
                <div key={s.step} className="flex items-start gap-3">
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-success/10 text-sm font-black text-success">
                    {s.step}
                  </div>
                  <div className="min-w-0 pt-0.5">
                    <p className="flex items-center gap-1.5 text-sm font-bold text-foreground">
                      {s.icon} {s.title}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
          <div className="px-5 pt-5 pb-3">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-bold text-foreground">{T("transactionHistoryTitle")}</p>
              <span className="text-[10px] font-medium text-muted-foreground">
                {filtered.length} {T("records")}
              </span>
            </div>
            <div className="no-scrollbar flex gap-2 overflow-x-auto pb-0.5">
              {FILTER_TABS_LOCAL.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setFilter(tab.key)}
                  className={`flex-shrink-0 rounded-full px-4 py-2 text-xs font-bold transition-all ${
                    filter === tab.key
                      ? "bg-brand text-white"
                      : "border border-border bg-muted text-muted-foreground active:bg-muted"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="border-t border-border/30 px-5 py-12 text-center">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-card">
                <CreditCard size={28} className="text-muted-foreground" />
              </div>
              <p className="font-bold text-muted-foreground">{T("noTransactionsFilter")}</p>
              <p className="mt-1 text-sm text-muted-foreground">{T("completeDeliveriesTrack")}</p>
              {filter !== "all" && (
                <button
                  onClick={() => setFilter("all")}
                  className="mx-auto mt-3 flex items-center gap-0.5 text-xs font-bold text-success"
                >
                  {T("all")} {T("transactionHistoryTitle")} <ChevronRight size={12} />
                </button>
              )}
            </div>
          ) : (
            <div className="border-t border-border/30">
              {groupedTx.map((group) => (
                <div key={group.label}>
                  <div className="flex items-center justify-between border-b border-border bg-muted/50 px-5 py-2.5">
                    <p className="text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
                      {resolveGroupLabel(group.label)}
                    </p>
                    <span className="text-[10px] text-muted-foreground">{group.items.length}</span>
                  </div>
                  <div className="divide-y divide-gray-50">
                    {group.items.map((t: WalletTx) => {
                      const meta = txMeta(t.type);
                      const isDebitType = t.type === "debit" || t.type === "platform_fee";
                      const isCredit = !isDebitType;
                      const isW = t.type === "debit" && t.description?.startsWith("Withdrawal");
                      const isDeposit = t.type === "deposit";
                      const ref = isW || isDeposit ? (t.reference ?? "pending") : null;
                      const wStatus = !ref
                        ? null
                        : ref === "pending"
                          ? "pending"
                          : ref.startsWith("paid:") || ref.startsWith("approved:")
                            ? "approved"
                            : ref.startsWith("rejected:")
                              ? "rejected"
                              : null;
                      return (
                        <div key={t.id} className="flex items-center gap-3 px-5 py-3.5">
                          <TxIcon type={t.type} />
                          <div className="min-w-0 flex-1">
                            <p className="line-clamp-1 text-sm leading-snug font-semibold text-foreground">
                              {t.description}
                            </p>
                            <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                              <p className="text-[10px] text-muted-foreground">{fdr(t.createdAt)}</p>
                              <span
                                className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${meta.badge}`}
                              >
                                {T(meta.labelKey)}
                              </span>
                              {wStatus === "pending" && (
                                <span className="flex items-center gap-0.5 rounded-full bg-warning/15 px-1.5 py-0.5 text-[9px] font-bold text-warning">
                                  <Clock size={8} /> {T("pending")}
                                </span>
                              )}
                              {wStatus === "approved" && (
                                <span className="flex items-center gap-0.5 rounded-full bg-success/15 px-1.5 py-0.5 text-[9px] font-bold text-success">
                                  <CheckCircle size={8} />{" "}
                                  {isDeposit ? T("creditedLabel") : T("paid")}
                                </span>
                              )}
                              {wStatus === "rejected" && (
                                <span className="flex items-center gap-0.5 rounded-full bg-error/15 px-1.5 py-0.5 text-[9px] font-bold text-error">
                                  <XCircle size={8} /> {T("rejected")}
                                </span>
                              )}
                            </div>
                          </div>
                          <p
                            className={`flex-shrink-0 text-sm font-black ${
                              isDeposit && wStatus === "pending"
                                ? "text-warning"
                                : isDeposit
                                  ? "text-teal-600"
                                  : isCredit
                                    ? "text-success"
                                    : wStatus === "rejected"
                                      ? "text-muted-foreground line-through"
                                      : "text-error"
                            }`}
                          >
                            {isDebitType ? "−" : "+"}
                            {fc(Number(t.amount), currency, currencyCode)}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
              {/* W2: infinite-scroll sentinel + spinner. Only rendered when
                 there is a next page so we never show a permanent loader. */}
              {hasNextPage && (
                <div ref={loadMoreRef} className="flex items-center justify-center px-5 py-4">
                  {isFetchingNextPage ? (
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-border border-t-foreground/40" />
                  ) : (
                    <div className="h-5" />
                  )}
                </div>
              )}
              {!hasNextPage && transactions.length > 0 && (
                <p className="py-3 text-center text-[10px] text-muted-foreground">
                  {T("allTransactionsSecure")}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="rounded-3xl border border-success/20 bg-success/10 p-5">
          <div className="mb-3 flex items-center gap-2">
            <ShieldCheck size={15} className="text-success" />
            <p className="text-sm font-bold text-success">{T("payoutPolicy")}</p>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            {[
              { label: T("yourShare" as TranslationKey), value: `${riderKeepPct}%` },
              { label: T("minWithdrawalLabel"), value: fc(minPayout, currency, currencyCode) },
              { label: T("processingTime"), value: `${procDays * 24}-${procDays * 24 + 24}h` },
              { label: T("maxWithdrawalLabel"), value: fc(maxPayout, currency, currencyCode) },
            ].map((p) => (
              <div
                key={p.label}
                className="rounded-xl border border-success/20 bg-card px-3 py-2.5"
              >
                <p className="text-[10px] font-bold tracking-wider text-success/60 uppercase">
                  {p.label}
                </p>
                <p className="mt-0.5 text-sm font-black text-success">{p.value}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="flex items-center justify-center gap-1.5 pb-2 text-center text-[10px] text-muted-foreground">
          <ShieldCheck size={10} /> {T("allTransactionsSecure")} {config.platform.appName}
        </p>
      </div>

      {showVerifGateModal && (
        <VerificationGateModal
          missingVerifications={verifGateMissing}
          message={verifGateMsg}
          dismissible={verifGateDismissible}
          onClose={() => setShowVerifGateModal(false)}
        />
      )}

      {showRemittance && (
        <RemittanceModal
          netOwed={codNetOwed}
          codCollected={codCollected}
          pendingFullRemittance={hasPendingFullRemittance}
          onClose={() => setShowRemittance(false)}
          onSuccess={() => {
            void qc.invalidateQueries({ queryKey: ["rider-cod"] });
            void qc.invalidateQueries({ queryKey: ["rider-wallet"] });
            void qc.invalidateQueries({ queryKey: ["rider-deposits"] });
            void refetch();
            void refetchCod();
            void refetchDeposits();
            toast({ title: T("codRemittanceSubmitted") });
          }}
        />
      )}

      {showWithdraw && withdrawalEnabled && (
        <WithdrawModal
          balance={balanceNum}
          minPayout={minPayout}
          maxPayout={maxPayout}
          onClose={() => setShowWithdraw(false)}
          onSuccess={() => {
            if (user?.id) recordUsage(user.id, "withdraw_money");
            void qc.invalidateQueries({ queryKey: ["rider-wallet"] });
            void qc.invalidateQueries({ queryKey: ["rider-cod"] });
            void qc.invalidateQueries({ queryKey: ["rider-deposits"] });
            void refetch();
            void refetchCod();
            void refetchDeposits();
            refreshUser().catch((err) => {
              log.error(
                { err: err instanceof Error ? err.message : String(err) },
                "[Wallet] refreshUser failed"
              );
            });
            /* Show "Under Review" message so rider knows the request is pending admin review
               and their balance will only be deducted after the request is approved. */
            toast({ title: `${T("withdrawalSubmitted")} ${T("underReview")}` });
          }}
        />
      )}

      {showDeposit && depositEnabled && (
        <DepositModal
          balance={balanceNum}
          minBalance={minBalance}
          onClose={() => setShowDeposit(false)}
          onSuccess={() => {
            void qc.invalidateQueries({ queryKey: ["rider-wallet"] });
            void qc.invalidateQueries({ queryKey: ["rider-deposits"] });
            void refetch();
            void refetchCod();
            void refetchDeposits();
            setShowDeposits(true);
            toast({ title: T("depositSubmittedMsg") });
            /* Refresh the auth-context user so user.walletBalance reflects the
               new deposit immediately. This lets the Home page blockingReason
               useEffect drop the insufficient_wallet_balance banner without
               waiting for the next scheduled profile poll. */
            void refreshUser();
          }}
        />
      )}


    </PullToRefresh>
  );
}
