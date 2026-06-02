import { tDual, type TranslationKey } from "@workspace/i18n";
import { Navigation, Rocket, Sparkles, Wallet } from "lucide-react";
import { useState } from "react";
import { useLanguage } from "../lib/useLanguage";

export interface OnboardingProps {
  onDone: () => void;
}

const GOLD = "var(--color-brand)";
const BG = "var(--color-surface)";
const CARD = "var(--color-card-dark)";
const BORDER = "var(--color-border)";

interface Slide {
  icon: string;
  titleEn: string;
  titleUr: string;
  titleRoman: string;
  descEn: string;
  descUr: string;
  descRoman: string;
  accentColor: string;
}

function SlideIcon({ name }: { name: string }) {
  const size = 48;
  if (name === "Earn More") return <Wallet size={size} className="text-warning" />;
  if (name === "Navigate Live") return <Navigation size={size} className="text-success" />;
  if (name === "Get Paid Fast") return <Rocket size={size} className="text-purple-400" />;
  return <Sparkles size={size} className="text-muted-foreground" />;
}

const SLIDES: Slide[] = [
  {
    icon: "Earn More",
    titleEn: "Earn More",
    titleUr: "زیادہ کمائیں",
    titleRoman: "Zyada Kamayein",
    descEn: "Accept rides and deliveries across AJK. Instant payouts hit your wallet the moment each job is done.",
    descUr: "اے جے کے میں سواری اور ڈیلیوری قبول کریں۔ ہر کام مکمل ہوتے ہی فوری ادائیگی والیٹ میں آ جاتی ہے۔",
    descRoman: "AJK mein sawari aur delivery qabool karein. Har kaam mukammal hotay hi fori adaigi wallet mein aa jati hai.",
    accentColor: GOLD,
  },
  {
    icon: "Navigate Live",
    titleEn: "Navigate Live",
    titleUr: "لائیو نیویگیشن",
    titleRoman: "Live Navigate Karein",
    descEn: "Built-in GPS routing keeps you on the fastest path in real time — even on slow data connections.",
    descUr: "بلٹ ان جی پی ایس آپ کو سب سے تیز راستے پر رکھتا ہے، یہاں تک کہ سست ڈیٹا پر بھی۔",
    descRoman: "Built-in GPS aapko teez tareen raste par rakhta hai, yahan tak ke slow data par bhi.",
    accentColor: "#00C48C",
  },
  {
    icon: "Get Paid Fast",
    titleEn: "Get Paid Fast",
    titleUr: "تیز ادائیگی پائیں",
    titleRoman: "Tezi Se Paid Hon",
    descEn: "Hit milestones, unlock bonuses and fuel allowances. Your earnings are always yours — withdraw anytime.",
    descUr: "اہداف حاصل کریں، بونس اور فیول الاؤنس پائیں۔ آپ کی کمائی ہمیشہ آپ کی ہے — جب چاہیں نکالیں۔",
    descRoman: "Targets hasil karein, bonus aur fuel allowance payein. Aapki kamai hamesha aapki hai — jab chahen nikaalein.",
    accentColor: "#AF52DE",
  },
];

export default function Onboarding({ onDone }: OnboardingProps) {
  const [slide, setSlide] = useState(0);
  const { language } = useLanguage();
  const T = (key: TranslationKey) => tDual(key, language);

  const current = SLIDES[slide]!;
  const isLast = slide === SLIDES.length - 1;

  function handleNext() {
    if (isLast) {
      onDone();
    } else {
      setSlide((s) => s + 1);
    }
  }

  function handleSkip() {
    onDone();
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: BG,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "space-between",
        zIndex: 99998,
        fontFamily: "Inter, system-ui, sans-serif",
        padding: "48px 24px 40px",
      }}
    >
      <style>{`
        @keyframes ajkSlideIn {
          from { opacity: 0; transform: translateX(24px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>

      <div style={{ width: "100%", display: "flex", justifyContent: "flex-end" }}>
        <button
          onClick={handleSkip}
          aria-label={T("skip")}
          style={{
            background: "none",
            border: `1px solid ${BORDER}`,
            color: "var(--color-muted-foreground)",
            fontSize: 13,
            fontWeight: 600,
            padding: "6px 16px",
            borderRadius: 99,
            cursor: "pointer",
          }}
        >
          {T("skip")}
        </button>
      </div>

      <div
        key={slide}
        style={{
          animation: "ajkSlideIn 0.35s ease both",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
          gap: 24,
          maxWidth: 360,
        }}
      >
        <img
          src={`${import.meta.env.BASE_URL}ajkmart-logo.png`}
          alt="AJKMart"
          style={{ height: 36, objectFit: "contain", marginBottom: -8 }}
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
        />

        <div
          style={{
            width: 120,
            height: 120,
            borderRadius: 36,
            background: CARD,
            border: `1.5px solid var(--color-border)`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 56,
            boxShadow: `0 0 40px ${current.accentColor}22`,
          }}
        >
          <SlideIcon name={current.icon} />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <h2
            style={{
              color: "var(--color-foreground)",
              fontSize: 28,
              fontWeight: 900,
              margin: 0,
              letterSpacing: "-0.02em",
            }}
          >
            {current.titleEn}
          </h2>
          <p
            style={{
              color: current.accentColor,
              fontSize: 14,
              fontWeight: 700,
              margin: 0,
              fontFamily: "Noto Nastaliq Urdu, serif",
            }}
          >
            {current.titleUr}
          </p>
          <p style={{ color: "var(--color-muted-foreground)", fontSize: 12, fontWeight: 500, margin: 0 }}>
            {current.titleRoman}
          </p>
        </div>

        <p style={{ color: "var(--color-muted-foreground)", fontSize: 14, lineHeight: 1.7, margin: 0 }}>
          {current.descEn}
        </p>
      </div>

      <div style={{ width: "100%", maxWidth: 360, display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ display: "flex", justifyContent: "center", gap: 8 }}>
          {SLIDES.map((_, i) => (
            <div
              key={i}
              style={{
                width: i === slide ? 24 : 8,
                height: 8,
                borderRadius: 4,
                background: i === slide ? GOLD : "var(--color-muted)",
                transition: "width 0.3s ease, background 0.3s ease",
              }}
            />
          ))}
        </div>

        <button
          onClick={handleNext}
          aria-label={isLast ? T("getStarted") : T("next")}
          style={{
            width: "100%",
            height: 52,
            borderRadius: 14,
            border: "none",
            background: `linear-gradient(135deg, var(--color-brand), var(--color-brand-hover))`,
            color: "var(--color-foreground)",
            fontSize: 15,
            fontWeight: 800,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            boxShadow: "0 4px 20px rgba(240,185,11,0.35)",
          }}
        >
          {isLast ? T("getStarted") : T("next")}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
}
