import { CheckCircle2, Target, X } from "lucide-react";
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
      <div className="w-full rounded-2xl border border-border/60 bg-card px-4 py-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
            <Target size={13} className="text-brand" />
            {T("dailyGoal")}
          </p>
          <button
            onClick={() => setEditing(false)}
            className="flex h-6 w-6 items-center justify-center rounded-lg text-muted-foreground transition-colors active:bg-muted/20"
            aria-label="Cancel"
          >
            <X size={13} />
          </button>
        </div>
        <div className="flex gap-2">
          <div className="flex flex-1 items-center rounded-xl border border-border bg-muted/10 px-3 py-2.5 focus-within:border-brand/50 transition-colors">
            <span className="mr-1.5 text-xs font-bold text-muted-foreground">{currency}</span>
            <input
              type="number"
              min="1"
              step="100"
              value={goalInput}
              onChange={(e) => setGoalInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
              className="flex-1 bg-transparent text-sm font-bold text-foreground outline-none placeholder:text-muted-foreground"
              placeholder="e.g. 2000"
              autoFocus
            />
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-xl bg-brand px-5 py-2.5 text-sm font-black text-black shadow-sm transition-opacity disabled:opacity-60 active:opacity-80"
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
        className="flex w-full items-center gap-3 rounded-2xl border border-dashed border-border/60 bg-muted/5 px-4 py-3.5 text-left transition-all active:scale-[0.98] active:bg-muted/10"
      >
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border border-border/60 bg-card">
          <Target size={15} className="text-muted-foreground" />
        </div>
        <div className="flex-1">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            {T("dailyGoal")}
          </p>
          <p className="mt-0.5 text-xs font-semibold text-muted-foreground">
            Tap to set a daily earnings target
          </p>
        </div>
        <span className="rounded-xl bg-brand px-3 py-1.5 text-[10px] font-black text-black shadow-sm">
          Set Goal
        </span>
      </button>
    );
  }

  const todayPct = personalGoal > 0 ? Math.min(100, Math.round((todayEarnings / personalGoal) * 100)) : 0;
  const reached = todayPct >= 100;

  return (
    <div className="w-full rounded-2xl border border-border/60 bg-card px-4 py-4">
      {/* Header row */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {reached
            ? <CheckCircle2 size={15} className="text-success" />
            : <Target size={14} className="text-brand" />
          }
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            {T("dailyGoal")}
          </p>
          <span className="rounded-full border border-border/60 bg-muted/10 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-muted-foreground">
            {T("myGoalBadge")}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold ${
              reached ? "bg-success/15 text-success" : "bg-brand/10 text-brand"
            }`}
          >
            {reached ? T("dailyGoalReached") : `${todayPct}%`}
          </span>
          <button
            onClick={() => openEdit(personalGoal)}
            className="rounded-lg border border-border/60 bg-muted/10 px-2.5 py-1 text-[10px] font-bold text-muted-foreground transition-colors active:bg-muted/20"
          >
            Edit
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted/20">
        <div
          className={`h-full rounded-full transition-all duration-700 ${
            reached ? "bg-success shadow-sm shadow-success/30" : "bg-brand/80"
          }`}
          style={{ width: `${todayPct}%` }}
        />
      </div>

      {/* Amounts */}
      <div className="mt-3 flex items-center justify-between">
        <p className="text-sm font-bold text-foreground">
          {formatCurrency(todayEarnings, currency)}
        </p>
        <p className="text-xs font-medium text-muted-foreground">
          of {formatCurrency(personalGoal, currency)}
        </p>
      </div>
    </div>
  );
}
