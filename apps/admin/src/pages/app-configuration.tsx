import { PageHeader } from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { adminFetch } from "@/lib/adminFetcher";
import { useQueryClient } from "@tanstack/react-query";
import {
  Eye,
  Loader2,
  Palette,
  Save,
  Settings2,
  Sliders,
  ToggleLeft,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

type Tab = "branding" | "rider-features" | "system-limits";

interface Setting {
  key: string;
  value: string;
  label: string;
  category: string;
}

function ColorSwatch({ color }: { color: string }) {
  const isValid = /^#[0-9A-Fa-f]{3,6}$/.test(color);
  return (
    <span
      className="inline-block h-5 w-5 flex-shrink-0 rounded-md border border-white/50 shadow-sm"
      style={{ backgroundColor: isValid ? color : "#e2e8f0" }}
      title={color}
    />
  );
}

function ToggleRow({
  label,
  description,
  settingKey,
  value,
  dirty,
  onChange,
}: {
  label: string;
  description?: string;
  settingKey: string;
  value: string;
  dirty: boolean;
  onChange: (k: string, v: string) => void;
}) {
  const isOn = value === "on";
  return (
    <div
      className={`flex items-center justify-between rounded-xl border p-4 transition-colors ${dirty ? "border-amber-300 bg-amber-50/30" : "border-slate-200 bg-white"}`}
    >
      <div className="min-w-0 flex-1 pr-4">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-slate-800">{label}</p>
          {dirty && (
            <Badge
              variant="outline"
              className="border-amber-200 bg-amber-50 text-[9px] font-bold text-amber-700"
            >
              CHANGED
            </Badge>
          )}
        </div>
        {description && <p className="mt-0.5 text-xs text-slate-500">{description}</p>}
      </div>
      <button
        type="button"
        onClick={() => onChange(settingKey, isOn ? "off" : "on")}
        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${isOn ? "bg-emerald-500" : "bg-slate-300"}`}
        aria-checked={isOn}
        role="switch"
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${isOn ? "translate-x-5" : "translate-x-0"}`}
        />
      </button>
    </div>
  );
}

function NumberInput({
  label,
  description,
  settingKey,
  value,
  dirty,
  suffix,
  onChange,
  min,
  max,
  step,
}: {
  label: string;
  description?: string;
  settingKey: string;
  value: string;
  dirty: boolean;
  suffix?: string;
  onChange: (k: string, v: string) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <div
      className={`rounded-xl border p-4 transition-colors ${dirty ? "border-amber-300 bg-amber-50/30" : "border-slate-200 bg-white"}`}
    >
      <div className="mb-2 flex items-center gap-2">
        <label className="text-sm font-semibold text-slate-800">{label}</label>
        {dirty && (
          <Badge
            variant="outline"
            className="border-amber-200 bg-amber-50 text-[9px] font-bold text-amber-700"
          >
            CHANGED
          </Badge>
        )}
      </div>
      {description && <p className="mb-2 text-xs text-slate-500">{description}</p>}
      <div className="flex items-center gap-2">
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(settingKey, e.target.value)}
          min={min}
          max={max}
          step={step ?? 1}
          className={`h-9 flex-1 rounded-lg border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-200 ${dirty ? "border-amber-300 bg-amber-50/50" : "border-slate-200"}`}
        />
        {suffix && <span className="text-xs font-medium text-slate-500">{suffix}</span>}
      </div>
      <p className="mt-1 font-mono text-[10px] text-slate-400">{settingKey}</p>
    </div>
  );
}

export default function AppConfigurationPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>("branding");
  const [settings, setSettings] = useState<Setting[]>([]);
  const [localValues, setLocalValues] = useState<Record<string, string>>({});
  const [savedValues, setSavedValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const dirtyKeys = new Set(
    Object.keys(localValues).filter((k) => localValues[k] !== savedValues[k])
  );

  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminFetch("/platform-settings");
      const rows: Setting[] = data.settings ?? data ?? [];
      setSettings(rows);
      const vals: Record<string, string> = {};
      for (const s of rows) vals[s.key] = s.value;
      setLocalValues(vals);
      setSavedValues(vals);
    } catch (e: unknown) {
      toast({
        title: "Failed to load settings",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const handleChange = useCallback((key: string, value: string) => {
    setLocalValues((prev) => ({ ...prev, [key]: value }));
  }, []);

  const v = (key: string, def = "") =>
    localValues[key] ?? settings.find((s) => s.key === key)?.value ?? def;

  const handleSave = async () => {
    if (dirtyKeys.size === 0) {
      toast({ title: "No changes to save" });
      return;
    }
    setSaving(true);
    try {
      const updates = Array.from(dirtyKeys).map((key) => ({
        key,
        value: localValues[key] ?? "",
      }));
      await adminFetch("/platform-settings", {
        method: "PATCH",
        body: JSON.stringify({ settings: updates }),
      });
      setSavedValues({ ...localValues });
      toast({
        title: "Configuration saved",
        description: `${updates.length} setting${updates.length !== 1 ? "s" : ""} updated. Changes take effect within 60 seconds.`,
      });
      void queryClient.invalidateQueries({ queryKey: ["platform-config"] });
    } catch (e: unknown) {
      toast({
        title: "Save failed",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    }
    setSaving(false);
  };

  const tabs: { id: Tab; label: string; icon: React.ElementType; count?: number }[] = [
    { id: "branding", label: "Branding", icon: Palette },
    { id: "rider-features", label: "Rider Features", icon: ToggleLeft },
    { id: "system-limits", label: "System Limits", icon: Sliders },
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 pb-24">
      <PageHeader
        title="App Configuration"
        subtitle="Control Rider App branding, feature toggles, and system limits in real time — no rebuild required."
        icon={Settings2}
        actions={
          <Button
            onClick={() => void handleSave()}
            disabled={saving || dirtyKeys.size === 0}
            className="gap-2"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {saving ? "Saving…" : `Save${dirtyKeys.size > 0 ? ` (${dirtyKeys.size})` : ""}`}
          </Button>
        }
      />

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </div>
      ) : (
        <>
          {/* Tab bar */}
          <div className="flex gap-1 rounded-2xl border border-slate-200 bg-slate-50 p-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all ${
                    isActive
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Tab content */}
          {activeTab === "branding" && (
            <BrandingTab v={v} dirty={dirtyKeys} onChange={handleChange} />
          )}
          {activeTab === "rider-features" && (
            <RiderFeaturesTab v={v} dirty={dirtyKeys} onChange={handleChange} />
          )}
          {activeTab === "system-limits" && (
            <SystemLimitsTab v={v} dirty={dirtyKeys} onChange={handleChange} />
          )}
        </>
      )}
    </div>
  );
}

function BrandingTab({
  v,
  dirty,
  onChange,
}: {
  v: (key: string, def?: string) => string;
  dirty: Set<string>;
  onChange: (k: string, val: string) => void;
}) {
  const primaryColor = v("brand_primary_color", "#00C48C");
  const isValidColor = /^#[0-9A-Fa-f]{3,6}$/.test(primaryColor);

  return (
    <div className="space-y-6">
      {/* Primary color */}
      <div className="overflow-hidden rounded-2xl border-2 border-emerald-200 bg-white">
        <div className="flex items-center gap-3 border-b border-emerald-100 bg-emerald-50 px-5 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100">
            <Palette className="h-4 w-4 text-emerald-600" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-emerald-900">Primary Brand Color</h3>
            <p className="text-xs text-emerald-600">Applied as CSS variable in Rider App at runtime</p>
          </div>
        </div>
        <div className="p-5">
          <div
            className={`rounded-xl border p-4 ${dirty.has("brand_primary_color") ? "border-amber-300 bg-amber-50/30" : "border-slate-200"}`}
          >
            <div className="mb-2 flex items-center gap-2">
              <label className="text-sm font-semibold text-slate-800">Primary Color</label>
              {dirty.has("brand_primary_color") && (
                <Badge
                  variant="outline"
                  className="border-amber-200 bg-amber-50 text-[9px] font-bold text-amber-700"
                >
                  CHANGED
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <ColorSwatch color={primaryColor} />
              <input
                type="text"
                value={primaryColor}
                onChange={(e) => onChange("brand_primary_color", e.target.value)}
                placeholder="#00C48C"
                className={`h-9 flex-1 rounded-lg border px-3 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-emerald-200 ${dirty.has("brand_primary_color") ? "border-amber-300 bg-amber-50/50" : "border-slate-200"} ${!isValidColor && primaryColor ? "border-red-300 bg-red-50/30" : ""}`}
              />
              <input
                type="color"
                value={isValidColor ? primaryColor : "#00C48C"}
                onChange={(e) => onChange("brand_primary_color", e.target.value)}
                className="h-9 w-9 cursor-pointer rounded-lg border border-slate-200 bg-white p-0.5"
                title="Pick color"
              />
            </div>
            {primaryColor && !isValidColor && (
              <p className="mt-1 text-[10px] text-red-500">Must be a valid hex color (e.g. #00C48C)</p>
            )}
            <p className="mt-1 font-mono text-[10px] text-slate-400">brand_primary_color → --brand-primary CSS var</p>
          </div>

          {/* Live preview */}
          {isValidColor && (
            <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 p-3">
              <div className="mb-2 flex items-center gap-1.5">
                <Eye className="h-3.5 w-3.5 text-slate-400" />
                <p className="text-[11px] font-bold text-slate-500">Live preview</p>
              </div>
              <div className="flex items-center gap-3">
                <div
                  className="h-10 w-10 flex-shrink-0 rounded-xl shadow"
                  style={{ background: primaryColor }}
                />
                <div
                  className="h-9 flex-1 rounded-xl shadow"
                  style={{ background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}88)` }}
                />
                <button
                  type="button"
                  className="h-9 rounded-xl px-4 text-sm font-bold text-white shadow"
                  style={{ background: primaryColor }}
                >
                  Button
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Logo & Banner URLs */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="flex items-center gap-3 border-b border-slate-100 bg-slate-50 px-5 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100">
            <Settings2 className="h-4 w-4 text-slate-600" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-800">App Images</h3>
            <p className="text-xs text-slate-500">Logo and banner displayed in the Rider App</p>
          </div>
        </div>
        <div className="space-y-3 p-5">
          {[
            { key: "brand_logo_url", label: "Logo URL", desc: "Shown in header and splash screen" },
            { key: "brand_banner_url", label: "Banner URL", desc: "Home screen promotional banner" },
          ].map((field) => {
            const val = v(field.key);
            const isDirty = dirty.has(field.key);
            return (
              <div
                key={field.key}
                className={`rounded-xl border p-4 ${isDirty ? "border-amber-300 bg-amber-50/30" : "border-slate-200"}`}
              >
                <div className="mb-2 flex items-center gap-2">
                  <label className="text-sm font-semibold text-slate-800">{field.label}</label>
                  {isDirty && (
                    <Badge
                      variant="outline"
                      className="border-amber-200 bg-amber-50 text-[9px] font-bold text-amber-700"
                    >
                      CHANGED
                    </Badge>
                  )}
                </div>
                <p className="mb-2 text-xs text-slate-500">{field.desc}</p>
                <input
                  type="url"
                  value={val}
                  onChange={(e) => onChange(field.key, e.target.value)}
                  placeholder="https://..."
                  className={`h-9 w-full rounded-lg border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-200 ${isDirty ? "border-amber-300 bg-amber-50/50" : "border-slate-200"}`}
                />
                {val && (
                  <img
                    src={val}
                    alt=""
                    className="mt-2 max-h-12 rounded-lg border border-slate-200 object-contain"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                )}
                <p className="mt-1 font-mono text-[10px] text-slate-400">{field.key}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Dark mode default */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="flex items-center gap-3 border-b border-slate-100 bg-slate-50 px-5 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100">
            <ToggleLeft className="h-4 w-4 text-slate-600" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-800">Theme Default</h3>
            <p className="text-xs text-slate-500">Initial theme for riders without a saved preference</p>
          </div>
        </div>
        <div className="p-5">
          <ToggleRow
            label="Dark Mode by Default"
            description="New riders see dark mode until they change their preference"
            settingKey="brand_dark_mode_default"
            value={v("brand_dark_mode_default", "off")}
            dirty={dirty.has("brand_dark_mode_default")}
            onChange={onChange}
          />
        </div>
      </div>
    </div>
  );
}

function RiderFeaturesTab({
  v,
  dirty,
  onChange,
}: {
  v: (key: string, def?: string) => string;
  dirty: Set<string>;
  onChange: (k: string, val: string) => void;
}) {
  const features = [
    {
      key: "rider_instant_payout_enabled",
      label: "Instant Payout",
      desc: "Riders can request immediate wallet withdrawals instead of scheduled payouts",
      default: "off",
    },
    {
      key: "rider_cash_allowed",
      label: "Cash on Delivery (CoD)",
      desc: "Riders can accept cash payments from customers",
      default: "on",
    },
    {
      key: "rider_doc_upload_enabled",
      label: "Document Upload",
      desc: "Riders can upload KYC and verification documents through the app",
      default: "on",
    },
    {
      key: "rider_module_gps_tracking",
      label: "GPS Tracking",
      desc: "Live location tracking for riders (required for delivery dispatch)",
      default: "on",
    },
    {
      key: "rider_push_notifications_enabled",
      label: "Push Notifications",
      desc: "Enable push notification prompt and delivery in the Rider App",
      default: "on",
    },
  ];

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-2xl border border-violet-200 bg-white">
        <div className="flex items-center gap-3 border-b border-violet-100 bg-violet-50 px-5 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-100">
            <ToggleLeft className="h-4 w-4 text-violet-600" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-violet-900">Rider Feature Toggles</h3>
            <p className="text-xs text-violet-600">Toggle features on or off for all riders platform-wide</p>
          </div>
        </div>
        <div className="space-y-3 p-5">
          {features.map((f) => (
            <ToggleRow
              key={f.key}
              label={f.label}
              description={f.desc}
              settingKey={f.key}
              value={v(f.key, f.default)}
              dirty={dirty.has(f.key)}
              onChange={onChange}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function SystemLimitsTab({
  v,
  dirty,
  onChange,
}: {
  v: (key: string, def?: string) => string;
  dirty: Set<string>;
  onChange: (k: string, val: string) => void;
}) {
  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-2xl border border-sky-200 bg-white">
        <div className="flex items-center gap-3 border-b border-sky-100 bg-sky-50 px-5 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-100">
            <Sliders className="h-4 w-4 text-sky-600" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-sky-900">System Limits</h3>
            <p className="text-xs text-sky-600">Operational boundaries and commission rates</p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
          <NumberInput
            label="Delivery Radius"
            description="Maximum distance (km) from pickup for dispatch assignment"
            settingKey="rider_delivery_radius_km"
            value={v("rider_delivery_radius_km", "5")}
            dirty={dirty.has("rider_delivery_radius_km")}
            suffix="km"
            min={1}
            max={100}
            step={0.5}
            onChange={onChange}
          />
          <NumberInput
            label="Platform Commission"
            description="Percentage taken by platform from each delivery"
            settingKey="platform_commission_pct"
            value={v("platform_commission_pct", "10")}
            dirty={dirty.has("platform_commission_pct")}
            suffix="%"
            min={0}
            max={50}
            step={0.5}
            onChange={onChange}
          />
          <NumberInput
            label="Min Wallet Balance"
            description="Minimum wallet balance required to accept ride/delivery requests"
            settingKey="rider_min_balance"
            value={v("rider_min_balance", "0")}
            dirty={dirty.has("rider_min_balance")}
            suffix="Rs."
            min={0}
            max={10000}
            step={50}
            onChange={onChange}
          />
          <NumberInput
            label="Rider Keep %"
            description="Percentage of fare that riders keep after platform commission"
            settingKey="rider_keep_pct"
            value={v("rider_keep_pct", "80")}
            dirty={dirty.has("rider_keep_pct")}
            suffix="%"
            min={50}
            max={100}
            step={1}
            onChange={onChange}
          />
          <NumberInput
            label="Min Rider Payout"
            description="Minimum balance required before a payout can be requested"
            settingKey="rider_min_payout"
            value={v("rider_min_payout", "500")}
            dirty={dirty.has("rider_min_payout")}
            suffix="Rs."
            min={0}
            max={5000}
            step={100}
            onChange={onChange}
          />
          <NumberInput
            label="Max Active Deliveries"
            description="Maximum concurrent deliveries a rider can carry"
            settingKey="rider_max_deliveries"
            value={v("rider_max_deliveries", "3")}
            dirty={dirty.has("rider_max_deliveries")}
            min={1}
            max={10}
            step={1}
            onChange={onChange}
          />
        </div>
      </div>
    </div>
  );
}
