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

  /* Clock offset: serverTime - Date.now() at the moment of last fetch.
     Positive means the server clock is ahead of the device clock.
     Same sign convention as the isExpired guard in OrderRequestCard /
     RideRequestCard so the visual timer and the disabled-button state
     stay in sync even when the device clock drifts by ±30 s or more. */
  const clockOffset = useRef<number>(
    serverTime && !Number.isNaN(new Date(serverTime).getTime())
      ? new Date(serverTime).getTime() - Date.now()
      : 0,
  );

  /* Recompute offset if serverTime changes (e.g. on refetch) */
  useEffect(() => {
    if (serverTime && !Number.isNaN(new Date(serverTime).getTime())) {
      clockOffset.current = new Date(serverTime).getTime() - Date.now();
    }
  }, [serverTime]);

  const calcRemaining = () => {
    const createdMs = new Date(createdAt).getTime();
    /* If createdAt is malformed (e.g. null, empty string), treat the request
       as expired immediately so the rider isn't shown a stuck "NaN" timer
       that never reaches zero and hides the true expiry state.             */
    if (!Number.isFinite(createdMs)) return 0;
    /* Date.now() + clockOffset ≈ current server time — matches the formula
       used by the card's isExpired guard so both agree on when time is up. */
    const adjustedNow = Date.now() + clockOffset.current;
    const elapsed = Math.floor((adjustedNow - createdMs) / 1000);
    return Math.max(0, timeout - elapsed);
  };

  /* Initialize with offset already applied — no transient mismatch on first render */
  const [secs, setSecs] = useState(() => calcRemaining());
  const expiredRef = useRef(false);

  useEffect(() => {
    expiredRef.current = false;
    /* Recalculate immediately so the display corrects before the first tick */
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
  const r = 14,
    stroke = 3;
  const circ = 2 * Math.PI * r;
  const dashOffset = circ * (1 - pct);
  const col = secs > 30 ? "#22c55e" : secs > 10 ? "#f59e0b" : "#ef4444";

  return (
    <div
      className="relative flex flex-shrink-0 items-center justify-center"
      style={{ width: 36, height: 36 }}
      role="timer"
      aria-label={`${secs} seconds remaining`}
    >
      <svg width={36} height={36} className={secs <= 10 ? "animate-pulse" : ""}>
        <circle cx={18} cy={18} r={r} fill="none" stroke="#e5e7eb" strokeWidth={stroke} />
        <circle
          cx={18}
          cy={18}
          r={r}
          fill="none"
          stroke={col}
          strokeWidth={stroke}
          strokeDasharray={circ}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          transform="rotate(-90 18 18)"
          style={{ transition: "stroke-dashoffset 1s linear, stroke 0.3s" }}
        />
      </svg>
      <span className="absolute text-[9px] font-extrabold tabular-nums" style={{ color: col }}>
        {secs}
      </span>
    </div>
  );
});
