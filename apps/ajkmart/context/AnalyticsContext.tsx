import React, { createContext, useContext, useEffect, useRef } from "react";
import {
  initAnalytics,
  trackEvent as utilTrackEvent,
  trackScreen as utilTrackScreen,
} from "@/utils/analytics";
import { usePlatformConfig } from "@/context/PlatformConfigContext";

interface AnalyticsContextType {
  trackEvent: (name: string, props?: Record<string, unknown>) => void;
  trackScreen: (name: string) => void;
}

const AnalyticsContext = createContext<AnalyticsContextType>({
  trackEvent: () => {},
  trackScreen: () => {},
});

export function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  const { config } = usePlatformConfig();
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current) return;
    if (!config.integrations.analytics) return;
    const { analyticsPlatform, analyticsTrackingId, analyticsDebug } = config.integrations;
    const platform = analyticsPlatform ?? "";
    const integ = config.integrations as Record<string, unknown>;
    const isGa4 = platform === "google" || platform === "ga4" || platform === "google_analytics";
    const trackingId =
      isGa4
        ? ((integ.ga4MeasurementId as string | undefined) || analyticsTrackingId || "")
        : platform === "mixpanel"
          ? ((integ.mixpanelToken as string | undefined) || analyticsTrackingId || "")
          : analyticsTrackingId;
    if (!trackingId) return;
    initAnalytics(platform, trackingId, analyticsDebug);
    initializedRef.current = true;
  }, [config.integrations]);

  const trackEvent = (name: string, props?: Record<string, unknown>) => {
    try { utilTrackEvent(name, props); } catch {}
  };

  const trackScreen = (name: string) => {
    try { utilTrackScreen(name); } catch {}
  };

  return (
    <AnalyticsContext.Provider value={{ trackEvent, trackScreen }}>
      {children}
    </AnalyticsContext.Provider>
  );
}

export function useAnalytics() {
  return useContext(AnalyticsContext);
}
