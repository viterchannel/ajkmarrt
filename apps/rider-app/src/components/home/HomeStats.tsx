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
  const onlineLabel = !isOnline
    ? "Offline"
    : onlineSince
      ? formatOnlineTime(onlineMs)
      : "—";

  const ratingColor =
    rating == null || rating === 0
      ? "text-white/40"
      : rating >= 4.5
        ? "text-success"
        : rating >= 3.5
          ? "text-warning"
          : "text-error";

  const acceptColor =
    acceptanceRate == null
      ? "text-white/40"
      : acceptanceRate >= 80
        ? "text-success"
        : acceptanceRate >= 60
          ? "text-warning"
          : "text-error";

  const stats = [
    {
      icon: <TrendingUp size={14} className="text-success" />,
      label: T("earnedToday"),
      value: formatCurrency(todayEarned, currency),
      valueClass: todayEarned > 0 ? "text-success" : "text-white",
      bg: "bg-success/10",
    },
    {
      icon: <Package size={14} className="text-indigo-300" />,
      label: T("ridesDone"),
      value: String(todayRides),
      valueClass: "text-white",
      bg: "bg-indigo-500/10",
    },
    {
      icon: <ThumbsUp size={14} className={acceptanceRate != null ? "text-success" : "text-white/30"} />,
      label: "Acceptance",
      value: acceptanceRate != null ? `${Math.round(acceptanceRate)}%` : "—",
      valueClass: acceptColor,
      bg: acceptanceRate != null ? "bg-success/10" : "bg-white/5",
    },
    {
      icon: <Star size={14} className={rating != null && rating > 0 ? "text-warning" : "text-white/30"} />,
      label: "Rating",
      value: rating != null && rating > 0 ? rating.toFixed(1) : "—",
      valueClass: ratingColor,
      bg: rating != null && rating > 0 ? "bg-warning/10" : "bg-white/5",
    },
  ];

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-4 gap-2" role="list" aria-label="Rider statistics">
        {stats.map((s, i) => (
          <div
            key={s.label}
            className={`animate-[slideUp_0.3s_ease-out] rounded-2xl border border-white/8 ${s.bg} p-2.5 text-center backdrop-blur-sm`}
            style={{ animationDelay: `${i * 60}ms`, animationFillMode: "both" }}
            role="listitem"
          >
            <div className="mb-1.5 flex justify-center">
              <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-white/5">
                {s.icon}
              </div>
            </div>
            <p className={`text-[12px] leading-tight font-extrabold ${s.valueClass}`}>
              {s.value}
            </p>
            <p className="mt-0.5 text-[9px] font-semibold tracking-wider text-white/30 uppercase">
              {s.label}
            </p>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 rounded-2xl border border-white/8 bg-white/5 px-3 py-2 backdrop-blur-sm">
        <Clock size={13} className={`flex-shrink-0 ${isOnline ? "text-brand" : "text-white/30"}`} />
        <p className="text-[11px] font-semibold text-white/60">
          Online Time:{" "}
          <span className={`font-extrabold ${isOnline ? "text-brand" : "text-white/30"}`}>{onlineLabel}</span>
          {maxDeliveries != null && (
            <span className="ml-2 text-white/30">
              · Max deliveries: <span className="font-extrabold text-white">{maxDeliveries}</span>
            </span>
          )}
        </p>
      </div>
    </div>
  );
}
