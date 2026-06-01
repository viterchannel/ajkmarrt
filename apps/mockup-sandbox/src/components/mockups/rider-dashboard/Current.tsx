/* ── RIDER DASHBOARD — CURRENT (Baseline)
   Exact visual reproduction of the live rider-app Home.tsx dashboard.
   Uses real colors, spacing, icons, and layout from the production code.
   Data is fully mocked with realistic values.
   ─────────────────────────────────────────────────────────────────────────── */

import {
  Bike,
  Calendar,
  Car,
  ChevronRight,
  Clock,
  MapPin,
  Navigation,
  Package,
  Pencil,
  Radio,
  ShoppingBag,
  ShoppingCart,
  Target,
  TrendingUp,
  Truck,
  Trophy,
  Volume2,
  VolumeX,
  Wifi,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

/* ═══════════════════════════════════════════════════════════════════════════
   STYLES — copied verbatim from rider-app/index.css
   ═══════════════════════════════════════════════════════════════════════════ */

const STYLE_SHEET = `
  @keyframes slideUp {
    from { opacity: 0; transform: translateY(10px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes fadeIn {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  @keyframes shimmer {
    0%   { background-position: -200% 0; }
    100% { background-position: 200% 0; }
  }
`;

/* ═══════════════════════════════════════════════════════════════════════════
   MOCK DATA
   ═══════════════════════════════════════════════════════════════════════════ */

const USER = {
  name: "Usman",
  isOnline: true,
  rating: 4.85,
  earningsToday: 2840,
  deliveriesToday: 7,
  weekEarnings: 15200,
  totalDeliveries: 3124,
  dailyGoal: 3000,
  personalGoal: null as number | null,
};

const REQUESTS = [
  {
    id: "ord_8847",
    type: "food" as const,
    vendorName: "Bismillah Biryani House",
    deliveryAddress: "House 42-C, Sector F-2, Mirpur",
    distanceKm: 1.8,
    earnings: 180,
    orderTotal: 1450,
    itemCount: 3,
    timeAgo: "Just now",
  },
  {
    id: "ord_8848",
    type: "mart" as const,
    vendorName: "Savemore Superstore",
    deliveryAddress: "Plot 18, Main Bazaar Road, Muzaffarabad",
    distanceKm: 2.4,
    earnings: 220,
    orderTotal: 2850,
    itemCount: 12,
    timeAgo: "2 min ago",
  },
];

const RIDES = [
  {
    id: "ride_1923",
    type: "bike" as const,
    pickupAddress: "CMH Hospital Gate, Mirpur",
    dropAddress: "University of AJK Campus, Chehla",
    distanceKm: 3.5,
    estimatedFare: 250,
    timeAgo: "1 min ago",
  },
];

/* ═══════════════════════════════════════════════════════════════════════════
   UTILS (exact copies from rider-app components)
   ═══════════════════════════════════════════════════════════════════════════ */

function formatCurrency(value: number, symbol = "Rs."): string {
  return `${symbol}${value.toLocaleString("en-PK")}`;
}

function OrderTypeIcon({ type }: { type: string }) {
  if (type === "food") return <ShoppingBag size={18} className="text-orange-500" />;
  if (type === "mart") return <ShoppingBag size={18} className="text-blue-500" />;
  return <Package size={18} className="text-indigo-500" />;
}

function RideTypeIcon({ type }: { type: string }) {
  if (type === "car") return <Car size={18} className="text-blue-600" />;
  return <Bike size={18} className="text-green-500" />;
}

/* ═══════════════════════════════════════════════════════════════════════════
   SUB-COMPONENTS — extracted & adapted from real source
   ═══════════════════════════════════════════════════════════════════════════ */

function TopHeader({ name, rating }: { name: string; rating: number }) {
  return (
    <div className="flex items-center justify-between px-5 pt-4 pb-2">
      <div>
        <p className="text-xs font-semibold tracking-wide text-white/40 uppercase">
          Good Morning
        </p>
        <p className="text-lg font-extrabold tracking-tight text-white">
          {name}
        </p>
      </div>
      <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
        <span className="text-[11px] font-extrabold text-amber-400">
          ★ {rating.toFixed(2)}
        </span>
      </div>
    </div>
  );
}

function OnlineToggle({ online }: { online: boolean }) {
  const [silence, setSilence] = useState(false);
  return (
    <div className="mx-4 mt-3 rounded-2xl border p-3.5 backdrop-blur-sm transition-all duration-300"
      style={{
        borderColor: online ? "rgba(34,197,94,0.2)" : "rgba(255,255,255,0.08)",
        background: online
          ? "linear-gradient(135deg, rgba(34,197,94,0.08), rgba(16,185,129,0.04))"
          : "rgba(255,255,255,0.03)",
      }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl"
            style={{ background: online ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.06)" }}>
            {online ? <Zap size={22} className="text-green-400" /> : <Wifi size={22} className="text-white/40" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <div className={`h-2.5 w-2.5 rounded-full ${online ? "animate-pulse bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.6)]" : "bg-gray-500"}`} />
              <p className="text-lg font-extrabold tracking-tight text-white">
                {online ? "Online" : "Offline"}
              </p>
            </div>
            <p className="mt-0.5 text-xs text-white/40">
              {online ? "Accepting orders & ride requests" : "Tap to start earning"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            className={`flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 transition-all ${silence ? "border border-red-500/20 bg-red-500/20 text-red-400" : "border border-white/10 bg-white/10 text-white/40"}`}>
            {silence ? <VolumeX size={15} /> : <Volume2 size={15} />}
            <span className="text-[10px] leading-none font-bold">{silence ? "Off" : "On"}</span>
          </button>
          <button
            className="h-10 rounded-xl px-4 text-sm font-bold transition-all"
            style={{
              background: online ? "#22c55e" : "rgba(255,255,255,0.08)",
              color: online ? "#fff" : "rgba(255,255,255,0.4)",
            }}>
            {online ? "Stop" : "Go Online"}
          </button>
        </div>
      </div>
    </div>
  );
}

function StatsStrip({
  deliveriesToday,
  earningsToday,
  weekEarnings,
  totalDeliveries,
  maxDeliveries = 3,
}: {
  deliveriesToday: number;
  earningsToday: number;
  weekEarnings: number;
  totalDeliveries: number;
  maxDeliveries?: number;
}) {
  const stats = [
    { icon: <Package size={15} className="text-indigo-300" />, label: "Today", value: String(deliveriesToday), sub: "deliveries" },
    { icon: <TrendingUp size={15} className="text-green-300" />, label: "Earned", value: formatCurrency(earningsToday), sub: "today" },
    { icon: <Calendar size={15} className="text-blue-300" />, label: "Week", value: formatCurrency(weekEarnings), sub: "earnings" },
    { icon: <Trophy size={15} className="text-amber-300" />, label: "Total", value: String(totalDeliveries), sub: "lifetime" },
  ];

  return (
    <div className="mt-3 space-y-2 px-4">
      <div className="grid grid-cols-4 gap-2" role="list">
        {stats.map((s, i) => (
          <div
            key={s.label}
            className="rounded-2xl border p-2.5 text-center backdrop-blur-sm"
            style={{
              borderColor: "rgba(255,255,255,0.06)",
              background: "rgba(255,255,255,0.03)",
              animation: `slideUp 0.3s ease-out ${i * 60}ms both`,
            }}
            role="listitem">
            <div className="mb-1.5 flex justify-center">
              <div className="flex h-7 w-7 items-center justify-center rounded-xl"
                style={{ background: "rgba(255,255,255,0.06)" }}>
                {s.icon}
              </div>
            </div>
            <p className="text-[13px] leading-tight font-extrabold text-white">{s.value}</p>
            <p className="mt-0.5 text-[9px] font-semibold tracking-wider text-white/30 uppercase">{s.sub}</p>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 rounded-2xl border px-3 py-2 backdrop-blur-sm"
        style={{ borderColor: "rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.03)" }}>
        <Truck size={13} className="flex-shrink-0 text-indigo-300" />
        <p className="text-[11px] font-semibold text-white/60">
          Max simultaneous deliveries: <span className="font-extrabold text-white">{maxDeliveries}</span>
        </p>
      </div>
    </div>
  );
}

function DailyGoal({ todayEarnings, dailyGoal }: { todayEarnings: number; dailyGoal: number }) {
  const pct = Math.min(100, Math.round((todayEarnings / dailyGoal) * 100));
  const reached = pct >= 100;
  return (
    <div className="mx-4 mt-3 rounded-2xl border p-3.5 backdrop-blur-sm"
      style={{ borderColor: "rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.03)" }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl"
            style={{ background: reached ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.06)" }}>
            <Target size={18} className={reached ? "text-green-400" : "text-white/40"} />
          </div>
          <div>
            <p className="text-sm font-extrabold tracking-tight text-white">
              {reached ? "Goal reached!" : `${formatCurrency(dailyGoal - todayEarnings)} to go`}
            </p>
            <p className="text-[10px] text-white/40">
              {formatCurrency(todayEarnings)} / {formatCurrency(dailyGoal)} today
            </p>
          </div>
        </div>
        <button className="flex items-center gap-1 rounded-lg border border-white/10 px-2 py-1 text-[10px] font-bold text-white/50 hover:bg-white/5">
          <Pencil size={10} /> Edit
        </button>
      </div>
      <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${pct}%`,
            background: reached
              ? "linear-gradient(90deg, #22c55e, #34d399)"
              : "linear-gradient(90deg, #f59e0b, #fbbf24)",
          }}
        />
      </div>
    </div>
  );
}

function RequestListHeader({ total }: { total: number }) {
  return (
    <div className={`flex items-center justify-between px-4 py-3.5 mt-3 ${total > 0
      ? "bg-gradient-to-r from-orange-500 via-orange-500 to-amber-500"
      : "bg-[#1a1d24]"}`}>
      <div className="flex items-center gap-2.5">
        {total > 0 ? (
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/20">
            <Zap size={14} className="text-white" />
          </div>
        ) : (
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/10">
            <Radio size={14} className="text-white/70" />
          </div>
        )}
        <div>
          <p className="text-sm font-extrabold tracking-tight text-white">
            {total > 0 ? `${total} Request${total > 1 ? "s" : ""} Available` : "Listening for requests"}
          </p>
          {total > 0 && <p className="text-[10px] font-medium text-white/60">Tap to accept</p>}
        </div>
      </div>
      {total > 0 && (
        <span className="flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-[10px] font-extrabold tracking-widest text-white/90 backdrop-blur-sm">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-400" />
          LIVE
        </span>
      )}
    </div>
  );
}

function OrderCard({
  order,
  index,
}: {
  order: typeof REQUESTS[0];
  index: number;
}) {
  const [accepted, setAccepted] = useState(false);
  return (
    <div className="animate-[slideUp_0.3s_ease-out] mx-4 rounded-2xl border p-3.5 backdrop-blur-sm"
      style={{
        borderColor: "rgba(255,255,255,0.06)",
        background: "rgba(255,255,255,0.03)",
        animationDelay: `${index * 100}ms`,
        animationFillMode: "both",
      }}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl"
            style={{ background: "rgba(255,255,255,0.06)" }}>
            <OrderTypeIcon type={order.type} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-extrabold tracking-tight text-white truncate">{order.vendorName}</p>
            <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-white/40">
              <MapPin size={11} />
              <span className="truncate">{order.deliveryAddress}</span>
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end">
          <p className="text-sm font-extrabold text-green-400">{formatCurrency(order.earnings)}</p>
          <p className="text-[10px] text-white/30">{order.timeAgo}</p>
        </div>
      </div>
      <div className="mt-2 flex items-center gap-3 text-[11px] text-white/40">
        <span>{order.itemCount} items</span>
        <span className="text-white/20">|</span>
        <span>{order.distanceKm} km</span>
        <span className="text-white/20">|</span>
        <span>Order {formatCurrency(order.orderTotal)}</span>
      </div>
      <div className="mt-3 flex gap-2">
        {!accepted ? (
          <>
            <button
              onClick={() => setAccepted(true)}
              className="flex-1 h-11 rounded-xl bg-green-500 text-sm font-extrabold text-white shadow-lg shadow-green-500/20 transition-all active:scale-[0.97] hover:bg-green-400">
              Accept
            </button>
            <button className="h-11 w-11 flex items-center justify-center rounded-xl border border-white/10 text-white/40 transition-all hover:bg-white/5">
              <ChevronRight size={18} />
            </button>
          </>
        ) : (
          <div className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-green-500/15 text-sm font-extrabold text-green-400">
            <Clock size={16} className="animate-spin" style={{ animationDuration: "2s" }} />
            Accepted — navigate to pickup
          </div>
        )}
      </div>
    </div>
  );
}

function RideCard({ ride, index }: { ride: typeof RIDES[0]; index: number }) {
  return (
    <div className="animate-[slideUp_0.3s_ease-out] mx-4 rounded-2xl border p-3.5 backdrop-blur-sm"
      style={{
        borderColor: "rgba(255,255,255,0.06)",
        background: "rgba(255,255,255,0.03)",
        animationDelay: `${(REQUESTS.length + index) * 100}ms`,
        animationFillMode: "both",
      }}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl"
            style={{ background: "rgba(255,255,255,0.06)" }}>
            <RideTypeIcon type={ride.type} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-extrabold tracking-tight text-white">Ride Request</p>
            <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-white/40">
              <Navigation size={11} />
              <span className="truncate">{ride.pickupAddress}</span>
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end">
          <p className="text-sm font-extrabold text-green-400">~{formatCurrency(ride.estimatedFare)}</p>
          <p className="text-[10px] text-white/30">{ride.timeAgo}</p>
        </div>
      </div>
      <div className="mt-2 flex items-center gap-1.5 text-[11px] text-white/40">
        <MapPin size={11} />
        <span className="truncate">→ {ride.dropAddress}</span>
        <span className="text-white/20">|</span>
        <span>{ride.distanceKm} km</span>
      </div>
      <div className="mt-3 flex gap-2">
        <button className="flex-1 h-11 rounded-xl bg-green-500 text-sm font-extrabold text-white shadow-lg shadow-green-500/20 transition-all active:scale-[0.97] hover:bg-green-400">
          Accept
        </button>
        <button className="h-11 flex-1 rounded-xl border border-white/10 text-sm font-bold text-white/50 transition-all hover:bg-white/5">
          Counter
        </button>
        <button className="h-11 w-11 flex items-center justify-center rounded-xl border border-white/10 text-white/40 transition-all hover:bg-white/5">
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );
}

function ActiveTaskBanner({ type }: { type: "order" | "ride" }) {
  const isOrder = type === "order";
  return (
    <div className="mx-4 mt-3 animate-[slideUp_0.3s_ease-out] rounded-3xl px-4 py-3.5 shadow-lg transition-transform active:scale-[0.98]"
      style={{
        background: isOrder
          ? "linear-gradient(90deg, #22c55e, #059669)"
          : "linear-gradient(90deg, #f59e0b, #eab308)",
        boxShadow: isOrder ? "0 4px 20px rgba(34,197,94,0.25)" : "0 4px 20px rgba(245,158,11,0.25)",
      }}>
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm">
          <div className="h-3 w-3 animate-pulse rounded-full bg-white" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-extrabold tracking-tight text-white">
            {isOrder ? "Active Delivery in Progress" : "Active Ride in Progress"}
          </p>
          <p className="mt-0.5 truncate text-xs text-white/70">
            {isOrder
              ? "Order #A7B9C1 — House 42-C, Sector F-2, Mirpur"
              : "Ride → University of AJK Campus, Chehla"}
          </p>
        </div>
        <div className="flex flex-shrink-0 items-center gap-1 rounded-xl bg-white/20 px-3 py-2 text-xs font-extrabold text-white backdrop-blur-sm">
          Track <ChevronRight size={12} />
        </div>
      </div>
    </div>
  );
}

function FixedBanner() {
  return (
    <div className="flex items-center gap-2 bg-amber-500/10 px-4 py-2 text-[11px] font-semibold text-amber-400 backdrop-blur-sm">
      <Wifi size={12} />
      Socket connected — real-time updates active
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN PREVIEW COMPONENT
   ═══════════════════════════════════════════════════════════════════════════ */

export default function Current() {
  const totalRequests = REQUESTS.length + RIDES.length;

  return (
    <div className="min-h-screen w-full" style={{ background: "#0b0e11", color: "#fff", fontFamily: '"Inter", system-ui, sans-serif' }}>
      <style>{STYLE_SHEET}</style>
      <div className="max-w-md mx-auto pb-8">
        <TopHeader name={USER.name} rating={USER.rating} />
        <FixedBanner />
        <ActiveTaskBanner type="order" />
        <OnlineToggle online={USER.isOnline} />
        <StatsStrip
          deliveriesToday={USER.deliveriesToday}
          earningsToday={USER.earningsToday}
          weekEarnings={USER.weekEarnings}
          totalDeliveries={USER.totalDeliveries}
        />
        <DailyGoal todayEarnings={USER.earningsToday} dailyGoal={USER.dailyGoal} />
        <RequestListHeader total={totalRequests} />
        <div className="mt-1 space-y-3">
          {REQUESTS.map((o, i) => (
            <OrderCard key={o.id} order={o} index={i} />
          ))}
          {RIDES.map((r, i) => (
            <RideCard key={r.id} ride={r} index={i} />
          ))}
        </div>
        <div className="mt-6 flex items-center justify-center gap-2 text-[11px] text-white/20">
          <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
          AJKMart Rider v2.4.0
        </div>
      </div>
    </div>
  );
}
