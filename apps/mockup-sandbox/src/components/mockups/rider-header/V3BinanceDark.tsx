import { useState } from "react";

export function V3BinanceDark() {
  const [online, setOnline] = useState(true);
  const [flash, setFlash] = useState(false);

  const YELLOW = "#F0B90B";
  const BG = "#0B0E11";
  const CARD = "#181A20";
  const CARD2 = "#1E2026";
  const BORDER = "rgba(255,255,255,0.06)";

  return (
    <div className="min-h-screen flex flex-col" style={{ background: BG, fontFamily: "'Helvetica Neue', Arial, sans-serif" }}>
      {/* Header */}
      <div style={{ background: CARD, paddingTop: 52, borderBottom: `1px solid ${BORDER}` }}>
        <div style={{ padding: "0 20px 20px" }}>

          {/* Top bar */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {/* Binance-style logo mark */}
              <div style={{ width: 32, height: 32, background: YELLOW, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg viewBox="0 0 32 32" width="18" height="18" fill="#0B0E11">
                  <path d="M16 4 L20 8 L16 12 L12 8 Z M4 16 L8 12 L12 16 L8 20 Z M16 20 L20 16 L24 20 L20 24 Z M28 16 L24 12 L20 16 L24 20 Z M16 14 L20 18 L16 22 L12 18 Z" />
                </svg>
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#EAECEF", letterSpacing: -0.2 }}>AJKMart</div>
                <div style={{ fontSize: 10, fontWeight: 500, color: "#848E9C", letterSpacing: 0.3 }}>Rider Network</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setFlash(!flash)} style={{ width: 36, height: 36, borderRadius: 8, background: CARD2, border: `1px solid ${BORDER}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", position: "relative" }}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={flash ? YELLOW : "#848E9C"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
                {flash && <span style={{ position: "absolute", top: 5, right: 5, width: 7, height: 7, borderRadius: 4, background: "#F6465D", border: `1.5px solid ${CARD}` }} />}
              </button>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: YELLOW, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: "#0B0E11" }}>AR</span>
              </div>
            </div>
          </div>

          {/* Greeting + status */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: "#848E9C", marginBottom: 4 }}>Welcome back</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: "#EAECEF", letterSpacing: -0.5, lineHeight: 1.1 }}>Ali Raza</div>
            <div style={{ marginTop: 8, display: "inline-flex", alignItems: "center", gap: 6, background: online ? "rgba(14,203,129,0.1)" : CARD2, borderRadius: 20, padding: "4px 10px", border: `1px solid ${online ? "rgba(14,203,129,0.25)" : BORDER}` }}>
              <span style={{ width: 6, height: 6, borderRadius: 3, background: online ? "#0ECB81" : "#848E9C", display: "block" }} />
              <span style={{ fontSize: 11, fontWeight: 600, color: online ? "#0ECB81" : "#848E9C" }}>
                {online ? "Active" : "Offline"}
              </span>
            </div>
          </div>

          {/* Wallet highlight */}
          <div style={{ background: `linear-gradient(135deg, ${CARD2} 0%, rgba(240,185,11,0.06) 100%)`, borderRadius: 14, padding: "16px 18px", border: `1px solid rgba(240,185,11,0.12)`, marginBottom: 10 }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#848E9C", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 6 }}>Available Balance</div>
                <div style={{ fontSize: 28, fontWeight: 700, color: "#EAECEF", letterSpacing: -0.8 }}>₨ 2,450</div>
                <div style={{ fontSize: 12, fontWeight: 500, color: "#0ECB81", marginTop: 4 }}>▲ ₨ 120.00 (5.15%)</div>
              </div>
              <div style={{ background: "rgba(240,185,11,0.1)", borderRadius: 10, padding: "8px 12px", border: `1px solid rgba(240,185,11,0.2)` }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={YELLOW} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" /><path d="M3 5v14a2 2 0 0 0 2 2h16v-5" /><path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
                </svg>
              </div>
            </div>
          </div>

          {/* Stats row */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            {[
              { label: "Today", value: "₨ 1.2K", change: "+15%", up: true },
              { label: "Trips", value: "248", change: "+6", up: true },
              { label: "Rating", value: "4.9", change: "★★★★★", up: true },
            ].map(({ label, value, change, up }) => (
              <div key={label} style={{ background: CARD2, borderRadius: 12, padding: "12px 12px", border: `1px solid ${BORDER}` }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: "#848E9C", textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#EAECEF", marginTop: 4, letterSpacing: -0.3 }}>{value}</div>
                <div style={{ fontSize: 10, fontWeight: 600, color: up ? "#0ECB81" : "#F6465D", marginTop: 2 }}>{change}</div>
              </div>
            ))}
          </div>

          {/* Status toggle */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10, marginTop: 10, alignItems: "center" }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: "#848E9C" }}>
              {online ? "You are visible to nearby customers" : "You are hidden from customers"}
            </div>
            <div
              onClick={() => setOnline(!online)}
              style={{ width: 48, height: 28, borderRadius: 14, background: online ? "#0ECB81" : CARD2, position: "relative", cursor: "pointer", border: `1px solid ${online ? "#0ECB81" : BORDER}`, transition: "all 0.25s" }}
            >
              <div style={{ width: 22, height: 22, borderRadius: 11, background: "#fff", position: "absolute", top: 2, left: online ? 23 : 2, boxShadow: "0 2px 6px rgba(0,0,0,0.3)", transition: "left 0.25s" }} />
            </div>
          </div>

          {flash && (
            <div style={{ marginTop: 10, background: "rgba(240,185,11,0.08)", borderRadius: 12, padding: "12px 14px", border: `1px solid rgba(240,185,11,0.2)`, display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 8, height: 8, borderRadius: 4, background: YELLOW, flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: YELLOW }}>New Order Alert</div>
                <div style={{ fontSize: 11, color: "#848E9C", marginTop: 1 }}>0.8 km away · ₨ 250 · Cash on Delivery</div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 32 }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#2C2F33", textTransform: "uppercase", letterSpacing: 1 }}>V3 — Binance Dark</div>
          <div style={{ fontSize: 11, color: "#1E2026", marginTop: 4 }}>BNB yellow · trading dashboard · financial data</div>
          <button onClick={() => setFlash(!flash)} style={{ marginTop: 12, padding: "8px 16px", borderRadius: 6, background: "#F0B90B", border: "none", color: "#0B0E11", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
            Toggle alert
          </button>
        </div>
      </div>
    </div>
  );
}
