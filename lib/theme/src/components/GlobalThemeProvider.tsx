import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { BrandColors } from "../config/brand.js";

/* ── Types ───────────────────────────────────────────────────────────────────── */

type AppRole = "admin" | "vendor" | "rider" | "customer";

export interface AdminThemeColors {
  primary:   { dark: string; gold: string; darkGold: string };
  secondary: { lightGray: string; darkGray: string; borderGray: string };
  semantic:  { success: string; warning: string; error: string; info: string };
  text:      { primary: string; secondary: string; light: string };
}

export interface ThemeContextType {
  currentTheme: string;
  setTheme:     (theme: string) => void;
  colors:       AdminThemeColors | typeof BrandColors;
  appRole:      AppRole;
  isLoading:    boolean;
}

/* ── Context ─────────────────────────────────────────────────────────────────── */

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

/* ── Provider ────────────────────────────────────────────────────────────────── */

export const ThemeProvider: React.FC<{
  children: React.ReactNode;
  appRole:  AppRole;
}> = ({ children, appRole }) => {
  const [currentTheme, setCurrentTheme] = useState("darkGold");
  const [colors,       setColors]       = useState<AdminThemeColors | typeof BrandColors>(BrandColors);
  const [isLoading,    setIsLoading]    = useState(false);

  const setTheme = useCallback((theme: string) => {
    setCurrentTheme(theme);
  }, []);

  /**
   * AbortController ref — cancelled on unmount or when appRole changes
   * to avoid stale state updates on an unmounted / role-switched component.
   */
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const loadThemeFromAdmin = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/admin/theme-config/${appRole}`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const themeConfig = await response.json();

        if (controller.signal.aborted) return;
        setCurrentTheme(themeConfig.selectedTheme || "darkGold");
        setColors(themeConfig.colors || BrandColors);
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") return;
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    };

    loadThemeFromAdmin();

    return () => { controller.abort(); };
  }, [appRole]);

  return (
    <ThemeContext.Provider value={{ currentTheme, setTheme, colors, appRole, isLoading }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within ThemeProvider");
  return context;
};
