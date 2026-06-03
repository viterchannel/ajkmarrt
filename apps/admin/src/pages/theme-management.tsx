import { PageHeader } from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { adminFetch } from "@/lib/adminFetcher";
import {
  Check,
  Loader2,
  Palette,
  RefreshCw,
  RotateCcw,
  Save,
  Smartphone,
  Store,
  Truck,
  UserCog,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

type AppRole = "admin" | "vendor" | "rider" | "customer";
type ThemeId = "dark-gold" | "light-mode" | "dark-blue" | "dark-navy" | "high-contrast";

interface ThemeColors {
  primary: { dark: string; gold: string; darkGold: string };
  secondary: { lightGray: string; darkGray: string; borderGray: string };
  semantic: { success: string; warning: string; error: string; info: string };
  text: { primary: string; secondary: string; light: string };
}

interface ThemeConfig {
  selectedTheme: ThemeId;
  colors: ThemeColors;
  appRole?: string;
  updatedAt?: string;
}

const ROLES: { id: AppRole; label: string; icon: React.ElementType }[] = [
  { id: "admin", label: "Admin Panel", icon: UserCog },
  { id: "vendor", label: "Vendor App", icon: Store },
  { id: "rider", label: "Rider App", icon: Truck },
  { id: "customer", label: "Customer App", icon: Smartphone },
];

const THEMES: { id: ThemeId; name: string; description: string; preview: string[] }[] = [
  { id: "dark-gold", name: "Dark Gold", description: "Premium dark theme with gold accents", preview: ["#1A1A2E", "#D4AF37", "#C4860F"] },
  { id: "light-mode", name: "Light Mode", description: "Clean light mode with gold accents", preview: ["#FFFFFF", "#D4AF37", "#F5F5F5"] },
  { id: "dark-blue", name: "Dark Blue", description: "Dark theme with blue primary", preview: ["#0D1B2A", "#1565C0", "#1E3A5F"] },
  { id: "dark-navy", name: "Dark Navy", description: "Dark navy variant for contrast", preview: ["#0A0E1A", "#2563EB", "#1E3A8A"] },
  { id: "high-contrast", name: "High Contrast", description: "WCAG AAA accessibility compliant", preview: ["#000000", "#FFFF00", "#FFFFFF"] },
];

const THEME_DEFAULTS: Record<ThemeId, ThemeColors> = {
  "dark-gold": {
    primary: { dark: "#1A1A2E", gold: "#D4AF37", darkGold: "#C4860F" },
    secondary: { lightGray: "#F5F5F5", darkGray: "#333333", borderGray: "#E0E0E0" },
    semantic: { success: "#4CAF50", warning: "#FFC107", error: "#F44336", info: "#2196F3" },
    text: { primary: "#1A1A2E", secondary: "#666666", light: "#FFFFFF" },
  },
  "light-mode": {
    primary: { dark: "#FFFFFF", gold: "#D4AF37", darkGold: "#C4860F" },
    secondary: { lightGray: "#F9FAFB", darkGray: "#374151", borderGray: "#E5E7EB" },
    semantic: { success: "#16A34A", warning: "#D97706", error: "#DC2626", info: "#2563EB" },
    text: { primary: "#111827", secondary: "#6B7280", light: "#FFFFFF" },
  },
  "dark-blue": {
    primary: { dark: "#0D1B2A", gold: "#1565C0", darkGold: "#1E3A5F" },
    secondary: { lightGray: "#F0F4F8", darkGray: "#1E3A5F", borderGray: "#2D4A6F" },
    semantic: { success: "#4CAF50", warning: "#FFC107", error: "#F44336", info: "#29B6F6" },
    text: { primary: "#E3F2FD", secondary: "#90CAF9", light: "#FFFFFF" },
  },
  "dark-navy": {
    primary: { dark: "#0A0E1A", gold: "#2563EB", darkGold: "#1E3A8A" },
    secondary: { lightGray: "#EFF6FF", darkGray: "#1E3A8A", borderGray: "#1D4ED8" },
    semantic: { success: "#22C55E", warning: "#F59E0B", error: "#EF4444", info: "#3B82F6" },
    text: { primary: "#DBEAFE", secondary: "#93C5FD", light: "#FFFFFF" },
  },
  "high-contrast": {
    primary: { dark: "#000000", gold: "#FFFF00", darkGold: "#FFD700" },
    secondary: { lightGray: "#FFFFFF", darkGray: "#000000", borderGray: "#FFFFFF" },
    semantic: { success: "#00FF00", warning: "#FFFF00", error: "#FF0000", info: "#00FFFF" },
    text: { primary: "#000000", secondary: "#333333", light: "#FFFFFF" },
  },
};

const GROUP_LABELS: Record<keyof ThemeColors, string> = {
  primary: "Primary",
  secondary: "Secondary",
  semantic: "Semantic",
  text: "Text",
};

const COLOR_LABELS: Record<string, string> = {
  dark: "Dark Background",
  gold: "Brand Gold",
  darkGold: "Dark Gold Hover",
  lightGray: "Light Gray",
  darkGray: "Dark Gray",
  borderGray: "Border Gray",
  success: "Success",
  warning: "Warning",
  error: "Error",
  info: "Info",
  primary: "Primary Text",
  secondary: "Secondary Text",
  light: "Light / White",
};

function ColorPicker({
  groupKey,
  colorKey,
  value,
  onChange,
}: {
  groupKey: keyof ThemeColors;
  colorKey: string;
  value: string;
  onChange: (group: keyof ThemeColors, key: string, val: string) => void;
}) {
  const label = COLOR_LABELS[colorKey] ?? colorKey;
  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
      <label className="relative flex-shrink-0 cursor-pointer">
        <span
          className="block h-8 w-8 rounded-md border-2 border-white shadow-md ring-1 ring-slate-200 transition-transform hover:scale-110"
          style={{ backgroundColor: value }}
        />
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(groupKey, colorKey, e.target.value)}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          title={`Pick ${label} color`}
        />
      </label>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-slate-700">{label}</p>
        <p className="font-mono text-[10px] text-slate-400 uppercase">{value}</p>
      </div>
    </div>
  );
}

function ColorGroupEditor({
  title,
  groupKey,
  colors,
  onChange,
}: {
  title: string;
  groupKey: keyof ThemeColors;
  colors: Record<string, string>;
  onChange: (group: keyof ThemeColors, key: string, val: string) => void;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">{title}</p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {Object.entries(colors).map(([key, value]) => (
          <ColorPicker
            key={key}
            groupKey={groupKey}
            colorKey={key}
            value={value}
            onChange={onChange}
          />
        ))}
      </div>
    </div>
  );
}

export default function ThemeManagement() {
  const { toast } = useToast();
  const [activeRole, setActiveRole] = useState<AppRole>("admin");
  const [configs, setConfigs] = useState<Record<AppRole, ThemeConfig>>({
    admin:    { selectedTheme: "dark-gold",  colors: THEME_DEFAULTS["dark-gold"] },
    vendor:   { selectedTheme: "dark-blue",  colors: THEME_DEFAULTS["dark-blue"] },
    rider:    { selectedTheme: "dark-gold",  colors: THEME_DEFAULTS["dark-gold"] },
    customer: { selectedTheme: "dark-gold",  colors: THEME_DEFAULTS["dark-gold"] },
  });
  const [loading, setLoading]   = useState(false);
  const [saving, setSaving]     = useState(false);
  const [dirty, setDirty]       = useState<Record<AppRole, boolean>>({
    admin: false, vendor: false, rider: false, customer: false,
  });

  const fetchConfigs = useCallback(async () => {
    setLoading(true);
    try {
      const response = await adminFetch("/theme-config");
      const data = await response.json();
      if (data.configs) {
        const next: Record<string, ThemeConfig> = {};
        for (const cfg of data.configs) {
          const role = cfg.appRole as AppRole;
          if (role) {
            next[role] = {
              selectedTheme: (cfg.selectedTheme as ThemeId) || "dark-gold",
              colors: cfg.colors || THEME_DEFAULTS[cfg.selectedTheme as ThemeId] || THEME_DEFAULTS["dark-gold"],
              appRole: role,
              updatedAt: cfg.updatedAt,
            };
          }
        }
        setConfigs((prev) => ({ ...prev, ...next }));
      }
    } catch {
      toast({ title: "Failed to load theme configs", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchConfigs(); }, [fetchConfigs]);

  const setRoleTheme = (role: AppRole, themeId: ThemeId) => {
    setConfigs((prev) => ({
      ...prev,
      [role]: {
        ...prev[role],
        selectedTheme: themeId,
        colors: THEME_DEFAULTS[themeId],
      },
    }));
    setDirty((prev) => ({ ...prev, [role]: true }));
  };

  const updateColor = (role: AppRole, group: keyof ThemeColors, key: string, value: string) => {
    setConfigs((prev) => ({
      ...prev,
      [role]: {
        ...prev[role],
        colors: {
          ...prev[role].colors,
          [group]: {
            ...(prev[role].colors[group] as Record<string, string>),
            [key]: value,
          },
        },
      },
    }));
    setDirty((prev) => ({ ...prev, [role]: true }));
  };

  const resetRoleColors = (role: AppRole) => {
    const themeId = configs[role].selectedTheme;
    setConfigs((prev) => ({
      ...prev,
      [role]: { ...prev[role], colors: THEME_DEFAULTS[themeId] },
    }));
    setDirty((prev) => ({ ...prev, [role]: true }));
  };

  const saveRole = async (role: AppRole) => {
    setSaving(true);
    try {
      const cfg = configs[role];
      const response = await adminFetch("/theme-config", {
        method: "POST",
        body: JSON.stringify({ theme: cfg.selectedTheme, colors: cfg.colors, appRole: role }),
      });
      if (!response.ok) throw new Error("Save failed");
      setDirty((prev) => ({ ...prev, [role]: false }));
      toast({ title: `${ROLES.find((r) => r.id === role)?.label} theme saved` });
    } catch {
      toast({ title: "Failed to save theme", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const current = configs[activeRole];

  return (
    <div className="space-y-6">
      <PageHeader title="Theme Management" icon={Palette} />

      {/* Role selector tabs */}
      <div className="flex gap-2 overflow-x-auto rounded-xl bg-white p-2 shadow-sm border border-slate-200">
        {ROLES.map((role) => {
          const Icon = role.icon;
          const isActive = activeRole === role.id;
          return (
            <button
              key={role.id}
              onClick={() => setActiveRole(role.id)}
              className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${
                isActive
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "bg-transparent text-slate-600 hover:bg-slate-50"
              }`}
            >
              <Icon className="h-4 w-4" />
              {role.label}
              {dirty[role.id] && (
                <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[10px] ml-1">
                  unsaved
                </Badge>
              )}
            </button>
          );
        })}
      </div>

      {/* Theme selector */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Select Theme</h2>
            <p className="text-sm text-slate-500">
              Choose the active theme for the {ROLES.find((r) => r.id === activeRole)?.label}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchConfigs} disabled={loading} className="gap-1">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => resetRoleColors(activeRole)}
              disabled={saving}
              className="gap-1"
              title="Reset colors to theme defaults"
            >
              <RotateCcw className="h-4 w-4" />
              Reset Colors
            </Button>
            <Button
              size="sm"
              onClick={() => saveRole(activeRole)}
              disabled={saving || !dirty[activeRole]}
              className="gap-1 bg-indigo-600 hover:bg-indigo-700"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {THEMES.map((theme) => {
            const isSelected = current.selectedTheme === theme.id;
            return (
              <button
                key={theme.id}
                onClick={() => setRoleTheme(activeRole, theme.id)}
                className={`flex flex-col items-start rounded-xl border p-4 text-left transition-all ${
                  isSelected
                    ? "border-indigo-500 bg-indigo-50/50 ring-1 ring-indigo-500"
                    : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                <div className="mb-2 flex w-full items-center justify-between">
                  {/* Color preview dots */}
                  <div className="flex gap-1">
                    {theme.preview.map((c, i) => (
                      <span
                        key={i}
                        className="block h-4 w-4 rounded-full border border-white shadow-sm"
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                  {isSelected && (
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-white">
                      <Check className="h-3 w-3" />
                    </span>
                  )}
                </div>
                <span className="text-sm font-semibold text-slate-800">{theme.name}</span>
                <p className="mt-0.5 text-[11px] text-slate-500 leading-tight">{theme.description}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Color customization */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-700">Customize Colors</h3>
          <p className="text-xs text-slate-400">Click any swatch to open the color picker</p>
        </div>
        <div className="space-y-3">
          {(Object.keys(GROUP_LABELS) as (keyof ThemeColors)[]).map((group) => (
            <ColorGroupEditor
              key={group}
              title={GROUP_LABELS[group]}
              groupKey={group}
              colors={current.colors[group] as Record<string, string>}
              onChange={(g, k, v) => updateColor(activeRole, g, k, v)}
            />
          ))}
        </div>
      </div>

      {/* Last saved info */}
      {current.updatedAt && (
        <p className="text-xs text-slate-400">
          Last saved: {new Date(current.updatedAt).toLocaleString()}
        </p>
      )}
    </div>
  );
}
