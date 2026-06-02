import { tDual, type Language } from "@workspace/i18n";
import { Package, TrendingUp, Zap } from "lucide-react";
import { formatCurrency } from "../dashboard";

interface HomeStatsProps {
  todayEarned: number;
  todayRides: number;
  acceptanceRate: number | null;
  rating: number | null;
  onlineSince: number | null;
  currency: string;
  language: string;
  isOnline: boolean;
  maxDeliveries?: number;
  activeOrderCount?: number;
}

export function HomeStats({
  todayEarned,
  todayRides,
  acceptanceRate,
  rating,
  currency,
  language,
  isOnline,
  maxDeliveries,
  activeOrderCount = 0,
}: HomeStatsProps) {
  const T = (key: Parameters<typeof tDual>[0]) => tDual(key, language as Language);

  const hasRides = todayRides > 0;

  const ratingColor =
    !hasRides || rating == null || rating === 0
      ? "text-muted-foreground"
      : rating >= 4.5
        ? "text-success"
        : rating >= 3.5
          ? "text-warning"
          : "text-error";

  const acceptColor =
    !hasRides || acceptanceRate == null
      ? "text-muted-foreground"
      : acceptanceRate >= 80
        ? "text-success"
        : acceptanceRate >= 60
          ? "text-warning"
          : "text-error";

  return (
    <div className="space-y-2">
      {/* Section header */}
      <div className="flex items-center justify-between px-0.5">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          Today's Performance
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-2" role="list" aria-label="Rider statistics">
        {/* Earnings card */}
        <div
          className={`animate-[slideUp_0.3s_ease-out] rounded-2xl border p-3 text-center backdrop-blur-sm ${
            todayEarned > 0 ? "bg-success/[0.08] border-success/15" : "bg-muted/10 border-border/80"
          }`}
          style={{ animationDelay: "0ms", animationFillMode: "both" }}
          role="listitem"
        >
          <div className="mb-1.5 flex justify-center">
            <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-muted/20">
              <TrendingUp size={13} className="text-success" />
            </div>
          </div>
          <p className={`text-xs font-extrabold leading-tight ${todayEarned > 0 ? "text-success" : "text-foreground"}`}>
            {formatCurrency(todayEarned, currency)}
          </p>
          <p className="mt-0.5 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
            {T("earnedToday")}
          </p>
        </div>

        {/* Rides done card */}
        <div
          className="animate-[slideUp_0.3s_ease-out] rounded-2xl border bg-muted/10 border-border/80 p-3 text-center backdrop-blur-sm"
          style={{ animationDelay: "60ms", animationFillMode: "both" }}
          role="listitem"
        >
          <div className="mb-1.5 flex justify-center">
            <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-muted/20">
              <Package size={13} className="text-indigo-400" />
            </div>
          </div>
          <p className="text-xs font-extrabold leading-tight text-foreground">{todayRides}</p>
          <p className="mt-0.5 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
            {T("ridesDone")}
          </p>
        </div>

        {/* When no rides: merged empty-state card for acceptance + rating */}
        {!hasRides ? (
          <div
            className="col-span-2 animate-[slideUp_0.3s_ease-out] rounded-2xl border border-border/60 bg-muted/5 p-3 text-center backdrop-blur-sm"
            style={{ animationDelay: "120ms", animationFillMode: "both" }}
            role="listitem"
          >
            <p className="text-[10px] font-semibold text-muted-foreground">
              Acceptance rate &amp; rating will appear after your first ride today
            </p>
          </div>
        ) : (
          <>
            {/* Acceptance rate */}
            <div
              className="animate-[slideUp_0.3s_ease-out] rounded-2xl border bg-muted/10 border-border/80 p-3 text-center backdrop-blur-sm"
              style={{ animationDelay: "120ms", animationFillMode: "both" }}
              role="listitem"
            >
              <div className="mb-1.5 flex justify-center">
                <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-muted/20">
                  <span className={`text-[11px] font-black ${acceptColor}`}>%</span>
                </div>
              </div>
              <p className={`text-xs font-extrabold leading-tight ${acceptColor}`}>
                {acceptanceRate != null ? `${Math.round(acceptanceRate)}%` : "—"}
              </p>
              <p className="mt-0.5 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                Accept.
              </p>
            </div>

            {/* Rating */}
            <div
              className="animate-[slideUp_0.3s_ease-out] rounded-2xl border bg-muted/10 border-border/80 p-3 text-center backdrop-blur-sm"
              style={{ animationDelay: "180ms", animationFillMode: "both" }}
              role="listitem"
            >
              <div className="mb-1.5 flex justify-center">
                <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-muted/20">
                  <span className={`text-[11px] font-black ${ratingColor}`}>★</span>
                </div>
              </div>
              <p className={`text-xs font-extrabold leading-tight ${ratingColor}`}>
                {rating != null && rating > 0 ? rating.toFixed(1) : "—"}
              </p>
              <p className="mt-0.5 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                Rating
              </p>
            </div>
          </>
        )}
      </div>

      {/* Active orders visible only when rider is online */}
      {isOnline && maxDeliveries != null && (
        <div className={`flex items-center gap-2.5 rounded-2xl border p-3 backdrop-blur-sm ${
          activeOrderCount >= maxDeliveries
            ? "border-warning/20 bg-warning/[0.05]"
            : "border-border/60 bg-muted/5"
        }`}>
          <Zap size={14} className={`flex-shrink-0 ${activeOrderCount >= maxDeliveries ? "text-warning" : "text-muted-foreground"}`} />
          <p className="flex-1 text-xs font-medium text-muted-foreground">Active orders</p>
          <p className={`text-xs font-extrabold ${activeOrderCount >= maxDeliveries ? "text-warning" : "text-muted-foreground"}`}>
            {activeOrderCount} / {maxDeliveries}
          </p>
        </div>
      )}
    </div>
  );
}
