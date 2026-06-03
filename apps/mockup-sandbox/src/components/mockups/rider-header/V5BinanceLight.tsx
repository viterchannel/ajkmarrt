import { useState } from "react";

export function V5BinanceLight() {
  const [online, setOnline] = useState(true);
  const [flash, setFlash] = useState(false);

  const YELLOW = "#F0B90B";
  const YELLOW_BG = "rgba(240,185,11,0.08)";
  const YELLOW_BORDER = "rgba(240,185,11,0.2)";

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#FAFAFA", fontFamily: "'Helvetica Neue', Arial, sans-serif" }}>
      {/* Header */}
      <div style={{ background: "#FFFFFF", paddingTop: 52, borderBottom: "1px solid #F0F0F0", boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}>
        <div style={{ padding: "0 20px 20px" }}>

          {/* Yellow top accent */}
          <div style={{ height: 3, background: `linear-gradient(90deg, ${YELLOW} 0%, #E8A800 100%)`, marginBottom: 18, borderRadius: "0 0 2px 2px" }} />

          {/* Top bar */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: 8, background: YELLOW, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg viewBox="0 0 32 32" width="18" height="18" fill="#fff">
                  <path d="M16 4 L20 8 L16 12 L12 8 Z M4 16 L8 12 L12 16 L8 20 Z M16 20 L20 16 L24 20 L20 24 Z M28 16 L24 12 L20 16 L24 20 Z M16 14 L20 18 L16 22 L12 18 Z" />
                </svg>
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#1E2026", letterSpacing: -0.2 }}>AJKMart</div>
                <div style={{ fontSize: 10, fontWeight: 600, color: "#848E9C" }}>Rider Network</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setFlash(!flash)} style={{ width: 36, height: 36, borderRadius: 8, background: "#F5F5F5", border: "1px solid #EBEBEB", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", position: "relative" }}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={flash ? YELLOW : "#848E9C"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
                {flash && <span style={{ position: "absolute", top: 6, right: 6, width: 7, height: 7, borderRadius: 4, background: "#F6465D", border: "1.5px solid white" }} />}
              </button>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: "#1E2026", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: YELLOW }}>AR</span>
              </div>
            </div>
          </div>

          {/* Greeting */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: "#848E9C", marginBottom: 4 }}>Welcome back</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: "#1E2026", letterSpacing: -0.6, lineHeight: 1.1 }}>Ali Raza</div>
            <div style={{ marginTop: 8, display: "inline-flex", alignItems: "center", gap: 6, background: online ? "rgba(14,203,129,0.08)" : "#F5F5F5", borderRadius: 20, padding: "4px 10px", border: `1px solid ${online ? "rgba(14,203,129,0.2)" : "#EBEBEB"}` }}>
              <span style={{ width: 6, height: 6, borderRadius: 3, background: online ? "#0ECB81" : "#C8C8C8", display: "block" }} />
              <span style={{ fontSize: 11, fontWeight: 600, color: online ? "#0ECB81" : "#848E9C" }}>
                {online ? "Active" : "Offline"}
              </span>
            </div>
          </div>

          {/* Balance card — Binance highlight */}
          <div style={{ background: `linear-gradient(135deg, #1E2026 0%, #2B2F36 100%)`, borderRadius: 16, padding: "16px 18px", marginBottom: 10, position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: -20, right: -20, width: 80, height: 80, background: `radial-gradient(circle, ${YELLOW_BG} 0%, transparent 70%)` }} />
            <div style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 }}>Available Balance</div>
            <div style={{ fontSize: 30, fontWeight: 700, color: "#FFFFFF", letterSpacing: -0.8, marginBottom: 4 }}>₨ 2,450</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "#0ECB81" }}>▲ ₨ 120 (5.15%)</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: YELLOW, background: YELLOW_BG, borderRadius: 6, padding: "2px 8px", border: `1px solid ${YELLOW_BORDER}` }}>GOLD</span>
            </div>
          </div>

          {/* 3-col stats */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 10 }}>
            {[
              { label: "Today", value: "₨ 1.2K", sub: "+15%", color: "#0ECB81" },
              { label: "Trips", value: "248", sub: "+6 today", color: "#1E2026" },
              { label: "Rating", value: "4.9", sub: "★★★★★", color: YELLOW },
            ].map(({ label, value, sub, color }) => (
              <div key={label} style={{ background: "#F5F5F5", borderRadius: 12, padding: "12px 12px", border: "1px solid #EBEBEB" }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: "#848E9C", textTransform: "uppercase", letterSpacing: 0.6 }}>{label}</div>
                <div style={{ fontSize: 17, fontWeight: 700, color: "#1E2026", marginTop: 4, letterSpacing: -0.3 }}>{value}</div>
                <div style={{ fontSize: 10, fontWeight: 600, color, marginTop: 2 }}>{sub}</div>
              </div>
            ))}
          </div>

          {/* Online toggle */}
          <div
            onClick={() => setOnline(!online)}
            style={{ background: online ? "rgba(14,203,129,0.06)" : "#F5F5F5", borderRadius: 12, padding: "14px 16px", border: `1px solid ${online ? "rgba(14,203,129,0.2)" : "#EBEBEB"}`, display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", transition: "all 0.2s" }}
          >
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: online ? "#0ECB81" : "#1E2026" }}>
                {online ? "Accepting Orders" : "Go Online"}
              </div>
              <div style={{ fontSize: 11, fontWeight: 500, color: "#848E9C", marginTop: 2 }}>
                {online ? "Tap to go offline" : "Tap to start accepting"}
              </div>
            </div>
            <div style={{ width: 46, height: 27, borderRadius: 14, background: online ? "#0ECB81" : "#D9D9D9", position: "relative", transition: "background 0.25s" }}>
              <div style={{ width: 21, height: 21, borderRadius: 11, background: "#fff", position: "absolute", top: 3, left: online ? 22 : 3, boxShadow: "0 2px 6px rgba(0,0,0,0.15)", transition: "left 0.25s" }} />
            </div>
          </div>

          {flash && (
            <div style={{ marginTop: 10, background: YELLOW_BG, borderRadius: 12, padding: "12px 14px", border: `1px solid ${YELLOW_BORDER}`, display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 8, height: 8, borderRadius: 4, background: YELLOW, flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#1E2026" }}>New Order Alert</div>
                <div style={{ fontSize: 11, color: "#848E9C", marginTop: 1 }}>0.8 km · ₨ 250 · Estimated fare</div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 32 }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#848E9C", textTransform: "uppercase", letterSpacing: 1 }}>V5 — Binance Light</div>
          <div style={{ fontSize: 11, color: "#C8C8C8", marginTop: 4 }}>BNB yellow · clean white · professional</div>
          <button onClick={() => setFlash(!flash)} style={{ marginTop: 12, padding: "8px 18px", borderRadius: 6, background: "#F0B90B", border: "none", color: "#1E2026", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
            Toggle alert
          </button>
        </div>
      </div>
    </div>
  );
}
