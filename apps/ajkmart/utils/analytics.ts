/**
 * Analytics — cross-platform (web + native).
 * Supports GA4 and Mixpanel via CDN script injection on web.
 * On iOS/Android, trackEvent/identifyUser are lightweight stubs that
 * log in DEV and are silent in production (events still reach the server
 * via audit logs on every auth action).
 */
import { Platform } from "react-native";

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag: (...args: unknown[]) => void;
    mixpanel?: {
      init: (token: string, opts?: Record<string, unknown>) => void;
      track: (event: string, props?: Record<string, unknown>) => void;
      identify: (id: string) => void;
      reset: () => void;
    };
  }
}

let _platform = "";
let _ready = false;
let _trackingId = "";

export function initAnalytics(
  platform: string,
  trackingId: string,
  debug: boolean,
): void {
  if (!trackingId || _ready) return;
  _platform = platform;
  _trackingId = trackingId;
  _ready = true;

  if (Platform.OS !== "web") {
    if (__DEV__) console.log("[analytics] init (native stub):", platform, trackingId);
    return;
  }

  if (platform === "ga4" || platform === "google_analytics" || platform === "google") {
    _initGa4(trackingId, debug);
  } else if (platform === "mixpanel") {
    _initMixpanel(trackingId, debug);
  }
}

function _initGa4(id: string, debug: boolean): void {
  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${id}`;
  document.head.appendChild(script);
  window.dataLayer = window.dataLayer || [];
  window.gtag = function (...args: unknown[]) { window.dataLayer.push(args); };
  window.gtag("js", new Date());
  window.gtag("config", id, { debug_mode: debug, send_page_view: true });
}

function _initMixpanel(token: string, debug: boolean): void {
  const script = document.createElement("script");
  script.async = true;
  script.src = "https://cdn.mxpnl.com/libs/mixpanel-2-latest.min.js";
  script.onload = () => { window.mixpanel?.init(token, { debug }); };
  document.head.appendChild(script);
}

export function trackEvent(name: string, params?: Record<string, unknown>): void {
  if (Platform.OS !== "web") {
    if (__DEV__) console.log("[analytics:native]", name, params ?? {});
    return;
  }
  if (!_ready) return;
  if (_platform === "ga4" || _platform === "google_analytics" || _platform === "google") {
    if (typeof window.gtag === "function") window.gtag("event", name, params);
  } else if (_platform === "mixpanel") {
    window.mixpanel?.track(name, params);
  }
}

export function trackScreen(screenName: string): void {
  trackEvent("screen_view", { screen_name: screenName });
}

export function identifyUser(id: string): void {
  if (Platform.OS !== "web") {
    if (__DEV__) console.log("[analytics:native] identify:", id);
    return;
  }
  if (!_ready) return;
  if (_platform === "mixpanel") {
    window.mixpanel?.identify(id);
  } else if (_platform === "ga4" || _platform === "google_analytics" || _platform === "google") {
    if (typeof window.gtag === "function" && _trackingId) {
      window.gtag("config", _trackingId, { user_id: id });
    }
  }
}

export function resetAnalyticsUser(): void {
  if (Platform.OS !== "web") {
    if (__DEV__) console.log("[analytics:native] reset user");
    return;
  }
  if (!_ready) return;
  if (_platform === "mixpanel") window.mixpanel?.reset();
}
