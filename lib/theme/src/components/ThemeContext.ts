/**
 * ThemeContext — React context for the active theme.
 * Separated from ThemeProvider so hooks can import it without pulling in JSX.
 */

import { createContext } from "react";
import type { ThemeContextValue } from "../config/themes/types.js";

export const ThemeContext = createContext<ThemeContextValue | null>(null);
ThemeContext.displayName = "ThemeContext";
