import { Bell, Volume2, VolumeX, Wallet, ChevronRight, Radio } from "lucide-react";
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

export function HomeHeaderV2DarkLogistics({
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
      className="relative overflow-hidden rounded-b-[1.5rem]"
      style={{
        paddingTop: "calc(env(safe-area-inset-top, 0px) + 3.5rem)",
        background: "#09090b",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      {/* Scanline texture overlay */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.5) 2px, rgba(255,255,255,0.5) 3px)",
        }}
      />

      {/* Neon accent line top */}
      <div
        className="absolute top-0 left-0 right-0 h-[2px]"
        style={{
          background: effectiveOnline
            ? "linear-gradient(90deg, transparent 0%, #00ff87 30%, #60efff 70%, transparent 100%)"
            : "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.1) 50%, transparent 100%)",
          boxShadow: effectiveOnline ? "0 0 20px rgba(0,255,135,0.5)" : "none",
        }}
      />

      <div className="px-4 pb-6 sm:px-6">
        {/* ── Top row ── */}
        <div className="relative mb-5 flex items-center justify-between">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-lg"
              style={{
                background: "linear-gradient(135deg, #00ff87, #60efff)",
                boxShadow: "0 0 16px rgba(0,255,135,0.4)",
              }}
            >
              <span className="text-[14px] font-black text-black">A</span>
            </div>
            <div>
              <p className="text-[11px] font-black tracking-[0.2em] text-white uppercase leading-none">
                AJKMART
              </p>
              <div className="mt-1 flex items-center gap-1.5">
                <Radio size={8} className="text-green-400" />
                <p className="text-[9px] font-mono font-semibold tracking-wider text-white/30 leading-none">
                  RIDER NETWORK
                </p>
              </div>
            </div>
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={onToggleSilence}
              aria-label={silenceOn ? "Unmute" : "Mute"}
              className="flex h-9 w-9 items-center justify-center rounded-lg border transition-all active:scale-95"
              style={{
                background: silenceOn ? "rgba(239,68,68,0.1)" : "rgba(255,255,255,0.04)",
                borderColor: silenceOn ? "rgba(239,68,68,0.4)" : "rgba(255,255,255,0.08)",
              }}
            >
              {silenceOn ? (
                <VolumeX size={14} className="text-red-400" />
              ) : (
                <Volume2 size={14} className="text-white/40" />
              )}
            </button>

            <Link
              href="/notifications"
              className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-white/8 transition-all active:scale-95"
              style={{ background: "rgba(255,255,255,0.04)" }}
              aria-label={hasUnread ? `${unreadNotifications} notifications` : "Notifications"}
            >
              <Bell size={15} className={hasUnread ? "text-cyan-400" : "text-white/40"} />
              {hasUnread && (
                <span
                  className="absolute -top-1 -right-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-0.5 text-[10px] font-extrabold text-black leading-none"
                  style={{
                    background: "linear-gradient(135deg, #00ff87, #60efff)",
                    boxShadow: "0 0 8px rgba(0,255,135,0.6)",
                  }}
                >
                  {unreadNotifications > 9 ? "9+" : unreadNotifications}
                </span>
              )}
            </Link>

            <Link
              href="/profile"
              className="relative flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg overflow-hidden transition-all active:scale-95"
              style={{
                border: "1.5px solid rgba(0,255,135,0.3)",
                background: "rgba(0,255,135,0.05)",
              }}
              aria-label="Profile"
            >
              {user?.avatar ? (
                <img src={user.avatar} alt={user?.name ?? "Rider"} className="h-full w-full object-cover" />
              ) : (
                <span className="text-[11px] font-extrabold text-green-400">{initials}</span>
              )}
            </Link>
          </div>
        </div>

        {/* ── Greeting ── */}
        <div className="relative mb-5 flex items-end justify-between">
          <div>
            <p className="font-mono text-[10px] font-semibold tracking-[0.3em] text-white/25 uppercase">
              {greeting}
            </p>
            <h1
              className="mt-1.5 text-3xl font-black tracking-tight sm:text-4xl"
              style={{
                color: newFlash ? "#00ff87" : "#ffffff",
                textShadow: newFlash ? "0 0 20px rgba(0,255,135,0.7)" : "none",
                transition: "all 0.3s ease",
              }}
            >
              {firstName}
            </h1>
            <p className="mt-1 font-mono text-[10px] text-white/20">
              <LiveClock />
            </p>
            {newFlash && (
              <div
                className="mt-2 inline-flex items-center gap-2 rounded-md px-2.5 py-1"
                style={{
                  background: "rgba(0,255,135,0.1)",
                  border: "1px solid rgba(0,255,135,0.3)",
                  boxShadow: "0 0 12px rgba(0,255,135,0.2)",
                }}
              >
                <span className="h-1.5 w-1.5 animate-ping rounded-full bg-green-400" />
                <span className="font-mono text-[10px] font-bold tracking-wider text-green-400">
                  NEW REQUEST INCOMING
                </span>
              </div>
            )}
          </div>
          <div className="flex flex-col items-end gap-1.5">
            {tier.label !== "Standard" && (
              <span
                className="rounded-sm px-2.5 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.15em]"
                style={{
                  background: "rgba(96,239,255,0.1)",
                  border: "1px solid rgba(96,239,255,0.3)",
                  color: "#60efff",
                }}
              >
                {tier.label}
              </span>
            )}
            <p className="font-mono text-[9px] text-white/20">
              LAST SEEN · {lastSeenLabel}
            </p>
          </div>
        </div>

        {/* ── Action cards — HUD style ── */}
        <div className="relative grid grid-cols-2 gap-3">
          {/* Wallet */}
          <Link
            href="/wallet"
            className="group flex flex-col gap-2 rounded-xl p-4 transition-all active:scale-[0.97]"
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.07)",
            }}
            aria-label="View wallet"
          >
            <div className="flex items-center justify-between">
              <div
                className="flex h-7 w-7 items-center justify-center rounded-md"
                style={{ background: "rgba(0,255,135,0.1)", border: "1px solid rgba(0,255,135,0.2)" }}
              >
                <Wallet size={12} className="text-green-400" />
              </div>
              <ChevronRight size={11} className="text-white/20 transition-transform group-active:translate-x-0.5" />
            </div>
            <div>
              <p className="font-mono text-[8px] font-bold uppercase tracking-[0.2em] text-white/25">
                BALANCE
              </p>
              <p className="mt-1 font-mono text-lg font-extrabold leading-none text-white">
                {formatCurrency(user?.walletBalance ?? "0", currency)}
              </p>
            </div>
          </Link>

          {/* Online toggle */}
          <button
            onClick={onToggleOnline}
            disabled={toggling}
            className="flex flex-col gap-2 rounded-xl p-4 text-left transition-all active:scale-[0.97] disabled:opacity-50"
            style={{
              background: effectiveOnline
                ? "rgba(0,255,135,0.07)"
                : "rgba(255,255,255,0.03)",
              border: effectiveOnline
                ? "1px solid rgba(0,255,135,0.25)"
                : "1px solid rgba(255,255,255,0.07)",
              boxShadow: effectiveOnline ? "inset 0 0 30px rgba(0,255,135,0.05)" : "none",
            }}
            role="switch"
            aria-checked={effectiveOnline}
            aria-label={effectiveOnline ? "Go offline" : "Go online"}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span
                  className={`h-2 w-2 rounded-full ${effectiveOnline ? "animate-pulse" : ""}`}
                  style={{
                    background: effectiveOnline ? "#00ff87" : "rgba(255,255,255,0.15)",
                    boxShadow: effectiveOnline ? "0 0 8px rgba(0,255,135,0.8)" : "none",
                  }}
                />
                <p
                  className="font-mono text-[9px] font-bold uppercase tracking-[0.15em]"
                  style={{ color: effectiveOnline ? "#00ff87" : "rgba(255,255,255,0.25)" }}
                >
                  {effectiveOnline ? "ACTIVE" : "STANDBY"}
                </p>
              </div>
              <div
                className="relative h-5 w-9 flex-shrink-0 rounded-sm transition-colors duration-200"
                style={{
                  background: effectiveOnline ? "rgba(0,255,135,0.3)" : "rgba(255,255,255,0.08)",
                  border: effectiveOnline ? "1px solid rgba(0,255,135,0.5)" : "1px solid rgba(255,255,255,0.1)",
                }}
              >
                <div
                  className={`absolute top-0.5 h-4 w-4 rounded-sm bg-white shadow-sm transition-all duration-200 ${
                    effectiveOnline ? "left-[18px]" : "left-0.5"
                  }`}
                  style={{
                    background: effectiveOnline ? "#00ff87" : "rgba(255,255,255,0.4)",
                    boxShadow: effectiveOnline ? "0 0 6px rgba(0,255,135,0.8)" : "none",
                  }}
                />
              </div>
            </div>
            <div>
              <p className="text-sm font-extrabold leading-tight text-white">
                {effectiveOnline ? T("acceptingOrders") : T("tapToStart")}
              </p>
              <p className="mt-0.5 font-mono text-[9px] text-white/25">
                {effectiveOnline ? "// TAP TO STANDBY" : "// TAP TO ACTIVATE"}
              </p>
            </div>
          </button>
        </div>
      </div>
    </header>
  );
}
