import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

/**
 * Global Branded Shimmer System — Rider App
 *
 * Single source of truth for all loading skeleton states.
 * Dark-mode aware: uses `.shimmer-block` (light/dark auto) or
 * `.shimmer-block-on-dark` (always dark — for use inside dark headers).
 *
 * Re-use map:
 *  ShimmerBlock       → SkeletonHome, SkeletonProfile, SkeletonNotifications,
 *                        SkeletonHistory, SkeletonEarnings, SkeletonWallet
 *  ShimmerRow         → History, Notifications, Wallet transactions
 *  ShimmerHeader      → Home, Notifications, Profile (dark gradient header)
 *  PageShimmer        → App.tsx Suspense fallback, API-health loading gate
 */

export function ShimmerBlock({
  className,
  variant = "auto",
}: {
  className?: string;
  variant?: "auto" | "on-dark";
}) {
  return (
    <div
      className={cn(
        "rounded-xl",
        variant === "on-dark" ? "shimmer-block-on-dark" : "shimmer-block",
        className
      )}
    />
  );
}

export function ShimmerRow() {
  return (
    <div className="flex items-center gap-3 rounded-3xl border border-border dark:border-border/60 bg-card dark:bg-card p-4">
      <ShimmerBlock className="h-10 w-10 flex-shrink-0 rounded-2xl" />
      <div className="flex-1 space-y-2">
        <ShimmerBlock className="h-3.5 w-32" />
        <ShimmerBlock className="h-2.5 w-24" />
      </div>
      <div className="flex flex-col items-end space-y-1.5">
        <ShimmerBlock className="h-3.5 w-16" />
        <ShimmerBlock className="h-5 w-14 rounded-full" />
      </div>
    </div>
  );
}

export function ShimmerHeader({ children }: { children?: ReactNode }) {
  return (
    <div
      className="relative overflow-hidden rounded-b-[2rem] page-header-gradient bg-card px-5 pb-8"
      style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 3.5rem)" }}
    >
      <div className="absolute -top-20 -right-20 h-72 w-72 rounded-full bg-brand/[0.04]" />
      <div className="absolute bottom-10 -left-16 h-56 w-56 rounded-full bg-muted/20" />
      {children}
    </div>
  );
}

export function PageShimmer() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface">
      <div className="flex flex-col items-center gap-5">
        <div
          style={{
            width: 36,
            height: 36,
            border: "4px solid var(--color-border-dark)",
            borderTopColor: "var(--color-brand)",
            borderRadius: "50%",
            animation: "pgshimmer-spin 0.8s linear infinite",
          }}
        />
        <div style={{ display: "flex", gap: 6 }}>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{
                width: 24,
                height: 4,
                borderRadius: 2,
                background: "var(--color-brand)",
                animation: `pgshimmer-pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
              }}
            />
          ))}
        </div>
      </div>
      <style>{`
        @keyframes pgshimmer-spin { to { transform: rotate(360deg); } }
        @keyframes pgshimmer-pulse { 0%, 100% { opacity: 0.25; } 50% { opacity: 1; } }
      `}</style>
    </div>
  );
}
