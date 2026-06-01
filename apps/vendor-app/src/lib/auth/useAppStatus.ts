import { useAppStatus as _useAppStatus } from "@workspace/auth-react";
import { api } from "../api";
import { usePlatformConfig } from "../useConfig";

export type { AppStatus } from "@workspace/auth-react";

export function useAppStatus() {
  const { config, isLoading } = usePlatformConfig();
  return _useAppStatus({
    platformConfig: {
      ...config.platform,
      maintenanceMessage: config.content?.maintenanceMsg,
    },
    platformConfigLoading: isLoading,
    getMe: api.getMe,
  });
}
