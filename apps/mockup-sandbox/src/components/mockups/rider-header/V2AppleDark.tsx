import { useState } from "react";

export function V2AppleDark() {
  const [online, setOnline] = useState(true);
  const [flash, setFlash] = useState(false);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#000000", fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', sans-serif" }}>
      {/* Header */}
      <div style={{ background: "#1C1C1E", paddingTop: 56, borderRadius: "0 0 32px 32px", boxShadow: "0 1px 0 rgba(255,255,255,0.06), 0 8px 40px rgba(0,0,0,0.5)" }}>
        <div style={{ padding: "0 22px 26px" }}>

          {/* Top nav */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 12, background: "linear-gradient(145deg, #2C2C2E, #3A3A3C)", border: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontSize: 15, fontWeight: 800, color: "#FFFFFF", letterSpacing: -0.5 }}>A</span>
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#FFFFFF", letterSpacing: -0.3 }}>AJKMart</div>
                <div style={{ fontSize: 11, fontWeight: 500, color: "#636366" }}>Rider</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setFlash(!flash)} style={{ width: 36, height: 36, borderRadius: 18, background: "#2C2C2E", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", position: "relative" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={flash ? "#FF9F0A" : "#636366"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
                {flash && <span style={{ position: "absolute", top: 6, right: 6, width: 8, height: 8, borderRadius: 4, background: "#FF3B30", border: "1.5px solid #1C1C1E" }} />}
              </button>
              <div style={{ width: 36, height: 36, borderRadius: 18, background: "linear-gradient(145deg, #3A3A3C, #2C2C2E)", border: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#EBEBF5" }}>AR</span>
              </div>
            </div>
          </div>

          {/* Greeting */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: "#636366", marginBottom: 4 }}>Good morning</div>
            <div style={{ fontSize: 34, fontWeight: 700, color: "#FFFFFF", letterSpacing: -1, lineHeight: 1.05 }}>Ali Raza</div>
            <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 7, height: 7, borderRadius: 4, background: online ? "#30D158" : "#3A3A3C", boxShadow: online ? "0 0 0 4px rgba(48,209,88,0.15)" : "none", transition: "all 0.3s" }} />
              <span style={{ fontSize: 13, fontWeight: 500, color: online ? "#30D158" : "#48484A" }}>
                {online ? "Active — accepting rides" : "Offline · tap to go online"}
              </span>
            </div>
          </div>

          {/* Primary card */}
          <div style={{ background: online ? "rgba(48,209,88,0.08)" : "#2C2C2E", borderRadius: 20, padding: "16px 18px", marginBottom: 10, border: `1px solid ${online ? "rgba(48,209,88,0.18)" : "rgba(255,255,255,0.04)"}`, transition: "all 0.3s" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#636366", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 }}>Status</div>
                <button
                  onClick={() => setOnline(!online)}
                  style={{ background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left" }}
                >
                  <div style={{ fontSize: 20, fontWeight: 700, color: online ? "#30D158" : "#FFFFFF", letterSpacing: -0.3 }}>
                    {online ? "Online" : "Go Online"}
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 500, color: "#636366", marginTop: 2 }}>
                    {online ? "Tap to go offline" : "Tap to start accepting"}
                  </div>
                </button>
              </div>
              {/* iOS toggle */}
              <div
                onClick={() => setOnline(!online)}
                style={{ width: 51, height: 31, borderRadius: 16, background: online ? "#30D158" : "#3A3A3C", position: "relative", cursor: "pointer", transition: "background 0.25s" }}
              >
                <div style={{ width: 27, height: 27, borderRadius: 14, background: "#fff", position: "absolute", top: 2, left: online ? 22 : 2, boxShadow: "0 3px 8px rgba(0,0,0,0.3)", transition: "left 0.25s" }} />
              </div>
            </div>
          </div>

          {/* Metrics grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div style={{ background: "#2C2C2E", borderRadius: 18, padding: "14px 16px" }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#636366", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 6 }}>Wallet</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: "#FFFFFF", letterSpacing: -0.5 }}>₨ 2,450</div>
              <div style={{ fontSize: 11, fontWeight: 500, color: "#30D158", marginTop: 3 }}>+ ₨ 120 today</div>
            </div>
            <div style={{ display: "grid", gridTemplateRows: "1fr 1fr", gap: 8 }}>
              <div style={{ background: "#2C2C2E", borderRadius: 12, padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: "#636366" }}>Trips</span>
                <span style={{ fontSize: 16, fontWeight: 700, color: "#FFFFFF" }}>248</span>
              </div>
              <div style={{ background: "#2C2C2E", borderRadius: 12, padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: "#636366" }}>Rating</span>
                <span style={{ fontSize: 16, fontWeight: 700, color: "#FF9F0A" }}>4.9</span>
              </div>
            </div>
          </div>

          {flash && (
            <div style={{ marginTop: 10, background: "rgba(48,209,88,0.1)", borderRadius: 14, padding: "12px 16px", border: "1px solid rgba(48,209,88,0.2)", display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 8, height: 8, borderRadius: 4, background: "#30D158", animation: "pulse 1.5s infinite", flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#30D158" }}>New request nearby</div>
                <div style={{ fontSize: 11, fontWeight: 500, color: "#636366", marginTop: 1 }}>0.8 km · ₨ 250 estimated</div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 32 }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#3A3A3C", textTransform: "uppercase", letterSpacing: 1 }}>V2 — Apple Dark</div>
          <div style={{ fontSize: 11, color: "#2C2C2E", marginTop: 4 }}>iOS Dark Mode · pure black · system green</div>
          <button onClick={() => setFlash(!flash)} style={{ marginTop: 12, padding: "8px 16px", borderRadius: 20, background: "#2C2C2E", border: "1px solid #3A3A3C", color: "#636366", fontSize: 11, cursor: "pointer" }}>
            Toggle request
          </button>
        </div>
      </div>
    </div>
  );
}
