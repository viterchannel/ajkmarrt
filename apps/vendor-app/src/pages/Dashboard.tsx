import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { tDual } from "@workspace/i18n";
import {
  PackageOpen,
  ShoppingCart,
  TicketPercent,
  Settings,
  AlertTriangle,
  Bell,
  Truck,
  CheckSquare,
  MessageSquare,
  Plus,
  X,
  MapPin,
  Pin,
} from "lucide-react";
import { toast } from "../hooks/use-toast";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { PageHeader } from "../components/PageHeader";
import { PullToRefresh } from "../components/PullToRefresh";
import { ErrorState } from "../components/ui/ErrorState";
import { ShimmerRows, ShimmerStat } from "../components/ui/ShimmerBlock";
import { useOfflineQueue } from "../hooks/useOfflineQueue";
import { api } from "../lib/api";
import { OfflineBanner } from "../components/ui/OfflineBanner";
import { useStoreStatus } from "../hooks/useStoreStatus";
import { StoreHoursChip } from "../components/ui/StoreHoursChip";
import { StoreStatusBadge } from "../components/ui/StoreStatusBadge";
import { BADGE_BLUE, CARD, DEFAULT_COMMISSION_PCT, ORDER_STATUS_BADGE, errMsg, fc, fd, STAT_LBL, STAT_VAL } from "../lib/ui";
import { usePlatformConfig } from "../lib/useConfig";
import { useLanguage } from "../lib/useLanguage";
import type { StoreHours } from "../lib/vendor-auth";
import { useAuth } from "../lib/vendor-auth";

function typeIcon(type: string) {
  const s = 16;
  if (type === "order") return <PackageOpen size={s} />;
  if (type === "wallet") return <TicketPercent size={s} />;
  if (type === "promo") return <Plus size={s} />;
  if (type === "system") return <Settings size={s} />;
  if (type === "alert") return <AlertTriangle size={s} />;
  return <Bell size={s} />;
}

function QuickActions() {
  return (
    <div className={`${CARD} p-4`}>
      <p className="mb-3 text-xs font-extrabold tracking-widest text-muted-foreground uppercase">
        Quick Actions
      </p>
      <div className="grid grid-cols-3 gap-3">
        <Link
          href="/orders"
          className="flex flex-col items-center gap-2 rounded-2xl p-3 text-center transition-transform active:scale-95 bg-green-500/10"
        >
          <CheckSquare size={22} className="text-green-500" />
          <span className="text-xs leading-tight font-bold text-green-500">Accept Orders</span>
        </Link>
        <Link
          href="/chat"
          className="flex flex-col items-center gap-2 rounded-2xl p-3 text-center transition-transform active:scale-95 bg-[var(--login-brand)]/10"
        >
          <MessageSquare size={22} className="text-[var(--login-brand)]" />
          <span className="text-xs leading-tight font-bold text-[var(--login-brand)]">Open Chat</span>
        </Link>
        <Link
          href="/products"
          className="flex flex-col items-center gap-2 rounded-2xl p-3 text-center transition-transform active:scale-95 bg-amber-500/10"
        >
          <ShoppingCart size={22} className="text-amber-500" />
          <span className="text-xs leading-tight font-bold text-amber-500">Manage Products</span>
        </Link>
      </div>
    </div>
  );
}

interface DashNotification {
  id: string;
  title: string;
  body: string;
  type: string;
  isRead?: boolean;
  createdAt: string;
}

function NotificationsSection() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["vendor-notifications"],
    queryFn: () => api.getNotifications(),
    refetchInterval: 60000,
    staleTime: 30000,
  });
  const markAllMut = useMutation({
    mutationFn: () => api.markAllRead(),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["vendor-notifications"] });
      void qc.invalidateQueries({ queryKey: ["vendor-notifs-count"] });
    },
  });

  const notifs: DashNotification[] = (data?.notifications || []).slice(0, 5);
  const unread: number = data?.unread || 0;

  return (
    <div className={CARD}>
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-base">🔔</span>
          <p className="text-sm font-bold text-foreground">Recent Notifications</p>
          {unread > 0 && (
            <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-bold text-destructive">
              {unread} unread
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {unread > 0 && (
            <button
              onClick={() => markAllMut.mutate()}
              disabled={markAllMut.isPending}
              className="rounded-lg bg-primary/10 px-2.5 py-1 text-[11px] font-bold text-primary"
            >
              ✓ Mark all read
            </button>
          )}
          <Link
            href="/notifications"
            className="text-[11px] font-bold text-muted-foreground hover:text-primary"
          >
            View all →
          </Link>
        </div>
      </div>
      {isLoading ? (
        <div className="p-4">
          <ShimmerRows count={3} />
        </div>
      ) : notifs.length === 0 ? (
        <div className="px-4 py-8 text-center">
          <p className="mb-2 text-3xl">🔔</p>
          <p className="text-sm font-bold text-muted-foreground">All caught up!</p>
          <p className="mt-1 text-xs text-muted-foreground/60">No new notifications</p>
        </div>
      ) : (
        <div className="divide-y divide-border">
          {notifs.map((n) => (
            <div
              key={n.id}
              className={`flex items-start gap-3 px-4 py-3 ${!n.isRead ? "bg-primary/5" : ""}`}
            >
              <div
                className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl text-base ${!n.isRead ? "bg-primary/10" : "bg-muted"}`}
              >
                {typeIcon(n.type)}
              </div>
              <div className="min-w-0 flex-1">
                <p
                  className={`text-xs leading-snug font-bold ${!n.isRead ? "text-foreground" : "text-muted-foreground"}`}
                >
                  {n.title}
                </p>
                <p className="mt-0.5 line-clamp-1 text-[11px] leading-relaxed text-muted-foreground">
                  {n.body}
                </p>
                <p className="mt-1 text-[10px] text-muted-foreground/60">{fd(n.createdAt)}</p>
              </div>
              {!n.isRead && (
                <div className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-primary" />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const DAYS: { key: string; label: string }[] = [
  { key: "mon", label: "Monday" },
  { key: "tue", label: "Tuesday" },
  { key: "wed", label: "Wednesday" },
  { key: "thu", label: "Thursday" },
  { key: "fri", label: "Friday" },
  { key: "sat", label: "Saturday" },
  { key: "sun", label: "Sunday" },
];

const DEFAULT_STORE_HOURS: StoreHours = {
  mon: { open: "08:00", close: "22:00" },
  tue: { open: "08:00", close: "22:00" },
  wed: { open: "08:00", close: "22:00" },
  thu: { open: "08:00", close: "22:00" },
  fri: { open: "08:00", close: "22:00" },
  sat: { open: "08:00", close: "22:00" },
  sun: { open: "10:00", close: "20:00" },
};

function ScheduleEditor({
  storeHours,
  onSave,
  saving,
}: {
  storeHours: StoreHours | null | undefined;
  onSave: (hours: StoreHours) => Promise<void>;
  saving: boolean;
}) {
  const initHours: StoreHours =
    storeHours && Object.keys(storeHours).length > 0 ? storeHours : DEFAULT_STORE_HOURS;
  const [hours, setHours] = useState<StoreHours>(initHours);
  const [dirty, setDirty] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const update = (day: string, field: "open" | "close" | "closed", val: string | boolean) => {
    setHours((prev) => ({
      ...prev,
      [day]: { ...prev[day], [field]: val },
    }));
    setDirty(true);
  };

  if (!expanded) {
    return (
      <div className={`${CARD} p-4`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-foreground">Weekly Schedule</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Set your open/close hours per day</p>
          </div>
          <button
            onClick={() => setExpanded(true)}
            className="h-9 rounded-xl bg-primary/10 px-4 text-sm font-bold text-primary"
          >
            Edit Schedule
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`${CARD} p-4`}>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-bold text-foreground">Weekly Schedule</p>
        <button onClick={() => setExpanded(false)} className="text-lg leading-none text-muted-foreground">
          <X size={16} />
        </button>
      </div>
      <div className="space-y-2">
        {DAYS.map(({ key, label }) => {
          const day = hours[key] ?? { open: "08:00", close: "22:00" };
          const isClosed = day.closed === true;
          return (
            <div
              key={key}
              className="flex items-center gap-2 border-b border-border py-1.5 last:border-0"
            >
              <div className="w-20 flex-shrink-0">
                <p className="text-xs font-semibold text-muted-foreground">{label.slice(0, 3)}</p>
              </div>
              <label className="flex flex-shrink-0 cursor-pointer items-center gap-1.5">
                <div
                  onClick={() => update(key, "closed", !isClosed)}
                  className={`relative h-5 w-10 cursor-pointer rounded-full transition-colors ${isClosed ? "bg-muted-foreground/40" : "bg-green-400"}`}
                >
                  <div
                    className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${isClosed ? "left-0.5" : "left-5"}`}
                  />
                </div>
                <span
                  className={`text-[10px] font-bold ${isClosed ? "text-muted-foreground" : "text-green-600"}`}
                >
                  {isClosed ? "Closed" : "Open"}
                </span>
              </label>
              {!isClosed && (
                <div className="flex flex-1 items-center gap-1">
                  <input
                    type="time"
                    value={day.open || "08:00"}
                    onChange={(e) => update(key, "open", e.target.value)}
                    className="h-8 flex-1 rounded-lg border border-border bg-muted px-2 text-xs focus:border-primary focus:outline-none"
                  />
                  <span className="text-xs text-muted-foreground">–</span>
                  <input
                    type="time"
                    value={day.close || "22:00"}
                    onChange={(e) => update(key, "close", e.target.value)}
                    className="h-8 flex-1 rounded-lg border border-border bg-muted px-2 text-xs focus:border-primary focus:outline-none"
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex gap-2">
        <button
          onClick={() => {
            setHours(initHours);
            setDirty(false);
            setExpanded(false);
          }}
          className="h-9 flex-1 rounded-xl border border-border text-sm font-bold text-muted-foreground"
        >
          Cancel
        </button>
        <button
          onClick={async () => {
            await onSave(hours);
            setDirty(false);
            setExpanded(false);
          }}
          disabled={!dirty || saving}
          className="h-9 flex-1 rounded-xl bg-primary text-sm font-bold text-primary-foreground disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Schedule"}
        </button>
      </div>
    </div>
  );
}

function VendorNoticeBanner({ message }: { message: string }) {
  const key = `vendor_notice_dismissed_${message.split("").reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0, 0)}`;
  const [dismissed, setDismissed] = useState(() => sessionStorage.getItem(key) === "1");
  if (dismissed) return null;
  const dismiss = () => {
    sessionStorage.setItem(key, "1");
    setDismissed(true);
  };
  return (
    <div className="mb-2 flex items-start gap-3 rounded-2xl border border-primary/20 bg-primary/10 px-4 py-3">
      <span className="mt-0.5 flex-shrink-0 text-base text-primary"><Pin size={16} className="text-primary" /></span>
      <p className="flex-1 text-sm leading-snug font-medium text-primary/80">{message}</p>
      <button
        onClick={dismiss}
        className="flex-shrink-0 text-lg leading-none text-primary/60 hover:text-primary"
      >
        <X size={16} />
      </button>
    </div>
  );
}

function LiveTrackingNotice({
  liveTracking,
  T,
}: {
  liveTracking: boolean;
  T: (k: Parameters<typeof tDual>[0]) => string;
}) {
  const [dismissed, setDismissed] = useState(
    () => sessionStorage.getItem("live_tracking_notice_dismissed") === "1"
  );
  if (liveTracking || dismissed) return null;
  return (
    <div className="fixed right-4 bottom-24 left-4 z-40 flex items-center gap-3 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 shadow-lg md:right-6 md:left-auto md:max-w-sm">
      <MapPin size={18} className="text-amber-500" />
      <div className="flex-1">
        <p className="text-xs font-bold text-amber-800">{T("liveTrackingDisabled")}</p>
        <p className="text-xs text-amber-600">{T("liveTrackingUnavailable")}</p>
      </div>
      <button
        onClick={() => {
          sessionStorage.setItem("live_tracking_notice_dismissed", "1");
          setDismissed(true);
        }}
        className="flex-shrink-0 text-lg leading-none text-amber-500 hover:text-amber-700"
      >
        <X size={16} />
      </button>
    </div>
  );
}

export default function Dashboard() {
  const { user, refreshUser } = useAuth();
  const { config } = usePlatformConfig();
  const { language } = useLanguage();
  const T = (key: Parameters<typeof tDual>[0]) => tDual(key, language);
  const qc = useQueryClient();
  const { isOnline, pendingProductCount } = useOfflineQueue();
  const [pendingOrderIds, setPendingOrderIds] = useState<Set<string>>(new Set());
  const [cancelDialog, setCancelDialog] = useState<{ orderId: string } | null>(null);
  const [acceptDialog, setAcceptDialog] = useState<{ orderId: string; total: number } | null>(null);
  const cancelReasonRef = useRef("");

  const {
    data: stats,
    isLoading,
    isError: statsError,
    refetch: refetchStats,
    dataUpdatedAt: statsUpdatedAt,
    isFetching: statsFetching,
  } = useQuery({
    queryKey: ["vendor-stats"],
    queryFn: () => api.getStats(),
    refetchInterval: 60000,
    staleTime: 30000,
  });
  const { data: ordersData } = useQuery({
    queryKey: ["vendor-orders", "all"],
    queryFn: () => api.getOrders(),
    refetchInterval: 20000,
    staleTime: 15000,
  });
  const { data: daStatus } = useQuery({
    queryKey: ["vendor-delivery-access"],
    queryFn: () => api.getDeliveryAccessStatus(),
    refetchInterval: 60000,
    staleTime: 40000,
  });
  const requestDeliveryMut = useMutation({
    mutationFn: (data: { serviceType?: string; reason?: string }) =>
      api.requestDeliveryAccess(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["vendor-delivery-access"] });
      toast({ title: "✅ Delivery access request submitted" });
    },
    onError: (e: Error) => toast({ title: "❌ " + errMsg(e), variant: "destructive" }),
  });

  const { isOpen, storeHours, toggle, isPending: togglePending } = useStoreStatus({
    onError: (e) => toast({ title: "❌ " + errMsg(e), variant: "destructive" }),
  });

  const [schedSaving, setSchedSaving] = useState(false);
  const saveSchedule = async (hours: StoreHours) => {
    setSchedSaving(true);
    try {
      await api.updateStore({ storeHours: hours });
      await refreshUser();
      toast({ title: "✅ Schedule saved" });
    } catch (e: unknown) {
      toast({ title: "❌ " + errMsg(e), variant: "destructive" });
    } finally {
      setSchedSaving(false);
    }
  };

  const orderActionMut = useMutation({
    mutationFn: ({
      orderId,
      status,
      reason,
    }: {
      orderId: string;
      status: string;
      reason?: string;
    }) => {
      setPendingOrderIds((s) => new Set(s).add(orderId));
      return api.updateOrder(orderId, status, reason);
    },
    onSuccess: (_, { orderId, status }) => {
      setPendingOrderIds((s) => {
        const n = new Set(s);
        n.delete(orderId);
        return n;
      });
      void qc.invalidateQueries({ queryKey: ["vendor-orders"] });
      void qc.invalidateQueries({ queryKey: ["vendor-stats"] });
      toast({ title: status === "confirmed" ? `✅ ${T("orderAcceptedMsg")}` : `❌ ${T("orderCancelledMsg")}` });
    },
    onError: (e: Error, { orderId }) => {
      setPendingOrderIds((s) => {
        const n = new Set(s);
        n.delete(orderId);
        return n;
      });
      toast({ title: "❌ " + errMsg(e), variant: "destructive" });
    },
  });

  const allOrders = ordersData?.orders || [];
  const pendingOrders = allOrders.filter((o: any) => o.status === "pending");
  const activeOrders = allOrders.filter((o: any) =>
    ["confirmed", "preparing", "ready"].includes(o.status)
  );

  const statItems = [
    {
      label: T("todaysOrders"),
      value: statsError ? "⚠" : String(stats?.today?.orders ?? 0),
      color: statsError ? "text-destructive" : "text-primary",
      bg: statsError ? "bg-destructive/10" : "bg-primary/10",
      icon: "📦",
    },
    {
      label: T("todaysRevenue"),
      value: statsError ? "⚠" : fc(stats?.today?.revenue ?? 0),
      color: statsError ? "text-destructive" : "text-accent",
      bg: statsError ? "bg-destructive/10" : "bg-accent/10",
      icon: "💰",
    },
    {
      label: T("weeklyRevenue"),
      value: statsError ? "⚠" : fc(stats?.week?.revenue ?? 0),
      color: statsError ? "text-destructive" : "text-primary",
      bg: statsError ? "bg-destructive/10" : "bg-primary/10",
      icon: "📅",
    },
    {
      label: T("monthlyRevenue"),
      value: statsError ? "⚠" : fc(stats?.month?.revenue ?? 0),
      color: statsError ? "text-destructive" : "text-primary",
      bg: statsError ? "bg-destructive/10" : "bg-primary/10",
      icon: "📈",
    },
  ];

  const handleRefresh = useCallback(async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["vendor-stats"] }),
      qc.invalidateQueries({ queryKey: ["vendor-orders"] }),
    ]);
  }, [qc]);

  return (
    <PullToRefresh
      onRefresh={handleRefresh}
      className="min-h-screen bg-background md:bg-transparent"
    >
      <OfflineBanner show={!isOnline} />
      {/* ── Header ── */}
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            <span>{user?.storeName || "Dashboard"}</span>
            {user?.isVerified && (
              <span className="rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-bold text-green-700 md:bg-white/20 md:text-white">
                ✓ Verified
              </span>
            )}
          </span>
        }
        subtitle={
          <span className="flex items-center gap-2">
            <span>
              {user?.storeCategory
                ? `${user.storeCategory} · ${config.platform.appName} Partner`
                : `${config.platform.appName} Vendor Portal`}
            </span>
            {statsUpdatedAt > 0 && (
              <span className={`text-[10px] font-semibold ${statsFetching ? "text-primary/60" : "text-muted-foreground"}`}>
                {statsFetching
                  ? "Syncing…"
                  : (() => {
                      const diffMs = Date.now() - statsUpdatedAt;
                      const diffMin = Math.floor(diffMs / 60000);
                      if (diffMin < 1) return "Updated just now";
                      if (diffMin === 1) return "Updated 1 min ago";
                      return `Updated ${diffMin} min ago`;
                    })()}
              </span>
            )}
          </span>
        }
        actions={
          <div className="flex items-center gap-2">
            <span className="hidden text-sm font-medium text-muted-foreground md:block">{T("store")}:</span>
            <button
              onClick={toggle}
              disabled={togglePending}
              className={`relative h-8 w-14 flex-shrink-0 rounded-full transition-all duration-300 focus:outline-none ${isOpen ? "bg-green-400" : "bg-gray-300"}`}
            >
              <div
                className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow-md transition-all duration-300 ${isOpen ? "left-7" : "left-1"}`}
              />
            </button>
            <div className="flex flex-col items-start gap-0.5">
              <StoreStatusBadge isOpen={isOpen} />
              <StoreHoursChip storeHours={storeHours} />
            </div>
          </div>
        }
        mobileContent={
          <div className="flex items-center justify-between rounded-2xl bg-white/20 px-4 py-2.5">
            <div>
              <p className="text-xs font-medium text-orange-100">{T("walletBalance")}</p>
              <p className="text-2xl font-extrabold text-white">{fc(user?.walletBalance ?? "0")}</p>
            </div>
            <div className="text-right">
              <p className="text-xs font-medium text-orange-100">{T("storeStatus")}</p>
              <button
                onClick={toggle}
                disabled={togglePending}
                className={`relative mt-1 block h-7 w-14 rounded-full transition-all duration-300 ${isOpen ? "bg-green-400" : "bg-white/30"}`}
              >
                <div
                  className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all duration-300 ${isOpen ? "left-8" : "left-1"}`}
                />
              </button>
            </div>
          </div>
        }
      />

      <div className="space-y-4 px-4 py-4 md:space-y-0 md:px-0 md:py-0">
        {/* Active Tracker Banner — top position */}
        {config.content.trackerBannerEnabled &&
          config.content.trackerBannerPosition === "top" &&
          activeOrders.length > 0 && (
            <Link
              href="/orders"
              className="mb-2 block rounded-2xl bg-gradient-to-r from-orange-500 to-blue-600 px-4 py-3.5 shadow-lg shadow-orange-200 transition-transform active:scale-[0.98]"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm">
                  <div className="h-3 w-3 animate-pulse rounded-full bg-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-extrabold tracking-tight text-white">
                    {activeOrders.length} Active Order{activeOrders.length > 1 ? "s" : ""}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-white/70">
                    {activeOrders.map((o: any) => `#${o.id?.slice(-6).toUpperCase()}`).join(" · ")}
                  </p>
                </div>
                <div className="flex-shrink-0 rounded-xl bg-white/20 px-3 py-2 text-xs font-extrabold text-white backdrop-blur-sm">
                  Track →
                </div>
              </div>
            </Link>
          )}

        {/* Vendor Notice Banner */}
        {config.content.vendorNotice && (
          <VendorNoticeBanner message={config.content.vendorNotice} />
        )}
        {/* Desktop wallet bar */}
        <div className="mb-6 hidden items-center gap-4 rounded-2xl bg-gradient-to-r from-orange-500 to-blue-600 px-6 py-4 text-white shadow-sm md:flex">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <p className="text-xs font-medium text-orange-100">{T("walletBalance")}</p>
              {user?.isVerified && (
                <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold text-white">
                  ✓ Verified
                </span>
              )}
            </div>
            <p className="text-3xl font-extrabold">{fc(user?.walletBalance ?? "0")}</p>
          </div>
          <div className="border-l border-white/20 pl-4 text-center">
            <p className="text-xs font-medium text-orange-100">{T("commission")}</p>
            <p className="text-3xl font-extrabold">
              {Math.round(100 - (config.platform.vendorCommissionPct ?? DEFAULT_COMMISSION_PCT))}%
            </p>
          </div>
          <div className="border-l border-white/20 pl-4 text-right">
            <p className="text-xs font-medium text-orange-100">{T("allTimeEarned")}</p>
            <p className="text-xl font-extrabold">{fc(user?.stats?.totalRevenue || 0)}</p>
          </div>
        </div>

        {/* ── Stats ── */}
        <div className="grid grid-cols-2 gap-3 md:mb-6 md:grid-cols-4">
          {statItems.map((s) => (
            <div key={s.label} className={`${CARD} p-4 md:p-5`}>
              <div
                className={`h-10 w-10 ${s.bg} mb-3 flex items-center justify-center rounded-xl text-xl`}
              >
                {s.icon}
              </div>
              {isLoading ? (
                <ShimmerStat />
              ) : (
                <p className={`${STAT_VAL} ${s.color} text-xl md:text-2xl`}>{s.value}</p>
              )}
              <p className={`${STAT_LBL}`}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* ── Stats Error ── */}
        {statsError && (
          <div className="mb-4">
            <ErrorState
              title={T("somethingWentWrong")}
              subtitle={T("checkInternetRetry")}
              onRetry={() => refetchStats()}
              retryLabel={T("retry")}
              className="py-8"
            />
          </div>
        )}

        {/* Low Stock Alert */}
        {(stats?.lowStock ?? 0) > 0 && (
          <div className="flex items-center gap-3 rounded-2xl border border-destructive/20 bg-destructive/10 p-4 md:mb-6">
            <span className="text-2xl">⚠️</span>
            <div>
              <p className="text-sm font-bold text-destructive">
                {stats.lowStock} Products Low on Stock
              </p>
              <p className="mt-0.5 text-xs text-destructive/70">Go to Products → update stock</p>
            </div>
          </div>
        )}

        {/* Pending Product Sync Badge */}
        {pendingProductCount > 0 && (
          <div className="flex items-center gap-3 rounded-2xl border border-accent/20 bg-accent/10 p-4 md:mb-6">
            <span className="text-2xl">⏳</span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-accent-foreground">
                {pendingProductCount} product change{pendingProductCount > 1 ? "s" : ""} pending
                sync
              </p>
              <p className="mt-0.5 text-xs text-accent/70">
                Go online to sync your product updates
              </p>
            </div>
            <span className="flex-shrink-0 rounded-full bg-accent/20 px-2.5 py-1 text-xs font-bold text-accent-foreground">
              {pendingProductCount}
            </span>
          </div>
        )}

        {/* Delivery Access Status */}
        {(() => {
          const da = daStatus?.data ?? daStatus;
          if (!da || da.mode === "all") return null;
          const statuses: Record<string, { active: boolean; deliveryLabel?: string }> =
            da.statuses || {};
          const pendingReqs: any[] = da.pendingRequests || [];
          const pendingServiceTypes = new Set(pendingReqs.map((r: any) => r.serviceType || "all"));
          const anyActive = Object.values(statuses).some((s) => s.active);
          const allPending =
            Object.keys(statuses).length > 0 &&
            !anyActive &&
            Object.keys(statuses).every(
              (svc) => pendingServiceTypes.has(svc) || pendingServiceTypes.has("all")
            );

          if (allPending) {
            return (
              <div className="flex items-start gap-3 rounded-2xl border border-blue-200 bg-blue-50 p-4 md:mb-6">
                <Truck className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-500" />
                <div>
                  <p className="text-sm font-bold text-blue-800">
                    Your delivery access request is under review
                  </p>
                  <p className="mt-0.5 text-xs leading-relaxed text-blue-600">
                    Admin is reviewing your request. You'll be notified once approved — no action
                    needed right now.
                  </p>
                </div>
              </div>
            );
          }

          return (
            <div
              className={`overflow-hidden rounded-2xl md:mb-6 ${
                anyActive ? "border border-primary/20" : "border border-accent/20"
              }`}
            >
              <div
                className={`flex items-center gap-3 px-4 py-3 ${
                  anyActive ? "bg-primary/10" : "bg-accent/10"
                }`}
              >
                <Truck className={`h-5 w-5 ${anyActive ? "text-primary" : "text-accent"}`} />
                <p
                  className={`flex-1 text-sm font-bold ${anyActive ? "text-primary" : "text-accent-foreground"}`}
                >
                  Delivery Access
                </p>
              </div>
              <div className="divide-y divide-border bg-card">
                {Object.entries(statuses).map(([svc, info]) => {
                  const hasPendingForService =
                    pendingServiceTypes.has(svc) || pendingServiceTypes.has("all");
                  return (
                    <div key={svc} className="flex items-center gap-3 px-4 py-2.5">
                      <span className="flex-1 text-sm font-medium text-muted-foreground capitalize">
                        {svc}
                      </span>
                      {info.active ? (
                        <span className="rounded-full bg-success/10 px-2.5 py-0.5 text-[10px] font-bold text-success">
                          Active{info.deliveryLabel ? ` · ${info.deliveryLabel}` : ""}
                        </span>
                      ) : hasPendingForService ? (
                        <span className="rounded-full bg-warning/10 px-2.5 py-0.5 text-[10px] font-bold text-warning">
                          ⏳ Pending review
                        </span>
                      ) : (
                        <button
                          onClick={() =>
                            requestDeliveryMut.mutate({
                              serviceType: svc,
                              reason: `Requesting ${svc} delivery access`,
                            })
                          }
                          disabled={requestDeliveryMut.isPending}
                          className="rounded-full bg-accent/10 px-2.5 py-1 text-[10px] font-bold text-accent-foreground hover:bg-accent/20 disabled:opacity-60"
                        >
                          Request
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* Quick Actions */}
        <QuickActions />

        {/* Weekly Store Schedule Editor */}
        <ScheduleEditor storeHours={storeHours} onSave={saveSchedule} saving={schedSaving} />

        {/* ── Desktop: 2-column layout for orders ── */}
        <div className="space-y-4 md:grid md:grid-cols-2 md:gap-6 md:space-y-0">
          {/* Pending Orders */}
          <div>
            {pendingOrders.length > 0 ? (
              <div className={CARD}>
                <div className="flex items-center gap-2 border-b border-primary/10 bg-primary/10 px-4 py-3.5">
                  <span className="text-lg">🔔</span>
                  <div>
                    <p className="text-sm font-bold text-accent-foreground">
                      {pendingOrders.length} {T("newOrders")}!
                    </p>
                    <p className="text-xs text-primary/70">{T("acceptWithinTime")}</p>
                  </div>
                </div>
                <div className="divide-y divide-border">
                  {pendingOrders.map((o: any) => {
                    const isOrderPending = pendingOrderIds.has(o.id);
                    return (
                      <div key={o.id} className="flex items-center gap-3 px-4 py-3">
                        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-primary/10 text-xl">
                          {o.type === "food" ? "🍔" : "🛒"}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-foreground capitalize">{o.type}</p>
                          <p className="font-mono text-xs text-muted-foreground">
                            #{o.id.slice(-6).toUpperCase()} · {fc(o.total)}
                          </p>
                        </div>
                        <div className="flex flex-shrink-0 gap-2">
                          <button
                            onClick={() => setAcceptDialog({ orderId: o.id, total: o.total })}
                            disabled={isOrderPending}
                            className="android-press h-9 min-h-0 rounded-xl bg-success px-4 text-xs font-bold text-success-foreground disabled:opacity-60"
                          >
                            <CheckSquare size={14} className="inline" /> Accept
                          </button>
                          <button
                            onClick={() => {
                              cancelReasonRef.current = "";
                              setCancelDialog({ orderId: o.id });
                            }}
                            disabled={isOrderPending}
                            className="android-press h-9 min-h-0 rounded-xl bg-destructive/10 px-3 text-xs font-bold text-destructive disabled:opacity-60"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className={`${CARD} px-4 py-10 text-center`}>
                <p className="mb-2 text-4xl">📋</p>
                <p className="text-sm font-bold text-muted-foreground">{T("noNewOrders")}</p>
                <p className="mt-1 text-xs text-muted-foreground/60">{T("newOrdersAppearHere")}</p>
              </div>
            )}
          </div>

          {/* Active Orders */}
          <div>
            {activeOrders.length > 0 ? (
              <div className={CARD}>
                <div className="flex items-center justify-between border-b border-border px-4 py-3.5">
                  <p className="text-sm font-bold text-foreground">
                    {activeOrders.length} {T("activeOrders")}
                  </p>
                  <span className={BADGE_BLUE}>
                    {T("inProgress")}
                  </span>
                </div>
                <div className="divide-y divide-border">
                  {activeOrders.map((o: any) => (
                    <div key={o.id} className="flex items-center justify-between px-4 py-3">
                      <div>
                        <p className="text-sm font-semibold text-foreground capitalize">{o.type}</p>
                        <p className="font-mono text-xs text-muted-foreground">
                          #{(o.id ?? "").slice(-6).toUpperCase()}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-foreground">{fc(o.total)}</p>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${ORDER_STATUS_BADGE[o.status] ?? "bg-primary/10 text-primary"}`}
                        >
                          {(o.status ?? "").toUpperCase()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className={`${CARD} px-4 py-10 text-center`}>
                <p className="mb-2 text-4xl">🍳</p>
                <p className="text-sm font-bold text-muted-foreground">{T("noActiveOrdersLabel")}</p>
                <p className="mt-1 text-xs text-muted-foreground/60">{T("activeOrdersShowHere")}</p>
              </div>
            )}
          </div>
        </div>

        {/* Commission Banner — mobile only (desktop shows in header) */}
        <div className="rounded-2xl bg-gradient-to-r from-orange-500 to-blue-600 p-4 text-white shadow-sm md:hidden">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-orange-100">{T("yourCommission")}</p>
              <p className="text-4xl font-extrabold">
                {Math.round(100 - (config.platform.vendorCommissionPct ?? DEFAULT_COMMISSION_PCT))}%
              </p>
              <p className="mt-0.5 text-xs text-orange-100">{T("ofEveryOrder")}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-orange-100">{T("allTimeEarned")}</p>
              <p className="text-2xl font-extrabold">{fc(user?.stats?.totalRevenue || 0)}</p>
            </div>
          </div>
        </div>

        {/* Notifications Section */}
        <NotificationsSection />

        {/* Active Tracker Banner — bottom position */}
        {config.content.trackerBannerEnabled &&
          config.content.trackerBannerPosition === "bottom" &&
          activeOrders.length > 0 && (
            <Link
              href="/orders"
              className="mt-4 block rounded-2xl bg-gradient-to-r from-orange-500 to-blue-600 px-4 py-3.5 shadow-lg shadow-orange-200 transition-transform active:scale-[0.98]"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm">
                  <div className="h-3 w-3 animate-pulse rounded-full bg-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-extrabold tracking-tight text-white">
                    {activeOrders.length} Active Order{activeOrders.length > 1 ? "s" : ""}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-white/70">
                    {activeOrders.map((o: any) => `#${o.id?.slice(-6).toUpperCase()}`).join(" · ")}
                  </p>
                </div>
                <div className="flex-shrink-0 rounded-xl bg-white/20 px-3 py-2 text-xs font-extrabold text-white backdrop-blur-sm">
                  Track →
                </div>
              </div>
            </Link>
          )}
      </div>

      {/* Live Tracking disabled notice — dismissable once per session */}
      <LiveTrackingNotice liveTracking={config.features.liveTracking} T={T} />

      {/* Accept order confirmation dialog */}
      {acceptDialog && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm md:items-center"
          onClick={() => setAcceptDialog(null)}
        >
          <div
            className="w-full max-w-md rounded-t-3xl bg-card p-6 shadow-2xl md:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-1 text-lg font-extrabold text-foreground">{T("acceptOrder")}?</h3>
            <p className="mb-4 text-sm text-muted-foreground">
              {T("reviewConfirm")} ({fc(acceptDialog.total)})
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setAcceptDialog(null)}
                className="h-11 flex-1 rounded-xl border-2 border-border text-sm font-bold text-muted-foreground"
              >
                ← {T("back")}
              </button>
              <button
                onClick={() => {
                  orderActionMut.mutate({ orderId: acceptDialog.orderId, status: "confirmed" });
                  setAcceptDialog(null);
                }}
                className="h-11 flex-1 rounded-xl bg-success text-sm font-bold text-success-foreground"
              >
                ✓ {T("confirmLabel")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel order dialog with reason */}
      {cancelDialog && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm md:items-center"
          onClick={() => setCancelDialog(null)}
        >
          <div
            className="w-full max-w-md rounded-t-3xl bg-card p-6 shadow-2xl md:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-1 text-lg font-extrabold text-foreground">{T("cancelOrder")}</h3>
            <p className="mb-4 text-sm text-muted-foreground">{T("cancelConfirmMsg")}</p>
            <label className="mb-1.5 block text-xs font-bold tracking-wider text-muted-foreground uppercase">
              {T("reason")} ({T("noteOptional")})
            </label>
            <textarea
              rows={3}
              defaultValue={cancelReasonRef.current}
              onChange={(e) => {
                cancelReasonRef.current = e.target.value;
              }}
              placeholder="e.g. Item not available, store closing..."
              className="mb-4 w-full resize-none rounded-xl border border-border bg-muted px-3 py-2.5 text-sm focus:border-primary focus:outline-none"
            />
            <div className="flex gap-3">
              <button
                onClick={() => setCancelDialog(null)}
                className="h-11 flex-1 rounded-xl border-2 border-border text-sm font-bold text-muted-foreground"
              >
                ← {T("back")}
              </button>
              <button
                onClick={() => {
                  orderActionMut.mutate({
                    orderId: cancelDialog.orderId,
                    status: "cancelled",
                    reason: cancelReasonRef.current || undefined,
                  });
                  setCancelDialog(null);
                }}
                className="h-11 flex-1 rounded-xl bg-destructive text-sm font-bold text-destructive-foreground"
              >
                <X size={14} className="inline" /> {T("cancelConfirm")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Chat Support FAB (only when feature_chat is on) */}
      {config.features.chat && (
        <a
          href={`https://wa.me/${config.platform.supportPhone.replace(/^0/, "92")}`}
          target="_blank"
          rel="noopener noreferrer"
          className="fixed right-4 bottom-24 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-green-500 text-2xl text-white shadow-2xl transition-all hover:bg-green-600 active:scale-95 md:bottom-6"
          title={config.content.supportMsg || "Live Support"}
        >
          💬
        </a>
      )}

    </PullToRefresh>
  );
}
