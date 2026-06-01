import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

interface AnnouncementBarProps {
  message: string;
  onDismiss?: () => void;
  warning?: boolean;
}

export function AnnouncementBar({ message, onDismiss, warning = false }: AnnouncementBarProps) {
  if (!message) return null;

  return (
    <View style={[s.bar, warning && s.barWarning]} accessibilityRole="alert">
      <View style={s.iconWrap}>
        <Ionicons name={warning ? "warning" : "megaphone"} size={11} color="#fff" />
      </View>
      <Text style={s.text} numberOfLines={2}>{message}</Text>
      {onDismiss && (
        <Pressable
          onPress={onDismiss}
          style={s.closeBtn}
          accessibilityRole="button"
          accessibilityLabel="Dismiss announcement"
          hitSlop={8}
        >
          <Ionicons name="close" size={15} color="rgba(255,255,255,0.85)" />
        </Pressable>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  bar: {
    backgroundColor: "#0047B3",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 8,
  },
  barWarning: {
    backgroundColor: "#D97706",
  },
  iconWrap: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  text: {
    flex: 1,
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: "#fff",
    lineHeight: 17,
  },
  closeBtn: {
    padding: 4,
  },
});
