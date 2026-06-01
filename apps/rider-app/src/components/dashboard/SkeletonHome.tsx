import { ShimmerBlock, ShimmerHeader } from "@/components/ui/shimmer";

export function SkeletonHome() {
  return (
    <div className="flex min-h-screen flex-col bg-page-bg dark:bg-surface">
      <ShimmerHeader>
        <div className="relative mb-6 flex items-center justify-between">
          <div className="space-y-2">
            <ShimmerBlock variant="on-dark" className="h-3 w-28" />
            <ShimmerBlock variant="on-dark" className="h-6 w-36" />
          </div>
          <ShimmerBlock variant="on-dark" className="h-10 w-24 rounded-2xl" />
        </div>
        <ShimmerBlock variant="on-dark" className="h-20 w-full rounded-2xl" />
        <div className="mt-4 grid grid-cols-4 gap-2">
          {[1, 2, 3, 4].map((i) => (
            <ShimmerBlock key={i} variant="on-dark" className="h-[72px] rounded-2xl" />
          ))}
        </div>
      </ShimmerHeader>
      <div className="space-y-3 px-4 pt-4">
        <ShimmerBlock className="h-14 rounded-3xl" />
        <ShimmerBlock className="h-48 rounded-3xl" />
      </div>
    </div>
  );
}
