import { useState, type ChangeEvent } from "react";
import { useAuthTheme } from "../context/ThemeContext";

export interface PasswordStrength {
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
  color: string;
}

function calcStrength(password: string): PasswordStrength {
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  const clamped = Math.min(score, 4) as 0 | 1 | 2 | 3 | 4;
  const map: Record<number, Omit<PasswordStrength, "score">> = {
    0: { label: "", color: "#e5e7eb" },
    1: { label: "Weak", color: "#ef4444" },
    2: { label: "Fair", color: "#f59e0b" },
    3: { label: "Strong", color: "#3b82f6" },
    4: { label: "Very strong", color: "#10b981" },
  };
  return { score: clamped, ...map[clamped]! };
}

export interface PasswordInputProps {
  value: string;
  onChange: (value: string) => void;
  showStrength?: boolean;
  placeholder?: string;
  disabled?: boolean;
  autoComplete?: string;
  className?: string;
  label?: string;
}

export function PasswordInput({
  value,
  onChange,
  showStrength = false,
  placeholder = "Enter password",
  disabled = false,
  autoComplete = "current-password",
  className,
  label,
}: PasswordInputProps) {
  const theme = useAuthTheme();
  const [visible, setVisible] = useState(false);
  const strength = showStrength ? calcStrength(value) : null;

  const s = {
    wrapper: { display: "flex", flexDirection: "column" as const, gap: "6px" },
    label: { fontSize: "13px", fontWeight: 600, color: theme.text },
    inputRow: {
      display: "flex",
      alignItems: "center",
      border: `2px solid ${theme.border}`,
      borderRadius: "8px",
      overflow: "hidden",
      background: theme.background,
      color: theme.text,
      transition: "border-color 0.15s, box-shadow 0.15s",
    },
    input: {
      flex: 1,
      border: "none",
      outline: "none",
      padding: "12px",
      fontSize: "15px",
      background: "transparent",
      color: theme.text,
      letterSpacing: "0.05em",
    },
    toggleBtn: {
      background: "none",
      border: "none",
      cursor: "pointer",
      padding: "0 12px",
      color: theme.textMuted,
      fontSize: "18px",
      lineHeight: 1,
    },
    barRow: { display: "flex", gap: "4px", height: "4px" },
    bar: { flex: 1, borderRadius: "2px", background: theme.border, transition: "background 0.3s" },
    strengthLabel: { fontSize: "12px", textAlign: "right" as const },
  };

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    onChange(e.target.value);
  }

  return (
    <div style={s.wrapper} className={className}>
      {label && <label style={s.label}>{label}</label>}
      <div style={s.inputRow} className="auth-input-wrapper">
        <input
          type={visible ? "text" : "password"}
          value={value}
          onChange={handleChange}
          disabled={disabled}
          placeholder={placeholder}
          autoComplete={autoComplete}
          style={s.input}
        />
        <button
          type="button"
          style={s.toggleBtn}
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
        >
          {visible ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
              <line x1="1" y1="1" x2="23" y2="23" />
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          )}
        </button>
      </div>
      {showStrength && strength && value.length > 0 && (
        <>
          <div style={s.barRow}>
            {[1, 2, 3, 4].map((n) => (
              <div
                key={n}
                style={{
                  ...s.bar,
                  background: n <= strength.score ? strength.color : "#e5e7eb",
                }}
              />
            ))}
          </div>
          {strength.label && (
            <span style={{ ...s.strengthLabel, color: strength.color }}>{strength.label}</span>
          )}
        </>
      )}
    </div>
  );
}
