import React, { useState } from "react";
import { useAuthTheme } from "../context/ThemeContext";

function OverlayShell({ children }: { children: React.ReactNode }) {
  const theme = useAuthTheme();
  return (
    <div
      style={{
        minHeight: "100vh",
        background: theme.background,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        paddingTop: "env(safe-area-inset-top, 0px)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: "25%",
          width: 384,
          height: 384,
          borderRadius: "50%",
          pointerEvents: "none",
          background: `radial-gradient(circle, ${theme.primary}18 0%, transparent 70%)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: 0,
          right: "25%",
          width: 320,
          height: 320,
          borderRadius: "50%",
          pointerEvents: "none",
          background: `radial-gradient(circle, ${theme.primary}0d 0%, transparent 70%)`,
        }}
      />
      <div style={{ position: "relative", zIndex: 10, width: "100%", maxWidth: 400 }}>
        {children}
      </div>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  const theme = useAuthTheme();
  return (
    <div
      style={{
        background: theme.surface,
        border: `1px solid ${theme.border}`,
        borderRadius: 20,
        padding: "32px 28px",
        boxShadow: `0 8px 48px ${theme.primary}10`,
      }}
    >
      {children}
    </div>
  );
}

function IconCircle({
  color,
  bg,
  children,
}: {
  color: string;
  bg: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        width: 68,
        height: 68,
        borderRadius: 18,
        background: bg,
        border: `2px solid ${color}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        margin: "0 auto 20px",
      }}
    >
      {children}
    </div>
  );
}

/* ── PendingOverlay ─────────────────────────────────────────────────────── */

export interface PendingOverlayProps {
  onCheckStatus: () => Promise<void>;
  onSignOut: () => void;
  supportPhone?: string;
  checking?: boolean;
}

export function PendingOverlay({
  onCheckStatus,
  onSignOut,
  supportPhone,
  checking = false,
}: PendingOverlayProps) {
  const theme = useAuthTheme();
  return (
    <OverlayShell>
      <Card>
        <div style={{ textAlign: "center" }}>
          <IconCircle color={`${theme.primary}50`} bg={`${theme.primary}15`}>
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke={theme.primary}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </IconCircle>

          <h2
            style={{ color: theme.text, fontSize: 20, fontWeight: 800, margin: "0 0 10px" }}
          >
            Application Under Review
          </h2>
          <p
            style={{ color: theme.textMuted, fontSize: 14, lineHeight: 1.65, margin: "0 0 20px" }}
          >
            Your application is being reviewed by our team. You'll receive a notification once
            approved.
          </p>

          <div
            style={{
              background: `${theme.primary}12`,
              border: `1px solid ${theme.primary}30`,
              borderRadius: 12,
              padding: "10px 16px",
              marginBottom: 20,
            }}
          >
            <p style={{ color: theme.primary, fontSize: 13, fontWeight: 600, margin: 0 }}>
              ⏱ Typical review time: 24–48 hours
            </p>
          </div>

          {supportPhone && (
            <p style={{ color: theme.textMuted, fontSize: 13, marginBottom: 16 }}>
              Questions?{" "}
              <a
                href={`tel:${supportPhone}`}
                style={{ color: theme.primary, fontWeight: 600, textDecoration: "none" }}
              >
                {supportPhone}
              </a>
            </p>
          )}

          <button
            onClick={onCheckStatus}
            disabled={checking}
            style={{
              width: "100%",
              padding: "12px 20px",
              borderRadius: 12,
              border: "none",
              background: checking
                ? `${theme.primary}60`
                : `linear-gradient(135deg, ${theme.primary}, ${theme.primaryDark})`,
              color: theme.onPrimary,
              fontSize: 15,
              fontWeight: 700,
              cursor: checking ? "not-allowed" : "pointer",
              marginBottom: 10,
              opacity: checking ? 0.7 : 1,
            }}
          >
            {checking ? "Checking…" : "Check Status"}
          </button>

          <button
            onClick={onSignOut}
            style={{
              width: "100%",
              padding: "11px 20px",
              borderRadius: 12,
              border: `1px solid ${theme.border}`,
              background: "transparent",
              color: theme.textMuted,
              fontSize: 14,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Sign Out
          </button>
        </div>
      </Card>
    </OverlayShell>
  );
}

/* ── RejectedOverlay ────────────────────────────────────────────────────── */

export interface RejectedOverlayProps {
  rejectionReason?: string;
  onSignOut: () => void;
  onContactSupport?: () => void;
  supportPhone?: string;
}

export function RejectedOverlay({
  rejectionReason,
  onSignOut,
  onContactSupport,
  supportPhone,
}: RejectedOverlayProps) {
  const theme = useAuthTheme();
  return (
    <OverlayShell>
      <Card>
        <div style={{ textAlign: "center" }}>
          <IconCircle color={theme.errorBorder} bg={theme.errorBackground}>
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke={theme.error}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          </IconCircle>

          <h2
            style={{ color: theme.text, fontSize: 20, fontWeight: 800, margin: "0 0 10px" }}
          >
            Application Not Approved
          </h2>
          <p
            style={{ color: theme.textMuted, fontSize: 14, lineHeight: 1.65, margin: "0 0 16px" }}
          >
            We're unable to approve your application at this time.
          </p>

          {rejectionReason && (
            <div
              style={{
                background: theme.errorBackground,
                border: `1px solid ${theme.errorBorder}`,
                borderRadius: 10,
                padding: "10px 14px",
                marginBottom: 20,
                textAlign: "left",
              }}
            >
              <p
                style={{ color: theme.error, fontSize: 13, lineHeight: 1.5, margin: 0 }}
              >
                {rejectionReason}
              </p>
            </div>
          )}

          {(onContactSupport || supportPhone) && (
            <button
              onClick={
                onContactSupport ??
                (supportPhone ? () => window.open(`tel:${supportPhone}`) : undefined)
              }
              style={{
                width: "100%",
                padding: "12px 20px",
                borderRadius: 12,
                border: `1px solid ${theme.errorBorder}`,
                background: theme.errorBackground,
                color: theme.error,
                fontSize: 15,
                fontWeight: 700,
                cursor: "pointer",
                marginBottom: 10,
              }}
            >
              Contact Support
            </button>
          )}

          <button
            onClick={onSignOut}
            style={{
              width: "100%",
              padding: "11px 20px",
              borderRadius: 12,
              border: `1px solid ${theme.border}`,
              background: "transparent",
              color: theme.textMuted,
              fontSize: 14,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Sign Out
          </button>
        </div>
      </Card>
    </OverlayShell>
  );
}

/* ── MaintenanceOverlay ─────────────────────────────────────────────────── */

export interface MaintenanceOverlayProps {
  message?: string;
  estimatedEnd?: string;
  onRetry?: () => void;
}

export function MaintenanceOverlay({ message, estimatedEnd, onRetry }: MaintenanceOverlayProps) {
  const theme = useAuthTheme();
  return (
    <OverlayShell>
      <Card>
        <div style={{ textAlign: "center" }}>
          <IconCircle color={`${theme.primary}50`} bg={`${theme.primary}15`}>
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke={theme.primary}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
            </svg>
          </IconCircle>

          <h2
            style={{ color: theme.text, fontSize: 20, fontWeight: 800, margin: "0 0 10px" }}
          >
            Under Maintenance
          </h2>
          <p
            style={{ color: theme.textMuted, fontSize: 14, lineHeight: 1.65, margin: "0 0 20px" }}
          >
            {message ?? "We're making improvements to serve you better. We'll be back shortly!"}
          </p>

          {estimatedEnd && (
            <div
              style={{
                background: `${theme.primary}12`,
                border: `1px solid ${theme.primary}30`,
                borderRadius: 12,
                padding: "10px 16px",
                marginBottom: 20,
              }}
            >
              <p style={{ color: theme.primary, fontSize: 13, fontWeight: 600, margin: 0 }}>
                Estimated completion: {estimatedEnd}
              </p>
            </div>
          )}

          {onRetry && (
            <button
              onClick={onRetry}
              style={{
                width: "100%",
                padding: "12px 20px",
                borderRadius: 12,
                border: "none",
                background: `linear-gradient(135deg, ${theme.primary}, ${theme.primaryDark})`,
                color: theme.onPrimary,
                fontSize: 15,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Try Again
            </button>
          )}
        </div>
      </Card>
    </OverlayShell>
  );
}

/* ── BiometricEnrollOverlay ─────────────────────────────────────────────── */

export interface BiometricEnrollOverlayProps {
  onEnroll: () => Promise<void>;
  onSkip: () => void;
  enrolling?: boolean;
}

export function BiometricEnrollOverlay({
  onEnroll,
  onSkip,
  enrolling = false,
}: BiometricEnrollOverlayProps) {
  const theme = useAuthTheme();
  const [loading, setLoading] = useState(false);
  const isLoading = enrolling || loading;

  async function handleEnroll() {
    setLoading(true);
    try {
      await onEnroll();
    } finally {
      setLoading(false);
    }
  }

  return (
    <OverlayShell>
      <Card>
        <div style={{ textAlign: "center" }}>
          <IconCircle color={`${theme.primary}50`} bg={`${theme.primary}15`}>
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke={theme.primary}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 10a2 2 0 0 0-2 2c0 1.02.5 1.96 1.34 2.53a.5.5 0 0 1 .16.58L10.5 18h3l-1-2.89a.5.5 0 0 1 .16-.58A2.5 2.5 0 0 0 14 12a2 2 0 0 0-2-2z" />
              <path d="M12 4C9.38 4 6 5.55 6 9v3a6 6 0 0 0 12 0V9c0-3.45-3.38-5-6-5z" />
            </svg>
          </IconCircle>

          <h2
            style={{ color: theme.text, fontSize: 20, fontWeight: 800, margin: "0 0 10px" }}
          >
            Enable Biometric Login?
          </h2>
          <p
            style={{ color: theme.textMuted, fontSize: 14, lineHeight: 1.65, margin: "0 0 24px" }}
          >
            Sign in faster next time with your fingerprint or face scan — no password needed.
          </p>

          <button
            onClick={handleEnroll}
            disabled={isLoading}
            style={{
              width: "100%",
              padding: "12px 20px",
              borderRadius: 12,
              border: "none",
              background: isLoading
                ? `${theme.primary}60`
                : `linear-gradient(135deg, ${theme.primary}, ${theme.primaryDark})`,
              color: theme.onPrimary,
              fontSize: 15,
              fontWeight: 700,
              cursor: isLoading ? "not-allowed" : "pointer",
              marginBottom: 10,
              opacity: isLoading ? 0.7 : 1,
            }}
          >
            {isLoading ? "Setting up…" : "Enable Biometrics"}
          </button>

          <button
            onClick={onSkip}
            disabled={isLoading}
            style={{
              width: "100%",
              padding: "11px 20px",
              borderRadius: 12,
              border: `1px solid ${theme.border}`,
              background: "transparent",
              color: theme.textMuted,
              fontSize: 14,
              fontWeight: 500,
              cursor: isLoading ? "not-allowed" : "pointer",
            }}
          >
            Skip for now
          </button>
        </div>
      </Card>
    </OverlayShell>
  );
}
