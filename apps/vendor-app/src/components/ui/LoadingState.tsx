import { Loader2 } from "lucide-react";
import { ShimmerCards, ShimmerRows } from "./ShimmerBlock";

interface LoadingStateProps {
  message?: string;
  rows?: number;
  className?: string;
}

export function LoadingState({ message, className = "" }: LoadingStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center px-4 py-16 ${className}`}>
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-50">
        <Loader2 size={22} className="animate-spin text-orange-400" />
      </div>
      <p className="text-sm font-semibold text-gray-500">{message ?? "Loading…"}</p>
    </div>
  );
}

export function LoadingRows({ rows = 3 }: { rows?: number }) {
  return <ShimmerRows count={rows} />;
}

export function LoadingCards({ count = 4 }: { count?: number }) {
  return (
    <ShimmerCards
      count={count}
      gridClassName="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3"
    />
  );
}
