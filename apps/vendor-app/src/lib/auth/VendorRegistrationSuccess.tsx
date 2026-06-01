/**
 * VendorRegistrationSuccess.tsx — vendor-app
 *
 * Custom post-registration screen for vendors. Shows:
 *  - Success animation with store/owner name
 *  - Pending approval status badge (vendor blue theme)
 *  - Step-by-step next-steps checklist
 *  - "Go to Login" CTA button
 */
import { useEffect, useState } from "react";
import { vendorTheme } from "./theme";

const BG      = vendorTheme.background as string;   // #060A14
const SURFACE = vendorTheme.surface    as string;   // #0F1827
const ACCENT  = vendorTheme.primary    as string;   // #1A56DB
const TEXT    = vendorTheme.text       as string;   // #E2E8F4
const MUTED   = vendorTheme.textMuted  as string;   // #8B95A9
const BORDER  = vendorTheme.border     as string;   // #1E2A3F
const GREEN   = vendorTheme.success    as string;   // #22C55E

/* ── Pulse animation ring ───────────────────────────────────────────── */
function PulseRing() {
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const id = setInterval(() => setScale((s) => (s === 1 ? 1.2 : 1)), 900);
    return () => clearInterval(id);
  }, []);
  return (
    <div style={{
      position: "absolute", inset: -8,
      borderRadius: "50%",
      border: `2px solid ${ACCENT}`,
      opacity: scale === 1.2 ? 0 : 0.3,
      transform: `scale(${scale})`,
      transition: "transform 0.9s ease-out, opacity 0.9s ease-out",
      pointerEvents: "none",
    }} />
  );
}

/* ── Icons ──────────────────────────────────────────────────────────── */
const CheckIcon = ({ color = GREEN, size = 18 }: { color?: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const ClockIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke={ACCENT} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

const UploadIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </svg>
);

const StoreIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke={MUTED} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </svg>
);

/* ── Step row ───────────────────────────────────────────────────────── */
type StepState = "done" | "action" | "pending";
function Step({
  icon, label, sublabel, state, isLast,
}: {
  icon: React.ReactNode;
  label: string;
  sublabel: string;
  state: StepState;
  isLast?: boolean;
}) {
  const borderColor = state === "done" ? GREEN : state === "action" ? "#3B82F6" : BORDER;
  const bg = state === "done" ? `${GREEN}12` : state === "action" ? "#3B82F618" : `${BORDER}60`;

  return (
    <div style={{ display: "flex", gap: 14, position: "relative" }}>
      {!isLast && (
        <div style={{
          position: "absolute", left: 19, top: 42,
          width: 2, bottom: -8,
          background: state === "done" ? `${GREEN}40` : `${BORDER}80`,
        }} />
      )}
      <div style={{
        width: 40, height: 40, borderRadius: 12,
        border: `1.5px solid ${borderColor}`,
        background: bg,
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0,
      }}>
        {icon}
      </div>
      <div style={{ paddingTop: 8, flex: 1 }}>
        <p style={{ fontSize: 14, fontWeight: 700, color: TEXT, margin: "0 0 2px" }}>{label}</p>
        <p style={{ fontSize: 12, color: MUTED, margin: 0, lineHeight: 1.5 }}>{sublabel}</p>
      </div>
    </div>
  );
}

/* ── Main component ─────────────────────────────────────────────────── */
export interface VendorRegistrationSuccessProps {
  storeName?: string;
  ownerName?: string;
  city?: string;
  onGoToLogin: () => void;
}

export function VendorRegistrationSuccess({
  storeName,
  ownerName,
  city,
  onGoToLogin,
}: VendorRegistrationSuccessProps) {
  const displayName = storeName || ownerName?.split(" ")[0] || "Vendor";

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: BG,
      padding: "24px 16px",
      fontFamily: "Inter, system-ui, sans-serif",
    }}>
      <div style={{
        width: "100%",
        maxWidth: 440,
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}>

        {/* ── Hero Card ── */}
        <div style={{
          background: SURFACE,
          borderRadius: 20,
          padding: "36px 28px 28px",
          boxShadow: "0 8px 40px rgba(0,0,0,0.6)",
          border: `1px solid ${BORDER}`,
          textAlign: "center",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 16,
        }}>
          {/* Animated success icon */}
          <div style={{ position: "relative", width: 64, height: 64, marginBottom: 4 }}>
            <PulseRing />
            <div style={{
              width: 64, height: 64, borderRadius: "50%",
              background: `${GREEN}18`,
              border: `2px solid ${GREEN}`,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <CheckIcon color={GREEN} size={28} />
            </div>
          </div>

          {/* Title */}
          <div>
            <p style={{
              fontSize: 13, color: ACCENT, fontWeight: 700,
              margin: "0 0 6px", letterSpacing: "0.05em", textTransform: "uppercase",
            }}>
              Registration Complete
            </p>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: TEXT, margin: "0 0 8px", lineHeight: 1.2 }}>
              Welcome, {displayName}! 🎉
            </h1>
            <p style={{ fontSize: 14, color: MUTED, margin: 0, lineHeight: 1.6 }}>
              Your vendor store has been registered
              {city ? ` in ${city}` : ""}.
              {" "}Complete the steps below to start selling on AJKMart.
            </p>
          </div>

          {/* Status badge */}
          <div style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            background: `${ACCENT}18`,
            border: `1px solid ${ACCENT}50`,
            borderRadius: 24,
            padding: "8px 16px",
          }}>
            <ClockIcon size={15} />
            <span style={{ fontSize: 13, color: ACCENT, fontWeight: 700 }}>
              Pending Admin Approval
            </span>
          </div>
        </div>

        {/* ── Next Steps Card ── */}
        <div style={{
          background: SURFACE,
          borderRadius: 20,
          padding: "24px",
          border: `1px solid ${BORDER}`,
          boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
        }}>
          <p style={{
            fontSize: 11, fontWeight: 800, color: MUTED,
            textTransform: "uppercase", letterSpacing: "0.1em",
            margin: "0 0 20px",
          }}>
            Next Steps
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <Step
              icon={<CheckIcon color={GREEN} size={17} />}
              label="Store Registered"
              sublabel="Your vendor profile is ready — registration submitted successfully."
              state="done"
            />
            <Step
              icon={<UploadIcon size={17} />}
              label="Upload Verification Documents"
              sublabel="After login, go to Profile → Documents to upload your CNIC and store front photo for KYC."
              state="action"
            />
            <Step
              icon={<ClockIcon size={17} />}
              label="Wait for Approval"
              sublabel="Admin will review your store details within 24–48 hours. You'll be notified via SMS."
              state="pending"
            />
            <Step
              icon={<StoreIcon size={17} />}
              label="Start Selling"
              sublabel="Once approved, add your products and go live on AJKMart across AJK."
              state="pending"
              isLast
            />
          </div>
        </div>

        {/* ── Tip Card ── */}
        <div style={{
          background: `${ACCENT}0C`,
          borderRadius: 16,
          padding: "14px 18px",
          border: `1px solid ${ACCENT}28`,
          display: "flex",
          gap: 12,
          alignItems: "flex-start",
        }}>
          <span style={{ fontSize: 18, flexShrink: 0 }}>💡</span>
          <p style={{ fontSize: 12, color: MUTED, margin: 0, lineHeight: 1.6 }}>
            <strong style={{ color: TEXT }}>Tip:</strong> Make sure your CNIC documents are clear and readable — blurry photos are the most common reason for delayed approvals.
          </p>
        </div>

        {/* ── CTA ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10, paddingBottom: 8 }}>
          <button
            onClick={onGoToLogin}
            style={{
              width: "100%",
              padding: "15px",
              borderRadius: 14,
              border: "none",
              background: ACCENT,
              color: "#ffffff",
              fontWeight: 800,
              fontSize: 16,
              cursor: "pointer",
              letterSpacing: "0.01em",
              transition: "filter 0.15s",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.filter = "brightness(1.12)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.filter = ""; }}
          >
            Go to Login →
          </button>

          <p style={{ textAlign: "center", fontSize: 12, color: MUTED, margin: 0 }}>
            Upload documents from your dashboard after logging in
          </p>
        </div>

      </div>
    </div>
  );
}
