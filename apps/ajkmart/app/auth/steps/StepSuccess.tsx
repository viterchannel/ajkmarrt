import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React from "react";
import { ScrollView, Text, View } from "react-native";
import { AuthButton, authColors as C } from "@/components/auth-shared";
import { useAuth, type AppUser } from "@/context/AuthContext";
import { usePlatformConfig } from "@/context/PlatformConfigContext";
import { clearDraft } from "@/lib/auth/register-draft";
import { trackEvent } from "@/utils/analytics";

type TextStyle = import("react-native").TextStyle;
type ViewStyle = import("react-native").ViewStyle;

const SUCCESS_SCROLL: ViewStyle = {
  flexGrow: 1,
  justifyContent: "center",
  alignItems: "center",
  padding: 24,
};
const SUCCESS_CARD: ViewStyle = {
  backgroundColor: C.surface,
  borderRadius: 24,
  padding: 32,
  alignItems: "center",
  width: "100%",
};
const SUCCESS_ICON_CIRCLE: ViewStyle = {
  width: 72,
  height: 72,
  borderRadius: 36,
  backgroundColor: C.success,
  alignItems: "center",
  justifyContent: "center",
};
const SUCCESS_TITLE: TextStyle = {
  fontFamily: "Inter_700Bold",
  fontSize: 22,
  color: C.text,
  marginBottom: 8,
  textAlign: "center",
};
const SUCCESS_SUB: TextStyle = {
  fontFamily: "Inter_400Regular",
  fontSize: 15,
  color: C.textMuted,
  textAlign: "center",
  marginBottom: 20,
  lineHeight: 22,
};
const LEVEL_BADGE: ViewStyle = {
  flexDirection: "row",
  alignItems: "center",
  borderRadius: 16,
  padding: 16,
  borderWidth: 1.5,
  marginBottom: 16,
  width: "100%",
};
const LEVEL_TITLE: TextStyle = {
  fontFamily: "Inter_700Bold",
  fontSize: 16,
  marginBottom: 2,
};
const LEVEL_DESC: TextStyle = {
  fontFamily: "Inter_400Regular",
  fontSize: 13,
  color: C.textSecondary,
};
const BONUS_BANNER: ViewStyle = {
  flexDirection: "row",
  alignItems: "center",
  backgroundColor: "#FFF4E5",
  borderRadius: 16,
  padding: 16,
  marginBottom: 16,
  borderWidth: 1,
  borderColor: "#FFD580",
  width: "100%",
};
const BONUS_ICON_WRAP: ViewStyle = {
  width: 40,
  height: 40,
  borderRadius: 20,
  backgroundColor: "#FFF4E5",
  alignItems: "center",
  justifyContent: "center",
  marginRight: 12,
};
const BONUS_TITLE: TextStyle = {
  fontFamily: "Inter_600SemiBold",
  fontSize: 15,
  color: C.text,
  marginBottom: 2,
};
const BONUS_SUB: TextStyle = {
  fontFamily: "Inter_400Regular",
  fontSize: 13,
  color: C.textSecondary,
};
const KYC_PROMPT: ViewStyle = {
  flexDirection: "row",
  alignItems: "center",
  gap: 10,
  backgroundColor: `${C.primary}08`,
  borderRadius: 12,
  padding: 12,
  marginBottom: 20,
  width: "100%",
  borderWidth: 1,
  borderColor: `${C.primary}20`,
};
const KYC_TEXT: TextStyle = {
  flex: 1,
  fontFamily: "Inter_400Regular",
  fontSize: 13,
  color: C.primary,
  lineHeight: 18,
};

const LEVEL_CONFIG: Record<string, { color: string; bg: string; icon: string; label: string; desc: string }> = {
  bronze: { color: "#CD7F32", bg: "#FFF3E0", icon: "shield-outline", label: "Bronze", desc: "Complete your profile to unlock more features" },
  silver: { color: "#C0C0C0", bg: "#F5F5F5", icon: "shield-half-outline", label: "Silver", desc: "Add CNIC to upgrade to Gold" },
  gold:   { color: "#FFD700", bg: "#FFFDE7", icon: "shield-checkmark-outline", label: "Gold", desc: "Full access to all features" },
};

interface StepSuccessProps {
  user: AppUser | null;
  token: string;
  refreshToken: string;
  loading: boolean;
  onLoadingChange: (v: boolean) => void;
}

export default function StepSuccess({ user, token, refreshToken, loading, onLoadingChange }: StepSuccessProps) {
  const { login } = useAuth();
  const { config } = usePlatformConfig();
  const signupBonus = config.customer.signupBonus;

  const accountLevel = user?.accountLevel || "bronze";
  const levelInfo = LEVEL_CONFIG[accountLevel] || LEVEL_CONFIG.bronze;

  const handleFinish = async () => {
    onLoadingChange(true);
    try {
      if (token && user) {
        const userData = {
          ...user,
          walletBalance: user.walletBalance ?? 0,
          isActive: user.isActive ?? true,
          createdAt: user.createdAt ?? new Date().toISOString(),
        };
        await login(userData, token, refreshToken || undefined);
        trackEvent("signup_success");
        await clearDraft();
        try {
          const SecureStore = await import("expo-secure-store");
          await SecureStore.deleteItemAsync("ajkmart_reg_token");
        } catch {}
        router.replace("/(tabs)");
      } else {
        router.replace("/auth");
      }
    } catch (e: unknown) {
      if (__DEV__) console.warn("Login after registration failed:", e instanceof Error ? e.message : e);
      router.replace("/auth");
    }
    onLoadingChange(false);
  };

  return (
    <LinearGradient colors={["#0047B3", "#0066FF", "#4D94FF"]} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={SUCCESS_SCROLL}>
        <View style={SUCCESS_CARD}>
          <View style={{ marginBottom: 16 }}>
            <View style={SUCCESS_ICON_CIRCLE}>
              <Ionicons name="checkmark" size={40} color="#fff" />
            </View>
          </View>
          <Text style={SUCCESS_TITLE}>Registration Successful!</Text>
          <Text style={SUCCESS_SUB}>
            Welcome to {config.platform.appName}! Your account is ready.
          </Text>

          <View style={[LEVEL_BADGE, { backgroundColor: levelInfo.bg, borderColor: levelInfo.color }]}>
            <Ionicons name={levelInfo.icon as any} size={28} color={levelInfo.color} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[LEVEL_TITLE, { color: levelInfo.color }]}>{levelInfo.label} Account</Text>
              <Text style={LEVEL_DESC}>{levelInfo.desc}</Text>
            </View>
          </View>

          {signupBonus > 0 && (
            <View style={BONUS_BANNER}>
              <View style={BONUS_ICON_WRAP}>
                <Ionicons name="gift" size={22} color={C.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={BONUS_TITLE}>Welcome Bonus!</Text>
                <Text style={BONUS_SUB}>Rs. {signupBonus} has been added to your wallet</Text>
              </View>
            </View>
          )}

          {accountLevel !== "gold" && (
            <View style={KYC_PROMPT}>
              <Ionicons name="document-text-outline" size={20} color={C.primary} />
              <Text style={KYC_TEXT}>
                Complete KYC verification to unlock Gold benefits and higher limits
              </Text>
            </View>
          )}

          <AuthButton label="Start Shopping" onPress={handleFinish} loading={loading} icon="cart-outline" />
        </View>
      </ScrollView>
    </LinearGradient>
  );
}
