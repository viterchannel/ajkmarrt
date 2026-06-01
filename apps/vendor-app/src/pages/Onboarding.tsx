import { useState } from "react";

export interface OnboardingProps {
  onDone: () => void;
}

const BLUE = "#1A56DB";
const BG = "#F8FAFF";
const CARD = "#FFFFFF";
const BORDER = "#E5E7EB";

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

const SLIDES: Slide[] = [
  {
    icon: "🏪",
    titleEn: "Open Your Shop",
    titleUr: "اپنی دکان کھولیں",
    titleRoman: "Apni Dukaan Kholyein",
    descEn: "List your products, set your prices, and start selling to thousands of customers across AJK in minutes.",
    descUr: "اپنی مصنوعات کی فہرست بنائیں، قیمتیں طے کریں اور منٹوں میں ہزاروں گاہکوں کو فروخت شروع کریں۔",
    descRoman: "Apni masnoaat ki fehrist banayen, qeemat tay karein aur minutes mein hazaron graahkon ko farokht shuru karein.",
    accentColor: BLUE,
  },
  {
    icon: "📦",
    titleEn: "Track Orders",
    titleUr: "آرڈرز ٹریک کریں",
    titleRoman: "Orders Track Karein",
    descEn: "Real-time order dashboard with push alerts. Accept, prepare, and hand off orders seamlessly — all from one screen.",
    descUr: "پش الرٹ کے ساتھ ریئل ٹائم آرڈر ڈیش بورڈ۔ قبول کریں، تیار کریں اور ایک اسکرین سے آرڈر دیں۔",
    descRoman: "Push alert ke sath real-time order dashboard. Qabool karein, tayyar karein aur ek screen se order dein.",
    accentColor: "#F97316",
  },
  {
    icon: "📈",
    titleEn: "Grow Fast",
    titleUr: "تیزی سے بڑھیں",
    titleRoman: "Tezi Se Barhaein",
    descEn: "Analytics, promotions, and instant wallet payouts. Everything you need to grow your business on AJKMart.",
    descUr: "تجزیات، پروموشنز اور فوری والیٹ ادائیگیاں۔ اے جے کے مارٹ پر کاروبار بڑھانے کے لیے سب کچھ۔",
    descRoman: "Analytics, promotions aur fori wallet adaigian. AJKMart par karobar barhane ke liye sab kuch.",
    accentColor: "#10B981",
  },
];

export default function Onboarding({ onDone }: OnboardingProps) {
  const [slide, setSlide] = useState(0);

  const current = SLIDES[slide];
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
        @keyframes ajkVendorSlideIn {
          from { opacity: 0; transform: translateX(24px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>

      <div style={{ width: "100%", display: "flex", justifyContent: "flex-end" }}>
        <button
          onClick={handleSkip}
          style={{
            background: "none",
            border: `1px solid ${BORDER}`,
            color: "#9CA3AF",
            fontSize: 13,
            fontWeight: 600,
            padding: "6px 16px",
            borderRadius: 99,
            cursor: "pointer",
          }}
        >
          Skip
        </button>
      </div>

      <div
        key={slide}
        style={{
          animation: "ajkVendorSlideIn 0.35s ease both",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
          gap: 24,
          maxWidth: 360,
        }}
      >
        <div
          style={{
            width: 120,
            height: 120,
            borderRadius: 36,
            background: CARD,
            border: `1.5px solid ${current.accentColor}33`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 56,
            boxShadow: `0 8px 32px ${current.accentColor}18, 0 2px 8px rgba(0,0,0,0.08)`,
          }}
        >
          {current.icon}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <h2
            style={{
              color: "#111827",
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
              direction: "rtl",
            }}
          >
            {current.titleUr}
          </p>
          <p style={{ color: "#9CA3AF", fontSize: 12, fontWeight: 500, margin: 0 }}>
            {current.titleRoman}
          </p>
        </div>

        <p style={{ color: "#6B7280", fontSize: 14, lineHeight: 1.7, margin: 0 }}>
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
                background: i === slide ? BLUE : BORDER,
                transition: "width 0.3s ease, background 0.3s ease",
              }}
            />
          ))}
        </div>

        <button
          onClick={handleNext}
          style={{
            width: "100%",
            height: 52,
            borderRadius: 14,
            border: "none",
            background: `linear-gradient(135deg, ${BLUE}, #1348B5)`,
            color: "#FFFFFF",
            fontSize: 15,
            fontWeight: 800,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            boxShadow: "0 4px 20px rgba(26,86,219,0.35)",
          }}
        >
          {isLast ? "Get Started" : "Next"}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
}
