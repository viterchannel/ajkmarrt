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
  Save,
  Smartphone,
  Store,
  Truck,
  UserCog,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

type AppRole = "admin" | "vendor" | "rider" | "customer";
type ThemeId = "darkGold" | "light" | "darkBlue" | "darkNavy" | "highContrast";

interface ThemeConfig {
  selectedTheme: ThemeId;
  colors: {
    primary: { dark: string; gold: string; darkGold: string };
    secondary: { lightGray: string; darkGray: string; borderGray: string };
    semantic: { success: string; warning: string; error: string; info: string };
    text: { primary: string; secondary: string; light: string };
  };
  appRole?: string;
  updatedAt?: string;
}

const ROLES: { id: AppRole; label: string; icon: React.ElementType }[] = [
  { id: "admin", label: "Admin Panel", icon: UserCog },
  { id: "vendor", label: "Vendor App", icon: Store },
  { id: "rider", label: "Rider App", icon: Truck },
  { id: "customer", label: "Customer App", icon: Smartphone },
];

const THEMES: { id: ThemeId; name: string; description: string }[] = [
  { id: "darkGold", name: "Dark Gold", description: "Premium dark theme with gold accents" },
  { id: "light", name: "Light", description: "Clean light mode with gold accents" },
  { id: "darkBlue", name: "Dark Blue", description: "Dark theme with blue primary" },
  { id: "darkNavy", name: "Dark Navy", description: "Dark navy variant for contrast" },
  { id: "highContrast", name: "High Contrast", description: "WCAG AAA accessibility compliant" },
];

const DEFAULT_COLORS: ThemeConfig["colors"] = {
  primary: { dark: "#1A1A2E", gold: "#D4AF37", darkGold: "#C4860F" },
  secondary: { lightGray: "#F5F5F5", darkGray: "#333333", borderGray: "#E0E0E0" },
  semantic: { success: "#4CAF50", warning: "#FFC107", error: "#F44336", info: "#2196F3" },
  text: { primary: "#1A1A2E", secondary: "#666666", light: "#FFFFFF" },
};

function ColorSwatch({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className="inline-block h-6 w-6 flex-shrink-0 rounded-md border border-slate-300 shadow-sm"
        style={{ backgroundColor: color }}
        title={color}
      />
      <span className="text-xs font-mono text-slate-500">{label}</span>
    </div>
  );
}

function ColorGroup({ title, colors }: { title: string; colors: Record<string, string> }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">{title}</p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {Object.entries(colors).map(([key, value]) => (
          <ColorSwatch key={key} color={value} label={key} />
        ))}
      </div>
    </div>
  );
}

export default function ThemeManagement() {
  const { toast } = useToast();
  const [activeRole, setActiveRole] = useState<AppRole>("admin");
  const [configs, setConfigs] = useState<Record<AppRole, ThemeConfig>>({
    admin: { selectedTheme: "darkGold", colors: DEFAULT_COLORS },
    vendor: { selectedTheme: "darkGold", colors: DEFAULT_COLORS },
    rider: { selectedTheme: "darkGold", colors: DEFAULT_COLORS },
    customer: { selectedTheme: "darkGold", colors: DEFAULT_COLORS },
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState<Record<AppRole, boolean>>({
    admin: false,
    vendor: false,
    rider: false,
    customer: false,
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
              selectedTheme: (cfg.selectedTheme as ThemeId) || "darkGold",
              colors: cfg.colors || DEFAULT_COLORS,
              appRole: role,
              updatedAt: cfg.updatedAt,
            };
          }
        }
        setConfigs((prev) => ({ ...prev, ...next }));
      }
    } catch (err) {
      toast({ title: "Failed to load theme configs", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchConfigs();
  }, [fetchConfigs]);

  const setRoleTheme = (role: AppRole, themeId: ThemeId) => {
    setConfigs((prev) => ({
      ...prev,
      [role]: { ...prev[role], selectedTheme: themeId },
    }));
    setDirty((prev) => ({ ...prev, [role]: true }));
  };

  const saveRole = async (role: AppRole) => {
    setSaving(true);
    try {
      const cfg = configs[role];
      const response = await adminFetch("/theme-config", {
        method: "POST",
        body: JSON.stringify({
          theme: cfg.selectedTheme,
          colors: cfg.colors,
          appRole: role,
        }),
      });
      if (!response.ok) throw new Error("Save failed");
      setDirty((prev) => ({ ...prev, [role]: false }));
      toast({ title: `${ROLES.find((r) => r.id === role)?.label} theme saved` });
    } catch (err) {
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
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Select Theme</h2>
            <p className="text-sm text-slate-500">Choose the active theme for the {ROLES.find((r) => r.id === activeRole)?.label}</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchConfigs}
              disabled={loading}
              className="gap-1"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Refresh
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

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
                  <span className="text-sm font-semibold text-slate-800">{theme.name}</span>
                  {isSelected && (
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-white">
                      <Check className="h-3 w-3" />
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500">{theme.description}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Current colors preview */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-700">Current Colors</h3>
        <ColorGroup title="Primary" colors={current.colors.primary} />
        <ColorGroup title="Secondary" colors={current.colors.secondary} />
        <ColorGroup title="Semantic" colors={current.colors.semantic} />
        <ColorGroup title="Text" colors={current.colors.text} />
      </div>

      {/* JSON preview */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Live Config</p>
        <pre className="overflow-x-auto text-xs text-slate-700">
          {JSON.stringify(current, null, 2)}
        </pre>
      </div>
    </div>
  );
}
