/* ── RIDER DASHBOARD ── VARIANT 2: BOLD
   High-contrast, dramatic gradients, big typography, punchy colors.
   Uses deep navy + electric gold + vivid greens. More visual weight.
   Cards have pronounced shadows and 3D depth cues.
   ──────────────────────────────────────────────────────────────────────── */

import {
  Bike,
  Car,
  ChevronRight,
  Clock,
  Flame,
  MapPin,
  Navigation,
  Package,
  Pencil,
  Radio,
  ShoppingBag,
  ShoppingCart,
  Target,
  TrendingUp,
  Trophy,
  Volume2,
  VolumeX,
  Wifi,
  Zap,
} from "lucide-react";
import { useState } from "react";

const USER = {
  name: "Usman",
  isOnline: true,
  rating: 4.85,
  earningsToday: 2840,
  deliveriesToday: 7,
  weekEarnings: 15200,
  totalDeliveries: 3124,
  dailyGoal: 3000,
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

const STYLE = `
  @keyframes popIn { from { opacity:0; transform:scale(0.92) translateY(12px); } to { opacity:1; transform:scale(1) translateY(0); } }
  @keyframes borderFlow { 0% { background-position: 0% 50%; } 100% { background-position: 200% 50%; } }
`;

const BG = "#080c14";
const CARD = "#111827";
const GOLD = "#f0b90b";
const GREEN = "#10b981";
const GREEN_BRIGHT = "#34d399";
const WHITE = "#f8fafc";
const WHITE_MUTED = "#94a3b8";
const WHITE_DIM = "#475569";

function formatCurrency(v: number, s = "Rs.") { return `${s}${v.toLocaleString("en-PK")}`; }

function OrderIcon({ t }: { t: string }) {
  if (t === "food") return <ShoppingBag size={18} className="text-orange-400" />;
  if (t === "mart") return <ShoppingCart size={18} className="text-sky-400" />;
  return <Package size={18} className="text-violet-400" />;
}
function RideIcon({ t }: { t: string }) {
  if (t === "car") return <Car size={18} className="text-sky-400" />;
  return <Bike size={18} className="text-emerald-400" />;
}

/* ── Header ── */
function Header({ name, rating }: { name: string; rating: number }) {
  return (
    <div className="flex items-center justify-between px-5 pt-5 pb-2">
      <div>
        <p className="text-[10px] font-bold tracking-[0.15em] uppercase" style={{ color: WHITE_DIM }}>Good Morning</p>
        <p className="text-2xl font-black tracking-tight mt-0.5" style={{ color: WHITE }}>{name}</p>
      </div>
      <div className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-black"
        style={{ background: "linear-gradient(135deg, rgba(240,185,11,0.15), rgba(240,185,11,0.05))", border: "1px solid rgba(240,185,11,0.2)", color: GOLD }}>
        ★ {rating.toFixed(2)}
      </div>
    </div>
  );
}

/* ── Online Status ── */
function OnlineStatus({ online }: { online: boolean }) {
  const [silence, setSilence] = useState(false);
  return (
    <div className="mx-4 mt-4 rounded-2xl border-2 p-4"
      style={{
        background: online
          ? "linear-gradient(135deg, rgba(16,185,129,0.08), rgba(6,78,59,0.12))"
          : CARD,
        borderColor: online ? "rgba(16,185,129,0.3)" : "rgba(255,255,255,0.06)",
      }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3.5">
          <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl"
            style={{ background: online ? "rgba(16,185,129,0.15)" : "rgba(255,255,255,0.04)" }}>
            {online && (
              <span className="absolute inset-0 rounded-2xl animate-ping opacity-30" style={{ background: GREEN, animationDuration: "2s" }} />
            )}
            {online ? <Zap size={26} className="text-green-400" /> : <Wifi size={26} style={{ color: WHITE_DIM }} />}
          </div>
          <div>
            <p className="text-lg font-black" style={{ color: WHITE }}>{online ? "ONLINE" : "OFFLINE"}</p>
            <p className="text-[11px] mt-0.5 font-medium" style={{ color: WHITE_MUTED }}>
              {online ? "Accepting orders & ride requests" : "Tap to start earning"}
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <button
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[10px] font-black transition-all"
            style={{
              background: silence ? "rgba(239,68,68,0.15)" : "rgba(255,255,255,0.06)",
              color: silence ? "#ef4444" : WHITE_MUTED,
              border: `1px solid ${silence ? "rgba(239,68,68,0.2)" : "rgba(255,255,255,0.08)"}`,
            }}
            onClick={() => setSilence(!silence)}>
            {silence ? <VolumeX size={13} /> : <Volume2 size={13} />}
            {silence ? "MUTED" : "SOUND"}
          </button>
          <button
            className="h-11 rounded-xl px-5 text-sm font-black transition-all active:scale-95"
            style={{
              background: online
                ? "linear-gradient(135deg, #ef4444, #dc2626)"
                : "linear-gradient(135deg, #10b981, #059669)",
              color: "#fff",
              boxShadow: online
                ? "0 4px 16px rgba(239,68,68,0.3)"
                : "0 4px 16px rgba(16,185,129,0.3)",
            }}>
            {online ? "STOP" : "GO ONLINE"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Stats ── */
function Stats({ d, e, w, t }: { d: number; e: number; w: number; t: number }) {
  const items = [
    { value: String(d), sub: "DELIVERIES", icon: <Package size={16} />, color: "#6366f1", shadow: "rgba(99,102,241,0.3)" },
    { value: formatCurrency(e), sub: "EARNED TODAY", icon: <TrendingUp size={16} />, color: GREEN, shadow: "rgba(16,185,129,0.3)" },
    { value: formatCurrency(w), sub: "THIS WEEK", icon: <Trophy size={16} />, color: GOLD, shadow: "rgba(245,158,11,0.3)" },
    { value: String(t), sub: "LIFETIME", icon: <Flame size={16} />, color: "#f43f5e", shadow: "rgba(244,63,94,0.3)" },
  ];
  return (
    <div className="mt-4 px-4 grid grid-cols-2 gap-2.5">
      {items.map((s, i) => (
        <div key={s.sub} className="rounded-2xl p-4 relative overflow-hidden"
          style={{
            background: CARD,
            border: "1px solid rgba(255,255,255,0.05)",
            animation: `popIn 0.4s cubic-bezier(0.16,1,0.3,1) ${i * 90}ms both`,
          }}>
          <div className="absolute top-0 right-0 h-16 w-16 rounded-bl-full opacity-10" style={{ background: s.color }} />
          <div className="flex h-9 w-9 items-center justify-center rounded-xl mb-3 shadow-lg"
            style={{ background: s.color, boxShadow: `0 4px 12px ${s.shadow}` }}>
            <span className="text-white">{s.icon}</span>
          </div>
          <p className="text-xl font-black tracking-tight" style={{ color: WHITE }}>{s.value}</p>
          <p className="text-[9px] mt-1 font-bold tracking-[0.12em]" style={{ color: WHITE_DIM }}>{s.sub}</p>
        </div>
      ))}
    </div>
  );
}

/* ── Goal ── */
function Goal({ earned, goal }: { earned: number; goal: number }) {
  const pct = Math.min(100, Math.round((earned / goal) * 100));
  return (
    <div className="mx-4 mt-3 rounded-2xl border-2 p-4"
      style={{
        background: CARD,
        borderColor: pct >= 100 ? "rgba(16,185,129,0.3)" : "rgba(240,185,11,0.2)",
      }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl"
            style={{
              background: pct >= 100
                ? "linear-gradient(135deg, rgba(16,185,129,0.2), rgba(16,185,129,0.1))"
                : "linear-gradient(135deg, rgba(240,185,11,0.15), rgba(240,185,11,0.05))",
              border: `1px solid ${pct >= 100 ? "rgba(16,185,129,0.25)" : "rgba(240,185,11,0.2)"}`,
            }}>
            <Target size={18} style={{ color: pct >= 100 ? GREEN_BRIGHT : GOLD }} />
          </div>
          <div>
            <p className="text-sm font-black" style={{ color: WHITE }}>
              {pct >= 100 ? "GOAL SMASHED!" : `${formatCurrency(goal - earned)} TO GO`}
            </p>
            <p className="text-[10px] font-medium" style={{ color: WHITE_MUTED }}>
              {formatCurrency(earned)} / {formatCurrency(goal)}
            </p>
          </div>
        </div>
        <button className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[10px] font-black"
          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: WHITE_DIM }}>
          <Pencil size={10} /> EDIT
        </button>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full" style={{ background: "rgba(255,255,255,0.06)" }}>
        <div className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${pct}%`,
            background: pct >= 100
              ? "linear-gradient(90deg, #10b981, #34d399)"
              : "linear-gradient(90deg, #f59e0b, #fbbf24, #f59e0b)",
            backgroundSize: "200% 100%",
            animation: pct < 100 ? "borderFlow 2s linear infinite" : "none",
          }} />
      </div>
      <p className="mt-2 text-[11px] font-bold" style={{ color: WHITE_DIM }}>{pct}% COMPLETE</p>
    </div>
  );
}

/* ── Active Task ── */
function ActiveTask() {
  return (
    <div className="mx-4 mt-3 rounded-2xl border-2 p-3.5"
      style={{
        background: "linear-gradient(135deg, rgba(16,185,129,0.12), rgba(6,78,59,0.2))",
        borderColor: "rgba(16,185,129,0.35)",
        boxShadow: "0 8px 32px rgba(16,185,129,0.15)",
      }}>
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl"
          style={{ background: "rgba(16,185,129,0.2)", border: "1px solid rgba(16,185,129,0.25)" }}>
          <div className="h-3 w-3 animate-pulse rounded-full bg-green-400 shadow-[0_0_12px_rgba(74,222,128,0.6)]" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black" style={{ color: WHITE }}>ACTIVE DELIVERY</p>
          <p className="text-[11px] truncate font-medium" style={{ color: GREEN_BRIGHT }}>
            Bismillah Biryani → House 42-C, Mirpur
          </p>
        </div>
        <div className="flex flex-shrink-0 items-center gap-1 rounded-xl px-3 py-2 text-xs font-black text-white"
          style={{ background: "rgba(16,185,129,0.25)", border: "1px solid rgba(16,185,129,0.3)" }}>
          TRACK <ChevronRight size={12} />
        </div>
      </div>
    </div>
  );
}

/* ── Request Header ── */
function RequestHeader({ total }: { total: number }) {
  return (
    <div className="flex items-center justify-between px-4 py-3.5 mt-4"
      style={{
        background: total > 0
          ? "linear-gradient(90deg, #f97316, #eab308)"
          : CARD,
        borderTop: total === 0 ? "1px solid rgba(255,255,255,0.06)" : "none",
      }}>
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg"
          style={{ background: total > 0 ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.05)" }}>
          {total > 0 ? <Zap size={15} className="text-white" /> : <Radio size={15} style={{ color: WHITE_MUTED }} />}
        </div>
        <p className="text-sm font-black" style={{ color: total > 0 ? "#fff" : WHITE }}>
          {total > 0 ? `${total} REQUESTS AVAILABLE` : "LISTENING FOR REQUESTS"}
        </p>
      </div>
      {total > 0 && (
        <span className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-black tracking-wider text-white"
          style={{ background: "rgba(255,255,255,0.2)", border: "1px solid rgba(255,255,255,0.15)" }}>
          <span className="h-2 w-2 animate-pulse rounded-full bg-green-300 shadow-[0_0_8px_rgba(134,239,172,0.8)]" /> LIVE
        </span>
      )}
    </div>
  );
}

/* ── Order Card ── */
function OrderCard({ order, i }: { order: typeof REQUESTS[0]; i: number }) {
  const [accepted, setAccepted] = useState(false);
  return (
    <div className="mx-4 rounded-2xl border-2 p-4"
      style={{
        background: CARD,
        borderColor: "rgba(255,255,255,0.06)",
        animation: `popIn 0.4s cubic-bezier(0.16,1,0.3,1) ${i * 100}ms both`,
      }}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl"
            style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))" }}>
            <OrderIcon t={order.type} />
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-black truncate" style={{ color: WHITE }}>{order.vendorName}</p>
            <div className="mt-0.5 flex items-center gap-1 text-[10px]" style={{ color: WHITE_MUTED }}>
              <MapPin size={10} /> <span className="truncate">{order.deliveryAddress}</span>
            </div>
          </div>
        </div>
        <div className="text-right">
          <p className="text-base font-black" style={{ color: GREEN_BRIGHT }}>{formatCurrency(order.earnings)}</p>
          <p className="text-[10px] font-medium" style={{ color: WHITE_DIM }}>{order.timeAgo}</p>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2 text-[10px] font-bold" style={{ color: WHITE_DIM }}>
        <span className="px-1.5 py-0.5 rounded-md" style={{ background: "rgba(255,255,255,0.04)" }}>{order.itemCount} items</span>
        <span>{order.distanceKm} km</span>
        <span>Order {formatCurrency(order.orderTotal)}</span>
      </div>
      {!accepted ? (
        <div className="mt-4 flex gap-2.5">
          <button onClick={() => setAccepted(true)}
            className="flex-1 h-12 rounded-xl text-sm font-black text-white transition-all active:scale-[0.96]"
            style={{
              background: "linear-gradient(135deg, #10b981, #059669)",
              boxShadow: "0 4px 16px rgba(16,185,129,0.3)",
            }}>ACCEPT</button>
          <button className="h-12 w-12 flex items-center justify-center rounded-xl border-2 transition-all hover:bg-white/5"
            style={{ borderColor: "rgba(255,255,255,0.08)", color: WHITE_DIM }}><ChevronRight size={18} /></button>
        </div>
      ) : (
        <div className="mt-4 flex h-12 items-center justify-center gap-2 rounded-xl text-sm font-black"
          style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)", color: GREEN_BRIGHT }}>
          <Clock size={16} className="animate-spin" style={{ animationDuration: "2.5s" }} />
          ACCEPTED — NAVIGATE TO PICKUP
        </div>
      )}
    </div>
  );
}

/* ── Ride Card ── */
function RideCard({ ride, i }: { ride: typeof RIDES[0]; i: number }) {
  return (
    <div className="mx-4 rounded-2xl border-2 p-4"
      style={{
        background: CARD,
        borderColor: "rgba(255,255,255,0.06)",
        animation: `popIn 0.4s cubic-bezier(0.16,1,0.3,1) ${(REQUESTS.length + i) * 100}ms both`,
      }}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl"
            style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))" }}>
            <RideIcon t={ride.type} />
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-black" style={{ color: WHITE }}>RIDE REQUEST</p>
            <div className="mt-0.5 flex items-center gap-1 text-[10px]" style={{ color: WHITE_MUTED }}>
              <Navigation size={10} /> <span className="truncate">{ride.pickupAddress}</span>
            </div>
          </div>
        </div>
        <div className="text-right">
          <p className="text-base font-black" style={{ color: GREEN_BRIGHT }}>~{formatCurrency(ride.estimatedFare)}</p>
          <p className="text-[10px] font-medium" style={{ color: WHITE_DIM }}>{ride.timeAgo}</p>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-1 text-[10px] font-bold" style={{ color: WHITE_DIM }}>
        <MapPin size={10} /> <span className="truncate">→ {ride.dropAddress}</span>
        <span>{ride.distanceKm} km</span>
      </div>
      <div className="mt-4 flex gap-2.5">
        <button className="flex-1 h-12 rounded-xl text-sm font-black text-white transition-all active:scale-[0.96]"
          style={{
            background: "linear-gradient(135deg, #10b981, #059669)",
            boxShadow: "0 4px 16px rgba(16,185,129,0.3)",
          }}>ACCEPT</button>
        <button className="flex-1 h-12 rounded-xl border-2 text-sm font-black transition-all hover:bg-white/5"
          style={{ borderColor: "rgba(255,255,255,0.08)", color: WHITE_MUTED }}>COUNTER</button>
        <button className="h-12 w-12 flex items-center justify-center rounded-xl border-2 transition-all hover:bg-white/5"
          style={{ borderColor: "rgba(255,255,255,0.08)", color: WHITE_DIM }}><ChevronRight size={18} /></button>
      </div>
    </div>
  );
}

/* ── Main ── */
export default function Bold() {
  const total = REQUESTS.length + RIDES.length;
  return (
    <div className="min-h-screen w-full" style={{ background: BG, color: WHITE, fontFamily: '"Inter", system-ui, sans-serif' }}>
      <style>{STYLE}</style>
      <div className="max-w-md mx-auto pb-8">
        <Header name={USER.name} rating={USER.rating} />
        <ActiveTask />
        <OnlineStatus online={USER.isOnline} />
        <Stats d={USER.deliveriesToday} e={USER.earningsToday} w={USER.weekEarnings} t={USER.totalDeliveries} />
        <Goal earned={USER.earningsToday} goal={USER.dailyGoal} />
        <RequestHeader total={total} />
        <div className="mt-2 space-y-2.5">
          {REQUESTS.map((o, i) => <OrderCard key={o.id} order={o} i={i} />)}
          {RIDES.map((r, i) => <RideCard key={r.id} ride={r} i={i} />)}
        </div>
        <div className="mt-8 text-center text-[10px]" style={{ color: WHITE_DIM }}>
          AJKMart Rider v2.4.0
        </div>
      </div>
    </div>
  );
}
