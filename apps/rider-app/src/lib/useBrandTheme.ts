import { useEffect } from "react";
import { usePlatformConfig } from "./useConfig";

const STORAGE_KEY = "rider-theme";

function isValidHex(color: string): boolean {
  return /^#[0-9A-Fa-f]{3,6}$/.test(color);
}

export function useBrandTheme() {
  const { config } = usePlatformConfig();

  useEffect(() => {
    const primaryColor = config.branding?.primaryColor;
    if (primaryColor && isValidHex(primaryColor)) {
      document.documentElement.style.setProperty("--brand-primary", primaryColor);
    }
  }, [config.branding?.primaryColor]);

  useEffect(() => {
    const logoUrl = config.branding?.logoUrl ?? "";
    document.documentElement.style.setProperty("--brand-logo", `url("${logoUrl}")`);
  }, [config.branding?.logoUrl]);

  useEffect(() => {
    const darkModeDefault = config.branding?.darkModeDefault;
    if (darkModeDefault === undefined) return;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "dark" || stored === "light") return;
    } catch {
    }
    if (darkModeDefault) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [config.branding?.darkModeDefault]);
}
