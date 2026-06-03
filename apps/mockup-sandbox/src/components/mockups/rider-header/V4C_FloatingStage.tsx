import { useState } from "react";

// V4-C: Floating Stage
// Slim utility bar at top (logo + avatar).
// Center "stage" = single large status card — full visual focus, no splitting.
// Bottom: compact horizontal metric pills.
// Visual weight: CENTER stage takes 60% of height — one card rules all.
// Generous whitespace creates luxury breathing room.

const GOLD = "#C9A84C";
const GOLD_LIGHT = "#E8C878";
const GOLD_GLOW = "rgba(201,168,76,0.12)";

export function V4C_FloatingStage() {
  const [online, setOnline] = useState(true);
  const [flash, setFlash] = useState(false);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#080808", fontFamily: "'Helvetica Neue', Arial, sans-serif" }}>
      <div style={{
        background: "#0C0C0C",
        paddingTop: 52,
        borderBottom: "1px solid rgba(201,168,76,0.08)",
      }}>
        {/* UTILITY BAR — slim, minimal */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px", marginBottom: 22 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <div style={{ width: 30, height: 30, borderRadius: 9, background: `linear-gradient(145deg, #1E1E1E, #141414)`, border: `1px solid ${GOLD}28`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 0 12px ${GOLD_GLOW}` }}>
              <span style={{ fontSize: 13, fontWeight: 800, background: `linear-gradient(135deg, ${GOLD_LIGHT}, ${GOLD})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>A</span>
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.7)", letterSpacing: -0.1 }}>Ali Raza</div>
              <div style={{ fontSize: 9, fontWeight: 600, color: GOLD, letterSpacing: 1.5, textTransform: "uppercase" }}>Gold Rider</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 7 }}>
            <button onClick={() => setFlash(!flash)} style={{ width: 32, height: 32, borderRadius: 9, background: "#161616", border: "1px solid rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={flash ? GOLD : "rgba(255,255,255,0.2)"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
                {flash && <circle cx="18" cy="6" r="4" fill="#C9A84C" stroke="#0C0C0C" strokeWidth="1.5" />}
              </svg>
            </button>
            <div style={{ width: 32, height: 32, borderRadius: 9, background: `linear-gradient(135deg, ${GOLD}, #906F20)`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 4px 16px ${GOLD_GLOW}` }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: "#080808" }}>AR</span>
            </div>
          </div>
        </div>

        {/* CENTER STAGE — the single dominant card */}
        <div style={{ padding: "0 18px", marginBottom: 14 }}>
          <div
            onClick={() => setOnline(!online)}
            style={{
              background: online
                ? `linear-gradient(145deg, #141414 0%, rgba(74,222,128,0.04) 100%)`
                : `linear-gradient(145deg, #141414 0%, #111 100%)`,
              borderRadius: 22,
              padding: "22px 22px 20px",
              border: `1px solid ${online ? "rgba(74,222,128,0.12)" : "rgba(201,168,76,0.08)"}`,
              cursor: "pointer",
              transition: "all 0.3s",
              position: "relative",
              overflow: "hidden",
            }}
          >
            {/* Ambient glow spot */}
            <div style={{ position: "absolute", top: -30, right: -30, width: 130, height: 130, borderRadius: "50%", background: `radial-gradient(circle, ${online ? "rgba(74,222,128,0.04)" : GOLD_GLOW} 0%, transparent 70%)`, pointerEvents: "none" }} />

            {/* Status badge top-right */}
            <div style={{ position: "absolute", top: 18, right: 18, display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 7, height: 7, borderRadius: 4, background: online ? "#4ADE80" : "#2A2A2A", display: "block", boxShadow: online ? "0 0 0 3px rgba(74,222,128,0.1)" : "none", transition: "all 0.3s" }} />
              {/* Mini toggle */}
              <div style={{ width: 36, height: 21, borderRadius: 11, background: online ? "#4ADE80" : "#2A2A2A", position: "relative", transition: "background 0.25s" }}>
                <div style={{ width: 17, height: 17, borderRadius: 9, background: "#fff", position: "absolute", top: 2, left: online ? 17 : 2, transition: "left 0.25s", boxShadow: "0 1px 4px rgba(0,0,0,0.5)" }} />
              </div>
            </div>

            {/* Balance — the star */}
            <div style={{ marginBottom: 16, paddingRight: 60 }}>
              <div style={{ fontSize: 9, fontWeight: 600, color: "rgba(255,255,255,0.18)", letterSpacing: 2, textTransform: "uppercase", marginBottom: 10 }}>Balance</div>
              <div style={{ fontSize: 42, fontWeight: 700, color: "#FFFFFF", letterSpacing: -1.5, lineHeight: 1 }}>₨ 2,450</div>
            </div>

            {/* Divider rule */}
            <div style={{ height: 1, background: "rgba(255,255,255,0.04)", margin: "0 0 14px" }} />

            {/* Status + earnings — secondary level */}
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, color: online ? "#4ADE80" : "rgba(255,255,255,0.25)", letterSpacing: -0.3 }}>
                  {online ? "Accepting Rides" : "Go Online"}
                </div>
                <div style={{ fontSize: 10, fontWeight: 500, color: "rgba(255,255,255,0.18)", marginTop: 3 }}>
                  {online ? "Tap anywhere to stop" : "Tap to start earning"}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#4ADE80" }}>+₨ 120</div>
                <div style={{ fontSize: 9, fontWeight: 500, color: "rgba(255,255,255,0.18)" }}>today</div>
              </div>
            </div>
          </div>
        </div>

        {/* BOTTOM — compact pill metrics */}
        <div style={{ padding: "0 18px", marginBottom: 16, display: "flex", gap: 8 }}>
          {[
            { label: "Today", value: "₨ 1.2K" },
            { label: "Trips", value: "248" },
            { label: "Rating", value: "4.9 ★", gold: true },
            { label: "Hours", value: "6.5h" },
          ].map(({ label, value, gold }) => (
            <div key={label} style={{ flex: 1, background: "#141414", borderRadius: 10, padding: "10px 8px", border: "1px solid rgba(255,255,255,0.04)", textAlign: "center" }}>
              <div style={{ fontSize: 8, fontWeight: 600, color: "rgba(255,255,255,0.18)", textTransform: "uppercase", letterSpacing: 0.8 }}>{label}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: gold ? GOLD : "#FFFFFF", marginTop: 4, letterSpacing: -0.3 }}>{value}</div>
            </div>
          ))}
        </div>

        {flash && (
          <div style={{ margin: "0 18px 16px", background: "rgba(201,168,76,0.05)", borderRadius: 12, padding: "12px 16px", border: `1px solid rgba(201,168,76,0.16)`, display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 8, height: 8, borderRadius: 4, background: GOLD, boxShadow: `0 0 10px ${GOLD}70`, flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: GOLD_LIGHT }}>New Ride Request</div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", marginTop: 1 }}>0.8 km · ₨ 250 · Cash</div>
            </div>
          </div>
        )}
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#2A2A2A", textTransform: "uppercase", letterSpacing: 1 }}>V4-C · Floating Stage</div>
          <div style={{ fontSize: 10, color: "#1A1A1A", marginTop: 3 }}>Single dominant card · luxury breathing room · click to toggle</div>
          <button onClick={() => setFlash(!flash)} style={{ marginTop: 12, padding: "7px 16px", borderRadius: 8, background: "#C9A84C", border: "none", color: "#080808", fontSize: 10, fontWeight: 700, cursor: "pointer" }}>
            Toggle request
          </button>
        </div>
      </div>
    </div>
  );
}
