/* ── RIDER DASHBOARD — VARIANT 1: MODERN
   Clean, spacious, refined. More whitespace, lighter dark tones,
   subtle elevation, modern card hierarchy. Keeps the gold accent
   but uses a warmer dark palette. Floating action button.
   ─────────────────────────────────────────────────────────────────────────── */

import {
  ArrowUpRight,
  Bike,
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
  @keyframes fadeUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
  @keyframes pulse-ring { 0% { transform:scale(0.8); opacity:0.6; } 100% { transform:scale(1.6); opacity:0; } }
`;

const BG = "#0d1117";
const CARD = "#161b22";
const CARD_HOVER = "#1c2128";
const BORDER = "rgba(255,255,255,0.05)";
const BORDER_ACTIVE = "rgba(240,185,11,0.25)";
const GOLD = "#f0b90b";
const GOLD_SOFT = "rgba(240,185,11,0.12)";
const TEXT_PRIMARY = "#f0f6fc";
const TEXT_SECONDARY = "#8b949e";
const TEXT_TERTIARY = "#484f58";
const GREEN = "#3fb950";
const GREEN_SOFT = "rgba(63,185,80,0.12)";

function formatCurrency(v: number, s = "Rs.") { return `${s}${v.toLocaleString("en-PK")}`; }

function OrderIcon({ t }: { t: string }) {
  if (t === "food") return <ShoppingBag size={16} className="text-orange-400" />;
  if (t === "mart") return <ShoppingCart size={16} className="text-blue-400" />;
  return <Package size={16} className="text-indigo-400" />;
}
function RideIcon({ t }: { t: string }) {
  if (t === "car") return <Car size={16} className="text-blue-400" />;
  return <Bike size={16} className="text-green-400" />;
}

/* ── Header ── */
function Header({ name, rating }: { name: string; rating: number }) {
  return (
    <div className="flex items-center justify-between px-5 pt-5 pb-1">
      <div>
        <p className="text-[11px] font-semibold tracking-wide uppercase" style={{ color: TEXT_TERTIARY }}>Good Morning</p>
        <p className="text-xl font-bold tracking-tight" style={{ color: TEXT_PRIMARY }}>{name}</p>
      </div>
      <div className="flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold"
        style={{ background: GOLD_SOFT, color: GOLD }}>
        <span className="text-sm">★</span> {rating.toFixed(2)}
      </div>
    </div>
  );
}

/* ── Online FAB Card ── */
function OnlineCard({ online }: { online: boolean }) {
  const [silence, setSilence] = useState(false);
  return (
    <div className="mx-4 mt-4 rounded-2xl border p-4 transition-all duration-300"
      style={{
        background: online ? "rgba(63,185,80,0.06)" : CARD,
        borderColor: online ? "rgba(63,185,80,0.15)" : BORDER,
      }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3.5">
          <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl"
            style={{ background: online ? GREEN_SOFT : "rgba(255,255,255,0.04)" }}>
            {online && (
              <span className="absolute inset-0 rounded-2xl" style={{ animation: "pulse-ring 2s cubic-bezier(0,0,0.2,1) infinite", border: `2px solid ${GREEN}` }} />
            )}
            {online ? <Zap size={22} className="text-green-400" /> : <Wifi size={22} style={{ color: TEXT_TERTIARY }} />}
          </div>
          <div>
            <p className="text-base font-bold" style={{ color: TEXT_PRIMARY }}>{online ? "Online" : "Offline"}</p>
            <p className="text-[11px] mt-0.5" style={{ color: TEXT_SECONDARY }}>
              {online ? "Accepting orders & ride requests" : "Tap to start earning"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex h-9 w-9 items-center justify-center rounded-xl border transition-all hover:bg-white/5"
            style={{ borderColor: BORDER, color: silence ? "#f85149" : TEXT_SECONDARY }}
            onClick={() => setSilence(!silence)}>
            {silence ? <VolumeX size={15} /> : <Volume2 size={15} />}
          </button>
          <button className="h-10 rounded-xl px-5 text-sm font-bold transition-all active:scale-95"
            style={{
              background: online ? GREEN : "rgba(255,255,255,0.06)",
              color: online ? "#fff" : TEXT_SECONDARY,
            }}>
            {online ? "Stop" : "Go Online"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Stats ── */
function Stats({ d, e, w, t }: { d: number; e: number; w: number; t: number }) {
  const items = [
    { label: "Today", value: String(d), sub: "deliveries", trend: "+2", icon: <Package size={14} className="text-indigo-400" />, color: "#6366f1" },
    { label: "Earned", value: formatCurrency(e), sub: "today", trend: "+12%", icon: <TrendingUp size={14} className="text-green-400" />, color: GREEN },
    { label: "Week", value: formatCurrency(w), sub: "earnings", trend: "+8%", icon: <Trophy size={14} className="text-amber-400" />, color: GOLD },
    { label: "Total", value: String(t), sub: "lifetime", trend: "", icon: <Zap size={14} className="text-purple-400" />, color: "#a78bfa" },
  ];
  return (
    <div className="mt-4 px-4 grid grid-cols-2 gap-2.5">
      {items.map((s, i) => (
        <div key={s.label} className="rounded-2xl border p-3.5"
          style={{
            background: CARD,
            borderColor: BORDER,
            animation: `fadeUp 0.35s ease-out ${i * 80}ms both`,
          }}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg"
              style={{ background: `${s.color}15` }}>
              {s.icon}
            </div>
            {s.trend && (
              <span className="flex items-center gap-0.5 text-[10px] font-bold" style={{ color: GREEN }}>
                <ArrowUpRight size={10} /> {s.trend}
              </span>
            )}
          </div>
          <p className="text-[15px] font-bold tracking-tight" style={{ color: TEXT_PRIMARY }}>{s.value}</p>
          <p className="text-[10px] mt-0.5 font-medium uppercase tracking-wider" style={{ color: TEXT_TERTIARY }}>{s.sub}</p>
        </div>
      ))}
    </div>
  );
}

/* ── Goal ── */
function Goal({ earned, goal }: { earned: number; goal: number }) {
  const pct = Math.min(100, Math.round((earned / goal) * 100));
  return (
    <div className="mx-4 mt-3 rounded-2xl border p-4"
      style={{ background: CARD, borderColor: BORDER }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: GOLD_SOFT }}>
            <Target size={16} style={{ color: GOLD }} />
          </div>
          <div>
            <p className="text-sm font-bold" style={{ color: TEXT_PRIMARY }}>Daily Goal</p>
            <p className="text-[10px]" style={{ color: TEXT_SECONDARY }}>{formatCurrency(earned)} / {formatCurrency(goal)}</p>
          </div>
        </div>
        <button className="flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-semibold transition-all hover:bg-white/5"
          style={{ color: TEXT_SECONDARY, border: `1px solid ${BORDER}` }}>
          <Pencil size={9} /> Edit
        </button>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full" style={{ background: "rgba(255,255,255,0.05)" }}>
        <div className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: pct >= 100 ? GREEN : GOLD }} />
      </div>
      <p className="mt-2 text-[11px] font-medium" style={{ color: TEXT_SECONDARY }}>
        {pct}% complete — {formatCurrency(goal - earned)} to go
      </p>
    </div>
  );
}

/* ── Active Task ── */
function ActiveTask() {
  return (
    <div className="mx-4 mt-3 rounded-2xl border p-3.5"
      style={{ background: "linear-gradient(135deg, rgba(34,197,94,0.15), rgba(16,185,129,0.08))", borderColor: "rgba(34,197,94,0.2)" }}>
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: "rgba(34,197,94,0.15)" }}>
          <div className="h-2.5 w-2.5 animate-pulse rounded-full bg-green-400" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold" style={{ color: TEXT_PRIMARY }}>Active Delivery</p>
          <p className="text-[11px] truncate" style={{ color: TEXT_SECONDARY }}>Bismillah Biryani → House 42-C, Mirpur</p>
        </div>
        <div className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-[11px] font-bold text-white"
          style={{ background: "rgba(34,197,94,0.2)" }}>
          Track <ChevronRight size={11} />
        </div>
      </div>
    </div>
  );
}

/* ── Request Header ── */
function RequestHeader({ total }: { total: number }) {
  return (
    <div className={`flex items-center justify-between px-4 py-3.5 mt-4 ${total > 0
      ? "bg-gradient-to-r from-orange-500 to-amber-500"
      : ""}`}
      style={total === 0 ? { background: CARD, borderTop: `1px solid ${BORDER}` } : {}}>
      <div className="flex items-center gap-2.5">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg"
          style={{ background: total > 0 ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.05)" }}>
          {total > 0 ? <Zap size={13} className="text-white" /> : <Radio size={13} style={{ color: TEXT_SECONDARY }} />}
        </div>
        <p className="text-sm font-bold" style={{ color: total > 0 ? "#fff" : TEXT_PRIMARY }}>
          {total > 0 ? `${total} Requests Available` : "Listening for requests"}
        </p>
      </div>
      {total > 0 && (
        <span className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold tracking-wider text-white/90"
          style={{ background: "rgba(255,255,255,0.15)" }}>
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-400" /> LIVE
        </span>
      )}
    </div>
  );
}

/* ── Order Card ── */
function OrderCard({ order, i }: { order: typeof REQUESTS[0]; i: number }) {
  const [accepted, setAccepted] = useState(false);
  return (
    <div className="mx-4 rounded-2xl border p-3.5 transition-all hover:border-opacity-10"
      style={{
        background: CARD,
        borderColor: BORDER,
        animation: `fadeUp 0.35s ease-out ${i * 100}ms both`,
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = CARD_HOVER)}
      onMouseLeave={(e) => (e.currentTarget.style.background = CARD)}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: "rgba(255,255,255,0.04)" }}>
            <OrderIcon t={order.type} />
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-bold truncate" style={{ color: TEXT_PRIMARY }}>{order.vendorName}</p>
            <div className="mt-0.5 flex items-center gap-1 text-[10px]" style={{ color: TEXT_SECONDARY }}>
              <MapPin size={10} /> <span className="truncate">{order.deliveryAddress}</span>
            </div>
          </div>
        </div>
        <div className="text-right">
          <p className="text-sm font-bold" style={{ color: GREEN }}>{formatCurrency(order.earnings)}</p>
          <p className="text-[10px]" style={{ color: TEXT_TERTIARY }}>{order.timeAgo}</p>
        </div>
      </div>
      <div className="mt-2.5 flex items-center gap-2 text-[10px]" style={{ color: TEXT_SECONDARY }}>
        <span>{order.itemCount} items</span>
        <span style={{ color: TEXT_TERTIARY }}>|</span>
        <span>{order.distanceKm} km</span>
        <span style={{ color: TEXT_TERTIARY }}>|</span>
        <span>Order {formatCurrency(order.orderTotal)}</span>
      </div>
      {!accepted ? (
        <div className="mt-3 flex gap-2">
          <button onClick={() => setAccepted(true)}
            className="flex-1 h-10 rounded-xl text-sm font-bold text-white transition-all active:scale-[0.97]"
            style={{ background: GREEN }}>Accept</button>
          <button className="h-10 w-10 flex items-center justify-center rounded-xl border transition-all hover:bg-white/5"
            style={{ borderColor: BORDER, color: TEXT_SECONDARY }}><ChevronRight size={16} /></button>
        </div>
      ) : (
        <div className="mt-3 flex h-10 items-center justify-center gap-2 rounded-xl text-sm font-bold"
          style={{ background: GREEN_SOFT, color: GREEN }}>
          <Clock size={15} className="animate-spin" style={{ animationDuration: "2.5s" }} />
          Accepted — navigate to pickup
        </div>
      )}
    </div>
  );
}

/* ── Ride Card ── */
function RideCard({ ride, i }: { ride: typeof RIDES[0]; i: number }) {
  return (
    <div className="mx-4 rounded-2xl border p-3.5"
      style={{
        background: CARD,
        borderColor: BORDER,
        animation: `fadeUp 0.35s ease-out ${(REQUESTS.length + i) * 100}ms both`,
      }}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: "rgba(255,255,255,0.04)" }}>
            <RideIcon t={ride.type} />
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-bold" style={{ color: TEXT_PRIMARY }}>Ride Request</p>
            <div className="mt-0.5 flex items-center gap-1 text-[10px]" style={{ color: TEXT_SECONDARY }}>
              <Navigation size={10} /> <span className="truncate">{ride.pickupAddress}</span>
            </div>
          </div>
        </div>
        <div className="text-right">
          <p className="text-sm font-bold" style={{ color: GREEN }}>~{formatCurrency(ride.estimatedFare)}</p>
          <p className="text-[10px]" style={{ color: TEXT_TERTIARY }}>{ride.timeAgo}</p>
        </div>
      </div>
      <div className="mt-2.5 flex items-center gap-1 text-[10px]" style={{ color: TEXT_SECONDARY }}>
        <MapPin size={10} /> <span className="truncate">→ {ride.dropAddress}</span>
        <span style={{ color: TEXT_TERTIARY }}>|</span>
        <span>{ride.distanceKm} km</span>
      </div>
      <div className="mt-3 flex gap-2">
        <button className="flex-1 h-10 rounded-xl text-sm font-bold text-white transition-all active:scale-[0.97]"
          style={{ background: GREEN }}>Accept</button>
        <button className="flex-1 h-10 rounded-xl border text-sm font-bold transition-all hover:bg-white/5"
          style={{ borderColor: BORDER, color: TEXT_SECONDARY }}>Counter</button>
        <button className="h-10 w-10 flex items-center justify-center rounded-xl border transition-all hover:bg-white/5"
          style={{ borderColor: BORDER, color: TEXT_SECONDARY }}><ChevronRight size={16} /></button>
      </div>
    </div>
  );
}

/* ── Main ── */
export default function Modern() {
  const total = REQUESTS.length + RIDES.length;
  return (
    <div className="min-h-screen w-full" style={{ background: BG, color: TEXT_PRIMARY, fontFamily: '"Inter", system-ui, sans-serif' }}>
      <style>{STYLE}</style>
      <div className="max-w-md mx-auto pb-8">
        <Header name={USER.name} rating={USER.rating} />
        <ActiveTask />
        <OnlineCard online={USER.isOnline} />
        <Stats d={USER.deliveriesToday} e={USER.earningsToday} w={USER.weekEarnings} t={USER.totalDeliveries} />
        <Goal earned={USER.earningsToday} goal={USER.dailyGoal} />
        <RequestHeader total={total} />
        <div className="mt-2 space-y-2.5">
          {REQUESTS.map((o, i) => <OrderCard key={o.id} order={o} i={i} />)}
          {RIDES.map((r, i) => <RideCard key={r.id} ride={r} i={i} />)}
        </div>
        <div className="mt-8 text-center text-[10px]" style={{ color: TEXT_TERTIARY }}>
          AJKMart Rider v2.4.0
        </div>
      </div>
    </div>
  );
}
