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
  const [goalInput, setGoalInput] = useState(String(personalGoal ?? adminGoal ?? ""));
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
      <div className="w-full rounded-2xl border border-white/[0.08] bg-white/[0.04] px-4 py-3.5">
        <div className="mb-2.5 flex items-center justify-between">
          <p className="flex items-center gap-1.5 text-xs font-bold text-white/50">
            <Target size={12} />
            {T("dailyGoal")}
          </p>
          <button
            onClick={() => setEditing(false)}
            className="text-white/40 transition-colors active:text-white"
            aria-label="Cancel"
          >
            <X size={14} />
          </button>
        </div>
        <div className="flex gap-2">
          <div className="flex flex-1 items-center rounded-xl border border-white/15 bg-white/[0.06] px-3 py-2.5">
            <span className="mr-1.5 text-xs font-bold text-white/40">{currency}</span>
            <input
              type="number"
              min="1"
              step="100"
              value={goalInput}
              onChange={(e) => setGoalInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
              className="flex-1 bg-transparent text-sm font-bold text-white outline-none placeholder:text-white/20"
              placeholder="e.g. 2000"
              autoFocus
            />
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-xl bg-success px-4 py-2 text-xs font-black text-white transition-opacity disabled:opacity-60 active:opacity-90"
          >
            {saving ? "…" : "Save"}
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
        className="flex w-full items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.04] px-4 py-3 text-left transition-colors active:bg-white/[0.07]"
      >
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-white/[0.08]">
          <Target size={14} className="text-white/40" />
        </div>
        <div className="flex-1">
          <p className="text-[10px] font-bold uppercase tracking-wider text-white/30">
            {T("dailyGoal")}
          </p>
          <p className="mt-0.5 text-xs font-semibold text-white/50">
            Set a daily earnings target
          </p>
        </div>
        <span className="rounded-full border border-white/10 bg-white/[0.08] px-3 py-1 text-[10px] font-bold text-white/50">
          Set
        </span>
      </button>
    );
  }

  const todayPct = personalGoal > 0 ? Math.min(100, Math.round((todayEarnings / personalGoal) * 100)) : 0;
  const reached = todayPct >= 100;

  return (
    <div className="w-full rounded-2xl border border-white/[0.08] bg-white/[0.04] px-4 py-3.5">
      {/* Header row */}
      <div className="mb-3 flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-white/30">
          <Target size={11} className={reached ? "text-success" : "text-white/30"} />
          {T("dailyGoal")}
          <span className="rounded-full border border-white/10 bg-white/[0.08] px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-white/40">
            {T("myGoalBadge")}
          </span>
        </p>
        <div className="flex items-center gap-2">
          {reached && <CheckCircle size={13} className="text-success" />}
          <span
            className={`rounded-full px-2.5 py-0.5 text-[10px] font-extrabold ${
              reached ? "bg-success/15 text-success" : "bg-white/[0.08] text-white/60"
            }`}
          >
            {reached ? T("dailyGoalReached") : `${todayPct}%`}
          </span>
          <button
            onClick={() => openEdit(personalGoal)}
            className="rounded-full border border-white/10 bg-white/[0.08] px-2.5 py-0.5 text-[10px] font-bold text-white/40 transition-colors active:bg-white/15"
          >
            Edit
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-2 w-full overflow-hidden rounded-full bg-white/[0.08]">
        <div
          className={`h-2 rounded-full transition-all duration-700 ${reached ? "bg-success" : "bg-brand/70"}`}
          style={{ width: `${todayPct}%` }}
        />
      </div>

      {/* Amounts */}
      <div className="mt-2 flex items-center justify-between">
        <p className="text-xs font-semibold text-white/40">
          {formatCurrency(todayEarnings, currency)}
        </p>
        <p className="text-xs font-semibold text-white/25">
          of {formatCurrency(personalGoal, currency)}
        </p>
      </div>
    </div>
  );
}
