import { useState } from "react";
import { Bell, Volume2, VolumeX, Wallet, ChevronRight, Zap } from "lucide-react";

function LiveClock() {
  const [time, setTime] = useState(() => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
  return <span>{time}</span>;
}

export function V1Glassmorphism() {
  const [online, setOnline] = useState(true);
  const [silent, setSilent] = useState(false);
  const [flash, setFlash] = useState(false);

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex flex-col">
      <header
        className="relative overflow-hidden rounded-b-[2.5rem]"
        style={{
          background: "linear-gradient(135deg, #0f0c29 0%, #302b63 45%, #24243e 100%)",
        }}
      >
        {/* Ambient glow orbs */}
        <div
          className="pointer-events-none absolute -top-24 -right-24 h-80 w-80 rounded-full opacity-30"
          style={{ background: "radial-gradient(circle, rgba(139,92,246,0.8) 0%, transparent 70%)", filter: "blur(40px)" }}
        />
        <div
          className="pointer-events-none absolute -bottom-16 -left-16 h-64 w-64 rounded-full opacity-20"
          style={{ background: "radial-gradient(circle, rgba(59,130,246,0.8) 0%, transparent 70%)", filter: "blur(30px)" }}
        />
        {online && (
          <div
            className="pointer-events-none absolute top-1/2 left-1/2 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full opacity-10"
            style={{ background: "radial-gradient(circle, rgba(34,197,94,0.9) 0%, transparent 65%)", filter: "blur(60px)" }}
          />
        )}

        <div className="px-4 pt-14 pb-6">
          {/* Top row */}
          <div className="relative mb-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className="flex h-9 w-9 items-center justify-center rounded-2xl border border-white/20 shadow-lg"
                style={{ background: "linear-gradient(135deg, rgba(139,92,246,0.6), rgba(59,130,246,0.4))", backdropFilter: "blur(10px)" }}
              >
                <span className="text-[14px] font-black text-white">A</span>
              </div>
              <div>
                <p className="text-[11px] font-black tracking-widest text-white/90 uppercase leading-none">AJKMart</p>
                <p className="mt-0.5 text-[9px] font-semibold tracking-wider text-white/40 leading-none">Rider Dashboard</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setSilent(!silent)}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 transition-all active:scale-95"
                style={{ background: silent ? "rgba(239,68,68,0.2)" : "rgba(255,255,255,0.08)", backdropFilter: "blur(10px)" }}
              >
                {silent ? <VolumeX size={14} className="text-red-400" /> : <Volume2 size={14} className="text-white/60" />}
              </button>
              <div
                className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-white/10"
                style={{ background: "rgba(255,255,255,0.08)", backdropFilter: "blur(10px)" }}
              >
                <Bell size={15} className="text-white/50" />
              </div>
              <div
                className="relative flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border-2 border-white/20 overflow-hidden"
                style={{ background: "rgba(255,255,255,0.1)", backdropFilter: "blur(10px)" }}
              >
                <span className="text-[11px] font-extrabold text-white/80">AR</span>
              </div>
            </div>
          </div>

          {/* Greeting */}
          <div className="relative mb-5 flex items-end justify-between">
            <div>
              <p className="text-xs font-semibold tracking-widest text-white/40 uppercase">Good morning</p>
              <h1 className={`mt-1 text-3xl font-black tracking-tight transition-all duration-300 ${flash ? "text-green-400 drop-shadow-[0_0_12px_rgba(34,197,94,0.6)]" : "text-white"}`}>
                Ali Raza
              </h1>
              <p className="mt-0.5 font-mono text-[10px] text-white/30">
                <LiveClock />
              </p>
              {flash && (
                <div className="mt-2 flex items-center gap-2">
                  <Zap size={12} className="text-green-400" />
                  <span className="text-xs font-bold text-green-400 drop-shadow-[0_0_8px_rgba(34,197,94,0.8)]">New request available</span>
                </div>
              )}
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <span className="rounded-full border border-violet-400/30 bg-violet-400/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-violet-300"
                style={{ backdropFilter: "blur(8px)" }}>
                Gold
              </span>
              <p className="text-[10px] text-white/30">Last online · 2m ago</p>
            </div>
          </div>

          {/* Action cards */}
          <div className="relative grid grid-cols-2 gap-3">
            <div
              className="flex flex-col gap-2 rounded-2xl border border-white/10 p-4"
              style={{ background: "rgba(255,255,255,0.06)", backdropFilter: "blur(16px)" }}
            >
              <div className="flex items-center justify-between">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: "rgba(34,197,94,0.2)" }}>
                  <Wallet size={13} className="text-green-400" />
                </div>
                <ChevronRight size={12} className="text-white/30" />
              </div>
              <div>
                <p className="text-[9px] font-bold uppercase tracking-widest text-white/40">Wallet</p>
                <p className="mt-0.5 text-lg font-extrabold leading-none text-white">Rs. 2,450</p>
              </div>
            </div>

            <button
              onClick={() => setOnline(!online)}
              className="flex flex-col gap-2 rounded-2xl border p-4 text-left transition-all active:scale-[0.97]"
              style={{
                background: online ? "rgba(34,197,94,0.12)" : "rgba(255,255,255,0.06)",
                borderColor: online ? "rgba(34,197,94,0.3)" : "rgba(255,255,255,0.1)",
                backdropFilter: "blur(16px)",
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className={`h-2 w-2 rounded-full ${online ? "animate-pulse bg-green-400 shadow-[0_0_8px_rgba(34,197,94,0.8)]" : "bg-white/20"}`} />
                  <p className={`text-[9px] font-bold uppercase tracking-widest ${online ? "text-green-400" : "text-white/40"}`}>
                    {online ? "Online" : "Offline"}
                  </p>
                </div>
                <div className={`relative h-5 w-9 flex-shrink-0 rounded-full transition-colors duration-200 ${online ? "bg-green-500" : "bg-white/10"}`}>
                  <div className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-all duration-200 ${online ? "left-[18px]" : "left-0.5"}`} />
                </div>
              </div>
              <div>
                <p className="text-sm font-extrabold leading-tight text-white">{online ? "Accepting Orders" : "Tap to Start"}</p>
                <p className="mt-0.5 text-[10px] text-white/30">{online ? "Tap to go offline" : "Tap to go online"}</p>
              </div>
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center">
          <p className="text-white/20 text-sm font-semibold uppercase tracking-widest">V1 — Glassmorphism</p>
          <p className="text-white/10 text-xs mt-1">Deep purple · glass panels · ambient glow</p>
          <button onClick={() => setFlash(!flash)} className="mt-4 rounded-lg bg-white/10 border border-white/20 px-4 py-2 text-xs text-white/60">
            Toggle flash
          </button>
        </div>
      </div>
    </div>
  );
}
