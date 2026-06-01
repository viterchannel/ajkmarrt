import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from "@expo-google-fonts/inter";
import {
  NotoNastaliqUrdu_400Regular,
  NotoNastaliqUrdu_500Medium,
  NotoNastaliqUrdu_600SemiBold,
  NotoNastaliqUrdu_700Bold,
} from "@expo-google-fonts/noto-nastaliq-urdu";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Constants from "expo-constants";
import * as Font from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Platform, Text, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AnnouncementBar } from "@/components/AnnouncementBar";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { CartProvider } from "@/context/CartContext";
import { LanguageProvider } from "@/context/LanguageContext";
import { OfflineQueueProvider } from "@/context/OfflineQueueContext";
import { AnalyticsProvider } from "@/context/AnalyticsContext";
import { PlatformConfigProvider, usePlatformConfig } from "@/context/PlatformConfigContext";
import { ToastProvider } from "@/context/ToastContext";
import { API_BASE } from "@/utils/api";

import { AuthGuard } from "@/app/_handlers/AuthGuard";
import { MagicLinkHandler } from "@/app/_handlers/MagicLinkHandler";
import { SuspendedScreen } from "@/app/_handlers/SuspendedScreen";
import { MaintenanceScreen } from "@/app/_handlers/MaintenanceScreen";
import { ServerDownScreen } from "@/app/_handlers/ServerDownScreen";
import { MisconfigScreen } from "@/app/_handlers/MisconfigScreen";
import { ForceUpdateDialog } from "@/app/_handlers/ForceUpdateDialog";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      retryDelay: (attempt) => Math.floor(1500 * Math.pow(1.5, attempt - 1)),
    },
  },
});

function isVersionLess(current: string, minimum: string): boolean {
  const parse = (v: string) => v.split(".").map((n) => parseInt(n, 10) || 0);
  const [cMaj = 0, cMin = 0, cPatch = 0] = parse(current);
  const [mMaj = 0, mMin = 0, mPatch = 0] = parse(minimum);
  if (cMaj !== mMaj) return cMaj < mMaj;
  if (cMin !== mMin) return cMin < mMin;
  return cPatch < mPatch;
}

function RootLayoutNav() {
  const { isSuspended, user } = useAuth();
  const { config, limitedFunctionality } = usePlatformConfig();
  const [limitedDismissed, setLimitedDismissed] = useState(false);

  const currentVersion = Constants.expoConfig?.version ?? "0.0.0";
  const minVersion = config.platform.minAppVersion ?? "0.0.0";
  const needsForceUpdate = minVersion !== "0.0.0" && isVersionLess(currentVersion, minVersion);

  const storeUrl =
    Platform.OS === "ios"
      ? "https://apps.apple.com/app/id000000000"
      : "https://play.google.com/store/apps/details?id=com.ajkmart.app";

  if (needsForceUpdate) {
    return <ForceUpdateDialog visible={true} storeUrl={storeUrl} />;
  }

  if (config.appStatus === "down") {
    return <ServerDownScreen />;
  }

  if (isSuspended) return <SuspendedScreen />;
  if (config.appStatus === "maintenance" && user) return <MaintenanceScreen />;

  return (
    <>
      {limitedFunctionality && !limitedDismissed && (
        <AnnouncementBar
          message="Limited functionality — some features may be unavailable"
          warning
          onDismiss={() => setLimitedDismissed(true)}
        />
      )}
      {config.appStatus === "limited" && config.content.announcement && (
        <AnnouncementBar message={config.content.announcement} warning />
      )}
      <AuthGuard />
      <MagicLinkHandler />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index"            options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)"           options={{ headerShown: false }} />
        <Stack.Screen name="auth"             options={{ headerShown: false }} />
        <Stack.Screen name="mart/index"       options={{ headerShown: false }} />
        <Stack.Screen name="food/index"       options={{ headerShown: false }} />
        <Stack.Screen name="ride/index"       options={{ headerShown: false }} />
        <Stack.Screen name="cart/index"       options={{ headerShown: false }} />
        <Stack.Screen name="pharmacy/index"   options={{ headerShown: false }} />
        <Stack.Screen name="parcel/index"     options={{ headerShown: false }} />
        <Stack.Screen name="categories/index" options={{ headerShown: false }} />
        <Stack.Screen name="order/index"      options={{ headerShown: false }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let webFontErrorCleanup: (() => void) | null = null;

    if (Platform.OS === "web") {
      const suppressFontRejection = (e: PromiseRejectionEvent) => {
        const msg = String(e.reason?.message || e.reason || "").toLowerCase();
        const stack = String(e.reason?.stack || "").toLowerCase();
        const isFontError =
          msg.includes("fontfaceobserver") ||
          msg.includes("fontface") ||
          msg.includes("is not loaded after waiting") ||
          (msg.includes("timeout") && (msg.includes("font") || msg.includes("nastaliq"))) ||
          stack.includes("fontfaceobserver") ||
          msg.includes("noto") ||
          msg.includes("nastaliq");
        if (isFontError) e.preventDefault();
      };
      window.addEventListener("unhandledrejection", suppressFontRejection);
      webFontErrorCleanup = () =>
        window.removeEventListener("unhandledrejection", suppressFontRejection);
    }

    const loadAllFonts = async () => {
      const allFonts = {
        Inter_400Regular,
        Inter_500Medium,
        Inter_600SemiBold,
        Inter_700Bold,
        NotoNastaliqUrdu_400Regular,
        NotoNastaliqUrdu_500Medium,
        NotoNastaliqUrdu_600SemiBold,
        NotoNastaliqUrdu_700Bold,
      };

      try {
        if (Platform.OS === "web") {
          await Promise.race([
            Font.loadAsync(allFonts),
            new Promise<void>((resolve) => setTimeout(resolve, 3000)),
          ]);
        } else {
          await Promise.race([
            Font.loadAsync(allFonts),
            new Promise<void>((resolve) => setTimeout(resolve, 10000)),
          ]);
        }
      } catch {
        // Font load failure is non-fatal — app still renders with system fonts.
      }

      if (!cancelled) {
        setReady(true);
        SplashScreen.hideAsync().catch(() => {});

        if (Platform.OS === "web") {
          setTimeout(() => {
            webFontErrorCleanup?.();
            webFontErrorCleanup = null;
          }, 5000);
        }
      }
    };

    loadAllFonts();

    return () => {
      cancelled = true;
      webFontErrorCleanup?.();
      webFontErrorCleanup = null;
    };
  }, []);

  if (!ready) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: "#0047B3",
          alignItems: "center",
          justifyContent: "center",
          gap: 20,
        }}
      >
        <View
          style={{
            width: 72,
            height: 72,
            borderRadius: 20,
            backgroundColor: "rgba(255,255,255,0.15)",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ fontSize: 36 }}>🛒</Text>
        </View>
        <ActivityIndicator size="large" color="#ffffff" />
      </View>
    );
  }

  if (!API_BASE) {
    return <MisconfigScreen />;
  }

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <KeyboardProvider>
              <OfflineQueueProvider>
                <PlatformConfigProvider>
                  <AnalyticsProvider>
                    <LanguageProvider>
                      <AuthProvider>
                        <CartProvider>
                          <ToastProvider>
                            <RootLayoutNav />
                          </ToastProvider>
                        </CartProvider>
                      </AuthProvider>
                    </LanguageProvider>
                  </AnalyticsProvider>
                </PlatformConfigProvider>
              </OfflineQueueProvider>
            </KeyboardProvider>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
