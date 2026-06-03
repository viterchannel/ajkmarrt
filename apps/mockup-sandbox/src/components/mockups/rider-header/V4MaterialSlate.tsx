import { useState } from "react";
import { Bell, Volume2, VolumeX, Wallet, ChevronRight } from "lucide-react";

function LiveClock() {
  return <span>{new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>;
}

export function V4MaterialSlate() {
  const [online, setOnline] = useState(true);
  const [silent, setSilent] = useState(false);
  const [flash, setFlash] = useState(false);

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      <header className="relative overflow-hidden bg-slate-800 shadow-lg">
        {/* Material elevation shadow stripe */}
        <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-black/10" />

        {/* Status strip */}
        <div className={`absolute top-0 left-0 right-0 h-[3px] transition-colors duration-500 ${online ? "bg-emerald-500" : "bg-slate-500"}`} />

        <div className="px-4 pt-14 pb-5">
          {/* Top row */}
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-700 shadow-inner">
                <span className="text-[15px] font-black text-slate-200">A</span>
              </div>
              <div>
                <p className="text-[12px] font-bold tracking-wide text-slate-100 leading-none">AJKMart</p>
                <p className="mt-0.5 text-[10px] font-medium text-slate-400 leading-none">Rider Portal</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setSilent(!silent)}
                className={`flex h-9 w-9 items-center justify-center rounded-lg transition-all ${silent ? "bg-red-500/20" : "bg-slate-700"}`}
              >
                {silent ? <VolumeX size={15} className="text-red-400" /> : <Volume2 size={15} className="text-slate-400" />}
              </button>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-700">
                <Bell size={15} className="text-slate-400" />
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-600 overflow-hidden ring-2 ring-slate-500">
                <span className="text-[11px] font-bold text-slate-200">AR</span>
              </div>
            </div>
          </div>

          {/* Greeting */}
          <div className="mb-4">
            <p className="text-[11px] font-medium text-slate-400 uppercase tracking-widest">Good Morning</p>
            <h1 className={`mt-0.5 text-2xl font-bold tracking-tight transition-colors duration-300 ${flash ? "text-emerald-400" : "text-slate-100"}`}>
              Ali Raza
            </h1>
            <p className="mt-0.5 text-[11px] text-slate-500"><LiveClock /></p>
          </div>

          {/* Stat chips row */}
          <div className="mb-4 flex gap-2">
            <div className="flex items-center gap-1.5 rounded-full bg-slate-700 px-3 py-1.5">
              <div className={`h-2 w-2 rounded-full ${online ? "bg-emerald-400" : "bg-slate-500"}`} />
              <span className={`text-[11px] font-semibold ${online ? "text-emerald-400" : "text-slate-400"}`}>
                {online ? "Online" : "Offline"}
              </span>
            </div>
            <div className="flex items-center gap-1.5 rounded-full bg-slate-700 px-3 py-1.5">
              <span className="text-[11px] font-semibold text-amber-400">Gold</span>
            </div>
            <div className="flex items-center gap-1.5 rounded-full bg-slate-700 px-3 py-1.5">
              <span className="text-[11px] font-semibold text-slate-300">Rs. 2,450</span>
            </div>
          </div>

          {/* Action cards */}
          <div className="grid grid-cols-2 gap-2">
            <div className="flex items-center gap-3 rounded-xl bg-slate-700 p-3 shadow">
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-emerald-500/20">
                <Wallet size={16} className="text-emerald-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-semibold text-slate-400 uppercase">Wallet</p>
                <p className="text-[15px] font-bold text-slate-100 leading-tight">Rs. 2,450</p>
              </div>
              <ChevronRight size={14} className="text-slate-500 flex-shrink-0" />
            </div>

            <button
              onClick={() => setOnline(!online)}
              className={`flex items-center gap-3 rounded-xl p-3 shadow text-left transition-colors ${online ? "bg-emerald-700/30 ring-1 ring-emerald-500/40" : "bg-slate-700"}`}
            >
              <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg ${online ? "bg-emerald-500/30" : "bg-slate-600"}`}>
                <div className={`h-3 w-3 rounded-full ${online ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" : "bg-slate-500"}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-semibold text-slate-400 uppercase">{online ? "On Duty" : "Off Duty"}</p>
                <p className={`text-[14px] font-bold leading-tight ${online ? "text-emerald-400" : "text-slate-300"}`}>
                  {online ? "Active" : "Go Online"}
                </p>
              </div>
            </button>
          </div>

          {flash && (
            <div className="mt-3 flex items-center gap-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 px-4 py-2.5">
              <div className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
              <p className="text-[12px] font-semibold text-emerald-400">New ride request available</p>
            </div>
          )}
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center">
          <p className="text-slate-500 text-sm font-semibold uppercase tracking-widest">V4 — Material Slate</p>
          <p className="text-slate-400 text-xs mt-1">Light-mode · material design · elevation</p>
          <button onClick={() => setFlash(!flash)} className="mt-4 rounded-lg bg-slate-200 border border-slate-300 px-4 py-2 text-xs text-slate-600">
            Toggle flash
          </button>
        </div>
      </div>
    </div>
  );
}
