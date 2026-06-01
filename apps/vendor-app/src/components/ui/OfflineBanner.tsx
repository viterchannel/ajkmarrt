interface OfflineBannerProps {
  show: boolean;
  variant?: "offline" | "socket";
  message?: string;
}

const DEFAULT_OFFLINE_MSG = "📴 You're offline — data may be out of date";

export function OfflineBanner({
  show,
  variant = "offline",
  message,
}: OfflineBannerProps) {
  if (!show) return null;

  if (variant === "socket") {
    return (
      <div className="flex items-center justify-center gap-2 bg-amber-500 px-4 py-2 text-center text-xs font-bold text-white">
        <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-white/70" />
        Real-time updates disconnected — reconnecting…
      </div>
    );
  }

  return (
    <div className="bg-red-500 px-4 py-2 text-center text-xs font-bold text-white">
      {message ?? DEFAULT_OFFLINE_MSG}
    </div>
  );
}
