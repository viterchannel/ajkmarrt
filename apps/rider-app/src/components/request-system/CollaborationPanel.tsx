import { type TranslationKey } from "@workspace/i18n";
import { Users, UserPlus, UserMinus, CheckCircle } from "lucide-react";
import type { CollaborationInterest } from "../../lib/request-engine/types";

interface CollaborationPanelProps {
  rideId: string;
  interests: CollaborationInterest[];
  isInterested: boolean;
  onExpress: () => void;
  onWithdraw: () => void;
  T: (key: TranslationKey) => string;
}

export function CollaborationPanel({
  rideId,
  interests,
  isInterested,
  onExpress,
  onWithdraw,
  T,
}: CollaborationPanelProps) {
  const pending = interests.filter((i) => i.status === "pending");
  const accepted = interests.filter((i) => i.status === "accepted");

  return (
    <div className="rounded-xl border-2 border-indigo-500/20 bg-indigo-500/5 p-2.5">
      <div className="flex items-center gap-2 mb-2">
        <Users size={14} className="text-indigo-500" />
        <span className="text-[11px] font-bold text-indigo-500">
          {T("groupRide")} — {interests.length} {T("interested")}
        </span>
      </div>

      {/* Interested riders list */}
      {pending.length > 0 && (
        <div className="mb-2 space-y-1">
          {pending.map((i) => (
            <div key={i.riderId} className="flex items-center gap-1.5 rounded-lg bg-card px-2 py-1">
              <div className="h-5 w-5 rounded-full bg-indigo-500/15 flex items-center justify-center">
                <span className="text-[8px] font-extrabold text-indigo-500">{i.riderName[0]}</span>
              </div>
              <span className="text-[10px] font-semibold text-muted">{i.riderName}</span>
              <span className="ml-auto rounded-full bg-indigo-500/10 px-1.5 py-0.5 text-[8px] font-bold text-indigo-500">
                PENDING
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Accepted riders */}
      {accepted.length > 0 && (
        <div className="mb-2 space-y-1">
          {accepted.map((i) => (
            <div key={i.riderId} className="flex items-center gap-1.5 rounded-lg bg-success/10 px-2 py-1">
              <CheckCircle size={10} className="text-success" />
              <span className="text-[10px] font-semibold text-success">{i.riderName}</span>
              <span className="ml-auto rounded-full bg-success/10 px-1.5 py-0.5 text-[8px] font-bold text-success">
                CONFIRMED
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Express / Withdraw interest */}
      <button
        onClick={isInterested ? onWithdraw : onExpress}
        className={`flex w-full items-center justify-center gap-1.5 rounded-lg py-2 text-[11px] font-bold transition-all ${
          isInterested
            ? "border border-indigo-500/30 bg-indigo-500/10 text-indigo-500 hover:bg-indigo-500/20"
            : "bg-indigo-500 text-white hover:bg-indigo-600"
        }`}
      >
        {isInterested ? (
          <>
            <UserMinus size={12} />
            {T("withdrawInterest")}
          </>
        ) : (
          <>
            <UserPlus size={12} />
            {T("expressInterest")}
          </>
        )}
      </button>
    </div>
  );
}
