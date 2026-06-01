import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
  type KeyboardEvent,
} from "react";
import { useAuthTheme } from "../context/ThemeContext";

export interface OtpInputProps {
  length?: number;
  onComplete: (code: string) => void;
  onResend?: () => void | Promise<void>;
  resendCooldown?: number;
  autoSubmit?: boolean;
  disabled?: boolean;
  error?: string | null;
  label?: string;
  channel?: "sms" | "whatsapp" | "email";
  isLoading?: boolean;
  className?: string;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = hex.replace("#", "").match(/^([a-f0-9]{2})([a-f0-9]{2})([a-f0-9]{2})$/i);
  if (!m) return null;
  return { r: parseInt(m[1]!, 16), g: parseInt(m[2]!, 16), b: parseInt(m[3]!, 16) };
}

// ─── Channel icon SVGs ───────────────────────────────────────────────────────

function SmsIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function WhatsAppIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="#22c55e" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
      <path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.122 1.533 5.856L0 24l6.335-1.509A11.936 11.936 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.818 9.818 0 0 1-4.958-1.342l-.356-.212-3.688.878.938-3.569-.232-.369A9.818 9.818 0 0 1 2.182 12C2.182 6.568 6.568 2.182 12 2.182c5.432 0 9.818 4.386 9.818 9.818 0 5.432-4.386 9.818-9.818 9.818z" />
    </svg>
  );
}

function EmailIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22,6 12,13 2,6" />
    </svg>
  );
}

function SpinnerIcon({ color }: { color?: string }) {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke={color ?? "currentColor"}
      strokeWidth="2.5"
      strokeLinecap="round"
      aria-hidden="true"
      style={{ animation: "otp-spin 0.7s linear infinite" }}
    >
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  );
}

// ─── OtpTimer (standalone export) ────────────────────────────────────────────

export interface OtpTimerProps {
  seconds: number;
  onExpire?: () => void;
  prefix?: string;
  className?: string;
}

export function OtpTimer({ seconds, onExpire, prefix = "Resend in ", className }: OtpTimerProps) {
  const [remaining, setRemaining] = useState(seconds);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setRemaining(seconds);
    timerRef.current = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          clearInterval(timerRef.current!);
          onExpire?.();
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [seconds, onExpire]);

  if (remaining <= 0) return null;
  const m = Math.floor(remaining / 60);
  const s = remaining % 60;
  const display = m > 0 ? `${m}:${String(s).padStart(2, "0")}` : `${s}s`;
  const timerTheme = useAuthTheme();

  return (
    <span className={className} style={{ fontSize: "13px", color: timerTheme.textMuted }}>
      {prefix}
      {display}
    </span>
  );
}

// ─── OtpInput ────────────────────────────────────────────────────────────────

const CHANNEL_LABELS: Record<NonNullable<OtpInputProps["channel"]>, string> = {
  sms: "Sent via SMS",
  whatsapp: "Sent via WhatsApp",
  email: "Sent via Email",
};

const SHAKE_KEYFRAMES = `
@keyframes otp-shake {
  0%,100%{transform:translateX(0)}
  15%{transform:translateX(-6px)}
  30%{transform:translateX(6px)}
  45%{transform:translateX(-4px)}
  60%{transform:translateX(4px)}
  75%{transform:translateX(-2px)}
  90%{transform:translateX(2px)}
}
@keyframes otp-spin {
  from{transform:rotate(0deg)}
  to{transform:rotate(360deg)}
}
`;

export function OtpInput({
  length = 6,
  onComplete,
  onResend,
  resendCooldown = 60,
  autoSubmit = true,
  disabled = false,
  error = null,
  label,
  channel,
  isLoading = false,
  className,
}: OtpInputProps) {
  const [values, setValues] = useState<string[]>(Array(length).fill(""));
  const [focusedIdx, setFocusedIdx] = useState<number | null>(null);
  const [cooldown, setCooldown] = useState(onResend ? resendCooldown : 0);
  const [isResending, setIsResending] = useState(false);
  const [shaking, setShaking] = useState(false);
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const completedRef = useRef(false);
  const labelId = useRef(`otp-label-${Math.random().toString(36).slice(2)}`).current;

  // Inject keyframe styles once
  useEffect(() => {
    const id = "otp-input-styles";
    if (!document.getElementById(id)) {
      const style = document.createElement("style");
      style.id = id;
      style.textContent = SHAKE_KEYFRAMES;
      document.head.appendChild(style);
    }
  }, []);

  // Auto-focus first box on mount
  useEffect(() => {
    refs.current[0]?.focus();
  }, []);

  // Start initial cooldown
  useEffect(() => {
    if (onResend && resendCooldown > 0) startCooldown(resendCooldown);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Shake on error
  useEffect(() => {
    if (!error) return;
    setShaking(true);
    completedRef.current = false;
    const t = setTimeout(() => setShaking(false), 500);
    return () => clearTimeout(t);
  }, [error]);

  function startCooldown(secs: number) {
    setCooldown(secs);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCooldown((c) => {
        if (c <= 1) {
          clearInterval(timerRef.current!);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  }

  const notifyIfComplete = useCallback(
    (next: string[]) => {
      const otp = next.join("");
      if (otp.length === length && next.every((v) => v !== "")) {
        if (autoSubmit && !completedRef.current) {
          completedRef.current = true;
          onComplete(otp);
        }
      }
    },
    [length, autoSubmit, onComplete]
  );

  function handleManualSubmit() {
    const otp = values.join("");
    if (otp.length === length && values.every((v) => v !== "")) {
      onComplete(otp);
    }
  }

  function handleChange(idx: number, e: ChangeEvent<HTMLInputElement>) {
    const char = e.target.value.replace(/\D/g, "").slice(-1);
    const next = [...values];
    next[idx] = char;
    setValues(next);
    if (char && idx < length - 1) refs.current[idx + 1]?.focus();
    notifyIfComplete(next);
  }

  function handleKeyDown(idx: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace") {
      const next = [...values];
      if (next[idx]) {
        next[idx] = "";
        setValues(next);
        completedRef.current = false;
      } else if (idx > 0) {
        next[idx - 1] = "";
        setValues(next);
        refs.current[idx - 1]?.focus();
        completedRef.current = false;
      }
    } else if (e.key === "ArrowLeft" && idx > 0) {
      refs.current[idx - 1]?.focus();
    } else if (e.key === "ArrowRight" && idx < length - 1) {
      refs.current[idx + 1]?.focus();
    }
  }

  function handlePaste(e: ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
    const next = Array(length).fill("");
    text.split("").forEach((ch, i) => {
      next[i] = ch;
    });
    completedRef.current = false;
    setValues(next);
    refs.current[Math.min(text.length, length - 1)]?.focus();
    notifyIfComplete(next);
  }

  async function handleResend() {
    if (cooldown > 0 || !onResend || isResending) return;
    setIsResending(true);
    try {
      await onResend();
    } finally {
      setIsResending(false);
    }
    const cleared = Array(length).fill("");
    setValues(cleared);
    completedRef.current = false;
    refs.current[0]?.focus();
    startCooldown(resendCooldown);
  }

  const allFilled = values.every((v) => v !== "");
  const theme = useAuthTheme();
  const accentColor = theme.primary;
  const accentRgb = hexToRgb(accentColor) ?? { r: 245, g: 158, b: 11 };
  const errorColor = "#ef4444";

  const is4digit = length <= 4;
  const boxW = is4digit ? 56 : 48;
  const boxH = is4digit ? 64 : 56;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "16px",
        position: "relative",
      }}
      className={className}
    >
      {/* Label + channel indicator */}
      {(label || channel) && (
        <div style={{ display: "flex", alignItems: "center", gap: "6px", flexDirection: "column" }}>
          {label && (
            <p
              id={labelId}
              style={{
                margin: 0,
                fontSize: "14px",
                color: theme.text,
                textAlign: "center",
                fontWeight: 500,
              }}
            >
              {label}
            </p>
          )}
          {channel && (
            <span
              style={{
                display: "flex",
                alignItems: "center",
                gap: "5px",
                fontSize: "12px",
                color: theme.textMuted,
              }}
            >
              {channel === "sms" && <SmsIcon />}
              {channel === "whatsapp" && <WhatsAppIcon />}
              {channel === "email" && <EmailIcon />}
              {CHANNEL_LABELS[channel]}
            </span>
          )}
        </div>
      )}

      {/* ── Glassmorphism card wrapping the digit row ── */}
      <div
        style={{
          position: "relative",
          background: "rgba(255,255,255,0.05)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          borderRadius: 20,
          padding: "20px 16px",
          boxShadow: "0 4px 24px rgba(0,0,0,0.18), 0 1.5px 6px rgba(0,0,0,0.12)",
          border: "1px solid rgba(255,255,255,0.10)",
        }}
      >
        {/* OTP digit row */}
        <div
          role="group"
          aria-labelledby={label ? labelId : undefined}
          aria-label={!label ? `Enter ${length}-digit verification code` : undefined}
          style={{
            display: "flex",
            gap: length > 4 ? "8px" : "10px",
            animation: shaking ? "otp-shake 0.45s ease" : undefined,
          }}
        >
          {values.map((val, idx) => {
            const isFocused = focusedIdx === idx;
            const isError = !!error;
            const isFilled = val !== "";

            return (
              /* Wrapper div — carries the gradient border effect on focus */
              <div
                key={idx}
                style={{
                  position: "relative",
                  width: boxW,
                  height: boxH,
                  transform: isFocused ? "scale(1.08)" : "scale(1)",
                  transition: "transform 150ms ease",
                  borderRadius: 10,
                }}
              >
                {/* Gradient border ring (absolutely behind the input) */}
                {isFocused && !isError && (
                  <div
                    aria-hidden="true"
                    style={{
                      position: "absolute",
                      inset: -2,
                      borderRadius: 12,
                      background: `conic-gradient(from 0deg, ${accentColor}, rgba(${accentRgb.r},${accentRgb.g},${accentRgb.b},0.2), ${accentColor})`,
                      zIndex: 0,
                    }}
                  />
                )}
                <input
                  ref={(el) => {
                    refs.current[idx] = el;
                  }}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={1}
                  value={val}
                  disabled={disabled || isLoading}
                  aria-label={`Digit ${idx + 1} of ${length}`}
                  style={{
                    position: "relative",
                    zIndex: 1,
                    width: "100%",
                    height: "100%",
                    textAlign: "center",
                    fontSize: "22px",
                    fontWeight: 700,
                    border: `2px solid ${
                      isError
                        ? errorColor
                        : isFocused
                          ? "transparent"
                          : isFilled
                            ? `rgba(${accentRgb.r},${accentRgb.g},${accentRgb.b},0.5)`
                            : (theme.border ?? "#334155")
                    }`,
                    borderRadius: 10,
                    outline: "none",
                    caretColor: "transparent",
                    cursor: disabled || isLoading ? "not-allowed" : "text",
                    opacity: disabled ? 0.6 : 1,
                    background: isError
                      ? (theme.errorBackground ?? "rgba(239,68,68,0.08)")
                      : isFilled
                        ? `rgba(${accentRgb.r},${accentRgb.g},${accentRgb.b},0.08)`
                        : (theme.surface ?? "rgba(15,23,42,0.7)"),
                    color: theme.text,
                    fontFamily: "monospace",
                    boxSizing: "border-box",
                  }}
                  onFocus={(e) => {
                    setFocusedIdx(idx);
                    e.target.select();
                  }}
                  onBlur={() => setFocusedIdx(null)}
                  onChange={(e) => handleChange(idx, e)}
                  onKeyDown={(e) => handleKeyDown(idx, e)}
                  onPaste={handlePaste}
                />
              </div>
            );
          })}
        </div>

        {/* Loading overlay — covers only the card */}
        {isLoading && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(0,0,0,0.45)",
              backdropFilter: "blur(4px)",
              WebkitBackdropFilter: "blur(4px)",
              borderRadius: 20,
              zIndex: 10,
            }}
            aria-label="Verifying..."
            role="status"
          >
            <SpinnerIcon color={accentColor} />
          </div>
        )}
      </div>

      {/* Error message */}
      {error && (
        <p
          role="alert"
          style={{
            margin: 0,
            fontSize: "13px",
            color: errorColor,
            textAlign: "center",
            fontWeight: 500,
          }}
        >
          {error}
        </p>
      )}

      {/* Manual submit button */}
      {!autoSubmit && (
        <button
          type="button"
          disabled={disabled || isLoading || !allFilled}
          onClick={handleManualSubmit}
          style={{
            padding: "10px 28px",
            borderRadius: "8px",
            border: "none",
            background: allFilled && !disabled ? accentColor : theme.border,
            color: allFilled && !disabled ? theme.onPrimary : theme.textMuted,
            fontWeight: 700,
            fontSize: "14px",
            cursor: allFilled && !disabled && !isLoading ? "pointer" : "not-allowed",
            transition: "background 0.15s",
          }}
        >
          Verify
        </button>
      )}

      {/* Resend section */}
      {onResend && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
          {cooldown > 0 ? (
            <OtpTimer seconds={cooldown} prefix="Resend in " />
          ) : (
            <button
              type="button"
              onClick={handleResend}
              disabled={isResending}
              style={{
                background: "none",
                border: "none",
                color: isResending ? theme.textMuted : accentColor,
                fontWeight: 600,
                fontSize: "13px",
                cursor: isResending ? "not-allowed" : "pointer",
                padding: "2px 0",
              }}
            >
              {isResending ? "Sending…" : "Resend code"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
