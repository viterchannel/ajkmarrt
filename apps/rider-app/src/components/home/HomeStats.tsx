import { useEffect, useRef, useState } from "react";
import { motion, useSpring, useTransform } from "framer-motion";
import { tDual, type Language } from "@workspace/i18n";
import { Package, Star, TrendingUp, Zap } from "lucide-react";
import { formatCurrency } from "../dashboard";

interface HomeStatsProps {
  todayEarned: number;
  todayRides: number;
  acceptanceRate: number | null;
  rating: number | null;
  onlineSince: number | null;
  currency: string;
  language: string;
  isOnline: boolean;
  maxDeliveries?: number;
  activeOrderCount?: number;
}

/* ─── Animated counter using Framer Motion spring ────────────────────────── */

function AnimatedCounter({ value, decimals = 0, prefix = "" }: { value: number; decimals?: number; prefix?: string }) {
  const spring = useSpring(0, { stiffness: 120, damping: 20, mass: 0.8 });
  const display = useTransform(spring, (v) => `${prefix}${v.toFixed(decimals)}`);

  useEffect(() => {
    spring.set(value);
  }, [spring, value]);

  return <motion.span>{display}</motion.span>;
}

/* ─── Mini sparkline SVG icon ────────────────────────────────────────────── */

function SparklineUp() {
  return (
    <svg width="28" height="14" viewBox="0 0 28 14" fill="none">
      <polyline points="0,12 6,8 12,9 18,4 22,6 28,1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

function SparklineFlat() {
  return (
    <svg width="28" height="14" viewBox="0 0 28 14" fill="none">
      <polyline points="0,7 6,8 12,6 18,7 22,5 28,7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

function SparklineStar() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
      <path d="M7 1l1.5 3.5H12L9.5 7l1 3.5L7 9l-3.5 1.5 1-3.5L2 4.5h3.5L7 1z" opacity="0.8" />
    </svg>
  );
}

/* ─── Individual stat card ────────────────────────────────────────────────── */

interface StatCardProps {
  gradient: string;
  borderColor: string;
  iconBg: string;
  icon: React.ReactNode;
  sparklineColor: string;
  sparkline: React.ReactNode;
  value: React.ReactNode;
  label: string;
  delay?: number;
}

function StatCard({ gradient, borderColor, iconBg, icon, sparklineColor, sparkline, value, label, delay = 0 }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35, ease: "easeOut" }}
      style={{
        background: gradient,
        borderRadius: 20,
        border: `1px solid ${borderColor}`,
        padding: "16px 14px",
        display: "flex",
        flexDirection: "column" as const,
        gap: 8,
        position: "relative" as const,
        overflow: "hidden",
      }}
      role="listitem"
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ width: 34, height: 34, borderRadius: 10, background: iconBg, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {icon}
        </div>
        <div style={{ color: sparklineColor, opacity: 0.6 }}>{sparkline}</div>
      </div>
      <div>
        <p className="text-lg font-black leading-none text-foreground">{value}</p>
        <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      </div>
    </motion.div>
  );
}

/* ─── Main component ─────────────────────────────────────────────────────── */

export function HomeStats({
  todayEarned,
  todayRides,
  acceptanceRate,
  rating,
  currency,
  language,
  isOnline,
  maxDeliveries,
  activeOrderCount = 0,
}: HomeStatsProps) {
  const T = (key: Parameters<typeof tDual>[0]) => tDual(key, language as Language);
  const hasRides = todayRides > 0;

  const ratingColor =
    !hasRides || rating == null || rating === 0
      ? "var(--color-muted-foreground)"
      : rating >= 4.5 ? "#FACC15"
      : rating >= 3.5 ? "#F59E0B"
      : "#EF4444";

  const acceptColor =
    !hasRides || acceptanceRate == null
      ? "var(--color-muted-foreground)"
      : acceptanceRate >= 80 ? "var(--color-success)"
      : acceptanceRate >= 60 ? "#F59E0B"
      : "#EF4444";

  return (
    <div className="space-y-2.5">
      <p className="px-0.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        Today's Performance
      </p>

      {/* 3-column stats grid */}
      <div
        role="list"
        aria-label="Rider statistics"
        style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}
      >
        {/* Earnings */}
        <StatCard
          gradient={
            todayEarned > 0
              ? "linear-gradient(145deg, rgba(74,222,128,0.09) 0%, rgba(16,185,129,0.04) 100%)"
              : "var(--color-card)"
          }
          borderColor={todayEarned > 0 ? "rgba(74,222,128,0.2)" : "rgba(var(--border),0.6)"}
          iconBg="rgba(74,222,128,0.12)"
          icon={<TrendingUp size={15} className="text-success" />}
          sparklineColor="var(--color-success)"
          sparkline={<SparklineUp />}
          delay={0}
          value={
            <span className={todayEarned > 0 ? "text-success" : "text-foreground"}>
              {formatCurrency(todayEarned, currency)}
            </span>
          }
          label={T("earnedToday")}
        />

        {/* Rides done */}
        <StatCard
          gradient="linear-gradient(145deg, rgba(99,102,241,0.08) 0%, rgba(79,70,229,0.03) 100%)"
          borderColor="rgba(99,102,241,0.18)"
          iconBg="rgba(99,102,241,0.12)"
          icon={<Package size={15} className="text-indigo-400" />}
          sparklineColor="#818CF8"
          sparkline={<SparklineFlat />}
          delay={0.06}
          value={<span className="text-foreground"><AnimatedCounter value={todayRides} /></span>}
          label={T("ridesDone")}
        />

        {/* Acceptance rate OR rating (first shows acceptance when rides > 0, else rating) */}
        {hasRides ? (
          <StatCard
            gradient={
              acceptanceRate != null && acceptanceRate >= 80
                ? "linear-gradient(145deg, rgba(74,222,128,0.07) 0%, rgba(16,185,129,0.03) 100%)"
                : "var(--color-card)"
            }
            borderColor={acceptanceRate != null && acceptanceRate >= 80 ? "rgba(74,222,128,0.15)" : "rgba(var(--border),0.6)"}
            iconBg={acceptanceRate != null && acceptanceRate >= 80 ? "rgba(74,222,128,0.12)" : "rgba(var(--muted),0.2)"}
            icon={<span className="text-sm font-black" style={{ color: acceptColor }}>%</span>}
            sparklineColor={acceptColor}
            sparkline={<SparklineFlat />}
            delay={0.12}
            value={
              <span style={{ color: acceptColor }}>
                {acceptanceRate != null ? <><AnimatedCounter value={Math.round(acceptanceRate)} />%</> : "—"}
              </span>
            }
            label="Acceptance"
          />
        ) : (
          <StatCard
            gradient={
              rating != null && rating >= 4.5
                ? "linear-gradient(145deg, rgba(250,204,21,0.08) 0%, rgba(234,179,8,0.03) 100%)"
                : "var(--color-card)"
            }
            borderColor={rating != null && rating >= 4.5 ? "rgba(250,204,21,0.18)" : "rgba(var(--border),0.6)"}
            iconBg={rating != null && rating >= 4.5 ? "rgba(250,204,21,0.12)" : "rgba(var(--muted),0.2)"}
            icon={<Star size={14} style={{ color: ratingColor }} />}
            sparklineColor={ratingColor}
            sparkline={<SparklineStar />}
            delay={0.12}
            value={
              <span style={{ color: ratingColor }}>
                {rating != null && rating > 0 ? <><AnimatedCounter value={rating} decimals={1} /></> : "—"}
              </span>
            }
            label="Rating"
          />
        )}
      </div>

      {/* Rating row (when rides done — show below acceptance) */}
      {hasRides && (
        <StatCard
          gradient={
            rating != null && rating >= 4.5
              ? "linear-gradient(145deg, rgba(250,204,21,0.08) 0%, rgba(234,179,8,0.03) 100%)"
              : "var(--color-card)"
          }
          borderColor={rating != null && rating >= 4.5 ? "rgba(250,204,21,0.18)" : "rgba(var(--border),0.6)"}
          iconBg={rating != null && rating >= 4.5 ? "rgba(250,204,21,0.12)" : "rgba(var(--muted),0.2)"}
          icon={<Star size={14} style={{ color: ratingColor }} />}
          sparklineColor={ratingColor}
          sparkline={<SparklineStar />}
          delay={0.18}
          value={
            <span style={{ color: ratingColor }}>
              {rating != null && rating > 0 ? <><AnimatedCounter value={rating} decimals={1} /> ★</> : "—"}
            </span>
          }
          label="Rating"
        />
      )}

      {/* No rides yet: placeholder */}
      {!hasRides && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="rounded-2xl border border-border/40 bg-muted/5 px-4 py-3 text-center"
          role="listitem"
        >
          <p className="text-[11px] font-medium text-muted-foreground">
            Acceptance rate &amp; rating will appear after your first ride today
          </p>
        </motion.div>
      )}

      {/* Active orders capacity */}
      {isOnline && maxDeliveries != null && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.24 }}
          className={`flex items-center gap-3 rounded-2xl border p-3.5 ${
            activeOrderCount >= maxDeliveries
              ? "border-warning/25 bg-warning/[0.07]"
              : "border-border/50 bg-muted/5"
          }`}
        >
          <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl ${
            activeOrderCount >= maxDeliveries ? "bg-warning/15" : "bg-muted/20"
          }`}>
            <Zap size={14} className={activeOrderCount >= maxDeliveries ? "text-warning" : "text-muted-foreground"} />
          </div>
          <p className="flex-1 text-xs font-medium text-muted-foreground">Active orders</p>
          <div className="flex items-center gap-1">
            <span className={`text-sm font-extrabold ${activeOrderCount >= maxDeliveries ? "text-warning" : "text-foreground"}`}>
              <AnimatedCounter value={activeOrderCount} />
            </span>
            <span className="text-xs text-muted-foreground">/ {maxDeliveries}</span>
          </div>
        </motion.div>
      )}
    </div>
  );
}
