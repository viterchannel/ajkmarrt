function cn(...c: (string | undefined | false | null)[]): string {
  return c.filter(Boolean).join(" ");
}

function Shimmer({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={cn("skeleton", className)} style={style} />;
}

export function ShimmerRow({ className }: { className?: string }) {
  return <Shimmer className={cn("h-16 w-full rounded-2xl", className)} />;
}

export function ShimmerCard({ className }: { className?: string }) {
  return <Shimmer className={cn("h-24 w-full rounded-2xl", className)} />;
}

export function ShimmerStat({ className }: { className?: string }) {
  return <Shimmer className={cn("mt-1 h-7 w-20 rounded-lg", className)} />;
}

export function ShimmerChart({
  height = 220,
  className,
}: {
  height?: number;
  className?: string;
}) {
  return <Shimmer className={cn("w-full rounded-xl", className)} style={{ height }} />;
}

export function ShimmerRows({
  count = 3,
  className,
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div className={cn("space-y-3", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <ShimmerRow key={i} />
      ))}
    </div>
  );
}

export function ShimmerCards({
  count = 3,
  gridClassName,
  className,
}: {
  count?: number;
  gridClassName?: string;
  className?: string;
}) {
  return (
    <div className={cn("space-y-3", gridClassName, className)}>
      {Array.from({ length: count }).map((_, i) => (
        <ShimmerCard key={i} />
      ))}
    </div>
  );
}
