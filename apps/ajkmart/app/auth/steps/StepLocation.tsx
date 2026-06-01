import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import {
  InputField,
  authColors as C,
} from "@/components/auth-shared";
import { typography } from "@/constants/colors";
import { useLocationSuggestions } from "@/hooks/useLocationSuggestions";
import { usePlatformConfig } from "@/context/PlatformConfigContext";
import type { RegisterData, StepBaseProps } from "./types";

type TextStyle = import("react-native").TextStyle;
type ViewStyle = import("react-native").ViewStyle;

export function validateLocation(data: RegisterData): string | null {
  if (!data.city) return "Please select your city";
  return null;
}

const STEP_HEADER: ViewStyle = {
  flexDirection: "row",
  alignItems: "center",
  gap: 12,
  backgroundColor: "#FFF7ED",
  borderRadius: 16,
  padding: 14,
  marginBottom: 20,
  borderWidth: 1,
  borderColor: "#FED7AA",
};
const STEP_HEADER_ICON: ViewStyle = {
  width: 40,
  height: 40,
  borderRadius: 12,
  backgroundColor: "#FFEDD5",
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
const GPS_BUTTON: ViewStyle = {
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "center",
  gap: 10,
  backgroundColor: C.primary,
  borderRadius: 16,
  paddingVertical: 14,
  marginBottom: 8,
};
const GPS_TEXT: TextStyle = {
  fontFamily: "Inter_600SemiBold",
  fontSize: 15,
  color: "#fff",
};
const GPS_STATUS: TextStyle = {
  fontFamily: "Inter_400Regular",
  fontSize: 13,
  color: C.success,
  textAlign: "center",
  marginBottom: 8,
};
const COORDS_ROW: ViewStyle = {
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "center",
  gap: 4,
  marginBottom: 12,
};
const DIVIDER_ROW: ViewStyle = {
  flexDirection: "row",
  alignItems: "center",
  marginVertical: 20,
  gap: 10,
};
const DIVIDER_LINE: ViewStyle = { flex: 1, height: 1, backgroundColor: C.border };
const DIVIDER_TEXT: TextStyle = {
  fontFamily: "Inter_400Regular",
  fontSize: 13,
  color: C.textMuted,
};
const PICKER_BUTTON: ViewStyle = {
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  borderWidth: 1.5,
  borderColor: C.border,
  borderRadius: 16,
  paddingHorizontal: 16,
  paddingVertical: 14,
  backgroundColor: "#F8FAFC",
  marginBottom: 12,
};
const PICKER_ERROR: ViewStyle = { borderColor: C.danger };
const PICKER_TEXT: TextStyle = {
  fontFamily: "Inter_400Regular",
  fontSize: 15,
  color: C.text,
};
const CITY_DROPDOWN: ViewStyle = {
  borderWidth: 1,
  borderColor: C.border,
  borderRadius: 16,
  backgroundColor: "#fff",
  marginTop: -8,
  marginBottom: 12,
  maxHeight: 220,
  overflow: "hidden",
};
const CITY_SEARCH: ViewStyle = {
  flexDirection: "row",
  alignItems: "center",
  paddingHorizontal: 12,
  paddingTop: 8,
  gap: 8,
};
const CITY_LIST: ViewStyle = { maxHeight: 170 };
const CITY_ITEM: ViewStyle = {
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  paddingHorizontal: 16,
  paddingVertical: 12,
  borderBottomWidth: 0.5,
  borderBottomColor: C.border,
};
const CITY_ITEM_SELECTED: ViewStyle = { backgroundColor: `${C.primary}10` };
const CITY_ITEM_TEXT: TextStyle = {
  fontFamily: "Inter_400Regular",
  fontSize: 15,
  color: C.text,
};
const CITY_ITEM_TEXT_ACTIVE: TextStyle = {
  color: C.primary,
  fontFamily: "Inter_600SemiBold",
};
const NO_CITY: TextStyle = {
  fontFamily: "Inter_400Regular",
  fontSize: 13,
  color: C.textMuted,
  textAlign: "center",
  paddingVertical: 16,
};

const PAKISTAN_CITIES = [
  "Muzaffarabad", "Mirpur", "Rawalakot", "Kotli", "Bagh", "Bhimber",
  "Islamabad", "Rawalpindi", "Lahore", "Karachi", "Peshawar", "Quetta",
  "Faisalabad", "Multan", "Sialkot", "Gujranwala", "Hyderabad",
  "Abbottabad", "Bahawalpur", "Sargodha", "Sukkur", "Mardan",
  "Mansehra", "Gilgit", "Skardu",
];

export default function StepLocation({ data, onChange, onError, onClearError, error }: StepBaseProps) {
  const { config } = usePlatformConfig();
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsStatus, setGpsStatus] = useState("");
  const [showCityPicker, setShowCityPicker] = useState(false);
  const [citySearch, setCitySearch] = useState("");
  const [showAreaSuggestions, setShowAreaSuggestions] = useState(false);

  const [activeServerCities, setActiveServerCities] = useState<string[]>([]);
  const [activeServerAreas, setActiveServerAreas] = useState<string[]>([]);
  const baseUrl = process.env.EXPO_PUBLIC_API_URL ?? "";

  useEffect(() => {
    fetch(`${baseUrl}/api/locations/active-cities?service=orders`)
      .then((r) => r.json())
      .then((body: { data?: { cities?: string[] }; cities?: string[] }) => {
        const list = body?.data?.cities ?? (body as { cities?: string[] }).cities ?? [];
        if (list.length > 0) setActiveServerCities(list);
      })
      .catch(() => {});
  }, [baseUrl]);

  useEffect(() => {
    if (!data.city) { setActiveServerAreas([]); return; }
    fetch(`${baseUrl}/api/locations/active-areas?city=${encodeURIComponent(data.city)}&service=orders`)
      .then((r) => r.json())
      .then((body: { data?: { areas?: { name: string }[] } }) => {
        const areas = body?.data?.areas ?? [];
        setActiveServerAreas(areas.map((a) => a.name));
      })
      .catch(() => setActiveServerAreas([]));
  }, [data.city, baseUrl]);

  const cityList = useMemo(() => {
    if (activeServerCities.length > 0) return activeServerCities;
    if (config.cities && config.cities.length > 0) return config.cities;
    return PAKISTAN_CITIES;
  }, [activeServerCities, config]);

  const filteredCities = cityList.filter(c =>
    c.toLowerCase().includes(citySearch.toLowerCase())
  );

  const citySuggestions = useLocationSuggestions({ query: citySearch, type: "city" });
  const freeTextAreaSuggestions = useLocationSuggestions({ query: data.area ?? "", type: "area", city: data.city });

  const areaSuggestions = useMemo(() => {
    const q = (data.area ?? "").toLowerCase();
    if (activeServerAreas.length > 0) {
      const filtered = activeServerAreas.filter((a) => !q || a.toLowerCase().includes(q));
      if (filtered.length > 0) return filtered;
    }
    return freeTextAreaSuggestions;
  }, [activeServerAreas, freeTextAreaSuggestions, data.area]);

  const displayedCities = citySearch.length >= 2 && citySuggestions.length > 0
    ? citySuggestions
    : filteredCities;

  const tryIpGeolocation = async () => {
    try {
      const res = await fetch("https://ip-api.com/json?fields=city", { signal: AbortSignal.timeout(5000) });
      if (!res.ok) return;
      const ipData = await res.json() as { city?: string };
      if (ipData.city) {
        const matched = cityList.find(c => c.toLowerCase() === ipData.city!.toLowerCase());
        if (matched) {
          onChange({ city: matched });
          setGpsStatus("City pre-filled from your network location — you can change it below.");
          return;
        }
      }
    } catch {
    }
  };

  const handleGetLocation = async () => {
    setGpsLoading(true);
    setGpsStatus("");
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setGpsStatus("Location permission denied");
        setGpsLoading(false);
        void tryIpGeolocation();
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      onChange({
        latitude: loc.coords.latitude.toFixed(6),
        longitude: loc.coords.longitude.toFixed(6),
      });
      try {
        const [geo] = await Location.reverseGeocodeAsync({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        });
        if (geo) {
          if (geo.city) {
            const matched = cityList.find(c => c.toLowerCase() === geo.city!.toLowerCase());
            if (matched) onChange({ city: matched });
          }
          if (geo.district || geo.subregion) onChange({ area: geo.district || geo.subregion || "" });
          const parts = [geo.streetNumber, geo.street, geo.name].filter(Boolean);
          if (parts.length > 0) onChange({ address: parts.join(", ") });
          setGpsStatus("Location captured successfully");
        }
      } catch {
        setGpsStatus("Coordinates captured (address lookup unavailable)");
      }
    } catch (e: unknown) {
      setGpsStatus(e instanceof Error ? e.message : "Could not get location");
    }
    setGpsLoading(false);
  };


  return (
    <View>
      <View style={STEP_HEADER}>
        <View style={STEP_HEADER_ICON}>
          <Ionicons name="location-outline" size={20} color="#EA580C" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={STEP_HEADER_TITLE}>Delivery Address</Text>
          <Text style={STEP_HEADER_SUB}>Where should we deliver your orders?</Text>
        </View>
      </View>

      <Pressable
        onPress={handleGetLocation}
        disabled={gpsLoading}
        style={GPS_BUTTON}
        accessibilityRole="button"
        accessibilityLabel="Use GPS to fill address"
      >
        {gpsLoading ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Ionicons name="navigate" size={20} color="#fff" />
        )}
        <Text style={GPS_TEXT}>
          {gpsLoading ? "Getting Location..." : "Use My Current Location"}
        </Text>
      </Pressable>
      {!!gpsStatus && (
        <Text style={[GPS_STATUS, gpsStatus.includes("denied") && { color: C.danger }]}>
          {gpsStatus}
        </Text>
      )}
      {!!(data.latitude && data.longitude) && (
        <View style={COORDS_ROW}>
          <Ionicons name="location" size={14} color={C.success} />
          <Text style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: C.textMuted }}>
            {data.latitude}, {data.longitude}
          </Text>
        </View>
      )}

      <View style={DIVIDER_ROW}>
        <View style={DIVIDER_LINE} />
        <Text style={DIVIDER_TEXT}>or enter manually</Text>
        <View style={DIVIDER_LINE} />
      </View>

      <Text style={{ fontFamily: "Inter_500Medium", fontSize: 13, color: C.textSecondary, marginBottom: 8 }}>
        City *
      </Text>
      <Pressable
        onPress={() => setShowCityPicker(!showCityPicker)}
        style={[PICKER_BUTTON, !data.city && !!error && PICKER_ERROR]}
      >
        <Text style={[PICKER_TEXT, !data.city && { color: C.textMuted }]}>
          {data.city || "Select your city"}
        </Text>
        <Ionicons name={showCityPicker ? "chevron-up" : "chevron-down"} size={20} color={C.textMuted} />
      </Pressable>
      {showCityPicker && (
        <View style={CITY_DROPDOWN}>
          <View style={CITY_SEARCH}>
            <Ionicons name="search" size={16} color={C.textMuted} />
            <InputField
              value={citySearch}
              onChangeText={setCitySearch}
              placeholder="Search city..."
            />
          </View>
          <ScrollView style={CITY_LIST} nestedScrollEnabled>
            {displayedCities.map(c => (
              <Pressable
                key={c}
                onPress={() => { onChange({ city: c }); setShowCityPicker(false); setCitySearch(""); onClearError(); }}
                style={[CITY_ITEM, data.city === c && CITY_ITEM_SELECTED]}
              >
                <Text style={[CITY_ITEM_TEXT, data.city === c && CITY_ITEM_TEXT_ACTIVE]}>{c}</Text>
                {data.city === c && <Ionicons name="checkmark-circle" size={18} color={C.primary} />}
              </Pressable>
            ))}
            {displayedCities.length === 0 && (
              <Text style={NO_CITY}>No cities found</Text>
            )}
          </ScrollView>
        </View>
      )}

      <View style={{ marginBottom: 12 }}>
        <Text style={{ ...(typography.captionMedium as object), color: C.textSecondary, marginBottom: 6 }}>
          Area / Locality
        </Text>
        <View style={{
          flexDirection: "row",
          alignItems: "center",
          borderWidth: 1.5,
          borderColor: C.border,
          borderRadius: 16,
          backgroundColor: "#F8FAFC",
          overflow: "hidden",
          marginBottom: showAreaSuggestions && areaSuggestions.length > 0 ? 0 : 0,
        }}>
          <TextInput
            style={{ ...(typography.bodyMedium as object), color: C.text, flex: 1, paddingHorizontal: 16, paddingVertical: 15 }}
            value={data.area}
            onChangeText={v => { onChange({ area: v }); onClearError(); setShowAreaSuggestions(true); }}
            onFocus={() => setShowAreaSuggestions(true)}
            onBlur={() => setTimeout(() => setShowAreaSuggestions(false), 150)}
            placeholder="e.g. Satellite Town, Block B"
            placeholderTextColor={C.textMuted}
            autoCapitalize="words"
          />
        </View>
        {showAreaSuggestions && areaSuggestions.length > 0 && (
          <View style={[CITY_DROPDOWN, { marginTop: 0 }]}>
            <ScrollView style={CITY_LIST} nestedScrollEnabled keyboardShouldPersistTaps="handled">
              {areaSuggestions.map(item => (
                <Pressable
                  key={item}
                  onPress={() => { onChange({ area: item }); setShowAreaSuggestions(false); onClearError(); }}
                  style={[CITY_ITEM, data.area === item && CITY_ITEM_SELECTED]}
                >
                  <Text style={[CITY_ITEM_TEXT, data.area === item && CITY_ITEM_TEXT_ACTIVE]}>{item}</Text>
                  {data.area === item && <Ionicons name="checkmark-circle" size={18} color={C.primary} />}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}
      </View>
      <InputField
        label="Full Address"
        value={data.address}
        onChangeText={v => { onChange({ address: v }); onClearError(); }}
        placeholder="House/flat no, street, landmark"
        autoCapitalize="sentences"
        multiline
      />
    </View>
  );
}
