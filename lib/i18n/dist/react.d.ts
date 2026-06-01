import { ReactNode } from "react";
import type { Language, TranslationKey } from "./index";
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
/**
 * useTranslation — hook to access translation context
 * Throws if used outside LanguageProvider
 */
export declare function useTranslation(): TranslationContextType;
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
        getSettings: () => Promise<{
            language?: string;
            [key: string]: unknown;
        }>;
        updateSettings: (data: {
            language: string;
        }) => Promise<void>;
        getToken: () => string | null;
    };
    /**
     * localStorage key prefix (default: "ajkmart")
     */
    lsKeyPrefix?: string;
}
export declare function LanguageProvider({ children, api, lsKeyPrefix, }: LanguageProviderProps): import("react/jsx-runtime").JSX.Element;
export {};
//# sourceMappingURL=react.d.ts.map