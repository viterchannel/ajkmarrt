import { createLogger } from "@/lib/logger";
import { AlertTriangle } from "lucide-react";
import { Component, useCallback, useMemo, type ReactNode } from "react";
import { isBenignRejection, reportError } from "../lib/error-reporter";
import { queryClient } from "../lib/queryClient";

const log = createLogger("[ErrorBoundary]");

type FallbackFn = (reset: () => void, error: Error | null) => ReactNode;

/* ── Branded Default Fallback ────────────────────────────────────────────────
   On retry: clears React Query cache first so stale queries don't cause a
   crash loop when the boundary resets and child components re-fetch.        */
function DefaultFallback({ reset, error }: { reset: () => void; error: Error | null }) {
  const handleRetry = useCallback(() => {
    /* Flush stale cache — prevents the re-mounted tree from immediately
       re-throwing due to a cached error response from the failed request. */
    queryClient.clear();
    reset();
  }, [reset]);

  /* Stable 5-char reference derived from error message — rider can screenshot
     and quote this code to support instead of describing the crash in words. */
  const errorRef = useMemo(() => {
    const seed = error?.message || "crash";
    const hash = seed
      .split("")
      .reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) % 1000000, 0);
    const code = Math.abs(hash).toString(36).toUpperCase().padStart(5, "0").slice(0, 5);
    return `ERR-${code}`;
  }, [error]);

  const errorDescId = "eb-error-desc";

  return (
    <div
      role="alert"
      aria-live="assertive"
      aria-describedby={errorDescId}
      className="flex min-h-[60vh] flex-col items-center justify-center bg-surface px-6 py-8 text-center"
    >
      <div className="w-full max-w-sm">
        {/* Brand label */}
        <p className="mb-5 text-[10px] font-bold tracking-[0.2em] text-white/20 uppercase">
          AJKMart Rider
        </p>

        {/* Gold icon ring — matches OnlineToggleCard / StatsGrid glass-card pattern */}
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-[18px] border border-brand/25 bg-brand/10">
          <AlertTriangle size={28} className="text-brand" />
        </div>

        {/* Title */}
        <h1 className="mb-2 text-lg font-bold tracking-tight text-white/90">
          Something went wrong
        </h1>

        {/* Error message — linked via aria-describedby */}
        <p
          id={errorDescId}
          className="mb-1 text-sm leading-relaxed text-[#B0B0B0]"
        >
          {error?.message || "An unexpected error occurred. Please try again."}
        </p>

        {/* Error ref code — mono, muted; rider can quote to support */}
        <p className="mb-6 font-mono text-[11px] text-white/20">{errorRef}</p>

        {/* Action buttons */}
        <div className="flex flex-col gap-2.5">
          {/* Primary — gold branded retry */}
          <button
            onClick={handleRetry}
            className="flex h-12 w-full items-center justify-center rounded-xl bg-gradient-to-r from-brand to-amber-600 text-sm font-bold text-surface transition-opacity hover:opacity-90 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
          >
            Try Again
          </button>

          {/* Secondary — hard reload */}
          <button
            onClick={() => window.location.reload()}
            className="flex h-12 w-full items-center justify-center rounded-xl border border-white/[0.08] bg-card-dark/[0.04] text-sm font-semibold text-[#B0B0B0] transition-colors hover:bg-card-dark/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20"
          >
            Reload App
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── ErrorBoundaryCore — class component (internal) ─────────────────────────
   Must be a class to use getDerivedStateFromError + componentDidCatch.
   Accepts an optional FallbackFn; the public ErrorBoundary wrapper always
   supplies DefaultFallback when the caller does not provide their own.      */
interface CoreProps {
  children: ReactNode;
  fallback: FallbackFn;
}
interface CoreState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundaryCore extends Component<CoreProps, CoreState> {
  private _onUnhandledRejection: (event: PromiseRejectionEvent) => void;
  private _onWindowError: (event: ErrorEvent) => void;

  constructor(props: CoreProps) {
    super(props);
    this.state = { hasError: false, error: null };
    this.reset = this.reset.bind(this);

    /* Bind async-error handlers once so componentWillUnmount can remove
       the exact same function references that componentDidMount added.    */
    this._onUnhandledRejection = (event: PromiseRejectionEvent) => {
      const err = event.reason;
      if (isBenignRejection(err)) return;
      const error =
        err instanceof Error
          ? err
          : new Error(err?.message || String(err) || "Unhandled promise rejection");
      this.setState({ hasError: true, error });
    };

    this._onWindowError = (event: ErrorEvent) => {
      /* Skip network-level resource errors (script/image/link load failures)
         which have no `error` property and are not actionable crashes.     */
      if (!event.error) return;
      this.setState({ hasError: true, error: event.error as Error });
    };
  }

  /* Catch async errors (unhandled promise rejections + uncaught window
     errors) and display the same fallback UI as render-phase crashes.
     initErrorReporter() (called in main.tsx) handles the *reporting* side
     — these listeners handle the *display* side. Listeners are removed on
     unmount so they don't accumulate across hot reloads or re-mounts.     */
  componentDidMount() {
    window.addEventListener("unhandledrejection", this._onUnhandledRejection);
    window.addEventListener("error", this._onWindowError);
  }

  componentWillUnmount() {
    window.removeEventListener("unhandledrejection", this._onUnhandledRejection);
    window.removeEventListener("error", this._onWindowError);
  }

  static getDerivedStateFromError(error: Error): CoreState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    log.error("caught:", error, info);
    reportError({
      errorType: "frontend_crash",
      errorMessage: error.message || "Component crash",
      stackTrace: error.stack || info.componentStack,
      componentName: info.componentStack?.split("\n")[1]?.trim() || undefined,
    });
  }

  reset() {
    this.setState({ hasError: false, error: null });
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback(this.reset, this.state.error);
    }
    return this.props.children;
  }
}

/* ── ErrorBoundary — public functional wrapper ───────────────────────────────
   Callers may supply their own fallback (ReactNode or FallbackFn) to override.

   Global Re-use:
     App.tsx — wraps every lazy-loaded page (14 usages, zero prop changes)
     Any future page can wrap its own subtree with <ErrorBoundary>          */
interface Props {
  children: ReactNode;
  fallback?: ReactNode | FallbackFn;
}

export function ErrorBoundary({ children, fallback }: Props) {
  /* Stable fallback function: if caller passes a ReactNode, wrap it;
     if they pass a FallbackFn, use it directly; otherwise DefaultFallback.  */
  const resolvedFallback = useCallback<FallbackFn>(
    (reset, error) => {
      if (typeof fallback === "function") {
        return (fallback as FallbackFn)(reset, error);
      }
      if (fallback != null) {
        return fallback as ReactNode;
      }
      return <DefaultFallback reset={reset} error={error} />;
    },
    [fallback]
  );

  return (
    <ErrorBoundaryCore fallback={resolvedFallback}>
      {children}
    </ErrorBoundaryCore>
  );
}
