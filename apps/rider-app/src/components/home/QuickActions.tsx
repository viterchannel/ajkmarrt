import { BarChart2, HelpCircle } from "lucide-react";
import { Link } from "wouter";

export function QuickActions() {
  return (
    <div className="space-y-2">
      <p className="px-0.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        Quick Actions
      </p>
      <div className="grid grid-cols-2 gap-2.5">
        <Link
          href="/earnings"
          className="group flex flex-col gap-3 rounded-2xl border border-border/60 bg-card p-4 transition-all active:scale-[0.97] active:bg-muted/20"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-success/10 transition-transform group-active:scale-95">
            <BarChart2 size={18} className="text-success" />
          </div>
          <div>
            <p className="text-sm font-extrabold leading-tight text-foreground">My Earnings</p>
            <p className="mt-0.5 text-[10px] text-muted-foreground">View history &amp; payouts</p>
          </div>
        </Link>

        <Link
          href="/help"
          className="group flex flex-col gap-3 rounded-2xl border border-border/60 bg-card p-4 transition-all active:scale-[0.97] active:bg-muted/20"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand/10 transition-transform group-active:scale-95">
            <HelpCircle size={18} className="text-brand" />
          </div>
          <div>
            <p className="text-sm font-extrabold leading-tight text-foreground">Help &amp; Support</p>
            <p className="mt-0.5 text-[10px] text-muted-foreground">FAQ &amp; contact us</p>
          </div>
        </Link>
      </div>
    </div>
  );
}
