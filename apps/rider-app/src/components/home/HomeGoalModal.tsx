import { X } from "lucide-react";
import { formatCurrency } from "../dashboard";

interface HomeGoalModalProps {
  onClose: () => void;
  goalInput: string;
  setGoalInput: (v: string) => void;
  handleSaveGoal: () => void;
  goalMutation: { isPending: boolean; mutate: (v: null) => void };
  config: { rider?: { dailyGoal?: number } };
  currency: string;
  earningsData: { dailyGoal?: number } | undefined;
  user: { dailyGoal?: number } | null | undefined;
  T: (key: import("@workspace/i18n").TranslationKey) => string;
}

export function HomeGoalModal({
  onClose,
  goalInput,
  setGoalInput,
  handleSaveGoal,
  goalMutation,
  config,
  currency,
  earningsData,
  user,
  T,
}: HomeGoalModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center">
      <div className="w-full max-w-sm rounded-t-3xl bg-card-dark p-6 shadow-2xl sm:rounded-3xl">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-base font-extrabold text-white">{T("setDailyGoalTitle")}</h3>
            <p className="mt-0.5 text-xs text-[#B0B0B0]">
              Admin default: {formatCurrency(config.rider?.dailyGoal ?? 5000, currency)}/day
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl bg-border-dark p-2 text-[#B0B0B0] transition-colors hover:bg-border-dark"
          >
            <X size={16} />
          </button>
        </div>

        <div className="mb-4">
          <label className="mb-1.5 block text-xs font-bold tracking-wider text-[#B0B0B0] uppercase">
            Your Personal Goal ({currency})
          </label>
          <div className="flex items-center overflow-hidden rounded-2xl border-2 border-white/10 transition-colors focus-within:border-white/20">
            <span className="px-3 text-sm font-bold text-[#B0B0B0]">{currency}</span>
            <input
              type="number"
              min="1"
              step="100"
              value={goalInput}
              onChange={(e) => setGoalInput(e.target.value)}
              placeholder={String(Math.round(config.rider?.dailyGoal ?? 5000))}
              className="flex-1 bg-transparent py-3 pr-3 text-lg font-extrabold text-white outline-none"
              autoFocus
            />
          </div>
          <p className="mt-1.5 text-xs text-[#B0B0B0]">
            Leave blank to use the admin default (
            {formatCurrency(config.rider?.dailyGoal ?? 5000, currency)}).
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-2xl border border-white/10 py-3 text-sm font-bold text-[#B0B0B0] transition-colors hover:bg-card-dark"
          >
            Cancel
          </button>
          <button
            onClick={handleSaveGoal}
            disabled={goalMutation.isPending}
            className="flex-1 rounded-2xl bg-card-dark py-3 text-sm font-bold text-white transition-colors hover:bg-card-dark disabled:opacity-60"
          >
            {goalMutation.isPending ? "Saving…" : T("saveGoal")}
          </button>
        </div>

        {(earningsData?.dailyGoal ?? user?.dailyGoal) && (
          <button
            onClick={() => goalMutation.mutate(null)}
            disabled={goalMutation.isPending}
            className="mt-2 w-full py-2.5 text-xs font-bold text-error transition-colors hover:text-error disabled:opacity-60"
          >
            {T("resetToAdminDefault")}
          </button>
        )}
      </div>
    </div>
  );
}
