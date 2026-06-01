import { Bell, X } from "lucide-react";
import type { CSSProperties } from "react";
import { usePushNotifications } from "../hooks/usePushNotifications";

export function PushPermissionBanner() {
  const { permission, isSubscribed, isDismissed, pushError, requestPermission, dismiss } =
    usePushNotifications();

  if (permission === "unsupported") return null;
  if (permission === "granted" && isSubscribed && !pushError) return null;
  if (permission === "denied" || isDismissed) return null;

  if (pushError) {
    const errorMessages: Record<typeof pushError, string> = {
      permission_denied: "Notification permission was denied. Enable it in browser settings.",
      registration_failed: "Could not register for notifications. Tap to retry.",
      network_error: "Network error — push notifications may be unavailable.",
    };

    return (
      <div style={styles.wrapper}>
        <div style={styles.banner}>
          <div style={styles.left}>
            <div style={{ ...styles.iconBox, background: "rgba(239,68,68,0.2)" }}>
              <Bell size={20} className="text-error" />
            </div>
            <div>
              <div style={styles.title}>Notifications Unavailable</div>
              <div style={styles.subtitle}>{errorMessages[pushError]}</div>
            </div>
          </div>
          <div style={styles.actions}>
            {pushError !== "permission_denied" && (
              <button style={styles.allowBtn} onClick={requestPermission}>
                Retry
              </button>
            )}
            <button style={styles.closeBtn} onClick={dismiss} aria-label="Dismiss">
              ✕
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.wrapper}>
      <div style={styles.banner}>
        <div style={styles.left}>
          <div style={styles.iconBox}>
            <span style={{ fontSize: 20 }}>🔔</span>
          </div>
          <div>
            <div style={styles.title}>Enable Ride Alerts</div>
            <div style={styles.subtitle}>Get instant alerts for new ride requests</div>
          </div>
        </div>
        <div style={styles.actions}>
          <button style={styles.allowBtn} onClick={requestPermission}>
            Allow
          </button>
          <button style={styles.closeBtn} onClick={dismiss} aria-label="Dismiss">
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  wrapper: {
    position: "fixed",
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 9998,
    padding: "12px 16px",
    background: "linear-gradient(135deg, #0f1923 0%, #1a2535 100%)",
    borderTop: "1px solid rgba(240,185,11,0.25)",
    boxShadow: "0 -4px 20px rgba(0,0,0,0.4)",
  },
  banner: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    maxWidth: 600,
    margin: "0 auto",
  },
  left: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    flex: 1,
    minWidth: 0,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    background: "rgba(240,185,11,0.15)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  title: {
    fontFamily: "Inter, sans-serif",
    fontWeight: 700,
    fontSize: 14,
    color: "#f9fafb",
    marginBottom: 2,
  },
  subtitle: {
    fontFamily: "Inter, sans-serif",
    fontSize: 12,
    color: "rgba(255,255,255,0.55)",
  },
  actions: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexShrink: 0,
  },
  allowBtn: {
    background: "var(--color-brand)",
    color: "var(--color-surface)",
    border: "none",
    borderRadius: 10,
    padding: "8px 18px",
    fontFamily: "Inter, sans-serif",
    fontWeight: 700,
    fontSize: 13,
    cursor: "pointer",
    whiteSpace: "nowrap" as const,
  },
  closeBtn: {
    background: "transparent",
    color: "rgba(255,255,255,0.4)",
    border: "none",
    padding: "6px 8px",
    cursor: "pointer",
    fontSize: 14,
    fontFamily: "Inter, sans-serif",
  },
};
