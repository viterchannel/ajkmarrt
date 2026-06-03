import { useState } from "react";

// V4-B: Split Column
// Left column: identity (name, greeting, status dot) + toggle.
// Right column: balance figure + metric stack.
// Dense, side-by-side — maximum info in minimum vertical space.
// Visual weight: evenly distributed L/R, compact, information-dense.

const GOLD = "#C9A84C";
const GOLD_LIGHT = "#E8C878";

export function V4B_SplitColumn() {
  const [online, setOnline] = useState(true);
  const [flash, setFlash] = useState(false);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#080808", fontFamily: "'Helvetica Neue', Arial, sans-serif" }}>
      <div style={{
        background: "linear-gradient(180deg, #141414 0%, #0F0F0F 100%)",
        paddingTop: 52,
        borderBottom: "1px solid rgba(201,168,76,0.08)",
      }}>
        {/* Top bar */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 18px", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 26, height: 26, borderRadius: 7, background: `linear-gradient(135deg, ${GOLD}, #A0802A)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: "#080808" }}>A</span>
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.4)", letterSpacing: 0.5, textTransform: "uppercase" }}>AJKMart</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <button onClick={() => setFlash(!flash)} style={{ width: 28, height: 28, borderRadius: 7, background: "#1A1A1A", border: "1px solid rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={flash ? GOLD : "rgba(255,255,255,0.2)"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
            </button>
            <div style={{ width: 28, height: 28, borderRadius: 7, background: "#1A1A1A", border: `1px solid ${GOLD}28`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: GOLD }}>AR</span>
            </div>
          </div>
        </div>

        {/* Thin gold rule */}
        <div style={{ height: 1, background: `linear-gradient(90deg, transparent, ${GOLD}30, transparent)`, margin: "0 18px 16px" }} />

        {/* SPLIT: Left identity / Right financials */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1px 1fr", padding: "0 18px", gap: 0, marginBottom: 14 }}>
          {/* LEFT — identity */}
          <div style={{ paddingRight: 16 }}>
            <div style={{ fontSize: 9, fontWeight: 600, color: "rgba(255,255,255,0.18)", letterSpacing: 1.8, textTransform: "uppercase", marginBottom: 8 }}>Rider</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: "#FFFFFF", letterSpacing: -0.6, lineHeight: 1.05, marginBottom: 8 }}>Ali<br />Raza</div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 14 }}>
              <span style={{ width: 7, height: 7, borderRadius: 4, background: online ? "#4ADE80" : "#333", display: "block", boxShadow: online ? "0 0 0 3px rgba(74,222,128,0.12)" : "none", transition: "all 0.3s" }} />
              <span style={{ fontSize: 10, fontWeight: 600, color: online ? "#4ADE80" : "rgba(255,255,255,0.2)" }}>
                {online ? "Online" : "Offline"}
              </span>
            </div>
            {/* Compact toggle */}
            <div
              onClick={() => setOnline(!online)}
              style={{ background: online ? "rgba(74,222,128,0.07)" : "#1A1A1A", borderRadius: 10, padding: "10px 12px", border: `1px solid ${online ? "rgba(74,222,128,0.18)" : "rgba(255,255,255,0.05)"}`, cursor: "pointer", transition: "all 0.25s" }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: online ? "#4ADE80" : "rgba(255,255,255,0.3)" }}>
                  {online ? "Active" : "Go Online"}
                </span>
                <div style={{ width: 32, height: 18, borderRadius: 9, background: online ? "#4ADE80" : "#2A2A2A", position: "relative", transition: "background 0.25s" }}>
                  <div style={{ width: 14, height: 14, borderRadius: 7, background: "#fff", position: "absolute", top: 2, left: online ? 16 : 2, transition: "left 0.25s", boxShadow: "0 1px 4px rgba(0,0,0,0.4)" }} />
                </div>
              </div>
              <div style={{ fontSize: 9, fontWeight: 500, color: "rgba(255,255,255,0.15)" }}>
                {online ? "Tap to stop" : "Tap to start"}
              </div>
            </div>
          </div>

          {/* DIVIDER */}
          <div style={{ background: "rgba(201,168,76,0.1)", margin: "0 0" }} />

          {/* RIGHT — financials */}
          <div style={{ paddingLeft: 16 }}>
            <div style={{ fontSize: 9, fontWeight: 600, color: "rgba(255,255,255,0.18)", letterSpacing: 1.8, textTransform: "uppercase", marginBottom: 8 }}>Balance</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: "#FFFFFF", letterSpacing: -0.8, lineHeight: 1, marginBottom: 4 }}>₨ 2,450</div>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#4ADE80", marginBottom: 14 }}>+₨ 120 today</div>

            {/* Stacked metric cells */}
            {[
              { label: "TODAY", value: "₨ 1.2K" },
              { label: "TRIPS", value: "248" },
              { label: "RATING", value: `4.9 ★` },
            ].map(({ label, value }, i) => (
              <div key={label} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "7px 0",
                borderTop: i > 0 ? "1px solid rgba(255,255,255,0.04)" : "1px solid rgba(255,255,255,0.04)",
              }}>
                <span style={{ fontSize: 9, fontWeight: 600, color: "rgba(255,255,255,0.2)", letterSpacing: 1 }}>{label}</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: label === "RATING" ? GOLD : "#FFFFFF", letterSpacing: -0.3 }}>{value}</span>
              </div>
            ))}

            <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 10, fontWeight: 600, color: GOLD, background: "rgba(201,168,76,0.08)", borderRadius: 5, padding: "2px 8px", border: `1px solid rgba(201,168,76,0.2)` }}>GOLD TIER</span>
            </div>
          </div>
        </div>

        {/* Thin gold rule */}
        <div style={{ height: 1, background: `linear-gradient(90deg, transparent, ${GOLD}30, transparent)`, margin: "0 18px" }} />

        {flash && (
          <div style={{ margin: "12px 18px", background: "rgba(201,168,76,0.05)", borderRadius: 10, padding: "10px 14px", border: `1px solid rgba(201,168,76,0.15)`, display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 7, height: 7, borderRadius: 4, background: GOLD, flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: GOLD_LIGHT }}>New Ride Request</div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", marginTop: 1 }}>0.8 km · ₨ 250 · Cash</div>
            </div>
          </div>
        )}

        <div style={{ height: 16 }} />
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#2A2A2A", textTransform: "uppercase", letterSpacing: 1 }}>V4-B · Split Column</div>
          <div style={{ fontSize: 10, color: "#1A1A1A", marginTop: 3 }}>Dense L/R split · identity | financials · compact</div>
          <button onClick={() => setFlash(!flash)} style={{ marginTop: 12, padding: "7px 16px", borderRadius: 8, background: "#C9A84C", border: "none", color: "#080808", fontSize: 10, fontWeight: 700, cursor: "pointer" }}>
            Toggle request
          </button>
        </div>
      </div>
    </div>
  );
}
