import { Bell, ChevronRight, Volume2, VolumeX, Wallet, Zap } from "lucide-react";
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

export function HomeHeaderV1Glassmorphism({
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

  return (
    <header
      className="relative overflow-hidden rounded-b-[2.5rem]"
      style={{
        paddingTop: "calc(env(safe-area-inset-top, 0px) + 3.5rem)",
        background:
          "linear-gradient(135deg, #0f0c29 0%, #302b63 45%, #24243e 100%)",
      }}
    >
      {/* Ambient glow orbs */}
      <div
        className="pointer-events-none absolute -top-24 -right-24 h-80 w-80 rounded-full opacity-30"
        style={{
          background:
            "radial-gradient(circle, rgba(139,92,246,0.8) 0%, transparent 70%)",
          filter: "blur(40px)",
        }}
      />
      <div
        className="pointer-events-none absolute -bottom-16 -left-16 h-64 w-64 rounded-full opacity-20"
        style={{
          background:
            "radial-gradient(circle, rgba(59,130,246,0.8) 0%, transparent 70%)",
          filter: "blur(30px)",
        }}
      />
      {effectiveOnline && (
        <div
          className="pointer-events-none absolute top-1/2 left-1/2 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full opacity-10"
          style={{
            background:
              "radial-gradient(circle, rgba(34,197,94,0.9) 0%, transparent 65%)",
            filter: "blur(60px)",
          }}
        />
      )}

      {/* Glass layer */}
      <div
        className="px-4 pb-6 sm:px-6"
        style={{ backdropFilter: "blur(0px)" }}
      >
        {/* ── Top row ── */}
        <div className="relative mb-5 flex items-center justify-between">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-2xl border border-white/20 shadow-lg"
              style={{
                background:
                  "linear-gradient(135deg, rgba(139,92,246,0.6), rgba(59,130,246,0.4))",
                backdropFilter: "blur(10px)",
              }}
            >
              <span className="text-[14px] font-black text-white">A</span>
            </div>
            <div>
              <p className="text-[11px] font-black tracking-widest text-white/90 uppercase leading-none">
                AJKMart
              </p>
              <p className="mt-0.5 text-[9px] font-semibold tracking-wider text-white/40 leading-none">
                Rider Dashboard
              </p>
            </div>
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={onToggleSilence}
              aria-label={silenceOn ? "Unmute" : "Mute"}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 transition-all active:scale-95"
              style={{
                background: silenceOn
                  ? "rgba(239,68,68,0.2)"
                  : "rgba(255,255,255,0.08)",
                backdropFilter: "blur(10px)",
              }}
            >
              {silenceOn ? (
                <VolumeX size={14} className="text-red-400" />
              ) : (
                <Volume2 size={14} className="text-white/60" />
              )}
            </button>

            <Link
              href="/notifications"
              className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 transition-all active:scale-95"
              style={{
                background: "rgba(255,255,255,0.08)",
                backdropFilter: "blur(10px)",
              }}
              aria-label={hasUnread ? `${unreadNotifications} notifications` : "Notifications"}
            >
              <Bell size={15} className={hasUnread ? "text-white" : "text-white/50"} />
              {hasUnread && (
                <span className="absolute -top-1 -right-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-violet-500 px-0.5 text-[10px] font-extrabold text-white leading-none shadow-sm shadow-violet-500/50">
                  {unreadNotifications > 9 ? "9+" : unreadNotifications}
                </span>
              )}
            </Link>

            <Link
              href="/profile"
              className="relative flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border-2 border-white/20 overflow-hidden transition-all active:scale-95"
              style={{
                background: "rgba(255,255,255,0.1)",
                backdropFilter: "blur(10px)",
              }}
              aria-label="Profile"
            >
              {user?.avatar ? (
                <img src={user.avatar} alt={user?.name ?? "Rider"} className="h-full w-full object-cover" />
              ) : (
                <span className="text-[11px] font-extrabold text-white/80">{initials}</span>
              )}
            </Link>
          </div>
        </div>

        {/* ── Greeting ── */}
        <div className="relative mb-5 flex items-end justify-between">
          <div>
            <p className="text-xs font-semibold tracking-widest text-white/40 uppercase">
              {greeting}
            </p>
            <h1
              className={`mt-1 text-3xl font-black tracking-tight sm:text-4xl transition-all duration-300 ${
                newFlash ? "text-green-400 drop-shadow-[0_0_12px_rgba(34,197,94,0.6)]" : "text-white"
              }`}
            >
              {firstName}
            </h1>
            <p className="mt-0.5 font-mono text-[10px] text-white/30">
              <LiveClock />
            </p>
            {newFlash && (
              <div className="mt-2 flex items-center gap-2">
                <Zap size={12} className="text-green-400" />
                <span className="text-xs font-bold text-green-400 drop-shadow-[0_0_8px_rgba(34,197,94,0.8)]">
                  New request available
                </span>
              </div>
            )}
          </div>
          <div className="flex flex-col items-end gap-1.5">
            {tier.label !== "Standard" && (
              <span
                className="rounded-full border border-violet-400/30 bg-violet-400/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-violet-300"
                style={{ backdropFilter: "blur(8px)" }}
              >
                {tier.label}
              </span>
            )}
            <p className="text-[10px] text-white/30">Last online · {lastSeenLabel}</p>
          </div>
        </div>

        {/* ── Action cards ── */}
        <div className="relative grid grid-cols-2 gap-3">
          {/* Wallet */}
          <Link
            href="/wallet"
            className="group flex flex-col gap-2 rounded-2xl border border-white/10 p-4 transition-all active:scale-[0.97]"
            style={{
              background: "rgba(255,255,255,0.06)",
              backdropFilter: "blur(16px)",
            }}
            aria-label="View wallet"
          >
            <div className="flex items-center justify-between">
              <div
                className="flex h-7 w-7 items-center justify-center rounded-lg"
                style={{ background: "rgba(34,197,94,0.2)" }}
              >
                <Wallet size={13} className="text-green-400" />
              </div>
              <ChevronRight size={12} className="text-white/30 transition-transform group-active:translate-x-0.5" />
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
            className="flex flex-col gap-2 rounded-2xl border p-4 text-left transition-all active:scale-[0.97] disabled:opacity-50"
            style={{
              background: effectiveOnline
                ? "rgba(34,197,94,0.12)"
                : "rgba(255,255,255,0.06)",
              borderColor: effectiveOnline
                ? "rgba(34,197,94,0.3)"
                : "rgba(255,255,255,0.1)",
              backdropFilter: "blur(16px)",
            }}
            role="switch"
            aria-checked={effectiveOnline}
            aria-label={effectiveOnline ? "Go offline" : "Go online"}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span
                  className={`h-2 w-2 rounded-full ${
                    effectiveOnline
                      ? "animate-pulse bg-green-400 shadow-[0_0_8px_rgba(34,197,94,0.8)]"
                      : "bg-white/20"
                  }`}
                />
                <p
                  className={`text-[9px] font-bold uppercase tracking-widest ${
                    effectiveOnline ? "text-green-400" : "text-white/40"
                  }`}
                >
                  {effectiveOnline ? T("online") : T("offline")}
                </p>
              </div>
              <div
                className={`relative h-5 w-9 flex-shrink-0 rounded-full transition-colors duration-200 ${
                  effectiveOnline ? "bg-green-500" : "bg-white/10"
                }`}
              >
                <div
                  className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-all duration-200 ${
                    effectiveOnline ? "left-[18px]" : "left-0.5"
                  }`}
                />
              </div>
            </div>
            <div>
              <p className="text-sm font-extrabold leading-tight text-white">
                {effectiveOnline ? T("acceptingOrders") : T("tapToStart")}
              </p>
              <p className="mt-0.5 text-[10px] text-white/30">
                {effectiveOnline ? "Tap to go offline" : "Tap to go online"}
              </p>
            </div>
          </button>
        </div>
      </div>
    </header>
  );
}
