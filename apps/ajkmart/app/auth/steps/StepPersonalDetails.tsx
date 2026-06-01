import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import {
  InputField,
  authColors as C,
} from "@/components/auth-shared";
import { API_BASE as API } from "@/utils/api";
import type { RegisterData, StepBaseProps } from "./types";

type TextStyle = import("react-native").TextStyle;
type ViewStyle = import("react-native").ViewStyle;

export function validatePersonalDetails(data: RegisterData): string | null {
  if (!data.name.trim() || data.name.trim().length < 2) return "Please enter your name (at least 2 characters)";
  if (!data.username || data.username.length < 3) return "Please choose a username (at least 3 characters)";
  if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email.trim())) return "Please enter a valid email address";
  return null;
}

const STEP_HEADER: ViewStyle = {
  flexDirection: "row",
  alignItems: "center",
  gap: 12,
  backgroundColor: "#ECFDF5",
  borderRadius: 16,
  padding: 14,
  marginBottom: 20,
  borderWidth: 1,
  borderColor: "#A7F3D0",
};
const STEP_HEADER_ICON: ViewStyle = {
  width: 40,
  height: 40,
  borderRadius: 12,
  backgroundColor: "#D1FAE5",
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
const USERNAME_HINT: TextStyle = {
  fontFamily: "Inter_400Regular",
  fontSize: 13,
  color: C.textMuted,
  marginTop: -8,
  marginBottom: 12,
  paddingLeft: 2,
};
const USERNAME_CHECK_ROW: ViewStyle = {
  flexDirection: "row",
  alignItems: "center",
  gap: 6,
  marginTop: -8,
  marginBottom: 12,
  paddingLeft: 2,
};
const USERNAME_CHECK_TEXT: TextStyle = {
  fontFamily: "Inter_400Regular",
  fontSize: 13,
  color: C.primary,
};

export default function StepPersonalDetails({ data, onChange, onError, onClearError, error }: StepBaseProps) {
  const [usernameStatus, setUsernameStatus] = useState<"" | "checking" | "available" | "taken">("");
  const usernameTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (usernameTimerRef.current) clearTimeout(usernameTimerRef.current);
    };
  }, []);

  const handleUsernameChange = (val: string) => {
    const clean = val.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 20);
    onChange({ username: clean });
    onClearError();
    setUsernameStatus("");
    if (usernameTimerRef.current) clearTimeout(usernameTimerRef.current);
    if (clean.length >= 3) {
      usernameTimerRef.current = setTimeout(async () => {
        setUsernameStatus("checking");
        try {
          const res = await fetch(`${API}/auth/check-available`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username: clean }),
          });
          const resData = await res.json();
          if (resData?.username?.available) {
            setUsernameStatus("available");
          } else {
            setUsernameStatus("taken");
          }
        } catch {
          setUsernameStatus("");
        }
      }, 500);
    }
  };

  const isReady = (): boolean => {
    if (usernameStatus === "taken") { onError("This username is already taken. Please choose another."); return false; }
    if (usernameStatus === "checking") { onError("Please wait — checking username availability…"); return false; }
    if (usernameStatus === "") { onError("Please wait a moment for the username check to complete."); return false; }
    if (usernameStatus !== "available") { onError("Username is not available. Please choose another."); return false; }
    const baseErr = validatePersonalDetails(data);
    if (baseErr) { onError(baseErr); return false; }
    return true;
  };

  return (
    <View>
      <View style={STEP_HEADER}>
        <View style={STEP_HEADER_ICON}>
          <Ionicons name="person-outline" size={20} color="#059669" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={STEP_HEADER_TITLE}>Personal Details</Text>
          <Text style={STEP_HEADER_SUB}>Tell us your name and how to reach you</Text>
        </View>
      </View>

      <InputField
        label="Full Name *"
        value={data.name}
        onChangeText={v => { onChange({ name: v }); onClearError(); }}
        placeholder="Enter your full name"
        autoCapitalize="words"
        autoFocus
        error={!!error && !data.name.trim()}
      />
      <View>
        <InputField
          label="Username *"
          value={data.username}
          onChangeText={handleUsernameChange}
          placeholder="e.g. ahmed_khan92"
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={20}
          error={usernameStatus === "taken" || (!!error && data.username.length < 3)}
          rightIcon={
            usernameStatus === "available" ? "checkmark-circle" :
            usernameStatus === "taken" ? "close-circle" :
            undefined
          }
          rightIconColor={usernameStatus === "available" ? C.success : C.danger}
        />
        {usernameStatus === "checking" && (
          <View style={USERNAME_CHECK_ROW}>
            <ActivityIndicator size="small" color={C.primary} />
            <Text style={USERNAME_CHECK_TEXT}>Checking availability...</Text>
          </View>
        )}
        {usernameStatus === "available" && (
          <Text style={[USERNAME_HINT, { color: C.success }]}>Username is available!</Text>
        )}
        {usernameStatus === "taken" && (
          <Text style={[USERNAME_HINT, { color: C.danger }]}>Username already taken</Text>
        )}
        {!usernameStatus && (
          <Text style={USERNAME_HINT}>Letters, numbers, underscore only. Min 3 characters.</Text>
        )}
      </View>
      <InputField
        label="Email (Optional)"
        value={data.email}
        onChangeText={v => { onChange({ email: v }); onClearError(); }}
        placeholder="email@example.com"
        keyboardType="email-address"
        autoCapitalize="none"
        error={!!error && !!data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email.trim())}
      />
    </View>
  );
}

