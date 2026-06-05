import { CheckCircle2, Target, X } from "lucide-react";
import { useEffect, useState } from "react";
import { motion, useSpring, useTransform } from "framer-motion";
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

/* ─── SVG ring progress ──────────────────────────────────────────────────── */

const RING_SIZE = 96;
const STROKE_WIDTH = 8;
const RADIUS = (RING_SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function getRingColor(pct: number): string {
  if (pct >= 100) return "#4ADE80";
  if (pct >= 70) return "#22C55E";
  if (pct >= 40) return "#F59E0B";
  return "#EF4444";
}

function getMotivationalMessage(pct: number): string {
  if (pct >= 100) return "Goal crushed! 🎉 Amazing work today!";
  if (pct >= 80) return "Almost there! Keep pushing!";
  if (pct >= 60) return "Great progress! You've got this!";
  if (pct >= 40) return "Halfway there! Stay focused!";
  if (pct >= 20) return "Good start! Keep the momentum!";
  return "Every ride gets you closer!";
}

function SvgRing({ pct }: { pct: number }) {
  const spring = useSpring(0, { stiffness: 80, damping: 20, mass: 1 });
  const dashoffset = useTransform(spring, (v) => CIRCUMFERENCE * (1 - v / 100));
  const ringColor = getRingColor(pct);

  useEffect(() => {
    spring.set(Math.min(100, pct));
  }, [spring, pct]);

  return (
    <div style={{ position: "relative", width: RING_SIZE, height: RING_SIZE, flexShrink: 0 }}>
      <svg width={RING_SIZE} height={RING_SIZE} style={{ transform: "rotate(-90deg)" }}>
        {/* Track */}
        <circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke="rgba(var(--border),0.3)"
          strokeWidth={STROKE_WIDTH}
        />
        {/* Progress arc */}
        <motion.circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke={ringColor}
          strokeWidth={STROKE_WIDTH}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          style={{ strokeDashoffset: dashoffset }}
        />
      </svg>
      {/* Center label */}
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: 18, fontWeight: 800, color: ringColor, lineHeight: 1 }}>
          {Math.min(100, Math.round(pct))}%
        </span>
        {pct >= 100 && <CheckCircle2 size={12} color={ringColor} style={{ marginTop: 2 }} />}
      </div>
    </div>
  );
}

/* ─── Goal edit form ─────────────────────────────────────────────────────── */

function GoalEditForm({ currency, adminGoal, onCancel, onSaved }: { currency: string; adminGoal: number; onCancel: () => void; onSaved: () => Promise<void> }) {
  const [input, setInput] = useState(String(adminGoal));
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    const val = parseFloat(input);
    if (!val || val <= 0) { toast({ title: "Enter a valid goal amount", variant: "destructive" }); return; }
    setSaving(true);
    try {
      await api.setDailyGoal(val);
      await onSaved();
      toast({ title: "Daily goal updated!" });
    } catch {
      toast({ title: "Failed to save goal", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full rounded-2xl border border-border/60 bg-card px-4 py-4"
    >
      <div className="mb-3 flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
          <Target size={13} className="text-brand" />
          Set Daily Goal
        </p>
        <button onClick={onCancel} className="flex h-6 w-6 items-center justify-center rounded-lg text-muted-foreground transition-colors active:bg-muted/20" aria-label="Cancel">
          <X size={13} />
        </button>
      </div>
      <div className="flex gap-2">
        <div className="flex flex-1 items-center rounded-xl border border-border bg-muted/10 px-3 py-2.5 focus-within:border-brand/50 transition-colors">
          <span className="mr-1.5 text-xs font-bold text-muted-foreground">{currency}</span>
          <input
            type="number" min="1" step="100"
            value={input}
            onChange={(e) => setInput(e.target.value)}
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
    </motion.div>
  );
}

/* ─── Main component ─────────────────────────────────────────────────────── */

export function GoalSection({
  adminGoal, personalGoal, todayEarnings, currency, T, refreshUser,
}: GoalSectionProps) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <GoalEditForm
        currency={currency}
        adminGoal={personalGoal ?? adminGoal}
        onCancel={() => setEditing(false)}
        onSaved={async () => { await refreshUser(); setEditing(false); }}
      />
    );
  }

  if (!personalGoal) {
    return (
      <motion.button
        whileTap={{ scale: 0.98 }}
        type="button"
        aria-label="Set a daily earnings goal"
        onClick={() => setEditing(true)}
        className="flex w-full items-center gap-3 rounded-2xl border border-dashed border-border/60 bg-muted/5 px-4 py-3.5 text-left transition-all active:bg-muted/10"
      >
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border border-border/60 bg-card">
          <Target size={15} className="text-muted-foreground" />
        </div>
        <div className="flex-1">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{T("dailyGoal")}</p>
          <p className="mt-0.5 text-xs font-semibold text-muted-foreground">Tap to set a daily earnings target</p>
        </div>
        <span className="rounded-xl bg-brand px-3 py-1.5 text-[10px] font-black text-black shadow-sm">Set Goal</span>
      </motion.button>
    );
  }

  const todayPct = personalGoal > 0 ? Math.min(100, Math.round((todayEarnings / personalGoal) * 100)) : 0;
  const reached = todayPct >= 100;
  const ringColor = getRingColor(todayPct);
  const message = getMotivationalMessage(todayPct);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="w-full rounded-2xl border border-border/60 bg-card px-4 py-4"
    >
      {/* Header row */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {reached ? <CheckCircle2 size={15} className="text-success" /> : <Target size={14} className="text-brand" />}
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{T("dailyGoal")}</p>
          <span className="rounded-full border border-border/60 bg-muted/10 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-muted-foreground">{T("myGoalBadge")}</span>
        </div>
        <button
          onClick={() => setEditing(true)}
          className="rounded-lg border border-border/60 bg-muted/10 px-2.5 py-1 text-[10px] font-bold text-muted-foreground transition-colors active:bg-muted/20"
        >
          Edit
        </button>
      </div>

      {/* Ring + info row */}
      <div className="flex items-center gap-4">
        <SvgRing pct={todayPct} />

        <div className="flex-1 min-w-0">
          {/* Amounts */}
          <p className="text-xl font-black leading-none" style={{ color: ringColor }}>
            {formatCurrency(todayEarnings, currency)}
          </p>
          <p className="mt-1 text-xs font-medium text-muted-foreground">
            of {formatCurrency(personalGoal, currency)} goal
          </p>

          {/* Motivational message */}
          <p className="mt-2 text-[11px] font-semibold leading-relaxed" style={{ color: ringColor, opacity: 0.85 }}>
            {message}
          </p>

          {/* Color threshold key */}
          <div className="mt-2 flex items-center gap-2">
            {reached
              ? <span className="rounded-full bg-success/15 px-2 py-0.5 text-[9px] font-extrabold text-success">GOAL REACHED 🎉</span>
              : (
                <span className="rounded-full px-2 py-0.5 text-[9px] font-extrabold" style={{ background: `${ringColor}15`, color: ringColor }}>
                  {todayPct}% complete
                </span>
              )
            }
          </div>
        </div>
      </div>
    </motion.div>
  );
}
