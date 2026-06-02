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
  const tier = getRiderTier((user?.stats as any)?.rating ?? null);
  const firstName = user?.name?.split(" ")[0] || "Rider";
  const initials = getInitials(user?.name);
  const hasUnread = unreadNotifications > 0;

  return (
    <header
      className="page-header-gradient relative bg-card border-b border-border/60 px-4 pb-5 text-foreground sm:px-6"
      style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 3.5rem)" }}
    >
      {/* ── Branding bar ── */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-brand">
            <span className="text-[10px] font-black text-black">A</span>
          </div>
          <span className="text-[11px] font-bold tracking-widest text-muted-foreground uppercase">
            AJKMart Rider
          </span>
        </div>

        {/* Right side: notification bell + avatar */}
        <div className="flex items-center gap-2">
          {/* Notification bell */}
          <Link
            href="/notifications"
            className="relative flex h-8 w-8 items-center justify-center rounded-xl border border-border/80 bg-muted/10 transition-colors active:bg-muted/30"
            aria-label={hasUnread ? `${unreadNotifications} unread notifications` : "Notifications"}
          >
            <Bell size={15} className={hasUnread ? "text-foreground" : "text-muted-foreground"} />
            {hasUnread && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-error text-[9px] font-extrabold text-white leading-none">
                {unreadNotifications > 9 ? "9+" : unreadNotifications}
              </span>
            )}
          </Link>

          {/* Avatar → /profile */}
          <Link
            href="/profile"
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-border/20 bg-muted/20 transition-colors active:bg-muted/40"
            aria-label="Go to profile"
          >
            {user?.avatar ? (
              <img
                src={user.avatar}
                alt={user?.name ?? "Rider"}
                className="h-full w-full rounded-full object-cover"
              />
            ) : (
              <span className="text-[10px] font-extrabold text-muted-foreground">{initials}</span>
            )}
          </Link>
        </div>
      </div>

      {/* ── Greeting row ── */}
      <div className="mb-4 flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            {greeting}
          </p>
          <h1
            className={`mt-0.5 text-xl font-extrabold tracking-tight transition-colors sm:text-2xl ${
              newFlash ? "text-success" : "text-foreground"
            }`}
          >
            {firstName}
          </h1>
          {/* LiveClock moved here as subtle secondary position */}
          <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
            <LiveClock />
          </p>
          {newFlash && (
            <div className="mt-1 flex items-center gap-1.5 text-xs font-bold text-success">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" />
              New request available
            </div>
          )}
        </div>
        <div className="flex flex-col items-end gap-1.5">
          {tier.label !== "Standard" && (
            <span
              className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${tier.cls}`}
            >
              {tier.label}
            </span>
          )}
          <p className="text-[10px] text-muted-foreground">
            Last online · {lastSeenLabel}
          </p>
        </div>
      </div>

      {/* ── Wallet + Online toggle ── */}
      <div className="grid grid-cols-2 gap-2.5">
        {/* Wallet card */}
        <Link
          href="/wallet"
          className="flex flex-col gap-1.5 rounded-2xl border border-border/80 bg-muted/10 p-3.5 transition-colors active:bg-muted/40"
          aria-label="View wallet balance"
        >
          <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            <Wallet size={10} />
            {T("wallet")}
          </p>
          <p className="text-lg font-extrabold leading-none text-foreground">
            {formatCurrency(user?.walletBalance ?? "0", currency)}
          </p>
          <p className="flex items-center gap-0.5 text-[10px] font-medium text-muted-foreground">
            View balance <ChevronRight size={9} />
          </p>
        </Link>

        {/* Online toggle card */}
        <button
          onClick={onToggleOnline}
          disabled={toggling}
          className={`flex flex-col gap-1.5 rounded-2xl border p-3.5 text-left transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 ${
            effectiveOnline
              ? "border-success/20 bg-success/[0.06]"
              : "border-border/80 bg-muted/10"
          }`}
          role="switch"
          aria-checked={effectiveOnline}
          aria-label={effectiveOnline ? "Go offline" : "Go online"}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span
                className={`h-2 w-2 rounded-full ${
                  effectiveOnline
                    ? "animate-pulse bg-success shadow-lg shadow-green-400/50"
                    : "bg-muted/40"
                }`}
              />
              <p
                className={`text-[10px] font-bold uppercase tracking-wider ${
                  effectiveOnline ? "text-success" : "text-muted-foreground"
                }`}
              >
                {effectiveOnline ? T("online") : T("offline")}
              </p>
            </div>
            {/* Mini toggle pill */}
            <div
              className={`relative h-5 w-9 flex-shrink-0 rounded-full transition-colors ${
                effectiveOnline ? "bg-success" : "bg-muted/40"
              }`}
            >
              <div
                className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${
                  effectiveOnline ? "left-4" : "left-0.5"
                }`}
              />
            </div>
          </div>
          <p className="text-sm font-extrabold leading-none text-foreground">
            {effectiveOnline ? T("acceptingOrders") : T("tapToStart")}
          </p>
          <p className="text-[10px] text-muted-foreground">
            {effectiveOnline ? "Tap to stop" : "Tap to begin"}
          </p>
        </button>
      </div>

      {/* ── Utility row: sound + blocking reason ── */}
      <div className="mt-2.5 flex items-center justify-between gap-2">
        <button
          onClick={onToggleSilence}
          className={`flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-[10px] font-bold transition-all ${
            silenceOn
              ? "border-error/20 bg-error/10 text-error"
              : "border-border bg-muted/10 text-muted-foreground"
          }`}
          aria-label={silenceOn ? "Unmute notification sounds" : "Mute notification sounds"}
        >
          {silenceOn ? <VolumeX size={11} /> : <Volume2 size={11} />}
          {silenceOn ? "Alerts muted" : "Alerts on"}
        </button>
      </div>
    </header>
  );
}
