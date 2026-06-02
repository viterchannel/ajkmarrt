import { ReactNode } from "react";
import { useThemeConfig } from "@/lib/useThemeConfig";

/**
 * ThemeConfigProvider — initializes and applies theme configuration on app load
 * 
 * Should be placed near the root of the app to ensure theme colors are applied
 * before any components render.
 * 
 * Usage:
 *   <ThemeConfigProvider>
 *     <App />
 *   </ThemeConfigProvider>
 */
export function ThemeConfigProvider({ children }: { children: ReactNode }) {
  // This hook initializes the theme configuration and applies it
  useThemeConfig();

  return <>{children}</>;
}

export default ThemeConfigProvider;
