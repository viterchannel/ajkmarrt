import { ShimmerBlock } from "@/components/ui/shimmer";
import { CheckCircle } from "lucide-react";

export { ShimmerBlock as SkeletonBlock };

export function SkeletonProfile() {
  return (
    <div className="min-h-screen bg-page-bg dark:bg-surface">
      <div
        className="rounded-b-[2rem] bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 px-5 pb-24"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 3.5rem)" }}
      />
      <div className="-mt-20 space-y-4 px-4">
        <div className="rounded-3xl bg-card-dark p-5 shadow-lg">
          <div className="flex items-start gap-4">
            <ShimmerBlock className="h-16 w-16 rounded-2xl" />
            <div className="flex-1 space-y-2">
              <ShimmerBlock className="h-5 w-32" />
              <ShimmerBlock className="h-3 w-24" />
              <ShimmerBlock className="h-3 w-20" />
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {[1, 2, 3, 4].map((i) => (
            <ShimmerBlock key={i} className="h-20 flex-1 rounded-2xl" />
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <ShimmerBlock key={i} className="h-20 rounded-2xl" />
          ))}
        </div>
        <ShimmerBlock className="h-48 rounded-3xl" />
      </div>
    </div>
  );
}

export function InfoRow({
  label,
  value,
  empty,
  icon,
}: {
  label: string;
  value?: string | null;
  empty?: string;
  icon?: React.ReactElement;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-white/5 px-5 py-3.5 last:border-0">
      <span className="flex flex-shrink-0 items-center gap-2 text-xs font-semibold text-[#B0B0B0]">
        {icon}
        {label}
      </span>
      <span
        className={`text-right text-sm font-semibold ${value ? "text-white" : "text-xs text-[#B0B0B0] italic"}`}
      >
        {value || empty || "—"}
      </span>
    </div>
  );
}

export function SavedCheckmark({ show, label }: { show: boolean; label: string }) {
  if (!show) return null;
  return (
    <span className="inline-flex animate-[fadeIn_0.3s_ease-out] items-center gap-1 text-xs font-bold text-success">
      <CheckCircle size={14} className="text-success" /> {label}
    </span>
  );
}
