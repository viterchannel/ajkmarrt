import { memo, useEffect, useRef, useState } from "react";
import { ACCEPT_TIMEOUT_SEC } from "./helpers";

export const AcceptCountdown = memo(function AcceptCountdown({
  createdAt,
  serverTime,
  onExpired,
  timeoutSec,
}: {
  createdAt: string;
  serverTime?: string | null;
  onExpired?: () => void;
  timeoutSec?: number;
}) {
  const timeout = timeoutSec ?? ACCEPT_TIMEOUT_SEC;

  const clockOffset = useRef<number>(
    serverTime && !Number.isNaN(new Date(serverTime).getTime())
      ? new Date(serverTime).getTime() - Date.now()
      : 0,
  );

  useEffect(() => {
    if (serverTime && !Number.isNaN(new Date(serverTime).getTime())) {
      clockOffset.current = new Date(serverTime).getTime() - Date.now();
    }
  }, [serverTime]);

  const calcRemaining = () => {
    const createdMs = new Date(createdAt).getTime();
    if (!Number.isFinite(createdMs)) return 0;
    const adjustedNow = Date.now() + clockOffset.current;
    const elapsed = Math.floor((adjustedNow - createdMs) / 1000);
    return Math.max(0, timeout - elapsed);
  };

  const [secs, setSecs] = useState(() => calcRemaining());
  const expiredRef = useRef(false);

  useEffect(() => {
    expiredRef.current = false;
    setSecs(calcRemaining());
    const id = setInterval(() => {
      const remaining = calcRemaining();
      setSecs(remaining);
      if (remaining === 0 && !expiredRef.current) {
        expiredRef.current = true;
        onExpired?.();
      }
    }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [createdAt, onExpired, timeout]);

  const pct = secs / timeout;
  /* Bigger ring: 44×44 so riders can read it at a glance */
  const size = 44;
  const r = 18;
  const stroke = 3.5;
  const circ = 2 * Math.PI * r;
  const dashOffset = circ * (1 - pct);
  const col = secs > 30 ? "#22c55e" : secs > 10 ? "#f59e0b" : "#ef4444";

  return (
    <div
      className="relative flex flex-shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
      role="timer"
      aria-label={`${secs} seconds remaining`}
    >
      <svg width={size} height={size} className={secs <= 10 ? "animate-pulse" : ""}>
        {/* Track ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          className="text-border/60"
        />
        {/* Progress ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={col}
          strokeWidth={stroke}
          strokeDasharray={circ}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: "stroke-dashoffset 1s linear, stroke 0.3s" }}
        />
      </svg>
      <span
        className="absolute text-[11px] font-extrabold tabular-nums leading-none"
        style={{ color: col }}
      >
        {secs}
      </span>
    </div>
  );
});
