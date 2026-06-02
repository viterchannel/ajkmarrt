import { ThemeProvider, useAuthTheme } from "@workspace/auth-react";
import { tDual, type TranslationKey } from "@workspace/i18n";
import { useState } from "react";
import { useLocation } from "wouter";
import { api } from "../lib/api";
import { riderTheme } from "../lib/auth/theme";
import { useLanguage } from "../lib/useLanguage";

type Step = "enter-phone" | "result";

function ForgotUsernameInner() {
  const theme = useAuthTheme();
  const [, navigate] = useLocation();
  const { language } = useLanguage();
  const T = (key: TranslationKey) => tDual(key, language);
  const [phone, setPhone] = useState("");
  const [masked, setMasked] = useState<string | null | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<Step>("enter-phone");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = phone.trim();
    if (trimmed.length < 7) {
      setError(T("enterValidPhone"));
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await api.recoverUsername(trimmed);
      setMasked((res as { masked?: string | null }).masked ?? null);
      setStep("result");
    } catch {
      setError(T("somethingWentWrong"));
    } finally {
      setLoading(false);
    }
  };

  const card: React.CSSProperties = {
    width: "100%",
    maxWidth: 400,
    background: "var(--color-muted)",
    border: "1px solid var(--color-border)",
    borderRadius: 24,
    padding: "36px 32px",
    boxShadow: "0 24px 64px rgba(0,0,0,0.45)",
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "13px 16px",
    borderRadius: 14,
    border: "1.5px solid var(--color-border)",
    background: "var(--color-muted)",
    color: "var(--color-foreground)",
    fontSize: 15,
    outline: "none",
    boxSizing: "border-box",
    fontFamily: "inherit",
  };

  const btnPrimary: React.CSSProperties = {
    width: "100%",
    padding: "14px 0",
    borderRadius: 14,
    border: "none",
    background: theme.primary,
    color: "var(--color-background)",
    fontSize: 15,
    fontWeight: 700,
    cursor: loading ? "not-allowed" : "pointer",
    opacity: loading ? 0.6 : 1,
    transition: "opacity 0.15s",
  };

  const btnSecondary: React.CSSProperties = {
    width: "100%",
    padding: "13px 0",
    borderRadius: 14,
    border: "1.5px solid var(--color-border)",
    background: "var(--color-muted)",
    color: "var(--color-muted-foreground)",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    transition: "background 0.15s",
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "#0A0A0A",
        padding: "24px 16px",
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      <div style={card}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              background: `${theme.primary}18`,
              border: `1.5px solid ${theme.primary}40`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 16px",
            }}
          >
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={theme.primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </div>
          <h1 style={{ color: "var(--color-foreground)", fontSize: 20, fontWeight: 800, margin: "0 0 6px", letterSpacing: "-0.02em" }}>
            {T("recoverYourUsername")}
          </h1>
          <p style={{ color: "var(--color-muted-foreground)", fontSize: 13.5, margin: 0, lineHeight: 1.5 }}>
            {step === "enter-phone"
              ? T("forgotUsernameEnterPhoneDesc")
              : T("forgotUsernameFoundDesc")}
          </p>
        </div>

        {step === "enter-phone" ? (
          <form onSubmit={(e) => { void handleSubmit(e); }} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label style={{ display: "block", color: "var(--color-muted-foreground)", fontSize: 12.5, fontWeight: 600, marginBottom: 7, letterSpacing: "0.03em", textTransform: "uppercase" }}>
                {T("phoneNumber")}
              </label>
              <input
                type="tel"
                inputMode="tel"
                placeholder="+92 3xx xxxxxxx"
                value={phone}
                onChange={(e) => { setPhone(e.target.value); setError(null); }}
                style={inputStyle}
                autoComplete="tel"
                autoFocus
              />
            </div>

            {error && (
              <p style={{ color: "#f87171", fontSize: 13, margin: 0 }} role="alert">
                {error}
              </p>
            )}

            <button type="submit" disabled={loading} style={btnPrimary}>
              {loading ? T("lookingUp") : T("findMyUsername")}
            </button>

            <button
              type="button"
              onClick={() => navigate("/login")}
              style={btnSecondary}
            >
              {T("backArrowLogin")}
            </button>
          </form>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {masked ? (
              <div
                style={{
                  background: `${theme.primary}10`,
                  border: `1.5px solid ${theme.primary}30`,
                  borderRadius: 14,
                  padding: "20px 24px",
                  textAlign: "center",
                }}
              >
                <p style={{ color: "var(--color-foreground)", fontSize: 12, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", margin: "0 0 8px" }}>
                  {T("yourUsername")}
                </p>
                <p
                  style={{
                    color: theme.primary,
                    fontSize: 26,
                    fontWeight: 800,
                    letterSpacing: "0.1em",
                    fontFamily: "monospace",
                    margin: 0,
                  }}
                >
                  {masked}
                </p>
              </div>
            ) : (
              <div
                style={{
                  background: "var(--color-muted)",
                  border: "1.5px solid var(--color-border)",
                  borderRadius: 14,
                  padding: "20px 24px",
                  textAlign: "center",
                }}
              >
                <p style={{ color: "var(--color-muted-foreground)", fontSize: 14, margin: 0, lineHeight: 1.6 }}>
                  {T("noUsernameLinked")}
                </p>
              </div>
            )}

            <button
              type="button"
              onClick={() => navigate("/login")}
              style={btnPrimary}
            >
              {T("backToLogin")}
            </button>

            <button
              type="button"
              onClick={() => { setStep("enter-phone"); setPhone(""); setMasked(undefined); setError(null); }}
              style={btnSecondary}
            >
              {T("tryDifferentNumber")}
            </button>
          </div>
        )}
      </div>

      <p style={{ color: "var(--color-muted-foreground)", fontSize: 12, marginTop: 24, textAlign: "center" }}>
        {T("usernameMaskedSecurity")}
      </p>
    </div>
  );
}

export default function ForgotUsername() {
  return (
    <ThemeProvider role="rider" theme={riderTheme}>
      <ForgotUsernameInner />
    </ThemeProvider>
  );
}
