import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { tDual, type TranslationKey } from "@workspace/i18n";
import {
  AlertTriangle,
  Bell,
  Bike,
  Check,
  CheckCheck,
  ChevronRight,
  Clock,
  Eye,
  Inbox,
  Loader2,
  Package,
  RefreshCw,
  Settings,
  Sparkles,
  Wallet,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "@/hooks/use-toast";
import { PullToRefresh } from "../components/PullToRefresh";
import { ShimmerBlock, ShimmerHeader } from "../components/ui/shimmer";
import { ErrorState } from "../components/ui/ErrorState";
import { api } from "../lib/api";
import { useLanguage } from "../lib/useLanguage";

function SkeletonNotifications() {
  return (
    <div className="min-h-screen bg-page-bg dark:bg-surface">
      <ShimmerHeader>
        <div className="relative mb-4 flex items-center justify-between">
          <div className="space-y-2">
            <ShimmerBlock variant="on-dark" className="h-7 w-36" />
            <ShimmerBlock variant="on-dark" className="h-4 w-28" />
          </div>
          <div className="flex gap-2">
            <ShimmerBlock variant="on-dark" className="h-10 w-10 rounded-xl" />
            <ShimmerBlock variant="on-dark" className="h-10 w-24 rounded-xl" />
          </div>
        </div>
        <div className="relative mt-3 grid grid-cols-4 gap-2.5">
          {[1, 2, 3, 4].map((i) => (
            <ShimmerBlock key={i} variant="on-dark" className="h-20 rounded-2xl" />
          ))}
        </div>
      </ShimmerHeader>
      <div className="space-y-3 px-4 py-4">
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <ShimmerBlock key={i} className="h-10 w-24 flex-shrink-0 rounded-full" />
          ))}
        </div>
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="rounded-3xl border border-border bg-card p-4">
            <div className="flex gap-3">
              <ShimmerBlock className="h-12 w-12 flex-shrink-0 rounded-xl" />
              <div className="flex-1 space-y-2">
                <ShimmerBlock className="h-4 w-3/4 rounded" />
                <ShimmerBlock className="h-3 w-full rounded" />
                <div className="flex gap-2">
                  <ShimmerBlock className="h-3 w-16 rounded" />
                  <ShimmerBlock className="h-3 w-12 rounded" />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const fd = (d: string | Date) => {
  const diff = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(d).toLocaleString("en-PK", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
};

type DateGroupKey = "today" | "yesterday" | "thisWeek" | "earlier";
function dateGroupKey(d: string): DateGroupKey {
  const now = new Date();
  const dt = new Date(d);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (dt >= today) return "today";
  if (dt >= yesterday) return "yesterday";
  const weekAgo = new Date(today);
  weekAgo.setDate(today.getDate() - 7);
  if (dt >= weekAgo) return "thisWeek";
  return "earlier";
}

type NFilter = "all" | "order" | "wallet" | "ride" | "system";

type NotifRecord = {
  id: string;
  type: string;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
  status?: string;
};

type NotifQueryData = {
  notifications: NotifRecord[];
  unread: number;
  total?: number;
};

type TypeInfo = {
  icon: React.ReactElement;
  label: string;
  gradient: string;
  badge: string;
  iconBg: string;
  dotColor: string;
};

function typeInfo(type: string): TypeInfo {
  if (type === "order")
    return {
      icon: <Package size={20} className="text-foreground" />,
      label: "Order",
      gradient: "from-blue-500 to-indigo-600",
      badge: "bg-blue-500/15 text-blue-400",
      iconBg: "bg-gradient-to-br from-blue-500 to-indigo-600",
      dotColor: "bg-blue-500",
    };
  if (type === "wallet")
    return {
      icon: <Wallet size={20} className="text-foreground" />,
      label: "Wallet",
      gradient: "from-green-500 to-emerald-600",
      badge: "bg-success/15 text-success",
      iconBg: "bg-gradient-to-br from-green-500 to-emerald-600",
      dotColor: "bg-success",
    };
  if (type === "ride")
    return {
      icon: <Bike size={20} className="text-foreground" />,
      label: "Ride",
      gradient: "from-purple-500 to-violet-600",
      badge: "bg-purple-100 text-purple-700",
      iconBg: "bg-gradient-to-br from-purple-500 to-violet-600",
      dotColor: "bg-purple-500",
    };
  if (type === "system")
    return {
      icon: <Settings size={20} className="text-foreground" />,
      label: "System",
      gradient: "from-gray-500 to-slate-600",
      badge: "bg-muted text-muted-foreground",
      iconBg: "bg-gradient-to-br from-gray-500 to-slate-600",
      dotColor: "bg-[#B0B0B0]",
    };
  if (type === "alert")
    return {
      icon: <AlertTriangle size={20} className="text-foreground" />,
      label: "Alert",
      gradient: "from-amber-500 to-orange-600",
      badge: "bg-warning/15 text-warning",
      iconBg: "bg-gradient-to-br from-amber-500 to-orange-600",
      dotColor: "bg-warning",
    };
  return {
    icon: <Bell size={20} className="text-foreground" />,
    label: "Other",
    gradient: "from-gray-500 to-slate-600",
    badge: "bg-muted text-muted-foreground",
    iconBg: "bg-gradient-to-br from-gray-500 to-slate-600",
    dotColor: "bg-[#B0B0B0]",
  };
}

function navTarget(type: string, status?: string): string {
  /* Completed order/ride notifications → history; active → active */
  const isCompleted = status === "delivered" || status === "completed" || status === "cancelled";
  if (type === "order") return isCompleted ? "/history" : "/active";
  if (type === "ride") return isCompleted ? "/history" : "/active";
  if (type === "wallet") return "/wallet";
  if (type === "system" || type === "alert") return "/notifications";
  return "/notifications";
}

const STAT_CONFIGS = [
  { label: "Total", key: "total", icon: <Bell size={14} className="text-muted-foreground" /> },
  { label: "Orders", key: "order", icon: <Package size={14} className="text-blue-300" /> },
  { label: "Wallet", key: "wallet", icon: <Wallet size={14} className="text-success" /> },
  { label: "Rides", key: "ride", icon: <Bike size={14} className="text-purple-300" /> },
];

export default function Notifications() {
  const qc = useQueryClient();
  const [, navigate] = useLocation();
  const [filter, setFilter] = useState<NFilter>("all");
  const { language } = useLanguage();
  const T = (key: TranslationKey) => tDual(key, language);
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["rider-notifications"],
    queryFn: () => api.getNotifications(),
    refetchInterval: 30000,
    staleTime: 30_000,
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 30_000),
  });

  const notifs: NotifRecord[] = data?.notifications || [];
  const unread: number = data?.unread || 0;

  const markAllMut = useMutation({
    mutationFn: () => api.markAllRead(),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["rider-notifications"] });
      void qc.invalidateQueries({ queryKey: ["rider-notifs-count"] });
      toast({ title: T("allNotificationsRead") });
    },
    onError: (err: Error) => toast({ title: err.message || T("failedMarkAllRead"), variant: "destructive" }),
  });

  const markOneMut = useMutation({
    mutationFn: (id: string) => api.markOneRead(id),
    onMutate: async (id: string) => {
      /* Optimistic cache update: mark notification as read immediately */
      await qc.cancelQueries({ queryKey: ["rider-notifications"] });
      const prev = qc.getQueryData<NotifQueryData>(["rider-notifications"]);
      if (prev) {
        qc.setQueryData<NotifQueryData>(["rider-notifications"], (old) => {
          if (!old) return old;
          const updated = old.notifications.map((n) => (n.id === id ? { ...n, isRead: true } : n));
          const unreadCount = updated.filter((n) => !n.isRead).length;
          return { ...old, notifications: updated, unread: unreadCount };
        });
      }
      return { prev };
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["rider-notifications"] });
      void qc.invalidateQueries({ queryKey: ["rider-notifs-count"] });
    },
    onError: (err: Error, _id: string, ctx: { prev: NotifQueryData | undefined } | undefined) => {
      /* Revert optimistic update on error */
      if (ctx?.prev) qc.setQueryData(["rider-notifications"], ctx.prev);
      toast({ title: err.message || "Failed to mark as read", variant: "destructive" });
    },
  });

  const DATE_GROUP_LABELS: Record<DateGroupKey, string> = {
    today: T("today"),
    yesterday: T("yesterday"),
    thisWeek: T("thisWeek"),
    earlier: T("earlier"),
  };

  const FILTER_TABS: { key: NFilter; labelKey: TranslationKey; icon: React.ReactElement }[] = [
    { key: "all", labelKey: "all", icon: <Bell size={14} /> },
    { key: "order", labelKey: "orders", icon: <Package size={14} /> },
    { key: "wallet", labelKey: "wallet", icon: <Wallet size={14} /> },
    { key: "ride", labelKey: "rides", icon: <Bike size={14} /> },
    { key: "system", labelKey: "system", icon: <Settings size={14} /> },
  ];

  const filtered =
    filter === "all"
      ? notifs
      : notifs.filter(
          (n) =>
            n.type === filter ||
            (filter === "system" && !["order", "wallet", "ride"].includes(n.type))
        );

  const grouped = useMemo(() => {
    const groups: { key: DateGroupKey; label: string; items: NotifRecord[] }[] = [];
    const groupMap = new Map<DateGroupKey, NotifRecord[]>();
    for (const n of filtered) {
      const gKey = dateGroupKey(n.createdAt);
      if (!groupMap.has(gKey)) {
        const items: typeof filtered = [];
        groupMap.set(gKey, items);
        groups.push({ key: gKey, label: DATE_GROUP_LABELS[gKey], items });
      }
      groupMap.get(gKey)?.push(n);
    }
    return groups;
  }, [filtered, language]); // eslint-disable-line react-hooks/exhaustive-deps

  const filterCounts = useMemo(
    () => ({
      all: notifs.filter((n) => !n.isRead).length,
      order: notifs.filter((n) => n.type === "order" && !n.isRead).length,
      wallet: notifs.filter((n) => n.type === "wallet" && !n.isRead).length,
      ride: notifs.filter((n) => n.type === "ride" && !n.isRead).length,
      system: notifs.filter((n) => !["order", "wallet", "ride"].includes(n.type) && !n.isRead)
        .length,
    }),
    [notifs]
  );

  const statValues: Record<string, number> = {
    total: notifs.length,
    order: notifs.filter((n) => n.type === "order").length,
    wallet: notifs.filter((n) => n.type === "wallet").length,
    ride: notifs.filter((n) => n.type === "ride").length,
  };

  const handlePullRefresh = useCallback(async () => {
    await qc.invalidateQueries({ queryKey: ["rider-notifications"] });
  }, [qc]);

  if (isLoading) return <SkeletonNotifications />;

  if (isError)
    return (
      <div className="flex min-h-screen flex-col bg-page-bg">
        <div
          className="page-header-gradient rounded-b-[2rem] bg-card px-5 py-8"
          style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 3.5rem)" }}
        >
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground">
            {T("notificationsTitle")}
          </h1>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <ErrorState
            title={T("somethingWentWrong")}
            subtitle={T("checkInternetRetry")}
            onRetry={() => refetch()}
            retryLabel={T("retry")}
          />
        </div>
      </div>
    );

  return (
    <PullToRefresh onRefresh={handlePullRefresh} className="min-h-screen bg-page-bg">
      <div
        className="page-header-gradient relative overflow-hidden rounded-b-[2rem] bg-card px-5 pb-8"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 3.5rem)" }}
      >
        <div className="absolute -top-20 -right-20 h-72 w-72 rounded-full bg-success/[0.04]" />
        <div className="absolute bottom-10 -left-16 h-56 w-56 rounded-full bg-muted/20" />
        <div className="absolute top-1/2 left-1/3 h-24 w-24 rounded-full bg-muted/20" />

        <div className="relative mx-auto max-w-2xl mb-5 flex items-start justify-between">
          <div>
            <div className="mb-1.5 flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-border/60 bg-muted/20 backdrop-blur-sm">
                <Bell size={16} className="text-foreground" />
              </div>
              <h1 className="text-2xl font-black tracking-tight text-foreground">
                {T("notificationsTitle")}
              </h1>
            </div>
            <p className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              {unread > 0 ? (
                <>
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-error opacity-75" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-error" />
                  </span>
                  {unread} unread notification{unread !== 1 ? "s" : ""}
                </>
              ) : (
                <>
                  <Sparkles size={14} className="text-success" /> {T("allCaughtUp")}
                </>
              )}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => refetch()}
              aria-label="Refresh notifications"
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-border/60 bg-muted/20 text-foreground backdrop-blur-sm transition-colors active:bg-muted/20"
            >
              <RefreshCw size={16} />
            </button>
            {unread > 0 && (
              <button
                onClick={() => markAllMut.mutate()}
                disabled={markAllMut.isPending}
                aria-label="Mark all notifications as read"
                className="flex h-10 items-center gap-1.5 rounded-xl border border-border/60 bg-muted/20 px-4 text-sm font-bold text-foreground backdrop-blur-sm transition-colors active:bg-muted/20 disabled:opacity-60"
              >
                {markAllMut.isPending ? (
                  <><Loader2 size={15} className="animate-spin" /> Marking...</>
                ) : (
                  <><CheckCheck size={15} /> {T("readAll")}</>
                )}
              </button>
            )}
          </div>
        </div>

        {notifs.length > 0 && (
          <div className="relative grid grid-cols-4 gap-2.5">
            {STAT_CONFIGS.map((s, i) => (
              <div
                key={s.key}
                className="rounded-2xl border border-border/60 bg-muted/20 p-3 text-center backdrop-blur-sm"
                style={{ animationDelay: `${i * 80}ms`, animation: "slideUp 0.4s ease-out both" }}
              >
                <div className="mb-1.5 flex justify-center">{s.icon}</div>
                <p className="text-xl font-black text-foreground">{statValues[s.key]}</p>
                <p className="mt-0.5 text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                  {s.label}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mx-auto w-full max-w-2xl space-y-4 px-4 py-4">
        <div className="no-scrollbar flex gap-2 overflow-x-auto pb-0.5">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`flex flex-shrink-0 items-center gap-2 rounded-full px-4 py-2.5 text-xs font-bold transition-all duration-200 ${
                filter === tab.key
                  ? "bg-brand text-foreground shadow-sm"
                  : "border border-border bg-card text-muted-foreground active:bg-muted"
              }`}
            >
              {tab.icon} {T(tab.labelKey)}
              {filterCounts[tab.key] > 0 && (
                <span
                  className={`flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[9px] font-black ${
                    filter === tab.key
                      ? "bg-muted/20 text-foreground"
                      : "bg-error text-foreground shadow-sm"
                  }`}
                >
                  {filterCounts[tab.key]}
                </span>
              )}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="animate-[fadeIn_0.4s_ease-out] rounded-3xl border border-border bg-card px-4 py-20 text-center shadow-sm">
            <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-[2rem] border border-border bg-muted shadow-inner">
              <Inbox size={44} className="text-muted-foreground" />
            </div>
            <p className="text-xl font-black text-muted-foreground">
              {filter === "all" ? T("noNotificationsYet") : T("noNotifications")}
            </p>
            <p className="mx-auto mt-2.5 max-w-[260px] text-sm leading-relaxed text-muted-foreground">
              {filter === "all" ? T("orderAlertsAppearHere") : T("tryDifferentFilter")}
            </p>
            {filter !== "all" && (
              <button
                onClick={() => setFilter("all")}
                className="mx-auto mt-5 flex items-center gap-2 rounded-full bg-brand px-6 py-3 text-sm font-bold text-foreground shadow-sm transition-transform active:scale-[0.97]"
              >
                <Eye size={14} /> {T("viewAll")}
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-5">
            {grouped.map((group, gi) => (
              <div
                key={group.label}
                style={{ animationDelay: `${gi * 100}ms`, animation: "slideUp 0.4s ease-out both" }}
              >
                <div className="mb-3 flex items-center gap-3 px-1">
                  <div className="flex items-center gap-1.5">
                    <Clock size={11} className="text-muted-foreground" />
                    <p className="text-[11px] font-black tracking-widest text-muted-foreground uppercase">
                      {group.label}
                    </p>
                  </div>
                  <div className="h-px flex-1 bg-gradient-to-r from-gray-200 to-transparent" />
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                    {group.items.length}
                  </span>
                </div>
                <div className="space-y-2.5">
                  {group.items.map((n: NotifRecord, ni: number) => {
                    const info = typeInfo(n.type);
                    const dest = navTarget(n.type, n.status);
                    return (
                      <div
                        key={n.id}
                        className={`overflow-hidden rounded-3xl border bg-card transition-all duration-300 ${dest ? "cursor-pointer" : "cursor-default"} ${
                          !n.isRead
                            ? "border-t border-r border-b border-l-4 border-t-gray-100 border-r-gray-100 border-b-gray-100 border-l-green-500 shadow-lg shadow-success/10"
                            : "border-border shadow-sm"
                        }`}
                        onClick={() => {
                          if (!n.isRead) markOneMut.mutate(n.id);
                          if (dest) navigate(dest);
                        }}
                        style={{
                          animationDelay: `${gi * 100 + ni * 50}ms`,
                          animation: "slideUp 0.4s ease-out both",
                        }}
                      >
                        <div className="flex gap-3.5 px-4 py-4">
                          <div className="relative flex-shrink-0">
                            <div
                              className={`flex h-12 w-12 items-center justify-center rounded-2xl shadow-md ${
                                !n.isRead ? info.iconBg : "bg-muted"
                              }`}
                            >
                              {!n.isRead ? info.icon : <Bell size={20} className="text-muted-foreground" />}
                            </div>
                            {!n.isRead && (
                              <div className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full border-2 border-white bg-success shadow-sm">
                                <div className="h-1.5 w-1.5 rounded-full bg-card" />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <p
                                className={`text-sm leading-snug ${!n.isRead ? "font-black text-foreground" : "font-semibold text-muted-foreground"}`}
                              >
                                {n.title}
                              </p>
                              {!n.isRead && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    markOneMut.mutate(n.id);
                                  }}
                                  aria-label="Mark as read"
                                  className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border border-success/20 bg-success/10 text-success transition-all hover:shadow-md hover:bg-success/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-200 active:bg-success/15"
                                >
                                  <Check size={16} />
                                </button>
                              )}
                            </div>
                            <p
                              className={`mt-1.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground`}
                            >
                              {n.body}
                            </p>
                            <div className="mt-2.5 flex flex-wrap items-center gap-2">
                              <span className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                                <Clock size={9} /> {fd(n.createdAt)}
                              </span>
                              <span
                                className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${info.badge}`}
                              >
                                {info.label}
                              </span>
                              {dest && (
                                <span className="flex items-center gap-0.5 rounded-full border border-border bg-muted px-2.5 py-1 text-[10px] font-bold text-foreground">
                                  View <ChevronRight size={10} />
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </PullToRefresh>
  );
}
