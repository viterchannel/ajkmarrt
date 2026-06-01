import { type ReactNode } from "react";
import { usePlatformConfig } from "@/lib/useConfig";

export type ConfigFeatureName =
  | "instantPayout"
  | "cod"
  | "docUpload"
  | "gpsTracking"
  | "pushNotifications";

interface ConfigFeatureGateProps {
  feature: ConfigFeatureName;
  children: ReactNode;
  fallback?: ReactNode;
}

function resolveFeature(feature: ConfigFeatureName, config: ReturnType<typeof usePlatformConfig>["config"]): boolean {
  const rider = config.rider;
  switch (feature) {
    case "instantPayout":
      return rider?.instantPayoutEnabled ?? false;
    case "cod":
      return rider?.cashAllowed ?? true;
    case "docUpload":
      return rider?.docUploadEnabled ?? true;
    case "gpsTracking":
      return rider?.modules?.gpsTracking ?? true;
    case "pushNotifications":
      return rider?.pushNotificationsEnabled ?? true;
    default:
      return true;
  }
}

export function ConfigFeatureGate({ feature, children, fallback = null }: ConfigFeatureGateProps) {
  const { config } = usePlatformConfig();
  const enabled = resolveFeature(feature, config);
  if (!enabled) return <>{fallback}</>;
  return <>{children}</>;
}
