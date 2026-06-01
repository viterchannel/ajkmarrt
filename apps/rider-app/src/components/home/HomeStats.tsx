import { tDual, type Language } from "@workspace/i18n";
import { Package, Star, ThumbsUp, TrendingUp, Zap } from "lucide-react";
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
  language: string;
  maxDeliveries?: number;
}

function formatOnlineTime(ms: number): string {
  const totalMin = Math.floor(ms / 60_000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (totalMin < 1) return "just now";
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
  const T = (key: Parameters<typeof tDual>[0]) => tDual(key, language as Language);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!onlineSince) return;
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, [onlineSince]);

  const onlineMs = onlineSince ? Math.max(0, now - onlineSince) : 0;
  const onlineLabel = onlineSince ? formatOnlineTime(onlineMs) : "—";

  const hasRides = todayRides > 0;

  const ratingColor =
    !hasRides || rating == null || rating === 0
      ? "text-white/25"
      : rating >= 4.5
        ? "text-success"
        : rating >= 3.5
          ? "text-warning"
          : "text-error";

  const acceptColor =
    !hasRides || acceptanceRate == null
      ? "text-white/25"
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
      icon: <ThumbsUp size={13} className={hasRides && acceptanceRate != null ? acceptColor : "text-white/20"} />,
      label: hasRides ? "Accept." : "No rides",
      value: hasRides && acceptanceRate != null ? `${Math.round(acceptanceRate)}%` : "—",
      valueClass: hasRides ? acceptColor : "text-white/20",
      bg: "bg-white/[0.04] border-white/[0.08]",
    },
    {
      icon: <Star size={13} className={hasRides && rating != null && rating > 0 ? "text-warning" : "text-white/20"} />,
      label: hasRides ? "Rating" : "yet",
      value: hasRides && rating != null && rating > 0 ? rating.toFixed(1) : "—",
      valueClass: hasRides ? ratingColor : "text-white/20",
      bg: "bg-white/[0.04] border-white/[0.08]",
    },
  ];

  return (
    <div className="space-y-2">
      {/* Section header */}
      <div className="flex items-center justify-between px-0.5">
        <p className="text-[10px] font-bold uppercase tracking-widest text-white/30">
          Today's Performance
        </p>
        {isOnline && onlineSince && (
          <div className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full animate-pulse bg-success" />
            <p className="text-[10px] font-semibold text-white/40">
              Online {onlineLabel}
            </p>
          </div>
        )}
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

      {/* Active limit strip — only visible when online */}
      {isOnline && maxDeliveries != null && (
        <div className="flex items-center gap-2.5 rounded-2xl border border-success/15 bg-success/[0.05] px-3 py-2.5 backdrop-blur-sm">
          <Zap size={12} className="flex-shrink-0 text-success" />
          <p className="flex-1 text-xs font-medium text-white/50">Active order limit</p>
          <p className="text-xs font-extrabold text-success">{maxDeliveries} max</p>
        </div>
      )}
    </div>
  );
}
