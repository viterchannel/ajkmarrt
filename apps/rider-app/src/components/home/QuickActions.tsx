import { DollarSign, Phone } from "lucide-react";
import { Link } from "wouter";

export function QuickActions() {
  return (
    <div className="grid grid-cols-2 gap-2.5">
      <Link
        href="/earnings"
        className="flex items-center gap-2.5 rounded-2xl border border-border bg-card px-4 py-3 text-foreground transition-all active:scale-[0.98] active:bg-muted/40"
      >
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-muted/20">
          <DollarSign size={14} className="text-success" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-extrabold text-foreground leading-tight">My Earnings</p>
          <p className="text-[9px] text-muted-foreground mt-0.5">View history</p>
        </div>
      </Link>

      <Link
        href="/help"
        className="flex items-center gap-2.5 rounded-2xl border border-border bg-card px-4 py-3 text-foreground transition-all active:scale-[0.98] active:bg-muted/40"
      >
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-muted/20">
          <Phone size={14} className="text-brand" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-extrabold text-foreground leading-tight">Help</p>
          <p className="text-[9px] text-muted-foreground mt-0.5">Support &amp; FAQ</p>
        </div>
      </Link>
    </div>
  );
}
