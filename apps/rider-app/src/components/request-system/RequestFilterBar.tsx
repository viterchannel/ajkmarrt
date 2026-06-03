import { useState } from "react";
import { type TranslationKey } from "@workspace/i18n";
import { ChevronDown, X, SlidersHorizontal } from "lucide-react";
import type { RequestFilter } from "../../lib/request-engine/types";

interface RequestFilterBarProps {
  filter: RequestFilter;
  onChange: (f: Partial<RequestFilter>) => void;
  T: (key: TranslationKey) => string;
}

export function RequestFilterBar({ filter, onChange, T }: RequestFilterBarProps) {
  const [expanded, setExpanded] = useState(false);
  const activeCount = [
    filter.distanceMaxKm != null,
    filter.paymentMethods.length < 3,
    filter.timeWindow !== "any",
    filter.requestTypes.length < 5,
    filter.minEarnings != null,
    filter.vendorTier.length < 3,
    filter.showOnlyPriority,
  ].filter(Boolean).length;

  return (
    <div className="rounded-2xl bg-card shadow-sm">
      {/* Header row */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 px-3 py-2.5"
        aria-expanded={expanded}
      >
        <SlidersHorizontal size={14} className="text-muted" />
        <span className="text-xs font-semibold text-muted">
          {activeCount > 0 ? `${activeCount} active` : T("filters")}
        </span>
        <span className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-brand/15 px-1.5 text-[10px] font-extrabold text-brand">
          {filter.sortBy === "score" ? "Smart" : filter.sortBy}
        </span>
        <ChevronDown
          size={14}
          className={`text-muted transition-transform ${expanded ? "rotate-180" : ""}`}
        />
      </button>

      {/* Expanded filters */}
      {expanded && (
        <div className="space-y-3 border-t border-border px-3 pb-3 pt-2">
          {/* Distance */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted">
              {T("maxDistance")}
            </label>
            <div className="flex gap-2">
              {([null, 2, 5, 10] as const).map((d) => (
                <button
                  key={String(d)}
                  onClick={() => onChange({ distanceMaxKm: d })}
                  className={`rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition-colors ${
                    filter.distanceMaxKm === d
                      ? "bg-brand text-white"
                      : "bg-muted/50 text-muted hover:bg-muted"
                  }`}
                >
                  {d ? `${d} km` : "Any"}
                </button>
              ))}
            </div>
          </div>

          {/* Payment methods */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted">
              {T("paymentMethod")}
            </label>
            <div className="flex gap-2">
              {(["cash", "card", "wallet"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => {
                    const has = filter.paymentMethods.includes(m);
                    const next = has
                      ? filter.paymentMethods.filter((x) => x !== m)
                      : [...filter.paymentMethods, m];
                    onChange({ paymentMethods: next.length > 0 ? next : ["cash", "card", "wallet"] });
                  }}
                  className={`rounded-lg px-2.5 py-1.5 text-[11px] font-bold capitalize transition-colors ${
                    filter.paymentMethods.includes(m)
                      ? "bg-brand text-white"
                      : "bg-muted/50 text-muted hover:bg-muted"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {/* Request types */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted">
              {T("requestType")}
            </label>
            <div className="flex flex-wrap gap-2">
              {(["food", "mart", "pharmacy", "parcel", "ride"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => {
                    const has = filter.requestTypes.includes(t);
                    const next = has
                      ? filter.requestTypes.filter((x) => x !== t)
                      : [...filter.requestTypes, t];
                    onChange({ requestTypes: next.length > 0 ? next : ["food", "mart", "pharmacy", "parcel", "ride"] });
                  }}
                  className={`rounded-lg px-2.5 py-1.5 text-[11px] font-bold capitalize transition-colors ${
                    filter.requestTypes.includes(t)
                      ? "bg-brand text-white"
                      : "bg-muted/50 text-muted hover:bg-muted"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Vendor tier */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted">
              {T("vendorTier")}
            </label>
            <div className="flex gap-2">
              {(["vip", "standard", "new"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => {
                    const has = filter.vendorTier.includes(t);
                    const next = has
                      ? filter.vendorTier.filter((x) => x !== t)
                      : [...filter.vendorTier, t];
                    onChange({ vendorTier: next.length > 0 ? next : ["vip", "standard", "new"] });
                  }}
                  className={`rounded-lg px-2.5 py-1.5 text-[11px] font-bold uppercase transition-colors ${
                    filter.vendorTier.includes(t)
                      ? "bg-brand text-white"
                      : "bg-muted/50 text-muted hover:bg-muted"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Priority toggle */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => onChange({ showOnlyPriority: !filter.showOnlyPriority })}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition-colors ${
                filter.showOnlyPriority
                  ? "bg-warning text-white"
                  : "bg-muted/50 text-muted hover:bg-muted"
              }`}
            >
              <span className="h-2 w-2 rounded-full bg-current" />
              {T("priorityOnly")}
            </button>
          </div>

          {/* Sort */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted">
              {T("sortBy")}
            </label>
            <div className="flex gap-2">
              {(["score", "distance", "earnings", "time"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => onChange({ sortBy: s })}
                  className={`rounded-lg px-2.5 py-1.5 text-[11px] font-bold capitalize transition-colors ${
                    filter.sortBy === s
                      ? "bg-brand text-white"
                      : "bg-muted/50 text-muted hover:bg-muted"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Reset */}
          <button
            onClick={() =>
              onChange({
                distanceMaxKm: null,
                paymentMethods: ["cash", "card", "wallet"],
                timeWindow: "any",
                requestTypes: ["food", "mart", "pharmacy", "parcel", "ride"],
                minEarnings: null,
                vendorTier: ["vip", "standard", "new"],
                showOnlyPriority: false,
                sortBy: "score",
              })
            }
            className="flex items-center gap-1 text-[11px] font-bold text-error"
          >
            <X size={12} />
            {T("resetFilters")}
          </button>
        </div>
      )}
    </div>
  );
}
