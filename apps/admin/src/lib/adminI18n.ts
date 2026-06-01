import { t, type TranslationKey, type Language } from "@workspace/i18n";
import { ADMIN_I18N_KEYS } from "./i18nKeys";

/**
 * Mapping from admin-specific keys to actual i18n translation keys
 * This allows admin to have semantic keys while reusing existing translations
 */
const KEY_MAP: Record<string, TranslationKey> = {
  // Common actions
  "admin.common.save": "save",
  "admin.common.cancel": "cancel",
  "admin.common.delete": "delete",
  "admin.common.edit": "edit",
  "admin.common.create": "create",
  "admin.common.confirm": "confirm",
  "admin.common.loading": "loading",
  "admin.common.saving": "saving",
  "admin.common.submit": "submit",
  "admin.common.back": "back",
  "admin.common.next": "next",
  "admin.common.close": "close",
  "admin.common.search": "search",
  "admin.common.filter": "filter",
  "admin.common.refresh": "refresh",
  "admin.common.retry": "retry",
  "admin.common.export": "export",
  "admin.common.import": "import",

  // Status/feedback
  "admin.status.online": "online",
  "admin.status.offline": "offline",
  "admin.status.success": "success",
  "admin.status.error": "error",
  "admin.status.pending": "pending",
  "admin.status.failed": "failed",
  "admin.status.completed": "completed",
  "admin.status.saved": "languageSaved",
  "admin.status.save-failed": "saveFailed",
};

/**
 * tAdmin - Translate admin strings using ADMIN_I18N_KEYS
 * Maps admin keys to existing i18n translation keys
 *
 * @param key - Key from ADMIN_I18N_KEYS
 * @param lang - Language to translate to
 * @returns Translated string with fallback
 */
export function tAdmin(key: string, lang: Language): string {
  const mappedKey = KEY_MAP[key] as TranslationKey | undefined;
  if (mappedKey) {
    return t(mappedKey, lang);
  }
  // Fallback to just returning readable version of key
  return key.split(".").pop()?.replace(/-/g, " ") || key;
}

/**
 * Get admin keys registry
 */
export function getAdminI18nKeys() {
  return ADMIN_I18N_KEYS;
}
