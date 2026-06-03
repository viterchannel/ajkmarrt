import { useState } from "react";
import { Bell, Volume2, VolumeX, Wallet, ChevronRight, Radio } from "lucide-react";

function LiveClock() {
  return <span>{new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>;
}

export function V2DarkLogistics() {
  const [online, setOnline] = useState(true);
  const [silent, setSilent] = useState(false);
  const [flash, setFlash] = useState(false);

  return (
    <div className="min-h-screen bg-[#09090b] flex flex-col">
      <header
        className="relative overflow-hidden rounded-b-[1.5rem]"
        style={{ background: "#09090b", borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      >
        {/* Scanline texture */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.5) 2px, rgba(255,255,255,0.5) 3px)" }}
        />
        {/* Neon accent line */}
        <div
          className="absolute top-0 left-0 right-0 h-[2px]"
          style={{
            background: online
              ? "linear-gradient(90deg, transparent 0%, #00ff87 30%, #60efff 70%, transparent 100%)"
              : "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.1) 50%, transparent 100%)",
            boxShadow: online ? "0 0 20px rgba(0,255,135,0.5)" : "none",
          }}
        />

        <div className="px-4 pt-14 pb-6">
          {/* Top row */}
          <div className="relative mb-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className="flex h-9 w-9 items-center justify-center rounded-lg"
                style={{ background: "linear-gradient(135deg, #00ff87, #60efff)", boxShadow: "0 0 16px rgba(0,255,135,0.4)" }}
              >
                <span className="text-[14px] font-black text-black">A</span>
              </div>
              <div>
                <p className="text-[11px] font-black tracking-[0.2em] text-white uppercase leading-none">AJKMART</p>
                <div className="mt-1 flex items-center gap-1.5">
                  <Radio size={8} className="text-green-400" />
                  <p className="text-[9px] font-mono font-semibold tracking-wider text-white/30 leading-none">RIDER NETWORK</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setSilent(!silent)}
                className="flex h-9 w-9 items-center justify-center rounded-lg border transition-all active:scale-95"
                style={{
                  background: silent ? "rgba(239,68,68,0.1)" : "rgba(255,255,255,0.04)",
                  borderColor: silent ? "rgba(239,68,68,0.4)" : "rgba(255,255,255,0.08)",
                }}
              >
                {silent ? <VolumeX size={14} className="text-red-400" /> : <Volume2 size={14} className="text-white/40" />}
              </button>
              <div
                className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-white/8"
                style={{ background: "rgba(255,255,255,0.04)" }}
              >
                <Bell size={15} className="text-white/40" />
              </div>
              <div
                className="relative flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg overflow-hidden"
                style={{ border: "1.5px solid rgba(0,255,135,0.3)", background: "rgba(0,255,135,0.05)" }}
              >
                <span className="text-[11px] font-extrabold text-green-400">AR</span>
              </div>
            </div>
          </div>

          {/* Greeting */}
          <div className="relative mb-5 flex items-end justify-between">
            <div>
              <p className="font-mono text-[10px] font-semibold tracking-[0.3em] text-white/25 uppercase">Good Morning</p>
              <h1
                className="mt-1.5 text-3xl font-black tracking-tight"
                style={{
                  color: flash ? "#00ff87" : "#ffffff",
                  textShadow: flash ? "0 0 20px rgba(0,255,135,0.7)" : "none",
                  transition: "all 0.3s ease",
                }}
              >
                Ali Raza
              </h1>
              <p className="mt-1 font-mono text-[10px] text-white/20"><LiveClock /></p>
              {flash && (
                <div
                  className="mt-2 inline-flex items-center gap-2 rounded-md px-2.5 py-1"
                  style={{ background: "rgba(0,255,135,0.1)", border: "1px solid rgba(0,255,135,0.3)", boxShadow: "0 0 12px rgba(0,255,135,0.2)" }}
                >
                  <span className="h-1.5 w-1.5 animate-ping rounded-full bg-green-400" />
                  <span className="font-mono text-[10px] font-bold tracking-wider text-green-400">NEW REQUEST INCOMING</span>
                </div>
              )}
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <span
                className="rounded-sm px-2.5 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.15em]"
                style={{ background: "rgba(96,239,255,0.1)", border: "1px solid rgba(96,239,255,0.3)", color: "#60efff" }}
              >
                Gold
              </span>
              <p className="font-mono text-[9px] text-white/20">LAST SEEN · 2m ago</p>
            </div>
          </div>

          {/* HUD cards */}
          <div className="relative grid grid-cols-2 gap-3">
            <div
              className="flex flex-col gap-2 rounded-xl p-4"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
            >
              <div className="flex items-center justify-between">
                <div className="flex h-7 w-7 items-center justify-center rounded-md" style={{ background: "rgba(0,255,135,0.1)", border: "1px solid rgba(0,255,135,0.2)" }}>
                  <Wallet size={12} className="text-green-400" />
                </div>
                <ChevronRight size={11} className="text-white/20" />
              </div>
              <div>
                <p className="font-mono text-[8px] font-bold uppercase tracking-[0.2em] text-white/25">BALANCE</p>
                <p className="mt-1 font-mono text-lg font-extrabold leading-none text-white">Rs. 2,450</p>
              </div>
            </div>

            <button
              onClick={() => setOnline(!online)}
              className="flex flex-col gap-2 rounded-xl p-4 text-left transition-all active:scale-[0.97]"
              style={{
                background: online ? "rgba(0,255,135,0.07)" : "rgba(255,255,255,0.03)",
                border: online ? "1px solid rgba(0,255,135,0.25)" : "1px solid rgba(255,255,255,0.07)",
                boxShadow: online ? "inset 0 0 30px rgba(0,255,135,0.05)" : "none",
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span
                    className={`h-2 w-2 rounded-full ${online ? "animate-pulse" : ""}`}
                    style={{ background: online ? "#00ff87" : "rgba(255,255,255,0.15)", boxShadow: online ? "0 0 8px rgba(0,255,135,0.8)" : "none" }}
                  />
                  <p className="font-mono text-[9px] font-bold uppercase tracking-[0.15em]" style={{ color: online ? "#00ff87" : "rgba(255,255,255,0.25)" }}>
                    {online ? "ACTIVE" : "STANDBY"}
                  </p>
                </div>
                <div
                  className="relative h-5 w-9 flex-shrink-0 rounded-sm transition-colors duration-200"
                  style={{ background: online ? "rgba(0,255,135,0.3)" : "rgba(255,255,255,0.08)", border: online ? "1px solid rgba(0,255,135,0.5)" : "1px solid rgba(255,255,255,0.1)" }}
                >
                  <div
                    className={`absolute top-0.5 h-4 w-4 rounded-sm shadow-sm transition-all duration-200 ${online ? "left-[18px]" : "left-0.5"}`}
                    style={{ background: online ? "#00ff87" : "rgba(255,255,255,0.4)", boxShadow: online ? "0 0 6px rgba(0,255,135,0.8)" : "none" }}
                  />
                </div>
              </div>
              <div>
                <p className="text-sm font-extrabold leading-tight text-white">{online ? "Accepting Orders" : "Tap to Start"}</p>
                <p className="mt-0.5 font-mono text-[9px] text-white/25">{online ? "// TAP TO STANDBY" : "// TAP TO ACTIVATE"}</p>
              </div>
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center">
          <p className="text-white/20 text-sm font-semibold uppercase tracking-widest">V2 — Dark Logistics</p>
          <p className="text-white/10 text-xs mt-1">Neon green · HUD style · monospace</p>
          <button onClick={() => setFlash(!flash)} className="mt-4 rounded-lg bg-white/10 border border-white/20 px-4 py-2 text-xs text-white/60">
            Toggle flash
          </button>
        </div>
      </div>
    </div>
  );
}
