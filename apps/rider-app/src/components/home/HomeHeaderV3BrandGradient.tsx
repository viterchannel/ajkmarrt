import { Bell, Volume2, VolumeX, Wallet, ChevronRight, TrendingUp } from "lucide-react";
import { Link } from "wouter";
import { LiveClock, formatCurrency } from "../dashboard";
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

export function HomeHeaderV3BrandGradient({
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

  return (
    <header
      className="relative overflow-hidden rounded-b-[2.5rem]"
      style={{
        paddingTop: "calc(env(safe-area-inset-top, 0px) + 3.5rem)",
        background: "linear-gradient(160deg, #f59e0b 0%, #d97706 25%, #b45309 55%, #1c1917 100%)",
      }}
    >
      {/* Wave shape at bottom */}
      <svg
        className="absolute bottom-0 left-0 right-0 w-full"
        viewBox="0 0 400 60"
        preserveAspectRatio="none"
        style={{ height: 60, opacity: 0.15 }}
      >
        <path
          d="M0,30 C80,60 160,0 240,30 C320,60 360,15 400,30 L400,60 L0,60 Z"
          fill="rgba(0,0,0,0.4)"
        />
      </svg>

      {/* Radial shimmer */}
      <div
        className="pointer-events-none absolute -top-20 -right-20 h-72 w-72 rounded-full opacity-25"
        style={{
          background: "radial-gradient(circle, rgba(255,255,255,0.8) 0%, transparent 65%)",
          filter: "blur(30px)",
        }}
      />

      <div className="px-4 pb-8 sm:px-6">
        {/* ── Top row ── */}
        <div className="relative mb-5 flex items-center justify-between">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-2xl shadow-md"
              style={{ background: "rgba(0,0,0,0.25)", backdropFilter: "blur(8px)" }}
            >
              <span className="text-[15px] font-black text-amber-300">A</span>
            </div>
            <div>
              <p className="text-[11px] font-black tracking-widest text-white uppercase leading-none">
                AJKMart
              </p>
              <p className="mt-0.5 text-[9px] font-semibold tracking-wider text-amber-200/60 leading-none">
                Rider Partner
              </p>
            </div>
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={onToggleSilence}
              aria-label={silenceOn ? "Unmute" : "Mute"}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/20 bg-black/20 transition-all active:scale-95"
              style={{ backdropFilter: "blur(8px)" }}
            >
              {silenceOn ? (
                <VolumeX size={14} className="text-red-300" />
              ) : (
                <Volume2 size={14} className="text-white/70" />
              )}
            </button>

            <Link
              href="/notifications"
              className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-white/20 bg-black/20 transition-all active:scale-95"
              style={{ backdropFilter: "blur(8px)" }}
              aria-label={hasUnread ? `${unreadNotifications} notifications` : "Notifications"}
            >
              <Bell size={15} className={hasUnread ? "text-white" : "text-white/60"} />
              {hasUnread && (
                <span className="absolute -top-1 -right-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-white px-0.5 text-[10px] font-extrabold text-amber-700 leading-none shadow-sm">
                  {unreadNotifications > 9 ? "9+" : unreadNotifications}
                </span>
              )}
            </Link>

            <Link
              href="/profile"
              className="relative flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border-2 border-white/30 bg-black/20 overflow-hidden transition-all active:scale-95"
              style={{ backdropFilter: "blur(8px)" }}
              aria-label="Profile"
            >
              {user?.avatar ? (
                <img src={user.avatar} alt={user?.name ?? "Rider"} className="h-full w-full object-cover" />
              ) : (
                <span className="text-[11px] font-extrabold text-amber-200">{initials}</span>
              )}
            </Link>
          </div>
        </div>

        {/* ── Greeting + earnings metric ── */}
        <div className="relative mb-5">
          <p className="text-xs font-semibold tracking-wider text-amber-200/60 uppercase">
            {greeting}
          </p>
          <div className="mt-1 flex items-end justify-between">
            <h1
              className="text-3xl font-black tracking-tight text-white drop-shadow-md sm:text-4xl"
              style={{
                textShadow: newFlash
                  ? "0 0 24px rgba(255,255,255,0.9)"
                  : "0 2px 8px rgba(0,0,0,0.3)",
                transition: "text-shadow 0.3s ease",
              }}
            >
              {firstName}
            </h1>

            {/* Embedded metric */}
            <div
              className="flex flex-col items-end rounded-xl px-3 py-2"
              style={{ background: "rgba(0,0,0,0.2)", backdropFilter: "blur(8px)" }}
            >
              <div className="flex items-center gap-1">
                <TrendingUp size={10} className="text-amber-300" />
                <p className="text-[9px] font-bold uppercase tracking-wider text-amber-200/60">Today</p>
              </div>
              <p className="mt-0.5 font-mono text-base font-extrabold leading-none text-white">
                {formatCurrency(todayEarnings, currency)}
              </p>
            </div>
          </div>

          <div className="mt-1 flex items-center gap-3">
            <p className="font-mono text-[10px] text-amber-200/40">
              <LiveClock />
            </p>
            {tier.label !== "Standard" && (
              <span className="rounded-full border border-amber-200/30 bg-black/20 px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-200">
                {tier.label}
              </span>
            )}
          </div>

          {newFlash && (
            <div
              className="mt-2.5 flex items-center gap-2 rounded-xl px-3 py-2"
              style={{ background: "rgba(255,255,255,0.15)", backdropFilter: "blur(8px)" }}
            >
              <span className="h-2 w-2 animate-pulse rounded-full bg-white shadow-[0_0_8px_white]" />
              <span className="text-xs font-bold text-white">New request available!</span>
            </div>
          )}
        </div>

        {/* ── Action cards fading into context metrics ── */}
        <div className="relative grid grid-cols-2 gap-3">
          {/* Wallet */}
          <Link
            href="/wallet"
            className="group flex flex-col gap-2 rounded-2xl p-4 transition-all active:scale-[0.97]"
            style={{
              background: "rgba(0,0,0,0.22)",
              border: "1px solid rgba(255,255,255,0.12)",
              backdropFilter: "blur(12px)",
            }}
            aria-label="View wallet"
          >
            <div className="flex items-center justify-between">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-400/20">
                <Wallet size={12} className="text-amber-300" />
              </div>
              <ChevronRight size={11} className="text-white/30 transition-transform group-active:translate-x-0.5" />
            </div>
            <div>
              <p className="text-[9px] font-bold uppercase tracking-widest text-white/40">
                {T("wallet")}
              </p>
              <p className="mt-0.5 text-lg font-extrabold leading-none text-white">
                {formatCurrency(user?.walletBalance ?? "0", currency)}
              </p>
            </div>
          </Link>

          {/* Online toggle */}
          <button
            onClick={onToggleOnline}
            disabled={toggling}
            className="flex flex-col gap-2 rounded-2xl p-4 text-left transition-all active:scale-[0.97] disabled:opacity-50"
            style={{
              background: effectiveOnline
                ? "rgba(34,197,94,0.2)"
                : "rgba(0,0,0,0.22)",
              border: effectiveOnline
                ? "1px solid rgba(34,197,94,0.4)"
                : "1px solid rgba(255,255,255,0.12)",
              backdropFilter: "blur(12px)",
            }}
            role="switch"
            aria-checked={effectiveOnline}
            aria-label={effectiveOnline ? "Go offline" : "Go online"}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span
                  className={`h-2 w-2 rounded-full ${effectiveOnline ? "animate-pulse bg-green-400 shadow-[0_0_8px_rgba(34,197,94,0.9)]" : "bg-white/20"}`}
                />
                <p className={`text-[9px] font-bold uppercase tracking-widest ${effectiveOnline ? "text-green-300" : "text-white/40"}`}>
                  {effectiveOnline ? T("online") : T("offline")}
                </p>
              </div>
              <div className={`relative h-5 w-9 flex-shrink-0 rounded-full transition-colors duration-200 ${effectiveOnline ? "bg-green-500" : "bg-white/10"}`}>
                <div className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-all duration-200 ${effectiveOnline ? "left-[18px]" : "left-0.5"}`} />
              </div>
            </div>
            <div>
              <p className="text-sm font-extrabold leading-tight text-white">
                {effectiveOnline ? T("acceptingOrders") : T("tapToStart")}
              </p>
              <p className="mt-0.5 text-[10px] text-white/40">
                {effectiveOnline ? "Tap to go offline" : "Tap to go online"}
              </p>
            </div>
          </button>
        </div>

        {/* Last online footer */}
        <p className="mt-4 text-center text-[9px] text-white/20">
          Last online · {lastSeenLabel}
        </p>
      </div>
    </header>
  );
}
