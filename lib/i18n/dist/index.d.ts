export type Language = "en" | "ur" | "roman";
export declare const LANGUAGE_OPTIONS: {
    value: Language;
    label: string;
    nativeLabel: string;
    rtl: boolean;
}[];
export declare const DEFAULT_LANGUAGE: Language;
import en from "./locales/en";
export type TranslationKey = keyof typeof en;
/**
 * Preload a locale dictionary on demand.
 * Call this early (e.g., when the language provider initialises or the user
 * changes language) so t() / tDual() have data by the time components render.
 */
export declare function preloadLocale(lang: Language): Promise<void>;
export declare function t(key: TranslationKey, lang: Language): string;
export declare function tDual(key: TranslationKey, lang: Language): string;
export declare function isRTL(lang: Language): boolean;
export declare function getDir(lang: Language): "ltr" | "rtl";
export declare function getUrduFontFamily(lang: Language): string;
export declare const NASTALIQ_FONT = "NotoNastaliqUrdu_400Regular";
export declare const NASTALIQ_FONT_MEDIUM = "NotoNastaliqUrdu_500Medium";
export declare const NASTALIQ_FONT_SEMI = "NotoNastaliqUrdu_600SemiBold";
export declare const NASTALIQ_FONT_BOLD = "NotoNastaliqUrdu_700Bold";
/**
 * React Hooks & Context
 */
export { useTranslation, LanguageProvider } from "./react";
export type { LanguageProviderProps } from "./react";
//# sourceMappingURL=index.d.ts.map