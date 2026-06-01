import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Linking from "expo-linking";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { tDual, type TranslationKey } from "@workspace/i18n";
import Colors, { spacing } from "@/constants/colors";

export default function SuspendedRouteScreen() {
  const { suspendedMessage, clearSuspended } = useAuth();
  const { language } = useLanguage();
  const T = (key: TranslationKey) => tDual(key, language);
  const insets = useSafeAreaInsets();

  return (
    <View style={[s.root, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 24 }]}>
      <View style={s.iconWrap}>
        <Text style={s.icon}>🚫</Text>
      </View>
      <Text style={s.title}>{T("accountSuspended")}</Text>
      <Text style={s.message}>
        {suspendedMessage || T("accountSuspendedMsg")}
      </Text>
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => Linking.openURL("mailto:support@ajkmart.pk?subject=Account%20Suspended")}
        style={s.supportBtn}
      >
        <Text style={s.supportBtnTxt}>{T("contactSupport")}</Text>
      </TouchableOpacity>
      <TouchableOpacity activeOpacity={0.7} onPress={clearSuspended} style={s.btn}>
        <Text style={s.btnTxt}>{T("signOutLabel")}</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#FEF2F2", alignItems: "center", paddingHorizontal: 32 },
  iconWrap: { width: 90, height: 90, borderRadius: 45, backgroundColor: "#FEE2E2", alignItems: "center", justifyContent: "center", marginBottom: 24 },
  icon: { fontSize: 44 },
  title: { fontFamily: "Inter_700Bold", fontSize: 22, color: "#991B1B", textAlign: "center", marginBottom: 12 },
  message: { fontFamily: "Inter_400Regular", fontSize: 14, color: "#7F1D1D", textAlign: "center", lineHeight: 22, marginBottom: 32 },
  supportBtn: { backgroundColor: "#fff", borderRadius: 14, paddingVertical: 14, paddingHorizontal: 32, alignItems: "center", marginBottom: 12, borderWidth: 1, borderColor: "#DC2626", width: "100%" },
  supportBtnTxt: { fontFamily: "Inter_700Bold", fontSize: 15, color: "#DC2626" },
  btn: { backgroundColor: "#DC2626", borderRadius: 14, paddingVertical: 14, paddingHorizontal: 32, alignItems: "center", width: "100%" },
  btnTxt: { fontFamily: "Inter_700Bold", fontSize: 15, color: "#fff" },
});
