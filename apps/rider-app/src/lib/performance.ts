/**
 * Performance monitoring for the Rider App.
 *
 * Tracks two classes of metrics:
 *   1. API response times — measured around every api.ts fetch call.
 *      Slow calls (>1 s) and errors are reported as analytics events.
 *   2. Screen / route load times — measured from route change to first
 *      meaningful paint using performance.now().
 *
 * All data is forwarded via trackEvent() so it flows into whichever
 * analytics platform is configured (GA4 / Mixpanel) without needing a
 * separate SDK.
 */

import { trackEvent } from "./analytics";
import { createLogger } from "./logger";

const log = createLogger("[perf]");

let _enabled = false;
const SLOW_API_THRESHOLD_MS = 1_000;

export function initPerformanceMonitoring(): void {
  if (_enabled) return;
  _enabled = true;

  _reportNavigationTiming();
}

/** Report the browser's Navigation Timing API metrics for the initial load. */
function _reportNavigationTiming(): void {
  if (typeof window === "undefined" || !("performance" in window)) return;

  const report = () => {
    try {
      const [nav] = performance.getEntriesByType(
        "navigation"
      ) as PerformanceNavigationTiming[];
      if (!nav) return;
      const ttfb = Math.round(nav.responseStart - nav.requestStart);
      const domInteractive = Math.round(nav.domInteractive - nav.startTime);
      const loadComplete = Math.round(nav.loadEventEnd - nav.startTime);
      trackEvent("screen_load", {
        screen: window.location.pathname,
        ttfb_ms: ttfb,
        dom_interactive_ms: domInteractive,
        load_complete_ms: loadComplete,
      });
      log.debug("[perf] initial load", { ttfb, domInteractive, loadComplete });
    } catch {
      /* non-critical */
    }
  };

  if (document.readyState === "complete") {
    report();
  } else {
    window.addEventListener("load", report, { once: true });
  }
}

/**
 * Measure an API call and emit an analytics event when it is slow or errors.
 *
 * Usage (wrap any api.ts call):
 *   const result = await measureApiCall("/rider/requests", () => api.getRequests());
 */
export async function measureApiCall<T>(
  endpoint: string,
  call: () => Promise<T>
): Promise<T> {
  const start = performance.now();
  try {
    const result = await call();
    const duration_ms = Math.round(performance.now() - start);
    if (duration_ms >= SLOW_API_THRESHOLD_MS) {
      trackEvent("api_response_slow", { endpoint, duration_ms });
      log.warn(`[perf] slow API: ${endpoint} ${duration_ms}ms`);
    }
    return result;
  } catch (err: unknown) {
    const duration_ms = Math.round(performance.now() - start);
    trackEvent("api_response_error", {
      endpoint,
      duration_ms,
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

/**
 * Track a client-side screen transition.
 * Call with the route path when navigation completes.
 */
export function trackScreenLoad(screen: string, duration_ms: number): void {
  if (!_enabled) return;
  trackEvent("screen_load", { screen, duration_ms });
}

/** Convenience: create a stopwatch and call the returned function to record. */
export function startScreenTimer(screen: string): () => void {
  const start = performance.now();
  return () => {
    const duration_ms = Math.round(performance.now() - start);
    trackScreenLoad(screen, duration_ms);
  };
}
