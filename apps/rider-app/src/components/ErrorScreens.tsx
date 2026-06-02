/**
 * Reusable Error & Status Screen Components
 * Extracted from App.tsx to avoid inline styles and ensure theme consistency
 */

import { useLocation } from "wouter";
import type { TranslationKey } from "@workspace/i18n";

interface ErrorScreenProps {
  icon: React.ReactNode;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  severity?: "critical" | "warning" | "info";
}

/**
 * Generic Error/Status screen with consistent styling
 * Uses Tailwind + CSS variables for full theme compliance
 */
export function ErrorScreen({
  icon,
  title,
  message,
  actionLabel = "Back to Home",
  onAction,
  severity = "info",
}: ErrorScreenProps) {
  const severityClasses = {
    critical: "bg-error/10 border-error/20",
    warning: "bg-warning/10 border-warning/20",
    info: "bg-brand/10 border-brand/20",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-3xl border border-border bg-card p-7 shadow-2xl">
        {/* Icon container */}
        <div
          className={`mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border ${severityClasses[severity]}`}
        >
          {icon}
        </div>

        {/* Title */}
        <h2 className="mb-2 text-center text-lg font-bold text-white">{title}</h2>

        {/* Message */}
        {message && (
          <p className="mb-6 text-center text-sm text-muted-foreground">{message}</p>
        )}

        {/* Action button */}
        {onAction && (
          <button
            onClick={onAction}
            className="w-full rounded-xl bg-gradient-to-r from-brand to-brand-hover py-3 font-bold text-surface transition-transform active:scale-95"
          >
            {actionLabel}
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Feature Disabled Screen — shown when rider accesses disabled module
 */
export function ModuleDisabledScreen({
  T,
}: {
  T: (key: TranslationKey) => string;
}) {
  const [, navigate] = useLocation();

  return (
    <ErrorScreen
      icon={
        <svg
          width="28"
          height="28"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="text-brand"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
        </svg>
      }
      title={T("featureNotAvailable")}
      message={T("featureDisabledMsg")}
      actionLabel={T("backToHome")}
      onAction={() => navigate("/", { replace: true })}
      severity="warning"
    />
  );
}

/**
 * Session Expired Screen — shown when JWT expires
 */
export function SessionExpiredScreen({
  onDismiss,
  title,
  detail,
}: {
  onDismiss: () => void;
  title: string;
  detail: string;
}) {
  return (
    <ErrorScreen
      icon={
        <svg
          width="28"
          height="28"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="text-brand"
        >
          <circle cx="12" cy="12" r="1" />
          <path d="M12 7v5m0 5v.01" />
        </svg>
      }
      title={title}
      message={detail}
      actionLabel="Login Again"
      onAction={onDismiss}
      severity="critical"
    />
  );
}
