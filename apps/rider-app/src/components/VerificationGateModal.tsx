import { useLocation } from "wouter";

export function VerificationGateModal({
  missingVerifications,
  message,
  onClose,
  dismissible = true,
}: {
  missingVerifications: string[];
  message?: string;
  onClose: () => void;
  dismissible?: boolean;
}) {
  const [, navigate] = useLocation();

  const verificationConfig: Record<
    string,
    { label: string; actionLabel: string; path: string }
  > = {
    phone_verified: {
      label: "Phone number verified",
      actionLabel: "Verify Phone",
      path: "/profile",
    },
    phone: {
      label: "Phone number verified",
      actionLabel: "Verify Phone",
      path: "/profile",
    },
    email_verified: {
      label: "Email address verified",
      actionLabel: "Verify Email",
      path: "/profile",
    },
    email: {
      label: "Email address verified",
      actionLabel: "Verify Email",
      path: "/profile",
    },
    documents_approved: {
      label: "CNIC documents approved",
      actionLabel: "Upload Documents",
      path: "/profile?section=documents",
    },
    documents: {
      label: "CNIC documents submitted",
      actionLabel: "Upload Documents",
      path: "/profile?section=documents",
    },
    documentsApproved: {
      label: "CNIC documents approved",
      actionLabel: "Upload Documents",
      path: "/profile?section=documents",
    },
    cnic: {
      label: "CNIC number provided",
      actionLabel: "Go to Profile",
      path: "/profile",
    },
  };

  const items = (missingVerifications.length > 0 ? missingVerifications : ["phone_verified"]).map(
    (v) =>
      verificationConfig[v] ?? {
        label: v.replace(/_/g, " "),
        actionLabel: "Go to Profile",
        path: "/profile",
      }
  );

  const handleOverlayClick = () => {
    if (dismissible) onClose();
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(11,14,17,0.92)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        zIndex: 9990,
        padding: "0 0 env(safe-area-inset-bottom, 0)",
      }}
      onClick={handleOverlayClick}
    >
      <div
        style={{
          background: "var(--color-card-dark)",
          border: "1px solid var(--color-border-dark)",
          borderRadius: "20px 20px 0 0",
          padding: "28px 24px 32px",
          width: "100%",
          maxWidth: 440,
          boxShadow: "0 -8px 40px rgba(0,0,0,0.6)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.25)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </div>
            <div>
              <h3 style={{ color: "#E8E9EF", fontSize: 15, fontWeight: 700, margin: 0 }}>Verification Required</h3>
              <p style={{ color: "#6B7280", fontSize: 11, margin: 0 }}>Complete these steps to continue</p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(255,255,255,0.08)", border: "none", color: "#9CA3AF", fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {message && (
          <p style={{ color: "#9CA3AF", fontSize: 13, marginBottom: 14, lineHeight: 1.5 }}>{message}</p>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
          {items.map((item, i) => (
            <div
              key={i}
              style={{
                borderRadius: 14,
                background: "rgba(239,68,68,0.06)",
                border: "1px solid rgba(239,68,68,0.16)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 12px",
                }}
              >
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#ef4444", flexShrink: 0 }} />
                <span style={{ color: "#FCA5A5", fontSize: 13, fontWeight: 600, flex: 1 }}>
                  {item.label}
                </span>
              </div>
              <button
                onClick={() => {
                  onClose();
                  navigate(item.path);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  width: "100%",
                  padding: "9px 12px",
                  background: "rgba(239,68,68,0.12)",
                  border: "none",
                  borderTop: "1px solid rgba(239,68,68,0.12)",
                  color: "#F87171",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                  letterSpacing: "0.02em",
                }}
              >
                {item.actionLabel} →
              </button>
            </div>
          ))}
        </div>

        {dismissible && (
          <button
            onClick={onClose}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "100%",
              height: 44,
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.08)",
              background: "rgba(255,255,255,0.04)",
              color: "#6B7280",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Dismiss
          </button>
        )}
      </div>
    </div>
  );
}
