"use client";

import { createContext, useContext, useCallback, useEffect, useState, ReactNode } from "react";
import type { Language, TranslationKey } from "./index";
import { DEFAULT_LANGUAGE, LANGUAGE_OPTIONS, isRTL } from "./index";
import enDict from "./locales/en";
import { createLogger } from "@workspace/logger";

const log = createLogger("[i18n-react]");

const NOTO_FONT_ID = "ajkm-noto-nastaliq-font";
const NOTO_FONT_URL =
  "https://fonts.googleapis.com/css2?family=Noto+Nastaliq+Urdu:wght@400;500;600;700&display=swap";

/** Inject the Noto Nastaliq Urdu <link> into <head> only when locale is 'ur'. */
function injectUrduFont(): void {
  if (typeof document === "undefined") return;
  if (document.getElementById(NOTO_FONT_ID)) return;
  const link = document.createElement("link");
  link.id = NOTO_FONT_ID;
  link.rel = "stylesheet";
  link.href = NOTO_FONT_URL;
  document.head.appendChild(link);
}

/** Remove the Noto Nastaliq Urdu <link> from <head> when no longer needed. */
function removeUrduFont(): void {
  if (typeof document === "undefined") return;
  const el = document.getElementById(NOTO_FONT_ID);
  if (el) el.remove();
}

type LocaleDict = Record<string, string>;

/**
 * Lazily import a locale dictionary. Returns a promise resolving to the dict.
 * Dynamic imports allow bundlers (Vite/webpack) to code-split each locale into
 * a separate chunk that is fetched only when first needed.
 */
async function loadLocaleDict(lang: Language): Promise<LocaleDict> {
  switch (lang) {
    case "ur": {
      const mod = await import("./locales/ur");
      return mod.default as LocaleDict;
    }
    case "roman": {
      const mod = await import("./locales/roman");
      return mod.default as LocaleDict;
    }
    case "en":
    default: {
      return enDict as LocaleDict;
    }
  }
}

/**
 * TranslationContext — provides language state & translation function
 * to all child components via React Context.
 */
interface TranslationContextType {
  language: Language;
  setLanguage: (lang: Language) => Promise<void>;
  t: (key: TranslationKey) => string;
  loading: boolean;
  initialised: boolean;
}

const TranslationContext = createContext<TranslationContextType | undefined>(undefined);

/**
 * useTranslation — hook to access translation context
 * Throws if used outside LanguageProvider
 */
export function useTranslation(): TranslationContextType {
  const ctx = useContext(TranslationContext);
  if (!ctx) {
    throw new Error("useTranslation must be used within LanguageProvider");
  }
  return ctx;
}

/**
 * LanguageProvider — wraps app with translation context
 * Manages language state, localStorage, server sync (if api provided).
 * Locale dictionaries are loaded lazily via dynamic import() so only the
 * active locale is included in the initial JS payload.
 */
export interface LanguageProviderProps {
  children: ReactNode;
  /**
   * Optional API for server-side language persistence.
   * If provided, language changes will sync to server.
   */
  api?: {
    getSettings: () => Promise<{ language?: string; [key: string]: unknown }>;
    updateSettings: (data: { language: string }) => Promise<void>;
    getToken: () => string | null;
  };
  /**
   * localStorage key prefix (default: "ajkmart")
   */
  lsKeyPrefix?: string;
}

export function LanguageProvider({
  children,
  api,
  lsKeyPrefix = "ajkmart",
}: LanguageProviderProps) {
  const lsKey = `${lsKeyPrefix}_language`;
  const [language, setLang] = useState<Language>(() => {
    if (typeof window === "undefined") return DEFAULT_LANGUAGE;
    try {
      const stored = localStorage.getItem(lsKey);
      if (stored && isValidLanguage(stored)) {
        return stored as Language;
      }
    } catch (err) {
      log.warn("Failed to read language from localStorage", err);
    }
    return DEFAULT_LANGUAGE;
  });

  const [loading, setLoading] = useState(true);
  const [initialised, setInitialised] = useState(false);
  const [dict, setDict] = useState<LocaleDict | null>(null);
  const [enFallback, setEnFallback] = useState<LocaleDict | null>(null);

  /* Load the EN fallback once at mount — needed for partial UR/Roman dicts */
  useEffect(() => {
    loadLocaleDict("en")
      .then((d) => setEnFallback(d))
      .catch((err) => log.warn("Failed to load EN fallback", err));
  }, []);

  /* Load the active locale dict whenever language changes */
  useEffect(() => {
    setLoading(true);
    loadLocaleDict(language)
      .then((d) => {
        setDict(d);
        setLoading(false);
      })
      .catch((err) => {
        log.warn("Failed to load locale dict", err);
        setLoading(false);
      });
  }, [language]);

  /* Apply RTL, document attributes, localStorage, and Noto font whenever language changes */
  useEffect(() => {
    const dir = isRTL(language) ? "rtl" : "ltr";
    document.documentElement.setAttribute("dir", dir);
    document.documentElement.setAttribute("lang", language === "ur" ? "ur" : "en");
    try {
      localStorage.setItem(lsKey, language);
    } catch (err) {
      log.warn("Failed to save language to localStorage", err);
    }
    if (language === "ur") {
      injectUrduFont();
    } else {
      removeUrduFont();
    }
  }, [language, lsKey]);

  /* On mount: fetch language from server if api available */
  useEffect(() => {
    if (!api) {
      setInitialised(true);
      return;
    }
    if (!api.getToken()) {
      setInitialised(true);
      return;
    }
    api
      .getSettings()
      .then((settings) => {
        if (settings?.language && isValidLanguage(settings.language)) {
          setLang(settings.language as Language);
        }
      })
      .catch((err) => {
        log.warn("Failed to fetch language from API", err);
      })
      .finally(() => setInitialised(true));
  }, [api]);

  /* Mark initialised once the dict is loaded (when no API) */
  useEffect(() => {
    if (!api && dict !== null) setInitialised(true);
  }, [api, dict]);

  const setLanguage = useCallback(
    async (lang: Language) => {
      setLoading(true);
      setLang(lang);
      if (api) {
        try {
          await api.updateSettings({ language: lang });
        } catch (err) {
          log.warn("Failed to update language on API", err);
        }
      }
      setLoading(false);
    },
    [api]
  );

  const translate = useCallback(
    (key: TranslationKey): string => {
      if (dict) {
        const val = (dict as Record<string, string>)[key as string];
        if (val !== undefined) return val;
      }
      if (enFallback) {
        const val = (enFallback as Record<string, string>)[key as string];
        if (val !== undefined) return val;
      }
      return String(key);
    },
    [dict, enFallback]
  );

  const value: TranslationContextType = {
    language,
    setLanguage,
    t: translate,
    loading,
    initialised,
  };

  return <TranslationContext.Provider value={value}>{children}</TranslationContext.Provider>;
}

/**
 * Type guard to validate language strings
 */
function isValidLanguage(value: unknown): boolean {
  return LANGUAGE_OPTIONS.some((option) => option.value === value);
}
