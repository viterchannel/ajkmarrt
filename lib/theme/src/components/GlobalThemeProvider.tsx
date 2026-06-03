import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { BrandColors } from "../config/brand.js";

export interface ThemeContextType {
  currentTheme: "darkGold" | "light" | string;
  setTheme: (theme: string) => void;
  colors: any;
  appRole: "admin" | "vendor" | "rider" | "customer";
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{
  children: React.ReactNode;
  appRole: "admin" | "vendor" | "rider" | "customer";
}> = ({ children, appRole }) => {
  const [currentTheme, setCurrentTheme] = useState("darkGold");
  const [colors, setColors] = useState(BrandColors);

  const setTheme = useCallback((theme: string) => {
    setCurrentTheme(theme);
  }, []);

  // Load theme from admin config (API call)
  useEffect(() => {
    const loadThemeFromAdmin = async () => {
      try {
        const response = await fetch("/api/admin/theme-config");
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const themeConfig = await response.json();
        setCurrentTheme(themeConfig.selectedTheme || "darkGold");
        setColors(themeConfig.colors || BrandColors);
      } catch {
        // Silently fall back to default if admin endpoint is unavailable
      }
    };

    loadThemeFromAdmin();
  }, []);

  return (
    <ThemeContext.Provider value={{ currentTheme, setTheme, colors, appRole }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within ThemeProvider");
  return context;
};
