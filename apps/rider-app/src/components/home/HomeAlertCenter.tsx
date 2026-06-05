import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
  socketConnected: boolean;
  effectiveOnline: boolean;
  zoneWarning: string | null;
  onDismissZone: () => void;
  wakeLockWarning: boolean;
  onDismissWakeLock: () => void;
  audioLocked: boolean;
  onUnlockAudio: () => void;
  onRetryConnect?: () => void;
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
  blockingReason: string | null;
  kycStatus: string | undefined;
  vehicleType: string | undefined;
  vehiclePhoto: string | undefined;
  drivingLicense: string | undefined;
  rejectionReason?: string | null;
  availableFeatures: any;
  T: (key: TranslationKey) => string;
}

/* ─── Alert severity styling helpers ────────────────────────────────────── */

function alertBg(sev: AlertItem["severity"]) {
  if (sev === "critical") return "border-error/30 bg-error/10";
  if (sev === "warning") return "border-warning/30 bg-warning/10";
  return "border-blue-400/30 bg-blue-500/10";
}
function alertTextColor(sev: AlertItem["severity"]) {
  if (sev === "critical") return "text-error";
  if (sev === "warning") return "text-warning";
  return "text-blue-400";
}
function alertActionCls(sev: AlertItem["severity"]) {
  if (sev === "critical") return "border-error/40 bg-error/10 text-error";
  if (sev === "warning") return "border-warning/40 bg-warning/10 text-warning";
  return "border-blue-400/40 bg-blue-500/10 text-blue-400";
}

/* ─── Individual dismissible alert row ───────────────────────────────────── */

function AlertRow({ alert, onDismiss }: { alert: AlertItem; onDismiss?: () => void }) {
  const [dismissed, setDismissed] = useState(false);

  const handleDismiss = () => {
    setDismissed(true);
    setTimeout(() => onDismiss?.(), 250);
  };

  if (dismissed) return null;

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 8, height: 0, marginBottom: 0 }}
      transition={{ duration: 0.22 }}
      className={`flex items-start gap-2.5 rounded-xl border px-3 py-2.5 ${alertBg(alert.severity)}`}
      role="alert"
    >
      <span className={`mt-0.5 flex-shrink-0 flex items-center justify-center ${alertTextColor(alert.severity)}`}>
        {alert.icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className={`text-[11px] font-bold ${alertTextColor(alert.severity)}`}>{alert.title}</p>
        {alert.message && (
          <p className={`mt-0.5 text-[10px] leading-relaxed ${alertTextColor(alert.severity)}/80`}>{alert.message}</p>
        )}
        {alert.action && (
          <Link
            href={alert.action.href}
            className={`mt-1.5 inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[10px] font-bold transition-opacity active:opacity-70 ${alertActionCls(alert.severity)}`}
          >
            {alert.action.label}
          </Link>
        )}
      </div>
      {(alert.onDismiss || onDismiss) && (
        <button
          onClick={handleDismiss}
          className={`flex-shrink-0 rounded p-0.5 ${alertTextColor(alert.severity)} hover:bg-current/15`}
          aria-label="Dismiss alert"
        >
          <X size={12} />
        </button>
      )}
    </motion.div>
  );
}

/* ─── Main component ─────────────────────────────────────────────────────── */

export function HomeAlertCenter({
  socketConnected, effectiveOnline, zoneWarning, onDismissZone, wakeLockWarning, onDismissWakeLock,
  audioLocked, onUnlockAudio, onRetryConnect, gpsWarning, onDismissGps, isRestricted,
  riderNotice, riderNoticeDismissed, onDismissRiderNotice, cancelStatsData, ignoreStatsData,
  currency, minBalance, walletBalance, blockingReason, T,
}: HomeAlertCenterProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const showConnection = !socketConnected && effectiveOnline;
  const showZone = !!zoneWarning && effectiveOnline;
  const showAudio = audioLocked && effectiveOnline;

  const alerts: AlertItem[] = [];

  if (gpsWarning) {
    alerts.push({ id: "gps", severity: "warning", icon: <MapPin size={14} />, title: gpsWarning, onDismiss: onDismissGps });
  }
  if (isRestricted) {
    alerts.push({ id: "restricted", severity: "critical", icon: <Ban size={14} />, title: "Account Restricted", message: "Your account has been restricted due to excessive cancellations or ignores. Contact support to resolve." });
  }
  if (riderNotice && !riderNoticeDismissed) {
    alerts.push({ id: "notice", severity: "info", icon: <Pin size={14} />, title: riderNotice, onDismiss: onDismissRiderNotice });
  }
  if (cancelStatsData && cancelStatsData.dailyCancels > 0) {
    const atRisk = cancelStatsData.remaining <= 1;
    alerts.push({
      id: "cancel", severity: atRisk ? "critical" : "warning", icon: <XCircle size={14} />,
      title: `${cancelStatsData.dailyCancels} cancellation${cancelStatsData.dailyCancels !== 1 ? "s" : ""} today${cancelStatsData.remaining === 0 ? " — Limit Reached!" : cancelStatsData.remaining === 1 ? " — 1 left before penalty!" : ""}`,
      message: cancelStatsData.dailyLimit != null
        ? `Limit: ${cancelStatsData.dailyLimit}/day · ${cancelStatsData.remaining} remaining${(cancelStatsData.penaltyAmount ?? 0) > 0 ? ` · ${currency} ${Math.round(cancelStatsData.penaltyAmount)} penalty per excess` : ""}`
        : undefined,
    });
  }
  if (ignoreStatsData && ignoreStatsData.dailyIgnores > 0) {
    const atRisk = ignoreStatsData.remaining <= 1;
    alerts.push({
      id: "ignore", severity: atRisk ? "critical" : "warning", icon: <SkipForward size={14} />,
      title: `${ignoreStatsData.dailyIgnores} request${ignoreStatsData.dailyIgnores !== 1 ? "s" : ""} ignored today${ignoreStatsData.remaining === 0 ? " — Limit Reached!" : ignoreStatsData.remaining === 1 ? " — 1 left before penalty!" : ""}`,
      message: ignoreStatsData.dailyLimit != null
        ? `Limit: ${ignoreStatsData.dailyLimit}/day · ${ignoreStatsData.remaining} remaining${(ignoreStatsData.penaltyAmount ?? 0) > 0 ? ` · ${currency} ${Math.round(ignoreStatsData.penaltyAmount)} penalty per excess` : ""}`
        : undefined,
    });
  }
  if (minBalance > 0 && walletBalance < minBalance) {
    const shortfall = minBalance - walletBalance;
    alerts.push({
      id: "wallet", severity: "warning", icon: <Wallet size={14} />,
      title: `Low Wallet Balance — ${currency} ${Math.round(minBalance)} required`,
      message: `Your balance: ${currency} ${Math.round(walletBalance)}${shortfall > 0 ? `. Need ${currency} ${Math.round(shortfall)} more.` : ""}`,
      action: { label: "Top Up →", href: "/wallet" },
    });
  }

  const hasAnyAlert = alerts.length > 0;
  const criticalCount = alerts.filter((a) => a.severity === "critical").length;
  const totalCount = alerts.length;

  /* Critical alerts always visible by default; non-critical collapsed */
  const criticalAlerts = alerts.filter((a) => a.severity === "critical");
  const nonCriticalAlerts = alerts.filter((a) => a.severity !== "critical");
  const visibleAlerts = drawerOpen
    ? (showAll ? alerts : [...criticalAlerts, ...nonCriticalAlerts.slice(0, 2)])
    : criticalAlerts.slice(0, 1);
  const hasMore = drawerOpen && !showAll && nonCriticalAlerts.length > 2;

  return (
    <div className="space-y-2.5">
      {/* ── Fixed top banners ── */}
      <AnimatePresence>
        {showConnection && (
          <motion.div
            key="connection"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="flex animate-pulse items-center gap-2 rounded-xl bg-error px-3 py-2.5 text-xs font-bold text-white shadow-lg"
            role="alert"
            aria-live="assertive"
          >
            <WifiOff size={14} className="flex-shrink-0" />
            <span className="flex-1">{T("connectionLost")}</span>
            {onRetryConnect && (
              <button onClick={onRetryConnect} className="flex-shrink-0 rounded-lg border border-white/30 bg-white/20 px-3 py-1 text-[11px] font-extrabold text-white transition-opacity active:opacity-70" aria-label="Retry connection">
                Retry
              </button>
            )}
          </motion.div>
        )}

        {showZone && (
          <motion.div
            key="zone"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="flex items-center justify-center gap-1.5 rounded-xl bg-warning px-3 py-2 text-xs font-bold text-white shadow-lg"
            role="alert"
            aria-live="polite"
          >
            <MapPin size={13} className="flex-shrink-0" />
            <span className="truncate">{zoneWarning}</span>
            <button onClick={onDismissZone} className="ml-1 flex-shrink-0 rounded-full bg-card/20 p-0.5" aria-label="Dismiss zone warning">
              <X size={11} />
            </button>
          </motion.div>
        )}

        {showAudio && (
          <motion.button
            key="audio"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            onClick={onUnlockAudio}
            onTouchEnd={(e) => { e.preventDefault(); onUnlockAudio(); }}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-bold text-white shadow-lg"
            aria-label="Tap to enable ride alert sounds"
          >
            <Volume2 size={13} className="flex-shrink-0 animate-pulse" />
            Tap to enable ride sounds
          </motion.button>
        )}
      </AnimatePresence>

      {/* ── Bottom-sheet collapsible alert drawer ── */}
      {hasAnyAlert && (
        <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
          {/* Drawer header / handle */}
          <button
            onClick={() => setDrawerOpen(!drawerOpen)}
            className="flex w-full items-center gap-2 px-4 py-3 text-left"
            aria-expanded={drawerOpen}
            aria-label={`${drawerOpen ? "Collapse" : "Expand"} alerts, ${totalCount} total`}
          >
            {/* Drag handle indicator */}
            <div className="absolute left-1/2 top-1.5 h-1 w-8 -translate-x-1/2 rounded-full bg-border/60" />
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
            {!drawerOpen && nonCriticalAlerts.length > 0 && (
              <span className="ml-1 rounded-full border border-border bg-muted/20 px-1.5 py-0.5 text-[9px] font-bold text-muted-foreground">
                +{nonCriticalAlerts.length} more
              </span>
            )}
            <span className="ml-auto text-muted-foreground">
              {drawerOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </span>
          </button>

          {/* Drawer body — slides in/out */}
          <AnimatePresence initial={false}>
            {drawerOpen && (
              <motion.div
                key="drawer"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
                style={{ overflow: "hidden" }}
              >
                <div className="space-y-2 px-4 pb-3">
                  {/* Critical alerts first */}
                  <AnimatePresence>
                    {criticalAlerts.map((alert) => (
                      <AlertRow key={alert.id} alert={alert} onDismiss={alert.onDismiss} />
                    ))}
                  </AnimatePresence>

                  {/* Non-critical alerts */}
                  {nonCriticalAlerts.length > 0 && (
                    <>
                      {nonCriticalAlerts.length > 0 && criticalAlerts.length > 0 && (
                        <div className="flex items-center gap-2 py-0.5">
                          <div className="h-px flex-1 bg-border/40" />
                          <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Other alerts</span>
                          <div className="h-px flex-1 bg-border/40" />
                        </div>
                      )}
                      <AnimatePresence>
                        {(showAll ? nonCriticalAlerts : nonCriticalAlerts.slice(0, 2)).map((alert) => (
                          <AlertRow key={alert.id} alert={alert} onDismiss={alert.onDismiss} />
                        ))}
                      </AnimatePresence>
                    </>
                  )}

                  {hasMore && (
                    <button
                      onClick={() => setShowAll(!showAll)}
                      className="w-full rounded-xl border border-border bg-muted/10 py-1.5 text-center text-[11px] font-bold text-muted-foreground transition-colors active:bg-muted/20"
                    >
                      {showAll ? "Show fewer" : `View ${nonCriticalAlerts.length - 2} more alert${nonCriticalAlerts.length - 2 > 1 ? "s" : ""}`}
                    </button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Collapsed critical preview */}
          <AnimatePresence>
            {!drawerOpen && criticalAlerts.length > 0 && (
              <motion.div
                key="preview"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="px-4 pb-3"
              >
                {criticalAlerts.slice(0, 1).map((alert) => (
                  <div key={alert.id} className={`flex items-center gap-2 rounded-xl border px-3 py-2 ${alertBg(alert.severity)}`}>
                    <span className={`flex-shrink-0 ${alertTextColor(alert.severity)}`}>{alert.icon}</span>
                    <p className={`flex-1 truncate text-[11px] font-bold ${alertTextColor(alert.severity)}`}>{alert.title}</p>
                    <span className="text-[9px] font-bold text-muted-foreground">tap to expand</span>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Wake lock toast */}
      <AnimatePresence>
        {wakeLockWarning && effectiveOnline && (
          <motion.div
            key="wakelock"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="flex items-center gap-2.5 rounded-2xl bg-warning px-4 py-3 text-xs font-bold text-white shadow-lg"
            role="alert"
          >
            <AlertTriangle size={14} className="flex-shrink-0" />
            <span className="flex-1">Screen may sleep — keep app open for uninterrupted deliveries.</span>
            <button onClick={onDismissWakeLock} className="flex-shrink-0 rounded-full bg-card/20 p-0.5" aria-label="Dismiss wake lock warning">
              <X size={11} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
