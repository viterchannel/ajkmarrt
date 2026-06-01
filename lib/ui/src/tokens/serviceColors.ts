export interface ServiceColorEntry {
  id: string;
  name: string;
  color: string;
  gradient: [string, string];
  bgLight: string;
  bgDark: string;
  textLight: string;
  textDark: string;
  icon: string;
}

export const SERVICE_COLORS: Record<string, ServiceColorEntry> = {
  mart: {
    id: "mart",
    name: "Mart",
    color: "#00C48C",
    gradient: ["#00C48C", "#00A371"],
    bgLight: "#E6FAF4",
    bgDark: "#003D2E",
    textLight: "#00613E",
    textDark: "#00C48C",
    icon: "cart-outline",
  },
  food: {
    id: "food",
    name: "Food",
    color: "#FF9500",
    gradient: ["#FF9500", "#FF6B00"],
    bgLight: "#FFF3E0",
    bgDark: "#3D2000",
    textLight: "#7A3900",
    textDark: "#FF9500",
    icon: "restaurant-outline",
  },
  rides: {
    id: "rides",
    name: "Rides",
    color: "#FCD34D",
    gradient: ["#FCD34D", "#F59E0B"],
    bgLight: "#FFFBEB",
    bgDark: "#3D2E00",
    textLight: "#7A5A00",
    textDark: "#FCD34D",
    icon: "car-outline",
  },
  pharmacy: {
    id: "pharmacy",
    name: "Pharmacy",
    color: "#AF52DE",
    gradient: ["#AF52DE", "#8B3BB5"],
    bgLight: "#F5EAFB",
    bgDark: "#2D0A3D",
    textLight: "#5A1A7A",
    textDark: "#AF52DE",
    icon: "medkit-outline",
  },
  parcel: {
    id: "parcel",
    name: "Parcel",
    color: "#FF6B35",
    gradient: ["#FF6B35", "#E04E1A"],
    bgLight: "#FFF0EB",
    bgDark: "#3D1500",
    textLight: "#7A2A00",
    textDark: "#FF6B35",
    icon: "cube-outline",
  },
  wallet: {
    id: "wallet",
    name: "Wallet",
    color: "#5856D6",
    gradient: ["#5856D6", "#3634B0"],
    bgLight: "#EEEEFA",
    bgDark: "#0D0C3D",
    textLight: "#25247A",
    textDark: "#5856D6",
    icon: "wallet-outline",
  },
  van: {
    id: "van",
    name: "Van",
    color: "#1A56DB",
    gradient: ["#1A56DB", "#1040B0"],
    bgLight: "#EBF0FF",
    bgDark: "#00113D",
    textLight: "#0A2A7A",
    textDark: "#1A56DB",
    icon: "bus-outline",
  },
  school: {
    id: "school",
    name: "School",
    color: "#059669",
    gradient: ["#059669", "#037A53"],
    bgLight: "#E6FAF4",
    bgDark: "#00291C",
    textLight: "#024D35",
    textDark: "#059669",
    icon: "school-outline",
  },
};

export type ServiceId = keyof typeof SERVICE_COLORS;
