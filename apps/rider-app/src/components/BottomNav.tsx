import { useQuery } from "@tanstack/react-query";
import { tDual, type Language, type TranslationKey } from "@workspace/i18n";
import { Home, MapPin, RefreshCw, TrendingUp, User, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { api } from "../lib/api";
import { useNavBadges } from "../lib/useNavBadges";
import { useQueueStatus } from "../lib/offline/queueManager";
import { getRiderModules, usePlatformConfig } from "../lib/useConfig";
import { useLanguage } from "../lib/useLanguage";

import type { LucideProps } from "lucide-react";
import type { RiderModules } from "../lib/useConfig";
interface NavItem {
  href: string;
  labelKey: TranslationKey;
  Icon: React.ComponentType<LucideProps>;
  moduleKey?: keyof RiderModules;
}

/* 4 tabs: Home · Active · Earnings · Profile */
const navItems: NavItem[] = [
  { href: "/",          labelKey: "home",     Icon: Home },
  { href: "/active",    labelKey: "active",   Icon: MapPin },
  { href: "/earnings",  labelKey: "earnings", Icon: TrendingUp, moduleKey: "earnings" },
  { href: "/profile",   labelKey: "profile",  Icon: User },
];

/* Compact three-way language toggle: EN / اردو / Roman */
const LANG_OPTIONS: { value: Language; display: string }[] = [
  { value: "en",    display: "EN" },
  { value: "ur",    display: "اردو" },
  { value: "roman", display: "ROM" },
];

function LanguageSwitcher() {
  const { language, setLanguage, loading } = useLanguage();
  return (
    <div className="flex items-center gap-0.5 rounded-full border border-border bg-card p-0.5">
      {LANG_OPTIONS.map((opt) => {
        const active = language === opt.value;
        return (
          <button
            key={opt.value}
            onClick={() => { if (!loading && !active) void setLanguage(opt.value); }}
            disabled={loading || active}
            aria-label={`Switch language to ${opt.display}`}
            aria-pressed={active}
            className={`rounded-full px-3 py-1.5 text-[11px] font-bold leading-none transition-all duration-150 ${
              active
                ? "bg-brand text-surface"
                : "text-muted-foreground hover:text-foreground active:scale-95"
            }`}
          >
            {opt.display}
          </button>
        );
      })}
    </div>
  );
}

export function BottomNav() {
  const [location] = useLocation();
  const { language } = useLanguage();
  const T = (key: TranslationKey) => tDual(key, language);
  const { config } = usePlatformConfig();
  const modules = getRiderModules(config);
  const { pendingCount, syncing } = useQueueStatus();
  const { chatBadge, earningsBadge } = useNavBadges();

  /* Track real online status so the badge can distinguish "queued while
     offline" (amber, expected) from "pending while online" (red, sync error). */
  const [isOnline, setIsOnline] = useState(
    () => (typeof navigator !== "undefined" ? navigator.onLine : true)
  );
  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  /* Sync banner auto-collapses 8 s after pending count stabilises. */
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const prevPendingRef = useRef(pendingCount);
  const autoDismissRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (pendingCount > prevPendingRef.current) {
      setBannerDismissed(false);
    }
    prevPendingRef.current = pendingCount;
  }, [pendingCount]);

  useEffect(() => {
    if (pendingCount === 0 || bannerDismissed) {
      if (autoDismissRef.current) clearTimeout(autoDismissRef.current);
      return;
    }
    autoDismissRef.current = setTimeout(() => setBannerDismissed(true), 8000);
    return () => {
      if (autoDismissRef.current) clearTimeout(autoDismissRef.current);
    };
  }, [pendingCount, bannerDismissed]);

  const { data: notifData } = useQuery({
    queryKey: ["rider-notifs-count"],
    queryFn: () => api.getNotifications(),
    refetchInterval: 60000,
    staleTime: 30000,
  });
  const unread: number = notifData?.unread || 0;

  const { data: activeData } = useQuery({
    queryKey: ["rider-active"],
    queryFn: () => api.getActive(),
    refetchInterval: 8000,
    staleTime: 60_000,
  });
  const hasActive = !!(activeData?.order || activeData?.ride);

  return (
    <nav
      className="fixed bottom-0 left-1/2 z-40 w-full -translate-x-1/2 border-t border-border shadow-[0_-4px_24px_rgba(0,0,0,0.25)] sm:max-w-[540px] md:max-w-[680px] lg:max-w-[780px]"
      style={{
        backgroundColor: "var(--color-surface)",
        paddingBottom: "max(6px, env(safe-area-inset-bottom, 6px))",
      }}
    >
      {/* Offline / sync banner */}
      {pendingCount > 0 && !bannerDismissed && (
        <div
          className={`flex items-center gap-2 px-4 py-1.5 text-xs font-bold text-white ${
            syncing ? "bg-warning" : isOnline ? "bg-error" : "bg-warning"
          }`}
        >
          <RefreshCw size={10} className={syncing ? "animate-spin" : ""} />
          <span className="flex-1 text-center">
            {syncing
              ? T("syncBannerSyncing").replace("{n}", String(pendingCount))
              : isOnline
                ? T("syncBannerError").replace("{n}", String(pendingCount))
                : T("syncBannerOffline").replace("{n}", String(pendingCount))}
          </span>
          <button
            onClick={() => setBannerDismissed(true)}
            aria-label={T("dismissSyncBanner")}
            className="flex-shrink-0 rounded-md p-1 opacity-80 active:opacity-100"
          >
            <X size={11} />
          </button>
        </div>
      )}

      <div className="mx-auto flex max-w-2xl">
        {navItems
          .filter((item) => !item.moduleKey || modules[item.moduleKey] !== false)
          .map((item) => {
            const active =
              location === item.href || (item.href !== "/" && location.startsWith(item.href));
            const { Icon } = item;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="android-press group relative flex min-h-[52px] flex-1 flex-col items-center justify-center gap-0.5 pt-2 pb-1 focus-visible:outline-none"
              >
                <div className="relative">
                  <span
                    className={`flex h-8 w-11 items-center justify-center rounded-full transition-all duration-200 group-focus-visible:ring-2 group-focus-visible:ring-brand group-focus-visible:ring-offset-1 group-focus-visible:ring-offset-surface ${
                      active ? "bg-brand/10" : ""
                    }`}
                  >
                    <Icon
                      size={21}
                      strokeWidth={active ? 2.5 : 1.8}
                      className={`transition-colors duration-200 ${
                        active ? "text-brand" : "text-muted-foreground"
                      }`}
                    />
                  </span>
                  {/* Active indicator dot */}
                  {active && (
                    <div className="absolute -bottom-0.5 left-1/2 h-[4px] w-8 -translate-x-1/2 rounded-full bg-brand" />
                  )}
                  {/* Unread notifications badge — shown on profile since notifications moved there */}
                  {item.href === "/profile" && unread > 0 && (
                    <span className="absolute -top-1 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-error text-[10px] font-extrabold text-white shadow-sm">
                      {unread > 9 ? "9+" : unread}
                    </span>
                  )}
                  {/* Active tab — LIVE pulse when job running + unread chat badge */}
                  {item.href === "/active" && hasActive && location !== "/active" && (
                    <span className="absolute -top-1 -right-1 flex items-center justify-center">
                      <span className="relative flex items-center gap-0.5 rounded-full bg-success px-1.5 py-0.5">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60"></span>
                        <span className="relative h-1.5 w-1.5 rounded-full bg-white"></span>
                        <span className="relative text-[10px] font-extrabold leading-none text-white tracking-wide">LIVE</span>
                      </span>
                    </span>
                  )}
                  {/* Unread chat badge on Active tab (when no active job pulse is shown) */}
                  {item.href === "/active" && chatBadge > 0 && !(hasActive && location !== "/active") && (
                    <span className="absolute -top-1 -right-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-error px-0.5 text-[10px] font-extrabold text-white shadow-sm">
                      {chatBadge > 99 ? "99+" : chatBadge}
                    </span>
                  )}
                  {/* Earnings tab badge — dot when today's earnings changed since last view */}
                  {item.href === "/earnings" && earningsBadge && location !== "/earnings" && (
                    <span className="absolute -top-1 -right-0.5 h-2.5 w-2.5 rounded-full border border-surface bg-brand shadow-sm" />
                  )}
                </div>
                <span
                  className={`text-xs leading-none font-semibold transition-colors duration-200 ${
                    active ? "font-bold text-brand" : "text-muted-foreground"
                  }`}
                >
                  {T(item.labelKey)}
                </span>
              </Link>
            );
          })}
      </div>
    </nav>
  );
}
