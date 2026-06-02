import type { TranslationKey } from "@workspace/i18n";
import { AlertCircle, Clock, Smartphone, Volume2, VolumeX, Wallet, Wifi, Zap } from "lucide-react";
import { memo } from "react";
import { Link } from "wouter";

interface OnlineToggleCardProps {
  effectiveOnline: boolean;
  toggling: boolean;
  silenceOn: boolean;
  blockingReason?: string | null;
  onToggleOnline: () => void;
  onToggleSilence: () => void;
  T: (key: TranslationKey) => string;
}

interface BlockingHint {
  icon: React.ReactNode;
  text: string;
  linkHref?: string;
  linkLabel?: string;
}

function getBlockingHint(reason: string): BlockingHint {
  switch (reason) {
    case "phone_not_verified":
      return {
        icon: <Smartphone size={13} className="flex-shrink-0 text-warning" />,
        text: "Phone number not verified.",
        linkHref: "/profile",
        linkLabel: "Verify now →",
      };
    case "account_not_approved":
      return {
        icon: <Clock size={13} className="flex-shrink-0 text-warning" />,
        text: "Your account is pending admin approval.",
        linkHref: undefined,
        linkLabel: undefined,
      };
    case "insufficient_wallet_balance":
      return {
        icon: <Wallet size={13} className="flex-shrink-0 text-warning" />,
        text: "Wallet balance too low to go online.",
        linkHref: "/wallet",
        linkLabel: "Top up →",
      };
    default:
      return {
        icon: <AlertCircle size={13} className="flex-shrink-0 text-warning" />,
        text: "You cannot go online right now.",
        linkHref: undefined,
        linkLabel: undefined,
      };
  }
}

export const OnlineToggleCard = memo(function OnlineToggleCard({
  effectiveOnline,
  toggling,
  silenceOn,
  blockingReason = null,
  onToggleOnline,
  onToggleSilence,
  T,
}: OnlineToggleCardProps) {
  const isBlocked = !!blockingReason && !effectiveOnline;
  const isToggleDisabled = toggling || isBlocked;

  const hint = isBlocked ? getBlockingHint(blockingReason!) : null;

  return (
    <div
      className={`rounded-2xl border p-4 backdrop-blur-sm transition-all duration-300 ${effectiveOnline ? "border-success/20 bg-glass-raised" : "border-glass bg-glass-dim"}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className={`flex h-12 w-12 items-center justify-center rounded-2xl ${effectiveOnline ? "bg-success/15" : "bg-glass"}`}
          >
            {effectiveOnline ? (
              <Zap size={22} className="text-success" />
            ) : (
              <Wifi size={22} className="text-muted-foreground" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <div
                className={`h-2.5 w-2.5 rounded-full ${effectiveOnline ? "animate-pulse bg-success shadow-lg shadow-green-400/50" : "bg-[#B0B0B0]"}`}
              />
              <p className="text-lg font-extrabold tracking-tight">
                {effectiveOnline ? T("online") : T("offline")}
              </p>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {effectiveOnline ? T("acceptingOrders") : T("tapToStart")}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onToggleSilence}
            className={`flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:ring-offset-2 focus-visible:ring-offset-surface ${silenceOn ? "border border-error/20 bg-error/20 text-error" : "border border-border bg-muted/20 text-muted-foreground"}`}
            aria-label={silenceOn ? "Unmute notification sounds" : "Mute notification sounds"}
          >
            {silenceOn ? <VolumeX size={15} /> : <Volume2 size={15} />}
            <span className="text-[11px] leading-none font-bold">
              {silenceOn ? "Sound Off" : "Sound"}
            </span>
          </button>
          <button
            onClick={onToggleOnline}
            disabled={isToggleDisabled}
            className={`relative h-[30px] w-[56px] rounded-full shadow-inner transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-surface ${effectiveOnline ? "bg-success shadow-success/30" : "bg-muted/40"} ${isToggleDisabled ? "cursor-not-allowed scale-95 opacity-50" : "active:scale-95"}`}
            role="switch"
            aria-checked={effectiveOnline}
            aria-label={effectiveOnline ? "Go offline" : "Go online"}
          >
            <div
              className={`absolute top-[3px] h-[24px] w-[24px] rounded-full bg-white shadow-md transition-all duration-300 ${effectiveOnline ? "left-[29px]" : "left-[3px]"}`}
            />
          </button>
        </div>
      </div>

      {hint && (
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-warning/20 bg-warning/10 px-3 py-2">
          {hint.icon}
          <p className="flex-1 text-[11px] font-medium text-warning">{hint.text}</p>
          {hint.linkHref && hint.linkLabel && (
            <Link
              href={hint.linkHref}
              className="flex-shrink-0 text-[11px] font-bold text-warning underline underline-offset-2 hover:text-warning/80"
            >
              {hint.linkLabel}
            </Link>
          )}
        </div>
      )}
    </div>
  );
});
