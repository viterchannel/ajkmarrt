import { useState } from "react";
import { Bell, Volume2, VolumeX, Wallet, MapPin, Star, Package, Clock } from "lucide-react";

function MetricCell({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent?: string }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-xl p-2.5" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
      <div style={{ color: accent ?? "rgba(255,255,255,0.4)" }}>{icon}</div>
      <p className="text-[13px] font-extrabold leading-none" style={{ color: accent ?? "#ffffff" }}>{value}</p>
      <p className="text-[8px] font-bold uppercase tracking-wider text-white/30">{label}</p>
    </div>
  );
}

export function V5TacticalDashboard() {
  const [online, setOnline] = useState(true);
  const [silent, setSilent] = useState(false);
  const [flash, setFlash] = useState(false);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#070b14" }}>
      <header
        className="relative overflow-hidden"
        style={{ background: "linear-gradient(180deg, #0d1526 0%, #0a1020 100%)", borderBottom: "1px solid rgba(99,179,255,0.12)" }}
      >
        {/* Corner marks */}
        <div className="absolute top-2 left-2 h-4 w-4 rounded-tl-sm border-t-2 border-l-2 border-blue-500/40" />
        <div className="absolute top-2 right-2 h-4 w-4 rounded-tr-sm border-t-2 border-r-2 border-blue-500/40" />

        {/* Top accent */}
        <div
          className="absolute top-0 left-0 right-0 h-[2px]"
          style={{
            background: online
              ? "linear-gradient(90deg, transparent 0%, rgba(59,130,246,0.8) 30%, rgba(147,197,253,1) 50%, rgba(59,130,246,0.8) 70%, transparent 100%)"
              : "rgba(255,255,255,0.06)",
            boxShadow: online ? "0 0 16px rgba(59,130,246,0.6)" : "none",
          }}
        />

        <div className="px-4 pt-14 pb-5">
          {/* Top bar */}
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div
                className="flex h-8 w-8 items-center justify-center rounded-lg"
                style={{ background: "linear-gradient(135deg, #1e3a8a, #1d4ed8)", border: "1px solid rgba(59,130,246,0.4)", boxShadow: "0 0 12px rgba(59,130,246,0.3)" }}
              >
                <span className="text-[12px] font-black text-blue-200">A</span>
              </div>
              <div>
                <p className="text-[11px] font-black tracking-widest text-blue-200 uppercase leading-none">AJKMart</p>
                <p className="mt-0.5 text-[8px] font-mono font-semibold tracking-widest text-blue-400/40 leading-none">RIDER SYS v2.4</p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <div
                className="flex items-center gap-1.5 rounded-full px-2.5 py-1"
                style={{ background: online ? "rgba(34,197,94,0.12)" : "rgba(255,255,255,0.06)", border: online ? "1px solid rgba(34,197,94,0.3)" : "1px solid rgba(255,255,255,0.08)" }}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${online ? "animate-pulse" : ""}`}
                  style={{ background: online ? "#22c55e" : "rgba(255,255,255,0.3)", boxShadow: online ? "0 0 6px rgba(34,197,94,0.8)" : "none" }}
                />
                <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: online ? "#22c55e" : "rgba(255,255,255,0.3)" }}>
                  {online ? "LIVE" : "IDLE"}
                </span>
              </div>

              <button onClick={() => setSilent(!silent)} className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: silent ? "rgba(239,68,68,0.15)" : "rgba(255,255,255,0.04)", border: silent ? "1px solid rgba(239,68,68,0.4)" : "1px solid rgba(255,255,255,0.06)" }}>
                {silent ? <VolumeX size={13} className="text-red-400" /> : <Volume2 size={13} className="text-blue-400/60" />}
              </button>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <Bell size={13} className="text-blue-400/60" />
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg overflow-hidden" style={{ background: "rgba(59,130,246,0.15)", border: "1.5px solid rgba(59,130,246,0.4)" }}>
                <span className="text-[10px] font-bold text-blue-300">AR</span>
              </div>
            </div>
          </div>

          {/* Identity */}
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-black tracking-tight text-white">Ali Raza</h1>
              <div className="mt-1 flex items-center gap-2">
                <span className="rounded px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-amber-300 font-mono" style={{ background: "rgba(251,191,36,0.12)", border: "1px solid rgba(251,191,36,0.25)" }}>GOLD</span>
                <p className="text-[9px] font-mono text-blue-400/50">ID:RDR-4821</p>
              </div>
            </div>
            <div className="flex flex-col items-end gap-0.5">
              <div className="flex items-center gap-1">
                <MapPin size={9} className="text-blue-400/50" />
                <p className="text-[9px] font-mono text-blue-400/50">Karachi, PK</p>
              </div>
              <p className="text-[9px] font-mono text-blue-400/30">Last ping: 14s ago</p>
            </div>
          </div>

          {/* Metric grid */}
          <div className="mb-4 grid grid-cols-4 gap-2">
            <MetricCell icon={<Star size={12} />} label="Rating" value="4.9" accent="#fbbf24" />
            <MetricCell icon={<Package size={12} />} label="Trips" value="248" accent="#60a5fa" />
            <MetricCell icon={<Wallet size={12} />} label="Today" value="1.2K" accent="#34d399" />
            <MetricCell icon={<Clock size={12} />} label="Hours" value="6h" accent="rgba(255,255,255,0.5)" />
          </div>

          {/* Control row */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setOnline(!online)}
              className="flex items-center justify-between rounded-xl px-4 py-3 transition-all"
              style={{
                background: online ? "rgba(34,197,94,0.1)" : "rgba(255,255,255,0.04)",
                border: online ? "1px solid rgba(34,197,94,0.35)" : "1px solid rgba(255,255,255,0.06)",
                boxShadow: online ? "0 0 20px rgba(34,197,94,0.08)" : "none",
              }}
            >
              <div>
                <p className="text-[9px] font-mono font-bold uppercase tracking-widest" style={{ color: online ? "rgba(34,197,94,0.7)" : "rgba(255,255,255,0.3)" }}>STATUS</p>
                <p className="mt-0.5 text-sm font-extrabold" style={{ color: online ? "#22c55e" : "rgba(255,255,255,0.4)" }}>{online ? "ONLINE" : "OFFLINE"}</p>
              </div>
              <div className={`relative h-5 w-10 rounded-full ${online ? "bg-green-600" : "bg-white/10"}`}>
                <div className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${online ? "left-[22px]" : "left-0.5"}`} />
              </div>
            </button>

            <div
              className="flex items-center justify-between rounded-xl px-4 py-3"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <div>
                <p className="text-[9px] font-mono font-bold uppercase tracking-widest text-blue-400/50">WALLET</p>
                <p className="mt-0.5 text-sm font-extrabold text-white">Rs. 2,450</p>
              </div>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.2)" }}>
                <Wallet size={14} className="text-green-400" />
              </div>
            </div>
          </div>

          {flash && (
            <div
              className="mt-3 flex items-center gap-3 rounded-xl px-4 py-3"
              style={{ background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.3)", boxShadow: "0 0 20px rgba(59,130,246,0.08)" }}
            >
              <div className="h-2 w-2 animate-ping rounded-full bg-blue-400 flex-shrink-0" />
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-blue-300">NEW REQUEST</p>
                <p className="text-[9px] font-mono text-blue-400/50">1 request · 0.8km · Rs.250</p>
              </div>
            </div>
          )}
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center">
          <p className="text-blue-400/30 text-sm font-semibold uppercase tracking-widest">V5 — Tactical Dashboard</p>
          <p className="text-blue-400/20 text-xs mt-1 font-mono">Midnight blue · metrics grid · SaaS inspired</p>
          <button onClick={() => setFlash(!flash)} className="mt-4 rounded-lg border border-blue-800/50 bg-blue-900/30 px-4 py-2 text-xs text-blue-400/60">
            Toggle flash
          </button>
        </div>
      </div>
    </div>
  );
}
