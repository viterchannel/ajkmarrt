import { Bell, Volume2, VolumeX, Wallet, MapPin, Star, Package, Clock } from "lucide-react";
import { Link } from "wouter";
import { formatCurrency } from "../dashboard";
import type { TranslationKey } from "@workspace/i18n";
import type { UseHomeDataReturn } from "./useHomeData";
import { getRiderTier, getInitials } from "./HomeHeader";

interface HomeHeaderProps {
  user: UseHomeDataReturn["user"];
  greeting: string;
  lastSeenLabel: string;
  currency: string;
  T: (key: TranslationKey) => string;
  effectiveOnline: boolean;
  toggling: boolean;
  silenceOn: boolean;
  onToggleOnline: () => void;
  onToggleSilence: () => void;
  newFlash: boolean;
  unreadNotifications?: number;
}

/** Compact numeric metric cell */
function MetricCell({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  accent?: string;
}) {
  return (
    <div
      className="flex flex-col justify-between rounded-lg p-2.5"
      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
    >
      <div className="flex items-center gap-1 mb-1">
        <span style={{ color: accent ?? "rgba(255,255,255,0.35)" }}>{icon}</span>
        <p className="font-mono text-[7.5px] font-bold uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.30)" }}>
          {label}
        </p>
      </div>
      <p
        className="font-mono text-sm font-extrabold leading-none"
        style={{ color: accent ?? "#e2e4f0" }}
      >
        {value}
      </p>
    </div>
  );
}

export function HomeHeaderV5TacticalDashboard({
  user,
  greeting,
  lastSeenLabel,
  currency,
  T,
  effectiveOnline,
  toggling,
  silenceOn,
  onToggleOnline,
  onToggleSilence,
  newFlash,
  unreadNotifications = 0,
}: HomeHeaderProps) {
  const tier = getRiderTier(user?.stats?.rating ?? null);
  const firstName = user?.name?.split(" ")[0] || "Rider";
  const initials = getInitials(user?.name);
  const hasUnread = unreadNotifications > 0;

  const todayEarnings = user?.stats?.earningsToday ?? 0;
  const todayRides = user?.stats?.deliveriesToday ?? 0;
  const rating = user?.stats?.rating ?? null;
  const activeOrders = Math.max(0, Number(user?.activeOrderCount ?? 0));

  return (
    <header
      className="relative overflow-hidden"
      style={{
        paddingTop: "calc(env(safe-area-inset-top, 0px) + 3rem)",
        background: "#0d0f1a",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      {/* Top status bar — ultra dense */}
      <div
        className="flex items-center justify-between px-4 py-1.5"
        style={{ background: "rgba(255,255,255,0.02)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}
      >
        {/* Brand mark */}
        <div className="flex items-center gap-1.5">
          <div
            className="flex h-4 w-4 items-center justify-center rounded"
            style={{ background: "linear-gradient(135deg, #7c8bff, #a78bfa)" }}
          >
            <span className="text-[7px] font-black text-white">A</span>
          </div>
          <p className="font-mono text-[8px] font-bold uppercase tracking-[0.2em] text-white/30">
            AJKMart Rider
          </p>
        </div>

        {/* Status indicators */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <span
              className={`h-1.5 w-1.5 rounded-full ${effectiveOnline ? "animate-pulse" : ""}`}
              style={{ background: effectiveOnline ? "#4ade80" : "#374151" }}
            />
            <span className="font-mono text-[8px]" style={{ color: effectiveOnline ? "#4ade80" : "#374151" }}>
              {effectiveOnline ? "ONLINE" : "OFFLINE"}
            </span>
          </div>
          <span className="font-mono text-[8px] text-white/15">|</span>
          <span className="font-mono text-[8px] text-white/25">{lastSeenLabel}</span>
        </div>
      </div>

      <div className="px-4 pb-4 pt-3 sm:px-6">
        {/* ── Identity + actions row ── */}
        <div className="flex items-center gap-3 mb-3">
          {/* Avatar */}
          <div
            className="relative flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl overflow-hidden"
            style={{ border: effectiveOnline ? "1.5px solid rgba(74,222,128,0.4)" : "1.5px solid rgba(255,255,255,0.1)" }}
          >
            {user?.avatar ? (
              <img src={user.avatar} alt={user?.name ?? "Rider"} className="h-full w-full object-cover" />
            ) : (
              <span className="text-[11px] font-extrabold" style={{ color: "#7c8bff", background: "#1a1d2e" }}>
                {initials}
              </span>
            )}
            {effectiveOnline && (
              <span
                className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2"
                style={{ background: "#4ade80", borderColor: "#0d0f1a" }}
              />
            )}
          </div>

          {/* Name + tier */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1
                className="truncate text-lg font-black leading-none"
                style={{ color: newFlash ? "#6ee7b7" : "#e2e4f0", transition: "color 0.25s ease" }}
              >
                {firstName}
              </h1>
              {tier.label !== "Standard" && (
                <span
                  className="flex-shrink-0 rounded px-1.5 py-0.5 font-mono text-[8px] font-bold uppercase tracking-wider"
                  style={{ background: "rgba(124,139,255,0.15)", color: "#7c8bff" }}
                >
                  {tier.label}
                </span>
              )}
            </div>
            <p className="mt-0.5 font-mono text-[9px]" style={{ color: "rgba(255,255,255,0.2)" }}>
              {greeting}
            </p>
          </div>

          {/* Actions cluster */}
          <div className="flex flex-shrink-0 items-center gap-1.5">
            <button
              onClick={onToggleSilence}
              aria-label={silenceOn ? "Unmute" : "Mute"}
              className="flex h-8 w-8 items-center justify-center rounded-lg transition-all active:scale-95"
              style={{ background: silenceOn ? "rgba(239,68,68,0.12)" : "rgba(255,255,255,0.05)" }}
            >
              {silenceOn ? (
                <VolumeX size={12} style={{ color: "#f87171" }} />
              ) : (
                <Volume2 size={12} style={{ color: "rgba(255,255,255,0.35)" }} />
              )}
            </button>
            <Link
              href="/notifications"
              className="relative flex h-8 w-8 items-center justify-center rounded-lg transition-all active:scale-95"
              style={{ background: "rgba(255,255,255,0.05)" }}
              aria-label="Notifications"
            >
              <Bell size={12} style={{ color: hasUnread ? "#c5caff" : "rgba(255,255,255,0.35)" }} />
              {hasUnread && (
                <span
                  className="absolute -top-0.5 -right-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full px-0.5 font-mono text-[7px] font-extrabold leading-none"
                  style={{ background: "#7c8bff", color: "#fff" }}
                >
                  {unreadNotifications > 9 ? "9+" : unreadNotifications}
                </span>
              )}
            </Link>
            <Link
              href="/wallet"
              className="flex h-8 w-8 items-center justify-center rounded-lg transition-all active:scale-95"
              style={{ background: "rgba(255,255,255,0.05)" }}
              aria-label="Wallet"
            >
              <Wallet size={12} style={{ color: "rgba(255,255,255,0.35)" }} />
            </Link>
          </div>
        </div>

        {/* ── Metrics grid ── */}
        <div className="grid grid-cols-4 gap-1.5 mb-3">
          <MetricCell
            icon={<Wallet size={9} />}
            label="Today"
            value={formatCurrency(todayEarnings, currency)}
            accent="#4ade80"
          />
          <MetricCell
            icon={<Package size={9} />}
            label="Rides"
            value={todayRides}
            accent="#7c8bff"
          />
          <MetricCell
            icon={<Star size={9} />}
            label="Rating"
            value={rating ? rating.toFixed(1) : "—"}
            accent="#fbbf24"
          />
          <MetricCell
            icon={<MapPin size={9} />}
            label="Active"
            value={activeOrders}
            accent={activeOrders > 0 ? "#f87171" : undefined}
          />
        </div>

        {/* ── Online toggle — full-width pill ── */}
        <button
          onClick={onToggleOnline}
          disabled={toggling}
          className="relative w-full overflow-hidden rounded-xl p-3.5 text-left transition-all active:scale-[0.99] disabled:opacity-50"
          style={{
            background: effectiveOnline
              ? "linear-gradient(90deg, rgba(74,222,128,0.12) 0%, rgba(74,222,128,0.04) 100%)"
              : "rgba(255,255,255,0.04)",
            border: effectiveOnline
              ? "1px solid rgba(74,222,128,0.25)"
              : "1px solid rgba(255,255,255,0.07)",
          }}
          role="switch"
          aria-checked={effectiveOnline}
          aria-label={effectiveOnline ? "Go offline" : "Go online"}
        >
          {/* Animated sweep on newFlash */}
          {newFlash && (
            <div
              className="pointer-events-none absolute inset-0 animate-[pulse_1.5s_ease-in-out_infinite] rounded-xl"
              style={{ background: "rgba(74,222,128,0.07)" }}
            />
          )}

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* Animated status dot */}
              <div
                className="relative flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg"
                style={{
                  background: effectiveOnline
                    ? "rgba(74,222,128,0.15)"
                    : "rgba(255,255,255,0.06)",
                }}
              >
                <span
                  className={`h-2.5 w-2.5 rounded-full ${effectiveOnline ? "animate-pulse" : ""}`}
                  style={{
                    background: effectiveOnline ? "#4ade80" : "#374151",
                    boxShadow: effectiveOnline ? "0 0 8px rgba(74,222,128,0.7)" : "none",
                  }}
                />
              </div>

              <div>
                <p
                  className="font-mono text-[9px] font-bold uppercase tracking-[0.15em]"
                  style={{ color: effectiveOnline ? "#4ade80" : "rgba(255,255,255,0.25)" }}
                >
                  {effectiveOnline ? "ACCEPTING ORDERS" : "OFFLINE — TAP TO ACTIVATE"}
                </p>
                {effectiveOnline && newFlash && (
                  <div className="mt-0.5 flex items-center gap-1">
                    <Clock size={8} style={{ color: "#fbbf24" }} />
                    <p className="font-mono text-[8px]" style={{ color: "#fbbf24" }}>
                      NEW REQUEST
                    </p>
                  </div>
                )}
                {effectiveOnline && !newFlash && (
                  <p className="mt-0.5 font-mono text-[8px]" style={{ color: "rgba(255,255,255,0.2)" }}>
                    {T("acceptingOrders")}
                  </p>
                )}
              </div>
            </div>

            {/* Compact toggle */}
            <div
              className="relative h-5 w-9 flex-shrink-0 rounded-full transition-colors duration-200"
              style={{
                background: effectiveOnline ? "rgba(74,222,128,0.3)" : "rgba(255,255,255,0.08)",
                border: effectiveOnline ? "1px solid rgba(74,222,128,0.4)" : "1px solid rgba(255,255,255,0.1)",
              }}
            >
              <div
                className="absolute top-0.5 h-4 w-4 rounded-full transition-all duration-200"
                style={{
                  left: effectiveOnline ? "18px" : "2px",
                  background: effectiveOnline ? "#4ade80" : "rgba(255,255,255,0.3)",
                  boxShadow: effectiveOnline ? "0 0 6px rgba(74,222,128,0.8)" : "none",
                }}
              />
            </div>
          </div>
        </button>
      </div>
    </header>
  );
}
