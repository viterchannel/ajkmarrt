import type { TranslationKey } from "@workspace/i18n";
import { Radio, Zap } from "lucide-react";
import { memo } from "react";

interface RequestListHeaderProps {
  totalRequests: number;
  T: (key: TranslationKey) => string;
}

export const RequestListHeader = memo(function RequestListHeader({
  totalRequests,
  T,
}: RequestListHeaderProps) {
  return (
    <div
      className={`flex items-center justify-between px-4 py-3.5 ${
        totalRequests > 0
          ? "bg-gradient-to-r from-warning via-warning to-brand-hover"
          : "bg-card"
      }`}
    >
      <div className="flex items-center gap-2.5">
        {totalRequests > 0 ? (
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/20">
            <Zap size={15} className="text-black" />
          </div>
        ) : (
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-muted/40">
            <Radio size={15} className="text-muted-foreground" />
          </div>
        )}
        <div>
          <p className={`text-sm font-extrabold tracking-tight ${totalRequests > 0 ? "text-black" : "text-foreground"}`}>
            {totalRequests > 0
              ? `${totalRequests} Request${totalRequests > 1 ? "s" : ""} Available`
              : T("listeningForRequests")}
          </p>
          {totalRequests > 0 && (
            <p className="text-xs font-semibold text-black/60">Tap a card to accept</p>
          )}
        </div>
      </div>
      {totalRequests > 0 && (
        <span className="flex items-center gap-1.5 rounded-full bg-black/15 px-3 py-1.5 text-[11px] font-extrabold tracking-widest text-black backdrop-blur-sm">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-black/70" />
          LIVE
        </span>
      )}
    </div>
  );
});
