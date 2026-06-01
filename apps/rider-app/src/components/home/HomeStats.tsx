import { tDual, type Language } from "@workspace/i18n";
import { Clock, Package, Star, ThumbsUp, TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";
import { formatCurrency } from "../dashboard";

interface HomeStatsProps {
  todayEarned: number;
  todayRides: number;
  acceptanceRate: number | null;
  rating: number | null;
  onlineSince: number | null;
  isOnline: boolean;
  currency: string;
  language: Language;
  maxDeliveries?: number;
}

function formatOnlineTime(ms: number): string {
  const totalMin = Math.floor(ms / 60_000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

export function HomeStats({
  todayEarned,
  todayRides,
  acceptanceRate,
  rating,
  onlineSince,
  isOnline,
  currency,
  language,
  maxDeliveries,
}: HomeStatsProps) {
  const T = (key: Parameters<typeof tDual>[0]) => tDual(key, language);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!onlineSince) return;
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, [onlineSince]);

  const onlineMs = onlineSince ? Math.max(0, now - onlineSince) : 0;
  const onlineLabel = !isOnline ? "Offline" : onlineSince ? formatOnlineTime(onlineMs) : "—";

  const ratingColor =
    rating == null || rating === 0
      ? "text-white/30"
      : rating >= 4.5
        ? "text-success"
        : rating >= 3.5
          ? "text-warning"
          : "text-error";

  const acceptColor =
    acceptanceRate == null
      ? "text-white/30"
      : acceptanceRate >= 80
        ? "text-success"
        : acceptanceRate >= 60
          ? "text-warning"
          : "text-error";

  const stats = [
    {
      icon: <TrendingUp size={13} className="text-success" />,
      label: T("earnedToday"),
      value: formatCurrency(todayEarned, currency),
      valueClass: todayEarned > 0 ? "text-success" : "text-white",
      bg: todayEarned > 0 ? "bg-success/[0.08] border-success/15" : "bg-white/[0.04] border-white/[0.08]",
    },
    {
      icon: <Package size={13} className="text-indigo-400" />,
      label: T("ridesDone"),
      value: String(todayRides),
      valueClass: "text-white",
      bg: "bg-white/[0.04] border-white/[0.08]",
    },
    {
      icon: <ThumbsUp size={13} className={acceptanceRate != null ? acceptColor : "text-white/25"} />,
      label: "Accept.",
      value: acceptanceRate != null ? `${Math.round(acceptanceRate)}%` : "—",
      valueClass: acceptColor,
      bg: acceptanceRate != null && acceptanceRate >= 80
        ? "bg-success/[0.08] border-success/15"
        : "bg-white/[0.04] border-white/[0.08]",
    },
    {
      icon: <Star size={13} className={rating != null && rating > 0 ? "text-warning" : "text-white/25"} />,
      label: "Rating",
      value: rating != null && rating > 0 ? rating.toFixed(1) : "—",
      valueClass: ratingColor,
      bg: rating != null && rating >= 4.0
        ? "bg-warning/[0.08] border-warning/15"
        : "bg-white/[0.04] border-white/[0.08]",
    },
  ];

  return (
    <div className="space-y-2">
      {/* Section header */}
      <div className="flex items-center justify-between px-0.5">
        <p className="text-[10px] font-bold uppercase tracking-widest text-white/30">
          Today's Performance
        </p>
        <div className="flex items-center gap-1.5">
          <span
            className={`h-1.5 w-1.5 rounded-full ${isOnline ? "animate-pulse bg-success" : "bg-white/20"}`}
          />
          <p className="text-[10px] font-semibold text-white/30">
            {isOnline ? onlineLabel : "Offline"}
          </p>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-4 gap-2" role="list" aria-label="Rider statistics">
        {stats.map((s, i) => (
          <div
            key={s.label}
            className={`animate-[slideUp_0.3s_ease-out] rounded-2xl border ${s.bg} p-3 text-center backdrop-blur-sm`}
            style={{ animationDelay: `${i * 60}ms`, animationFillMode: "both" }}
            role="listitem"
          >
            <div className="mb-1.5 flex justify-center">
              <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-white/[0.06]">
                {s.icon}
              </div>
            </div>
            <p className={`text-xs font-extrabold leading-tight ${s.valueClass}`}>{s.value}</p>
            <p className="mt-0.5 text-[9px] font-semibold uppercase tracking-wider text-white/25">
              {s.label}
            </p>
          </div>
        ))}
      </div>

      {/* Online time + max deliveries strip */}
      <div className="flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.04] px-3 py-2.5 backdrop-blur-sm">
        <Clock
          size={12}
          className={`flex-shrink-0 ${isOnline ? "text-brand" : "text-white/25"}`}
        />
        <div className="flex flex-1 items-center justify-between gap-2">
          <p className="text-xs font-medium text-white/50">
            Session time
          </p>
          <p className={`text-xs font-extrabold ${isOnline ? "text-brand" : "text-white/25"}`}>
            {onlineLabel}
          </p>
        </div>
        {maxDeliveries != null && (
          <>
            <div className="h-3 w-px bg-white/10" />
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium text-white/50">Max trips</p>
              <p className="text-xs font-extrabold text-white">{maxDeliveries}</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
