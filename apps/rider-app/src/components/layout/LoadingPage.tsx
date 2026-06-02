/**
 * LoadingPage — Unified loading skeleton for data-heavy pages.
 * Provides consistent loading state across all pages.
 */

import { PageWrapper } from "@/components/layout/PageWrapper";
import { HeroPageHeader } from "@/components/layout/PageHeader";

interface LoadingPageProps {
  /** Number of skeleton cards to show (default: 3) */
  count?: number;
  /** Show header skeleton (default: true) */
  showHeader?: boolean;
  /** Header title for loading state (optional) */
  headerTitle?: string;
  /** Custom className */
  className?: string;
}

export function LoadingPage({
  count = 3,
  showHeader = true,
  headerTitle,
  className = "",
}: LoadingPageProps) {
  return (
    <PageWrapper className={className}>
      {showHeader && (
        <HeroPageHeader
          title={headerTitle || "Loading..."}
          subtitle="Please wait"
        />
      )}

      <main className="space-y-4 px-4 py-6">
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            className="animate-pulse space-y-3 rounded-3xl border border-border bg-card p-4"
          >
            {/* Header skeleton */}
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 flex-shrink-0 rounded-full bg-muted/30" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-24 rounded bg-muted/30" />
                <div className="h-3 w-16 rounded bg-muted/20" />
              </div>
            </div>

            {/* Content skeleton */}
            <div className="space-y-2">
              <div className="h-3 w-full rounded bg-muted/30" />
              <div className="h-3 w-4/5 rounded bg-muted/20" />
            </div>

            {/* Footer skeleton */}
            <div className="flex gap-2 pt-2">
              <div className="h-8 flex-1 rounded-lg bg-muted/30" />
              <div className="h-8 w-12 rounded-lg bg-muted/20" />
            </div>
          </div>
        ))}
      </main>
    </PageWrapper>
  );
}

/**
 * Variant: Loading page for hero-style pages (Home, Active, Earnings)
 */
export function HeroLoadingPage({
  headerTitle = "Loading...",
  count = 2,
}: { headerTitle?: string; count?: number }) {
  return (
    <PageWrapper className="space-y-4">
      <HeroPageHeader title={headerTitle} subtitle="Getting your data..." />

      <main className="space-y-4 px-4 py-6">
        {/* Stats skeleton */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={`stat-${i}`}
              className="animate-pulse space-y-2 rounded-2xl border border-border bg-card p-3"
            >
              <div className="h-3 w-12 rounded bg-muted/30" />
              <div className="h-5 w-16 rounded bg-muted/30" />
            </div>
          ))}
        </div>

        {/* Content skeleton */}
        <div className="space-y-3">
          {Array.from({ length: count }).map((_, i) => (
            <div
              key={`card-${i}`}
              className="animate-pulse space-y-3 rounded-3xl border border-border bg-card p-4"
            >
              <div className="h-4 w-2/3 rounded bg-muted/30" />
              <div className="h-3 w-full rounded bg-muted/20" />
              <div className="h-3 w-4/5 rounded bg-muted/20" />
            </div>
          ))}
        </div>
      </main>
    </PageWrapper>
  );
}
