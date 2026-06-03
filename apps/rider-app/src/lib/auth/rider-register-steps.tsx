/**
 * rider-register-steps.tsx — rider-app
 *
 * 3-step registration wizard (spec-aligned):
 *   Step 1 — Personal Details  : name, phone, email?, CNIC, city/area, full address
 *   Step 2 — Vehicle Info      : vehicleType, plateNumber, licenseNumber
 *   Step 3 — Password & Terms  : password (strength meter), confirmPassword, terms
 *
 * Phone OTP is NOT part of registration — enforced post-login via feature gate.
 */
import type { StepConfig, StepComponentProps } from "@workspace/auth-react";
import { useAuthTheme } from "@workspace/auth-react";
import { tDual, type TranslationKey } from "@workspace/i18n";
import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import { useLanguage } from "../useLanguage";
import { isValidPhone, isValidCnic } from "@workspace/phone-utils";

/* ─── Draft helpers ─────────────────────────────────────────────────── */
export const DRAFT_KEY = "rider_reg_draft";
export const DRAFT_TTL_KEY = "rider_reg_draft_ts";
const DRAFT_TTL_MS = 24 * 60 * 60 * 1000;

export function loadDraft(): Record<string, unknown> {
  try {
    const ts = Number(localStorage.getItem(DRAFT_TTL_KEY) ?? 0);
    if (Date.now() - ts > DRAFT_TTL_MS) return {};
    return JSON.parse(localStorage.getItem(DRAFT_KEY) ?? "{}") as Record<string, unknown>;
  } catch { return {}; }
}

export function saveDraft(key: string, value: unknown) {
  try {
    if (key === "password" || key === "confirmPassword") return;
    if (value instanceof File) return;
    const draft = loadDraft();
    draft[key] = value;
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    localStorage.setItem(DRAFT_TTL_KEY, String(Date.now()));
  } catch { }
}

/* ─── Shared input / label styles ───────────────────────────────────── */
function useStyles() {
  const t = useAuthTheme();
  return {
    t,
    inp: {
      width: "100%",
      height: 48,
      padding: "0 14px",
      borderRadius: 12,
      background: t.surface ?? "var(--card)",
      border: `1.5px solid ${t.border ?? "var(--border)"}`,
      color: t.text ?? "var(--foreground)",
      fontSize: 14,
      outline: "none",
      boxSizing: "border-box",
    } as React.CSSProperties,
    lbl: {
      fontSize: 11,
      fontWeight: 700,
      color: t.primary ?? "var(--primary)",
      textTransform: "uppercase",
      letterSpacing: "0.07em",
      display: "block",
    } as React.CSSProperties,
    hint: {
      fontSize: 11,
      margin: "4px 0 0",
    } as React.CSSProperties,
  };
}

/* ─── stepFadeIn animation + focus ring ─────────────────────────────── */
const STEP_FADE_IN_STYLE = `
@keyframes stepFadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
.rider-reg-input:focus {
  border-color: #FFD700 !important;
  box-shadow: 0 0 0 3px rgba(255,215,0,0.18) !important;
  outline: none !important;
}
`;

function injectStepAnimation() {
  if (typeof document === "undefined") return;
  const id = "rider-step-fade-in";
  if (!document.getElementById(id)) {
    const s = document.createElement("style");
    s.id = id;
    s.textContent = STEP_FADE_IN_STYLE;
    document.head.appendChild(s);
  }
}

/* ─── Field wrapper ─────────────────────────────────────────────────── */
function Field({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {children}
    </div>
  );
}

/* ─── CNIC formatter ────────────────────────────────────────────────── */
function fmtCnic(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 13);
  if (d.length <= 5) return d;
  if (d.length <= 12) return `${d.slice(0, 5)}-${d.slice(5)}`;
  return `${d.slice(0, 5)}-${d.slice(5, 12)}-${d.slice(12)}`;
}

/* ─── Inline feedback icons ─────────────────────────────────────────── */
const CheckMark = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2.5" strokeLinecap="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);
const CrossMark = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2.5" strokeLinecap="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

/* ─── Password strength ─────────────────────────────────────────────── */
function getPasswordStrength(pw: string): { level: 0 | 1 | 2 | 3; label: string } {
  if (!pw) return { level: 0, label: "" };
  const hasUpper = /[A-Z]/.test(pw);
  const hasNumber = /[0-9]/.test(pw);
  const hasSymbol = /[^A-Za-z0-9]/.test(pw);
  if (pw.length >= 8 && hasUpper && hasNumber && hasSymbol) return { level: 3, label: "Strong" };
  if (pw.length >= 8 && ((hasUpper && hasNumber) || (hasNumber && hasSymbol))) return { level: 2, label: "Fair" };
  return { level: 1, label: "Weak" };
}

function PasswordStrengthBar({ password }: { password: string }) {
  const { t } = useStyles();
  const { language } = useLanguage();
  const T = (key: TranslationKey) => tDual(key, language);
  const { level } = getPasswordStrength(password);
  if (!password) return null;
  const colors = [t.error ?? "#EF4444", "#F59E0B", "#22C55E"];
  const activeColor = colors[level - 1] ?? colors[0];
  const labelKeys: Record<number, TranslationKey> = {
    1: "regPasswordWeakLabel",
    2: "regPasswordFairLabel",
    3: "regPasswordStrongLabel",
  };
  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ display: "flex", gap: 4, marginBottom: 4 }}>
        {[1, 2, 3].map((bar) => (
          <div key={bar} style={{
            flex: 1, height: 4, borderRadius: 2,
            background: bar <= level ? activeColor : t.border,
            transition: "background 0.2s",
          }} />
        ))}
      </div>
      <p style={{ fontSize: 11, color: activeColor, margin: 0, fontWeight: 600 }}>
        {level > 0 ? T(labelKeys[level]!) : ""}
      </p>
    </div>
  );
}

/* ─── Custom location input validation ──────────────────────────────── */
function isValidLocationValue(v: string): boolean {
  const trimmed = v.trim();
  if (!trimmed) return false;
  if (/^\d+$/.test(trimmed)) return false;
  if (/^[^a-zA-Z]+$/.test(trimmed)) return false;
  return true;
}

/* ─── Suggestion item (hover state) ─────────────────────────────────── */
function SuggestionItem({ label, onSelect, active, t }: {
  label: string;
  onSelect: () => void;
  active: boolean;
  t: ReturnType<typeof useAuthTheme>;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseDown={(e) => { e.preventDefault(); onSelect(); }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: "10px 14px",
        cursor: "pointer",
        color: t.text,
        fontSize: 14,
        background: (active || hovered) ? (t.primaryLight ?? "rgba(255,255,255,0.06)") : "transparent",
        transition: "background 0.1s",
        userSelect: "none",
      }}
    >
      {label}
    </div>
  );
}

/* ─── Location autocomplete input ────────────────────────────────────── */
function LocationAutocompleteInput({
  type, city, value, onChange, onBlur, placeholder, style, checking, autoFocus, t,
}: {
  type: "city" | "area";
  city?: string;
  value: string;
  onChange: (v: string) => void;
  onBlur?: (v: string) => void;
  placeholder?: string;
  style?: React.CSSProperties;
  checking?: boolean;
  autoFocus?: boolean;
  t: ReturnType<typeof useAuthTheme>;
}) {
  const { language: _lang } = useLanguage();
  const _T = (key: TranslationKey) => tDual(key, _lang);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => { setActiveIndex(-1); }, [suggestions]);

  useEffect(() => {
    if (activeIndex < 0 || !listRef.current) return;
    const child = listRef.current.children[activeIndex] as HTMLElement | undefined;
    child?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  function fetchSuggestions(q: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.length < 2) { setSuggestions([]); setOpen(false); return; }
    debounceRef.current = setTimeout(async () => {
      setFetching(true);
      try {
        const params = new URLSearchParams({ q, type });
        if (city) params.set("city", city);
        const res = await fetch(`/api/locations/suggestions?${params}`);
        const json = await res.json() as { data?: { suggestions?: string[] } };
        const items = json?.data?.suggestions ?? [];
        setSuggestions(items);
        setOpen(true);
      } catch {
        setSuggestions([]);
      } finally {
        setFetching(false);
      }
    }, 300);
  }

  function handleChange(v: string) {
    onChange(v);
    fetchSuggestions(v);
  }

  function handleSelect(s: string) {
    onChange(s);
    setOpen(false);
    setSuggestions([]);
  }

  function handleBlur(v: string) {
    setTimeout(() => {
      setOpen(false);
      setActiveIndex(-1);
      onBlur?.(v);
    }, 150);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex(i => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex(i => Math.max(i - 1, -1));
    } else if (e.key === "Enter") {
      if (activeIndex >= 0) {
        e.preventDefault();
        handleSelect(suggestions[activeIndex]!);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
      setActiveIndex(-1);
    }
  }

  const showSpinner = checking || fetching;

  return (
    <div style={{ position: "relative" }}>
      <input
        type="text"
        placeholder={placeholder}
        style={{ ...style, paddingRight: showSpinner ? 36 : undefined }}
        className="rider-reg-input"
        value={value}
        autoFocus={autoFocus}
        autoComplete="off"
        onChange={(e) => handleChange(e.target.value)}
        onBlur={(e) => handleBlur(e.target.value)}
        onFocus={() => { if (value.length >= 2 && suggestions.length > 0) setOpen(true); }}
        onKeyDown={handleKeyDown}
      />
      {showSpinner && (
        <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", fontSize: 11, color: t.textMuted }}>⟳</span>
      )}
      {open && (
        <div ref={listRef} style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 100,
          background: t.surface ?? "var(--color-card-dark)",
          border: `1.5px solid ${t.border}`,
          borderRadius: 10,
          boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
          overflow: "hidden",
          maxHeight: 224,
          overflowY: "auto",
        }}>
          {suggestions.length > 0 ? suggestions.map((s, index) => (
            <SuggestionItem key={s} label={s} onSelect={() => handleSelect(s)} active={index === activeIndex} t={t} />
          )) : (
            <div style={{ padding: "10px 14px", color: t.textMuted, fontSize: 13, fontStyle: "italic" }}>
              {_T("regNoMatchesManual")}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── City / Area selector (reused in Step 1) ───────────────────────── */
const CUSTOM_CITY_VALUE = "__custom_city__";
const CUSTOM_AREA_VALUE = "__custom__";

function CityAreaSelector({
  data, onChange, onError, inp, lbl, hint, t,
}: {
  data: Record<string, unknown>;
  onChange: (key: string, val: unknown) => void;
  onError: (msg: string) => void;
  inp: React.CSSProperties;
  lbl: React.CSSProperties;
  hint: React.CSSProperties;
  t: ReturnType<typeof useAuthTheme>;
}) {
  const { language: _caLang } = useLanguage();
  const _CA = (key: TranslationKey) => tDual(key, _caLang);
  const [zones, setZones] = useState<{ city: string; areas: string[] }[]>([]);
  const [zonesLoaded, setZonesLoaded] = useState(false);
  const [customCityMode, setCustomCityMode] = useState(false);
  const [customAreaMode, setCustomAreaMode] = useState(false);
  const [cityInvalid, setCityInvalid] = useState(false);
  const [areaInvalid, setAreaInvalid] = useState(false);
  const [cityChecking, setCityChecking] = useState(false);
  const [areaChecking, setAreaChecking] = useState(false);

  useEffect(() => {
    api.getActiveZones("rides")
      .then((res) => { setZones(res?.zones ?? []); setZonesLoaded(true); })
      .catch(() => {
        api.getPublicZones()
          .then((res) => { setZones(res?.zones ?? []); setZonesLoaded(true); })
          .catch(() => setZonesLoaded(true));
      });
  }, []);

  const selectedCity = (data.city as string) ?? "";
  const selectedArea = (data.area as string) ?? "";
  const adminAreas = zones.find((z) => z.city === selectedCity)?.areas ?? [];
  const cities = zones.map((z) => z.city);
  const hasAdminCities = zonesLoaded && cities.length > 0;

  const dropArrow = (
    <span style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: t.textMuted, fontSize: 12 }}>▾</span>
  );
  const selectStyle: React.CSSProperties = { ...inp, paddingRight: 36, appearance: "none", WebkitAppearance: "none", cursor: "pointer" };

  async function submitCustomLocation(type: "city" | "area", value: string, city?: string) {
    if (!isValidLocationValue(value)) return null;
    try {
      const res = await fetch("/api/locations/custom", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, value, city }),
      });
      const json = await res.json() as { data?: { correctedValue?: string } };
      return json?.data?.correctedValue ?? null;
    } catch {
      return null;
    }
  }

  function handleCityDropdownChange(city: string) {
    if (city === CUSTOM_CITY_VALUE) {
      setCustomCityMode(true);
      onChange("city", "");
      onChange("area", "");
      setCustomAreaMode(false);
    } else {
      setCustomCityMode(false);
      onChange("city", city);
      onChange("area", "");
      setCustomAreaMode(false);
      onError("");
    }
  }

  function handleCityBlur(value: string) {
    if (!isValidLocationValue(value)) {
      if (value.trim()) setCityInvalid(true);
      return;
    }
    setCityInvalid(false);
    setCityChecking(true);
    void submitCustomLocation("city", value).then((corrected) => {
      setCityChecking(false);
      if (corrected) onChange("city", corrected);
    });
  }

  function handleAreaSelect(val: string) {
    if (val === CUSTOM_AREA_VALUE) { setCustomAreaMode(true); onChange("area", ""); }
    else { setCustomAreaMode(false); onChange("area", val); }
    onError("");
  }

  function handleAreaBlur(value: string) {
    if (!isValidLocationValue(value)) {
      if (value.trim()) setAreaInvalid(true);
      return;
    }
    setAreaInvalid(false);
    setAreaChecking(true);
    void submitCustomLocation("area", value, selectedCity || undefined).then((corrected) => {
      setAreaChecking(false);
      if (corrected) onChange("area", corrected);
    });
  }

  return (
    <>
      {/* City */}
      <Field>
        <label style={lbl}>{_CA("regCityStar")}</label>
        {hasAdminCities && !customCityMode ? (
          <div style={{ position: "relative" }}>
            <select value={selectedCity} onChange={(e) => handleCityDropdownChange(e.target.value)}
              className="rider-reg-input"
              style={{ ...selectStyle, color: selectedCity ? t.text : t.textMuted }}>
              <option value="" disabled style={{ color: t.textMuted }}>{_CA("regSelectYourCity")}</option>
              {cities.map((c) => (
                <option key={c} value={c} style={{ background: t.surface ?? "var(--color-card-dark)", color: t.text }}>{c}</option>
              ))}
              <option value={CUSTOM_CITY_VALUE} style={{ color: t.primary, fontStyle: "italic" }}>{_CA("regOtherEnterManually")}</option>
            </select>
            {dropArrow}
          </div>
        ) : (
          <div>
            <LocationAutocompleteInput
              type="city"
              value={selectedCity}
              onChange={(v) => { onChange("city", v); setCityInvalid(false); }}
              onBlur={handleCityBlur}
              placeholder={zonesLoaded ? _CA("regTypeCityName") : _CA("regLoadingCities")}
              style={inp}
              checking={cityChecking}
              autoFocus={customCityMode}
              t={t}
            />
            {cityInvalid && (
              <p style={{ ...hint, color: t.error, display: "flex", alignItems: "center", gap: 4 }}>
                <CrossMark /> {_CA("regEnterValidCityName")}
              </p>
            )}
            {!cityInvalid && selectedCity && (
              <p style={{ ...hint, color: t.textMuted, fontSize: 10 }}>{_CA("regSelectSuggestionOrManual")}</p>
            )}
            {customCityMode && hasAdminCities && (
              <p style={{ ...hint, color: t.textMuted }}>
                <span onClick={() => { setCustomCityMode(false); onChange("city", ""); onChange("area", ""); }}
                  style={{ color: t.primary, cursor: "pointer", textDecoration: "underline" }}>
                  {_CA("regBackToList")}
                </span>
              </p>
            )}
          </div>
        )}
      </Field>

      {/* Area */}
      <Field>
        <label style={lbl}>{_CA("regCityAreaStar")}</label>
        {selectedCity && adminAreas.length > 0 && !customAreaMode ? (
          <>
            <div style={{ position: "relative" }}>
              <select value={selectedArea || ""}
                onChange={(e) => handleAreaSelect(e.target.value)}
                className="rider-reg-input"
                style={{ ...selectStyle, color: selectedArea ? t.text : t.textMuted }}>
                <option value="" disabled style={{ color: t.textMuted }}>{_CA("regSelectAreaNeighborhood")}</option>
                {adminAreas.map((a) => (
                  <option key={a} value={a} style={{ background: t.surface ?? "var(--color-card-dark)", color: t.text }}>{a}</option>
                ))}
                <option value={CUSTOM_AREA_VALUE} style={{ color: t.primary, fontStyle: "italic" }}>{_CA("regOtherEnterManually")}</option>
              </select>
              {dropArrow}
            </div>
            <p style={{ ...hint, color: t.textMuted }}>
              {_CA("regDontSeeArea")}{" "}
              <span onClick={() => setCustomAreaMode(true)}
                style={{ color: t.primary, cursor: "pointer", textDecoration: "underline" }}>
                {_CA("regTypeManually")}
              </span>
            </p>
          </>
        ) : (
          <div>
            <LocationAutocompleteInput
              type="area"
              city={selectedCity || undefined}
              value={customAreaMode ? selectedArea : ((data.area as string) ?? "")}
              onChange={(v) => { onChange("area", v); setAreaInvalid(false); }}
              onBlur={handleAreaBlur}
              placeholder={_CA("regAreaPlaceholder")}
              style={inp}
              checking={areaChecking}
              autoFocus={customAreaMode}
              t={t}
            />
            {areaInvalid && (
              <p style={{ ...hint, color: t.error, display: "flex", alignItems: "center", gap: 4 }}>
                <CrossMark /> {_CA("regEnterValidAreaName")}
              </p>
            )}
            {!areaInvalid && customAreaMode && selectedArea && (
              <p style={{ ...hint, color: t.textMuted, fontSize: 10 }}>{_CA("regSelectSuggestionOrManual")}</p>
            )}
            {customAreaMode && (
              <p style={{ ...hint, color: t.textMuted }}>
                <span onClick={() => { setCustomAreaMode(false); onChange("area", ""); }}
                  style={{ color: t.primary, cursor: "pointer", textDecoration: "underline" }}>
                  {_CA("regBackToList")}
                </span>
              </p>
            )}
          </div>
        )}
      </Field>
    </>
  );
}

/* ─── Primary CTA button ────────────────────────────────────────────── */
function useCtaButton() {
  const { t } = useStyles();
  const [hovered, setHovered] = useState(false);
  const style: React.CSSProperties = {
    width: "100%",
    height: 52,
    borderRadius: 14,
    background: t.primary,
    color: t.onPrimary ?? "#fff",
    fontSize: 15,
    fontWeight: 700,
    border: "none",
    cursor: "pointer",
    boxShadow: hovered ? "0 4px 20px rgba(0,0,0,0.25)" : undefined,
    transition: "box-shadow 0.2s",
  };
  return { style, onMouseEnter: () => setHovered(true), onMouseLeave: () => setHovered(false) };
}

/* ════════════════════════════════════════════════════════════════════════
   STEP 1 — Personal Details
   Fields: Full Name, Phone, Email (optional), CNIC, City, Area, Full Address
   ════════════════════════════════════════════════════════════════════════ */
function PersonalStep({ data, onChange, onError }: StepComponentProps) {
  const { t, inp, lbl, hint } = useStyles();
  const { language: _psLang } = useLanguage();
  const _PS = (key: TranslationKey) => tDual(key, _psLang);
  injectStepAnimation();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, animation: "stepFadeIn 0.5s ease" }}>

      <p style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, letterSpacing: "0.10em", textTransform: "uppercase", margin: "0 0 -8px" }}>
        {_PS("regStep1of3")}
      </p>

      {/* Full Name */}
      <Field>
        <label style={lbl}>{_PS("regFullNameStar")}</label>
        <input type="text" placeholder={_PS("regEnterFullNamePlaceholder")} style={inp} className="rider-reg-input"
          value={(data.fullName as string) ?? ""}
          onChange={(e) => { onChange("fullName", e.target.value); onError(""); }} />
        {!!data.fullName && String(data.fullName).trim().length < 2 && (
          <p style={{ ...hint, color: t.error, display: "flex", alignItems: "center", gap: 4 }}>
            <CrossMark /> {_PS("regMinCharsRequired")}
          </p>
        )}
      </Field>

      {/* Phone Number */}
      <Field>
        <label style={lbl}>{_PS("regPhoneNumberStar")}</label>
        <input type="tel" inputMode="tel" placeholder={_PS("regPhonePlaceholder")} maxLength={11} style={inp} className="rider-reg-input"
          value={(data.phone as string) ?? ""}
          onChange={(e) => { onChange("phone", e.target.value.replace(/\D/g, "").slice(0, 11)); onError(""); }} />
        {!!data.phone && !isValidPhone(String(data.phone)) && (
          <p style={{ ...hint, color: t.error, display: "flex", alignItems: "center", gap: 4 }}>
            <CrossMark /> {_PS("regValidPakistaniPhone")}
          </p>
        )}
        {!!data.phone && isValidPhone(String(data.phone)) && (
          <p style={{ ...hint, color: t.primary, display: "flex", alignItems: "center", gap: 4 }}>
            <CheckMark /> {_PS("regPhoneValid")}
          </p>
        )}
      </Field>

      {/* Email (optional) */}
      <Field>
        <label style={lbl}>
          {_PS("regEmailLabel")}{" "}
          <span style={{ fontWeight: 400, color: t.textMuted, textTransform: "none" }}>{_PS("regEmailOptional")}</span>
        </label>
        <input type="email" inputMode="email" placeholder={_PS("regEmailPlaceholder")} style={inp} className="rider-reg-input"
          value={(data.email as string) ?? ""}
          onChange={(e) => { onChange("email", e.target.value.trim()); onError(""); }} />
        {!!data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(data.email)) && (
          <p style={{ ...hint, color: t.error, display: "flex", alignItems: "center", gap: 4 }}>
            <CrossMark /> {_PS("enterValidEmail")}
          </p>
        )}
      </Field>

      {/* CNIC */}
      <Field>
        <label style={lbl}>{_PS("regCnicNumberStar")}</label>
        <input type="text" inputMode="numeric" placeholder="XXXXX-XXXXXXX-X" maxLength={15} style={inp} className="rider-reg-input"
          value={(data.cnic as string) ?? ""}
          onChange={(e) => { onChange("cnic", fmtCnic(e.target.value)); onError(""); }} />
        {!!data.cnic && !isValidCnic(String(data.cnic)) && (
          <p style={{ ...hint, color: t.error, display: "flex", alignItems: "center", gap: 4 }}>
            <CrossMark /> {_PS("regCnicFormatMustBe")}
          </p>
        )}
        {!!data.cnic && isValidCnic(String(data.cnic)) && (
          <p style={{ ...hint, color: t.primary, display: "flex", alignItems: "center", gap: 4 }}>
            <CheckMark /> {_PS("regCnicValid")}
          </p>
        )}
      </Field>

      {/* City + Area (dropdown + text fallback) */}
      <CityAreaSelector data={data} onChange={onChange} onError={onError} inp={inp} lbl={lbl} hint={hint} t={t} />

      {/* Full Address */}
      <Field>
        <label style={lbl}>{_PS("regFullAddressStar")}</label>
        <input type="text" placeholder={_PS("regStreetBlockLandmark")} style={inp} className="rider-reg-input"
          value={(data.address as string) ?? ""}
          onChange={(e) => { onChange("address", e.target.value); onError(""); }} />
        <p style={{ ...hint, color: t.textMuted }}>{_PS("regAddressExample")}</p>
      </Field>

    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   STEP 2 — Vehicle Information
   ════════════════════════════════════════════════════════════════════════ */
const VEHICLE_TYPES: { value: string; labelKey: TranslationKey }[] = [
  { value: "bike", labelKey: "vehicleTypeBike" },
  { value: "car", labelKey: "vehicleTypeCar" },
  { value: "rickshaw", labelKey: "vehicleTypeRickshaw" },
  { value: "van", labelKey: "vehicleTypeVan" },
];

function VehicleStep({ data, onChange, onError }: StepComponentProps) {
  const { t, inp, lbl } = useStyles();
  const { language: _vsLang } = useLanguage();
  const _VS = (key: TranslationKey) => tDual(key, _vsLang);
  injectStepAnimation();
  const selectStyle: React.CSSProperties = {
    ...inp, paddingRight: 36, appearance: "none", WebkitAppearance: "none",
    cursor: "pointer", color: data.vehicleType ? t.text : t.textMuted,
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, animation: "stepFadeIn 0.5s ease" }}>

      <p style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, letterSpacing: "0.10em", textTransform: "uppercase", margin: "0 0 -8px" }}>
        {_VS("regStep2of3")}
      </p>

      {/* Vehicle Type */}
      <Field>
        <label style={lbl}>{_VS("regVehicleTypeStar")}</label>
        <div style={{ position: "relative" }}>
          <select value={(data.vehicleType as string) ?? ""}
            onChange={(e) => { onChange("vehicleType", e.target.value); onError(""); }}
            style={selectStyle} className="rider-reg-input">
            <option value="" disabled style={{ color: t.textMuted }}>{_VS("regSelectVehicleType")}</option>
            {VEHICLE_TYPES.map((o) => (
              <option key={o.value} value={o.value}
                style={{ background: t.surface ?? "var(--color-card-dark)", color: t.text }}>
                {_VS(o.labelKey)}
              </option>
            ))}
          </select>
          <span style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: t.textMuted, fontSize: 12 }}>▾</span>
        </div>
      </Field>

      {/* Plate Number */}
      <Field>
        <label style={lbl}>{_VS("regPlateNumberStar")}</label>
        <input type="text" placeholder={_VS("regPlateNumberPlaceholder")} style={inp} className="rider-reg-input"
          value={(data.plateNumber as string) ?? ""}
          onChange={(e) => { onChange("plateNumber", e.target.value.toUpperCase()); onError(""); }} />
      </Field>

      {/* License Number */}
      <Field>
        <label style={lbl}>{_VS("regDrivingLicenseStar")}</label>
        <input type="text" placeholder={_VS("regDrivingLicensePlaceholder")} style={inp} className="rider-reg-input"
          value={(data.licenseNumber as string) ?? ""}
          onChange={(e) => { onChange("licenseNumber", e.target.value); onError(""); }} />
      </Field>

    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   STEP 3 — Password & Terms
   Validation enforces: 8+ chars, 1 uppercase, 1 number, 1 symbol
   ════════════════════════════════════════════════════════════════════════ */
function PasswordStep({ data, onChange, onError }: StepComponentProps) {
  const { t, inp, lbl, hint } = useStyles();
  const { language: _pwLang } = useLanguage();
  const _PW = (key: TranslationKey) => tDual(key, _pwLang);
  injectStepAnimation();
  const password = (data.password as string) ?? "";
  const username = (data.username as string) ?? "";

  function isValidUsername(u: string) {
    return /^[a-zA-Z0-9_]{3,20}$/.test(u);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, animation: "stepFadeIn 0.5s ease" }}>

      <p style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, letterSpacing: "0.10em", textTransform: "uppercase", margin: "0 0 -8px" }}>
        {_PW("regStep3of3")}
      </p>

      <p style={{ color: t.textMuted, fontSize: 13, margin: 0 }}>
        {_PW("regCreatePasswordNote")}
      </p>

      {/* Username (optional) */}
      <Field>
        <label style={lbl}>
          {_PW("regUsernameOptional")}{" "}
          <span style={{ fontWeight: 400, color: t.textMuted, textTransform: "none" }}>{_PW("regEmailOptional")}</span>
        </label>
        <input
          type="text"
          placeholder={_PW("regUsernamePlaceholder")}
          style={inp}
          className="rider-reg-input"
          value={username}
          autoComplete="username"
          onChange={(e) => { onChange("username", e.target.value.trim()); onError(""); }}
        />
        {username && !isValidUsername(username) && (
          <p style={{ ...hint, color: t.error, display: "flex", alignItems: "center", gap: 4 }}>
            <CrossMark /> {_PW("regUsernameInvalidChars")}
          </p>
        )}
        {username && isValidUsername(username) && (
          <p style={{ ...hint, color: t.primary, display: "flex", alignItems: "center", gap: 4 }}>
            <CheckMark /> {_PW("regUsernameValid")}
          </p>
        )}
      </Field>

      {/* Password */}
      <Field>
        <label style={lbl}>{_PW("regPasswordStar")}</label>
        <input type="password" autoComplete="new-password" placeholder={_PW("regPasswordMinHint")}
          style={inp} className="rider-reg-input" value={password}
          onChange={(e) => { onChange("password", e.target.value); onError(""); }} />
        <PasswordStrengthBar password={password} />
        {password && (
          <ul style={{ listStyle: "none", padding: 0, margin: "4px 0 0", display: "flex", flexDirection: "column", gap: 3 }}>
            {[
              [password.length >= 8, _PW("regAtLeast8Chars")],
              [/[A-Z]/.test(password), _PW("regOneUppercase")],
              [/[0-9]/.test(password), _PW("regOneNumber")],
              [/[^A-Za-z0-9]/.test(password), _PW("regOneSymbol")],
            ].map(([ok, label]) => (
              <li key={label as string} style={{ fontSize: 11, display: "flex", alignItems: "center", gap: 5, color: ok ? t.primary : t.textMuted }}>
                {ok ? <CheckMark /> : <CrossMark />} {label as string}
              </li>
            ))}
          </ul>
        )}
      </Field>

      {/* Confirm Password */}
      <Field>
        <label style={lbl}>{_PW("regConfirmPasswordStar")}</label>
        <input type="password" autoComplete="new-password" placeholder={_PW("regRepeatPassword")}
          style={inp} className="rider-reg-input" value={(data.confirmPassword as string) ?? ""}
          onChange={(e) => { onChange("confirmPassword", e.target.value); onError(""); }} />
        {!!data.password && !!data.confirmPassword && data.password !== data.confirmPassword && (
          <p style={{ fontSize: 11, color: t.error, margin: 0, display: "flex", alignItems: "center", gap: 4 }}>
            <CrossMark /> {_PW("regPasswordsDoNotMatch")}
          </p>
        )}
      </Field>

      {/* Terms */}
      <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }}>
        <input type="checkbox" checked={!!data.terms}
          onChange={(e) => onChange("terms", e.target.checked)}
          style={{ marginTop: 2 }} />
        <span style={{ color: t.textMuted, fontSize: 13 }}>
          {_PW("regIAgree")}{" "}
          <a href="/terms" target="_blank" rel="noopener noreferrer"
            style={{ color: t.primary, textDecoration: "underline" }}
            onClick={(e) => e.stopPropagation()}>
            {_PW("regTermsAndConditions")}
          </a>
        </span>
      </label>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   STEP 4 — Document Photos (Optional / Skippable)
   Uploads: CNIC front, CNIC back, Driving License photo
   Marked optional — rider can upload later from Profile / KYC page.
   ════════════════════════════════════════════════════════════════════════ */
function DocumentUploadStep({ data, onChange }: StepComponentProps) {
  const { t, lbl, hint } = useStyles();
  const { language: _duLang } = useLanguage();
  const _DU = (key: TranslationKey) => tDual(key, _duLang);
  injectStepAnimation();

  function handleFileChange(key: string, file: File | null) {
    onChange(key, file ?? undefined);
  }

  function FileField({
    fieldKey, label, accept = "image/*",
  }: { fieldKey: string; label: string; accept?: string }) {
    const file = data[fieldKey] as File | undefined;
    return (
      <Field>
        <label style={lbl}>{label}</label>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <label style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: 48,
            borderRadius: 12,
            border: `1.5px dashed ${file ? t.primary : t.border}`,
            background: file ? (t.primaryLight ?? "rgba(240,185,11,0.08)") : t.background,
            color: file ? t.primary : t.textMuted,
            fontSize: 13,
            cursor: "pointer",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            padding: "0 14px",
          }}>
            {file ? `✓ ${file.name}` : _DU("regTapChoosePhoto")}
            <input
              type="file"
              accept={accept}
              style={{ display: "none" }}
              onChange={(e) => handleFileChange(fieldKey, e.target.files?.[0] ?? null)}
            />
          </label>
          {file && (
            <button
              type="button"
              onClick={() => handleFileChange(fieldKey, null)}
              style={{
                flexShrink: 0,
                background: "transparent",
                border: `1px solid ${t.border}`,
                borderRadius: 8,
                color: t.textMuted,
                fontSize: 12,
                padding: "6px 10px",
                cursor: "pointer",
              }}
            >
              {_DU("regRemovePhoto")}
            </button>
          )}
        </div>
        <p style={{ ...hint, color: t.textMuted }}>{_DU("regJpegPngMax5mb")}</p>
      </Field>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, animation: "stepFadeIn 0.5s ease" }}>
      <div style={{
        padding: "12px 16px",
        borderRadius: 12,
        background: "rgba(240,185,11,0.08)",
        border: "1px solid rgba(240,185,11,0.25)",
      }}>
        <p style={{ margin: 0, fontSize: 13, color: t.textMuted, lineHeight: 1.5 }}>
          📎 <strong style={{ color: t.text }}>{_DU("regOptionalStep")}</strong>{" "}
          {_DU("regDocUploadNote")}
        </p>
      </div>

      <FileField fieldKey="cnicFrontPhoto" label={_DU("regCnicFrontPhoto")} />
      <FileField fieldKey="cnicBackPhoto" label={_DU("regCnicBackPhoto")} />
      <FileField fieldKey="licensePhoto" label={_DU("regDrivingLicensePhoto")} />
    </div>
  );
}

/* ─── Step config (3 steps + optional document upload) ─────────────── */
export function getRiderSteps(
  _config: { phoneEnabled: boolean; emailEnabled: boolean },
  language = "en"
): StepConfig[] {
  const T_ = (key: TranslationKey) => tDual(key, language as Parameters<typeof tDual>[1]);
  return [
    {
      id: "personal",
      title: T_("regStepPersonalTitle"),
      subtitle: T_("regStepPersonalSubtitle"),
      component: PersonalStep,
      validate: (d) => {
        const name = String(d.fullName ?? "").trim();
        if (!name || name.length < 2) return T_("regValidFullName");
        const phone = String(d.phone ?? "");
        if (!phone) return T_("regPhoneRequired");
        if (!isValidPhone(phone)) return T_("regValidPakistaniPhoneFull");
        if (d.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(d.email)))
          return T_("regValidEmailOrBlank");
        if (!d.cnic) return T_("regCnicRequired");
        if (!isValidCnic(String(d.cnic))) return T_("regValidCnicFull");
        if (!d.city) return T_("regCityRequired");
        if (!d.area) return T_("regAreaRequired");
        if (!String(d.address ?? "").trim()) return T_("regAddressRequired");
        return null;
      },
    },
    {
      id: "vehicle",
      title: T_("regStepVehicleTitle"),
      subtitle: T_("regStepVehicleSubtitle"),
      component: VehicleStep,
      validate: (d) =>
        !d.vehicleType ? T_("regVehicleTypeRequired") :
        !d.plateNumber ? T_("regPlateRequired") :
        !d.licenseNumber ? T_("regLicenseRequired") : null,
    },
    {
      id: "password",
      title: T_("regStepPasswordTitle"),
      subtitle: T_("regStepPasswordSubtitle"),
      component: PasswordStep,
      validate: (d) => {
        const username = String(d.username ?? "").trim();
        if (username && !/^[a-zA-Z0-9_]{3,20}$/.test(username))
          return T_("regUsernameInvalidFull");
        const pw = String(d.password ?? "");
        if (!pw) return T_("regPasswordRequired");
        if (pw.length < 8) return T_("regPasswordMinLength");
        if (!/[A-Z]/.test(pw)) return T_("regPasswordNeedsUppercase");
        if (!/[0-9]/.test(pw)) return T_("regPasswordNeedsNumber");
        if (!/[^A-Za-z0-9]/.test(pw)) return T_("regPasswordNeedsSymbol");
        if (pw !== String(d.confirmPassword ?? "")) return T_("regPasswordsDoNotMatch");
        if (!d.terms) return T_("regAcceptTerms");
        return null;
      },
    },
    {
      id: "documents",
      title: T_("regStepDocumentsTitle"),
      subtitle: T_("regStepDocumentsSubtitle"),
      component: DocumentUploadStep,
      validate: () => null,
    },
  ];
}
