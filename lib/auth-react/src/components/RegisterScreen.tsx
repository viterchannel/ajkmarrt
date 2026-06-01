import React, { useEffect, useState, type FormEvent } from "react";
import { useAuthTheme } from "../context/ThemeContext";
import { OtpInput } from "./OtpInput";
import { PasswordInput } from "./PasswordInput";
import { PhoneInput } from "./PhoneInput";

function SpinIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      style={{ flexShrink: 0, animation: "auth-spin 0.8s linear infinite" }}
    >
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  );
}

export type RegisterRole = "rider" | "vendor" | "customer";

export interface FieldConfig {
  id: string;
  type:
    | "text"
    | "email"
    | "phone"
    | "password"
    | "confirm-password"
    | "otp"
    | "select"
    | "checkbox";
  label?: string;
  placeholder?: string;
  required?: boolean;
  options?: { value: string; label: string }[];
  validate?: (value: unknown, allData: Record<string, unknown>) => string | null;
}

export interface StepComponentProps {
  data: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
  onError: (msg: string) => void;
  onNext: () => void;
  role: RegisterRole;
}

export interface StepConfig {
  id: string;
  title: string;
  subtitle?: string;
  /** Optional for component-based steps; required for field-based steps. */
  fields?: FieldConfig[];
  component?: React.ComponentType<StepComponentProps>;
  validate?: (data: Record<string, unknown>) => string | null;
}

export interface RegisterScreenProps {
  role: RegisterRole;
  steps: StepConfig[];
  /** Called on final step completion (throws on error). */
  onComplete?: (data: Record<string, unknown>) => void | Promise<void>;
  /**
   * Alternative to onComplete — accepts a result envelope
   * `{ success, error?, data? }`. Use this from wizard wrappers.
   */
  onSubmit?: (
    data: Record<string, unknown>
  ) => Promise<{ success: boolean; error?: string; data?: unknown }>;
  /** Called after successful completion (navigate away, etc.). */
  onDone?: () => void;
  /** Called whenever a field value changes (e.g. to persist a draft). */
  onDataChange?: (key: string, value: unknown) => void;
  /**
   * Custom OTP sender. Called when advancing to an OTP step.
   * Return true (or { success: true }) if sent successfully.
   * Return false or { success: false, error } to show an error message.
   */
  onOtpRequest?: (phone: string) => Promise<boolean | { success: boolean; error?: string }>;
  /** Pre-populate form data (e.g. restored draft). */
  initialData?: Record<string, unknown>;
  baseURL?: string;
  title?: string;
  className?: string;
  /**
   * Override the accent color used for buttons and step-indicator dots.
   * Defaults to the role's built-in accent (vendor = orange, etc.).
   */
  accent?: string;
  /** Text color drawn on top of accent-colored buttons. Defaults to "#fff". */
  accentText?: string;
  /**
   * When true, strips the outer screen/card wrapper so the caller
   * can provide their own container and theme (e.g. dark mode wizard).
   */
  bare?: boolean;
}

const ROLE_ACCENT: Record<RegisterRole, string> = {
  customer: "#0066ff",
  rider: "#F0B90B",
  vendor: "#f97316",
};

const ROLE_ACCENT_TEXT: Record<RegisterRole, string> = {
  customer: "#fff",
  rider: "#0B0E11",
  vendor: "#fff",
};

const ROLE_LABELS: Record<RegisterRole, string> = {
  customer: "Create Account",
  rider: "Rider Registration",
  vendor: "Vendor Registration",
};


/** Returns true only for field-based OTP steps (not component-based). */
function isOtpStep(step: StepConfig): boolean {
  return (step.fields ?? []).some((f) => f.type === "otp");
}

function getOtpPhone(data: Record<string, unknown>): string {
  return (data["phone"] as string) ?? (data["phoneE164"] as string) ?? "";
}

function getOtpEmail(data: Record<string, unknown>): string {
  return (data["email"] as string) ?? "";
}

export function RegisterScreen({
  role,
  steps,
  onComplete,
  onSubmit,
  onDone,
  onDataChange,
  onOtpRequest,
  initialData,
  baseURL = "",
  title,
  className,
  accent: accentProp,
  accentText: accentTextProp,
  bare = false,
}: RegisterScreenProps) {
  const theme = useAuthTheme();
  const accent = accentProp ?? ROLE_ACCENT[role];
  const accentText = accentTextProp ?? ROLE_ACCENT_TEXT[role];
  const displayTitle = title ?? ROLE_LABELS[role];

  const s = {
    screen: {
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: theme.background,
      padding: "24px 16px",
    } as React.CSSProperties,
    card: {
      width: "100%",
      maxWidth: "420px",
      background: theme.surface,
      borderRadius: "16px",
      padding: "32px 28px",
      boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
      display: "flex",
      flexDirection: "column" as const,
      gap: "20px",
    },
    header: { textAlign: "center" as const },
    title: { fontSize: "22px", fontWeight: 800, color: theme.text, margin: "0 0 4px" },
    subtitle: { fontSize: "14px", color: theme.textMuted, margin: 0 },
    stepIndicator: {
      display: "flex",
      gap: "6px",
      alignItems: "center",
      justifyContent: "center",
    },
    label: {
      fontSize: "13px",
      fontWeight: 600,
      color: theme.text,
      marginBottom: "4px",
      display: "block",
    } as React.CSSProperties,
    input: {
      width: "100%",
      padding: "12px",
      border: `2px solid ${theme.border}`,
      borderRadius: "8px",
      fontSize: "15px",
      outline: "none",
      boxSizing: "border-box" as const,
      background: theme.background,
      color: theme.text,
      transition: "border-color 0.15s, box-shadow 0.15s",
    },
    select: {
      width: "100%",
      padding: "12px",
      border: `2px solid ${theme.border}`,
      borderRadius: "8px",
      fontSize: "15px",
      outline: "none",
      boxSizing: "border-box" as const,
      transition: "border-color 0.15s, box-shadow 0.15s",
      background: theme.surface,
      color: theme.text,
    },
    checkboxRow: {
      display: "flex",
      alignItems: "flex-start",
      gap: "10px",
      cursor: "pointer",
    } as React.CSSProperties,
    btnPrimary: (a: string, textColor = "#fff"): React.CSSProperties => ({
      width: "100%",
      padding: "13px",
      borderRadius: "8px",
      border: "none",
      background: a,
      color: textColor,
      fontWeight: 700,
      fontSize: "15px",
      cursor: "pointer",
      transition: "opacity 0.15s, filter 0.15s, transform 0.1s",
    }),
    btnDisabled: { opacity: 0.55, cursor: "not-allowed", transform: "none", filter: "none" } as React.CSSProperties,
    btnBack: (a: string): React.CSSProperties => ({
      background: "none",
      border: "none",
      color: a,
      cursor: "pointer",
      fontSize: "13px",
      fontWeight: 600,
      padding: "6px 0",
      textAlign: "center" as const,
      transition: "opacity 0.15s",
    }),
    errorBox: {
      background: theme.errorBackground,
      border: `1px solid ${theme.errorBorder}`,
      borderRadius: "10px",
      padding: "12px 14px",
      color: theme.error,
      fontSize: "13px",
      display: "flex",
      alignItems: "center",
      gap: "8px",
      lineHeight: 1.4,
    },
    progressDot: (active: boolean, done: boolean, a: string): React.CSSProperties => ({
      width: active ? "24px" : "8px",
      height: "8px",
      borderRadius: "4px",
      background: done || active ? a : theme.border,
      transition: "all 0.2s",
    }),
  };

  const [stepIndex, setStepIndex] = useState(0);
  const [formData, setFormData] = useState<Record<string, unknown>>(initialData ?? {});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [devOtp, setDevOtp] = useState("");
  const [completed, setCompleted] = useState(false);

  /* Inject shared auth keyframe styles once */
  useEffect(() => {
    const id = "auth-shared-keyframes";
    if (typeof document !== "undefined" && !document.getElementById(id)) {
      const style = document.createElement("style");
      style.id = id;
      style.textContent = `
        @keyframes auth-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes auth-fade-in { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
        .auth-input:focus-visible, .auth-input:focus { outline: none; border-color: var(--auth-focus, currentColor); box-shadow: 0 0 0 3px var(--auth-focus-ring, rgba(0,0,0,0.08)); }
        .auth-input-wrapper:focus-within { border-color: var(--auth-focus, currentColor); box-shadow: 0 0 0 3px var(--auth-focus-ring, rgba(0,0,0,0.08)); }
      `;
      document.head.appendChild(style);
    }
  }, []);

  /* Sync initialData changes (e.g. async draft load) */
  useEffect(() => {
    if (initialData && Object.keys(initialData).length > 0) {
      setFormData((prev) => {
        // Only update if the new initialData is meaningfully different
        if (JSON.stringify(prev) === JSON.stringify(initialData)) return prev;
        return initialData;
      });
    }
  }, [initialData]);

  const currentStep = steps[stepIndex]!;
  const isLastStep = stepIndex === steps.length - 1;
  const totalVisibleSteps = steps.filter((s) => !isOtpStep(s)).length + 1;

  function updateField(key: string, value: unknown) {
    setFormData((prev) => ({ ...prev, [key]: value }));
    onDataChange?.(key, value);
    setError("");
  }

  function validateStep(): string | null {
    if (currentStep.validate) {
      return currentStep.validate(formData);
    }
    for (const field of currentStep.fields ?? []) {
      if (field.type === "otp") continue;
      const val = formData[field.id];
      if (field.required && !val) {
        return `${field.label ?? field.id} is required`;
      }
      if (field.validate) {
        const msg = field.validate(val, formData);
        if (msg) return msg;
      }
      if (field.type === "confirm-password") {
        if (val !== formData["password"]) return "Passwords do not match";
      }
    }
    return null;
  }

  async function sendOtpBuiltIn() {
    const phone = getOtpPhone(formData);
    const email = getOtpEmail(formData);
    setLoading(true);
    try {
      if (phone) {
        const res = await fetch(`${baseURL}/api/auth/send-otp`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone }),
        });
        const json = (await res.json()) as Record<string, unknown>;
        if (!res.ok)
          throw new Error(
            (json.message as string) ?? (json.error as string) ?? "Failed to send OTP"
          );
        if (json.otp) setDevOtp(json.otp as string);
      } else if (email) {
        const res = await fetch(`${baseURL}/api/auth/send-email-otp`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });
        const json = (await res.json()) as Record<string, unknown>;
        if (!res.ok)
          throw new Error(
            (json.message as string) ?? (json.error as string) ?? "Failed to send OTP"
          );
        if (json.otp) setDevOtp(json.otp as string);
      }
      setOtpSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to send OTP");
    }
    setLoading(false);
  }

  async function verifyOtp(otp: string) {
    const phone = getOtpPhone(formData);
    const email = getOtpEmail(formData);
    setLoading(true);
    try {
      const endpoint = phone ? "/api/auth/verify-otp" : "/api/auth/verify-email-otp";
      const body = phone ? { phone, otp } : { email, otp };
      const res = await fetch(`${baseURL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as Record<string, unknown>;
      if (!res.ok)
        throw new Error((json.message as string) ?? (json.error as string) ?? "Invalid OTP");
      const merged = {
        ...formData,
        ...(typeof json.data === "object" ? (json.data as Record<string, unknown>) : json),
      };
      setFormData(merged);
      if (isLastStep) {
        setCompleted(true);
        await onComplete?.(merged);
        onDone?.();
      } else {
        setStepIndex((i) => i + 1);
        setOtpSent(false);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "OTP verification failed");
    }
    setLoading(false);
  }

  async function handleNext(e?: FormEvent) {
    e?.preventDefault();
    setError("");

    /* ── Field-based OTP step ── */
    if (isOtpStep(currentStep)) {
      if (!otpSent) {
        await sendOtpBuiltIn();
      }
      return;
    }

    const validationError = validateStep();
    if (validationError) {
      setError(validationError);
      return;
    }

    const nextIndex = stepIndex + 1;
    const isOnLastStep = isLastStep;
    // Last step is "display-only" (success/confirm screen) when it has no fields and no component
    const lastStepIsDisplayOnly =
      (steps[steps.length - 1]?.fields ?? []).length === 0 && !steps[steps.length - 1]?.component;
    // "Submit" happens when advancing to a display-only last step, or when ON the last step if it has fields
    const isSubmitPoint = isOnLastStep
      ? !lastStepIsDisplayOnly
      : !isLastStep && nextIndex === steps.length - 1 && lastStepIsDisplayOnly;

    /* ── Submission point — accumulate + call onSubmit / onComplete ── */
    if (isSubmitPoint && (onSubmit || onComplete)) {
      setLoading(true);
      try {
        if (onSubmit) {
          const result = await onSubmit(formData);
          if (!result.success) {
            setError(result.error ?? "Registration failed");
            setLoading(false);
            return;
          }
        } else if (onComplete) {
          await onComplete(formData);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Registration failed");
        setLoading(false);
        return;
      }
      setLoading(false);
      if (isOnLastStep) {
        setCompleted(true);
        onDone?.();
      } else {
        setStepIndex(nextIndex);
      }
      return;
    }

    /* ── On the last (display-only) step — just navigate away ── */
    if (isOnLastStep) {
      onDone?.();
      return;
    }

    /* ── Advance to next step ── */
    const nextStep = steps[nextIndex];

    /* If next step is a component-based OTP step and we have onOtpRequest, fire it */
    if (nextStep?.component && onOtpRequest) {
      const phone = getOtpPhone(formData);
      if (phone) {
        setLoading(true);
        try {
          const otpResult = await onOtpRequest(phone);
          if (typeof otpResult === "object" && !otpResult.success) {
            setError(otpResult.error ?? "Failed to send OTP");
            setLoading(false);
            return;
          }
        } catch (e) {
          setError(e instanceof Error ? e.message : "Failed to send OTP");
          setLoading(false);
          return;
        }
        setLoading(false);
      }
    }

    setStepIndex(nextIndex);
  }

  function handleBack() {
    setError("");
    if (isOtpStep(currentStep) && otpSent) {
      setOtpSent(false);
      return;
    }
    setStepIndex((i) => Math.max(0, i - 1));
  }

  if (completed) {
    const completedContent = (
      <div style={s.header}>
        <div style={{ marginBottom: "12px", display: "flex", justifyContent: "center" }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><polyline points="9 12 11 14 15 10" />
          </svg>
        </div>
        <h2 style={s.title}>Registration Complete</h2>
        <p style={s.subtitle}>Your application has been submitted successfully.</p>
      </div>
    );
    if (bare) return <>{completedContent}</>;
    return (
      <div style={s.screen} className={className}>
        <div style={s.card}>{completedContent}</div>
      </div>
    );
  }

  const stepNum = steps.filter((_, i) => !isOtpStep(steps[i]!) && i <= stepIndex).length;

  const stepContent = (
    <>
      {currentStep.component ? (
        /* ── Component-based step ── */
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <currentStep.component
            data={formData}
            onChange={updateField}
            onError={setError}
            onNext={() => void handleNext()}
            role={role}
          />
          <button
            type="button"
            style={{ ...s.btnPrimary(accent, accentText), ...(loading ? s.btnDisabled : {}) }}
            disabled={loading}
            onClick={() => void handleNext()}
          >
            {loading ? (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8, justifyContent: "center" }}>
                <SpinIcon size={17} /> Please wait…
              </span>
            ) : isLastStep ? (
              "Submit Registration"
            ) : (
              "Next →"
            )}
          </button>
          {stepIndex > 0 && (
            <button type="button" style={s.btnBack(accent)} onClick={handleBack}>
              ← Back
            </button>
          )}
        </div>
      ) : isOtpStep(currentStep) && otpSent ? (
        /* ── Field-based OTP input ── */
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <OtpInput
            onComplete={(otp) => void verifyOtp(otp)}
            onResend={() => void sendOtpBuiltIn()}
            autoSubmit
          />
        </div>
      ) : (
        /* ── Field-based step ── */
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void handleNext();
          }}
          style={{ display: "flex", flexDirection: "column", gap: "16px" }}
        >
          {(currentStep.fields ?? [])
            .filter((f) => f.type !== "otp")
            .map((field) => (
              <div key={field.id}>
                {field.type === "phone" ? (
                  <>
                    {field.label && <label style={s.label}>{field.label}</label>}
                    <PhoneInput
                      value={(formData[field.id] as string) ?? ""}
                      onChange={(e164) => {
                        updateField(field.id, e164);
                      }}
                    />
                  </>
                ) : field.type === "password" || field.type === "confirm-password" ? (
                  <>
                    {field.label && <label style={s.label}>{field.label}</label>}
                    <PasswordInput
                      value={(formData[field.id] as string) ?? ""}
                      onChange={(v) => {
                        updateField(field.id, v);
                      }}
                      showStrength={field.type === "password"}
                      placeholder={field.placeholder}
                      autoComplete={field.type === "password" ? "new-password" : "new-password"}
                    />
                  </>
                ) : field.type === "select" ? (
                  <>
                    {field.label && <label style={s.label}>{field.label}</label>}
                    <select
                      className="auth-input"
                      style={s.select}
                      value={(formData[field.id] as string) ?? ""}
                      onChange={(e) => {
                        updateField(field.id, e.target.value);
                      }}
                      required={field.required}
                    >
                      <option value="">Select {field.label ?? field.id}</option>
                      {field.options?.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </>
                ) : field.type === "checkbox" ? (
                  <label style={s.checkboxRow}>
                    <input
                      type="checkbox"
                      checked={!!formData[field.id]}
                      onChange={(e) => {
                        updateField(field.id, e.target.checked);
                      }}
                    />
                    <span style={{ fontSize: "13px", color: theme.textMuted }}>{field.label}</span>
                  </label>
                ) : (
                  <>
                    {field.label && <label style={s.label}>{field.label}</label>}
                    <input
                      className="auth-input"
                      style={s.input}
                      type={field.type === "email" ? "email" : "text"}
                      value={(formData[field.id] as string) ?? ""}
                      onChange={(e) => {
                        updateField(field.id, e.target.value);
                      }}
                      placeholder={field.placeholder}
                      required={field.required}
                    />
                  </>
                )}
              </div>
            ))}

          <button
            type="submit"
            style={{ ...s.btnPrimary(accent, accentText), ...(loading ? s.btnDisabled : {}) }}
            disabled={loading}
          >
            {loading ? (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8, justifyContent: "center" }}>
                <SpinIcon size={17} /> Please wait…
              </span>
            ) : isOtpStep(currentStep) ? (
              "Send OTP"
            ) : isLastStep ? (
              "Submit Registration"
            ) : (
              "Next →"
            )}
          </button>

          {stepIndex > 0 && (
            <button type="button" style={s.btnBack(accent)} onClick={handleBack}>
              ← Back
            </button>
          )}
        </form>
      )}

      {isOtpStep(currentStep) && otpSent && (
        <button type="button" style={s.btnBack(accent)} onClick={handleBack}>
          ← Change number
        </button>
      )}

    </>
  );

  /* ── Bare mode: caller owns the container ── */
  const isDev =
    typeof import.meta !== "undefined" &&
    (import.meta as unknown as Record<string, Record<string, unknown>>).env != null
      ? !(import.meta as unknown as Record<string, Record<string, unknown>>).env?.["PROD"]
      : false;

  if (bare) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }} className={className}>
        {error && (
          <div style={s.errorBox} role="alert" aria-live="assertive">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ flexShrink: 0, marginTop: 1 }}>
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{error}</span>
          </div>
        )}
        {isDev && devOtp && (
          <div
            style={{
              background: "#fef3c7",
              border: "1px solid #fcd34d",
              borderRadius: "8px",
              padding: "8px 12px",
              fontSize: "13px",
              color: "#92400e",
            }}
          >
            Dev OTP: <strong style={{ letterSpacing: "0.3em" }}>{devOtp}</strong>
          </div>
        )}
        {stepContent}
      </div>
    );
  }

  /* ── Default: full screen + white card ── */
  return (
    <div style={s.screen} className={className}>
      <div style={s.card}>
        <div style={s.header}>
          <h1 style={s.title}>{displayTitle}</h1>
          <p style={s.subtitle}>{currentStep.title}</p>
          {currentStep.subtitle && (
            <p style={{ ...s.subtitle, marginTop: "2px" }}>{currentStep.subtitle}</p>
          )}
          {totalVisibleSteps > 1 && (
            <div style={{ ...s.stepIndicator, marginTop: "12px" }}>
              {Array.from({ length: totalVisibleSteps }).map((_, i) => (
                <div key={i} style={s.progressDot(i + 1 === stepNum, i + 1 < stepNum, accent)} />
              ))}
            </div>
          )}
        </div>
        {error && (
          <div style={s.errorBox} role="alert" aria-live="assertive">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ flexShrink: 0, marginTop: 1 }}>
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{error}</span>
          </div>
        )}
        {isDev && devOtp && (
          <div
            style={{
              background: "#fef3c7",
              border: "1px solid #fcd34d",
              borderRadius: "8px",
              padding: "8px 12px",
              fontSize: "13px",
              color: "#92400e",
            }}
          >
            Dev OTP: <strong style={{ letterSpacing: "0.3em" }}>{devOtp}</strong>
          </div>
        )}
        {stepContent}
      </div>
    </div>
  );
}
