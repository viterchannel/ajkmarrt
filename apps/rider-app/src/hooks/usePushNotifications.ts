import { useEffect, useRef, useState } from "react";
import type { PushErrorReason } from "../lib/push";
import { registerPush } from "../lib/push";

type PermissionState = "default" | "granted" | "denied" | "unsupported";

export interface PushNotificationState {
  permission: PermissionState;
  isSubscribed: boolean;
  isDismissed: boolean;
  pushError: PushErrorReason | null;
  requestPermission: () => Promise<void>;
  dismiss: () => void;
}

const DISMISSED_KEY = "rider_push_banner_dismissed";
const SUBSCRIBED_KEY = "rider_push_subscribed";

export function usePushNotifications(): PushNotificationState {
  const [permission, setPermission] = useState<PermissionState>(() => {
    if (typeof Notification === "undefined") return "unsupported";
    if (!("PushManager" in window)) return "unsupported";
    return (Notification.permission as PermissionState) ?? "default";
  });

  const [isSubscribed, setIsSubscribed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(SUBSCRIBED_KEY) === "1";
    } catch {
      return false;
    }
  });

  const [isDismissed, setIsDismissed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(DISMISSED_KEY) === "1";
    } catch {
      return false;
    }
  });

  const [pushError, setPushError] = useState<PushErrorReason | null>(null);

  const registerAttempted = useRef(false);

  useEffect(() => {
    if (typeof Notification === "undefined" || !("PushManager" in window)) return;
    if (Notification.permission === "granted" && !registerAttempted.current) {
      registerAttempted.current = true;
      let hadError = false;
      registerPush(undefined, undefined, (reason) => {
        hadError = true;
        setPushError(reason);
      }).then(() => {
        if (!hadError) {
          setIsSubscribed(true);
          setPushError(null);
          try {
            localStorage.setItem(SUBSCRIBED_KEY, "1");
          } catch { /* ignore */ }
        }
      }).catch((err: unknown) => {
        hadError = true;
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("permission") || msg.includes("denied")) {
          setPushError("permission_denied");
        } else {
          setPushError("registration_failed");
        }
      });
    }
  }, []);

  const requestPermission = async (): Promise<void> => {
    if (typeof Notification === "undefined" || !("PushManager" in window)) return;
    try {
      const result = await Notification.requestPermission();
      setPermission(result as PermissionState);
      if (result === "granted") {
        registerAttempted.current = true;
        let hadError = false;
        await registerPush(undefined, undefined, (reason) => {
          hadError = true;
          setPushError(reason);
        });
        if (!hadError) {
          setIsSubscribed(true);
          setPushError(null);
          try {
            localStorage.setItem(SUBSCRIBED_KEY, "1");
          } catch { /* ignore */ }
        }
      } else if (result === "denied") {
        setPushError("permission_denied");
        setIsDismissed(true);
        try {
          localStorage.setItem(DISMISSED_KEY, "1");
        } catch { /* ignore */ }
      }
    } catch {
      setPushError("registration_failed");
    }
  };

  const dismiss = (): void => {
    setIsDismissed(true);
    try {
      localStorage.setItem(DISMISSED_KEY, "1");
    } catch { /* ignore */ }
  };

  return { permission, isSubscribed, isDismissed, pushError, requestPermission, dismiss };
}
