interface OfflineConfirmDialogProps {
  totalRequests: number;
  onStayOnline: () => void;
  onGoOffline: () => void;
}

export function OfflineConfirmDialog({
  totalRequests,
  onStayOnline,
  onGoOffline,
}: OfflineConfirmDialogProps) {
  return (
    <div
      className="pointer-events-auto fixed inset-0 z-[1100] flex animate-[fadeIn_0.15s_ease-out] items-end justify-center bg-black/40"
      role="dialog"
      aria-modal="true"
      aria-label="Confirm going offline"
    >
      <div className="mx-auto w-full max-w-sm animate-[slideUp_0.2s_ease-out] rounded-t-3xl bg-card-dark px-6 py-6 shadow-2xl">
        <p className="mb-1.5 text-base font-extrabold text-white">Go Offline?</p>
        <p className="mb-5 text-sm text-[#B0B0B0]">
          You have {totalRequests} request{totalRequests > 1 ? "s" : ""} waiting — go offline
          anyway?
        </p>
        <div className="flex gap-3">
          <button
            onClick={onStayOnline}
            className="h-12 flex-1 rounded-xl border-2 border-white/10 text-sm font-bold text-[#B0B0B0] transition-colors hover:bg-card-dark"
          >
            Stay Online
          </button>
          <button
            onClick={onGoOffline}
            className="h-12 flex-1 rounded-xl bg-card-dark text-sm font-bold text-white transition-colors hover:bg-card-dark"
          >
            Go Offline
          </button>
        </div>
      </div>
    </div>
  );
}
