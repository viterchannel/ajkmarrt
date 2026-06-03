import { useEffect, useState } from "react";
import { type TranslationKey } from "@workspace/i18n";
import { Timer, Clock, X, AlertTriangle } from "lucide-react";
import type { Reservation } from "../../lib/request-engine/types";

interface ReservationTimerProps {
  reservation: Reservation;
  onExtend: () => void;
  onCancel: () => void;
  T: (key: TranslationKey) => string;
}

export function ReservationTimer({ reservation, onExtend, onCancel, T }: ReservationTimerProps) {
  const [remaining, setRemaining] = useState(() => Math.max(0, reservation.expiresAt - Date.now()));
  const [extended, setExtended] = useState(reservation.extended);

  useEffect(() => {
    const id = setInterval(() => {
      setRemaining(Math.max(0, reservation.expiresAt - Date.now()));
    }, 1000);
    return () => clearInterval(id);
  }, [reservation.expiresAt]);

  const totalMs = 3 * 60 * 1000 + (extended ? 2 * 60 * 1000 : 0);
  const pct = Math.max(0, Math.min(100, (remaining / totalMs) * 100));
  const min = Math.floor(remaining / 60000);
  const sec = Math.floor((remaining % 60000) / 1000);

  const isUrgent = remaining < 30000;

  return (
    <div className={`rounded-xl border-2 p-2.5 ${isUrgent ? "border-error/40 bg-error/10" : "border-purple-500/30 bg-purple-500/10"}`}>
      <div className="flex items-center gap-2 mb-1.5">
        <Timer size={14} className={isUrgent ? "text-error" : "text-purple-500"} />
        <span className={`text-[11px] font-bold ${isUrgent ? "text-error" : "text-purple-500"}`}>
          {T("reservedFor")}
        </span>
        <span className={`ml-auto text-sm font-extrabold tabular-nums ${isUrgent ? "text-error" : "text-purple-500"}`}>
          {min}:{sec.toString().padStart(2, "0")}
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-1000 ${isUrgent ? "bg-error" : "bg-purple-500"}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      {isUrgent && (
        <div className="mt-1.5 flex items-center gap-1 text-[10px] font-bold text-error">
          <AlertTriangle size={10} />
          {T("reservationExpiring")}
        </div>
      )}

      <div className="mt-2 flex gap-2">
        {!extended && !isUrgent && (
          <button
            onClick={() => {
              onExtend();
              setExtended(true);
            }}
            className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-purple-500/30 bg-purple-500/10 py-1.5 text-[11px] font-bold text-purple-500 hover:bg-purple-500/20"
          >
            <Clock size={11} />
            {T("extendReservation")}
          </button>
        )}
        <button
          onClick={onCancel}
          className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-error/30 bg-error/10 py-1.5 text-[11px] font-bold text-error hover:bg-error/20"
        >
          <X size={11} />
          {T("cancelReservation")}
        </button>
      </div>
    </div>
  );
}
