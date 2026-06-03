import { Bell, Volume2, VolumeX, Wallet, ChevronRight, Circle } from "lucide-react";
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

export function HomeHeaderV4MaterialSlate({
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
      className="relative overflow-hidden"
      style={{
        paddingTop: "calc(env(safe-area-inset-top, 0px) + 3.5rem)",
        background: "#1e2130",
        borderBottom: "1px solid #2a2d3d",
      }}
    >
      <div className="px-4 pb-5 sm:px-6">
        {/* ── Top row ── */}
        <div className="relative mb-4 flex items-center justify-between">
          {/* Brand — text only, minimal */}
          <div className="flex items-center gap-2">
            <div
              className="flex h-7 w-7 items-center justify-center rounded-lg"
              style={{ background: "#2e3249" }}
            >
              <span className="text-[11px] font-black" style={{ color: "#7c8bff" }}>A</span>
            </div>
            <p
              className="text-[10px] font-bold tracking-[0.18em] uppercase"
              style={{ color: "#5a607a" }}
            >
              AJKMart Rider
            </p>
          </div>

          {/* Right actions — very compact */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={onToggleSilence}
              aria-label={silenceOn ? "Unmute" : "Mute"}
              className="flex h-8 w-8 items-center justify-center rounded-lg transition-all active:scale-95"
              style={{
                background: silenceOn ? "rgba(239,68,68,0.12)" : "#252838",
              }}
            >
              {silenceOn ? (
                <VolumeX size={13} style={{ color: "#f87171" }} />
              ) : (
                <Volume2 size={13} style={{ color: "#5a607a" }} />
              )}
            </button>

            <Link
              href="/notifications"
              className="relative flex h-8 w-8 items-center justify-center rounded-lg transition-all active:scale-95"
              style={{ background: "#252838" }}
              aria-label={hasUnread ? `${unreadNotifications} notifications` : "Notifications"}
            >
              <Bell size={14} style={{ color: hasUnread ? "#c5caff" : "#5a607a" }} />
              {hasUnread && (
                <span
                  className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-0.5 text-[9px] font-extrabold leading-none"
                  style={{ background: "#7c8bff", color: "#fff" }}
                >
                  {unreadNotifications > 9 ? "9+" : unreadNotifications}
                </span>
              )}
            </Link>

            <Link
              href="/profile"
              className="relative flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg overflow-hidden transition-all active:scale-95"
              style={{ background: "#2e3249", border: "1.5px solid #3a3f58" }}
              aria-label="Profile"
            >
              {user?.avatar ? (
                <img src={user.avatar} alt={user?.name ?? "Rider"} className="h-full w-full object-cover" />
              ) : (
                <span className="text-[10px] font-extrabold" style={{ color: "#7c8bff" }}>{initials}</span>
              )}
            </Link>
          </div>
        </div>

        {/* ── Name + tier ── */}
        <div className="mb-4">
          <p className="text-[10px] font-medium" style={{ color: "#5a607a" }}>
            {greeting}
          </p>
          <div className="mt-1 flex items-center gap-2.5">
            <h1
              className="text-2xl font-black tracking-tight sm:text-3xl"
              style={{
                color: newFlash ? "#6ee7b7" : "#e2e4f0",
                transition: "color 0.25s ease",
              }}
            >
              {firstName}
            </h1>
            {tier.label !== "Standard" && (
              <span
                className="rounded-md px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider"
                style={{ background: "#2e3249", color: "#7c8bff" }}
              >
                {tier.label}
              </span>
            )}
          </div>
          <div className="mt-1 flex items-center gap-2">
            <p className="font-mono text-[10px]" style={{ color: "#3d4259" }}>
              <LiveClock />
            </p>
            <span style={{ color: "#2a2d3d" }}>·</span>
            <p className="text-[10px]" style={{ color: "#3d4259" }}>
              {lastSeenLabel}
            </p>
          </div>
          {newFlash && (
            <div
              className="mt-2 flex items-center gap-2 rounded-lg px-2.5 py-1.5"
              style={{ background: "rgba(110,231,183,0.08)", border: "1px solid rgba(110,231,183,0.15)" }}
            >
              <Circle size={6} className="fill-emerald-400 text-emerald-400" />
              <span className="text-[10px] font-semibold" style={{ color: "#6ee7b7" }}>
                New request available
              </span>
            </div>
          )}
        </div>

        {/* ── Cards — flat matte, no gloss ── */}
        <div className="grid grid-cols-2 gap-2.5">
          {/* Wallet */}
          <Link
            href="/wallet"
            className="group flex flex-col gap-2 rounded-xl p-3.5 transition-all active:scale-[0.97]"
            style={{ background: "#252838", border: "1px solid #2e3249" }}
            aria-label="View wallet"
          >
            <div className="flex items-center justify-between">
              <div
                className="flex h-6 w-6 items-center justify-center rounded-md"
                style={{ background: "rgba(110,231,183,0.12)" }}
              >
                <Wallet size={11} style={{ color: "#6ee7b7" }} />
              </div>
              <ChevronRight size={11} className="transition-transform group-active:translate-x-0.5" style={{ color: "#3d4259" }} />
            </div>
            <div>
              <p className="text-[8px] font-bold uppercase tracking-widest" style={{ color: "#5a607a" }}>
                {T("wallet")}
              </p>
              <p className="mt-0.5 text-base font-extrabold leading-none" style={{ color: "#e2e4f0" }}>
                {formatCurrency(user?.walletBalance ?? "0", currency)}
              </p>
            </div>
          </Link>

          {/* Online toggle */}
          <button
            onClick={onToggleOnline}
            disabled={toggling}
            className="flex flex-col gap-2 rounded-xl p-3.5 text-left transition-all active:scale-[0.97] disabled:opacity-50"
            style={{
              background: effectiveOnline ? "rgba(110,231,183,0.07)" : "#252838",
              border: effectiveOnline ? "1px solid rgba(110,231,183,0.18)" : "1px solid #2e3249",
            }}
            role="switch"
            aria-checked={effectiveOnline}
            aria-label={effectiveOnline ? "Go offline" : "Go online"}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span
                  className={`h-1.5 w-1.5 rounded-full ${effectiveOnline ? "animate-pulse" : ""}`}
                  style={{ background: effectiveOnline ? "#6ee7b7" : "#3d4259" }}
                />
                <p
                  className="text-[8px] font-bold uppercase tracking-widest"
                  style={{ color: effectiveOnline ? "#6ee7b7" : "#5a607a" }}
                >
                  {effectiveOnline ? T("online") : T("offline")}
                </p>
              </div>
              {/* Toggle */}
              <div
                className="relative h-4 w-8 flex-shrink-0 rounded-full transition-colors duration-200"
                style={{ background: effectiveOnline ? "rgba(110,231,183,0.3)" : "#2e3249" }}
              >
                <div
                  className={`absolute top-0.5 h-3 w-3 rounded-full transition-all duration-200`}
                  style={{
                    left: effectiveOnline ? "18px" : "2px",
                    background: effectiveOnline ? "#6ee7b7" : "#5a607a",
                  }}
                />
              </div>
            </div>
            <div>
              <p className="text-sm font-bold leading-tight" style={{ color: "#e2e4f0" }}>
                {effectiveOnline ? T("acceptingOrders") : T("tapToStart")}
              </p>
              <p className="mt-0.5 text-[9px]" style={{ color: "#5a607a" }}>
                {effectiveOnline ? "Tap to pause" : "Tap to activate"}
              </p>
            </div>
          </button>
        </div>
      </div>

      {/* Slim bottom separator */}
      <div
        className="h-px w-full"
        style={{
          background: effectiveOnline
            ? "linear-gradient(90deg, transparent 0%, rgba(110,231,183,0.3) 50%, transparent 100%)"
            : "transparent",
        }}
      />
    </header>
  );
}
