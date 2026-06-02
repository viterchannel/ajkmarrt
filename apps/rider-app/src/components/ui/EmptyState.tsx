import type { LucideIcon } from "lucide-react";
import { ClipboardList } from "lucide-react";

interface EmptyStateProps {
  icon?: LucideIcon;
  emoji?: string;
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export function EmptyState({
  icon: Icon = ClipboardList,
  emoji,
  title,
  subtitle,
  actionLabel,
  onAction,
  className = "",
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center px-6 py-16 text-center ${className}`}
    >
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-muted">
        {emoji ? (
          <span className="text-3xl">{emoji}</span>
        ) : (
          <Icon size={28} className="text-muted-foreground" />
        )}
      </div>
      <p className="text-base font-bold text-muted-foreground">{title}</p>
      {subtitle && <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{subtitle}</p>}
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="mt-4 rounded-2xl bg-card px-5 py-2.5 text-sm font-bold text-foreground transition-colors active:bg-muted/70"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
