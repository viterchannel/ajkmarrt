/**
 * RegisterScreen — AJKMart Customer Registration Wizard
 *
 * Orchestrator that delegates each step to a dedicated component in
 * `app/auth/steps/`.  Keeps all state here and persists non-sensitive
 * fields to AsyncStorage after every step change (24 h TTL).
 *
 * Steps:
 *   1. StepPhoneVerify    — Phone + OTP verify, captures temp token
 *   2. StepPersonalDetails — Name, username (async check), email
 *   3. StepLocation       — City picker, area, address + GPS
 *   4. StepSecurity       — CNIC, password, terms, submit profile
 *   5. StepSuccess        — Account level, bonus, login + navigate
 */

import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
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

import { AuthButton, StepProgress, authColors as C } from "@/components/auth-shared";
import { useAuth, type AppUser } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { usePlatformConfig } from "@/context/PlatformConfigContext";
import { loadDraft, saveDraft, clearDraft } from "@/lib/auth/register-draft";
import { tDual, type TranslationKey } from "@workspace/i18n";
import { trackEvent } from "@/utils/analytics";

import {
  StepPhoneVerify,
  StepPersonalDetails,
  StepLocation,
  StepSecurity,
  StepSuccess,
  validatePersonalDetails,
  validateLocation,
} from "./steps";
import type { RegisterData } from "./steps/types";

const STEP_LABELS = ["Verify", "Details", "Address", "Security", "Done"];
const STEP_SUBTITLES: Record<number, string> = {
  1: "Verify your phone number",
  2: "Tell us about yourself",
  3: "Where should we deliver?",
  4: "Secure your account",
};

type RegStep = 1 | 2 | 3 | 4 | 5;

const DEFAULT_DATA: RegisterData = {
  phone: "",
  name: "",
  email: "",
  username: "",
  city: "",
  area: "",
  address: "",
  latitude: "",
  longitude: "",
  cnic: "",
  password: "",
  confirmPassword: "",
  termsAccepted: false,
};

export default function RegisterScreen() {
  const { language } = useLanguage();
  const T = (key: TranslationKey) => tDual(key, language);
  const insets = useSafeAreaInsets();
  const { login } = useAuth();
  const { config } = usePlatformConfig();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const [step, setStep] = useState<RegStep>(1);
  const [loading, setLoading] = useState(false);
  const [error, setErrorState] = useState("");

  const [data, setData] = useState<RegisterData>(DEFAULT_DATA);
  const [authToken, setAuthToken] = useState("");
  const [authRefreshToken, setAuthRefreshToken] = useState("");
  const [authUser, setAuthUser] = useState<AppUser | null>(null);

  const stepRef = useRef(step);
  stepRef.current = step;
  const dataRef = useRef(data);
  dataRef.current = data;

  /* ── Fire signup_start on mount ────────────────────────────────────────── */
  useEffect(() => {
    trackEvent("signup_start");
  }, []);

  /* ── Load draft on mount ───────────────────────────────────────────────── */
  useEffect(() => {
    void (async () => {
      const draft = await loadDraft();
      if (draft) {
        setStep((draft.step as RegStep) || 1);
        setData(prev => ({
          ...prev,
          phone: draft.phone ?? prev.phone,
          name: draft.name ?? prev.name,
          email: draft.email ?? prev.email,
          username: draft.username ?? prev.username,
          city: draft.city ?? prev.city,
          area: draft.area ?? prev.area,
          address: draft.address ?? prev.address,
          latitude: draft.latitude ?? prev.latitude,
          longitude: draft.longitude ?? prev.longitude,
          cnic: draft.cnic ?? prev.cnic,
          termsAccepted: draft.termsAccepted ?? prev.termsAccepted,
        }));
      }
    })();
  }, []);

  /* ── Persist draft after each step change ───────────────────────── */
  useEffect(() => {
    if (step >= 5) return;
    void saveDraft({
      step,
      phone: data.phone,
      name: data.name,
      email: data.email,
      username: data.username,
      city: data.city,
      area: data.area,
      address: data.address,
      latitude: data.latitude,
      longitude: data.longitude,
      cnic: data.cnic,
      termsAccepted: data.termsAccepted,
    });
  }, [step, data.phone, data.name, data.email, data.username, data.city,
      data.area, data.address, data.latitude, data.longitude, data.cnic, data.termsAccepted]);

  const clearError = () => setErrorState("");

  const setError = (msg: string) => {
    setErrorState(msg);
    if (msg) {
      trackEvent("signup_failed", { step: stepRef.current, reason: msg });
    }
  };

  const onChange = (patch: Partial<RegisterData>) => {
    setData(prev => ({ ...prev, ...patch }));
    clearError();
  };

  const handleBack = () => {
    clearError();
    if (step <= 2) {
      import("expo-secure-store").then(SS => SS.deleteItemAsync("ajkmart_reg_token")).catch(() => {});
      void clearDraft();
      router.back();
    } else {
      setStep((step - 1) as RegStep);
    }
  };

  const handleNext = () => {
    clearError();
    if (step === 2) {
      const err = validatePersonalDetails(data);
      if (err) { setError(err); return; }
    }
    if (step === 3) {
      const err = validateLocation(data);
      if (err) { setError(err); return; }
    }
    trackEvent("signup_step_completed", { step });
    setStep((step + 1) as RegStep);
  };

  const handleOtpVerified = (token: string, refreshToken: string, user: AppUser) => {
    setAuthToken(token);
    setAuthRefreshToken(refreshToken);
    setAuthUser(user);
    trackEvent("signup_step_completed", { step: 1 });
    setStep(2);
    setLoading(false);
  };

  const handleProfileComplete = () => {
    trackEvent("signup_step_completed", { step: 4 });
    setStep(5);
    setLoading(false);
  };

  /* ── Success screen (step 5) ───────────────────────────────────────── */
  if (step === 5) {
    return (
      <StepSuccess
        user={authUser}
        token={authToken}
        refreshToken={authRefreshToken}
        loading={loading}
        onLoadingChange={setLoading}
      />
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
      <LinearGradient colors={["#0047B3", "#0066FF", "#4D94FF"]} style={styles.gradient}>
        {/* Header */}
        <View style={[styles.topSection, { paddingTop: topPad + 16 }]}>
          <Pressable
            onPress={handleBack}
            style={styles.backBtn}
            accessibilityLabel={step <= 2 ? "Go back" : "Previous step"}
            accessibilityRole="button"
          >
            <Ionicons name="arrow-back" size={20} color="#fff" />
          </Pressable>
          <View style={styles.headerLogoRow}>
            <View style={styles.headerLogo}>
              <Ionicons name="person-add" size={24} color={C.primary} />
            </View>
          </View>
          <Text style={styles.headerTitle}>{T("createAccount")}</Text>
          <Text style={styles.headerSub}>{STEP_SUBTITLES[step]}</Text>

          <View style={styles.progressRow}>
            <StepProgress total={5} current={step} />
          </View>
          <View style={styles.stepLabels}>
            {STEP_LABELS.map((label, i) => (
              <Text key={label} style={[styles.stepLabel, step >= i + 1 && styles.stepLabelActive]}>
                {label}
              </Text>
            ))}
          </View>
        </View>

        {/* Step content */}
        <ScrollView style={styles.card} contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          {step === 1 && (
            <StepPhoneVerify
              data={data}
              onChange={onChange}
              onError={setError}
              onClearError={clearError}
              loading={loading}
              onLoadingChange={setLoading}
              error={error}
              authToken={authToken}
              onOtpVerified={handleOtpVerified}
            />
          )}

          {step === 2 && (
            <>
              <StepPersonalDetails
                data={data}
                onChange={onChange}
                onError={setError}
                onClearError={clearError}
                loading={loading}
                onLoadingChange={setLoading}
                error={error}
              />
              <AuthButton
                label="Continue"
                onPress={handleNext}
                loading={loading}
                icon="arrow-forward-outline"
              />
            </>
          )}

          {step === 3 && (
            <>
              <StepLocation
                data={data}
                onChange={onChange}
                onError={setError}
                onClearError={clearError}
                loading={loading}
                onLoadingChange={setLoading}
                error={error}
              />
              <AuthButton
                label="Continue"
                onPress={handleNext}
                loading={loading}
                icon="arrow-forward-outline"
              />
              <Pressable onPress={() => setStep(4)} style={styles.skipLink} accessibilityRole="link">
                <Text style={styles.skipLinkText}>Skip address (optional)</Text>
              </Pressable>
            </>
          )}

          {step === 4 && (
            <StepSecurity
              data={data}
              onChange={onChange}
              onError={setError}
              onClearError={clearError}
              loading={loading}
              onLoadingChange={setLoading}
              error={error}
              authToken={authToken}
              onProfileComplete={handleProfileComplete}
            />
          )}

          {step === 1 && (
            <Pressable
              onPress={() => router.replace("/auth")}
              style={styles.loginLink}
              accessibilityLabel="Go to login"
              accessibilityRole="link"
            >
              <Text style={styles.loginLinkText}>
                Already have an account? <Text style={{ fontFamily: "Inter_700Bold" }}>Login</Text>
              </Text>
            </Pressable>
          )}
        </ScrollView>
      </LinearGradient>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  topSection: { alignItems: "center", paddingBottom: 16, paddingHorizontal: 24 },
  backBtn: {
    position: "absolute",
    left: 16,
    top: Platform.OS === "web" ? 67 : 50,
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center", justifyContent: "center",
  },
  headerLogoRow: { marginBottom: 12 },
  headerLogo: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: "#fff", alignItems: "center", justifyContent: "center",
    shadowColor: "#0F172A", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  headerTitle: { fontFamily: "Inter_700Bold", fontSize: 26, color: "#fff", marginBottom: 4 },
  headerSub: { fontFamily: "Inter_400Regular", fontSize: 15, color: "rgba(255,255,255,0.85)", marginBottom: 16 },
  progressRow: { marginBottom: 8 },
  stepLabels: { flexDirection: "row", justifyContent: "center", gap: 16 },
  stepLabel: { fontFamily: "Inter_400Regular", fontSize: 12, color: "rgba(255,255,255,0.4)" },
  stepLabelActive: { color: "rgba(255,255,255,0.9)" },

  card: {
    backgroundColor: C.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    flex: 1,
  },

  loginLink: { alignItems: "center", marginTop: 20 },
  loginLinkText: { fontFamily: "Inter_500Medium", fontSize: 14, color: C.primary },
  skipLink: { alignItems: "center", marginTop: 12 },
  skipLinkText: { fontFamily: "Inter_500Medium", fontSize: 14, color: C.textMuted, textDecorationLine: "underline" },
});
