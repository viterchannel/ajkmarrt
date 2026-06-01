import { Package, Star, ThumbsUp, Truck } from "lucide-react";
import { memo } from "react";

interface StatsGridProps {
  deliveriesToday: number;
  acceptanceRate: number | null | undefined;
  rating: number | null | undefined;
  maxDeliveries?: number;
}

export const StatsGrid = memo(function StatsGrid({
  deliveriesToday,
  acceptanceRate,
  rating,
  maxDeliveries,
}: StatsGridProps) {
  const fmtAcceptance = (): string => {
    if (acceptanceRate == null) return "—";
    return `${Math.round(acceptanceRate)}%`;
  };

  const fmtRating = (): string => {
    if (rating == null || rating === 0) return "—";
    return rating.toFixed(1);
  };

  const ratingColor =
    rating == null || rating === 0
      ? "text-white/40"
      : rating >= 4.5
        ? "text-success"
        : rating >= 3.5
          ? "text-warning"
          : "text-error";

  const acceptColor =
    acceptanceRate == null
      ? "text-white/40"
      : acceptanceRate >= 80
        ? "text-success"
        : acceptanceRate >= 60
          ? "text-warning"
          : "text-error";

  const stats = [
    {
      icon: <Package size={15} className="text-indigo-300" />,
      label: "Rides Today",
      value: String(deliveriesToday),
      valueClass: "text-white",
    },
    {
      icon: <ThumbsUp size={15} className="text-success" />,
      label: "Acceptance",
      value: fmtAcceptance(),
      valueClass: acceptColor,
    },
    {
      icon: <Star size={15} className="text-warning" />,
      label: "Rating",
      value: fmtRating(),
      valueClass: ratingColor,
    },
  ];

  return (
    <div className="mt-3 space-y-2">
      <div className="grid grid-cols-3 gap-2" role="list" aria-label="Rider statistics">
        {stats.map((s, i) => (
          <div
            key={s.label}
            className="animate-[slideUp_0.3s_ease-out] rounded-2xl border border-glass bg-glass p-2.5 text-center backdrop-blur-sm"
            style={{ animationDelay: `${i * 60}ms`, animationFillMode: "both" }}
            role="listitem"
          >
            <div className="mb-1.5 flex justify-center">
              <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-glass">
                {s.icon}
              </div>
            </div>
            <p className={`text-[13px] leading-tight font-extrabold ${s.valueClass}`}>
              {s.value}
            </p>
            <p className="mt-0.5 text-[9px] font-semibold tracking-wider text-white/30 uppercase">
              {s.label}
            </p>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 rounded-2xl border border-glass bg-glass px-3 py-2 backdrop-blur-sm">
        <Truck size={13} className="flex-shrink-0 text-indigo-300" />
        <p className="text-[11px] font-semibold text-white/60">
          Max simultaneous deliveries:{" "}
          <span className="font-extrabold text-white">{maxDeliveries ?? 3}</span>
        </p>
      </div>
    </div>
  );
});
