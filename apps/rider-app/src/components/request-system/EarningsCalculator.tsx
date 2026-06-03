import { useMemo, useState } from "react";
import { type TranslationKey } from "@workspace/i18n";
import { Calculator, ChevronDown, Crown, MapPin, Clock, Zap, Minus } from "lucide-react";
import type { UnifiedRequest } from "../../lib/request-engine/types";
import type { UseRequestEngineReturn } from "../../lib/request-engine/useRequestEngine";
import { formatCurrency } from "../dashboard/helpers";

interface EarningsCalculatorProps {
  request: UnifiedRequest;
  engine: UseRequestEngineReturn;
  currency: string;
  T: (key: TranslationKey) => string;
}

export function EarningsCalculator({ request, engine, currency, T }: EarningsCalculatorProps) {
  const [expanded, setExpanded] = useState(false);
  const breakdown = useMemo(() => engine.getEarningsBreakdown(request), [engine, request]);
  const vp = engine.getVendorPriority(request);

  const rows = [
    { label: T("baseEarnings"), value: breakdown.baseEarnings, icon: Calculator, color: "text-default" },
    { label: T("distanceBonus"), value: breakdown.distanceBonus, icon: MapPin, color: "text-success", show: breakdown.distanceBonus > 0 },
    { label: T("timeBonus"), value: breakdown.timeBonus, icon: Clock, color: "text-info", show: breakdown.timeBonus > 0 },
    { label: T("surgeBonus"), value: breakdown.surgeBonus, icon: Zap, color: "text-warning", show: breakdown.surgeBonus > 0 },
    { label: T("vendorTierBonus"), value: breakdown.vendorTierBonus, icon: Crown, color: "text-purple-500", show: breakdown.vendorTierBonus > 0 },
    { label: T("platformFee"), value: -breakdown.platformFee, icon: Minus, color: "text-error", show: breakdown.platformFee > 0 },
  ];

  const visibleRows = rows.filter((r) => (r.show ?? true));

  return (
    <div className="rounded-xl border border-border/60 bg-muted/30">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 px-3 py-2"
        aria-expanded={expanded}
      >
        <Calculator size={13} className="text-muted" />
        <span className="text-[11px] font-bold text-muted">{T("earningsBreakdown")}</span>
        <span className="ml-auto text-xs font-extrabold text-success">
          {formatCurrency(breakdown.netEarnings, currency)}
        </span>
        <ChevronDown
          size={12}
          className={`text-muted transition-transform ${expanded ? "rotate-180" : ""}`}
        />
      </button>

      {expanded && (
        <div className="space-y-1 border-t border-border/60 px-3 pb-2 pt-1.5">
          {visibleRows.map((row) => (
            <div key={row.label} className="flex items-center justify-between text-[11px]">
              <div className="flex items-center gap-1.5">
                <row.icon size={11} className={row.color} />
                <span className="text-muted">{row.label}</span>
              </div>
              <span className={`font-bold ${row.color}`}>
                {row.value < 0 ? "-" : "+"}{formatCurrency(Math.abs(row.value), currency)}
              </span>
            </div>
          ))}
          <div className="mt-1.5 flex items-center justify-between border-t border-border/60 pt-1.5">
            <span className="text-[11px] font-bold text-default">{T("netEarnings")}</span>
            <span className="text-sm font-extrabold text-success">
              {formatCurrency(breakdown.netEarnings, currency)}
            </span>
          </div>
          {vp && (
            <div className="flex items-center gap-1.5 rounded-lg bg-purple-500/10 px-2 py-1">
              <Crown size={10} className="text-purple-500" />
              <span className="text-[10px] font-bold text-purple-500">
                {vp.tier.toUpperCase()} Vendor — {vp.tierBonusPct}% bonus
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
