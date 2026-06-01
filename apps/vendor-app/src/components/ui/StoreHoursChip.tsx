import type { StoreHours } from "../../lib/vendor-auth";

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

function fmt(time: string): string {
  const [hStr, mStr] = time.split(":");
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  const ampm = h >= 12 ? "pm" : "am";
  const h12 = h % 12 || 12;
  return m === 0 ? `${h12}${ampm}` : `${h12}:${String(m).padStart(2, "0")}${ampm}`;
}

interface StoreHoursChipProps {
  storeHours: StoreHours | null | undefined;
  variant?: "default" | "glass";
  className?: string;
}

export function StoreHoursChip({
  storeHours,
  variant = "default",
  className = "",
}: StoreHoursChipProps) {
  if (!storeHours) return null;

  const todayKey = DAY_KEYS[new Date().getDay()];
  const todaySlot = storeHours[todayKey];

  if (!todaySlot) return null;

  const label = todaySlot.closed
    ? "Closed today"
    : `${fmt(todaySlot.open)}–${fmt(todaySlot.close)}`;

  if (variant === "glass") {
    return (
      <span
        className={`text-xs ${className}`}
        style={{ color: "rgba(219,234,254,0.55)" }}
      >
        ⏰ {label}
      </span>
    );
  }

  return (
    <span className={`text-xs text-gray-400 dark:text-gray-500 ${className}`}>
      ⏰ {label}
    </span>
  );
}
