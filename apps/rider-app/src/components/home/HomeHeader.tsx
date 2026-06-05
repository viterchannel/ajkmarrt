import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { Bell, Volume2, VolumeX } from "lucide-react";
import { motion, useScroll, useTransform, useSpring } from "framer-motion";
import { formatCurrency } from "../dashboard";
import type { TranslationKey } from "@workspace/i18n";
import type { UseHomeDataReturn } from "./useHomeData";

/* ─── 300ms debounced callback hook ─────────────────────────────────────── */

function useDebouncedCallback(fn: () => void, delay: number): () => void {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  return useCallback(() => {
    if (timerRef.current) return; // ignore rapid re-taps within window
    fnRef.current();
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
    }, delay);
  }, [delay]);
}

/* ─── Shared helpers ─────────────────────────────────────────────────────── */

export function getRiderTier(rating: number | null | undefined): { label: string; cls: string } {
  if (!rating || rating === 0) return { label: "Standard", cls: "text-muted-foreground bg-muted/20 border-border" };
  if (rating >= 4.5) return { label: "Gold Partner", cls: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20" };
  if (rating >= 4.0) return { label: "Silver Partner", cls: "text-blue-400 bg-blue-400/10 border-blue-400/20" };
  if (rating >= 3.5) return { label: "Active Rider", cls: "text-success bg-success/10 border-success/20" };
  return { label: "Standard", cls: "text-muted-foreground bg-muted/20 border-border" };
}

export function getInitials(name?: string | null): string {
  if (!name) return "R";
  const parts = name.trim().split(" ").filter(Boolean);
  if (parts.length === 0) return "R";
  if (parts.length === 1) return parts[0]![0]?.toUpperCase() ?? "R";
  return ((parts[0]![0] ?? "") + (parts[parts.length - 1]![0] ?? "")).toUpperCase();
}

/* ─── Props ──────────────────────────────────────────────────────────────── */

interface HomeHeaderProps {
  user: UseHomeDataReturn["user"];
  greeting: string;
  lastSeenLabel: string;
  currency: string;
  T: (key: TranslationKey) => string;
  effectiveOnline: boolean;
  toggling: boolean;
  silenceOn: boolean;
  onToggleOnline: () => void;
  onToggleSilence: () => void;
  newFlash: boolean;
  unreadNotifications?: number;
}

/* ─── Theme detector ─────────────────────────────────────────────────────── */

function useIsLight(): boolean {
  const [isLight, setIsLight] = useState(
    () => typeof document !== "undefined" && document.documentElement.classList.contains("light"),
  );
  useEffect(() => {
    const root = document.documentElement;
    const observer = new MutationObserver(() => setIsLight(root.classList.contains("light")));
    observer.observe(root, { attributes: true, attributeFilter: ["class", "data-theme"] });
    return () => observer.disconnect();
  }, []);
  return isLight;
}

/* ─── Animated pill toggle ───────────────────────────────────────────────── */

function AnimatedToggle({ on, disabled }: { on: boolean; disabled: boolean }) {
  const springConfig = { type: "spring" as const, stiffness: 500, damping: 30 };
  const GREEN = "#4ADE80";
  const isLight = useIsLight();
  const trackBg = on ? GREEN : isLight ? "#D1D5DB" : "rgba(255,255,255,0.12)";
  const trackBgOnline = on ? (isLight ? "#16A34A" : GREEN) : trackBg;

  return (
    <motion.div
      animate={{ backgroundColor: trackBgOnline }}
      transition={{ duration: 0.25 }}
      style={{ width: 48, height: 28, borderRadius: 14, position: "relative", flexShrink: 0, opacity: disabled ? 0.6 : 1 }}
    >
      <motion.div
        layout
        animate={{ x: on ? 23 : 3 }}
        transition={springConfig}
        style={{ width: 22, height: 22, borderRadius: 11, background: "#fff", position: "absolute", top: 3, boxShadow: "0 2px 8px rgba(0,0,0,0.35)" }}
      />
    </motion.div>
  );
}

/* ─── Status ring on avatar ──────────────────────────────────────────────── */

function AvatarWithRing({ initials, avatar, name, isOnline }: { initials: string; avatar?: string | null; name?: string | null; isOnline: boolean }) {
  const ringColor = isOnline ? "#4ADE80" : "transparent";
  return (
    <div style={{ position: "relative", width: 34, height: 34 }}>
      <motion.div
        animate={{ boxShadow: isOnline ? `0 0 0 2px #4ADE80, 0 0 0 4px rgba(74,222,128,0.2)` : "0 0 0 2px transparent" }}
        transition={{ duration: 0.3 }}
        style={{ width: 34, height: 34, borderRadius: 8, background: "linear-gradient(135deg, #C9A84C, #A0802A)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", position: "relative" }}
      >
        {avatar
          ? <img src={avatar} alt={name ?? "Rider"} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          : <span style={{ fontSize: 11, fontWeight: 800, color: "#080808" }}>{initials}</span>}
      </motion.div>
    </div>
  );
}

function LightAvatarWithRing({ initials, avatar, name, isOnline }: { initials: string; avatar?: string | null; name?: string | null; isOnline: boolean }) {
  const L_GOLD = "#B8892A";
  return (
    <div style={{ position: "relative", width: 32, height: 32 }}>
      <motion.div
        animate={{ boxShadow: isOnline ? `0 0 0 2px #16A34A, 0 0 0 4px rgba(22,163,74,0.2)` : "0 0 0 2px transparent" }}
        transition={{ duration: 0.3 }}
        style={{ width: 32, height: 32, borderRadius: 8, background: L_GOLD, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}
      >
        {avatar
          ? <img src={avatar} alt={name ?? "Rider"} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          : <span style={{ fontSize: 10, fontWeight: 800, color: "#FFFFFF" }}>{initials}</span>}
      </motion.div>
    </div>
  );
}

/* ─── Constants ──────────────────────────────────────────────────────────── */
const GOLD = "#C9A84C";
const GOLD_LIGHT_HEX = "#E8C878";
const GREEN = "#4ADE80";
const L_BG = "#FAFAF8";
const L_CARD = "#FFFFFF";
const L_CARD2 = "#F5F4F0";
const L_GOLD = "#B8892A";
const L_GOLD_BG = "rgba(184,137,42,0.08)";
const L_GOLD_BORDER = "rgba(184,137,42,0.2)";
const L_GREEN = "#16A34A";
const L_TEXT = "#1A1A1A";
const L_MUTED = "#6B7280";
const L_BORDER = "#E8E5DF";

/* ═══════════════════════════════════════════════════════════════════════════
   DARK MODE HEADER — sticky with compact scroll mode
   ═══════════════════════════════════════════════════════════════════════════ */

function DarkHeader({
  user, greeting, currency, effectiveOnline, toggling, silenceOn, onToggleOnline, onToggleSilence, newFlash, unreadNotifications = 0,
}: HomeHeaderProps) {
  const containerRef = useRef<HTMLElement>(null);
  const { scrollY } = useScroll();
  const debouncedToggle = useDebouncedCallback(onToggleOnline, 300);

  const compactProgress = useTransform(scrollY, [0, 80], [0, 1]);
  const springProgress = useSpring(compactProgress, { stiffness: 300, damping: 40 });

  const headerPaddingBottom = useTransform(springProgress, [0, 1], [20, 10]);
  const greetingSectionOpacity = useTransform(springProgress, [0, 0.6], [1, 0]);
  const greetingSectionHeight = useTransform(springProgress, [0, 1], [110, 0]);
  const balanceCardOpacity = useTransform(springProgress, [0, 0.5], [1, 0]);
  const balanceCardHeight = useTransform(springProgress, [0, 1], [90, 0]);
  const statsGridOpacity = useTransform(springProgress, [0, 0.4], [1, 0]);
  const statsGridHeight = useTransform(springProgress, [0, 1], [58, 0]);
  const toggleBarOpacity = useTransform(springProgress, [0, 0.5], [1, 0]);
  const toggleBarHeight = useTransform(springProgress, [0, 1], [56, 0]);
  const toggleBarMargin = useTransform(springProgress, [0, 1], [10, 0]);
  const compactStatusOpacity = useTransform(springProgress, [0.5, 1], [0, 1]);

  const firstName = user?.name?.split(" ")[0] || "Rider";
  const initials = getInitials(user?.name);
  const rating = user?.stats?.rating ?? null;
  const tier = getRiderTier(rating);
  const balance = formatCurrency(user?.walletBalance ?? "0", currency);
  const todayEarned = formatCurrency(user?.stats?.earningsToday ?? 0, currency);
  const todayTrips = user?.stats?.deliveriesToday ?? 0;
  const hasUnread = unreadNotifications > 0;

  return (
    <motion.header
      ref={containerRef}
      layout
      style={{
        position: "sticky",
        top: 0,
        zIndex: 40,
        background: "linear-gradient(180deg, #111111 0%, #0D0D0D 100%)",
        paddingTop: "calc(env(safe-area-inset-top, 0px) + 3.5rem)",
        borderBottom: "1px solid rgba(201,168,76,0.12)",
        fontFamily: "'Helvetica Neue', -apple-system, sans-serif",
        willChange: "transform",
      }}
    >
      <motion.div style={{ padding: `0 20px`, paddingBottom: headerPaddingBottom }}>

        <div style={{ height: 1, background: `linear-gradient(90deg, transparent, ${GOLD}, transparent)`, marginBottom: 14, opacity: 0.55 }} />

        {/* ── Top bar: logo | compact status (on scroll) | controls ── */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: "linear-gradient(145deg, #1A1A1A, #111111)", border: `1px solid ${GOLD}30`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 0 16px rgba(201,168,76,0.12)` }}>
              <span style={{ fontSize: 14, fontWeight: 800, background: `linear-gradient(135deg, ${GOLD_LIGHT_HEX}, ${GOLD})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>A</span>
            </div>
            <div style={{ position: "relative" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#F5F5F5", letterSpacing: 0.4 }}>AJKMart</div>
              <div style={{ fontSize: 9, fontWeight: 600, color: GOLD, letterSpacing: 1.5, textTransform: "uppercase" }}>Rider</div>
            </div>
            {/* Compact status pill — visible on scroll */}
            <motion.div
              style={{ opacity: compactStatusOpacity, display: "flex", alignItems: "center", gap: 5, marginLeft: 6, overflow: "hidden" }}
            >
              <motion.div
                animate={{ scale: effectiveOnline ? [1, 1.2, 1] : 1 }}
                transition={{ duration: 2, repeat: effectiveOnline ? Infinity : 0, repeatType: "loop" }}
                style={{ width: 7, height: 7, borderRadius: 4, background: effectiveOnline ? GREEN : "#3A3A3A", flexShrink: 0 }}
              />
              <span style={{ fontSize: 11, fontWeight: 700, color: effectiveOnline ? GREEN : "rgba(255,255,255,0.3)", whiteSpace: "nowrap" }}>
                {effectiveOnline ? "Online" : "Offline"}
              </span>
            </motion.div>
          </div>

          <div style={{ display: "flex", gap: 7, alignItems: "center" }}>
            <button onClick={onToggleSilence} aria-label={silenceOn ? "Unmute" : "Mute"} style={{ width: 34, height: 34, borderRadius: 8, background: silenceOn ? "rgba(239,68,68,0.12)" : "#1A1A1A", border: `1px solid ${silenceOn ? "rgba(239,68,68,0.25)" : "rgba(255,255,255,0.06)"}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
              {silenceOn ? <VolumeX size={14} style={{ color: "#EF4444" }} /> : <Volume2 size={14} style={{ color: "rgba(255,255,255,0.35)" }} />}
            </button>
            <Link href="/notifications" style={{ width: 34, height: 34, borderRadius: 8, background: "#1A1A1A", border: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", textDecoration: "none" }} aria-label="Notifications">
              <Bell size={14} style={{ color: hasUnread ? GOLD_LIGHT_HEX : "rgba(255,255,255,0.35)" }} />
              {hasUnread && (
                <span style={{ position: "absolute", top: -4, right: -4, width: 16, height: 16, borderRadius: 8, background: "#EF4444", border: "1.5px solid #111", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 800, color: "#fff" }}>
                  {unreadNotifications > 9 ? "9+" : unreadNotifications}
                </span>
              )}
            </Link>
            <Link href="/profile" style={{ textDecoration: "none" }} aria-label="Profile">
              <AvatarWithRing initials={initials} avatar={user?.avatar} name={user?.name} isOnline={effectiveOnline} />
            </Link>
          </div>
        </div>

        {/* ── Greeting + name + status (collapses on scroll) ── */}
        <motion.div style={{ opacity: greetingSectionOpacity, height: greetingSectionHeight, overflow: "hidden", marginBottom: 0 }}>
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.28)", letterSpacing: 2, textTransform: "uppercase", marginBottom: 4 }}>{greeting}</div>
            <div style={{ fontSize: 30, fontWeight: 700, color: newFlash ? GREEN : "#FFFFFF", letterSpacing: -0.7, lineHeight: 1.05, transition: "color 0.3s" }}>{firstName}</div>
            <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8 }}>
              <motion.div
                animate={{ scale: effectiveOnline ? [1, 1.3, 1] : 1, backgroundColor: effectiveOnline ? GREEN : "#3A3A3A" }}
                transition={{ duration: 2, repeat: effectiveOnline ? Infinity : 0, repeatType: "loop" }}
                style={{ width: 7, height: 7, borderRadius: 4 }}
              />
              <span style={{ fontSize: 11, fontWeight: 500, color: effectiveOnline ? GREEN : "rgba(255,255,255,0.28)" }}>{effectiveOnline ? "Online · Available for rides" : "Offline"}</span>
              {tier.label !== "Standard" && (
                <span style={{ fontSize: 9, fontWeight: 700, color: GOLD, background: "rgba(201,168,76,0.1)", border: `1px solid rgba(201,168,76,0.2)`, borderRadius: 20, padding: "2px 8px", letterSpacing: 0.8, textTransform: "uppercase" }}>{tier.label}</span>
              )}
            </div>
            {newFlash && (
              <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: GREEN }}>
                <span style={{ width: 6, height: 6, borderRadius: 3, background: GREEN, display: "block" }} />
                New request available
              </div>
            )}
          </div>
        </motion.div>

        {/* ── Balance card (collapses on scroll) ── */}
        <motion.div style={{ opacity: balanceCardOpacity, height: balanceCardHeight, overflow: "hidden", marginBottom: 10 }}>
          <Link href="/wallet" style={{ display: "block", background: "linear-gradient(135deg, #1A1A1A 0%, #141414 60%, rgba(201,168,76,0.04) 100%)", borderRadius: 18, padding: "16px 18px", border: `1px solid rgba(201,168,76,0.16)`, position: "relative", overflow: "hidden", textDecoration: "none", transition: "border-color 0.2s" }} aria-label="View wallet">
            <div style={{ position: "absolute", top: 0, right: 0, width: 80, height: 80, background: `radial-gradient(circle, rgba(201,168,76,0.1) 0%, transparent 70%)`, pointerEvents: "none" }} />
            <div style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.28)", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 8 }}>Balance</div>
            <div style={{ fontSize: 32, fontWeight: 700, color: "#FFFFFF", letterSpacing: -0.8, marginBottom: 4 }}>{balance}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: GREEN }}>+ {todayEarned} today</span>
              <span style={{ width: 1, height: 11, background: "rgba(255,255,255,0.1)" }} />
              <span style={{ fontSize: 11, fontWeight: 500, color: GOLD }}>{tier.label !== "Standard" ? tier.label : "Wallet"}</span>
            </div>
          </Link>
        </motion.div>

        {/* ── Stats grid (collapses on scroll) ── */}
        <motion.div style={{ opacity: statsGridOpacity, height: statsGridHeight, overflow: "hidden", marginBottom: 10 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            {[
              { label: "Today", value: todayEarned },
              { label: "Trips", value: String(todayTrips) },
              { label: "Rating", value: rating != null && rating > 0 ? `${rating.toFixed(1)} ★` : "—" },
            ].map(({ label, value }) => (
              <div key={label} style={{ background: "#141414", borderRadius: 12, padding: "11px 13px", border: "1px solid rgba(255,255,255,0.04)" }}>
                <div style={{ fontSize: 9, fontWeight: 600, color: "rgba(255,255,255,0.22)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 5 }}>{label}</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: label === "Rating" && rating != null && rating >= 4.5 ? GOLD : "#FFFFFF", letterSpacing: -0.2 }}>{value}</div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* ── Online toggle bar (collapses on scroll) ── */}
        <motion.div style={{ opacity: toggleBarOpacity, height: toggleBarHeight, overflow: "hidden", marginBottom: toggleBarMargin }}>
          <button
            onClick={debouncedToggle}
            disabled={toggling}
            style={{ width: "100%", background: effectiveOnline ? "linear-gradient(135deg, rgba(74,222,128,0.08), rgba(74,222,128,0.04))" : "#141414", borderRadius: 14, padding: "13px 16px", border: `1px solid ${effectiveOnline ? "rgba(74,222,128,0.2)" : "rgba(255,255,255,0.04)"}`, display: "flex", alignItems: "center", justifyContent: "space-between", cursor: toggling ? "not-allowed" : "pointer", opacity: toggling ? 0.7 : 1, transition: "all 0.25s", textAlign: "left" }}
            role="switch"
            aria-checked={effectiveOnline}
            aria-label={effectiveOnline ? "Go offline" : "Go online"}
          >
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: effectiveOnline ? GREEN : "rgba(255,255,255,0.38)", letterSpacing: -0.1 }}>{effectiveOnline ? "Accepting Rides" : "Go Online"}</div>
              <div style={{ fontSize: 10, fontWeight: 500, color: "rgba(255,255,255,0.2)", marginTop: 2 }}>{effectiveOnline ? "Tap to go offline" : "Tap to start earning"}</div>
            </div>
            <AnimatedToggle on={effectiveOnline} disabled={toggling} />
          </button>
        </motion.div>

        <div style={{ height: 1, background: `linear-gradient(90deg, transparent, ${GOLD}35, transparent)`, marginTop: 6 }} />
      </motion.div>
    </motion.header>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   LIGHT MODE HEADER — sticky with compact scroll mode
   ═══════════════════════════════════════════════════════════════════════════ */

function LightHeader({
  user, greeting, currency, effectiveOnline, toggling, silenceOn, onToggleOnline, onToggleSilence, newFlash, unreadNotifications = 0,
}: HomeHeaderProps) {
  const { scrollY } = useScroll();
  const debouncedToggle = useDebouncedCallback(onToggleOnline, 300);
  const compactProgress = useTransform(scrollY, [0, 80], [0, 1]);
  const springProgress = useSpring(compactProgress, { stiffness: 300, damping: 40 });

  const headerPaddingBottom = useTransform(springProgress, [0, 1], [18, 8]);
  const mainCardHeight = useTransform(springProgress, [0, 1], [160, 0]);
  const mainCardOpacity = useTransform(springProgress, [0, 0.5], [1, 0]);
  const metricPillsHeight = useTransform(springProgress, [0, 1], [52, 0]);
  const metricPillsOpacity = useTransform(springProgress, [0, 0.5], [1, 0]);
  const compactStatusOpacity = useTransform(springProgress, [0.5, 1], [0, 1]);

  const firstName = user?.name?.split(" ")[0] || "Rider";
  const initials = getInitials(user?.name);
  const rating = user?.stats?.rating ?? null;
  const tier = getRiderTier(rating);
  const balance = formatCurrency(user?.walletBalance ?? "0", currency);
  const todayEarned = formatCurrency(user?.stats?.earningsToday ?? 0, currency);
  const todayTrips = user?.stats?.deliveriesToday ?? 0;
  const hasUnread = unreadNotifications > 0;

  return (
    <motion.header
      layout
      style={{
        position: "sticky",
        top: 0,
        zIndex: 40,
        background: L_BG,
        paddingTop: "calc(env(safe-area-inset-top, 0px) + 3.5rem)",
        borderBottom: `1px solid ${L_BORDER}`,
        boxShadow: "0 2px 16px rgba(0,0,0,0.06)",
        fontFamily: "'Helvetica Neue', -apple-system, sans-serif",
        willChange: "transform",
      }}
    >
      <motion.div style={{ padding: `0 20px`, paddingBottom: headerPaddingBottom }}>
        <div style={{ height: 2, background: `linear-gradient(90deg, ${L_GOLD}, #E8C878, ${L_GOLD})`, marginBottom: 14, borderRadius: "0 0 2px 2px", opacity: 0.7 }} />

        {/* ── Utility bar ── */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 9, background: L_GOLD, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 4px 12px rgba(184,137,42,0.25)` }}>
              <span style={{ fontSize: 14, fontWeight: 800, color: "#FFFFFF" }}>A</span>
            </div>
            <div style={{ position: "relative" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: L_TEXT, letterSpacing: -0.1 }}>{firstName}</div>
              <div style={{ fontSize: 9, fontWeight: 600, color: L_GOLD, letterSpacing: 1.5, textTransform: "uppercase" }}>{tier.label !== "Standard" ? tier.label : "Rider"}</div>
            </div>
            <motion.div style={{ opacity: compactStatusOpacity, display: "flex", alignItems: "center", gap: 5, marginLeft: 4, overflow: "hidden" }}>
              <motion.div
                animate={{ scale: effectiveOnline ? [1, 1.2, 1] : 1 }}
                transition={{ duration: 2, repeat: effectiveOnline ? Infinity : 0, repeatType: "loop" }}
                style={{ width: 7, height: 7, borderRadius: 4, background: effectiveOnline ? L_GREEN : "#D1D5DB", flexShrink: 0 }}
              />
              <span style={{ fontSize: 11, fontWeight: 700, color: effectiveOnline ? L_GREEN : L_MUTED, whiteSpace: "nowrap" }}>
                {effectiveOnline ? "Online" : "Offline"}
              </span>
            </motion.div>
          </div>

          <div style={{ display: "flex", gap: 7 }}>
            <button onClick={onToggleSilence} aria-label={silenceOn ? "Unmute" : "Mute"} style={{ width: 32, height: 32, borderRadius: 8, background: silenceOn ? "#FEF2F2" : L_CARD2, border: `1px solid ${silenceOn ? "#FECACA" : L_BORDER}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
              {silenceOn ? <VolumeX size={13} style={{ color: "#EF4444" }} /> : <Volume2 size={13} style={{ color: L_MUTED }} />}
            </button>
            <Link href="/notifications" style={{ width: 32, height: 32, borderRadius: 8, background: L_CARD2, border: `1px solid ${L_BORDER}`, display: "flex", alignItems: "center", justifyContent: "center", position: "relative", textDecoration: "none" }} aria-label="Notifications">
              <Bell size={13} style={{ color: hasUnread ? L_GOLD : L_MUTED }} />
              {hasUnread && (
                <span style={{ position: "absolute", top: -4, right: -4, width: 16, height: 16, borderRadius: 8, background: "#EF4444", border: "1.5px solid white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 800, color: "#fff" }}>
                  {unreadNotifications > 9 ? "9+" : unreadNotifications}
                </span>
              )}
            </Link>
            <Link href="/profile" style={{ textDecoration: "none" }} aria-label="Profile">
              <LightAvatarWithRing initials={initials} avatar={user?.avatar} name={user?.name} isOnline={effectiveOnline} />
            </Link>
          </div>
        </div>

        {/* ── CENTER STAGE — single dominant interactive card (collapses on scroll) ── */}
        <motion.div style={{ opacity: mainCardOpacity, height: mainCardHeight, overflow: "hidden", marginBottom: 10 }}>
          <button
            onClick={debouncedToggle}
            disabled={toggling}
            style={{ width: "100%", background: effectiveOnline ? `linear-gradient(145deg, ${L_CARD} 0%, rgba(22,163,74,0.03) 100%)` : L_CARD, borderRadius: 22, padding: "20px 20px 18px", border: `1px solid ${effectiveOnline ? "rgba(22,163,74,0.2)" : L_BORDER}`, cursor: toggling ? "not-allowed" : "pointer", opacity: toggling ? 0.8 : 1, transition: "all 0.3s", position: "relative", overflow: "hidden", textAlign: "left", boxShadow: effectiveOnline ? "0 4px 24px rgba(22,163,74,0.08)" : "0 2px 12px rgba(0,0,0,0.06)" }}
            role="switch"
            aria-checked={effectiveOnline}
            aria-label={effectiveOnline ? "Go offline" : "Go online"}
          >
            <div style={{ position: "absolute", top: -30, right: -30, width: 120, height: 120, borderRadius: "50%", background: `radial-gradient(circle, ${L_GOLD_BG} 0%, transparent 70%)`, pointerEvents: "none" }} />
            <div style={{ position: "absolute", top: 16, right: 16, display: "flex", alignItems: "center", gap: 7 }}>
              <motion.div
                animate={{ scale: effectiveOnline ? [1, 1.3, 1] : 1, backgroundColor: effectiveOnline ? L_GREEN : "#D1D5DB" }}
                transition={{ duration: 2, repeat: effectiveOnline ? Infinity : 0, repeatType: "loop" }}
                style={{ width: 7, height: 7, borderRadius: 4 }}
              />
              <AnimatedToggle on={effectiveOnline} disabled={toggling} />
            </div>
            <div style={{ marginBottom: 14, paddingRight: 68 }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: L_MUTED, letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>{greeting}</div>
              <div style={{ fontSize: 38, fontWeight: 700, color: L_TEXT, letterSpacing: -1.2, lineHeight: 1 }}>{balance}</div>
            </div>
            <div style={{ height: 1, background: L_BORDER, margin: "0 0 12px" }} />
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: effectiveOnline ? L_GREEN : L_MUTED, letterSpacing: -0.2 }}>{effectiveOnline ? "Accepting Rides" : "Go Online"}</div>
                <div style={{ fontSize: 10, fontWeight: 500, color: L_MUTED, marginTop: 2 }}>{effectiveOnline ? "Tap anywhere to stop" : "Tap to start earning"}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: L_GREEN }}>{todayEarned}</div>
                <div style={{ fontSize: 9, fontWeight: 600, color: L_MUTED, textTransform: "uppercase", letterSpacing: 1 }}>Earned today</div>
              </div>
            </div>
          </button>
        </motion.div>

        {/* ── Metric pills (collapses on scroll) ── */}
        <motion.div style={{ opacity: metricPillsOpacity, height: metricPillsHeight, overflow: "hidden" }}>
          <div style={{ display: "flex", gap: 8 }}>
            {[
              { label: "Trips", value: String(todayTrips), color: L_GOLD },
              { label: "Rating", value: rating != null && rating > 0 ? `${rating.toFixed(1)} ★` : "—", color: L_GOLD },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ flex: 1, background: L_CARD2, borderRadius: 16, padding: "10px 14px", border: `1px solid ${L_BORDER}` }}>
                <div style={{ fontSize: 9, fontWeight: 600, color: L_MUTED, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: L_TEXT }}>{value}</div>
              </div>
            ))}
          </div>
        </motion.div>

      </motion.div>
    </motion.header>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   PUBLIC EXPORT — picks dark or light variant
   ═══════════════════════════════════════════════════════════════════════════ */

export function HomeHeader(props: HomeHeaderProps) {
  const isLight = useIsLight();
  return isLight ? <LightHeader {...props} /> : <DarkHeader {...props} />;
}
