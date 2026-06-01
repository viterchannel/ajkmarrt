import { DollarSign, Phone } from "lucide-react";
import { Link } from "wouter";

export function QuickActions() {
  return (
    <div className="grid grid-cols-2 gap-2.5">
      <Link
        href="/earnings"
        className="flex items-center gap-2.5 rounded-2xl border border-white/10 bg-card-dark px-4 py-3 text-white transition-all active:scale-[0.98] active:bg-white/[0.07]"
      >
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-white/[0.06]">
          <DollarSign size={14} className="text-success" />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-extrabold text-white leading-tight">My Earnings</p>
          <p className="text-[9px] text-white/30 mt-0.5">View history</p>
        </div>
      </Link>

      <Link
        href="/help"
        className="flex items-center gap-2.5 rounded-2xl border border-white/10 bg-card-dark px-4 py-3 text-white transition-all active:scale-[0.98] active:bg-white/[0.07]"
      >
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-white/[0.06]">
          <Phone size={14} className="text-brand" />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-extrabold text-white leading-tight">Help</p>
          <p className="text-[9px] text-white/30 mt-0.5">Support &amp; FAQ</p>
        </div>
      </Link>
    </div>
  );
}
