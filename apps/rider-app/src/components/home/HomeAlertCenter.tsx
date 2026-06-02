import { useState } from "react";
import {
  AlertTriangle,
  Ban,
  Bell,
  ChevronDown,
  ChevronUp,
  MapPin,
  Pin,
  SkipForward,
  Volume2,
  Wallet,
  WifiOff,
  X,
  XCircle,
} from "lucide-react";

import { Link } from "wouter";
import type { TranslationKey } from "@workspace/i18n";

export interface AlertItem {
  id: string;
  severity: "critical" | "warning" | "info";
  icon: React.ReactNode;
  title: string;
  message?: string;
  action?: { label: string; href: string };
  onDismiss?: () => void;
}

interface HomeAlertCenterProps {
  /* Critical fixed banners */
  socketConnected: boolean;
  effectiveOnline: boolean;
  zoneWarning: string | null;
  onDismissZone: () => void;
  wakeLockWarning: boolean;
  onDismissWakeLock: () => void;
  audioLocked: boolean;
  onUnlockAudio: () => void;
  onRetryConnect?: () => void;

  /* Inline warnings */
  gpsWarning: string | null;
  onDismissGps: () => void;
  isRestricted: boolean;
  riderNotice: string;
  riderNoticeDismissed: boolean;
  onDismissRiderNotice: () => void;
  cancelStatsData: any;
  ignoreStatsData: any;
  currency: string;
  minBalance: number;
  walletBalance: number;

  /* Blocking reasons */
  blockingReason: string | null;

  /* KYC */
  kycStatus: string | undefined;
  vehicleType: string | undefined;
  vehiclePhoto: string | undefined;
  drivingLicense: string | undefined;
  rejectionReason?: string | null;

  /* Progressive verification */
  availableFeatures: any;

  T: (key: TranslationKey) => string;
}

export function HomeAlertCenter({
  socketConnected,
  effectiveOnline,
  zoneWarning,
  onDismissZone,
  wakeLockWarning,
  onDismissWakeLock,
  audioLocked,
  onUnlockAudio,
  onRetryConnect,
  gpsWarning,
  onDismissGps,
  isRestricted,
  riderNotice,
  riderNoticeDismissed,
  onDismissRiderNotice,
  cancelStatsData,
  ignoreStatsData,
  currency,
  minBalance,
  walletBalance,
  blockingReason,
  kycStatus,
  vehicleType,
  vehiclePhoto,
  drivingLicense,
  rejectionReason,
  availableFeatures,
  T,
}: HomeAlertCenterProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [showAllAlerts, setShowAllAlerts] = useState(false);

  /* ── Critical top banners (always visible) ── */
  const showConnection = !socketConnected && effectiveOnline;
  const showZone = !!zoneWarning && effectiveOnline;
  const showAudio = audioLocked && effectiveOnline;

  /* ── Build alert list for the collapsible center ── */
  const alerts: AlertItem[] = [];

  if (gpsWarning) {
    alerts.push({
      id: "gps",
      severity: "warning",
      icon: <MapPin size={14} />,
      title: gpsWarning,
      onDismiss: onDismissGps,
    });
  }

  if (isRestricted) {
    alerts.push({
      id: "restricted",
      severity: "critical",
      icon: <Ban size={14} />,
      title: "Account Restricted",
      message: "Your account has been restricted due to excessive cancellations or ignores. You cannot accept new rides. Contact support to resolve.",
    });
  }

  if (riderNotice && !riderNoticeDismissed) {
    alerts.push({
      id: "notice",
      severity: "info",
      icon: <Pin size={14} />,
      title: riderNotice,
      onDismiss: onDismissRiderNotice,
    });
  }

  if (cancelStatsData && cancelStatsData.dailyCancels > 0) {
    const atRisk = cancelStatsData.remaining <= 1;
    alerts.push({
      id: "cancel",
      severity: atRisk ? "critical" : "warning",
      icon: <XCircle size={14} />,
      title: `${cancelStatsData.dailyCancels} cancellation${cancelStatsData.dailyCancels !== 1 ? "s" : ""} today${cancelStatsData.remaining === 0 ? " — Limit Reached!" : cancelStatsData.remaining === 1 ? " — 1 left before penalty!" : ""}`,
      message: cancelStatsData.dailyLimit != null
        ? `Limit: ${cancelStatsData.dailyLimit}/day · ${cancelStatsData.remaining} remaining${(cancelStatsData.penaltyAmount ?? 0) > 0 ? ` · ${currency} ${Math.round(cancelStatsData.penaltyAmount)} penalty per excess` : ""}`
        : undefined,
    });
  }

  if (ignoreStatsData && ignoreStatsData.dailyIgnores > 0) {
    const atRisk = ignoreStatsData.remaining <= 1;
    alerts.push({
      id: "ignore",
      severity: atRisk ? "critical" : "warning",
      icon: <SkipForward size={14} />,
      title: `${ignoreStatsData.dailyIgnores} request${ignoreStatsData.dailyIgnores !== 1 ? "s" : ""} ignored today${ignoreStatsData.remaining === 0 ? " — Limit Reached!" : ignoreStatsData.remaining === 1 ? " — 1 left before penalty!" : ""}`,
      message: ignoreStatsData.dailyLimit != null
        ? `Limit: ${ignoreStatsData.dailyLimit}/day · ${ignoreStatsData.remaining} remaining${(ignoreStatsData.penaltyAmount ?? 0) > 0 ? ` · ${currency} ${Math.round(ignoreStatsData.penaltyAmount)} penalty per excess` : ""}`
        : undefined,
    });
  }

  if (minBalance > 0 && walletBalance < minBalance) {
    const shortfall = minBalance - walletBalance;
    alerts.push({
      id: "wallet",
      severity: "warning",
      icon: <Wallet size={14} />,
      title: `Low Wallet Balance — ${currency} ${Math.round(minBalance)} required`,
      message: `Your balance: ${currency} ${Math.round(walletBalance)}${shortfall > 0 ? `. Need ${currency} ${Math.round(shortfall)} more.` : ""}`,
      action: { label: "Top Up →", href: "/wallet" },
    });
  }

  const hasAnyAlert = alerts.length > 0;
  const criticalCount = alerts.filter((a) => a.severity === "critical").length;
  const totalCount = alerts.length;

  const visibleAlerts = showAllAlerts ? alerts : alerts.slice(0, 2);
  const hasMoreAlerts = alerts.length > 2;

  return (
    <div className="space-y-3">
      {/* ── Fixed top banners (critical, non-dismissible) ── */}
      {showConnection && (
        <div
          className="flex animate-pulse items-center justify-center gap-2 rounded-xl bg-error px-3 py-2 text-xs font-bold text-white shadow-lg"
          role="alert"
          aria-live="assertive"
        >
          <WifiOff size={13} />
          <span>{T("connectionLost")}</span>
          {onRetryConnect && (
            <button
              onClick={onRetryConnect}
              className="ml-1 rounded bg-card-dark/20 px-2 py-0.5 text-[10px] font-extrabold text-white hover:bg-card-dark/30"
              aria-label="Retry connection"
            >
              Retry sync
            </button>
          )}
        </div>
      )}

      {showZone && (
        <div
          className="flex items-center justify-center gap-1.5 rounded-xl bg-warning px-3 py-2 text-xs font-bold text-white shadow-lg"
          role="alert"
          aria-live="polite"
        >
          <MapPin size={13} className="flex-shrink-0" />
          <span className="truncate">{zoneWarning}</span>
          <button
            onClick={onDismissZone}
            className="ml-1 flex-shrink-0 rounded-full bg-card-dark/20 p-0.5"
            aria-label="Dismiss zone warning"
          >
            <X size={11} />
          </button>
        </div>
      )}

      {showAudio && (
        <button
          onClick={onUnlockAudio}
          onTouchEnd={(e) => { e.preventDefault(); onUnlockAudio(); }}
          onPointerUp={onUnlockAudio}
          className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-bold text-white shadow-lg"
          aria-label="Tap to enable ride alert sounds"
        >
          <Volume2 size={13} className="flex-shrink-0 animate-pulse" />
          Tap to enable ride sounds
        </button>
      )}

      {/* ── Alert Center (collapsible secondary alerts) ── */}
      {hasAnyAlert && (
        <div className="rounded-2xl border border-white/10 bg-card-dark shadow-sm">
          {/* Header with bell + count */}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="flex w-full items-center gap-2 px-4 py-3 text-left"
            aria-expanded={!collapsed}
            aria-label={`${collapsed ? "Expand" : "Collapse"} alerts, ${totalCount} total`}
          >
            <div className="relative">
              <Bell size={16} className={criticalCount > 0 ? "text-error" : "text-warning"} />
              {totalCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-error text-[8px] font-extrabold text-white">
                  {totalCount > 9 ? "9+" : totalCount}
                </span>
              )}
            </div>
            <span className={`text-xs font-bold ${criticalCount > 0 ? "text-error" : "text-warning"}`}>
              {criticalCount > 0 ? `${criticalCount} critical alert${criticalCount > 1 ? "s" : ""}` : `${totalCount} alert${totalCount > 1 ? "s" : ""}`}
            </span>
            <span className="ml-auto text-white/40">
              {collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
            </span>
          </button>

          {!collapsed && (
            <div className="space-y-2 px-4 pb-3">
              {/* Inline alerts */}
              {visibleAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`flex items-start gap-2.5 rounded-xl border px-3 py-2.5 ${
                    alert.severity === "critical"
                      ? "border-error/30 bg-error/10"
                      : alert.severity === "warning"
                        ? "border-warning/30 bg-warning/10"
                        : "border-blue-400/30 bg-blue-500/10"
                  }`}
                  role="alert"
                >
                  <span className={`mt-0.5 flex-shrink-0 ${
                    alert.severity === "critical" ? "text-error" : alert.severity === "warning" ? "text-warning" : "text-blue-400"
                  }`}>
                    {alert.icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={`text-[11px] font-bold ${
                      alert.severity === "critical" ? "text-error" : alert.severity === "warning" ? "text-warning" : "text-blue-400"
                    }`}>
                      {alert.title}
                    </p>
                    {alert.message && (
                      <p className={`mt-0.5 text-[10px] leading-relaxed ${
                        alert.severity === "critical" ? "text-error/80" : alert.severity === "warning" ? "text-warning/80" : "text-blue-400/80"
                      }`}>
                        {alert.message}
                      </p>
                    )}
                    {alert.action && (
                      <Link href={alert.action.href} className="mt-1 inline-flex items-center gap-0.5 text-[10px] font-bold text-warning underline underline-offset-2">
                        {alert.action.label} →
                      </Link>
                    )}
                  </div>
                  {alert.onDismiss && (
                    <button
                      onClick={alert.onDismiss}
                      className={`flex-shrink-0 rounded p-0.5 ${
                        alert.severity === "critical" ? "text-error hover:bg-error/15" : alert.severity === "warning" ? "text-warning hover:bg-warning/15" : "text-blue-400 hover:bg-blue-400/15"
                      }`}
                      aria-label="Dismiss alert"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              ))}

              {hasMoreAlerts && (
                <button
                  onClick={() => setShowAllAlerts(!showAllAlerts)}
                  className="w-full text-center text-[10px] font-bold text-white/40 underline underline-offset-2"
                >
                  {showAllAlerts ? "Show fewer alerts" : `+ ${alerts.length - 2} more alerts`}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Wake lock toast (bottom, above nav) */}
      {wakeLockWarning && effectiveOnline && (
        <div
          className="flex animate-[slideUp_0.3s_ease-out] items-center gap-2.5 rounded-2xl bg-warning px-4 py-3 text-xs font-bold text-white shadow-lg"
          role="alert"
        >
          <AlertTriangle size={14} className="flex-shrink-0" />
          <span className="flex-1">Screen may sleep — keep app open for uninterrupted deliveries.</span>
          <button
            onClick={onDismissWakeLock}
            className="flex-shrink-0 rounded-full bg-card-dark/20 p-0.5"
            aria-label="Dismiss wake lock warning"
          >
            <X size={11} />
          </button>
        </div>
      )}
    </div>
  );
}
