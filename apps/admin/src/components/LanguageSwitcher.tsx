import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LANGUAGE_OPTIONS } from "@workspace/i18n";
import { useAdminTranslation } from "@/lib/AdminLanguageContext";

/**
 * LanguageSwitcher — admin UI to change language
 * Typically placed in settings or header
 */
export function LanguageSwitcher() {
  const { language, setLanguage, loading } = useAdminTranslation();

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="lang-select" className="text-sm font-medium">
        Language
      </label>
      <Select
        value={language}
        onValueChange={(val) => void setLanguage(val as any)}
        disabled={loading}
      >
        <SelectTrigger id="lang-select" className="w-[150px]">
          <SelectValue placeholder="Select language" />
        </SelectTrigger>
        <SelectContent>
          {LANGUAGE_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.nativeLabel}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
