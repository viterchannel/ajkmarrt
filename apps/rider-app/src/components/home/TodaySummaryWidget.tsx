import { tDual, type Language } from "@workspace/i18n";
import { Clock, Package, TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";
import { formatCurrency } from "../dashboard";

interface TodaySummaryWidgetProps {
  todayEarned: number;
  todayRides: number;
  onlineSince: number | null;
  isOnline: boolean;
  currency: string;
  language: Language;
}

function formatOnlineTime(ms: number): string {
  const totalMin = Math.floor(ms / 60_000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

export function TodaySummaryWidget({
  todayEarned,
  todayRides,
  onlineSince,
  isOnline,
  currency,
  language,
}: TodaySummaryWidgetProps) {
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
      icon: <Clock size={14} className={isOnline ? "text-brand" : "text-white/30"} />,
      label: T("onlineTime"),
      value: onlineLabel,
      valueClass: isOnline ? "text-brand" : "text-white/30",
      bg: isOnline ? "bg-brand/10" : "bg-white/5",
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-2">
      {stats.map((s, i) => (
        <div
          key={s.label}
          className={`animate-[slideUp_0.35s_ease-out] rounded-2xl border border-white/8 ${s.bg} p-3 text-center`}
          style={{ animationDelay: `${i * 50}ms`, animationFillMode: "both" }}
        >
          <div className="mb-1.5 flex justify-center">
            <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-white/5">
              {s.icon}
            </div>
          </div>
          <p className={`truncate text-[12px] leading-tight font-extrabold ${s.valueClass}`}>
            {s.value}
          </p>
          <p className="mt-0.5 text-[9px] font-semibold tracking-wider text-white/30 uppercase">
            {s.label}
          </p>
        </div>
      ))}
    </div>
  );
}
