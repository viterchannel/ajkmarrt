import { Clock, Smartphone, Wallet, Zap } from "lucide-react";
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
  blockingReason: string | null;
  onToggleOnline: () => void;
  onToggleSilence: () => void;
  newFlash: boolean;
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
  blockingReason,
  onToggleOnline,
  onToggleSilence,
  newFlash,
}: HomeHeaderProps) {
  return (
    <header
      className="relative overflow-hidden rounded-b-[2rem] bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 px-4 pb-6 text-white sm:px-6 sm:pb-8"
      style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 3.5rem)" }}
    >
      <div className="absolute -top-20 -right-20 h-72 w-72 rounded-full bg-success/[0.04]" />
      <div className="absolute bottom-10 -left-16 h-56 w-56 rounded-full bg-white/[0.02]" />
      <div className="absolute top-1/2 right-1/4 h-32 w-32 rounded-full bg-white/[0.015]" />

      <div className="relative mx-auto max-w-2xl">
        <div className="mb-5 flex items-start justify-between">
          <div>
            <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold tracking-widest text-white/40 uppercase">
              <Clock size={11} /> <LiveClock /> · AJKMart Rider
            </p>
            {user?.id && (
              <p className="mb-0.5 font-mono text-[10px] font-bold tracking-widest text-white/30 uppercase">
                {`AJK-${user.id.replace(/-/g, "").slice(0, 8).toUpperCase()}`}
              </p>
            )}
            <h1
              className={`text-[20px] leading-tight font-extrabold tracking-tight transition-colors sm:text-[22px] ${newFlash ? "text-success" : "text-white"}`}
            >
              {greeting}, {user?.name?.split(" ")[0] || "Rider"} 👋
            </h1>
            <p className="mt-1 text-[11px] font-medium text-white/65">
              Last seen online • {lastSeenLabel}
            </p>
            {newFlash && (
              <p className="mt-0.5 flex animate-pulse items-center gap-1 text-[11px] font-bold text-success">
                <span className="h-1.5 w-1.5 rounded-full bg-success" />
                New request available!
              </p>
            )}
          </div>
          <Link
            href="/wallet"
            className="flex flex-shrink-0 flex-col items-end"
            aria-label="View wallet balance"
          >
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.06] px-3 py-2 text-right backdrop-blur-sm sm:px-3.5">
              <p className="text-[9px] font-bold tracking-wider text-white/40 uppercase">
                {T("wallet")}
              </p>
              <p className="text-base leading-tight font-extrabold sm:text-lg">
                {formatCurrency(user?.walletBalance ?? "0", currency)}
              </p>
            </div>
          </Link>
        </div>

        {/* Online Toggle + Sound in one card */}
        <div
          className={`rounded-2xl border p-4 backdrop-blur-sm transition-all duration-300 ${effectiveOnline ? "border-success/20 bg-white/5" : "border-white/10 bg-white/5"}`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className={`flex h-12 w-12 items-center justify-center rounded-2xl ${effectiveOnline ? "bg-success/15" : "bg-white/5"}`}
              >
                {effectiveOnline ? (
                  <Zap size={22} className="text-success" />
                ) : (
                  <span className="text-white/40 text-xl">👔</span>
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
                <p className="mt-0.5 text-xs text-white/40">
                  {effectiveOnline ? T("acceptingOrders") : T("tapToStart")}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Sound toggle integrated */}
              <button
                onClick={onToggleSilence}
                className={`flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900 ${silenceOn ? "border border-error/20 bg-error/20 text-error" : "border border-white/10 bg-white/10 text-white/40"}`}
                aria-label={silenceOn ? "Unmute notification sounds" : "Mute notification sounds"}
              >
                <span className="text-[11px] leading-none font-bold">
                  {silenceOn ? "Sound Off" : "Sound"}
                </span>
              </button>
              {/* Online toggle switch */}
              <button
                onClick={onToggleOnline}
                disabled={toggling || (!!blockingReason && !effectiveOnline)}
                className={`relative h-[30px] w-[56px] rounded-full shadow-inner transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900 ${effectiveOnline ? "bg-success shadow-success/30" : "bg-white/20"} ${toggling || (!!blockingReason && !effectiveOnline) ? "cursor-not-allowed scale-95 opacity-50" : "active:scale-95"}`}
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

          {/* Blocking hint inline */}
          {!!blockingReason && !effectiveOnline && (
            <div className="mt-3 flex items-center gap-2 rounded-xl border border-warning/20 bg-warning/10 px-3 py-2">
              {blockingReason === "phone_not_verified" && (
                <>
                  <Smartphone size={13} className="flex-shrink-0 text-warning" />
                  <p className="flex-1 text-[11px] font-medium text-warning">Phone number not verified.</p>
                  <Link href="/profile" className="flex-shrink-0 text-[11px] font-bold text-warning underline underline-offset-2 hover:text-warning/80">
                    Verify now →
                  </Link>
                </>
              )}
              {blockingReason === "account_not_approved" && (
                <>
                  <Clock size={13} className="flex-shrink-0 text-warning" />
                  <p className="flex-1 text-[11px] font-medium text-warning">Your account is pending admin approval.</p>
                </>
              )}
              {blockingReason === "insufficient_wallet_balance" && (
                <>
                  <Wallet size={13} className="flex-shrink-0 text-warning" />
                  <p className="flex-1 text-[11px] font-medium text-warning">Wallet balance too low to go online.</p>
                  <Link href="/wallet" className="flex-shrink-0 text-[11px] font-bold text-warning underline underline-offset-2 hover:text-warning/80">
                    Top up →
                  </Link>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
