import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import {
  InputField,
  PasswordStrengthBar,
  AlertBox,
  AuthButton,
  authColors as C,
} from "@/components/auth-shared";
import { useLanguage } from "@/context/LanguageContext";
import { tDual, type TranslationKey } from "@workspace/i18n";
import { API_BASE as API } from "@/utils/api";
import { isValidPakistaniCnic } from "@/utils/cnic";
import type { StepBaseProps } from "./types";

type TextStyle = import("react-native").TextStyle;
type ViewStyle = import("react-native").ViewStyle;

const STEP_HEADER: ViewStyle = {
  flexDirection: "row",
  alignItems: "center",
  gap: 12,
  backgroundColor: "#EFF6FF",
  borderRadius: 16,
  padding: 14,
  marginBottom: 20,
  borderWidth: 1,
  borderColor: "#BFDBFE",
};
const STEP_HEADER_ICON: ViewStyle = {
  width: 40,
  height: 40,
  borderRadius: 12,
  backgroundColor: "#DBEAFE",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
};
const STEP_HEADER_TITLE: TextStyle = {
  fontFamily: "Inter_700Bold",
  fontSize: 15,
  color: "#111827",
  marginBottom: 2,
};
const STEP_HEADER_SUB: TextStyle = {
  fontFamily: "Inter_400Regular",
  fontSize: 13,
  color: "#6B7280",
  lineHeight: 16,
};
const FIELD_HINT: TextStyle = {
  fontFamily: "Inter_400Regular",
  fontSize: 13,
  color: C.textMuted,
  marginTop: -8,
  marginBottom: 12,
  paddingLeft: 2,
};
const TERMS_ROW: ViewStyle = {
  flexDirection: "row",
  alignItems: "flex-start",
  gap: 10,
  paddingVertical: 8,
  marginBottom: 12,
};
const CHECKBOX: ViewStyle = {
  width: 22,
  height: 22,
  borderRadius: 7,
  borderWidth: 2,
  borderColor: C.border,
  alignItems: "center",
  justifyContent: "center",
  marginTop: 1,
};
const CHECKBOX_CHECKED: ViewStyle = {
  backgroundColor: C.primary,
  borderColor: C.primary,
};
const TERMS_TEXT: TextStyle = {
  flex: 1,
  fontFamily: "Inter_400Regular",
  fontSize: 13,
  color: C.textSecondary,
  lineHeight: 19,
};
const MISMATCH_TEXT: TextStyle = {
  fontFamily: "Inter_400Regular",
  fontSize: 13,
  color: C.danger,
  marginTop: -8,
  marginBottom: 12,
  paddingLeft: 4,
};
const INLINE_ERROR_TEXT: TextStyle = {
  fontFamily: "Inter_400Regular",
  fontSize: 13,
  color: C.danger,
  marginTop: -8,
  marginBottom: 12,
  paddingLeft: 4,
};

function formatCnic(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 13);
  if (digits.length <= 5) return digits;
  if (digits.length <= 12) return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  return `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12)}`;
}

interface StepSecurityProps extends StepBaseProps {
  authToken: string;
  onProfileComplete: () => void;
}

export default function StepSecurity({
  data,
  onChange,
  onError,
  onClearError,
  loading,
  onLoadingChange,
  error,
  authToken,
  onProfileComplete,
}: StepSecurityProps) {
  const { language } = useLanguage();
  const T = (key: TranslationKey) => tDual(key, language);
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);
  const [cnicError, setCnicError] = useState("");

  const validate = (): boolean => {
    if (!data.password || data.password.length < 8) { onError(T("passwordMinLength")); return false; }
    if (!/[A-Z]/.test(data.password)) { onError("Password must contain at least 1 uppercase letter"); return false; }
    if (!/[0-9]/.test(data.password)) { onError("Password must contain at least 1 number"); return false; }
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(data.password)) { onError("Password must contain at least 1 special character (e.g. !@#$%)"); return false; }
    if (data.password !== data.confirmPassword) { onError(T("passwordsDoNotMatch")); return false; }
    if (data.cnic) {
      if (!isValidPakistaniCnic(data.cnic)) {
        setCnicError("Invalid CNIC number");
        onError("Invalid CNIC number");
        return false;
      }
    }
    if (!data.termsAccepted) { onError("Please accept the Terms & Conditions"); return false; }
    return true;
  };

  const handleCnicChange = (v: string) => {
    const formatted = formatCnic(v);
    onChange({ cnic: formatted });
    onClearError();
    if (formatted.replace(/\D/g, "").length === 13) {
      if (!isValidPakistaniCnic(formatted)) {
        setCnicError("Invalid CNIC number");
      } else {
        setCnicError("");
      }
    } else {
      setCnicError("");
    }
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    onLoadingChange(true);
    try {
      let activeToken = authToken;
      if (!activeToken) {
        try {
          const SecureStore = await import("expo-secure-store");
          activeToken = await SecureStore.getItemAsync("ajkmart_reg_token") || "";
        } catch {}
      }
      if (!activeToken) {
        onError("Session expired. Please go back and verify OTP again.");
        onLoadingChange(false);
        return;
      }

      const profileRes = await fetch(`${API}/auth/complete-profile`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${activeToken}` },
        body: JSON.stringify({
          name: data.name.trim(),
          username: data.username.trim(),
          ...(data.email && { email: data.email.trim().toLowerCase() }),
          ...(data.cnic && { cnic: data.cnic.trim() }),
          ...(data.city && { city: data.city }),
          ...(data.area && { area: data.area.trim() }),
          ...(data.address && { address: data.address.trim() }),
          ...(data.latitude && { latitude: data.latitude }),
          ...(data.longitude && { longitude: data.longitude }),
          password: data.password,
        }),
      });
      const profileData = await profileRes.json();

      if (!profileRes.ok) {
        onError(profileData.error || "Could not save profile. Please try again.");
        onLoadingChange(false);
        return;
      }
      onProfileComplete();
    } catch (e: unknown) { onError(e instanceof Error ? e.message : "Could not save profile."); }
    onLoadingChange(false);
  };

  return (
    <View>
      <View style={STEP_HEADER}>
        <View style={STEP_HEADER_ICON}>
          <Ionicons name="shield-checkmark-outline" size={20} color="#0066FF" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={STEP_HEADER_TITLE}>Secure Your Account</Text>
          <Text style={STEP_HEADER_SUB}>Create a strong password to protect your account</Text>
        </View>
      </View>

      <View>
        <Text style={{ fontFamily: "Inter_500Medium", fontSize: 13, color: C.textSecondary, marginBottom: 8 }}>
          CNIC / National ID
        </Text>
        <InputField
          value={data.cnic}
          onChangeText={handleCnicChange}
          placeholder="XXXXX-XXXXXXX-X"
          keyboardType="numeric"
          maxLength={15}
          error={!!cnicError}
        />
        {!!cnicError ? (
          <Text style={INLINE_ERROR_TEXT}>{cnicError}</Text>
        ) : (
          <Text style={FIELD_HINT}>Optional — for KYC verification and Gold account</Text>
        )}
      </View>

      <InputField
        label={T("passwordRequired")}
        value={data.password}
        onChangeText={v => { onChange({ password: v }); onClearError(); }}
        placeholder="Minimum 8 characters"
        secureTextEntry={!showPwd}
        rightIcon={showPwd ? "eye-off-outline" : "eye-outline"}
        onRightIconPress={() => setShowPwd(v => !v)}
      />
      <PasswordStrengthBar password={data.password} />

      <InputField
        label="Confirm Password *"
        value={data.confirmPassword}
        onChangeText={v => { onChange({ confirmPassword: v }); onClearError(); }}
        placeholder="Re-enter your password"
        secureTextEntry={!showConfirmPwd}
        rightIcon={showConfirmPwd ? "eye-off-outline" : "eye-outline"}
        onRightIconPress={() => setShowConfirmPwd(v => !v)}
        error={!!data.confirmPassword && data.password !== data.confirmPassword}
      />
      {!!data.confirmPassword && data.password !== data.confirmPassword && (
        <Text style={MISMATCH_TEXT}>{T("passwordsDoNotMatch")}</Text>
      )}

      <Pressable
        onPress={() => onChange({ termsAccepted: !data.termsAccepted })}
        style={TERMS_ROW}
        accessibilityLabel="Accept Terms and Conditions"
        accessibilityRole="checkbox"
        accessibilityState={{ checked: data.termsAccepted }}
      >
        <View style={[CHECKBOX, data.termsAccepted && CHECKBOX_CHECKED]}>
          {data.termsAccepted && <Ionicons name="checkmark" size={14} color="#fff" />}
        </View>
        <Text style={TERMS_TEXT}>
          I agree to the <Text style={{ color: C.primary }}>Terms & Conditions</Text> and{" "}
          <Text style={{ color: C.primary }}>Privacy Policy</Text>
        </Text>
      </Pressable>

      {error ? <AlertBox type="error" message={error} /> : null}

      <AuthButton
        label="Create Account"
        onPress={handleSubmit}
        loading={loading}
        disabled={!data.termsAccepted}
        style={{ opacity: data.termsAccepted ? 1 : 0.45 }}
        icon="shield-checkmark-outline"
      />
    </View>
  );
}
