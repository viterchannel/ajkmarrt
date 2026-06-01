import { useState } from "react";
import { useLocation } from "wouter";
import { Shield, Clock, Bell, Globe, ChevronLeft, ChevronRight, Sun, Moon } from "lucide-react";
import { tDual, type Language, type TranslationKey } from "@workspace/i18n";
import { useLanguage } from "../lib/useLanguage";
import { useTheme } from "../lib/useTheme";

function getNotifPref(key: string): boolean {
  try { return localStorage.getItem(`notif_${key}`) !== "false"; } catch { return true; }
}
function saveNotifPref(key: string, val: boolean) {
  try { localStorage.setItem(`notif_${key}`, val ? "true" : "false"); } catch {}
}

function useSettingToggle(key: string): [boolean, (val: boolean) => void] {
  const [val, setVal] = useState<boolean>(() => getNotifPref(key));
  return [val, (v) => { saveNotifPref(key, v); setVal(v); }];
}

interface SettingsRowProps {
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  sublabel?: string;
  onClick: () => void;
}

function SettingsRow({ icon, iconBg, label, sublabel, onClick }: SettingsRowProps) {
  return (
    <button
      className="w-full flex items-center gap-4 px-4 py-4 bg-card-dark hover:bg-border-dark transition-colors text-left"
      onClick={onClick}
      aria-label={label}
    >
      <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${iconBg}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-foreground">{label}</div>
        {sublabel && <div className="text-xs text-[#B0B0B0] mt-0.5 truncate">{sublabel}</div>}
      </div>
      <ChevronRight size={16} className="text-[#B0B0B0] flex-shrink-0" />
    </button>
  );
}

interface ToggleRowProps {
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  sublabel?: string;
  checked: boolean;
  onChange: (val: boolean) => void;
}

function ToggleRow({ icon, iconBg, label, sublabel, checked, onChange }: ToggleRowProps) {
  return (
    <div className="w-full flex items-center gap-4 px-4 py-4 bg-card-dark">
      <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${iconBg}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-foreground">{label}</div>
        {sublabel && <div className="text-xs text-[#B0B0B0] mt-0.5 truncate">{sublabel}</div>}
      </div>
      <button
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${
          checked ? "bg-brand" : "bg-border-dark"
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="px-4 pt-5 pb-2">
      <span className="text-xs font-bold text-[#B0B0B0] uppercase tracking-wider">{title}</span>
    </div>
  );
}

function SectionCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-4 rounded-xl border border-border-dark overflow-hidden divide-y divide-border-dark">
      {children}
    </div>
  );
}

export default function Settings() {
  const { language, setLanguage } = useLanguage();
  const T = (key: TranslationKey) => tDual(key, language);
  const [, navigate] = useLocation();
  const { isDark, toggleDark } = useTheme();
  const [orderNotif, setOrderNotif] = useSettingToggle("orders");
  const [chatNotif, setChatNotif] = useSettingToggle("chat");
  const [promoNotif, setPromoNotif] = useSettingToggle("promos");

  return (
    <div className="min-h-screen bg-page-bg pb-24">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-surface border-b border-border-dark px-4 pt-[calc(env(safe-area-inset-top,0px)+12px)] pb-3">
        <button
          onClick={() => navigate("/profile")}
          aria-label={T("back")}
          className="flex items-center gap-2 text-[#B0B0B0] hover:text-foreground transition-colors mb-1"
        >
          <ChevronLeft size={18} />
          <span className="text-sm">{T("back")}</span>
        </button>
        <h1 className="text-xl font-bold text-foreground">{T("settings")}</h1>
        <p className="text-xs text-[#B0B0B0] mt-0.5">{T("settingsAccountPrefs")}</p>
      </div>

      {/* Security */}
      <SectionHeader title={T("sectionSecurityLabel")} />
      <SectionCard>
        <SettingsRow
          icon={<Shield size={17} className="text-error" />}
          iconBg="bg-error/10"
          label={T("securitySettingsLink")}
          sublabel={T("settingsPassword2faSession")}
          onClick={() => navigate("/settings/security")}
        />
        <SettingsRow
          icon={<Clock size={17} className="text-[#B0B0B0]" />}
          iconBg="bg-border-dark"
          label={T("settingsLoginHistoryLabel")}
          sublabel={T("settingsRecentSignIn")}
          onClick={() => navigate("/settings/login-history")}
        />
      </SectionCard>

      <div className="h-px bg-border-dark mx-4" />

      {/* Notifications */}
      <SectionHeader title={T("sectionNotificationsLabel")} />
      <SectionCard>
        <ToggleRow
          icon={<Bell size={17} className="text-brand" />}
          iconBg="bg-brand/10"
          label={T("settingsOrderAlerts")}
          sublabel={T("settingsNewRideDelivery")}
          checked={orderNotif}
          onChange={setOrderNotif}
        />
        <ToggleRow
          icon={<Bell size={17} className="text-[#B0B0B0]" />}
          iconBg="bg-border-dark"
          label={T("settingsChatMessages")}
          sublabel={T("settingsSupportMessages")}
          checked={chatNotif}
          onChange={setChatNotif}
        />
        <ToggleRow
          icon={<Bell size={17} className="text-warning" />}
          iconBg="bg-warning/10"
          label={T("settingsPromoBonuses")}
          sublabel={T("settingsSurgeAlerts")}
          checked={promoNotif}
          onChange={setPromoNotif}
        />
      </SectionCard>

      <div className="h-px bg-border-dark mx-4" />

      {/* Appearance */}
      <SectionHeader title={T("appearanceLabel")} />
      <SectionCard>
        <ToggleRow
          icon={isDark ? <Moon size={17} className="text-brand" /> : <Sun size={17} className="text-warning" />}
          iconBg={isDark ? "bg-brand/10" : "bg-warning/10"}
          label={T("darkMode")}
          checked={isDark}
          onChange={toggleDark}
        />
      </SectionCard>

      <div className="h-px bg-border-dark mx-4" />

      {/* Language */}
      <SectionHeader title={T("settingsLanguageApp")} />
      <SectionCard>
        <div className="px-4 py-4 bg-card-dark">
          <div className="flex items-center gap-4 mb-3">
            <div className="w-9 h-9 rounded-full bg-brand/10 flex items-center justify-center flex-shrink-0">
              <Globe size={17} className="text-brand" />
            </div>
            <div>
              <div className="text-sm font-semibold text-foreground">{T("settingsLanguageTitle")}</div>
              <div className="text-xs text-[#B0B0B0] mt-0.5">{T("settingsAppDisplayLang")}</div>
            </div>
          </div>
          <div className="flex gap-2">
            {(
              [
                { code: "en", label: "English" },
                { code: "ur", label: "اردو" },
                { code: "roman", label: "Roman" },
              ] as { code: Language; label: string }[]
            ).map(({ code, label }) => (
              <button
                key={code}
                onClick={() => setLanguage(code)}
                aria-pressed={language === code}
                className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                  language === code
                    ? "bg-brand text-surface"
                    : "bg-border-dark text-[#B0B0B0] hover:text-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
