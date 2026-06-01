export type Language = "en" | "ur" | "roman";

export const LANGUAGE_OPTIONS: {
  value: Language;
  label: string;
  nativeLabel: string;
  rtl: boolean;
}[] = [
  { value: "en", label: "English", nativeLabel: "English", rtl: false },
  { value: "ur", label: "Urdu", nativeLabel: "اردو", rtl: true },
  { value: "roman", label: "Roman", nativeLabel: "Roman Urdu", rtl: false },
];

export const DEFAULT_LANGUAGE: Language = "en";


// English is the primary locale — eagerly bundled so TranslationKey can be derived.
import en from "./locales/en";
export type TranslationKey = keyof typeof en;

// Runtime locale cache — seeded with English at startup.
const _cache: Partial<Record<Language, Record<string, string>>> = {
  en: en as Record<string, string>,
};

/**
 * Preload a locale dictionary on demand.
 * Call this early (e.g., when the language provider initialises or the user
 * changes language) so t() / tDual() have data by the time components render.
 */
export async function preloadLocale(lang: Language): Promise<void> {
  if (lang === "en" || _cache[lang]) return;
  if (lang === "ur") {
    const { default: dict } = await import("./locales/ur");
    _cache.ur = dict;
  } else if (lang === "roman") {
    const { default: dict } = await import("./locales/roman");
    _cache.roman = dict;
  }
}

export function t(key: TranslationKey, lang: Language): string {
  const dict = _cache[lang];
  const enDict = _cache.en!;
  return (dict as Record<string, string> | undefined)?.[key as string]
    ?? enDict[key as string]
    ?? String(key);
}

export function tDual(key: TranslationKey, lang: Language): string {
  return t(key, lang);
}
export function isRTL(lang: Language): boolean {
  return lang === "ur";
}

export function getDir(lang: Language): "ltr" | "rtl" {
  return isRTL(lang) ? "rtl" : "ltr";
}

export function getUrduFontFamily(lang: Language): string {
  return lang === "ur" ? "NotoNastaliqUrdu_400Regular" : "Inter_400Regular";
}

export const NASTALIQ_FONT = "NotoNastaliqUrdu_400Regular";
export const NASTALIQ_FONT_MEDIUM = "NotoNastaliqUrdu_500Medium";
export const NASTALIQ_FONT_SEMI = "NotoNastaliqUrdu_600SemiBold";
export const NASTALIQ_FONT_BOLD = "NotoNastaliqUrdu_700Bold";

/**
 * React Hooks & Context
 */
export { useTranslation, LanguageProvider } from "./react";
export type { LanguageProviderProps } from "./react";
