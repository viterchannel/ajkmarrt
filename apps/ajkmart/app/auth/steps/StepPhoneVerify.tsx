import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import {
  OtpDigitInput,
  AuthButton,
  AlertBox,
  PhoneInput,
  DevOtpBanner,
  authColors as C,
} from "@/components/auth-shared";
import { isValidPakistaniPhone, normalizePhone } from "@/utils/phone";
import { API_BASE as API } from "@/utils/api";
import { router } from "expo-router";
import type { StepPhoneVerifyProps } from "./types";

const FIELD_LABEL: TextStyle = {
  fontFamily: "Inter_500Medium",
  fontSize: 13,
  color: C.textSecondary,
  marginBottom: 8,
};
const FIELD_SUB: TextStyle = {
  fontFamily: "Inter_400Regular",
  fontSize: 13,
  color: C.textMuted,
  marginBottom: 12,
};
const RESEND_BTN: ViewStyle = {
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  paddingVertical: 10,
  marginBottom: 12,
};
const RESEND_TEXT: TextStyle = {
  fontFamily: "Inter_500Medium",
  fontSize: 14,
  color: C.primary,
};
const CHANGE_BTN: ViewStyle = {
  flexDirection: "row",
  alignItems: "center",
  gap: 5,
  marginBottom: 12,
};
const CHANGE_TEXT: TextStyle = {
  fontFamily: "Inter_500Medium",
  fontSize: 14,
  color: C.primary,
};
const STEP_HEADER: ViewStyle = {
  flexDirection: "row",
  alignItems: "center",
  gap: 12,
  backgroundColor: "#EFF6FF",
  borderRadius: 16,
  padding: 14,
  marginBottom: 20,
  borderWidth: 1,
  borderColor: "#DBEAFE",
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
  color: C.text,
  marginBottom: 2,
};
const STEP_HEADER_SUB: TextStyle = {
  fontFamily: "Inter_400Regular",
  fontSize: 13,
  color: C.textMuted,
  lineHeight: 16,
};
const COUNTDOWN_TEXT: TextStyle = {
  fontFamily: "Inter_500Medium",
  fontSize: 13,
  color: C.danger,
  textAlign: "center",
  marginBottom: 8,
};
const MAX_RESEND_TEXT: TextStyle = {
  fontFamily: "Inter_400Regular",
  fontSize: 13,
  color: C.textMuted,
  textAlign: "center",
  marginBottom: 12,
  paddingHorizontal: 8,
};
const LINK_TEXT: TextStyle = {
  fontFamily: "Inter_600SemiBold",
  fontSize: 14,
  color: C.primary,
  textDecorationLine: "underline",
  textAlign: "center",
  marginBottom: 12,
};
const RETRY_BTN: ViewStyle = {
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  paddingVertical: 10,
  marginBottom: 8,
};

type TextStyle = import("react-native").TextStyle;
type ViewStyle = import("react-native").ViewStyle;

const MAX_RESENDS = 3;

function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export default function StepPhoneVerify({
  data,
  onChange,
  onError,
  onClearError,
  loading,
  onLoadingChange,
  error,
  onOtpVerified,
}: StepPhoneVerifyProps) {
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [devOtp, setDevOtp] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendCount, setResendCount] = useState(0);
  const [lockCountdown, setLockCountdown] = useState(0);
  const [networkError, setNetworkError] = useState(false);
  const [accountExists, setAccountExists] = useState(false);

  const lastActionRef = useRef<"send" | "verify">("send");

  const normalizedPhone = normalizePhone(data.phone);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  useEffect(() => {
    if (lockCountdown <= 0) return;
    const t = setTimeout(() => setLockCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [lockCountdown]);

  const handleSendOtp = async () => {
    onClearError();
    setNetworkError(false);
    setAccountExists(false);
    if (!isValidPakistaniPhone(data.phone)) {
      onError("Please enter a valid Pakistani phone number (e.g. 03XX-XXXXXXX)");
      return;
    }
    if (resendCooldown > 0) return;
    if (resendCount >= MAX_RESENDS) return;
    lastActionRef.current = "send";
    onLoadingChange(true);
    try {
      let checkData: Record<string, unknown>;
      try {
        const checkRes = await fetch(`${API}/auth/check-identifier`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ identifier: `0${normalizedPhone}`, role: "customer" }),
        });
        checkData = await checkRes.json();
        if (!checkRes.ok) {
          if (checkRes.status === 409 || (checkData?.action as string) === "exists") {
            setAccountExists(true);
            onError("An account with this number already exists.");
            onLoadingChange(false);
            return;
          }
          onError((checkData?.error as string) || "Could not verify phone number. Please try again.");
          onLoadingChange(false);
          return;
        }
      } catch {
        setNetworkError(true);
        onError("Network error. Please check your connection and try again.");
        onLoadingChange(false);
        return;
      }
      const action = checkData?.action;
      if (action === "exists") {
        setAccountExists(true);
        onError("An account with this number already exists.");
        onLoadingChange(false);
        return;
      }
      if (action === "registration_closed") {
        onError("New registrations are currently closed. Please try again later.");
        onLoadingChange(false);
        return;
      }
      if (action === "blocked") {
        onError("This phone number has been suspended. Please contact support.");
        onLoadingChange(false);
        return;
      }
      if (action === "locked") {
        const mins = (checkData?.lockedMinutes as number) ?? 0;
        const secs = mins > 0 ? mins * 60 : 60;
        setLockCountdown(secs);
        onError(`Too many attempts. Please try again in ${formatCountdown(secs)}.`);
        onLoadingChange(false);
        return;
      }
      let sendOtpRes: Response;
      let sendOtpData: Record<string, unknown>;
      try {
        sendOtpRes = await fetch(`${API}/auth/send-otp`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone: `0${normalizedPhone}`, role: "customer" }),
        });
        sendOtpData = await sendOtpRes.json();
      } catch {
        setNetworkError(true);
        onError("Network error. Please check your connection and try again.");
        onLoadingChange(false);
        return;
      }
      if (!sendOtpRes.ok) {
        if (sendOtpRes.status === 409 || (sendOtpData.action as string) === "exists") {
          setAccountExists(true);
          onError("An account with this number already exists.");
          onLoadingChange(false);
          return;
        }
        const msg: string = (sendOtpData.error as string) || "Could not send OTP.";
        onError(msg);
        const match = msg.match(/wait (\d+) second/);
        if (match) setResendCooldown(parseInt(match[1]!, 10));
        onLoadingChange(false);
        return;
      }
      if (sendOtpData.otpRequired === false && sendOtpData.accessToken) {
        const SecureStore = await import("expo-secure-store");
        await SecureStore.setItemAsync("ajkmart_reg_token", sendOtpData.accessToken as string);
        onOtpVerified(
          sendOtpData.accessToken as string,
          (sendOtpData.refreshToken as string) || "",
          sendOtpData.user as import("@/context/AuthContext").AppUser
        );
        onLoadingChange(false);
        return;
      }
      if (sendOtpData.otp) setDevOtp(sendOtpData.otp as string);
      setResendCooldown(60);
      if (otpSent) setResendCount(c => c + 1);
      setOtpSent(true);
    } catch (e: unknown) {
      setNetworkError(true);
      onError(e instanceof Error ? e.message : "Could not send OTP.");
    }
    onLoadingChange(false);
  };

  const handleVerifyOtp = async () => {
    onClearError();
    setNetworkError(false);
    if (!otp || otp.length < 6) { onError("Please enter the 6-digit OTP"); return; }
    lastActionRef.current = "verify";
    onLoadingChange(true);
    try {
      let res: Response;
      let verifyData: Record<string, unknown>;
      try {
        res = await fetch(`${API}/auth/verify-otp`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone: normalizedPhone, otp }),
        });
        verifyData = await res.json();
      } catch {
        setNetworkError(true);
        onError("Network error. Please check your connection and try again.");
        onLoadingChange(false);
        return;
      }
      if (!res.ok) { onError((verifyData.error as string) || "Invalid OTP."); onLoadingChange(false); return; }
      if (verifyData.accessToken) {
        const SecureStore = await import("expo-secure-store");
        await SecureStore.setItemAsync("ajkmart_reg_token", verifyData.accessToken as string);
      }
      let user: import("@/context/AuthContext").AppUser | undefined;
      if (verifyData.user) {
        const rawUser = verifyData.user as Record<string, unknown>;
        const rolesStr = typeof rawUser.roles === "string" ? rawUser.roles : "";
        const derivedRole = (rolesStr.split(",")[0]?.trim() || rawUser.role || "customer") as import("@/context/AuthContext").UserRole;
        user = { ...rawUser, role: derivedRole } as import("@/context/AuthContext").AppUser;
      }
      onOtpVerified(verifyData.accessToken as string, (verifyData.refreshToken as string) || "", user!);
    } catch (e: unknown) {
      setNetworkError(true);
      onError(e instanceof Error ? e.message : "Verification failed.");
    }
    onLoadingChange(false);
  };

  const handleRetry = () => {
    if (lastActionRef.current === "verify") {
      void handleVerifyOtp();
    } else {
      void handleSendOtp();
    }
  };

  const handleEnterManually = () => {
    onClearError();
    setNetworkError(false);
    setOtpSent(true);
  };

  const resendMaxReached = resendCount >= MAX_RESENDS;

  return (
    <View>
      <View style={STEP_HEADER}>
        <View style={STEP_HEADER_ICON}>
          <Ionicons name="call-outline" size={20} color="#0066FF" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={STEP_HEADER_TITLE}>Verify Phone</Text>
          <Text style={STEP_HEADER_SUB}>We'll send a one-time code to confirm your number</Text>
        </View>
      </View>

      {!otpSent ? (
        <>
          <Text style={FIELD_LABEL}>Phone Number</Text>
          <PhoneInput
            value={data.phone}
            onChangeText={v => { onChange({ phone: v }); onClearError(); setAccountExists(false); }}
            autoFocus
          />
        </>
      ) : (
        <>
          <Pressable
            onPress={() => { setOtpSent(false); setOtp(""); onClearError(); setNetworkError(false); }}
            style={CHANGE_BTN}
            accessibilityRole="button"
          >
            <Ionicons name="arrow-back" size={14} color={C.primary} />
            <Text style={CHANGE_TEXT}>Change Number</Text>
          </Pressable>

          <Text style={FIELD_LABEL}>Enter Verification Code</Text>
          <Text style={FIELD_SUB}>Code sent to +92 {data.phone}</Text>

          <OtpDigitInput
            value={otp}
            onChangeText={v => { setOtp(v); onClearError(); }}
            hasError={!!error}
            onComplete={() => handleVerifyOtp()}
          />

          <DevOtpBanner otp={devOtp} />

          {resendMaxReached ? (
            <Text style={MAX_RESEND_TEXT}>Maximum resend attempts reached. Contact support.</Text>
          ) : (
            <Pressable
              onPress={handleSendOtp}
              style={[RESEND_BTN, (resendCooldown > 0) && { opacity: 0.5 }]}
              disabled={resendCooldown > 0}
              accessibilityRole="button"
            >
              <Ionicons name="refresh-outline" size={16} color={resendCooldown > 0 ? C.textMuted : C.primary} />
              <Text style={[RESEND_TEXT, resendCooldown > 0 && { color: C.textMuted }]}>
                {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend OTP"}
              </Text>
            </Pressable>
          )}
        </>
      )}

      {lockCountdown > 0 && (
        <Text style={COUNTDOWN_TEXT}>Try again in {formatCountdown(lockCountdown)}</Text>
      )}

      {networkError && (
        <View style={{ marginBottom: 12, alignItems: "center" }}>
          <Pressable onPress={handleRetry} style={RETRY_BTN} accessibilityRole="button">
            <Ionicons name="refresh-circle-outline" size={18} color={C.primary} />
            <Text style={[RESEND_TEXT]}>Retry</Text>
          </Pressable>
          {!otpSent && (
            <Pressable onPress={handleEnterManually} accessibilityRole="button">
              <Text style={LINK_TEXT}>Enter OTP manually</Text>
            </Pressable>
          )}
        </View>
      )}

      {error ? <AlertBox type="error" message={error} /> : null}

      {accountExists && (
        <Pressable onPress={() => router.replace("/auth")} accessibilityRole="link" style={{ marginBottom: 12 }}>
          <Text style={LINK_TEXT}>Login instead?</Text>
        </Pressable>
      )}

      <AuthButton
        label={otpSent ? "Verify OTP" : "Send OTP"}
        onPress={otpSent ? handleVerifyOtp : handleSendOtp}
        loading={loading}
        icon={!otpSent ? "send-outline" : undefined}
      />
    </View>
  );
}
