import { tDual } from "@workspace/i18n";
import { BADGE_GREEN, BADGE_RED } from "../../lib/ui";
import { useLanguage } from "../../lib/useLanguage";

interface StoreStatusBadgeProps {
  isOpen: boolean;
  variant?: "badge" | "glass";
  className?: string;
}

export function StoreStatusBadge({
  isOpen,
  variant = "badge",
  className = "",
}: StoreStatusBadgeProps) {
  const { language } = useLanguage();
  const T = (k: Parameters<typeof tDual>[0]) => tDual(k, language);

  if (variant === "glass") {
    return (
      <span
        className={`rounded-full px-2.5 py-1 text-xs font-bold ${className}`}
        style={
          isOpen
            ? {
                background: "rgba(16,185,129,0.25)",
                color: "#6EE7B7",
                border: "1px solid rgba(16,185,129,0.30)",
              }
            : {
                background: "rgba(239,68,68,0.22)",
                color: "#FCA5A5",
                border: "1px solid rgba(239,68,68,0.28)",
              }
        }
      >
        {isOpen ? `🟢 ${T("openLabel")}` : `🔴 ${T("closedLabel")}`}
      </span>
    );
  }

  return (
    <span className={`${isOpen ? BADGE_GREEN : BADGE_RED} ${className}`}>
      {isOpen ? T("openLabel") : T("closedLabel")}
    </span>
  );
}
