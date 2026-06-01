import { useEffect, useRef, useState } from "react";
import { useAuthTheme, type AuthTheme } from "../context/ThemeContext";

/* ═══════════════════════════════════════════════════════════════════════════
   GUEST LANDING — World-Class B2B Branded Ecosystem Component
   Used by: Vendor App, Rider App, and future AJKMart partner portals.
   ═══════════════════════════════════════════════════════════════════════════ */

export interface GuestLandingStat {
  v: string;
  l: LocalisedString;
  icon?: "store" | "city" | "order" | "star" | "wallet" | "rider" | "bike" | "clock" | "gift";
}

export interface GuestLandingFeature {
  icon: string;
  title: LocalisedString;
  desc: LocalisedString;
  color?: string;
}

export interface GuestLandingStep {
  icon: string;
  title: LocalisedString;
  desc: LocalisedString;
}

export interface GuestLandingTestimonial {
  quote: LocalisedString;
  author: string;
  role: string;
  city?: string;
}

export interface GuestLandingFaqItem {
  q: LocalisedString;
  a: LocalisedString;
}

export interface GuestLandingTrustBadge {
  icon: string;
  title: LocalisedString;
  desc: LocalisedString;
}

type Lang = "en" | "ur" | "roman";

type LocalisedString = string | { en: string; ur: string; roman: string };

function resolve(s: LocalisedString, lang: Lang): string {
  if (typeof s === "string") return s;
  return s[lang];
}

const LANG_LABELS: Record<Lang, string> = { en: "EN", ur: "اردو", roman: "RM" };
const LANG_CYCLE: Lang[] = ["en", "ur", "roman"];

/* ── Inline SVG Icon System (zero dependencies) ─────────────────────────── */

const ICONS: Record<string, React.ReactNode> = {
  store: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  ),
  city: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
    </svg>
  ),
  order: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" />
    </svg>
  ),
  star: (
    <svg viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  ),
  wallet: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 12V8H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-2" /><path d="M16 12h6v4h-6a2 2 0 0 1-2-2v0a2 2 0 0 1 2-2z" /><circle cx="19" cy="14" r="1" />
    </svg>
  ),
  rider: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="5.5" cy="17.5" r="2.5" /><circle cx="18.5" cy="17.5" r="2.5" /><path d="M8 17.5h7M3 9l1.5-5h7L14 9M14 9h4l2 5M8 9H3" />
    </svg>
  ),
  bike: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="5.5" cy="17.5" r="3.5" /><circle cx="18.5" cy="17.5" r="3.5" /><path d="M15 6a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm-3 11.5V14l-3-3 4-3 2 3h2" />
    </svg>
  ),
  clock: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
    </svg>
  ),
  gift: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 12 20 22 4 22 4 12" /><rect x="2" y="7" width="20" height="5" /><line x1="12" y1="22" x2="12" y2="7" /><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" /><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
    </svg>
  ),
  shield: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  ),
  lock: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  ),
  check: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  phone: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  ),
  mail: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" />
    </svg>
  ),
  globe: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  ),
  chevronDown: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  ),
  quote: (
    <svg viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" />
    </svg>
  ),
  arrowRight: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
    </svg>
  ),
  trendUp: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" />
    </svg>
  ),
  mapPin: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
    </svg>
  ),
  fileCheck: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><polyline points="9 15 12 17 16 10" />
    </svg>
  ),
  zap: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  ),
  users: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  navigation: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="3 11 22 2 13 21 11 13 3 11" />
    </svg>
  ),
};

function Icon({ name, size = 20, color = "currentColor" }: { name: string; size?: number; color?: string }) {
  const el = ICONS[name];
  if (!el) return <span style={{ fontSize: size }}>{name}</span>;
  return (
    <span style={{ display: "inline-flex", width: size, height: size, color }}>
      {el}
    </span>
  );
}

/* ── Animated stat counter ─────────────────────────────────────────────── */

function parseLeadingNumber(v: string): { prefix: string; num: number; suffix: string } | null {
  const m = v.match(/^([₨$€£¥]?)([\d,.]+)(.*)$/);
  if (!m) return null;
  const raw = (m[2] ?? "").replace(/,/g, "");
  const num = parseFloat(raw);
  if (Number.isNaN(num)) return null;
  return { prefix: m[1] ?? "", num, suffix: m[3] ?? "" };
}

function formatNum(n: number, original: string): string {
  if (original.includes(",")) return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (original.includes(".")) {
    const decimals = (original.split(".")[1] ?? "").length;
    return n.toFixed(decimals);
  }
  return String(Math.round(n));
}

function AnimatedStat({ v, primaryColor }: { v: string; primaryColor: string }) {
  const parsed = parseLeadingNumber(v);
  const [display, setDisplay] = useState(parsed ? "0" : v);
  const rafRef = useRef<number | null>(null);
  const startedRef = useRef(false);
  const nodeRef = useRef<HTMLSpanElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!nodeRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0]?.isIntersecting) setVisible(true); },
      { threshold: 0.3 }
    );
    observer.observe(nodeRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!parsed || startedRef.current || !visible) return;
    startedRef.current = true;
    const duration = 1800;
    const start = performance.now();
    const target = parsed.num;
    function tick(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 4);
      const current = eased * target;
      setDisplay(formatNum(current, v));
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current !== null) cancelAnimationFrame(rafRef.current); };
  }, [visible, v]);

  if (!parsed) return <span ref={nodeRef} style={{ color: primaryColor, fontWeight: 900 }}>{v}</span>;
  return (
    <span ref={nodeRef} style={{ color: primaryColor, fontWeight: 900 }}>
      {parsed.prefix}{display}{parsed.suffix}
    </span>
  );
}

/* ── Scroll-triggered fade-in wrapper ────────────────────────────────────── */

function FadeIn({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (!ref.current) return;
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0]?.isIntersecting) setShown(true); },
      { threshold: 0.15 }
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: shown ? 1 : 0,
        transform: shown ? "translateY(0)" : "translateY(24px)",
        transition: `opacity 0.7s cubic-bezier(0.22, 1, 0.36, 1) ${delay}ms, transform 0.7s cubic-bezier(0.22, 1, 0.36, 1) ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

/* ── FAQ Accordion Item ──────────────────────────────────────────────────── */

function FaqItem({ q, a, theme, lang, index }: { q: LocalisedString; a: LocalisedString; theme: AuthTheme; lang: Lang; index: number }) {
  const [open, setOpen] = useState(false);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const [height, setHeight] = useState(0);

  useEffect(() => {
    if (bodyRef.current) {
      setHeight(open ? bodyRef.current.scrollHeight : 0);
    }
  }, [open]);

  return (
    <div
      style={{
        background: theme.surface,
        border: `1px solid ${theme.border}`,
        borderRadius: 14,
        overflow: "hidden",
        marginBottom: 10,
      }}
    >
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          padding: "16px 20px",
          background: "transparent",
          border: "none",
          color: theme.text,
          fontSize: 15,
          fontWeight: 600,
          cursor: "pointer",
          textAlign: "left",
          fontFamily: lang === "ur" ? '"Noto Nastaliq Urdu", serif' : "Inter, system-ui, sans-serif",
        }}
      >
        <span style={{ flex: 1 }}>{resolve(q, lang)}</span>
        <span
          style={{
            display: "inline-flex",
            width: 24,
            height: 24,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 6,
            background: open ? `${theme.primary}18` : "transparent",
            color: theme.primary,
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.3s ease",
            flexShrink: 0,
          }}
        >
          <Icon name="chevronDown" size={16} />
        </span>
      </button>
      <div
        style={{
          height,
          overflow: "hidden",
          transition: "height 0.35s cubic-bezier(0.22, 1, 0.36, 1)",
        }}
      >
        <div ref={bodyRef} style={{ padding: "0 20px 16px", color: theme.textMuted, fontSize: 14, lineHeight: 1.7 }}>
          {resolve(a, lang)}
        </div>
      </div>
    </div>
  );
}

/* ── Particle background canvas (subtle, lightweight) ─────────────────────── */

function ParticleCanvas({ color }: { color: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let w = 0, h = 0;
    let particles: Array<{ x: number; y: number; r: number; dx: number; dy: number; o: number }> = [];
    let raf = 0;

    function resize() {
      w = canvas!.width = canvas!.offsetWidth;
      h = canvas!.height = canvas!.offsetHeight;
      particles = [];
      const count = Math.min(Math.floor((w * h) / 25000), 60);
      for (let i = 0; i < count; i++) {
        particles.push({
          x: Math.random() * w,
          y: Math.random() * h,
          r: Math.random() * 2 + 0.5,
          dx: (Math.random() - 0.5) * 0.3,
          dy: (Math.random() - 0.5) * 0.3,
          o: Math.random() * 0.4 + 0.1,
        });
      }
    }

    function draw() {
      ctx!.clearRect(0, 0, w, h);
      for (const p of particles) {
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx!.fillStyle = color.replace(")", `, ${p.o})`).replace("rgb", "rgba");
        ctx!.fill();
        p.x += p.dx;
        p.y += p.dy;
        if (p.x < 0) p.x = w;
        if (p.x > w) p.x = 0;
        if (p.y < 0) p.y = h;
        if (p.y > h) p.y = 0;
      }
      raf = requestAnimationFrame(draw);
    }

    resize();
    draw();
    window.addEventListener("resize", resize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [color]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        opacity: 0.6,
      }}
    />
  );
}

/* ── Main Props Interface ───────────────────────────────────────────────── */

export interface GuestLandingProps {
  role: "rider" | "vendor";
  logoSrc?: string;
  logoAlt?: string;
  appName?: string;
  heroTitle: LocalisedString;
  heroSubtitle?: LocalisedString;
  stats: GuestLandingStat[];
  features: GuestLandingFeature[];
  steps?: GuestLandingStep[];
  testimonials?: GuestLandingTestimonial[];
  faqs?: GuestLandingFaqItem[];
  trustBadges?: GuestLandingTrustBadge[];
  ctaLoginLabel: LocalisedString;
  ctaRegisterLabel: LocalisedString;
  onLogin: () => void;
  onRegister: () => void;
  defaultLanguage?: Lang;
  language?: Lang;
  onLanguageChange?: (lang: Lang) => void;
  supportPhone?: string;
  supportEmail?: string;
  footerLinks?: Array<{ label: LocalisedString; href: string }>;
}

/* ── Main Component ──────────────────────────────────────────────────────── */

export function GuestLanding({
  logoSrc,
  logoAlt,
  appName,
  heroTitle,
  heroSubtitle,
  stats,
  features,
  steps,
  testimonials,
  faqs,
  trustBadges,
  ctaLoginLabel,
  ctaRegisterLabel,
  onLogin,
  onRegister,
  defaultLanguage = "en",
  language: controlledLang,
  onLanguageChange,
  supportPhone,
  supportEmail,
  footerLinks,
}: GuestLandingProps) {
  const theme = useAuthTheme();
  const [internalLang, setInternalLang] = useState<Lang>(controlledLang ?? defaultLanguage);
  const lang = controlledLang ?? internalLang;

  function setLang(l: Lang) {
    if (controlledLang !== undefined) {
      onLanguageChange?.(l);
    } else {
      setInternalLang(l);
      onLanguageChange?.(l);
    }
  }
  const [scrolled, setScrolled] = useState(false);

  const isUrdu = lang === "ur";
  const dir = isUrdu ? "rtl" : "ltr";
  const urduFont = '"Noto Nastaliq Urdu", serif';
  const bodyFont = isUrdu ? urduFont : "Inter, system-ui, sans-serif";

  const heroTitleText = resolve(heroTitle, lang);
  const heroSubText = heroSubtitle ? resolve(heroSubtitle, lang) : undefined;
  const loginLabel = resolve(ctaLoginLabel, lang);
  const registerLabel = resolve(ctaRegisterLabel, lang);

  /* Scroll listener for navbar background */
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const primaryRgb = theme.primary.startsWith("#")
    ? `rgb(${parseInt(theme.primary.slice(1, 3), 16)}, ${parseInt(theme.primary.slice(3, 5), 16)}, ${parseInt(theme.primary.slice(5, 7), 16)})`
    : theme.primary;

  /* ── Inline styles helpers ───────────────────────────────────────────── */
  const btnPrimary: React.CSSProperties = {
    padding: "14px 32px",
    borderRadius: 14,
    border: "none",
    background: `linear-gradient(135deg, ${theme.primary}, ${theme.primaryDark})`,
    color: theme.onPrimary,
    fontSize: 15,
    fontWeight: 800,
    cursor: "pointer",
    boxShadow: `0 8px 28px ${theme.primary}50`,
    fontFamily: "inherit",
    transition: "transform 0.15s ease, box-shadow 0.15s ease",
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
  };

  const btnSecondary: React.CSSProperties = {
    padding: "14px 32px",
    borderRadius: 14,
    border: `2px solid ${theme.border}`,
    background: "transparent",
    color: theme.text,
    fontSize: 15,
    fontWeight: 700,
    cursor: "pointer",
    fontFamily: "inherit",
    transition: "border-color 0.15s ease, background 0.15s ease",
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
  };

  const sectionMaxWidth = { maxWidth: 1100, margin: "0 auto", padding: "0 24px" };

  return (
    <div
      dir={dir}
      style={{
        minHeight: "100vh",
        background: theme.background,
        color: theme.text,
        fontFamily: bodyFont,
        overflowX: "hidden",
        lineHeight: 1.6,
      }}
    >
      {/* ═══════════════════════════════════════════════════════════════════════
          STICKY NAVBAR
         ═══════════════════════════════════════════════════════════════════════ */}
      <nav
        style={{
          position: "sticky",
          top: 0,
          zIndex: 100,
          background: scrolled ? `${theme.surface}f0` : "transparent",
          backdropFilter: scrolled ? "blur(16px)" : "none",
          borderBottom: scrolled ? `1px solid ${theme.border}` : "1px solid transparent",
          padding: "0 24px",
          height: 64,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          transition: "background 0.3s ease, border-color 0.3s ease",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {logoSrc && (
            <img src={logoSrc} alt={logoAlt ?? appName ?? "Logo"} style={{ height: 36, objectFit: "contain" }} />
          )}
          {appName && !logoSrc && (
            <span style={{ fontWeight: 800, fontSize: 18, letterSpacing: "-0.02em", color: theme.text }}>
              {appName}
            </span>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* Language switcher */}
          <div style={{ display: "flex", gap: 6, marginRight: 8 }}>
            {LANG_CYCLE.map((l) => (
              <button
                key={l}
                onClick={() => setLang(l)}
                style={{
                  padding: "5px 12px",
                  borderRadius: 20,
                  border: `1.5px solid ${l === lang ? theme.primary : theme.border}`,
                  background: l === lang ? `${theme.primary}18` : "transparent",
                  color: l === lang ? theme.primary : theme.textMuted,
                  fontSize: 12,
                  fontWeight: l === lang ? 700 : 500,
                  cursor: "pointer",
                  fontFamily: l === "ur" ? urduFont : "inherit",
                  transition: "all 0.2s ease",
                }}
              >
                {LANG_LABELS[l]}
              </button>
            ))}
          </div>
          <button
            onClick={onLogin}
            style={{
              padding: "8px 18px",
              borderRadius: 10,
              border: `1.5px solid ${theme.border}`,
              background: "transparent",
              color: theme.text,
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "inherit",
              transition: "border-color 0.15s ease",
            }}
          >
            {loginLabel}
          </button>
          <button
            onClick={onRegister}
            style={{
              padding: "8px 18px",
              borderRadius: 10,
              border: "none",
              background: `linear-gradient(135deg, ${theme.primary}, ${theme.primaryDark})`,
              color: theme.onPrimary,
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "inherit",
              boxShadow: `0 4px 14px ${theme.primary}40`,
            }}
          >
            {registerLabel}
          </button>
        </div>
      </nav>

      {/* ═══════════════════════════════════════════════════════════════════════
          HERO SECTION
         ═══════════════════════════════════════════════════════════════════════ */}
      <section
        style={{
          position: "relative",
          overflow: "hidden",
          background: `radial-gradient(ellipse at 50% 0%, ${theme.primary}15 0%, transparent 60%), linear-gradient(180deg, ${theme.background} 0%, ${theme.surface} 100%)`,
          borderBottom: `1px solid ${theme.border}`,
        }}
      >
        <ParticleCanvas color={primaryRgb} />

        <div style={{ ...sectionMaxWidth, padding: "80px 24px 100px", textAlign: "center", position: "relative", zIndex: 2 }}>
          <FadeIn>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 16px",
                borderRadius: 99,
                background: `${theme.primary}12`,
                border: `1px solid ${theme.primary}30`,
                color: theme.primary,
                fontSize: 13,
                fontWeight: 600,
                marginBottom: 28,
              }}
            >
              <Icon name="zap" size={14} />
              {resolve(
                typeof heroSubtitle === "object"
                  ? { en: "Now onboarding across AJK", ur: "اب اے جے کے بھر میں", roman: "Ab AJK bhar mein" }
                  : "Now onboarding across AJK",
                lang
              )}
            </div>
          </FadeIn>

          <FadeIn delay={100}>
            <h1
              style={{
                fontSize: "clamp(36px, 6vw, 64px)",
                fontWeight: 900,
                lineHeight: 1.1,
                margin: "0 auto 24px",
                maxWidth: 800,
                color: theme.text,
                letterSpacing: "-0.03em",
                fontFamily: bodyFont,
              }}
            >
              {heroTitleText}
            </h1>
          </FadeIn>

          {heroSubText && (
            <FadeIn delay={200}>
              <p
                style={{
                  fontSize: "clamp(16px, 2.2vw, 20px)",
                  color: theme.textMuted,
                  lineHeight: 1.7,
                  margin: "0 auto 40px",
                  maxWidth: 620,
                  fontFamily: bodyFont,
                }}
              >
                {heroSubText}
              </p>
            </FadeIn>
          )}

          <FadeIn delay={300}>
            <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
              <button
                onClick={onRegister}
                style={btnPrimary}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-2px)";
                  (e.currentTarget as HTMLButtonElement).style.boxShadow = `0 12px 36px ${theme.primary}60`;
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)";
                  (e.currentTarget as HTMLButtonElement).style.boxShadow = `0 8px 28px ${theme.primary}50`;
                }}
              >
                {registerLabel}
                <Icon name="arrowRight" size={18} />
              </button>
              <button
                onClick={onLogin}
                style={btnSecondary}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = theme.primary;
                  (e.currentTarget as HTMLButtonElement).style.background = `${theme.primary}08`;
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = theme.border;
                  (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                }}
              >
                {loginLabel}
              </button>
            </div>
          </FadeIn>
        </div>

        {/* Bottom wave divider */}
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 60, overflow: "hidden" }}>
          <svg viewBox="0 0 1440 60" preserveAspectRatio="none" style={{ width: "100%", height: "100%" }}>
            <path
              d="M0,60 L0,30 Q360,60 720,30 T1440,30 L1440,60 Z"
              fill={theme.surface}
            />
          </svg>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          STATS STRIP
         ═══════════════════════════════════════════════════════════════════════ */}
      {stats.length > 0 && (
        <section style={{ background: theme.surface, padding: "48px 0", borderBottom: `1px solid ${theme.border}` }}>
          <div style={{ ...sectionMaxWidth }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: 20,
              }}
            >
              {stats.map((s, i) => (
                <FadeIn key={i} delay={i * 120}>
                  <div
                    style={{
                      textAlign: "center",
                      padding: "28px 16px",
                      borderRadius: 16,
                      background: `${theme.background}80`,
                      border: `1px solid ${theme.border}`,
                      transition: "transform 0.2s ease, border-color 0.2s ease",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLDivElement).style.transform = "translateY(-4px)";
                      (e.currentTarget as HTMLDivElement).style.borderColor = `${theme.primary}50`;
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)";
                      (e.currentTarget as HTMLDivElement).style.borderColor = theme.border;
                    }}
                  >
                    <div style={{ marginBottom: 10, display: "flex", justifyContent: "center", color: theme.primary }}>
                      <Icon name={s.icon ?? "store"} size={26} />
                    </div>
                    <div style={{ fontSize: "clamp(26px, 3.5vw, 36px)", fontWeight: 900, lineHeight: 1.1, marginBottom: 6 }}>
                      <AnimatedStat v={s.v} primaryColor={theme.primary} />
                    </div>
                    <div style={{ fontSize: 13, color: theme.textMuted, fontWeight: 500 }}>
                      {resolve(s.l, lang)}
                    </div>
                  </div>
                </FadeIn>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          HOW IT WORKS (Steps)
         ═══════════════════════════════════════════════════════════════════════ */}
      {steps && steps.length > 0 && (
        <section style={{ padding: "80px 0", borderBottom: `1px solid ${theme.border}` }}>
          <div style={{ ...sectionMaxWidth }}>
            <FadeIn>
              <div style={{ textAlign: "center", marginBottom: 56 }}>
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "6px 16px",
                    borderRadius: 99,
                    background: `${theme.primary}10`,
                    border: `1px solid ${theme.primary}25`,
                    color: theme.primary,
                    fontSize: 12,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "1px",
                    marginBottom: 16,
                  }}
                >
                  <Icon name="mapPin" size={12} />
                  {resolve({ en: "Getting Started", ur: "شروعات", roman: "Shuruat" }, lang)}
                </div>
                <h2
                  style={{
                    fontSize: "clamp(26px, 4vw, 38px)",
                    fontWeight: 900,
                    color: theme.text,
                    margin: "0 0 12px",
                    letterSpacing: "-0.02em",
                  }}
                >
                  {resolve({ en: "How it works", ur: "یہ کیسے کام کرتا ہے", roman: "Yeh kaise kaam karta hai" }, lang)}
                </h2>
                <p style={{ fontSize: 16, color: theme.textMuted, maxWidth: 480, margin: "0 auto" }}>
                  {resolve(
                    {
                      en: "Join in minutes. Start earning or selling today.",
                      ur: "منٹوں میں شامل ہوں۔ آج ہی کمائی یا فروخت شروع کریں۔",
                      roman: "Minutes mein shamil hon. Aaj hi kamai ya farokht shuru karein.",
                    },
                    lang
                  )}
                </p>
              </div>
            </FadeIn>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 24,
                position: "relative",
              }}
            >
              {/* Connector line (desktop only) */}
              <div
                style={{
                  position: "absolute",
                  top: 40,
                  left: "12%",
                  right: "12%",
                  height: 2,
                  background: `linear-gradient(90deg, ${theme.primary}40, ${theme.primary}20, ${theme.primary}40)`,
                  zIndex: 0,
                  borderRadius: 1,
                }}
                className="step-connector"
              />
              {steps.map((step, i) => (
                <FadeIn key={i} delay={i * 150}>
                  <div style={{ textAlign: "center", position: "relative", zIndex: 1 }}>
                    <div
                      style={{
                        width: 56,
                        height: 56,
                        borderRadius: 18,
                        background: `linear-gradient(135deg, ${theme.primary}, ${theme.primaryDark})`,
                        color: theme.onPrimary,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        margin: "0 auto 20px",
                        fontSize: 22,
                        fontWeight: 900,
                        boxShadow: `0 8px 24px ${theme.primary}40`,
                      }}
                    >
                      {i + 1}
                    </div>
                    <h3
                      style={{
                        fontSize: 17,
                        fontWeight: 700,
                        color: theme.text,
                        margin: "0 0 8px",
                        fontFamily: bodyFont,
                      }}
                    >
                      {resolve(step.title, lang)}
                    </h3>
                    <p style={{ fontSize: 14, color: theme.textMuted, lineHeight: 1.65, margin: 0, maxWidth: 280, marginInline: "auto" }}>
                      {resolve(step.desc, lang)}
                    </p>
                  </div>
                </FadeIn>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          FEATURES SECTION
         ═══════════════════════════════════════════════════════════════════════ */}
      {features.length > 0 && (
        <section style={{ padding: "80px 0", borderBottom: `1px solid ${theme.border}` }}>
          <div style={{ ...sectionMaxWidth }}>
            <FadeIn>
              <div style={{ textAlign: "center", marginBottom: 56 }}>
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "6px 16px",
                    borderRadius: 99,
                    background: `${theme.primary}10`,
                    border: `1px solid ${theme.primary}25`,
                    color: theme.primary,
                    fontSize: 12,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "1px",
                    marginBottom: 16,
                  }}
                >
                  <Icon name="trendUp" size={12} />
                  {resolve({ en: "Features", ur: "خصوصیات", roman: "Khususiyat" }, lang)}
                </div>
                <h2
                  style={{
                    fontSize: "clamp(26px, 4vw, 38px)",
                    fontWeight: 900,
                    color: theme.text,
                    margin: "0 0 12px",
                    letterSpacing: "-0.02em",
                  }}
                >
                  {resolve(
                    {
                      en: "Everything you need to succeed",
                      ur: "کامیابی کے لیے ہر چیز",
                      roman: "Kamyabi ke liye har cheez",
                    },
                    lang
                  )}
                </h2>
                <p style={{ fontSize: 16, color: theme.textMuted, maxWidth: 480, margin: "0 auto" }}>
                  {resolve(
                    {
                      en: "Powerful tools designed for the AJK market.",
                      ur: "اے جے کے مارکیٹ کے لیے ڈیزائن کردہ طاقتور ٹولز۔",
                      roman: "AJK market ke liye design kiye gaye taqatwar tools.",
                    },
                    lang
                  )}
                </p>
              </div>
            </FadeIn>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
                gap: 20,
              }}
            >
              {features.map((f, i) => (
                <FadeIn key={i} delay={i * 100}>
                  <div
                    style={{
                      background: theme.surface,
                      border: `1px solid ${theme.border}`,
                      borderRadius: 18,
                      padding: "28px 24px",
                      transition: "transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLDivElement).style.transform = "translateY(-4px)";
                      (e.currentTarget as HTMLDivElement).style.borderColor = `${f.color ?? theme.primary}40`;
                      (e.currentTarget as HTMLDivElement).style.boxShadow = `0 12px 32px ${theme.background}80`;
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)";
                      (e.currentTarget as HTMLDivElement).style.borderColor = theme.border;
                      (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
                    }}
                  >
                    <div
                      style={{
                        width: 52,
                        height: 52,
                        borderRadius: 14,
                        background: f.color ? `${f.color}15` : `${theme.primary}15`,
                        border: `1px solid ${f.color ? `${f.color}30` : `${theme.primary}30`}`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 22,
                        marginBottom: 16,
                        color: f.color ?? theme.primary,
                      }}
                    >
                      <Icon name={f.icon} size={24} />
                    </div>
                    <h3
                      style={{
                        fontSize: 16,
                        fontWeight: 700,
                        color: theme.text,
                        margin: "0 0 8px",
                        fontFamily: bodyFont,
                      }}
                    >
                      {resolve(f.title, lang)}
                    </h3>
                    <p
                      style={{
                        fontSize: 14,
                        color: theme.textMuted,
                        lineHeight: 1.65,
                        margin: 0,
                        fontFamily: bodyFont,
                      }}
                    >
                      {resolve(f.desc, lang)}
                    </p>
                  </div>
                </FadeIn>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          TRUST BADGES
         ═══════════════════════════════════════════════════════════════════════ */}
      {trustBadges && trustBadges.length > 0 && (
        <section style={{ padding: "64px 0", borderBottom: `1px solid ${theme.border}` }}>
          <div style={{ ...sectionMaxWidth }}>
            <FadeIn>
              <div style={{ textAlign: "center", marginBottom: 48 }}>
                <h2
                  style={{
                    fontSize: "clamp(22px, 3vw, 30px)",
                    fontWeight: 800,
                    color: theme.text,
                    margin: "0 0 8px",
                  }}
                >
                  {resolve(
                    {
                      en: "Trusted & Secure",
                      ur: "قابل اعتماد اور محفوظ",
                      roman: "Qabil-e-etemad aur mehfooz",
                    },
                    lang
                  )}
                </h2>
                <p style={{ fontSize: 15, color: theme.textMuted }}>
                  {resolve(
                    {
                      en: "Your business and earnings are protected.",
                      ur: "آپ کا کاروبار اور آمدنی محفوظ ہے۔",
                      roman: "Aap ka karobar aur amdani mehfooz hai.",
                    },
                    lang
                  )}
                </p>
              </div>
            </FadeIn>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: 16,
              }}
            >
              {trustBadges.map((badge, i) => (
                <FadeIn key={i} delay={i * 100}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 14,
                      padding: "20px",
                      borderRadius: 14,
                      background: `${theme.surface}80`,
                      border: `1px solid ${theme.border}`,
                    }}
                  >
                    <div style={{ color: theme.primary, flexShrink: 0, marginTop: 2 }}>
                      <Icon name={badge.icon} size={22} />
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: theme.text, marginBottom: 4 }}>
                        {resolve(badge.title, lang)}
                      </div>
                      <div style={{ fontSize: 13, color: theme.textMuted, lineHeight: 1.55 }}>
                        {resolve(badge.desc, lang)}
                      </div>
                    </div>
                  </div>
                </FadeIn>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          TESTIMONIALS
         ═══════════════════════════════════════════════════════════════════════ */}
      {testimonials && testimonials.length > 0 && (
        <section style={{ padding: "80px 0", borderBottom: `1px solid ${theme.border}` }}>
          <div style={{ ...sectionMaxWidth }}>
            <FadeIn>
              <div style={{ textAlign: "center", marginBottom: 48 }}>
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "6px 16px",
                    borderRadius: 99,
                    background: `${theme.primary}10`,
                    border: `1px solid ${theme.primary}25`,
                    color: theme.primary,
                    fontSize: 12,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "1px",
                    marginBottom: 16,
                  }}
                >
                  <Icon name="users" size={12} />
                  {resolve({ en: "Community", ur: "برادری", roman: "Baradari" }, lang)}
                </div>
                <h2
                  style={{
                    fontSize: "clamp(26px, 4vw, 38px)",
                    fontWeight: 900,
                    color: theme.text,
                    margin: "0 0 12px",
                    letterSpacing: "-0.02em",
                  }}
                >
                  {resolve(
                    {
                      en: "Hear from our partners",
                      ur: "ہمارے شراکت داروں سے سنیں",
                      roman: "Hamare sharakat-daron se sunein",
                    },
                    lang
                  )}
                </h2>
              </div>
            </FadeIn>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
                gap: 20,
              }}
            >
              {testimonials.map((t, i) => (
                <FadeIn key={i} delay={i * 120}>
                  <div
                    style={{
                      background: theme.surface,
                      border: `1px solid ${theme.border}`,
                      borderRadius: 18,
                      padding: "28px 24px",
                      position: "relative",
                    }}
                  >
                    <div style={{ color: `${theme.primary}30`, marginBottom: 12 }}>
                      <Icon name="quote" size={32} />
                    </div>
                    <p
                      style={{
                        fontSize: 15,
                        color: theme.text,
                        lineHeight: 1.7,
                        margin: "0 0 20px",
                        fontStyle: "italic",
                        fontFamily: bodyFont,
                      }}
                    >
                      "{resolve(t.quote, lang)}"
                    </p>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 12,
                          background: `linear-gradient(135deg, ${theme.primary}, ${theme.primaryDark})`,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: theme.onPrimary,
                          fontSize: 15,
                          fontWeight: 700,
                        }}
                      >
                        {t.author.charAt(0)}
                      </div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: theme.text }}>{t.author}</div>
                        <div style={{ fontSize: 12, color: theme.textMuted }}>
                          {t.role}{t.city ? ` · ${t.city}` : ""}
                        </div>
                      </div>
                    </div>
                  </div>
                </FadeIn>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          FAQ SECTION
         ═══════════════════════════════════════════════════════════════════════ */}
      {faqs && faqs.length > 0 && (
        <section style={{ padding: "80px 0", borderBottom: `1px solid ${theme.border}` }}>
          <div style={{ ...sectionMaxWidth, maxWidth: 760 }}>
            <FadeIn>
              <div style={{ textAlign: "center", marginBottom: 48 }}>
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "6px 16px",
                    borderRadius: 99,
                    background: `${theme.primary}10`,
                    border: `1px solid ${theme.primary}25`,
                    color: theme.primary,
                    fontSize: 12,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "1px",
                    marginBottom: 16,
                  }}
                >
                  <Icon name="fileCheck" size={12} />
                  {resolve({ en: "FAQ", ur: "عمومی سوالات", roman: "Aam sawalat" }, lang)}
                </div>
                <h2
                  style={{
                    fontSize: "clamp(26px, 4vw, 38px)",
                    fontWeight: 900,
                    color: theme.text,
                    margin: "0 0 12px",
                    letterSpacing: "-0.02em",
                  }}
                >
                  {resolve(
                    {
                      en: "Frequently asked questions",
                      ur: "اکثر پوچھے جانے والے سوالات",
                      roman: "Aksar pooche jane wale sawalat",
                    },
                    lang
                  )}
                </h2>
              </div>
            </FadeIn>

            {faqs.map((faq, i) => (
              <FaqItem key={i} q={faq.q} a={faq.a} theme={theme} lang={lang} index={i} />
            ))}
          </div>
        </section>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          MID-PAGE CTA
         ═══════════════════════════════════════════════════════════════════════ */}
      <section
        style={{
          padding: "80px 24px",
          textAlign: "center",
          background: `radial-gradient(ellipse at 50% 50%, ${theme.primary}10 0%, transparent 70%)`,
          borderBottom: `1px solid ${theme.border}`,
        }}
      >
        <FadeIn>
          <h2
            style={{
              fontSize: "clamp(24px, 4vw, 38px)",
              fontWeight: 900,
              color: theme.text,
              margin: "0 auto 16px",
              maxWidth: 600,
              letterSpacing: "-0.02em",
            }}
          >
            {resolve(
              {
                en: "Ready to grow with AJKMart?",
                ur: "AJKMart کے ساتھ ترقی کے لیے تیار ہیں؟",
                roman: "AJKMart ke sath taraqqi ke liye tayyar hain?",
              },
              lang
            )}
          </h2>
          <p style={{ fontSize: 17, color: theme.textMuted, margin: "0 auto 32px", maxWidth: 480 }}>
            {resolve(
              {
                en: "Join thousands of partners across Azad Jammu & Kashmir.",
                ur: "آزاد جموں و کشمیر بھر میں ہزاروں شراکت داروں میں شامل ہوں۔",
                roman: "Azad Jammu & Kashmir bhar mein hazaron sharakat-daron mein shamil hon.",
              },
              lang
            )}
          </p>
          <button
            onClick={onRegister}
            style={{ ...btnPrimary, padding: "16px 40px", fontSize: 16 }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-2px)";
              (e.currentTarget as HTMLButtonElement).style.boxShadow = `0 12px 36px ${theme.primary}60`;
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)";
              (e.currentTarget as HTMLButtonElement).style.boxShadow = `0 8px 28px ${theme.primary}50`;
            }}
          >
            {registerLabel}
            <Icon name="arrowRight" size={18} />
          </button>
        </FadeIn>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          FOOTER
         ═══════════════════════════════════════════════════════════════════════ */}
      <footer
        style={{
          background: theme.surface,
          borderTop: `1px solid ${theme.border}`,
          padding: "56px 24px 32px",
        }}
      >
        <div style={{ ...sectionMaxWidth }}>
          <FadeIn>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: 40,
                marginBottom: 48,
              }}
            >
              {/* Brand column */}
              <div>
                <div style={{ fontSize: 20, fontWeight: 800, color: theme.text, marginBottom: 12, letterSpacing: "-0.02em" }}>
                  {appName ?? "AJKMart"}
                </div>
                <p style={{ fontSize: 14, color: theme.textMuted, lineHeight: 1.65, margin: 0 }}>
                  {resolve(
                    {
                      en: "Azad Jammu & Kashmir's leading digital marketplace for vendors, riders, and customers.",
                      ur: "آزاد جموں و کشمیر کا سب سے بڑا ڈیجیٹل مارکیٹ پلیس۔",
                      roman: "Azad Jammu & Kashmir ka sab se bara digital marketplace.",
                    },
                    lang
                  )}
                </p>
              </div>

              {/* Links column */}
              {footerLinks && footerLinks.length > 0 && (
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: theme.text, textTransform: "uppercase", letterSpacing: "1px", marginBottom: 16 }}>
                    {resolve({ en: "Links", ur: "لنکس", roman: "Links" }, lang)}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {footerLinks.map((link, i) => (
                      <a
                        key={i}
                        href={link.href}
                        style={{
                          fontSize: 14,
                          color: theme.textMuted,
                          textDecoration: "none",
                          transition: "color 0.15s ease",
                        }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = theme.primary; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = theme.textMuted; }}
                      >
                        {resolve(link.label, lang)}
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Contact column */}
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: theme.text, textTransform: "uppercase", letterSpacing: "1px", marginBottom: 16 }}>
                  {resolve({ en: "Contact", ur: "رابطہ", roman: "Rabta" }, lang)}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {supportPhone && (
                    <a href={`tel:${supportPhone}`} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: theme.textMuted, textDecoration: "none" }}>
                      <Icon name="phone" size={16} />
                      {supportPhone}
                    </a>
                  )}
                  {supportEmail && (
                    <a href={`mailto:${supportEmail}`} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: theme.textMuted, textDecoration: "none" }}>
                      <Icon name="mail" size={16} />
                      {supportEmail}
                    </a>
                  )}
                </div>
              </div>
            </div>

            {/* Bottom bar */}
            <div
              style={{
                borderTop: `1px solid ${theme.border}`,
                paddingTop: 24,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 12,
              }}
            >
              <p style={{ fontSize: 13, color: theme.textMuted, margin: 0 }}>
                © {new Date().getFullYear()} AJKMart · Azad Jammu &amp; Kashmir
              </p>
              <div style={{ display: "flex", alignItems: "center", gap: 8, color: theme.textMuted, fontSize: 13 }}>
                <Icon name="globe" size={14} />
                {resolve(
                  {
                    en: "Serving all cities across AJK",
                    ur: "اے جے کے بھر کے تمام شہروں میں خدمت",
                    roman: "AJK bhar ke tamam shahron mein khidmat",
                  },
                  lang
                )}
              </div>
            </div>
          </FadeIn>
        </div>
      </footer>
    </div>
  );
}

export default GuestLanding;
