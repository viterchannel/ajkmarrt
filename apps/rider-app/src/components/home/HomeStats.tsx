import { tDual, type Language } from "@workspace/i18n";
import { Package, Star, TrendingUp, Zap } from "lucide-react";
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
      : rating >= 4.5 ? "text-yellow-400"
      : rating >= 3.5 ? "text-warning"
      : "text-error";

  const acceptColor =
    !hasRides || acceptanceRate == null
      ? "text-muted-foreground"
      : acceptanceRate >= 80 ? "text-success"
      : acceptanceRate >= 60 ? "text-warning"
      : "text-error";

  return (
    <div className="space-y-2.5">
      <p className="px-0.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        Today's Performance
      </p>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-2.5" role="list" aria-label="Rider statistics">
        {/* Earnings */}
        <div
          className={`animate-[slideUp_0.3s_ease-out] rounded-2xl border p-4 ${
            todayEarned > 0
              ? "border-success/20 bg-success/[0.07]"
              : "border-border/60 bg-card"
          }`}
          style={{ animationDelay: "0ms", animationFillMode: "both" }}
          role="listitem"
        >
          <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-success/10">
            <TrendingUp size={16} className="text-success" />
          </div>
          <p className={`text-lg font-black leading-none ${todayEarned > 0 ? "text-success" : "text-foreground"}`}>
            {formatCurrency(todayEarned, currency)}
          </p>
          <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {T("earnedToday")}
          </p>
        </div>

        {/* Rides done */}
        <div
          className="animate-[slideUp_0.3s_ease-out] rounded-2xl border border-border/60 bg-card p-4"
          style={{ animationDelay: "60ms", animationFillMode: "both" }}
          role="listitem"
        >
          <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/10">
            <Package size={16} className="text-indigo-400" />
          </div>
          <p className="text-lg font-black leading-none text-foreground">{todayRides}</p>
          <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {T("ridesDone")}
          </p>
        </div>

        {/* No rides yet: merged placeholder */}
        {!hasRides ? (
          <div
            className="col-span-2 animate-[slideUp_0.3s_ease-out] rounded-2xl border border-border/40 bg-muted/5 px-4 py-3 text-center"
            style={{ animationDelay: "120ms", animationFillMode: "both" }}
            role="listitem"
          >
            <p className="text-[11px] font-medium text-muted-foreground">
              Acceptance rate &amp; rating will appear after your first ride today
            </p>
          </div>
        ) : (
          <>
            {/* Acceptance rate */}
            <div
              className="animate-[slideUp_0.3s_ease-out] rounded-2xl border border-border/60 bg-card p-4"
              style={{ animationDelay: "120ms", animationFillMode: "both" }}
              role="listitem"
            >
              <div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-xl ${
                acceptanceRate != null && acceptanceRate >= 80 ? "bg-success/10" : "bg-muted/20"
              }`}>
                <span className={`text-sm font-black ${acceptColor}`}>%</span>
              </div>
              <p className={`text-lg font-black leading-none ${acceptColor}`}>
                {acceptanceRate != null ? `${Math.round(acceptanceRate)}%` : "—"}
              </p>
              <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Acceptance
              </p>
            </div>

            {/* Rating */}
            <div
              className="animate-[slideUp_0.3s_ease-out] rounded-2xl border border-border/60 bg-card p-4"
              style={{ animationDelay: "180ms", animationFillMode: "both" }}
              role="listitem"
            >
              <div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-xl ${
                rating != null && rating >= 4.5 ? "bg-yellow-400/10" : "bg-muted/20"
              }`}>
                <Star size={15} className={ratingColor} />
              </div>
              <p className={`text-lg font-black leading-none ${ratingColor}`}>
                {rating != null && rating > 0 ? rating.toFixed(1) : "—"}
              </p>
              <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Rating
              </p>
            </div>
          </>
        )}
      </div>

      {/* Active orders capacity — only when online */}
      {isOnline && maxDeliveries != null && (
        <div className={`flex items-center gap-3 rounded-2xl border p-3.5 ${
          activeOrderCount >= maxDeliveries
            ? "border-warning/25 bg-warning/[0.07]"
            : "border-border/50 bg-muted/5"
        }`}>
          <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl ${
            activeOrderCount >= maxDeliveries ? "bg-warning/15" : "bg-muted/20"
          }`}>
            <Zap size={14} className={activeOrderCount >= maxDeliveries ? "text-warning" : "text-muted-foreground"} />
          </div>
          <p className="flex-1 text-xs font-medium text-muted-foreground">Active orders</p>
          <div className="flex items-center gap-1">
            <span className={`text-sm font-extrabold ${activeOrderCount >= maxDeliveries ? "text-warning" : "text-foreground"}`}>
              {activeOrderCount}
            </span>
            <span className="text-xs text-muted-foreground">/ {maxDeliveries}</span>
          </div>
        </div>
      )}
    </div>
  );
}
