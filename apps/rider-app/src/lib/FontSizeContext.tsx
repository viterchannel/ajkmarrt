import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

const FONT_SIZE_KEY = "_ajkm_rider_font_size";

export type FontSizeLevel = "small" | "medium" | "large";

export const FONT_SIZE_MULTIPLIERS: Record<FontSizeLevel, number> = {
  small: 0.875,
  medium: 1,
  large: 1.15,
};

interface FontSizeContextValue {
  fontSizeLevel: FontSizeLevel;
  fontScale: number;
  setFontSizeLevel: (level: FontSizeLevel) => void;
}

const FontSizeContext = createContext<FontSizeContextValue>({
  fontSizeLevel: "medium",
  fontScale: 1,
  setFontSizeLevel: () => {},
});

export function FontSizeProvider({ children }: { children: React.ReactNode }) {
  const [fontSizeLevel, setFontSizeLevelState] = useState<FontSizeLevel>(() => {
    try {
      const stored = localStorage.getItem(FONT_SIZE_KEY);
      if (stored === "small" || stored === "medium" || stored === "large") return stored;
    } catch { /* ignore */ }
    return "medium";
  });

  const setFontSizeLevel = useCallback((level: FontSizeLevel) => {
    setFontSizeLevelState(level);
    try { localStorage.setItem(FONT_SIZE_KEY, level); } catch { /* ignore */ }
  }, []);

  const fontScale = FONT_SIZE_MULTIPLIERS[fontSizeLevel];

  useEffect(() => {
    document.documentElement.style.setProperty("--font-scale", String(fontScale));
  }, [fontScale]);

  return (
    <FontSizeContext.Provider value={{ fontSizeLevel, fontScale, setFontSizeLevel }}>
      {children}
    </FontSizeContext.Provider>
  );
}

export function useFontSize() {
  return useContext(FontSizeContext);
}
