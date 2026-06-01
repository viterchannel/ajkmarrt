/**
 * RegisterWizard.tsx — ajkmart (customer)
 *
 * 3-step registration wizard (spec-aligned):
 *   Phone → OTP → Personal (name + city + full address) → Password → Done
 *
 * Gap fixes applied:
 *   • Steps restructured: Name + City + Address merged into one "Personal" step
 *   • fullAddress field added
 *   • username removed (not in customer spec)
 *   • Password validate enforces uppercase / number / symbol
 *   • Post-success auto-logs in and navigates to Dashboard
 *   • Offline: network failures queue to AsyncStorage and retry on reconnect
 *   • address is passed to the /auth/register API call
 */
import React, { useState, useEffect, useRef, useCallback } from "react";
import { router } from "expo-router";
import { RegisterScreen } from "@workspace/auth-react";
import type { StepConfig, StepComponentProps } from "@workspace/auth-react";
import { useTheme } from "./ThemeContext";
import { useAuth } from "./useAuth";
import { useAuth as useAuthContext } from "@/context/AuthContext";
import type { AppUser } from "@/context/AuthContext";
import { usePlatformConfig } from "@/context/PlatformConfigContext";
import { useAuthConfig } from "@/context/AuthConfigContext";
import { useLanguage } from "@/context/LanguageContext";
import { tDual, type TranslationKey } from "@workspace/i18n";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_BASE } from "@/utils/api";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Platform, AppState,
} from "react-native";

import { isValidPhone } from "@workspace/phone-utils";
import { PAKISTAN_CITIES } from "@workspace/service-constants";

const DRAFT_KEY = "@ajkmart_reg_draft";
const PENDING_KEY = "@ajkmart_reg_pending";

/* ── Validate Pakistani phone — delegates to shared phone-utils ── */
function isValidPakistaniPhone(phone: string): boolean {
  return isValidPhone(phone);
}

/** True when the error looks like a network-level failure (no HTTP response). */
function isNetworkError(err: unknown): boolean {
  if (err instanceof TypeError) return true;
  if (err instanceof Error && /fetch|network|offline/i.test(err.message)) return true;
  return false;
}

/* ── Step 1: Phone ───────────────────────────────────────────────────────── */
function PhoneStep({ data, onChange, onError }: StepComponentProps) {
  const { language } = useLanguage();
  const T = (key: string) => tDual(key as TranslationKey, language);
  const theme = useTheme();

  const handleBlur = () => {
    const phone = String(data.phone ?? "").trim();
    if (!phone) { onError("Phone number is required"); return; }
    if (!isValidPakistaniPhone(phone)) { onError("Enter a valid Pakistani mobile number (03XXXXXXXXX)"); return; }
    onError("");
  };

  return (
    <View style={{ gap: 14 }}>
      <Text style={[styles.stepTitle, { color: theme.text }]}>{T("enterPhone")}</Text>
      <Text style={[styles.stepBody, { color: theme.textMuted }]}>{T("weWillSendOtp")}</Text>
      <TextInput
        style={[styles.input, { borderColor: theme.border, color: theme.text, backgroundColor: theme.surface }]}
        value={(data.phone as string) ?? ""}
        onChangeText={v => { onChange("phone", v); onError(""); }}
        onBlur={handleBlur}
        placeholder="03XXXXXXXXX"
        placeholderTextColor={theme.textMuted}
        keyboardType="phone-pad"
        maxLength={11}
      />
    </View>
  );
}

/* ── Step 2: OTP ─────────────────────────────────────────────────────────── */
function OtpStep({ data, onChange, onError, onComplete }: StepComponentProps & { onComplete?: (otp: string) => void }) {
  const { language } = useLanguage();
  const T = (key: string) => tDual(key as TranslationKey, language);
  const { sendOtp } = useAuth();
  const theme = useTheme();
  const [otp, setOtp] = useState("");
  const [resending, setResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(30);
  const inputRefs = useRef<(TextInput | null)[]>([]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  const handleChange = (i: number, v: string) => {
    const digit = v.replace(/\D/g, "").slice(-1);
    const chars = otp.split("");
    chars[i] = digit;
    const next = chars.join("").slice(0, 6);
    setOtp(next);
    onChange("otp", next);
    onError("");
    if (digit && i < 5) inputRefs.current[i + 1]?.focus();
    if (next.length === 6) onComplete?.(next);
  };

  const handleKeyPress = (i: number, e: { nativeEvent: { key: string } }) => {
    if (e.nativeEvent.key === "Backspace" && !otp[i] && i > 0) {
      inputRefs.current[i - 1]?.focus();
    }
  };

  const handleResend = async () => {
    const phone = (data.phone as string) ?? "";
    if (!phone || resending || resendCooldown > 0) return;
    setResending(true);
    await sendOtp(phone);
    setResending(false);
    setResendCooldown(30);
  };

  return (
    <View style={{ gap: 14, alignItems: "center" }}>
      <Text style={[styles.stepTitle, { color: theme.text }]}>{T("verifyPhone")}</Text>
      <Text style={[styles.stepBody, { color: theme.textMuted, textAlign: "center" }]}>
        {T("enterOtpSentTo")} <Text style={{ fontWeight: "700", color: theme.text }}>{(data.phone as string) ?? ""}</Text>
      </Text>
      <View style={{ flexDirection: "row", gap: 8, marginVertical: 12 }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <TextInput
            key={i}
            ref={el => { inputRefs.current[i] = el; }}
            style={[styles.otpBox, { borderColor: otp[i] ? theme.primary : theme.border, color: theme.text }]}
            value={otp[i] ?? ""}
            onChangeText={v => handleChange(i, v)}
            onKeyPress={e => handleKeyPress(i, e)}
            keyboardType="number-pad"
            maxLength={1}
            textAlign="center"
            selectTextOnFocus
          />
        ))}
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
        <Text style={{ color: theme.textMuted, fontSize: 13 }}>{T("didntReceive")}</Text>
        {resendCooldown > 0
          ? <Text style={{ color: theme.textMuted, fontSize: 13 }}>Resend in {resendCooldown}s</Text>
          : <TouchableOpacity onPress={handleResend} disabled={resending} activeOpacity={0.7}>
              <Text style={{ color: theme.primary, fontWeight: "700", fontSize: 13 }}>
                {resending ? "Sending…" : T("resend")}
              </Text>
            </TouchableOpacity>
        }
      </View>
    </View>
  );
}

/* ── Step 3: Personal Details (name + city + full address — merged) ───────── */
function PersonalStep({ data, onChange, onError }: StepComponentProps) {
  const { language } = useLanguage();
  const T = (key: string) => tDual(key as TranslationKey, language);
  const theme = useTheme();

  const handleNameBlur = () => {
    const name = String(data.name ?? "").trim();
    if (!name) { onError("Full name is required"); return; }
    if (name.length < 2) { onError("Please enter your full name"); return; }
    onError("");
  };

  const handleAddressBlur = () => {
    const address = String(data.address ?? "").trim();
    if (!address) { onError("Full address is required"); return; }
    onError("");
  };

  return (
    <View style={{ gap: 14 }}>
      <Text style={[styles.stepTitle, { color: theme.text }]}>Personal Details</Text>
      <Text style={[styles.stepBody, { color: theme.textMuted }]}>Tell us about yourself so we can personalise your experience.</Text>

      {/* Full Name */}
      <View style={{ gap: 4 }}>
        <Text style={[styles.fieldLabel, { color: theme.primary }]}>Full Name *</Text>
        <TextInput
          style={[styles.input, { borderColor: theme.border, color: theme.text, backgroundColor: theme.surface }]}
          value={(data.name as string) ?? ""}
          onChangeText={v => { onChange("name", v); onError(""); }}
          onBlur={handleNameBlur}
          placeholder="Muhammad Ali"
          placeholderTextColor={theme.textMuted}
        />
      </View>

      {/* City */}
      <View style={{ gap: 4 }}>
        <Text style={[styles.fieldLabel, { color: theme.primary }]}>City *</Text>
        <View style={{ gap: 6 }}>
          {PAKISTAN_CITIES.map(city => (
            <TouchableOpacity key={city}
              style={[styles.cityBtn, { borderColor: data.city === city ? theme.primary : theme.border, backgroundColor: data.city === city ? `${theme.primary}12` : theme.surface }]}
              onPress={() => { onChange("city", city); onError(""); }}
              activeOpacity={0.8}
            >
              <Text style={{ color: data.city === city ? theme.primary : theme.text, fontWeight: data.city === city ? "700" : "500", fontSize: 14 }}>{city}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Full Address */}
      <View style={{ gap: 4 }}>
        <Text style={[styles.fieldLabel, { color: theme.primary }]}>Full Address *</Text>
        <TextInput
          style={[styles.input, { borderColor: theme.border, color: theme.text, backgroundColor: theme.surface, height: 72, paddingTop: 14, textAlignVertical: "top" }]}
          value={(data.address as string) ?? ""}
          onChangeText={v => { onChange("address", v); onError(""); }}
          onBlur={handleAddressBlur}
          placeholder="House / flat number, street, landmark…"
          placeholderTextColor={theme.textMuted}
          multiline
          numberOfLines={3}
        />
        <Text style={{ fontSize: 11, color: theme.textMuted }}>e.g. House 12, Street 4, F-8/2, Islamabad</Text>
      </View>
    </View>
  );
}

/* ── Step 4: Password ─────────────────────────────────────────────────────── */
const PW_RULES: [RegExp, string][] = [
  [/.{8,}/, "At least 8 characters"],
  [/[A-Z]/, "1 uppercase letter (A-Z)"],
  [/[0-9]/, "1 number (0-9)"],
  [/[^A-Za-z0-9]/, "1 symbol (e.g. @, #, !)"],
];

function PasswordStep({ data, onChange, onError }: StepComponentProps) {
  const { language } = useLanguage();
  const T = (key: string) => tDual(key as TranslationKey, language);
  const theme = useTheme();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const pw = String(data.password ?? "");
  const confirmed = String(data.confirmPassword ?? "");
  const allRulesMet = PW_RULES.every(([re]) => re.test(pw));

  const handlePasswordBlur = () => {
    if (!pw) { onError("Password is required"); return; }
    for (const [re, msg] of PW_RULES) {
      if (!re.test(pw)) { onError(`Password must contain: ${msg}`); return; }
    }
    onError("");
  };

  const handleConfirmBlur = () => {
    if (!confirmed) { onError("Please confirm your password"); return; }
    if (pw !== confirmed) { onError("Passwords do not match"); return; }
    onError("");
  };

  return (
    <View style={{ gap: 14 }}>
      <Text style={[styles.stepTitle, { color: theme.text }]}>{T("createPassword")}</Text>
      <Text style={[styles.stepBody, { color: theme.textMuted }]}>{T("secureYourAccount")}</Text>

      {/* Password */}
      <View style={{ position: "relative" }}>
        <TextInput
          style={[styles.input, { borderColor: theme.border, color: theme.text, backgroundColor: theme.surface, paddingRight: 56 }]}
          value={pw}
          onChangeText={v => { onChange("password", v); onError(""); }}
          onBlur={handlePasswordBlur}
          placeholder="Min 8 characters"
          placeholderTextColor={theme.textMuted}
          secureTextEntry={!showPassword}
        />
        <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPassword(v => !v)} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={{ color: theme.textMuted, fontSize: 13 }}>{showPassword ? "Hide" : "Show"}</Text>
        </TouchableOpacity>
      </View>

      {/* Strength rule checklist */}
      {pw.length > 0 && (
        <View style={{ gap: 4, paddingLeft: 4 }}>
          {PW_RULES.map(([re, label]) => {
            const ok = re.test(pw);
            return (
              <Text key={label} style={{ fontSize: 12, color: ok ? theme.primary : theme.textMuted }}>
                {ok ? "✓" : "○"} {label}
              </Text>
            );
          })}
        </View>
      )}

      {/* Confirm Password */}
      <View style={{ position: "relative" }}>
        <TextInput
          style={[styles.input, { borderColor: theme.border, color: theme.text, backgroundColor: theme.surface, paddingRight: 56 }]}
          value={confirmed}
          onChangeText={v => { onChange("confirmPassword", v); onError(""); }}
          onBlur={handleConfirmBlur}
          placeholder="Re-enter password"
          placeholderTextColor={theme.textMuted}
          secureTextEntry={!showConfirm}
        />
        <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowConfirm(v => !v)} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={{ color: theme.textMuted, fontSize: 13 }}>{showConfirm ? "Hide" : "Show"}</Text>
        </TouchableOpacity>
      </View>
      {confirmed.length > 0 && pw !== confirmed && (
        <Text style={{ fontSize: 12, color: "#EF4444", paddingLeft: 4 }}>✗ Passwords do not match</Text>
      )}
    </View>
  );
}

/* ── Step 5: Success (auto-login banner — navigates before user sees it) ──── */
function SuccessStep() {
  const { language } = useLanguage();
  const T = (key: string) => tDual(key as TranslationKey, language);
  const theme = useTheme();

  return (
    <View style={{ alignItems: "center", paddingVertical: 24 }}>
      <View style={[styles.successCircle, { backgroundColor: `${theme.primary}18`, borderColor: `${theme.primary}40` }]}>
        <Text style={{ fontSize: 40 }}>🎉</Text>
      </View>
      <Text style={[styles.stepTitle, { color: theme.text, marginTop: 16 }]}>{T("welcomeAboard")}</Text>
      <Text style={[styles.stepBody, { color: theme.textMuted, textAlign: "center" }]}>{T("startShoppingNow")}</Text>
    </View>
  );
}

const STEPS: StepConfig[] = [
  {
    id: "phone",
    title: "Phone",
    component: PhoneStep,
    validate: (data) => {
      const phone = String(data.phone ?? "").trim();
      if (!phone) return "Phone number is required";
      if (!isValidPakistaniPhone(phone)) return "Enter a valid Pakistani mobile number (03XXXXXXXXX)";
      return null;
    },
  },
  { id: "otp", title: "Verify", component: OtpStep },
  {
    id: "personal",
    title: "Personal",
    component: PersonalStep,
    validate: (data) => {
      const name = String(data.name ?? "").trim();
      if (!name) return "Full name is required";
      if (name.length < 2) return "Please enter your full name";
      if (!String(data.city ?? "").trim()) return "Please select your city";
      if (!String(data.address ?? "").trim()) return "Full address is required";
      return null;
    },
  },
  {
    id: "password",
    title: "Password",
    component: PasswordStep,
    validate: (data) => {
      const pw = String(data.password ?? "");
      if (!pw) return "Password is required";
      for (const [re, label] of PW_RULES) {
        if (!re.test(pw)) return `Password must contain: ${label}`;
      }
      if (pw !== String(data.confirmPassword ?? "")) return "Passwords do not match";
      return null;
    },
  },
  { id: "success", title: "Done", component: SuccessStep },
];

export interface RegisterWizardProps {
  onDone?: () => void;
}

export function RegisterWizard({ onDone }: RegisterWizardProps) {
  const theme = useTheme();
  const { sendOtp } = useAuth();
  const { login } = useAuthContext();
  const { language } = useLanguage();
  const T = (key: string) => tDual(key as TranslationKey, language);

  const [draft, setDraft] = useState<Record<string, unknown>>({});
  const [pendingPayload, setPendingPayload] = useState<Record<string, unknown> | null>(null);
  const retryingRef = useRef(false);

  /* ── Load draft on mount ── */
  useEffect(() => {
    AsyncStorage.getItem(DRAFT_KEY).then(raw => {
      if (raw) setDraft(JSON.parse(raw));
    }).catch(() => {});

    /* Load any queued (offline) payload */
    AsyncStorage.getItem(PENDING_KEY).then(raw => {
      if (raw) setPendingPayload(JSON.parse(raw) as Record<string, unknown>);
    }).catch(() => {});
  }, []);

  /* ── Auto-retry queued registration when app comes to foreground / online ── */
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void tryRetryPending();
    });
    return () => sub.remove();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Save draft, excluding sensitive fields ── */
  const handleDataChange = useCallback((key: string, value: unknown) => {
    setDraft(prev => {
      const next = { ...prev, [key]: value };
      const { password: _pw, confirmPassword: _cpw, otp: _otp, ...safe } = next as Record<string, unknown>;
      AsyncStorage.setItem(DRAFT_KEY, JSON.stringify(safe)).catch(() => {});
      return next;
    });
  }, []);

  /* ── Auto-login helper: store token and navigate to dashboard ── */
  const doAutoLogin = useCallback(async (
    responseData: Record<string, unknown>,
    formData: Record<string, unknown>,
  ) => {
    const token = responseData.token as string | undefined;
    const refreshToken = responseData.refreshToken as string | undefined;
    if (!token) return;

    const user: AppUser = {
      id: (responseData.userId as string) ?? "",
      phone: String(formData.phone ?? ""),
      name: String(formData.name ?? ""),
      role: ((responseData.role as string) ?? "customer") as AppUser["role"],
      walletBalance: 0,
      isActive: true,
      createdAt: new Date().toISOString(),
      city: String(formData.city ?? "") || undefined,
      address: String(formData.address ?? "") || undefined,
    };

    await login(user, token, refreshToken);
    await AsyncStorage.removeItem(DRAFT_KEY);
    await AsyncStorage.removeItem(PENDING_KEY);
  }, [login]);

  /* ── Retry a previously-queued payload (offline → online) ── */
  const tryRetryPending = useCallback(async () => {
    const raw = await AsyncStorage.getItem(PENDING_KEY).catch(() => null);
    if (!raw || retryingRef.current) return;
    let payload: Record<string, unknown>;
    try { payload = JSON.parse(raw) as Record<string, unknown>; } catch { return; }
    retryingRef.current = true;
    try {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(15_000),
      });
      if (res.ok) {
        const json = await res.json() as Record<string, unknown>;
        const data = (json.data ?? json) as Record<string, unknown>;
        setPendingPayload(null);
        await doAutoLogin(data, payload);
        onDone?.();
        router.replace("/(tabs)");
      }
    } catch {
      /* still offline — leave queued */
    } finally {
      retryingRef.current = false;
    }
  }, [doAutoLogin, onDone]);

  const handleOtpRequest = async (phone: string) => {
    const result = await sendOtp(phone);
    return result.success;
  };

  const handleSubmit = async (data: Record<string, unknown>) => {
    const payload: Record<string, unknown> = {
      name: data.name,
      phone: data.phone,
      city: data.city,
      address: data.address,
      password: data.password,
      role: "customer",
    };

    try {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(15_000),
      });
      const json = await res.json() as Record<string, unknown>;
      if (!res.ok) throw new Error((json.message as string) ?? "Registration failed");

      const responseData = (json.data ?? json) as Record<string, unknown>;

      /* Auto-login: store token and set auth state immediately */
      await doAutoLogin(responseData, data);

      return { success: true, data: json };
    } catch (err: unknown) {
      /* Network failure — queue locally, show retry banner */
      if (isNetworkError(err)) {
        const { password: _pw, ...safePayload } = payload;
        void _pw;
        await AsyncStorage.setItem(PENDING_KEY, JSON.stringify(safePayload)).catch(() => {});
        setPendingPayload(safePayload);
        return {
          success: false,
          error: "No internet connection. Your details are saved and will be submitted automatically when you're back online.",
        };
      }
      return { success: false, error: err instanceof Error ? err.message : T("registrationFailed") as string };
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {pendingPayload && (
        <View style={[styles.offlineBanner, { borderColor: "#F0B90B55", backgroundColor: "#F0B90B11" }]}>
          <Text style={{ fontSize: 16 }}>📶</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ color: "#F0B90B", fontWeight: "700", fontSize: 13 }}>Registration queued — waiting for connection</Text>
            <Text style={{ color: theme.textMuted, fontSize: 12, marginTop: 2 }}>
              Your details are saved and will be submitted when you're back online.
            </Text>
          </View>
          <TouchableOpacity
            onPress={tryRetryPending}
            style={[styles.retryBtn, { borderColor: "#F0B90B66" }]}
            activeOpacity={0.7}
          >
            <Text style={{ color: "#F0B90B", fontSize: 12, fontWeight: "700" }}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}
      <RegisterScreen
        role="customer"
        steps={STEPS}
        initialData={draft}
        onDataChange={handleDataChange}
        onOtpRequest={handleOtpRequest}
        onSubmit={handleSubmit}
        onDone={() => { onDone?.(); router.replace("/(tabs)"); }}
        title={T("customerRegistration") as string}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  stepTitle: { fontSize: 22, fontWeight: "800", marginBottom: 4 },
  stepBody: { fontSize: 14, lineHeight: 22, marginBottom: 8 },
  fieldLabel: { fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.7 },
  input: {
    width: "100%", height: 52, borderWidth: 1, borderRadius: 14,
    paddingHorizontal: 16, fontSize: 16,
  },
  otpBox: {
    width: 48, height: 56, borderWidth: 1, borderRadius: 12,
    fontSize: 20, fontWeight: "700", textAlign: "center",
  },
  cityBtn: {
    borderWidth: 1, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 16,
  },
  successCircle: {
    width: 88, height: 88, borderRadius: 44, borderWidth: 1,
    alignItems: "center", justifyContent: "center",
  },
  eyeBtn: {
    position: "absolute", right: 14,
    top: 0, bottom: 0, justifyContent: "center",
  },
  offlineBanner: {
    flexDirection: "row", alignItems: "center", gap: 10,
    margin: 16, padding: 12, borderRadius: 12, borderWidth: 1,
  },
  retryBtn: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 8, borderWidth: 1,
  },
});
