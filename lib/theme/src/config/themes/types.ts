/**
 * Theme type definitions shared across all theme files.
 */

export type ColorScheme = "light" | "dark" | "system";
export type AppId = "admin" | "vendor" | "rider" | "customer" | "shared";

export interface ThemeDefinition {
  /** Unique identifier — used as localStorage key and data-theme attribute */
  id: string;
  /** Human-readable name shown in theme picker */
  name: string;
  /** Short description of the theme's purpose */
  description: string;
  /** Whether this theme is light or dark */
  colorScheme: ColorScheme;
  /** Primary app this theme is designed for */
  app: AppId;
  /** CSS custom property values applied to :root (or .dark) */
  cssVars: Record<string, string>;
  /** Raw hex/rgb color values for JS consumers (charts, RN, etc.) */
  rawColors: {
    primary:          string;
    primaryHover:     string;
    background:       string;
    surface:          string;
    surfaceElevated:  string;
    foreground:       string;
    muted:            string;
    border:           string;
    success:          string;
    warning:          string;
    error:            string;
    info:             string;
  };
}

export type AppRole = "admin" | "vendor" | "rider" | "customer" | "shared";

export interface ThemeContextValue {
  /** Active theme definition */
  theme: ThemeDefinition;
  /** All available theme IDs */
  availableThemes: string[];
  /** Switch to a different theme by ID */
  setTheme: (id: string) => void;
  /** Current color scheme resolved from system if "system" */
  resolvedColorScheme: "light" | "dark";
  /** Whether the current theme is dark */
  isDark: boolean;
  /** Toggle between light and dark variant of the current theme */
  toggleDark: () => void;
  /** Which app this ThemeProvider is serving */
  appRole: AppRole;
  /** Current theme ID string */
  currentTheme: string;
  /** Raw colors from the active theme (JS-friendly for charts, inline styles) */
  colors: ThemeDefinition["rawColors"];
  /** Whether admin config is being fetched */
  isLoading: boolean;
}
