import { ShimmerBlock, ShimmerHeader } from "@/components/ui/shimmer";

export function SkeletonHome() {
  return (
    <div className="flex min-h-screen flex-col bg-page-bg dark:bg-surface">
      {/* Header skeleton */}
      <ShimmerHeader>
        <div className="relative mb-5 flex items-start justify-between">
          <div className="space-y-2">
            <ShimmerBlock variant="on-dark" className="h-2.5 w-32" />
            <ShimmerBlock variant="on-dark" className="h-7 w-48" />
            <ShimmerBlock variant="on-dark" className="h-2.5 w-36" />
          </div>
          <ShimmerBlock variant="on-dark" className="h-14 w-24 rounded-2xl" />
        </div>
        {/* Online toggle card */}
        <ShimmerBlock variant="on-dark" className="h-24 w-full rounded-2xl" />
        {/* 4-col stats */}
        <div className="mt-4 grid grid-cols-4 gap-2">
          {[1, 2, 3, 4].map((i) => (
            <ShimmerBlock key={i} variant="on-dark" className="h-[72px] rounded-2xl" />
          ))}
        </div>
        {/* Online time bar */}
        <ShimmerBlock variant="on-dark" className="mt-2 h-9 w-full rounded-2xl" />
      </ShimmerHeader>
      <div className="space-y-3 px-3 pt-4">
        {/* Alert center */}
        <ShimmerBlock className="h-14 rounded-3xl" />
        {/* Goal section */}
        <ShimmerBlock className="h-20 rounded-3xl" />
        {/* Request list */}
        <ShimmerBlock className="h-48 rounded-3xl" />
      </div>
    </div>
  );
}
