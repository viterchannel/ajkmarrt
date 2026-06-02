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
      className={`flex items-center justify-between px-4 py-3.5 ${totalRequests > 0 ? "bg-gradient-to-r from-warning via-warning to-brand-hover" : "bg-card"}`}
    >
      <div className="flex items-center gap-2.5">
        {totalRequests > 0 ? (
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/20">
            <Zap size={14} className="text-foreground" />
          </div>
        ) : (
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-muted/40">
            <Radio size={14} className="text-muted-foreground" />
          </div>
        )}
        <div>
          <p className={`text-sm font-extrabold tracking-tight ${totalRequests > 0 ? "text-foreground" : "text-foreground"}`}>
            {totalRequests > 0
              ? `${totalRequests} Request${totalRequests > 1 ? "s" : ""} Available`
              : T("listeningForRequests")}
          </p>
          {totalRequests > 0 && (
            <p className="text-[10px] font-medium text-muted-foreground">Tap to accept</p>
          )}
        </div>
      </div>
      {totalRequests > 0 && (
        <span className="flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-[10px] font-extrabold tracking-widest text-foreground/90 backdrop-blur-sm">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" />
          LIVE
        </span>
      )}
    </div>
  );
});
