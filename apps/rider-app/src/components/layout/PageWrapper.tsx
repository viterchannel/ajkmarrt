/**
 * PageWrapper — Unified page layout component for all rider app pages.
 * Ensures consistent min-h-screen, background color, and structure.
 * 
 * Usage in JSX:
 *   - <PageWrapper>
 *   -   <PageHeader title="My Page" />
 *   -   <main>content goes here</main>
 *   - </PageWrapper>
 */

import type React from "react";

interface PageWrapperProps {
  children: React.ReactNode;
  /** CSS class names to append (e.g., "space-y-4") */
  className?: string;
  /** Background color utility class (default: bg-page-bg) */
  bgColor?: "bg-page-bg" | "bg-white" | "bg-card";
  /** Whether to show PullToRefresh wrapper */
  refreshable?: false | (() => Promise<void>);
  /** Refresh accent color (CSS variable or hex) */
  accentColor?: string;
  /** Main content max-width (optional, for responsive) */
  maxWidth?: boolean;
}

/**
 * Dark mode page background (also light mode when .light class applied)
 * Imported from index.css @theme inline:
 *   --color-page-bg: #0A0A0A (dark)
 *   --color-surface: #0A0A0A (dark)
 * Light mode override:
 *   --color-page-bg: #FEFAF5 (light)
 */
export function PageWrapper({
  children,
  className = "",
  bgColor = "bg-page-bg",
  refreshable = false,
  accentColor = "var(--color-brand)",
  maxWidth = false,
}: PageWrapperProps) {
  const bgClass = {
    "bg-page-bg": "bg-page-bg",
    "bg-white": "bg-white",
    "bg-card": "bg-card",
  }[bgColor];

  const wrapperClass = `min-h-screen flex flex-col ${bgClass} ${className}`;

  const content = (
    <div className={wrapperClass}>
      {maxWidth && <div className="mx-auto w-full max-w-2xl flex-1">{children}</div>}
      {!maxWidth && children}
    </div>
  );

  // If refreshable, wrap with PullToRefresh
  if (refreshable) {
    const { PullToRefresh } = require("@/components/PullToRefresh");
    return (
      <PullToRefresh
        onRefresh={refreshable}
        accentColor={accentColor}
        className={wrapperClass}
      >
        {maxWidth && <div className="mx-auto w-full max-w-2xl flex-1">{children}</div>}
        {!maxWidth && children}
      </PullToRefresh>
    );
  }

  return content;
}
