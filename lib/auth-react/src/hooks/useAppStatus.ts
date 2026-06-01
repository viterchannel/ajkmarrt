import { useCallback } from "react";

export interface UserStatus {
  status: string;
  rejectionReason?: string | null;
}

export interface AppStatus {
  maintenance: boolean;
  maintenanceMsg?: string;
  supportPhone?: string;
  supportEmail?: string;
  isLoading: boolean;
  checkUserStatus: () => Promise<{ status: string; rejectionReason?: string | null }>;
}

export interface UseAppStatusOptions {
  platformConfig: {
    appStatus?: string;
    supportPhone?: string;
    supportEmail?: string;
    maintenanceMessage?: string;
  };
  platformConfigLoading?: boolean;
  getMe: () => Promise<{
    approvalStatus?: string;
    rejectionReason?: string | null;
  }>;
}

export function useAppStatus(opts: UseAppStatusOptions): AppStatus {
  const { platformConfig, platformConfigLoading = false, getMe } = opts;

  const checkUserStatus = useCallback(async (): Promise<{
    status: string;
    rejectionReason?: string | null;
  }> => {
    try {
      const me = await getMe();
      return {
        status: me.approvalStatus ?? "approved",
        rejectionReason: me.rejectionReason,
      };
    } catch {
      return { status: "unknown" };
    }
  }, [getMe]);

  return {
    maintenance: platformConfig.appStatus === "maintenance",
    maintenanceMsg: platformConfig.maintenanceMessage,
    supportPhone: platformConfig.supportPhone,
    supportEmail: platformConfig.supportEmail,
    isLoading: platformConfigLoading,
    checkUserStatus,
  };
}
