import { useEffect, useState } from "react";

interface StatusCardProps {
  isOnline: boolean;
  onlineSince: number | null;
  activeOrderCount: number;
  maxDeliveries: number;
  toggling: boolean;
  onToggleOnline: () => void;
}

function formatOnlineTime(ms: number): string {
  const totalMin = Math.floor(ms / 60_000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (totalMin < 1) return "just now";
  if (h === 0) return `${m} min`;
  return `${h}h ${m}m`;
}

export function StatusCard({
  isOnline,
  onlineSince,
  activeOrderCount,
  maxDeliveries,
  toggling,
  onToggleOnline,
}: StatusCardProps) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!isOnline || !onlineSince) return;
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, [isOnline, onlineSince]);

  const onlineMs = onlineSince ? Math.max(0, now - onlineSince) : 0;
  const onlineLabel = onlineSince ? formatOnlineTime(onlineMs) : "—";

  if (isOnline) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-success/20 bg-success/[0.05] px-4 py-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="h-2 w-2 flex-shrink-0 rounded-full animate-pulse bg-success shadow-lg shadow-green-400/50" />
            <p className="text-xs font-bold text-success">
              Online {onlineSince ? `since ${onlineLabel}` : "now"}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <span
              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold ${
                activeOrderCount >= maxDeliveries
                  ? "border-warning/20 bg-warning/10 text-warning"
                  : "border-success/20 bg-success/10 text-success"
              }`}
            >
              Active: {activeOrderCount}/{maxDeliveries}
            </span>
            {activeOrderCount >= maxDeliveries && (
              <span className="text-[10px] text-warning/70">Limit reached</span>
            )}
          </div>
        </div>
        <button
          onClick={onToggleOnline}
          disabled={toggling}
          className="flex-shrink-0 rounded-xl border border-white/20 bg-white/5 px-4 py-2 text-xs font-bold text-white/60 transition-all disabled:opacity-50 active:scale-[0.97]"
          aria-label="Go offline"
        >
          Go Offline
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 py-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 flex-shrink-0 rounded-full bg-white/20" />
          <p className="text-xs font-bold text-white/40">⭕ You are Offline</p>
        </div>
        <p className="mt-0.5 text-[10px] text-white/25">
          Go online to start receiving orders
        </p>
      </div>
      <button
        onClick={onToggleOnline}
        disabled={toggling}
        className="flex-shrink-0 rounded-xl bg-brand px-4 py-2 text-xs font-black text-black transition-all disabled:opacity-50 active:scale-[0.97]"
        aria-label="Go online"
      >
        Go Online
      </button>
    </div>
  );
}
