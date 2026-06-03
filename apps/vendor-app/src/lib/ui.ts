import { formatCurrency as _sharedFcV } from "@workspace/api-zod";

/* ── AJKMart Vendor — Theme-Aware Design System Tokens ─────────
   Uses CSS variables from the global theme system so that when
   the admin changes the theme, all vendor UI updates automatically.
   Tailwind v4 semantic classes (bg-primary, text-primary-foreground, etc.)
   map to the active theme's CSS custom properties.
─────────────────────────────────────────────────────────────── */

export const DEFAULT_COMMISSION_PCT = 15;
export const BOTTOM_PADDING = "calc(64px + max(8px, env(safe-area-inset-bottom, 8px)))";

/* ── Buttons ── */
export const BTN_PRIMARY =
  "h-12 w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-2xl text-base android-press flex items-center justify-center gap-2 disabled:opacity-50 transition-colors";
export const BTN_SECONDARY =
  "h-12 w-full border-2 border-white/10 text-muted-foreground hover:border-primary/50 hover:text-primary font-bold rounded-2xl text-base android-press flex items-center justify-center transition-colors";
export const BTN_SM =
  "h-9 px-4 text-sm font-bold rounded-xl android-press min-h-0 flex items-center transition-colors";
export const BTN_XS =
  "h-8 px-3 text-xs font-bold rounded-xl android-press min-h-0 flex items-center transition-colors";

/* ── Inputs ── */
export const INPUT =
  "w-full h-12 px-4 bg-[hsl(var(--input))] border border-white/10 rounded-xl text-base text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary focus:bg-[hsl(var(--secondary))] transition-colors";
export const SELECT =
  "w-full h-12 px-3 bg-[hsl(var(--input))] border border-white/10 rounded-xl text-base text-foreground focus:outline-none focus:border-primary transition-colors appearance-none";
export const TEXTAREA =
  "w-full px-4 py-3 bg-[hsl(var(--input))] border border-white/10 rounded-xl text-base text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary focus:bg-[hsl(var(--secondary))] transition-colors resize-none";

/* ── Cards ── */
export const CARD = "bg-[hsl(var(--card))] rounded-2xl shadow-sm overflow-hidden border border-white/10";
export const CARD_HEADER = "px-4 py-3.5 border-b border-border flex items-center justify-between";
export const CARD_BODY = "p-4";
export const ROW = "flex items-center justify-between py-3 border-b border-border last:border-0";

/* ── Typography ── */
export const LABEL = "block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5";
export const STAT_VAL = "text-2xl font-extrabold leading-none text-foreground";
export const STAT_LBL = "text-xs text-muted-foreground font-medium mt-1";

/* ── Badges ── */
export const BADGE_GREEN = "text-xs font-bold px-2.5 py-1 rounded-full bg-green-100 text-green-700";
export const BADGE_ORANGE =
  "text-xs font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-700";
export const BADGE_BLUE = "text-xs font-bold px-2.5 py-1 rounded-full bg-blue-100 text-blue-700";
export const BADGE_RED = "text-xs font-bold px-2.5 py-1 rounded-full bg-red-100 text-red-600";
export const BADGE_PURPLE =
  "text-xs font-bold px-2.5 py-1 rounded-full bg-purple-100 text-purple-700";
export const BADGE_GRAY = "text-xs font-bold px-2.5 py-1 rounded-full bg-gray-100 text-gray-600";

/* ── Status badge maps — single source of truth across all pages ── */
export const ORDER_STATUS_BADGE: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700",
  confirmed: "bg-blue-100 text-blue-700",
  preparing: "bg-purple-100 text-purple-700",
  ready: "bg-indigo-100 text-indigo-700",
  picked_up: "bg-cyan-100 text-cyan-700",
  out_for_delivery: "bg-teal-100 text-teal-700",
  delivered: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-600",
};

export const ORDER_STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  preparing: "Preparing",
  ready: "Ready",
  picked_up: "Picked Up",
  out_for_delivery: "Out for Delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export const PAYMENT_STATUS_BADGE: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700",
  paid: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-600",
  refunded: "bg-gray-100 text-gray-600",
  cod: "bg-amber-100 text-amber-700",
};

export const CAMPAIGN_STATUS_BADGE: Record<string, string> = {
  live: "bg-green-100 text-green-700",
  draft: "bg-gray-100 text-gray-600",
  ended: "bg-red-100 text-red-600",
  paused: "bg-yellow-100 text-yellow-700",
  pending: "bg-blue-100 text-blue-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-600",
};

/* ── Layout ── */
export const SECTION = "px-4 py-4 space-y-3";
export const PAGE = "min-h-screen bg-gray-50 dark:bg-[#0A0F1A]";

/* ── Helpers ── */
export function fc(n: string | number | null | undefined, currencySymbol = "Rs."): string {
  return _sharedFcV(n != null ? String(n) : (n as null | undefined), currencySymbol);
}
export function fd(d: string | Date): string {
  return new Date(d).toLocaleString("en-PK", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
export function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : "Something went wrong";
}
