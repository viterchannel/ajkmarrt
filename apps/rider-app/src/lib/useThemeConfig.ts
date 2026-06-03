import { useCallback, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "./api";
import { useTheme } from "./useTheme";

/**
 * Complete theme configuration for brand colors
 * Supports customization for both light and dark modes
 */
export interface ThemeConfig {
  /* Light mode colors */
  lightBrandPrimary: string;        /* Light mode primary button color */
  lightBrandHover: string;          /* Light mode hover state */
  lightBackground: string;          /* Light mode page background */
  lightCard: string;                /* Light mode card background */
  lightText: string;                /* Light mode text color */
  lightBorder: string;              /* Light mode border color */
  lightAccent: string;              /* Light mode accent color */
  lightSuccess: string;             /* Light mode success color */
  lightWarning: string;             /* Light mode warning color */
  lightError: string;               /* Light mode error color */

  /* Dark mode colors */
  darkBrandPrimary: string;         /* Dark mode primary button color */
  darkBrandHover: string;           /* Dark mode hover state */
  darkBackground: string;           /* Dark mode page background */
  darkCard: string;                 /* Dark mode card background */
  darkText: string;                 /* Dark mode text color */
  darkBorder: string;               /* Dark mode border color */
  darkAccent: string;               /* Dark mode accent color */
  darkSuccess: string;              /* Dark mode success color */
  darkWarning: string;              /* Dark mode warning color */
  darkError: string;                /* Dark mode error color */
}

/**
 * Default professional theme configuration
 */
const DEFAULT_LIGHT_THEME: Partial<ThemeConfig> = {
  lightBrandPrimary: "#D4A300",
  lightBrandHover: "#C29600",
  lightBackground: "#FEFAF5",
  lightCard: "#FFFFFF",
  lightText: "#131313",
  lightBorder: "#DFD4CA",
  lightAccent: "#0B6FA3",
  lightSuccess: "#2C8C3E",
  lightWarning: "#D97706",
  lightError: "#C91F2E",
};

const DEFAULT_DARK_THEME: Partial<ThemeConfig> = {
  darkBrandPrimary: "#FFD700",
  darkBrandHover: "#FFC107",
  darkBackground: "#0A0A0A",
  darkCard: "#1A1A1A",
  darkText: "#FFFFFF",
  darkBorder: "#2A2A2A",
  darkAccent: "#FFC107",
  darkSuccess: "#4CAF50",
  darkWarning: "#FF9800",
  darkError: "#F44336",
};

export const DEFAULT_THEME_CONFIG: ThemeConfig = {
  ...DEFAULT_LIGHT_THEME,
  ...DEFAULT_DARK_THEME,
} as ThemeConfig;

const STORAGE_KEY = "rider-theme-config";

/**
 * Apply theme configuration to the document
 * Updates CSS custom properties for dynamic theme changes
 */
function applyThemeConfig(config: Partial<ThemeConfig>, resolvedTheme: "light" | "dark"): void {
  if (typeof document === "undefined") return;

  const root = document.documentElement;
  const prefix = resolvedTheme === "light" ? "light" : "dark";

  const colorMap: Record<string, string> = {
    [`${prefix}BrandPrimary`]: "--color-brand-primary",
    [`${prefix}BrandHover`]: "--color-brand-hover",
    [`${prefix}Background`]: "--color-theme-background",
    [`${prefix}Card`]: "--color-theme-card",
    [`${prefix}Text`]: "--color-theme-text",
    [`${prefix}Border`]: "--color-theme-border",
    [`${prefix}Accent`]: "--color-theme-accent",
    [`${prefix}Success`]: "--color-theme-success",
    [`${prefix}Warning`]: "--color-theme-warning",
    [`${prefix}Error`]: "--color-theme-error",
  };

  for (const [key, cssVar] of Object.entries(colorMap)) {
    const value = config[key as keyof ThemeConfig];
    if (value) {
      root.style.setProperty(cssVar, value);
    }
  }
}

/**
 * Load theme configuration from localStorage or API
 */
function getStoredThemeConfig(): Partial<ThemeConfig> | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

/**
 * useThemeConfig — manage admin-controlled theme colors
 *
 * Features:
 *   - Load custom theme from API (for admins)
 *   - Store theme in localStorage (for offline use)
 *   - Apply theme colors dynamically via CSS custom properties
 *   - Update colors in real-time with admin settings
 */
export function useThemeConfig() {
  const { resolvedTheme } = useTheme();
  const [config, setConfig] = useState<ThemeConfig>(DEFAULT_THEME_CONFIG);
  const [mounted, setMounted] = useState(false);
  const queryClient = useQueryClient();

  /* Load theme configuration from API (public admin endpoint — no auth required) */
  const { data: apiConfig, isLoading } = useQuery({
    queryKey: ["theme-config", "rider"],
    queryFn: async () => {
      try {
        const response = await fetch("/api/admin/theme-config/rider");
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        /* Map admin color schema → rider ThemeConfig flat keys */
        const p  = data?.colors?.primary   ?? {};
        const s  = data?.colors?.secondary ?? {};
        const se = data?.colors?.semantic  ?? {};
        const t  = data?.colors?.text      ?? {};
        const mapped: Partial<ThemeConfig> = {
          lightBrandPrimary: p.gold      ?? undefined,
          lightBrandHover:   p.darkGold  ?? undefined,
          lightBackground:   s.lightGray ?? undefined,
          lightCard:         t.light     ?? undefined,
          lightText:         t.primary   ?? undefined,
          lightBorder:       s.borderGray ?? undefined,
          lightAccent:       p.gold      ?? undefined,
          lightSuccess:      se.success  ?? undefined,
          lightWarning:      se.warning  ?? undefined,
          lightError:        se.error    ?? undefined,
          darkBrandPrimary:  p.gold      ?? undefined,
          darkBrandHover:    p.darkGold  ?? undefined,
          darkBackground:    p.dark      ?? undefined,
          darkCard:          s.darkGray  ?? undefined,
          darkText:          t.light     ?? undefined,
          darkBorder:        s.borderGray ?? undefined,
          darkAccent:        p.gold      ?? undefined,
          darkSuccess:       se.success  ?? undefined,
          darkWarning:       se.warning  ?? undefined,
          darkError:         se.error    ?? undefined,
        };
        /* Strip undefined values */
        return Object.fromEntries(
          Object.entries(mapped).filter(([, v]) => v !== undefined)
        ) as Partial<ThemeConfig>;
      } catch {
        /* Fall back to stored config or defaults */
        return getStoredThemeConfig() ?? {};
      }
    },
    staleTime: 1000 * 60 * 60,
    gcTime: 1000 * 60 * 60 * 2,
  });

  /* Initialize and apply theme on mount */
  useEffect(() => {
    const stored = getStoredThemeConfig();
    const newConfig = { ...DEFAULT_THEME_CONFIG, ...stored, ...(apiConfig || {}) };
    setConfig(newConfig);
    applyThemeConfig(newConfig, resolvedTheme as "light" | "dark");
    setMounted(true);
  }, [apiConfig, resolvedTheme]);

  /* Update theme when admin changes colors */
  const updateThemeConfig = useCallback(
    async (updates: Partial<ThemeConfig>) => {
      const newConfig = { ...config, ...updates };
      setConfig(newConfig);

      /* Save to localStorage for offline persistence */
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newConfig));
      } catch {
        /* Storage unavailable */
      }

      /* Apply changes immediately */
      applyThemeConfig(newConfig, resolvedTheme as "light" | "dark");

      /* Invalidate cache so next read re-fetches from admin API */
      queryClient.invalidateQueries({ queryKey: ["theme-config", "rider"] });
    },
    [config, queryClient, resolvedTheme]
  );

  /* Reset theme to defaults */
  const resetTheme = useCallback(() => {
    setConfig(DEFAULT_THEME_CONFIG);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* Storage unavailable */
    }
    applyThemeConfig(DEFAULT_THEME_CONFIG, resolvedTheme as "light" | "dark");
    queryClient.invalidateQueries({ queryKey: ["theme-config"] });
  }, [queryClient, resolvedTheme]);

  return {
    config,
    updateThemeConfig,
    resetTheme,
    mounted,
    isLoading,
  };
}

/**
 * Helper function to get current color value for a specific key
 */
export function useThemeColor(
  key: keyof ThemeConfig,
  theme?: "light" | "dark"
): string {
  const { resolvedTheme } = useTheme();
  const { config } = useThemeConfig();
  const activeTheme = theme || resolvedTheme;

  return config[key] || DEFAULT_THEME_CONFIG[key];
}
