import { useEffect } from "react";

export interface SplashScreenProps {
  onDone: () => void;
}

const BLUE = "#1A56DB";
const BG = "#F8FAFF";

export default function SplashScreen({ onDone }: SplashScreenProps) {
  useEffect(() => {
    const id = setTimeout(onDone, 1500);
    return () => clearTimeout(id);
  }, [onDone]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: BG,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 99999,
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      <style>{`
        @keyframes ajkVendorSpin {
          to { transform: rotate(360deg); }
        }
        @keyframes ajkVendorFadeIn {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div
        style={{
          animation: "ajkVendorFadeIn 0.5s ease both",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 28,
        }}
      >
        <div
          style={{
            width: 100,
            height: 100,
            borderRadius: 28,
            background: `linear-gradient(135deg, ${BLUE} 0%, #1348B5 100%)`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: `0 0 48px rgba(26,86,219,0.35), 0 16px 40px rgba(0,0,0,0.18)`,
          }}
        >
          <svg width="54" height="54" viewBox="0 0 54 54" fill="none">
            <path
              d="M6 22l21-16 21 16v26a4 4 0 0 1-4 4H10a4 4 0 0 1-4-4z"
              fill="rgba(255,255,255,0.15)"
              stroke="white"
              strokeWidth="2.5"
              strokeLinejoin="round"
            />
            <path
              d="M20 46V30h14v16"
              fill="rgba(255,255,255,0.2)"
              stroke="white"
              strokeWidth="2.5"
              strokeLinejoin="round"
            />
            <text
              x="27"
              y="24"
              textAnchor="middle"
              fontSize="9"
              fontWeight="800"
              fill="white"
              fontFamily="Inter,sans-serif"
            >
              AJK
            </text>
          </svg>
        </div>

        <div style={{ textAlign: "center" }}>
          <p
            style={{
              color: "#111827",
              fontSize: 28,
              fontWeight: 900,
              margin: 0,
              letterSpacing: "-0.03em",
            }}
          >
            AJKMart
          </p>
          <p
            style={{
              color: BLUE,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "3px",
              margin: "4px 0 0",
              textTransform: "uppercase",
            }}
          >
            Vendor Portal
          </p>
        </div>

        <div
          style={{
            width: 36,
            height: 36,
            border: `3px solid rgba(26,86,219,0.2)`,
            borderTopColor: BLUE,
            borderRadius: "50%",
            animation: "ajkVendorSpin 0.9s linear infinite",
          }}
        />
      </div>
    </div>
  );
}
