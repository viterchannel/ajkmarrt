import { createContext, useContext, ReactNode } from "react";
import type { Language, TranslationKey } from "@workspace/i18n";
import { t } from "@workspace/i18n";
import { useLanguage as useAdminLanguage } from "./useLanguage";

interface AdminTranslationContextType {
  language: Language;
  setLanguage: (lang: Language) => Promise<void>;
  t: (key: TranslationKey) => string;
  loading: boolean;
  initialised: boolean;
}

/**
 * AdminLanguageContext — provides centralized translation context
 * wrapping the existing useLanguage hook with Context API
 */
const AdminLanguageContext = createContext<AdminTranslationContextType | undefined>(undefined);

/**
 * useAdminTranslation — access language & translation throughout admin
 * Must be used within AdminLanguageProvider
 */
export function useAdminTranslation(): AdminTranslationContextType {
  const ctx = useContext(AdminLanguageContext);
  if (!ctx) {
    throw new Error("useAdminTranslation must be used within AdminLanguageProvider");
  }
  return ctx;
}

/**
 * AdminLanguageProvider — wraps app with centralized language context
 * Uses the existing admin useLanguage logic
 */
export function AdminLanguageProvider({ children }: { children: ReactNode }) {
  // Use existing admin useLanguage hook
  const { language, setLanguage, loading, initialised } = useAdminLanguage();

  // Create translation function with current language
  const translate = (key: TranslationKey): string => t(key, language);

  const value: AdminTranslationContextType = {
    language,
    setLanguage,
    t: translate,
    loading,
    initialised,
  };

  return <AdminLanguageContext.Provider value={value}>{children}</AdminLanguageContext.Provider>;
}
