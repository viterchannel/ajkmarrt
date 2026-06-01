import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth, hasRole, type AppUser } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { tDual, type TranslationKey } from "@workspace/i18n";
import { API_BASE as API } from "@/utils/api";
import { trackEvent } from "@/utils/analytics";
import {
  AuthButton,
  AlertBox,
  InputField,
  authColors as C,
} from "@/components/auth-shared";

export default function MagicLinkCodeScreen() {
  const insets = useSafeAreaInsets();
  const { login, setTwoFactorPending } = useAuth();
  const { language } = useLanguage();
  const T = (key: TranslationKey) => tDual(key, language);

  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleVerify = async () => {
    const token = code.trim();
    if (!token) {
      setError(T("magicLinkCodePlaceholder"));
      return;
    }
    setLoading(true);
    setError("");

    trackEvent("login_attempt", { method: "magic_link_manual" });

    try {
      const res = await fetch(`${API}/auth/magic-link/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();

      if (!res.ok) {
        const errMsg: string = data.error || data.message || "";
        let reason = "magic_link_invalid";
        let userMessage = T("magicLinkCodeInvalid");

        if (errMsg.toLowerCase().includes("expired") || data.code === "EXPIRED") {
          reason = "magic_link_expired";
          userMessage = T("magicLinkCodeExpired");
        } else if (errMsg.toLowerCase().includes("used") || data.code === "USED") {
          reason = "magic_link_used";
          userMessage = T("magicLinkCodeInvalid");
        }

        trackEvent("login_failed_reason", { method: "magic_link_manual", reason });
        setError(userMessage);
        setLoading(false);
        return;
      }

      if (data.requires2FA) {
        setTwoFactorPending({ tempToken: data.tempToken, userId: data.userId });
        router.replace("/auth");
        setLoading(false);
        return;
      }

      if (data.token && data.user) {
        const userData = data.user as AppUser;
        await login(userData, data.token, data.refreshToken);

        trackEvent("login_success", { method: "magic_link_manual" });
        trackEvent("login_method_used", { method: "magic_link" });

        if (!hasRole(userData, "customer")) {
          router.replace("/auth/wrong-app");
        } else {
          router.replace("/(tabs)");
        }
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : T("magicLinkCodeInvalid");
      trackEvent("login_failed_reason", { method: "magic_link_manual", reason: "network_error" });
      setError(msg);
    }
    setLoading(false);
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={s.flex}>
      <LinearGradient colors={[C.primaryDark, C.primary, C.primaryLight]} style={s.flex}>
        <View style={[s.topSection, { paddingTop: insets.top + 32 }]}>
          <View style={s.heroIcon}>
            <Ionicons name="link" size={36} color={C.primary} />
          </View>
          <Text style={s.heroTitle}>{T("magicLinkCodeScreenTitle")}</Text>
          <Text style={s.heroSubtitle}>{T("magicLinkCodeScreenSubtitle")}</Text>
        </View>

        <ScrollView
          style={s.cardScroll}
          contentContainerStyle={s.cardContent}
          keyboardShouldPersistTaps="handled"
        >
          <InputField
            value={code}
            onChangeText={v => { setCode(v); setError(""); }}
            placeholder={T("magicLinkCodePlaceholder")}
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus
            multiline={false}
          />

          {error ? <AlertBox type="error" message={error} /> : null}

          <AuthButton
            label={T("magicLinkVerifyCode")}
            onPress={handleVerify}
            loading={loading}
          />

          <Pressable
            onPress={() => router.back()}
            style={s.backRow}
            accessibilityRole="button"
          >
            <Ionicons name="arrow-back" size={16} color={C.primary} />
            <Text style={s.backRowText}>{T("back")}</Text>
          </Pressable>
        </ScrollView>
      </LinearGradient>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  topSection: { alignItems: "center", paddingBottom: 32 },
  heroIcon: {
    width: 76, height: 76, borderRadius: 24,
    backgroundColor: "#fff", alignItems: "center", justifyContent: "center",
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8,
    elevation: 6, marginBottom: 14,
  },
  heroTitle: { fontFamily: "Inter_700Bold", fontSize: 26, color: "#fff", marginBottom: 6, textAlign: "center" },
  heroSubtitle: { fontFamily: "Inter_400Regular", fontSize: 14, color: "rgba(255,255,255,0.85)", textAlign: "center", paddingHorizontal: 24 },
  cardScroll: { backgroundColor: "#fff", borderTopLeftRadius: 28, borderTopRightRadius: 28, flex: 1 },
  cardContent: { padding: 24, paddingBottom: 40, flexGrow: 1 },
  backRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 12 },
  backRowText: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: C.primary },
});
