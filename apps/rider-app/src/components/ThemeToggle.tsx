import { Moon, Sun, Palette } from "lucide-react";
import { useTheme, type Theme } from "../lib/useTheme";
import { tDual, type TranslationKey } from "@workspace/i18n";
import { useLanguage } from "../lib/useLanguage";

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme, mounted } = useTheme();
  const { language } = useLanguage();
  const T = (key: TranslationKey) => tDual(key, language);

  if (!mounted) return null; /* Avoid hydration mismatch */

  const themes: Array<{ value: Theme; label: TranslationKey; icon: React.ReactNode }> = [
    { value: "light", label: "lightMode", icon: <Sun size={18} /> },
    { value: "dark", label: "darkMode", icon: <Moon size={18} /> },
    { value: "system", label: "themeSystemDefault", icon: <Palette size={18} /> },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 px-1">
        <Palette size={16} className="text-brand" />
        <p className="text-xs font-bold uppercase tracking-wider text-white/50">
          {T("themeSettings")}
        </p>
      </div>

      {/* Theme selector grid */}
      <div className="grid grid-cols-3 gap-2 px-0">
        {themes.map((t) => (
          <button
            key={t.value}
            onClick={() => setTheme(t.value)}
            className={`relative flex flex-col items-center gap-2 rounded-2xl px-3 py-3 text-xs font-semibold transition-all ${ 
              theme === t.value
                ? "bg-brand text-black ring-2 ring-brand/50"
                : "bg-card-dark text-white/70 hover:bg-card-dark hover:text-white/90"
            }`}
          >
            <div className="flex h-8 w-8 items-center justify-center">
              {t.icon}
            </div>
            <span>{T(t.label)}</span>
            {theme === t.value && (
              <div className="absolute top-1 right-1 h-2 w-2 rounded-full bg-black" />
            )}
          </button>
        ))}
      </div>

      {/* Info text */}
      <p className="px-1 text-[11px] text-white/40">
        {theme === "system"
          ? `Currently using ${resolvedTheme} mode`
          : `${theme} mode`}
      </p>
    </div>
  );
}
