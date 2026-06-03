/**
 * AJKMart — Centralized Color Palette
 *
 * Single source of truth for every color value used across the platform.
 * All values are raw hex/hsl strings — no Tailwind classes here.
 * Apps and themes reference these tokens; they never hardcode colors directly.
 */

// ─── Brand App Colors ────────────────────────────────────────────────────────

export const appColors = {
  admin: {
    primary: "#6366F1",        // Indigo — admin brand
    primaryHover: "#4F46E5",
    primaryHsl: "239 84% 67%",
    ring: "#6366F1",
  },
  vendor: {
    primary: "#1A56DB",        // AJKMart Blue — vendor brand
    primaryHover: "#1348B5",
    primaryHsl: "221 73% 48%",
    ring: "#1A56DB",
  },
  rider: {
    primary: "#FFD700",        // Gold — rider brand
    primaryHover: "#FFC107",
    primaryHsl: "51 100% 50%",
    ring: "#FFD700",
  },
  customer: {
    primary: "#0066FF",        // Blue — customer/mobile brand
    primaryHover: "#0052CC",
    primaryHsl: "220 100% 50%",
    ring: "#0066FF",
  },
} as const;

// ─── Service Colors ───────────────────────────────────────────────────────────

export const serviceColors = {
  mart: {
    primary: "#00C48C",
    hover: "#00A371",
    gradient: ["#00C48C", "#00A371"] as [string, string],
    bgLight: "#E6FAF4",
    bgDark: "#003D2E",
    textLight: "#00613E",
    textDark: "#00C48C",
  },
  food: {
    primary: "#FF9500",
    hover: "#E68500",
    gradient: ["#FF9500", "#FF6B00"] as [string, string],
    bgLight: "#FFF3E0",
    bgDark: "#3D2000",
    textLight: "#7A3900",
    textDark: "#FF9500",
  },
  rides: {
    primary: "#FCD34D",
    hover: "#F59E0B",
    gradient: ["#FCD34D", "#F59E0B"] as [string, string],
    bgLight: "#FFFBEB",
    bgDark: "#3D2E00",
    textLight: "#7A5A00",
    textDark: "#FCD34D",
  },
  pharmacy: {
    primary: "#AF52DE",
    hover: "#8B3BB5",
    gradient: ["#AF52DE", "#8B3BB5"] as [string, string],
    bgLight: "#F5EAFB",
    bgDark: "#2D0A3D",
    textLight: "#5A1A7A",
    textDark: "#AF52DE",
  },
  parcel: {
    primary: "#FF6B35",
    hover: "#E04E1A",
    gradient: ["#FF6B35", "#E04E1A"] as [string, string],
    bgLight: "#FFF0EB",
    bgDark: "#3D1500",
    textLight: "#7A2A00",
    textDark: "#FF6B35",
  },
  wallet: {
    primary: "#5856D6",
    hover: "#3634B0",
    gradient: ["#5856D6", "#3634B0"] as [string, string],
    bgLight: "#EEEEFA",
    bgDark: "#0D0C3D",
    textLight: "#25247A",
    textDark: "#5856D6",
  },
  van: {
    primary: "#1A56DB",
    hover: "#1040B0",
    gradient: ["#1A56DB", "#1040B0"] as [string, string],
    bgLight: "#EBF0FF",
    bgDark: "#00113D",
    textLight: "#0A2A7A",
    textDark: "#1A56DB",
  },
  school: {
    primary: "#059669",
    hover: "#037A53",
    gradient: ["#059669", "#037A53"] as [string, string],
    bgLight: "#E6FAF4",
    bgDark: "#00291C",
    textLight: "#024D35",
    textDark: "#059669",
  },
} as const;

export type ServiceId = keyof typeof serviceColors;
export type AppId = keyof typeof appColors;

// ─── Semantic / Neutral Palette ───────────────────────────────────────────────

export const neutrals = {
  // Grays
  gray50:  "#F8FAFC",
  gray100: "#F1F5F9",
  gray200: "#E2E8F0",
  gray300: "#CBD5E1",
  gray400: "#94A3B8",
  gray500: "#64748B",
  gray600: "#475569",
  gray700: "#334155",
  gray800: "#1E293B",
  gray900: "#0F172A",
  gray950: "#020617",

  // Dark surfaces (used across dark-first apps)
  surface0: "#0A0A0A",   // deepest — page background
  surface1: "#111111",   // cards
  surface2: "#1A1A1A",   // elevated cards
  surface3: "#2A2A2A",   // borders / inputs
  surface4: "#333333",   // hover states
} as const;

// ─── Semantic Status Colors ───────────────────────────────────────────────────

export const statusColors = {
  success:        "#4CAF50",
  successLight:   "#E8F5E9",
  successDark:    "#1B5E20",
  warning:        "#FF9800",
  warningLight:   "#FFF3E0",
  warningDark:    "#E65100",
  error:          "#F44336",
  errorLight:     "#FFEBEE",
  errorDark:      "#B71C1C",
  info:           "#2196F3",
  infoLight:      "#E3F2FD",
  infoDark:       "#0D47A1",
} as const;

// ─── Login / Auth Shared Brand Tokens ────────────────────────────────────────

export function buildLoginTokens(primary: string, primaryAlpha: (a: number) => string) {
  return {
    brand:          primary,
    brandHover:     primary,
    brandShadow:    primaryAlpha(0.25),
    brandGlowSm:    primaryAlpha(0.30),
    brandGlowMd:    primaryAlpha(0.35),
    brandGlowBlob:  primaryAlpha(0.07),
    brandBorder:    primaryAlpha(0.20),
    btnRadius:      "0.75rem",
  };
}
