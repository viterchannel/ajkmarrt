import { useState } from "react";
import { Bell, Volume2, VolumeX, Wallet, ChevronRight, TrendingUp } from "lucide-react";

function LiveClock() {
  return <span>{new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>;
}

export function V3BrandGradient() {
  const [online, setOnline] = useState(true);
  const [silent, setSilent] = useState(false);
  const [flash, setFlash] = useState(false);

  return (
    <div className="min-h-screen bg-stone-900 flex flex-col">
      <header
        className="relative overflow-hidden rounded-b-[2.5rem]"
        style={{ background: "linear-gradient(160deg, #f59e0b 0%, #d97706 25%, #b45309 55%, #1c1917 100%)" }}
      >
        {/* Wave shape */}
        <svg className="absolute bottom-0 left-0 right-0 w-full" viewBox="0 0 400 60" preserveAspectRatio="none" style={{ height: 60, opacity: 0.15 }}>
          <path d="M0,30 C80,60 160,0 240,30 C320,60 360,15 400,30 L400,60 L0,60 Z" fill="rgba(0,0,0,0.4)" />
        </svg>
        {/* Shimmer */}
        <div
          className="pointer-events-none absolute -top-20 -right-20 h-72 w-72 rounded-full opacity-25"
          style={{ background: "radial-gradient(circle, rgba(255,255,255,0.8) 0%, transparent 65%)", filter: "blur(30px)" }}
        />

        <div className="px-4 pt-14 pb-8">
          {/* Top row */}
          <div className="relative mb-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className="flex h-9 w-9 items-center justify-center rounded-2xl shadow-md"
                style={{ background: "rgba(0,0,0,0.25)", backdropFilter: "blur(8px)" }}
              >
                <span className="text-[15px] font-black text-amber-300">A</span>
              </div>
              <div>
                <p className="text-[11px] font-black tracking-widest text-white uppercase leading-none">AJKMart</p>
                <p className="mt-0.5 text-[9px] font-semibold tracking-wider text-amber-200/60 leading-none">Rider Partner</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSilent(!silent)}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/20 bg-black/20 transition-all active:scale-95"
                style={{ backdropFilter: "blur(8px)" }}
              >
                {silent ? <VolumeX size={14} className="text-red-300" /> : <Volume2 size={14} className="text-white/70" />}
              </button>
              <div
                className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-white/20 bg-black/20"
                style={{ backdropFilter: "blur(8px)" }}
              >
                <Bell size={15} className="text-white/60" />
              </div>
              <div
                className="relative flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border-2 border-white/30 bg-black/20 overflow-hidden"
                style={{ backdropFilter: "blur(8px)" }}
              >
                <span className="text-[11px] font-extrabold text-amber-200">AR</span>
              </div>
            </div>
          </div>

          {/* Greeting + earnings metric */}
          <div className="relative mb-5">
            <p className="text-xs font-semibold tracking-wider text-amber-200/60 uppercase">Good Morning</p>
            <div className="mt-1 flex items-end justify-between">
              <h1
                className="text-3xl font-black tracking-tight text-white drop-shadow-md"
                style={{ textShadow: flash ? "0 0 24px rgba(255,255,255,0.9)" : "0 2px 8px rgba(0,0,0,0.3)", transition: "text-shadow 0.3s ease" }}
              >
                Ali Raza
              </h1>
              <div
                className="flex flex-col items-end rounded-xl px-3 py-2"
                style={{ background: "rgba(0,0,0,0.2)", backdropFilter: "blur(8px)" }}
              >
                <div className="flex items-center gap-1">
                  <TrendingUp size={10} className="text-amber-300" />
                  <p className="text-[9px] font-bold uppercase tracking-wider text-amber-200/60">Today</p>
                </div>
                <p className="mt-0.5 font-mono text-base font-extrabold leading-none text-white">Rs. 1,200</p>
              </div>
            </div>
            <div className="mt-1 flex items-center gap-3">
              <p className="font-mono text-[10px] text-amber-200/40"><LiveClock /></p>
              <span className="rounded-full border border-amber-200/30 bg-black/20 px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-200">Gold</span>
            </div>
            {flash && (
              <div
                className="mt-2.5 flex items-center gap-2 rounded-xl px-3 py-2"
                style={{ background: "rgba(255,255,255,0.15)", backdropFilter: "blur(8px)" }}
              >
                <span className="h-2 w-2 animate-pulse rounded-full bg-white shadow-[0_0_8px_white]" />
                <span className="text-xs font-bold text-white">New request available!</span>
              </div>
            )}
          </div>

          {/* Action cards */}
          <div className="relative grid grid-cols-2 gap-3">
            <div
              className="flex flex-col gap-2 rounded-2xl p-4"
              style={{ background: "rgba(0,0,0,0.22)", border: "1px solid rgba(255,255,255,0.12)", backdropFilter: "blur(12px)" }}
            >
              <div className="flex items-center justify-between">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-400/20">
                  <Wallet size={12} className="text-amber-300" />
                </div>
                <ChevronRight size={11} className="text-white/30" />
              </div>
              <div>
                <p className="text-[9px] font-bold uppercase tracking-widest text-white/40">Wallet</p>
                <p className="mt-0.5 text-lg font-extrabold leading-none text-white">Rs. 2,450</p>
              </div>
            </div>

            <button
              onClick={() => setOnline(!online)}
              className="flex flex-col gap-2 rounded-2xl p-4 text-left transition-all active:scale-[0.97]"
              style={{
                background: online ? "rgba(34,197,94,0.2)" : "rgba(0,0,0,0.22)",
                border: online ? "1px solid rgba(34,197,94,0.4)" : "1px solid rgba(255,255,255,0.12)",
                backdropFilter: "blur(12px)",
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className={`h-2 w-2 rounded-full ${online ? "animate-pulse bg-green-400 shadow-[0_0_8px_rgba(34,197,94,0.9)]" : "bg-white/20"}`} />
                  <p className={`text-[9px] font-bold uppercase tracking-widest ${online ? "text-green-300" : "text-white/40"}`}>
                    {online ? "Online" : "Offline"}
                  </p>
                </div>
                <div className={`relative h-5 w-9 flex-shrink-0 rounded-full transition-colors duration-200 ${online ? "bg-green-500" : "bg-white/10"}`}>
                  <div className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-all duration-200 ${online ? "left-[18px]" : "left-0.5"}`} />
                </div>
              </div>
              <div>
                <p className="text-sm font-extrabold leading-tight text-white">{online ? "Accepting Orders" : "Tap to Start"}</p>
                <p className="mt-0.5 text-[10px] text-white/40">{online ? "Tap to go offline" : "Tap to go online"}</p>
              </div>
            </button>
          </div>

          <p className="mt-4 text-center text-[9px] text-white/20">Last online · 2m ago</p>
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center">
          <p className="text-stone-400 text-sm font-semibold uppercase tracking-widest">V3 — Brand Gradient</p>
          <p className="text-stone-600 text-xs mt-1">Amber · warm gold · AJKMart brand colours</p>
          <button onClick={() => setFlash(!flash)} className="mt-4 rounded-lg bg-stone-700/50 border border-stone-600 px-4 py-2 text-xs text-stone-400">
            Toggle flash
          </button>
        </div>
      </div>
    </div>
  );
}
