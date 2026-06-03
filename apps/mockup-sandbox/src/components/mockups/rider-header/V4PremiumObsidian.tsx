import { useState } from "react";

export function V4PremiumObsidian() {
  const [online, setOnline] = useState(true);
  const [flash, setFlash] = useState(false);

  const GOLD = "#C9A84C";
  const GOLD_LIGHT = "#E8C878";
  const GOLD_GLOW = "rgba(201,168,76,0.15)";

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#080808", fontFamily: "'Helvetica Neue', Arial, sans-serif" }}>
      {/* Header */}
      <div style={{ background: "linear-gradient(180deg, #111111 0%, #0D0D0D 100%)", paddingTop: 52, borderBottom: "1px solid rgba(201,168,76,0.12)" }}>
        <div style={{ padding: "0 22px 22px" }}>

          {/* Gold accent line */}
          <div style={{ height: 1, background: `linear-gradient(90deg, transparent, ${GOLD}, transparent)`, marginBottom: 20, opacity: 0.6 }} />

          {/* Top nav */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 26 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: `linear-gradient(145deg, #1A1A1A, #111111)`, border: `1px solid ${GOLD}30`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 0 20px ${GOLD_GLOW}` }}>
                <span style={{ fontSize: 16, fontWeight: 800, background: `linear-gradient(135deg, ${GOLD_LIGHT}, ${GOLD})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>A</span>
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#F5F5F5", letterSpacing: 0.5 }}>AJKMart</div>
                <div style={{ fontSize: 10, fontWeight: 600, color: GOLD, letterSpacing: 1.5, textTransform: "uppercase" }}>Rider</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setFlash(!flash)} style={{ width: 36, height: 36, borderRadius: 8, background: "#1A1A1A", border: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={flash ? GOLD : "rgba(255,255,255,0.3)"} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
              </button>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: `linear-gradient(135deg, ${GOLD}, #A0802A)`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 4px 16px ${GOLD_GLOW}` }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: "#080808" }}>AR</span>
              </div>
            </div>
          </div>

          {/* Name + greeting */}
          <div style={{ marginBottom: 22 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.3)", letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 }}>Good Morning</div>
            <div style={{ fontSize: 32, fontWeight: 700, color: "#FFFFFF", letterSpacing: -0.8, lineHeight: 1.05 }}>Ali Raza</div>
            <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: 4, background: online ? "#4ADE80" : "#3A3A3A", boxShadow: online ? "0 0 0 4px rgba(74,222,128,0.12)" : "none", transition: "all 0.3s" }} />
              <span style={{ fontSize: 12, fontWeight: 500, color: online ? "#4ADE80" : "rgba(255,255,255,0.3)" }}>
                {online ? "Online · Available for rides" : "Offline"}
              </span>
            </div>
          </div>

          {/* Premium wallet card */}
          <div style={{ background: `linear-gradient(135deg, #1A1A1A 0%, #141414 60%, rgba(201,168,76,0.04) 100%)`, borderRadius: 18, padding: "18px 20px", border: `1px solid rgba(201,168,76,0.16)`, marginBottom: 10, position: "relative", overflow: "hidden" }}>
            {/* Corner embellishment */}
            <div style={{ position: "absolute", top: 0, right: 0, width: 80, height: 80, background: `radial-gradient(circle, ${GOLD_GLOW} 0%, transparent 70%)` }} />
            <div style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 10 }}>Balance</div>
            <div style={{ fontSize: 34, fontWeight: 700, color: "#FFFFFF", letterSpacing: -1, marginBottom: 4 }}>₨ 2,450</div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "#4ADE80" }}>+₨ 120 today</span>
              <span style={{ width: 1, height: 12, background: "rgba(255,255,255,0.1)" }} />
              <span style={{ fontSize: 12, fontWeight: 500, color: GOLD }}>Gold tier</span>
            </div>
          </div>

          {/* Stats */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 10 }}>
            {[
              { label: "Today", value: "₨ 1.2K" },
              { label: "Trips", value: "248" },
              { label: "Rating", value: "4.9" },
            ].map(({ label, value }) => (
              <div key={label} style={{ background: "#141414", borderRadius: 12, padding: "12px 14px", border: "1px solid rgba(255,255,255,0.04)" }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.25)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>{label}</div>
                <div style={{ fontSize: 17, fontWeight: 700, color: "#FFFFFF", letterSpacing: -0.3 }}>{value}</div>
              </div>
            ))}
          </div>

          {/* Online toggle bar */}
          <div
            onClick={() => setOnline(!online)}
            style={{ background: online ? `linear-gradient(135deg, rgba(74,222,128,0.08), rgba(74,222,128,0.04))` : "#141414", borderRadius: 14, padding: "14px 18px", border: `1px solid ${online ? "rgba(74,222,128,0.2)" : "rgba(255,255,255,0.04)"}`, display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", transition: "all 0.25s" }}
          >
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: online ? "#4ADE80" : "rgba(255,255,255,0.4)" }}>
                {online ? "Accepting Rides" : "Go Online"}
              </div>
              <div style={{ fontSize: 11, fontWeight: 500, color: "rgba(255,255,255,0.2)", marginTop: 2 }}>
                {online ? "Tap to go offline" : "Tap to start earning"}
              </div>
            </div>
            <div style={{ width: 48, height: 28, borderRadius: 14, background: online ? "#4ADE80" : "#2A2A2A", position: "relative", transition: "background 0.25s" }}>
              <div style={{ width: 22, height: 22, borderRadius: 11, background: "#fff", position: "absolute", top: 3, left: online ? 23 : 3, transition: "left 0.25s", boxShadow: "0 2px 8px rgba(0,0,0,0.4)" }} />
            </div>
          </div>

          {flash && (
            <div style={{ marginTop: 10, background: "rgba(201,168,76,0.06)", borderRadius: 14, padding: "14px 18px", border: `1px solid rgba(201,168,76,0.2)`, display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 10, height: 10, borderRadius: 5, background: GOLD, boxShadow: `0 0 8px ${GOLD}80`, flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: GOLD_LIGHT }}>New Ride Request</div>
                <div style={{ fontSize: 11, fontWeight: 500, color: "rgba(255,255,255,0.3)", marginTop: 2 }}>0.8 km · ₨ 250 · Cash</div>
              </div>
            </div>
          )}

          {/* Bottom gold line */}
          <div style={{ height: 1, background: `linear-gradient(90deg, transparent, ${GOLD}40, transparent)`, marginTop: 18 }} />
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 32 }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#2A2A2A", textTransform: "uppercase", letterSpacing: 1 }}>V4 — Premium Obsidian</div>
          <div style={{ fontSize: 11, color: "#1A1A1A", marginTop: 4 }}>Pure black · liquid gold · luxury fintech</div>
          <button onClick={() => setFlash(!flash)} style={{ marginTop: 12, padding: "8px 18px", borderRadius: 8, background: "#C9A84C", border: "none", color: "#080808", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
            Toggle alert
          </button>
        </div>
      </div>
    </div>
  );
}
