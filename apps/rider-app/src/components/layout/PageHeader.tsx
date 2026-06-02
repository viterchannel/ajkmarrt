/**
 * PageHeader — Unified page header component with consistent styling.
 * Handles safe-area insets, title, back button, and actions.
 * 
 * Usage:
 *   <PageHeader
 *     title="Wallet"
 *     backButton
 *     onBack={() => navigate("/")}
 *     action={<ThemeToggle />}
 *   />
 */

import { ChevronLeft } from "lucide-react";
import type React from "react";

interface PageHeaderProps {
  /** Page title (optional) */
  title?: string;
  /** Subtitle or secondary text (optional) */
  subtitle?: string;
  /** Show back button (default: false) */
  backButton?: boolean;
  /** Callback when back button is clicked */
  onBack?: () => void;
  /** Action element(s) to display on right side */
  action?: React.ReactNode;
  /** Additional CSS classes */
  className?: string;
  /** Custom background color (default: from CSS variable) */
  bgColor?: string;
}

export function PageHeader({
  title,
  subtitle,
  backButton = false,
  onBack,
  action,
  className = "",
  bgColor = "bg-surface",
}: PageHeaderProps) {
  return (
    <header
      className={`sticky top-0 z-20 border-b border-border ${bgColor} px-4 ${className}`}
      style={{
        paddingTop: `calc(env(safe-area-inset-top, 0px) + 12px)`,
        paddingBottom: "12px",
      }}
    >
      <div className="flex items-center gap-3">
        {/* Back Button */}
        {backButton && (
          <button
            onClick={onBack}
            className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-muted active:bg-muted/50 transition-colors"
            aria-label="Go back"
          >
            <ChevronLeft size={20} className="text-foreground" />
          </button>
        )}

        {/* Title & Subtitle */}
        {(title || subtitle) && (
          <div className="flex-1 min-w-0">
            {title && <h1 className="text-base font-semibold text-foreground truncate">{title}</h1>}
            {subtitle && <p className="text-xs text-muted-foreground truncate">{subtitle}</p>}
          </div>
        )}

        {/* Action Slot */}
        {action && <div className="flex-shrink-0">{action}</div>}
      </div>
    </header>
  );
}

/**
 * Variant: Hero Header for dashboard-like pages (Home, Active, Wallet)
 * Uses gradient background and elevated styling.
 */
interface HeroPageHeaderProps extends Omit<PageHeaderProps, "bgColor"> {
  /** Gradient class (default: page-header-gradient) */
  gradient?: string;
}

export function HeroPageHeader({
  title,
  subtitle,
  action,
  className = "",
  gradient = "page-header-gradient",
  ...props
}: HeroPageHeaderProps) {
  return (
    <header
      className={`relative overflow-hidden rounded-b-[2rem] ${gradient} bg-card px-5 ${className}`}
      style={{
        paddingTop: `calc(env(safe-area-inset-top, 0px) + 16px)`,
        paddingBottom: "24px",
      }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          {title && <h1 className="text-xl font-bold text-foreground">{title}</h1>}
          {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        {action && <div className="flex-shrink-0">{action}</div>}
      </div>
    </header>
  );
}
