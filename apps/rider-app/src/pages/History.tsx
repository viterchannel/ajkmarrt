import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { formatCurrency as _sharedFcH } from "@workspace/api-zod";
import { tDual } from "@workspace/i18n";
import {
  Bike,
  Calendar,
  Car,
  ClipboardList,
  Copy,
  CreditCard,
  Download,
  MapPin,
  Package,
  RefreshCw,
  Share2,
  ShoppingCart,
  UtensilsCrossed,
  WifiOff,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PullToRefresh } from "../components/PullToRefresh";
import { ErrorState } from "../components/ui/ErrorState";
import { ShimmerRow } from "../components/ui/shimmer";
import { api } from "../lib/api";
import { saveRideHistoryCache } from "../lib/dashboardCache";
import { useAuth } from "../lib/rider-auth";
import { formatDateTz, usePlatformConfig } from "../lib/useConfig";
import { useLanguage } from "../lib/useLanguage";

function SkeletonHistory() {
  return (
    <div className="space-y-3 px-4 py-3">
      {[1, 2, 3, 4, 5].map((i) => (
        <ShimmerRow key={i} />
      ))}
    </div>
  );
}

function formatDate(d: string | Date, tz?: string) {
  return formatDateTz(
    d,
    { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" },
    tz ?? "Asia/Karachi"
  );
}

function formatCurrency(n: string | number | null | undefined) {
  return _sharedFcH(n != null ? String(n) : (n as null | undefined));
}

type FilterPeriod = "today" | "week" | "all";
type FilterKind = "all" | "order" | "ride" | "parcel";

type HistoryItem = {
  id: string;
  kind: "order" | "ride";
  type: string;
  status: string;
  earnings: number;
  amount: number;
  address?: string;
  createdAt: string;
  proofPhoto?: string;
  origin?: string;
  destination?: string;
  fare?: number;
  distance?: string | number;
  duration?: number;
};

const PAGE_SIZE = 50;

function RideReceiptSheet({
  item,
  tz,
  onClose,
}: {
  item: HistoryItem;
  tz: string;
  onClose: () => void;
}) {
  const [copyFeedback, setCopyFeedback] = useState(false);
  const { language } = useLanguage();
  const T = (key: Parameters<typeof tDual>[0]) => tDual(key, language);
  const completed = item.status === "delivered" || item.status === "completed";
  const cancelled = item.status === "cancelled";

  const receiptText = [
    T("receiptHeading"),
    `${T("receiptType")}: ${item.kind === "ride" ? T(`${item.type}Ride` as "bikeRide" | "carRide") : T(`${item.type}Delivery` as "bikeDelivery" | "carDelivery")}`,
    item.origin ? `${T("receiptFrom")}: ${item.origin}` : null,
    item.destination ? `${T("receiptTo")}: ${item.destination}` : null,
    item.address ? `${T("receiptAddress")}: ${item.address}` : null,
    item.fare != null ? `${T("fare")}: ${formatCurrency(item.fare)}` : null,
    item.distance != null
      ? `${T("receiptDistance")}: ${parseFloat(String(item.distance)).toFixed(1)} km`
      : null,
    item.duration != null ? `${T("receiptDuration")}: ${item.duration} min` : null,
    `${T("receiptStatus")}: ${item.status.replace(/_/g, " ").toUpperCase()}`,
    completed ? `${T("yourEarnings")}: ${formatCurrency(item.earnings || 0)}` : null,
    `${T("receiptDate")}: ${formatDate(item.createdAt, tz)}`,
    T("receiptDivider"),
  ]
    .filter(Boolean)
    .join("\n");

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${T("receiptTitle")} — ${item.kind === "ride" ? T(`${item.type}Ride` as "bikeRide" | "carRide") : T(`${item.type}Delivery` as "bikeDelivery" | "carDelivery")}`,
          text: receiptText,
        });
      } catch {
        /* user cancelled share or not supported */
      }
    } else {
      try {
        await navigator.clipboard.writeText(receiptText);
        setCopyFeedback(true);
        setTimeout(() => setCopyFeedback(false), 2000);
      } catch {
        /* clipboard not available */
      }
    }
  };

  const handleDownload = () => {
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${T("receiptTitle")}</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 480px; margin: 40px auto; padding: 20px; color: #111; }
    h1 { font-size: 22px; margin-bottom: 4px; }
    .subtitle { color: #888; font-size: 13px; margin-bottom: 24px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
    tr { border-bottom: 1px solid #f0f0f0; }
    td { padding: 10px 4px; font-size: 14px; }
    td:first-child { color: #888; width: 40%; }
    td:last-child { font-weight: 700; text-align: right; }
    .status { display: inline-block; background: ${completed ? "#dcfce7" : cancelled ? "#fee2e2" : "#fef3c7"}; color: ${completed ? "#15803d" : cancelled ? "#dc2626" : "#b45309"}; padding: 4px 12px; border-radius: 999px; font-size: 12px; font-weight: 700; }
    .earnings { color: #16a34a; font-size: 22px; font-weight: 900; }
    .footer { margin-top: 24px; font-size: 11px; color: #bbb; text-align: center; }
  </style>
</head>
<body>
  <h1>${item.kind === "ride" ? T(`${item.type}Ride` as "bikeRide" | "carRide") : T(`${item.type}Delivery` as "bikeDelivery" | "carDelivery")}</h1>
  <p class="subtitle">${formatDate(item.createdAt, tz)}</p>
  <table>
    ${item.origin ? `<tr><td>${T("receiptFrom")}</td><td>${item.origin}</td></tr>` : ""}
    ${item.destination ? `<tr><td>${T("receiptTo")}</td><td>${item.destination}</td></tr>` : ""}
    ${item.address ? `<tr><td>${T("receiptAddress")}</td><td>${item.address}</td></tr>` : ""}
    ${item.fare != null ? `<tr><td>${T("fare")}</td><td>${formatCurrency(item.fare)}</td></tr>` : ""}
    ${item.distance != null ? `<tr><td>${T("receiptDistance")}</td><td>${parseFloat(String(item.distance)).toFixed(1)} km</td></tr>` : ""}
    ${item.duration != null ? `<tr><td>${T("receiptDuration")}</td><td>${item.duration} min</td></tr>` : ""}
    <tr><td>${T("receiptStatus")}</td><td><span class="status">${item.status.replace(/_/g, " ").toUpperCase()}</span></td></tr>
    ${completed ? `<tr><td>${T("yourEarnings")}</td><td class="earnings">+${formatCurrency(item.earnings || 0)}</td></tr>` : ""}
  </table>
  <p class="footer">${T("receiptGeneratedOn")} ${new Date().toLocaleString()} &middot; AJKMart Rider</p>
</body>
</html>`;
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `receipt-${item.id.slice(-6).toUpperCase()}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-shrink-0 justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-border" />
        </div>

        <div className="flex flex-shrink-0 items-center justify-between px-5 pt-2 pb-4 border-b border-border">
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-extrabold text-foreground truncate">
              {item.kind === "ride"
                ? T(`${item.type}Ride` as "bikeRide" | "carRide")
                : T(`${item.type}Delivery` as "bikeDelivery" | "carDelivery")}
            </h3>
            <div className="mt-0.5 flex items-center gap-2 flex-wrap">
              <span className="text-xs text-muted-foreground">{formatDate(item.createdAt, tz)}</span>
              <span className="text-xs font-bold text-brand/60">#{item.id.slice(-6).toUpperCase()}</span>
            </div>
          </div>
          <div className="ml-3 flex items-center gap-2 flex-shrink-0">
            <button
              onClick={handleShare}
              aria-label="Share receipt"
              className="flex h-9 w-9 items-center justify-center rounded-2xl bg-muted text-brand active:bg-muted/80"
            >
              <Share2 size={15} />
            </button>
            <button
              onClick={onClose}
              aria-label={T("closeReceiptAriaLabel")}
              className="flex h-9 w-9 items-center justify-center rounded-2xl bg-muted text-muted-foreground active:bg-muted/80"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          {/* Status badge */}
          <div className="mb-5 flex items-center justify-between">
            <span
              className={`rounded-full px-3 py-1.5 text-xs font-extrabold tracking-wider uppercase ${
                completed
                  ? "bg-success/15 text-success"
                  : cancelled
                    ? "bg-error/15 text-error"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              {item.status.replace(/_/g, " ")}
            </span>
            {completed && item.earnings > 0 && (
              <div className="text-right">
                <p className="text-xs text-muted-foreground">{T("yourEarnings")}</p>
                <p className="text-2xl font-black text-success">
                  +{formatCurrency(item.earnings || 0)}
                </p>
              </div>
            )}
          </div>

          {/* Route */}
          {(item.origin || item.destination) && (
            <div className="mb-4 overflow-hidden rounded-2xl border border-border bg-muted/20">
              {item.origin && (
                <div className="flex items-start gap-3 px-4 py-3">
                  <div className="mt-1 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-success/15">
                    <MapPin size={12} className="text-success" />
                  </div>
                  <div>
                    <p className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
                      {T("pickup")}
                    </p>
                    <p className="text-sm font-medium text-muted-foreground">{item.origin}</p>
                  </div>
                </div>
              )}
              {item.origin && item.destination && (
                <div className="mx-4 h-px bg-border" />
              )}
              {item.destination && (
                <div className="flex items-start gap-3 px-4 py-3">
                  <div className="mt-1 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-error/15">
                    <MapPin size={12} className="text-error" />
                  </div>
                  <div>
                    <p className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
                      {T("dropLabel")}
                    </p>
                    <p className="text-sm font-medium text-muted-foreground">{item.destination}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {item.address && !item.origin && (
            <div className="mb-4 flex items-start gap-3 rounded-2xl border border-border bg-muted/20 px-4 py-3">
              <MapPin size={14} className="mt-0.5 flex-shrink-0 text-muted-foreground" />
              <p className="text-sm font-medium text-muted-foreground">{item.address}</p>
            </div>
          )}

          {/* Fare breakdown */}
          <div className="space-y-0 overflow-hidden rounded-2xl border border-border">
            {item.fare != null && (
              <div className="flex items-center justify-between border-b border-border/30 px-4 py-3">
                <span className="text-sm text-muted-foreground">{T("fare")}</span>
                <span className="text-sm font-bold text-foreground">
                  {formatCurrency(item.fare)}
                </span>
              </div>
            )}
            {item.distance != null && (
              <div className="flex items-center justify-between border-b border-border/30 px-4 py-3">
                <span className="text-sm text-muted-foreground">{T("receiptDistance")}</span>
                <span className="text-sm font-bold text-foreground">
                  {parseFloat(String(item.distance)).toFixed(1)} km
                </span>
              </div>
            )}
            {item.duration != null && (
              <div className="flex items-center justify-between border-b border-border/30 px-4 py-3">
                <span className="text-sm text-muted-foreground">{T("receiptDuration")}</span>
                <span className="text-sm font-bold text-foreground">{item.duration} min</span>
              </div>
            )}
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-sm text-muted-foreground">{T("receiptDateAndTime")}</span>
              <span className="text-sm font-bold text-foreground">
                {formatDate(item.createdAt, tz)}
              </span>
            </div>
          </div>

          {/* Proof photo */}
          {item.proofPhoto && completed && item.kind === "order" && (
            <div className="mt-4">
              <p className="mb-2 text-xs font-bold tracking-wider text-muted-foreground uppercase">
                {T("deliveryProof")}
              </p>
              <a
                href={item.proofPhoto}
                target="_blank"
                rel="noopener noreferrer"
                className="block overflow-hidden rounded-2xl"
              >
                <img
                  src={item.proofPhoto}
                  alt={T("deliveryProof")}
                  className="w-full object-cover"
                  loading="lazy"
                />
              </a>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div
          className="flex flex-shrink-0 gap-3 border-t border-border px-5 pt-4 pb-6"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 1.5rem)" }}
        >
          <button
            onClick={handleShare}
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-brand py-3.5 text-sm font-bold text-black active:opacity-80"
          >
            {copyFeedback ? (
              <>
                <Copy size={15} /> {T("copiedFeedback")}
              </>
            ) : (
              <>
                <Share2 size={15} /> {T("shareReceipt")}
              </>
            )}
          </button>
          <button
            onClick={handleDownload}
            aria-label={T("downloadReceiptAriaLabel")}
            className="flex items-center justify-center gap-2 rounded-2xl border border-border bg-card px-4 py-3.5 text-sm font-bold text-muted-foreground active:bg-muted"
          >
            <Download size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function History() {
  const [period, setPeriod] = useState<FilterPeriod>("all");
  const [kind, setKind] = useState<FilterKind>("all");
  const [selectedReceipt, setSelectedReceipt] = useState<HistoryItem | null>(null);
  const { language } = useLanguage();
  const T = (key: Parameters<typeof tDual>[0]) => tDual(key, language);
  const { config } = usePlatformConfig();
  const tz = config.regional?.timezone ?? "Asia/Karachi";
  const qc = useQueryClient();
  const { apiUnreachable } = useAuth();
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const goOnline = () => setIsOffline(false);
    const goOffline = () => setIsOffline(true);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  const {
    data,
    isLoading,
    isError,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    refetch,
    isFetching,
  } = useInfiniteQuery({
    /* Include kind + period in the queryKey so switching filters triggers
       a fresh page-1 fetch rather than re-using the stale accumulated pages
       from a different filter combination. */
    queryKey: ["rider-history", kind, period],
    queryFn: ({ pageParam }: { pageParam: number }) =>
      api.getHistory({ limit: PAGE_SIZE, offset: pageParam, kind, period }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, _allPages, lastPageParam: number) =>
      lastPage.hasMore ? lastPageParam + PAGE_SIZE : undefined,
    refetchInterval: false,
  });

  /* Save the first page of the default filter (all/all) to IndexedDB so it
     can be shown offline after a reload. Only cache when online to avoid
     overwriting a valid cache with stale seeded data. */
  useEffect(() => {
    if (isOffline || apiUnreachable) return;
    const firstPage = data?.pages?.[0];
    if (!firstPage || kind !== "all" || period !== "all") return;
    saveRideHistoryCache(firstPage).catch(() => { /* non-critical */ });
  }, [data, kind, period, isOffline, apiUnreachable]);

  /* Whether we are showing cached data seeded at startup rather than a live fetch */
  const showingCachedData = (isOffline || apiUnreachable) && !isLoading && !isError && (data?.pages?.length ?? 0) > 0;

  /* Accumulate all loaded pages into a flat list — filters are applied server-side */
  const filtered: HistoryItem[] = data?.pages.flatMap((p) => p.history) ?? [];

  /* Date boundaries for grouping headers (display only, not for data filtering).
     Resolve today/week boundaries in the platform timezone so riders see correct
     groupings regardless of browser/device timezone setting. */
  const todayStart = useMemo(() => {
    const timezone = tz;
    try {
      const formatter = new Intl.DateTimeFormat("en-CA", {
        timeZone: timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });
      const parts = formatter.formatToParts(new Date());
      const y = parts.find((p) => p.type === "year")?.value ?? "2000";
      const m = parts.find((p) => p.type === "month")?.value ?? "01";
      const d = parts.find((p) => p.type === "day")?.value ?? "01";
      /* Timezone-aware midnight: compute the UTC epoch where the platform clock
         shows 00:00:00 on this date.
         Strategy — evaluate UTC noon for this date, then ask the Intl formatter
         what clock-time the target timezone shows at that UTC instant.  The
         offset (tzHour:tzMin:tzSec from noon) lets us back-solve for UTC midnight:
           utcMidnight = utcNoon − tzTimeAtNoon_ms
         Works for any fixed-offset or DST timezone because we measure the real
         offset at run-time rather than hard-coding "+05:00". */
      const utcNoon = Date.UTC(parseInt(y), parseInt(m) - 1, parseInt(d), 12, 0, 0);
      const noonParts = new Intl.DateTimeFormat("en-CA", {
        timeZone: timezone,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      }).formatToParts(new Date(utcNoon));
      const h = parseInt(noonParts.find((p) => p.type === "hour")?.value ?? "12");
      const min = parseInt(noonParts.find((p) => p.type === "minute")?.value ?? "0");
      const sec = parseInt(noonParts.find((p) => p.type === "second")?.value ?? "0");
      return new Date(utcNoon - (h * 3600 + min * 60 + sec) * 1000);
    } catch {
      const now = new Date();
      return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    }
  }, [tz]);
  const weekStart = new Date(todayStart.getTime() - 6 * 24 * 60 * 60 * 1000);

  const totalEarnings = filtered.reduce((s, i) => s + (i.earnings || 0), 0);
  const completedItems = filtered.filter(
    (i) => i.status === "delivered" || i.status === "completed"
  );
  const cancelledItems = filtered.filter((i) => i.status === "cancelled");

  const PERIOD_TABS: { key: FilterPeriod; label: string }[] = [
    { key: "today", label: T("today") },
    { key: "week", label: T("thisWeek") },
    { key: "all", label: T("all") },
  ];
  type KindTab = { key: FilterKind; label: string; icon: React.ReactElement };
  const KIND_TABS: KindTab[] = [
    { key: "all", label: T("all"), icon: <ClipboardList size={12} /> },
    { key: "order", label: T("orders"), icon: <ShoppingCart size={12} /> },
    { key: "ride", label: T("rides"), icon: <Bike size={12} /> },
    { key: "parcel", label: T("navParcels"), icon: <Package size={12} /> },
  ];

  function ItemIcon({ kind, type }: { kind: string; type: string }) {
    if (kind === "ride") {
      return type === "bike" ? (
        <Bike size={20} className="text-success" />
      ) : (
        <Car size={20} className="text-success" />
      );
    }
    if (type === "food") return <UtensilsCrossed size={20} className="text-blue-400" />;
    if (type === "mart") return <ShoppingCart size={20} className="text-blue-400" />;
    return <Package size={20} className="text-blue-400" />;
  }

  const handlePullRefresh = useCallback(async () => {
    await qc.invalidateQueries({ queryKey: ["rider-history", kind, period] });
  }, [qc, kind, period]);

  const totalLoaded = filtered.length;

  return (
    <PullToRefresh onRefresh={handlePullRefresh} className="min-h-screen bg-page-bg">
      <div
        className="relative overflow-hidden rounded-b-[2rem] page-header-gradient bg-card px-5 pb-8"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 3.5rem)" }}
      >
        <div className="absolute -top-20 -right-20 h-72 w-72 rounded-full bg-success/[0.04]" />
        <div className="absolute bottom-10 -left-16 h-56 w-56 rounded-full bg-muted/20" />
        <div className="relative mx-auto max-w-2xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="mb-1 text-xs font-semibold tracking-widest text-muted-foreground uppercase">
                <Calendar size={11} className="mr-1 inline" /> {totalLoaded} {T("totalRecords")}
              </p>
              <h1 className="text-2xl font-extrabold tracking-tight text-foreground">{T("history")}</h1>
              {showingCachedData && (
                <div className="mt-1.5 flex items-center gap-1.5 rounded-full bg-warning/20 border border-amber-400/30 px-2.5 py-1 w-fit">
                  <WifiOff size={10} className="text-warning" />
                  <span className="text-xs font-semibold text-warning">{T("showingLastSavedData")}</span>
                </div>
              )}
            </div>
            <button
              onClick={() => {
                void refetch();
              }}
              disabled={isFetching}
              aria-label={T("refresh")}
              className="flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-muted/30 transition-opacity active:bg-muted/50 disabled:opacity-50"
            >
              <RefreshCw
                size={16}
                className={`text-muted-foreground ${isFetching ? "animate-spin" : ""}`}
              />
            </button>
          </div>

          {!isLoading && (
            <div className="mt-5 grid grid-cols-3 gap-3">
              <div className="rounded-2xl border border-border/50 bg-muted/20 p-3 text-center backdrop-blur-sm">
                <p className="text-lg font-extrabold text-foreground">{formatCurrency(totalEarnings)}</p>
                <p className="mt-0.5 text-[9px] font-semibold tracking-wider text-muted-foreground uppercase">
                  {T("earnings")}
                </p>
              </div>
              <div className="rounded-2xl border border-border/50 bg-muted/20 p-3 text-center backdrop-blur-sm">
                <p className="text-lg font-extrabold text-foreground">{completedItems.length}</p>
                <p className="mt-0.5 text-[9px] font-semibold tracking-wider text-muted-foreground uppercase">
                  {T("completed")}
                </p>
              </div>
              <div className="rounded-2xl border border-border/50 bg-muted/20 p-3 text-center backdrop-blur-sm">
                <p className="text-lg font-extrabold text-error">{cancelledItems.length}</p>
                <p className="mt-0.5 text-[9px] font-semibold tracking-wider text-muted-foreground uppercase">
                  {T("cancelled")}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="sticky top-0 z-10 bg-page-bg pt-4 pb-2">
        <div className="mx-auto max-w-2xl space-y-3 px-4">
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
        <div className="flex gap-2 overflow-x-auto pb-0.5">
          {KIND_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setKind(tab.key)}
              className={`flex flex-shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-bold transition-all ${kind === tab.key ? "bg-brand text-black shadow-sm" : "border border-border bg-card text-muted-foreground"}`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>
        <p className="px-1 text-xs text-muted-foreground">
          {T("tapToViewReceipt")}
        </p>
        </div>
      </div>

      <div className="mx-auto w-full max-w-2xl space-y-3 px-4 py-3">
        {isLoading ? (
          <SkeletonHistory />
        ) : isError ? (
          <ErrorState
            title={T("somethingWentWrong")}
            subtitle={T("noRecordsFound")}
            onRetry={() => refetch()}
            retryLabel={T("retry")}
          />
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-3xl bg-muted">
              <ClipboardList size={32} className="text-muted-foreground" />
            </div>
            <p className="text-base font-bold text-muted-foreground">{T("noRecordsFound")}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {period !== "all" ? T("widerTimePeriod") : T("deliveriesAppearHere")}
            </p>
          </div>
        ) : (
          (() => {
            const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);
            const getGroup = (d: Date) => {
              if (d >= todayStart) return T("today");
              if (d >= yesterdayStart) return T("yesterday");
              if (d >= weekStart) return T("thisWeek");
              return T("earlier");
            };
            let lastGroup = "";
            return filtered.map((item: HistoryItem) => {
              const d = new Date(item.createdAt);
              const group = getGroup(d);
              const showHeader = group !== lastGroup;
              lastGroup = group;
              const completed = item.status === "delivered" || item.status === "completed";
              const cancelled = item.status === "cancelled";
              return (
                <div key={item.id}>
                  {showHeader && (
                    <div className="flex items-center gap-2 pt-2 pb-1">
                      <Calendar size={12} className="text-muted-foreground" />
                      <p className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
                        {group}
                      </p>
                      <div className="h-px flex-1 bg-border" />
                    </div>
                  )}
                  <div
                    className="cursor-pointer overflow-hidden rounded-3xl border border-border bg-card shadow-sm transition-colors active:bg-muted/30"
                    onClick={() => setSelectedReceipt(item)}
                  >
                    <div className="flex items-center gap-3.5 p-4">
                      <div
                        className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl ${item.kind === "ride" ? "bg-success/10" : "bg-blue-500/10"}`}
                      >
                        <ItemIcon kind={item.kind} type={item.type} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[15px] font-bold text-foreground capitalize">
                          {item.kind === "ride"
                            ? `${item.type} ${T("ride")}`
                            : `${item.type} ${T("deliveryLabel")}`}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {item.origin || item.address || "—"}
                        </p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {formatDate(item.createdAt, tz)}
                        </p>
                      </div>
                      <div className="flex-shrink-0 text-right">
                        {completed ? (
                          <p className="text-[15px] font-extrabold text-success">
                            +{formatCurrency(item.earnings || 0)}
                          </p>
                        ) : (
                          <p className="font-bold text-muted-foreground">
                            {formatCurrency(item.amount || 0)}
                          </p>
                        )}
                        <span
                          className={`mt-1 inline-block rounded-full px-2.5 py-0.5 text-xs font-bold ${
                            completed
                              ? "bg-success/15 text-success"
                              : cancelled
                                ? "bg-error/15 text-error"
                                : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {item.status.replace(/_/g, " ").toUpperCase()}
                        </span>
                      </div>
                    </div>
                    {completed && item.earnings > 0 && (
                      <div className="px-4 pb-3">
                        <div className="flex items-center justify-between rounded-xl border border-success/20 bg-success/10 px-3.5 py-2">
                          <span className="flex items-center gap-1.5 text-xs font-medium text-success">
                            <CreditCard size={12} /> {T("earningsCredited")}
                          </span>
                          <span className="text-xs font-extrabold text-success">
                            {formatCurrency(item.earnings)}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            });
          })()
        )}

        {/* Show more button — fetches the next page from the server */}
        {!isLoading && hasNextPage && (
          <button
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
            className="w-full rounded-2xl border border-border bg-card py-3 text-sm font-bold text-muted-foreground shadow-sm transition-colors active:bg-muted/30 disabled:opacity-60"
          >
            {isFetchingNextPage ? (
              <span className="flex items-center justify-center gap-2">
                <RefreshCw size={14} className="animate-spin" /> {T("loading")}
              </span>
            ) : (
              T("showMore")
            )}
          </button>
        )}
      </div>

      {selectedReceipt && (
        <RideReceiptSheet
          item={selectedReceipt}
          tz={tz}
          onClose={() => setSelectedReceipt(null)}
        />
      )}
    </PullToRefresh>
  );
}
