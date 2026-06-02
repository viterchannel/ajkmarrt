import { useState } from "react";
import { Palette, RotateCcw } from "lucide-react";
import { useTheme } from "@/lib/useTheme";
import { useThemeConfig, type ThemeConfig } from "@/lib/useThemeConfig";
import { tDual, type TranslationKey } from "@workspace/i18n";
import { useLanguage } from "@/lib/useLanguage";

interface ColorPickerProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

function ColorPicker({ label, value, onChange }: ColorPickerProps) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
      <div className="flex-1">
        <p className="text-xs font-semibold text-muted-foreground">{label}</p>
        <p className="text-sm font-mono text-foreground">{value}</p>
      </div>
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 w-10 cursor-pointer rounded border-0"
      />
    </div>
  );
}

export function ThemeAdminPanel() {
  const { language } = useLanguage();
  const T = (key: TranslationKey) => tDual(key, language);
  const { resolvedTheme } = useTheme();
  const { config, updateThemeConfig, resetTheme, isLoading } = useThemeConfig();
  const [activeTab, setActiveTab] = useState<"light" | "dark">("light");

  if (isLoading) {
    return (
      <div className="space-y-3 rounded-2xl border border-border/50 bg-card p-4">
        <p className="text-sm text-muted-foreground">Loading theme settings...</p>
      </div>
    );
  }

  const isLightMode = activeTab === "light";
  const colorKeys = isLightMode
    ? [
        { key: "lightBrandPrimary" as const, label: "Primary Brand Color" },
        { key: "lightBrandHover" as const, label: "Brand Hover Color" },
        { key: "lightBackground" as const, label: "Background Color" },
        { key: "lightCard" as const, label: "Card Background" },
        { key: "lightText" as const, label: "Text Color" },
        { key: "lightBorder" as const, label: "Border Color" },
        { key: "lightAccent" as const, label: "Accent Color" },
        { key: "lightSuccess" as const, label: "Success Color" },
        { key: "lightWarning" as const, label: "Warning Color" },
        { key: "lightError" as const, label: "Error Color" },
      ]
    : [
        { key: "darkBrandPrimary" as const, label: "Primary Brand Color" },
        { key: "darkBrandHover" as const, label: "Brand Hover Color" },
        { key: "darkBackground" as const, label: "Background Color" },
        { key: "darkCard" as const, label: "Card Background" },
        { key: "darkText" as const, label: "Text Color" },
        { key: "darkBorder" as const, label: "Border Color" },
        { key: "darkAccent" as const, label: "Accent Color" },
        { key: "darkSuccess" as const, label: "Success Color" },
        { key: "darkWarning" as const, label: "Warning Color" },
        { key: "darkError" as const, label: "Error Color" },
      ];

  return (
    <div className="space-y-4 rounded-2xl border border-border/50 bg-card p-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Palette size={18} className="text-brand" />
        <h3 className="text-sm font-bold uppercase tracking-wider">Brand Theme Control</h3>
      </div>

      {/* Tab selector */}
      <div className="flex gap-2">
        {["light", "dark"].map((theme) => (
          <button
            key={theme}
            onClick={() => setActiveTab(theme as "light" | "dark")}
            className={`flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
              activeTab === theme
                ? "bg-brand text-black"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {theme === "light" ? "Light Mode" : "Dark Mode"}
          </button>
        ))}
      </div>

      {/* Color pickers grid */}
      <div className="space-y-3">
        {colorKeys.map(({ key, label }) => (
          <ColorPicker
            key={key}
            label={label}
            value={config[key] || ""}
            onChange={(value) =>
              updateThemeConfig({
                [key]: value,
              } as Partial<ThemeConfig>)
            }
          />
        ))}
      </div>

      {/* Actions */}
      <div className="flex gap-2 border-t border-border/50 pt-3">
        <button
          onClick={resetTheme}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-muted px-3 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted/80 active:bg-muted/60"
        >
          <RotateCcw size={14} />
          Reset to Defaults
        </button>
        <p className="flex items-center text-xs text-muted-foreground">
          Active: {resolvedTheme}
        </p>
      </div>
    </div>
  );
}

export default ThemeAdminPanel;
