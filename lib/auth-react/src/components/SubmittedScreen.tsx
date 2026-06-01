import { useAuthTheme } from "../context/ThemeContext";

export interface SubmittedScreenProps {
  onGoToLogin: () => void;
  message?: string;
}

export function SubmittedScreen({ onGoToLogin, message }: SubmittedScreenProps) {
  const theme = useAuthTheme();
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: theme.background,
        padding: "24px 16px",
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          background: theme.surface,
          borderRadius: 20,
          padding: "40px 28px",
          boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 20,
          textAlign: "center",
        }}
      >
        <div style={{ display: "flex", justifyContent: "center" }}>
          <svg
            width="56"
            height="56"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#22C55E"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <polyline points="9 12 11 14 15 10" />
          </svg>
        </div>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: theme.text, margin: "0 0 8px" }}>
            Application Submitted!
          </h2>
          <p style={{ fontSize: 14, color: theme.textMuted, margin: 0, lineHeight: 1.6 }}>
            {message ??
              "Our team will review your details within 24–48 hours. You'll receive an SMS once your account is approved and ready to use."}
          </p>
        </div>
        <div
          style={{
            background: `${theme.primary}18`,
            border: `1px solid ${theme.primary}40`,
            borderRadius: 12,
            padding: "12px 16px",
            width: "100%",
          }}
        >
          <p
            style={{
              fontSize: 13,
              color: theme.textMuted,
              margin: 0,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              style={{ flexShrink: 0 }}
            >
              <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
              <line x1="12" y1="18" x2="12.01" y2="18" />
            </svg>
            Keep an eye on your registered phone number for status updates.
          </p>
        </div>
        <button
          onClick={onGoToLogin}
          style={{
            width: "100%",
            padding: "14px",
            borderRadius: 12,
            border: "none",
            background: theme.primary,
            color: theme.onPrimary ?? theme.background,
            fontWeight: 700,
            fontSize: 15,
            cursor: "pointer",
            marginTop: 4,
            transition: "opacity 0.15s, filter 0.15s",
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.filter = "brightness(1.1)"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.filter = ""; }}
        >
          Go to Sign In
        </button>
      </div>
    </div>
  );
}
