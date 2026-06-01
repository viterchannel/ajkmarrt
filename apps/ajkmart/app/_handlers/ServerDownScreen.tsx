import { Ionicons } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { usePlatformConfig } from "@/context/PlatformConfigContext";
import { createLogger } from "@/utils/logger";

const log = createLogger("[ServerDownScreen]");

export function ServerDownScreen() {
  const { config } = usePlatformConfig();

  const supportContact =
    (config as unknown as { supportContact?: string }).supportContact ||
    config.platform.supportPhone ||
    config.platform.supportEmail;

  const message =
    (config as unknown as { maintenanceMessage?: string }).maintenanceMessage ||
    config.content.maintenanceMsg ||
    "The server is temporarily unavailable. Our team is working to restore service.";

  const handleContact = () => {
    if (!supportContact) return;
    const url = supportContact.startsWith("http")
      ? supportContact
      : supportContact.includes("@")
      ? `mailto:${supportContact}`
      : `tel:${supportContact}`;
    Linking.openURL(url).catch((err) =>
      log.warn("Cannot open support URL:", err),
    );
  };

  return (
    <View style={s.root}>
      <View style={s.illustrationWrap}>
        <View style={s.iconCircle}>
          <Ionicons name="cloud-offline-outline" size={64} color="#94A3B8" />
        </View>
      </View>

      <Text style={s.title}>Service Unavailable</Text>
      <Text style={s.message}>{message}</Text>

      {supportContact ? (
        <Pressable onPress={handleContact} style={s.contactBtn} accessibilityRole="button">
          <Ionicons name="headset-outline" size={18} color="#fff" />
          <Text style={s.contactTxt}>Contact Support</Text>
        </Pressable>
      ) : null}

      <Text style={s.note}>
        Please check back later. We apologize for the inconvenience.
      </Text>
    </View>
  );
}

export default null;

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  illustrationWrap: {
    marginBottom: 32,
  },
  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontFamily: "Inter_700Bold",
    fontSize: 24,
    color: "#0F172A",
    textAlign: "center",
    marginBottom: 14,
  },
  message: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 23,
    marginBottom: 32,
  },
  contactBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#1A56DB",
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 14,
    marginBottom: 20,
  },
  contactTxt: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: "#fff",
  },
  note: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: "#94A3B8",
    textAlign: "center",
  },
});
