import { AlertCircle, RefreshCw } from "lucide-react";

interface ErrorStateProps {
  title?: string;
  subtitle?: string;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
}

export function ErrorState({
  title = "Something went wrong",
  subtitle = "Check your connection and try again.",
  onRetry,
  retryLabel = "Try Again",
  className = "",
}: ErrorStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center px-6 py-16 text-center ${className}`}
    >
      {/* Icon ring — amber/gold tint; neutral enough for both light and dark surfaces */}
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl border border-warning/30/60 bg-warning/10 dark:border-brand/20 dark:bg-brand/[0.07]">
        <AlertCircle size={28} className="text-warning dark:text-brand" />
      </div>

      <p className="text-base font-bold text-[#B0B0B0] dark:text-white/80">{title}</p>

      {subtitle && (
        <p className="mt-1 text-sm leading-relaxed text-[#B0B0B0] dark:text-white/40">{subtitle}</p>
      )}

      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-5 flex items-center gap-2 rounded-2xl bg-brand px-5 py-2.5 text-sm font-bold text-white shadow-sm shadow-amber-200/50 transition-all hover:bg-warning active:scale-[0.98] dark:shadow-none"
        >
          <RefreshCw size={13} />
          {retryLabel}
        </button>
      )}
    </div>
  );
}
