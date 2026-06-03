import { useState } from "react";

// V4-A: Horizontal Hero
// Balance card is a full-bleed cinematic hero at top.
// Metric row flows horizontally below it.
// Status toggle is a bold wide pill that anchors the bottom.
// Visual weight: TOP heavy → thin strip → wide action.

const GOLD = "#C9A84C";
const GOLD_LIGHT = "#E8C878";
const GOLD_GLOW = "rgba(201,168,76,0.15)";

export function V4A_HorizontalHero() {
  const [online, setOnline] = useState(true);
  const [flash, setFlash] = useState(false);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#080808", fontFamily: "'Helvetica Neue', Arial, sans-serif" }}>
      {/* HERO — full-bleed balance card, maximum visual weight */}
      <div style={{
        background: "linear-gradient(160deg, #161616 0%, #111111 50%, rgba(201,168,76,0.03) 100%)",
        paddingTop: 52,
        borderBottom: "1px solid rgba(201,168,76,0.1)",
        position: "relative",
        overflow: "hidden",
      }}>
        {/* Large ambient gold orb — top right */}
        <div style={{ position: "absolute", top: -60, right: -60, width: 200, height: 200, borderRadius: "50%", background: "radial-gradient(circle, rgba(201,168,76,0.06) 0%, transparent 70%)", pointerEvents: "none" }} />

        {/* Slim top bar — logo left, avatar right */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px", marginBottom: 28 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 28, height: 28, borderRadius: 7, background: `linear-gradient(145deg, #1A1A1A, #111)`, border: `1px solid ${GOLD}28`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: 12, fontWeight: 800, background: `linear-gradient(135deg, ${GOLD_LIGHT}, ${GOLD})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>A</span>
            </div>
            <span style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.5)", letterSpacing: 0.3 }}>AJKMart Rider</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button onClick={() => setFlash(!flash)} style={{ width: 30, height: 30, borderRadius: 7, background: "#1A1A1A", border: "1px solid rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={flash ? GOLD : "rgba(255,255,255,0.25)"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
            </button>
            <div style={{ width: 30, height: 30, borderRadius: 7, background: `linear-gradient(135deg, ${GOLD}, #A0802A)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: 10, fontWeight: 800, color: "#080808" }}>AR</span>
            </div>
          </div>
        </div>

        {/* HERO BALANCE — cinematic, oversized */}
        <div style={{ padding: "0 20px", marginBottom: 24 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.2)", letterSpacing: 2.5, textTransform: "uppercase", marginBottom: 4 }}>Available Balance</div>
          <div style={{ fontSize: 52, fontWeight: 700, color: "#FFFFFF", letterSpacing: -2, lineHeight: 1, marginBottom: 8 }}>
            ₨&thinsp;2,450
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#4ADE80" }}>+₨ 120 today</span>
            <span style={{ width: 1, height: 13, background: "rgba(255,255,255,0.1)" }} />
            <span style={{ fontSize: 11, fontWeight: 600, color: GOLD, background: "rgba(201,168,76,0.08)", borderRadius: 5, padding: "2px 8px", border: `1px solid rgba(201,168,76,0.2)` }}>GOLD</span>
            <span style={{ width: 1, height: 13, background: "rgba(255,255,255,0.1)" }} />
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 6, height: 6, borderRadius: 3, background: online ? "#4ADE80" : "#333", display: "block", boxShadow: online ? "0 0 0 3px rgba(74,222,128,0.1)" : "none" }} />
              <span style={{ fontSize: 11, fontWeight: 500, color: online ? "#4ADE80" : "rgba(255,255,255,0.2)" }}>{online ? "Online" : "Offline"}</span>
            </div>
          </div>
        </div>

        {/* HORIZONTAL metric strip */}
        <div style={{ display: "flex", borderTop: "1px solid rgba(255,255,255,0.04)" }}>
          {[
            { label: "Today", value: "₨ 1.2K" },
            { label: "Trips", value: "248" },
            { label: "Rating", value: "4.9 ★" },
            { label: "Hours", value: "6.5h" },
          ].map(({ label, value }, i, arr) => (
            <div key={label} style={{ flex: 1, padding: "12px 0 12px 16px", borderRight: i < arr.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
              <div style={{ fontSize: 9, fontWeight: 600, color: "rgba(255,255,255,0.2)", textTransform: "uppercase", letterSpacing: 1 }}>{label}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#FFFFFF", marginTop: 3 }}>{value}</div>
            </div>
          ))}
        </div>

        {/* Greeting + name — secondary position, beneath balance */}
        <div style={{ padding: "12px 20px 0" }}>
          <div style={{ fontSize: 11, fontWeight: 500, color: "rgba(255,255,255,0.2)" }}>Good morning, <span style={{ color: "rgba(255,255,255,0.5)", fontWeight: 600 }}>Ali Raza</span></div>
        </div>

        {/* STATUS TOGGLE — wide pill, full-width, anchors bottom */}
        <div style={{ padding: "12px 20px 20px" }}>
          <div
            onClick={() => setOnline(!online)}
            style={{
              background: online ? "rgba(74,222,128,0.07)" : "rgba(255,255,255,0.03)",
              borderRadius: 14,
              padding: "14px 18px",
              border: `1px solid ${online ? "rgba(74,222,128,0.18)" : "rgba(255,255,255,0.06)"}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              cursor: "pointer",
              transition: "all 0.25s",
            }}
          >
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: online ? "#4ADE80" : "rgba(255,255,255,0.35)", letterSpacing: -0.2 }}>
                {online ? "Accepting Rides" : "Go Online"}
              </div>
              <div style={{ fontSize: 10, fontWeight: 500, color: "rgba(255,255,255,0.18)", marginTop: 2 }}>
                {online ? "Tap to stop" : "Tap to start earning"}
              </div>
            </div>
            <div style={{ width: 48, height: 28, borderRadius: 14, background: online ? "#4ADE80" : "#222", position: "relative", transition: "background 0.25s" }}>
              <div style={{ width: 22, height: 22, borderRadius: 11, background: "#fff", position: "absolute", top: 3, left: online ? 23 : 3, transition: "left 0.25s", boxShadow: "0 2px 8px rgba(0,0,0,0.5)" }} />
            </div>
          </div>
        </div>

        {flash && (
          <div style={{ margin: "0 20px 16px", background: "rgba(201,168,76,0.06)", borderRadius: 12, padding: "12px 16px", border: `1px solid rgba(201,168,76,0.18)`, display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 8, height: 8, borderRadius: 4, background: GOLD, boxShadow: `0 0 8px ${GOLD}80`, flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: GOLD_LIGHT }}>New Ride Request</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", marginTop: 1 }}>0.8 km · ₨ 250 · Cash</div>
            </div>
          </div>
        )}
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#2A2A2A", textTransform: "uppercase", letterSpacing: 1 }}>V4-A · Horizontal Hero</div>
          <div style={{ fontSize: 10, color: "#1A1A1A", marginTop: 3 }}>Oversized balance · horizontal metrics · wide toggle</div>
          <button onClick={() => setFlash(!flash)} style={{ marginTop: 12, padding: "7px 16px", borderRadius: 8, background: "#C9A84C", border: "none", color: "#080808", fontSize: 10, fontWeight: 700, cursor: "pointer" }}>
            Toggle request
          </button>
        </div>
      </div>
    </div>
  );
}
