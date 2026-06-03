import { useState } from "react";

function BellIcon({ unread }: { unread: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      {unread && <circle cx="18" cy="6" r="4" fill="#FF3B30" stroke="white" strokeWidth="1.5" />}
    </svg>
  );
}

export function V1AppleLight() {
  const [online, setOnline] = useState(true);
  const [flash, setFlash] = useState(false);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#F2F2F7", fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', sans-serif" }}>
      {/* Header card */}
      <div style={{ background: "#FFFFFF", paddingTop: 56, borderRadius: "0 0 28px 28px", boxShadow: "0 1px 0 rgba(0,0,0,0.08), 0 4px 24px rgba(0,0,0,0.04)" }}>
        <div style={{ padding: "0 20px 24px" }}>

          {/* Top nav */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: "linear-gradient(145deg, #000 0%, #1c1c1e 100%)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontSize: 14, fontWeight: 800, color: "#fff", letterSpacing: -0.5 }}>A</span>
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#1C1C1E", letterSpacing: -0.2 }}>AJKMart</div>
                <div style={{ fontSize: 10, fontWeight: 500, color: "#8E8E93", letterSpacing: 0.2 }}>Rider</div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button onClick={() => setFlash(!flash)} style={{ width: 36, height: 36, borderRadius: 18, background: "#F2F2F7", border: "none", display: "flex", alignItems: "center", justifyContent: "center", color: flash ? "#FF9500" : "#8E8E93", cursor: "pointer" }}>
                <BellIcon unread={flash} />
              </button>
              <div style={{ width: 36, height: 36, borderRadius: 18, background: "linear-gradient(145deg, #636366, #48484A)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#fff" }}>AR</span>
              </div>
            </div>
          </div>

          {/* Greeting */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: "#8E8E93", marginBottom: 2 }}>Good morning</div>
            <div style={{ fontSize: 30, fontWeight: 700, color: "#1C1C1E", letterSpacing: -0.8, lineHeight: 1.1 }}>Ali Raza</div>
            <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 6, height: 6, borderRadius: 3, background: online ? "#34C759" : "#8E8E93", boxShadow: online ? "0 0 0 3px rgba(52,199,89,0.2)" : "none" }} />
              <span style={{ fontSize: 12, fontWeight: 500, color: online ? "#34C759" : "#8E8E93" }}>
                {online ? "Active — accepting rides" : "Offline"}
              </span>
            </div>
          </div>

          {/* Cards row */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 4 }}>
            {/* Wallet */}
            <div style={{ background: "#F2F2F7", borderRadius: 18, padding: "14px 16px" }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#8E8E93", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 6 }}>Wallet</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: "#1C1C1E", letterSpacing: -0.5 }}>₨ 2,450</div>
              <div style={{ fontSize: 11, fontWeight: 500, color: "#34C759", marginTop: 2 }}>↑ Rs. 120 today</div>
            </div>

            {/* Online toggle */}
            <button
              onClick={() => setOnline(!online)}
              style={{ background: online ? "rgba(52,199,89,0.12)" : "#F2F2F7", borderRadius: 18, padding: "14px 16px", border: "none", textAlign: "left", cursor: "pointer" }}
            >
              <div style={{ fontSize: 11, fontWeight: 600, color: "#8E8E93", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 6 }}>Status</div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: online ? "#34C759" : "#1C1C1E" }}>
                  {online ? "Online" : "Offline"}
                </div>
                {/* iOS toggle */}
                <div style={{ width: 44, height: 26, borderRadius: 13, background: online ? "#34C759" : "#E5E5EA", position: "relative", transition: "background 0.2s" }}>
                  <div style={{ width: 22, height: 22, borderRadius: 11, background: "#fff", position: "absolute", top: 2, left: online ? 20 : 2, boxShadow: "0 2px 6px rgba(0,0,0,0.15)", transition: "left 0.2s" }} />
                </div>
              </div>
            </button>
          </div>

          {/* Earnings strip */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 1, marginTop: 10, borderRadius: 14, overflow: "hidden", background: "#E5E5EA" }}>
            {[
              { label: "Today", value: "₨ 1,200", color: "#1C1C1E" },
              { label: "Trips", value: "6", color: "#1C1C1E" },
              { label: "Rating", value: "4.9 ★", color: "#FF9500" },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ background: "#FFFFFF", padding: "10px 12px" }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: "#8E8E93", textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>
                <div style={{ fontSize: 15, fontWeight: 700, color, marginTop: 2 }}>{value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 32 }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#8E8E93", textTransform: "uppercase", letterSpacing: 1 }}>V1 — Apple Light</div>
          <div style={{ fontSize: 11, color: "#C7C7CC", marginTop: 4 }}>iOS Human Interface · pure white · SF typography</div>
        </div>
      </div>
    </div>
  );
}
