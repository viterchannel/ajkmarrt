import { CheckCircle, Target, X } from "lucide-react";
import { useState } from "react";
import { api } from "../../lib/api";
import { formatCurrency } from "../dashboard";
import { toast } from "../../hooks/use-toast";

interface GoalSectionProps {
  adminGoal: number;
  personalGoal: number | null;
  todayEarnings: number;
  currency: string;
  T: (key: import("@workspace/i18n").TranslationKey) => string;
  refreshUser: () => Promise<void>;
}

export function GoalSection({
  adminGoal,
  personalGoal,
  todayEarnings,
  currency,
  T,
  refreshUser,
}: GoalSectionProps) {
  const [editing, setEditing] = useState(false);
  const [goalInput, setGoalInput] = useState(
    String(personalGoal ?? adminGoal ?? "")
  );
  const [saving, setSaving] = useState(false);

  const openEdit = (currentGoal?: number | null) => {
    setGoalInput(String(currentGoal ?? adminGoal ?? ""));
    setEditing(true);
  };

  const handleSave = async () => {
    const val = parseFloat(goalInput);
    if (!val || val <= 0) {
      toast({ title: "Enter a valid goal amount", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await api.setDailyGoal(val);
      await refreshUser();
      setEditing(false);
      toast({ title: "Daily goal updated!" });
    } catch {
      toast({ title: "Failed to save goal", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <div className="w-full rounded-2xl border border-white/10 bg-card-dark px-4 py-3 shadow-sm">
        <div className="mb-2 flex items-center justify-between">
          <p className="flex items-center gap-1.5 text-xs font-bold text-[#B0B0B0]">
            <Target size={12} className="text-[#B0B0B0]" />
            {T("dailyGoal")}
          </p>
          <button
            onClick={() => setEditing(false)}
            className="text-[#B0B0B0] active:text-white"
          >
            <X size={14} />
          </button>
        </div>
        <div className="flex gap-2">
          <div className="flex flex-1 items-center rounded-xl border border-white/20 bg-border-dark px-3 py-2">
            <span className="mr-1 text-xs font-bold text-[#B0B0B0]">
              {currency}
            </span>
            <input
              type="number"
              min="1"
              step="100"
              value={goalInput}
              onChange={(e) => setGoalInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
              className="flex-1 bg-transparent text-sm font-bold text-white outline-none placeholder:text-[#555]"
              placeholder="e.g. 2000"
              autoFocus
            />
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-black text-white disabled:opacity-60 active:bg-emerald-700"
          >
            {saving ? "..." : "Save"}
          </button>
        </div>
      </div>
    );
  }

  if (!personalGoal) {
    return (
      <button
        type="button"
        aria-label="Set a daily earnings goal"
        onClick={() => openEdit(null)}
        className="flex w-full cursor-pointer items-center gap-3 rounded-2xl border border-white/10 bg-card-dark px-4 py-3 text-left shadow-sm transition-colors active:bg-[#222222]"
      >
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-white/10">
          <Target size={16} className="text-[#B0B0B0]" />
        </div>
        <div className="flex-1">
          <p className="text-xs font-bold text-[#B0B0B0]">{T("dailyGoal")}</p>
          <p className="mt-0.5 text-[10px] text-[#B0B0B0]">
            Tap to set a daily earnings goal
          </p>
        </div>
        <span className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-bold text-[#B0B0B0]">
          Set goal
        </span>
      </button>
    );
  }

  const todayPct =
    personalGoal > 0
      ? Math.min(100, Math.round((todayEarnings / personalGoal) * 100))
      : 0;
  const reached = todayPct >= 100;

  return (
    <div className="w-full rounded-2xl border border-white/10 bg-card-dark px-4 py-3 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-xs font-bold text-[#B0B0B0]">
          <Target
            size={12}
            className={reached ? "text-success" : "text-[#B0B0B0]"}
          />
          {T("dailyGoal")}
          <span className="rounded-full bg-border-dark px-1.5 py-0.5 text-[8px] font-bold tracking-wider text-white uppercase">
            {T("myGoalBadge")}
          </span>
        </p>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => openEdit(personalGoal)}
            className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold text-[#B0B0B0] active:bg-white/20"
          >
            Edit
          </button>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${
              reached ? "bg-success/20 text-success" : "bg-white/10 text-white"
            }`}
          >
            {reached ? T("dailyGoalReached") : `${todayPct}% of goal`}
          </span>
          {reached && <CheckCircle size={12} className="text-success" />}
        </div>
      </div>

      <div className="h-2 w-full overflow-hidden rounded-full bg-border-dark">
        <div
          className={`h-2 rounded-full transition-all duration-700 ${
            reached ? "bg-success" : "bg-white/30"
          }`}
          style={{ width: `${todayPct}%` }}
        />
      </div>

      <p className="mt-1.5 text-[10px] font-medium text-[#B0B0B0]">
        {formatCurrency(todayEarnings, currency)} /{" "}
        {formatCurrency(personalGoal, currency)}
      </p>
    </div>
  );
}
