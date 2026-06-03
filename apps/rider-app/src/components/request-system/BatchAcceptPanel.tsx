import { useState } from "react";
import { type TranslationKey } from "@workspace/i18n";
import { Package, ChevronRight, MapPin, CheckCircle, Layers } from "lucide-react";
import type { BatchGroup } from "../../lib/request-engine/types";
import { formatCurrency } from "../dashboard/helpers";

interface BatchAcceptPanelProps {
  groups: BatchGroup[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onAccept: (groupId: string) => void;
  currency: string;
  T: (key: TranslationKey) => string;
}

export function BatchAcceptPanel({
  groups,
  selectedId,
  onSelect,
  onAccept,
  currency,
  T,
}: BatchAcceptPanelProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-2xl border border-brand/30 bg-brand/5 shadow-sm">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 px-3 py-2.5"
      >
        <Layers size={14} className="text-brand" />
        <span className="text-xs font-bold text-brand">
          {T("batchAcceptAvailable")} ({groups.length} {T("groups")})
        </span>
        <span className="ml-auto rounded-full bg-brand/15 px-2 py-0.5 text-[10px] font-extrabold text-brand">
          {groups.reduce((sum, g) => sum + g.count, 0)} {T("requests")}
        </span>
        <ChevronRight
          size={14}
          className={`text-brand transition-transform ${expanded ? "rotate-90" : ""}`}
        />
      </button>

      {expanded && (
        <div className="space-y-2 border-t border-brand/20 px-3 pb-3 pt-2">
          {groups.slice(0, 3).map((group) => (
            <div
              key={group.id}
              onClick={() => onSelect(selectedId === group.id ? null : group.id)}
              className={`cursor-pointer rounded-xl border p-2.5 transition-all ${
                selectedId === group.id
                  ? "border-brand bg-brand/10"
                  : "border-border bg-card hover:bg-muted/30"
              }`}
            >
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand/15">
                  <Package size={14} className="text-brand" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-default truncate">
                    {group.pickupArea}
                  </p>
                  <p className="text-[10px] text-muted">
                    <MapPin size={9} className="inline mr-1" />
                    {group.distance.toFixed(1)} km · {group.count} {T("requests")}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-extrabold text-success">
                    {formatCurrency(group.totalEarnings, currency)}
                  </p>
                  <p className="text-[10px] text-muted">{T("totalEarnings")}</p>
                </div>
              </div>

              {/* Mini list of requests in group */}
              {selectedId === group.id && (
                <div className="mt-2 space-y-1 border-t border-border pt-2">
                  {group.requests.map((req) => (
                    <div key={req.id} className="flex items-center justify-between rounded-lg bg-muted/30 px-2 py-1">
                      <span className="text-[10px] font-semibold text-muted truncate">
                        {(req as any).pickupAddress ?? "Request"}
                      </span>
                      <span className="text-[10px] font-bold text-default">
                        {formatCurrency((req as any).fare, currency)}
                      </span>
                    </div>
                  ))}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onAccept(group.id);
                    }}
                    className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-xl bg-brand py-2 text-xs font-extrabold text-white shadow-sm hover:bg-brand-hover active:scale-[0.98]"
                  >
                    <CheckCircle size={14} />
                    {T("acceptAllBatch")}
                  </button>
                </div>
              )}
            </div>
          ))}
          {groups.length > 3 && (
            <p className="text-center text-[10px] text-muted">
              +{groups.length - 3} more {T("groups")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
