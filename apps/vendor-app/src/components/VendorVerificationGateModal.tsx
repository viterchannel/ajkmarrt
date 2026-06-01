import { useLocation } from "wouter";

const verificationConfig: Record<
  string,
  { label: string; actionLabel: string; path: string }
> = {
  documents_approved: {
    label: "Documents approved by admin",
    actionLabel: "Upload Documents",
    path: "/profile?section=documents",
  },
  documentsApproved: {
    label: "Documents approved by admin",
    actionLabel: "Upload Documents",
    path: "/profile?section=documents",
  },
  documents: {
    label: "KYC documents submitted",
    actionLabel: "Upload Documents",
    path: "/profile?section=documents",
  },
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
  cnic: {
    label: "CNIC number provided",
    actionLabel: "Go to Profile",
    path: "/profile",
  },
};

export function VendorVerificationGateModal({
  missingVerifications,
  message,
  onClose,
}: {
  missingVerifications: string[];
  message?: string;
  onClose: () => void;
}) {
  const [, navigate] = useLocation();

  const items = (missingVerifications.length > 0 ? missingVerifications : ["documents_approved"]).map(
    (v) =>
      verificationConfig[v] ?? {
        label: v.replace(/_/g, " "),
        actionLabel: "Go to Profile",
        path: "/profile",
      }
  );

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.55)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        zIndex: 9990,
        padding: "0 0 env(safe-area-inset-bottom, 0)",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#ffffff",
          borderRadius: "20px 20px 0 0",
          padding: "28px 24px 32px",
          width: "100%",
          maxWidth: 440,
          boxShadow: "0 -8px 40px rgba(0,0,0,0.12)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 16,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 11,
                background: "rgba(249,115,22,0.10)",
                border: "1px solid rgba(249,115,22,0.22)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#f97316"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </div>
            <div>
              <h3
                style={{
                  color: "#111827",
                  fontSize: 15,
                  fontWeight: 700,
                  margin: 0,
                }}
              >
                Verification Required
              </h3>
              <p style={{ color: "#9ca3af", fontSize: 11, margin: 0 }}>
                Complete these steps to continue
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 30,
              height: 30,
              borderRadius: "50%",
              background: "#f3f4f6",
              border: "none",
              color: "#6b7280",
              fontSize: 14,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {message && (
          <p
            style={{
              color: "#6b7280",
              fontSize: 13,
              marginBottom: 14,
              lineHeight: 1.5,
            }}
          >
            {message}
          </p>
        )}

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 10,
            marginBottom: 20,
          }}
        >
          {items.map((item, i) => (
            <div
              key={i}
              style={{
                borderRadius: 14,
                background: "rgba(249,115,22,0.05)",
                border: "1px solid rgba(249,115,22,0.18)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 14px",
                }}
              >
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: "#f97316",
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    color: "#ea580c",
                    fontSize: 13,
                    fontWeight: 600,
                    flex: 1,
                  }}
                >
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
                  padding: "9px 14px",
                  background: "rgba(249,115,22,0.10)",
                  border: "none",
                  borderTop: "1px solid rgba(249,115,22,0.12)",
                  color: "#f97316",
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

        <button
          onClick={onClose}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "100%",
            height: 44,
            borderRadius: 12,
            border: "1px solid #e5e7eb",
            background: "#f9fafb",
            color: "#6b7280",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
