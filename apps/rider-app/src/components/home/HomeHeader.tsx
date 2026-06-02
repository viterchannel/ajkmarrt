import { Bell, ChevronRight, Volume2, VolumeX, Wallet } from "lucide-react";
import { Link } from "wouter";
import { LiveClock, formatCurrency } from "../dashboard";
import type { TranslationKey } from "@workspace/i18n";
import type { UseHomeDataReturn } from "./useHomeData";

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

export function getRiderTier(rating: number | null | undefined): { label: string; cls: string } {
  if (!rating || rating === 0) return { label: "Standard", cls: "text-muted-foreground bg-muted/20 border-border" };
  if (rating >= 4.5) return { label: "Gold Partner", cls: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20" };
  if (rating >= 4.0) return { label: "Silver Partner", cls: "text-blue-400 bg-blue-400/10 border-blue-400/20" };
  if (rating >= 3.5) return { label: "Active Rider", cls: "text-success bg-success/10 border-success/20" };
  return { label: "Standard", cls: "text-muted-foreground bg-muted/20 border-border" };
}

export function getInitials(name?: string | null): string {
  if (!name) return "R";
  const parts = name.trim().split(" ").filter(Boolean);
  if (parts.length === 0) return "R";
  if (parts.length === 1) return parts[0]![0]?.toUpperCase() ?? "R";
  return ((parts[0]![0] ?? "") + (parts[parts.length - 1]![0] ?? "")).toUpperCase();
}

export function HomeHeader({
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
      className="page-header-gradient relative overflow-hidden rounded-b-[2rem] bg-card px-4 pb-6 text-foreground sm:px-6"
      style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 3.5rem)" }}
    >
      {/* Decorative background circles */}
      <div className="absolute -top-20 -right-20 h-72 w-72 rounded-full bg-brand/[0.04]" />
      <div className="absolute bottom-10 -left-16 h-56 w-56 rounded-full bg-foreground/[0.02]" />
      <div className="absolute top-1/2 left-1/2 h-32 w-32 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground/[0.015]" />

      {/* ── Branding + actions row ── */}
      <div className="relative mb-5 flex items-center justify-between">
        {/* Brand mark */}
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand shadow-sm shadow-brand/40">
            <span className="text-[13px] font-black text-black">A</span>
          </div>
          <div>
            <p className="text-[11px] font-black tracking-widest text-foreground uppercase leading-none">
              AJKMart
            </p>
            <p className="text-[9px] font-semibold tracking-wider text-muted-foreground leading-none mt-0.5">
              Rider Dashboard
            </p>
          </div>
        </div>

        {/* Right: mute + bell + avatar */}
        <div className="flex items-center gap-2">
          {/* Mute toggle */}
          <button
            onClick={onToggleSilence}
            aria-label={silenceOn ? "Unmute notification sounds" : "Mute notification sounds"}
            className={`flex h-8 w-8 items-center justify-center rounded-xl border transition-all active:scale-95 ${
              silenceOn
                ? "border-error/30 bg-error/10 text-error"
                : "border-border/60 bg-muted/10 text-muted-foreground"
            }`}
          >
            {silenceOn ? <VolumeX size={14} /> : <Volume2 size={14} />}
          </button>

          {/* Notification bell */}
          <Link
            href="/notifications"
            className="relative flex h-8 w-8 items-center justify-center rounded-xl border border-border/60 bg-muted/10 transition-all active:scale-95 active:bg-muted/30"
            aria-label={hasUnread ? `${unreadNotifications} unread notifications` : "Notifications"}
          >
            <Bell size={15} className={hasUnread ? "text-foreground" : "text-muted-foreground"} />
            {hasUnread && (
              <span className="absolute -top-1 -right-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-error px-0.5 text-[10px] font-extrabold text-white leading-none shadow-sm">
                {unreadNotifications > 9 ? "9+" : unreadNotifications}
              </span>
            )}
          </Link>

          {/* Avatar → /profile */}
          <Link
            href="/profile"
            className="relative flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border-2 border-border/40 bg-muted/20 transition-all active:scale-95 active:bg-muted/40 overflow-hidden"
            aria-label="Go to profile"
          >
            {user?.avatar ? (
              <img
                src={user.avatar}
                alt={user?.name ?? "Rider"}
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="text-[11px] font-extrabold text-muted-foreground">{initials}</span>
            )}
          </Link>
        </div>
      </div>

      {/* ── Greeting + tier ── */}
      <div className="relative mb-5 flex items-end justify-between">
        <div>
          <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            {greeting}
          </p>
          <h1
            className={`mt-0.5 text-2xl font-black tracking-tight transition-colors sm:text-3xl ${
              newFlash ? "text-success" : "text-foreground"
            }`}
          >
            {firstName}
          </h1>
          <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
            <LiveClock />
          </p>
          {newFlash && (
            <div className="mt-1.5 flex items-center gap-1.5 text-xs font-bold text-success">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" />
              New request available
            </div>
          )}
        </div>
        <div className="flex flex-col items-end gap-1.5">
          {tier.label !== "Standard" && (
            <span
              className={`rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-wider ${tier.cls}`}
            >
              {tier.label}
            </span>
          )}
          <p className="text-xs text-muted-foreground">
            Last online · {lastSeenLabel}
          </p>
        </div>
      </div>

      {/* ── Wallet + Online toggle ── */}
      <div className="relative grid grid-cols-2 gap-3">
        {/* Wallet card */}
        <Link
          href="/wallet"
          className="group flex flex-col gap-2 rounded-2xl border border-border/60 bg-muted/10 p-4 transition-all active:scale-[0.97] active:bg-muted/20"
          aria-label="View wallet balance"
        >
          <div className="flex items-center justify-between">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-muted/20">
              <Wallet size={13} className="text-success" />
            </div>
            <ChevronRight size={12} className="text-muted-foreground transition-transform group-active:translate-x-0.5" />
          </div>
          <div>
            <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
              {T("wallet")}
            </p>
            <p className="mt-0.5 text-lg font-extrabold leading-none text-foreground">
              {formatCurrency(user?.walletBalance ?? "0", currency)}
            </p>
          </div>
        </Link>

        {/* Online toggle card */}
        <button
          onClick={onToggleOnline}
          disabled={toggling}
          className={`flex flex-col gap-2 rounded-2xl border p-4 text-left transition-all active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60 ${
            effectiveOnline
              ? "border-success/30 bg-success/[0.08] shadow-sm shadow-success/10"
              : "border-border/60 bg-muted/10"
          }`}
          role="switch"
          aria-checked={effectiveOnline}
          aria-label={effectiveOnline ? "Go offline" : "Go online"}
        >
          {/* Toggle pill + indicator */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span
                className={`h-2 w-2 rounded-full ${
                  effectiveOnline
                    ? "animate-pulse bg-success shadow-sm shadow-green-400/60"
                    : "bg-muted/50"
                }`}
              />
              <p
                className={`text-[9px] font-bold uppercase tracking-widest ${
                  effectiveOnline ? "text-success" : "text-muted-foreground"
                }`}
              >
                {effectiveOnline ? T("online") : T("offline")}
              </p>
            </div>
            {/* Toggle pill */}
            <div
              className={`relative h-5 w-9 flex-shrink-0 rounded-full transition-colors duration-200 ${
                effectiveOnline ? "bg-success" : "bg-muted/40"
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
            <p className="text-sm font-extrabold leading-tight text-foreground">
              {effectiveOnline ? T("acceptingOrders") : T("tapToStart")}
            </p>
            <p className="mt-0.5 text-[10px] text-muted-foreground">
              {effectiveOnline ? "Tap to go offline" : "Tap to go online"}
            </p>
          </div>
        </button>
      </div>
    </header>
  );
}
