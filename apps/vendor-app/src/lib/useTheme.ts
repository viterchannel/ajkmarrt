import { createLogger } from "@/lib/logger";
import { useCallback, useEffect, useState } from "react";
const log = createLogger("[useTheme]");
const THEME_KEY = "ajkmart_dark_mode";

export function useTheme() {
  const [isDark, setIsDark] = useState(() => {
    try {
      const stored = localStorage.getItem(THEME_KEY);
      return stored === null ? true : stored === "true";
    } catch (err) {
      log.warn("[useTheme] localStorage read failed:", err);
      return true;
    }
  });

  useEffect(() => {
    const html = document.documentElement;
    if (isDark) {
      html.classList.add("dark");
    } else {
      html.classList.remove("dark");
    }
  }, [isDark]);

  const toggleDark = useCallback(() => {
    setIsDark((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(THEME_KEY, next ? "true" : "false");
      } catch (err) {
        log.warn("[useTheme] localStorage save failed:", err);
      }
      return next;
    });
  }, []);

  return { isDark, toggleDark };
}
