import { useEffect } from "react";
import { tDual } from "@workspace/i18n";
import { useLanguage } from "../lib/useLanguage";

export interface SplashScreenProps {
  onDone: () => void;
}

const GOLD = "var(--color-brand)";
const BG = "var(--color-surface)";

export default function SplashScreen({ onDone }: SplashScreenProps) {
  const { language } = useLanguage();
  const T = (key: Parameters<typeof tDual>[0]) => tDual(key, language);

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
        @keyframes ajkSpin {
          to { transform: rotate(360deg); }
        }
        @keyframes ajkFadeIn {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div
        style={{
          animation: "ajkFadeIn 0.5s ease both",
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
            background: `linear-gradient(135deg, ${GOLD} 0%, #D4A009 100%)`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: `0 0 48px rgba(240,185,11,0.4), 0 16px 40px rgba(0,0,0,0.6)`,
          }}
        >
          <svg width="54" height="54" viewBox="0 0 54 54" fill="none">
            <path d="M11 18h32l-4 22H15L11 18z" fill="var(--color-surface)" fillOpacity="0.9" />
            <path
              d="M20 18c0-3.87 3.13-7 7-7s7 3.13 7 7"
              stroke="var(--color-surface)"
              strokeWidth="3"
              strokeLinecap="round"
              fill="none"
            />
            <text
              x="27"
              y="34"
              textAnchor="middle"
              fontSize="11"
              fontWeight="800"
              fill="var(--color-surface)"
              fontFamily="Inter,sans-serif"
            >
              AJK
            </text>
          </svg>
        </div>

        <div style={{ textAlign: "center" }}>
          <p
            style={{
              color: "#FFFFFF",
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
              color: GOLD,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "3px",
              margin: "4px 0 0",
              textTransform: "uppercase",
            }}
          >
            {T("splashRiderPartner")}
          </p>
        </div>

        <div
          style={{
            width: 36,
            height: 36,
            border: `3px solid rgba(240,185,11,0.25)`,
            borderTopColor: GOLD,
            borderRadius: "50%",
            animation: "ajkSpin 0.9s linear infinite",
          }}
        />
      </div>
    </div>
  );
}
