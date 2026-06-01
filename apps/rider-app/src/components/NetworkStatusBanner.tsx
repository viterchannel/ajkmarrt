import { useNetworkQuality } from "@/hooks/useNetworkQuality";
import { RIDER_TOKENS } from "@/lib/useThemeTokens";
import { useEffect, useRef, useState } from "react";

/**
 * NetworkStatusBanner — Global Network-Aware Status Strip
 *
 * Uses the existing useNetworkQuality hook (Navigator.connection API) to
 * surface real-time network status to the rider.
 *
 * Behaviours:
 *  • isOffline  → persistent gold/dark branded strip until back online
 *  • tier=slow  → amber strip, auto-dismisses after 5 s; re-triggers on
 *                 next slow-network event (e.g. ride accepted on 2G)
 *  • tier=medium/fast + online → renders nothing (zero DOM cost)
 *
 * Placement: fixed bottom snackbar (above BottomNav) — avoids all z-index
 * conflicts with existing top strips (isLimited z-50, toasts z-9999).
 *
 * Global Re-use: injected once at App.tsx root → covers every page/route
 * automatically, including VanDriver and authenticated flows.
 */

type ActiveBanner = "offline" | "slow" | null;

const SLOW_DISMISS_MS = 5_000;

export function NetworkStatusBanner() {
  const { tier, isOffline } = useNetworkQuality();
  const [activeBanner, setActiveBanner] = useState<ActiveBanner>(null);
  const [visible, setVisible] = useState(false);
  const slowTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function clearTimers() {
    if (slowTimerRef.current) clearTimeout(slowTimerRef.current);
    if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
  }

  function slideOut(onDone?: () => void) {
    setVisible(false);
    exitTimerRef.current = setTimeout(() => {
      setActiveBanner(null);
      onDone?.();
    }, 320);
  }

  useEffect(() => {
    clearTimers();

    if (isOffline) {
      setActiveBanner("offline");
      setVisible(true);
      return () => clearTimers();
    }

    if (activeBanner === "offline") {
      slideOut();
      return () => clearTimers();
    }

    if (tier === "slow") {
      setActiveBanner("slow");
      setVisible(true);
      slowTimerRef.current = setTimeout(() => {
        slideOut();
      }, SLOW_DISMISS_MS);
      return () => clearTimers();
    }

    if (activeBanner === "slow") {
      slideOut();
    }

    return () => clearTimers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tier, isOffline]);

  if (!activeBanner) return null;

  const isOfflineBanner = activeBanner === "offline";

  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      className="pointer-events-none fixed inset-x-0 z-[9000] mx-auto max-w-md px-3"
      style={{
        bottom: "calc(68px + env(safe-area-inset-bottom, 8px))",
        transition: "transform 0.3s cubic-bezier(0.32,0.72,0,1), opacity 0.3s ease",
        transform: visible ? "translateY(0)" : "translateY(calc(100% + 20px))",
        opacity: visible ? 1 : 0,
      }}
    >
      <div
        style={{
          borderRadius: 14,
          padding: "10px 14px",
          display: "flex",
          alignItems: "center",
          gap: 10,
          background: isOfflineBanner
            ? "linear-gradient(135deg,#130505,#1e0808)"
            : "linear-gradient(135deg,#130f00,#1e1700)",
          border: isOfflineBanner
            ? "1px solid rgba(239,68,68,0.35)"
            : `1px solid ${RIDER_TOKENS.brandAlpha(0.35)}`,
          boxShadow: isOfflineBanner
            ? "0 8px 24px rgba(0,0,0,0.55), 0 0 0 1px rgba(239,68,68,0.1)"
            : `0 8px 24px rgba(0,0,0,0.55), 0 0 0 1px ${RIDER_TOKENS.brandAlpha(0.1)}`,
        }}
      >
        {/* Left accent bar */}
        <div
          style={{
            width: 3,
            height: 28,
            borderRadius: 2,
            flexShrink: 0,
            background: isOfflineBanner ? "#ef4444" : "var(--color-brand)",
          }}
        />

        {/* Icon */}
        <span style={{ fontSize: 15, flexShrink: 0 }}>
          {isOfflineBanner ? "📵" : "📶"}
        </span>

        {/* Message */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p
            style={{
              margin: 0,
              fontSize: 12,
              fontWeight: 700,
              color: isOfflineBanner ? "#fca5a5" : "var(--color-brand)",
              lineHeight: 1.3,
            }}
          >
            {isOfflineBanner ? "No Internet" : "Slow Connection"}
          </p>
          <p
            style={{
              margin: 0,
              fontSize: 11,
              color: isOfflineBanner
                ? "rgba(252,165,165,0.7)"
                : RIDER_TOKENS.brandAlpha(0.7),
              lineHeight: 1.3,
              marginTop: 1,
            }}
          >
            {isOfflineBanner
              ? "Actions queued — will sync when you're back"
              : "Requests may take longer than usual"}
          </p>
        </div>

        {/* Animated status dot */}
        <div
          style={{
            width: 7,
            height: 7,
            borderRadius: "50%",
            flexShrink: 0,
            background: isOfflineBanner ? "#ef4444" : "var(--color-brand)",
            animation: "nsb-dot 1.4s ease-in-out infinite",
          }}
        />
      </div>

      <style>{`
        @keyframes nsb-dot {
          0%, 100% { opacity: 0.3; transform: scale(0.85); }
          50%       { opacity: 1;   transform: scale(1.15); }
        }
      `}</style>
    </div>
  );
}
