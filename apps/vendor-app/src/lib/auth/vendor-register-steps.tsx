/**
 * vendor-register-steps.tsx — vendor-app
 *
 * Step components and config for vendor RegisterWizard.
 * No auth logic — pure form UI and step configuration.
 * OTP sending is delegated to RegisterScreen via onOtpRequest.
 */
import type { StepConfig, StepComponentProps } from "@workspace/auth-react";
import { useAuthTheme } from "@workspace/auth-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { isValidCnic, isValidPhone } from "@workspace/phone-utils";
import { api } from "../api";

/* ─── Draft helpers ────────────────────────────────────────────────── */
export const DRAFT_KEY = "vendor_reg_draft";
export const DRAFT_TTL_KEY = "vendor_reg_draft_ts";
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

export async function fileToDataUrl(file: unknown): Promise<string | undefined> {
  if (!(file instanceof File)) return undefined;
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/* ─── OTP module-level state shared between wizard and step component ─ */
let _otpResender: ((phone: string) => Promise<{ success: boolean; error?: string }>) | null = null;
let _otpWasSent = false;

export function registerOtpResender(
  fn: (phone: string) => Promise<{ success: boolean; error?: string }>
) {
  _otpResender = fn;
}

export function markOtpSent() {
  _otpWasSent = true;
}

export function resetOtpSentState() {
  _otpWasSent = false;
}

/* ─── stepFadeIn animation ─────────────────────────────────────────── */
const STEP_FADE_IN_STYLE = `
@keyframes stepFadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
`;

function injectStepAnimation() {
  if (typeof document === "undefined") return;
  const id = "vendor-step-fade-in";
  if (!document.getElementById(id)) {
    const s = document.createElement("style");
    s.id = id;
    s.textContent = STEP_FADE_IN_STYLE;
    document.head.appendChild(s);
  }
}

/* ─── Shared input/label styles ────────────────────────────────────── */
function useStyles() {
  const t = useAuthTheme();
  return {
    t,
    inp: {
      width: "100%",
      height: 48,
      padding: "0 14px",
      borderRadius: 12,
      background: t.background,
      border: `1.5px solid ${t.border}`,
      color: t.text,
      fontSize: 14,
      outline: "none",
      boxSizing: "border-box",
    } as React.CSSProperties,
    lbl: {
      fontSize: 11,
      fontWeight: 700,
      color: t.primary,
      textTransform: "uppercase",
      letterSpacing: "0.07em",
      display: "block",
    } as React.CSSProperties,
  };
}

/* ─── Field wrapper ─────────────────────────────────────────────────── */
function Field({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {children}
    </div>
  );
}

/* ─── useCustomLocationInput hook ──────────────────────────────────── */
function isValidLocationValue(v: string): boolean {
  const trimmed = v.trim();
  if (!trimmed) return false;
  if (/^\d+$/.test(trimmed)) return false;
  if (/^[^a-zA-Z]+$/.test(trimmed)) return false;
  return true;
}

async function submitCustomLocation(
  type: "city" | "area",
  value: string,
  city?: string
): Promise<string | null> {
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

function useCustomLocationInput(
  type: "city" | "area",
  city: string | undefined,
  onChange: (val: string) => void,
  onError: (msg: string) => void
) {
  const [checking, setChecking] = useState(false);
  const [fieldError, setFieldError] = useState("");

  const handleInput = useCallback(
    (value: string) => {
      onChange(value);
      setFieldError("");
    },
    [onChange]
  );

  const handleBlur = useCallback(
    (value: string) => {
      if (!isValidLocationValue(value)) {
        if (value.trim()) {
          const msg = "Enter a valid name (letters required)";
          setFieldError(msg);
          onError(msg);
        }
        return;
      }
      setChecking(true);
      void submitCustomLocation(type, value, city).then((corrected) => {
        setChecking(false);
        if (corrected) onChange(corrected);
      });
    },
    [type, city, onChange, onError]
  );

  return { checking, fieldError, handleInput, handleBlur };
}

/* ─── Suggestion item (hover state) ────────────────────────────────── */
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

/* ─── Location autocomplete input ───────────────────────────────────── */
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

  function handleBlurInternal(v: string) {
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
        handleSelect(suggestions[activeIndex]);
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
        value={value}
        autoFocus={autoFocus}
        autoComplete="off"
        onChange={(e) => handleChange(e.target.value)}
        onBlur={(e) => handleBlurInternal(e.target.value)}
        onFocus={() => { if (value.length >= 2 && suggestions.length > 0) setOpen(true); }}
        onKeyDown={handleKeyDown}
      />
      {showSpinner && (
        <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", fontSize: 11, color: t.textMuted }}>⟳</span>
      )}
      {open && (
        <div ref={listRef} style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 100,
          background: t.surface ?? "#0F1827",
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
              No matches — enter manually
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── StyledSelect ─────────────────────────────────────────────────── */
function StyledSelect({
  label, value, onChange, options, placeholder, required, disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
}) {
  const { t, inp, lbl } = useStyles();
  return (
    <Field>
      <label style={lbl}>{label}{required && " *"}</label>
      <div style={{ position: "relative" }}>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          style={{
            ...inp,
            paddingRight: 36,
            appearance: "none",
            WebkitAppearance: "none",
            cursor: disabled ? "not-allowed" : "pointer",
            color: value ? t.text : t.textMuted,
            opacity: disabled ? 0.5 : 1,
          }}
        >
          {placeholder && <option value="" disabled style={{ color: t.textMuted }}>{placeholder}</option>}
          {options.map((o) => (
            <option key={o.value} value={o.value} style={{ background: t.surface ?? "#0F1827", color: t.text }}>
              {o.label}
            </option>
          ))}
        </select>
        <span style={{
          position: "absolute",
          right: 14,
          top: "50%",
          transform: "translateY(-50%)",
          pointerEvents: "none",
          color: t.textMuted,
          fontSize: 12,
        }}>▾</span>
      </div>
    </Field>
  );
}

/* ─── Step config ──────────────────────────────────────────────────── */
const STORE_CATS = [
  "Grocery", "Restaurant", "Bakery", "Pharmacy", "Electronics", "Clothing",
  "General Store", "Fast Food", "Fruits & Vegetables", "Dairy", "Meat & Poultry", "Other",
];

/* ─── Zones cache — shared between steps ───────────────────────────── */
type ZonesData = { cities: string[]; zones: { city: string; areas: string[] }[] };
let _zonesCache: ZonesData | null = null;
let _zonesFetching = false;
const _zonesListeners: Array<(d: ZonesData) => void> = [];

async function fetchZonesOnce(): Promise<ZonesData | null> {
  if (_zonesCache) return _zonesCache;
  if (_zonesFetching) {
    return new Promise<ZonesData | null>((resolve) => {
      _zonesListeners.push((d) => resolve(d));
    });
  }
  _zonesFetching = true;
  try {
    const data = await api.getActiveZones("orders");
    _zonesCache = data;
    _zonesListeners.forEach((fn) => fn(data));
    _zonesListeners.length = 0;
  } catch {
    _zonesCache = { cities: [], zones: [] };
  }
  _zonesFetching = false;
  return _zonesCache;
}

function usePublicZones() {
  const [zones, setZones] = useState<ZonesData | null>(_zonesCache);
  useEffect(() => {
    let cancelled = false;
    fetchZonesOnce().then((d) => { if (!cancelled) setZones(d); });
    return () => { cancelled = true; };
  }, []);
  return zones;
}

/* ─── Primary CTA button ─────────────────────────────────────────── */
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

/* ─── StoreInfoStep (step 1) — dynamic city from admin zones ────────── */
function StoreInfoStep({ data, onChange, onError }: StepComponentProps) {
  const { t, inp, lbl } = useStyles();
  injectStepAnimation();
  const zones = usePublicZones();

  const cityOptions = zones
    ? zones.cities.map((c) => ({ value: c, label: c }))
    : [];

  const CUSTOM_CITY_VALUE = "__custom_city__";
  const [customCityMode, setCustomCityMode] = useState(false);
  const selectedCity = (data.city as string) ?? "";

  const cityHook = useCustomLocationInput(
    "city",
    undefined,
    (val) => { onChange("city", val); },
    onError
  );

  function handleCityDropdownChange(v: string) {
    if (v === CUSTOM_CITY_VALUE) {
      setCustomCityMode(true);
      onChange("city", "");
      onChange("area", "");
    } else {
      onChange("city", v);
      onChange("area", "");
      onError("");
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, animation: "stepFadeIn 0.5s ease" }}>
      <Field>
        <label style={lbl}>Store Name *</label>
        <input
          type="text"
          placeholder="Ali's Grocery"
          style={inp}
          value={(data.storeName as string) ?? ""}
          onChange={(e) => { onChange("storeName", e.target.value); onError(""); }}
        />
      </Field>
      <StyledSelect
        label="Category"
        required
        value={(data.storeCategory as string) ?? ""}
        onChange={(v) => { onChange("storeCategory", v); onError(""); }}
        options={STORE_CATS.map((c) => ({ value: c, label: c }))}
        placeholder="Select a category"
      />
      <Field>
        <label style={lbl}>Owner Name *</label>
        <input
          type="text"
          placeholder="Full name"
          style={inp}
          value={(data.ownerName as string) ?? ""}
          onChange={(e) => { onChange("ownerName", e.target.value); onError(""); }}
        />
      </Field>

      {/* City — dropdown with "Other" option */}
      <Field>
        <label style={lbl}>City *</label>
        {zones && cityOptions.length > 0 && !customCityMode ? (
          <div style={{ position: "relative" }}>
            <select
              value={selectedCity}
              onChange={(e) => handleCityDropdownChange(e.target.value)}
              style={{
                ...inp,
                paddingRight: 36,
                appearance: "none",
                WebkitAppearance: "none",
                cursor: "pointer",
                color: selectedCity ? t.text : t.textMuted,
              }}
            >
              <option value="" disabled style={{ color: t.textMuted }}>
                {zones ? "Select your city" : "Loading cities…"}
              </option>
              {cityOptions.map((o) => (
                <option key={o.value} value={o.value} style={{ background: t.surface ?? "#0F1827", color: t.text }}>
                  {o.label}
                </option>
              ))}
              <option value={CUSTOM_CITY_VALUE} style={{ color: t.primary, fontStyle: "italic" }}>
                ✏ Other / Enter manually
              </option>
            </select>
            <span style={{
              position: "absolute", right: 14, top: "50%",
              transform: "translateY(-50%)", pointerEvents: "none",
              color: t.textMuted, fontSize: 12,
            }}>▾</span>
          </div>
        ) : (
          <div>
            <LocationAutocompleteInput
              type="city"
              value={selectedCity}
              onChange={(v) => cityHook.handleInput(v)}
              onBlur={cityHook.handleBlur}
              placeholder={zones ? "Type your city name…" : "Loading cities…"}
              style={inp}
              checking={cityHook.checking}
              autoFocus={customCityMode}
              t={t}
            />
            {cityHook.fieldError && (
              <p style={{ fontSize: 11, color: t.error, margin: "4px 0 0" }}>{cityHook.fieldError}</p>
            )}
            {!cityHook.fieldError && selectedCity && (
              <p style={{ fontSize: 10, color: t.textMuted, margin: "4px 0 0" }}>Select a suggestion or enter manually.</p>
            )}
            {customCityMode && cityOptions.length > 0 && (
              <button type="button" onClick={() => { setCustomCityMode(false); onChange("city", ""); onChange("area", ""); }}
                style={{ background: "none", border: "none", padding: "4px 0 0", color: t.primary, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                ← Back to list
              </button>
            )}
          </div>
        )}
        {zones && cityOptions.length === 0 && !customCityMode && (
          <p style={{ color: t.textMuted, fontSize: 12, margin: "4px 0 0" }}>
            No cities configured yet — type your city above.
          </p>
        )}
      </Field>

      <Field>
        <label style={lbl}>Address</label>
        <input
          type="text"
          placeholder="Street address"
          style={inp}
          value={(data.address as string) ?? ""}
          onChange={(e) => { onChange("address", e.target.value); onError(""); }}
        />
      </Field>
    </div>
  );
}

/* ─── BankDetailsStep (step 3) — optional with "Skip for now" ──────── */
function BankDetailsStep({ data, onChange, onNext }: StepComponentProps) {
  const { t, inp, lbl } = useStyles();
  injectStepAnimation();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, animation: "stepFadeIn 0.5s ease" }}>
      <p style={{ color: t.textMuted, fontSize: 13, margin: 0 }}>
        Add bank details to receive payments directly. You can also add these later from your dashboard.
      </p>
      <Field>
        <label style={lbl}>Bank Name</label>
        <input
          type="text"
          placeholder="e.g. HBL"
          style={inp}
          value={(data.bankName as string) ?? ""}
          onChange={(e) => onChange("bankName", e.target.value)}
        />
      </Field>
      <Field>
        <label style={lbl}>Account Title</label>
        <input
          type="text"
          placeholder="Account holder name"
          style={inp}
          value={(data.bankAccountTitle as string) ?? ""}
          onChange={(e) => onChange("bankAccountTitle", e.target.value)}
        />
      </Field>
      <Field>
        <label style={lbl}>Account Number / IBAN</label>
        <input
          type="text"
          placeholder="PK00XXXX0000000000000000"
          style={inp}
          value={(data.bankAccount as string) ?? ""}
          onChange={(e) => onChange("bankAccount", e.target.value)}
        />
      </Field>
      <button
        type="button"
        onClick={onNext}
        style={{
          background: "none",
          border: `1.5px solid ${t.border}`,
          borderRadius: 12,
          color: t.textMuted,
          fontSize: 14,
          fontWeight: 600,
          padding: "11px 0",
          cursor: "pointer",
          width: "100%",
          marginTop: 4,
        }}
      >
        Skip for now →
      </button>
    </div>
  );
}

export const vendorSteps: StepConfig[] = [
  {
    id: "store-info",
    title: "Store Information",
    subtitle: "Tell us about your business",
    component: StoreInfoStep,
    validate: (d) =>
      !d.storeName ? "Store name is required" :
      !d.storeCategory ? "Category is required" :
      !d.ownerName ? "Owner name is required" :
      !d.city ? "City is required" : null,
  },
  {
    id: "documents",
    title: "Contact & Documents",
    component: DocumentsStep,
    validate: (d) =>
      !d.phone ? "Phone number is required" :
      !isValidPhone(String(d.phone)) ? "Enter a valid Pakistani phone number (03XXXXXXXXX)" :
      !d.cnic ? "CNIC number is required" :
      !isValidCnic(String(d.cnic)) ? "Enter a valid CNIC (XXXXX-XXXXXXX-X)" :
      !d.area ? "Area / neighborhood is required" : null,
  },
  {
    id: "bank",
    title: "Bank Details",
    subtitle: "For receiving payments (optional)",
    component: BankDetailsStep,
  },
  {
    id: "password",
    title: "Set Password",
    subtitle: "Create a password to protect your account",
    component: PasswordOnlyStep,
    validate: (d) =>
      !d.password ? "Password is required" :
      String(d.password).length < 8 ? "Password must be at least 8 characters" :
      d.password !== d.confirmPassword ? "Passwords do not match" :
      !d.terms ? "Please accept the Terms & Conditions" : null,
  },
];

/* ─── PasswordOnlyStep — shown when OTP is disabled but password is required ─ */
function PasswordOnlyStep({ data, onChange, onError }: StepComponentProps) {
  const { t, inp, lbl } = useStyles();
  injectStepAnimation();
  const password = (data.password as string) ?? "";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, animation: "stepFadeIn 0.5s ease" }}>
      <p style={{ color: t.textMuted, fontSize: 13, margin: 0 }}>
        Create a password to protect your account. Phone verification can be done later from your profile.
      </p>
      <Field>
        <label style={lbl}>Password *</label>
        <input
          type="password"
          autoComplete="new-password"
          placeholder="Min 8 characters"
          style={inp}
          value={password}
          onChange={(e) => { onChange("password", e.target.value); onError(""); }}
        />
        <PasswordStrengthBar password={password} />
      </Field>
      <Field>
        <label style={lbl}>Confirm Password *</label>
        <input
          type="password"
          autoComplete="new-password"
          placeholder="Repeat password"
          style={inp}
          value={(data.confirmPassword as string) ?? ""}
          onChange={(e) => { onChange("confirmPassword", e.target.value); onError(""); }}
        />
        {!!data.password && !!data.confirmPassword && data.password !== data.confirmPassword &&
          <p style={{ color: t.error, fontSize: 11, margin: 0, display: "flex", alignItems: "center", gap: 4 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            Passwords do not match
          </p>}
      </Field>
      <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }}>
        <input
          type="checkbox"
          checked={!!data.terms}
          onChange={(e) => onChange("terms", e.target.checked)}
          style={{ marginTop: 2 }}
        />
        <span style={{ color: t.textMuted, fontSize: 13 }}>
          I agree to the{" "}
          <a
            href="/terms"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: t.primary, textDecoration: "underline" }}
            onClick={(e) => e.stopPropagation()}
          >
            Terms &amp; Conditions
          </a>
        </span>
      </label>
    </div>
  );
}

/* ─── Password strength helper ─────────────────────────────────────── */
function getPasswordStrength(pw: string): { level: 0 | 1 | 2 | 3; label: string } {
  if (!pw) return { level: 0, label: "" };
  const hasUpper = /[A-Z]/.test(pw);
  const hasLower = /[a-z]/.test(pw);
  const hasNumber = /[0-9]/.test(pw);
  const hasSymbol = /[^A-Za-z0-9]/.test(pw);
  if (pw.length >= 10 && (hasUpper || hasLower) && hasNumber && hasSymbol) return { level: 3, label: "Strong" };
  if (pw.length >= 8 && ((hasUpper && hasLower) || hasNumber)) return { level: 2, label: "Fair" };
  return { level: 1, label: "Weak" };
}

function PasswordStrengthBar({ password }: { password: string }) {
  const { t } = useStyles();
  const { level, label } = getPasswordStrength(password);
  if (!password) return null;
  const colors = [t.error ?? "#EF4444", t.warning ?? "#F59E0B", t.success ?? "#22C55E"];
  const activeColor = colors[level - 1] ?? colors[0];
  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ display: "flex", gap: 4, marginBottom: 4 }}>
        {[1, 2, 3].map((bar) => (
          <div
            key={bar}
            style={{
              flex: 1,
              height: 4,
              borderRadius: 2,
              background: bar <= level ? activeColor : t.border,
              transition: "background 0.2s",
            }}
          />
        ))}
      </div>
      <p style={{ fontSize: 11, color: activeColor, margin: 0, fontWeight: 600 }}>{label}</p>
    </div>
  );
}

/* ─── OtpPasswordStep — pure form UI, no auth logic ──────────── */
function OtpPasswordStep({ data, onChange, onError }: StepComponentProps) {
  const { t, inp, lbl } = useStyles();
  const [countdown, setCountdown] = useState(0);
  const [resending, setResending] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startCountdown = () => {
    setCountdown(60);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) { clearInterval(timerRef.current!); return 0; }
        return c - 1;
      });
    }, 1000);
  };

  useEffect(() => {
    if (_otpWasSent) {
      onChange("otpSent", true);
      startCountdown();
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const handleResend = async () => {
    if (!_otpResender || countdown > 0 || resending) return;
    setResending(true);
    try {
      const phone = (data.phone as string) ?? "";
      const result = await _otpResender(phone);
      if (result.success) {
        onChange("otpSent", true);
        startCountdown();
      }
    } finally {
      setResending(false);
    }
  };

  const password = (data.password as string) ?? "";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {!!data.otpSent && (
        <p style={{ color: t.primary, fontSize: 13, margin: 0, display: "flex", alignItems: "center", gap: 6 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
          OTP sent to {(data.phone as string) ?? "your phone"}. Enter the code below.
        </p>
      )}
      <Field>
        <label style={lbl}>OTP Code *</label>
        <input
          type="text"
          inputMode="numeric"
          maxLength={6}
          placeholder="______"
          style={{ ...inp, letterSpacing: "0.3em", textAlign: "center", fontSize: 20 }}
          value={(data.otp as string) ?? ""}
          onChange={(e) => { onChange("otp", e.target.value.replace(/\D/g, "").slice(0, 6)); onError(""); }}
        />
        <div style={{ textAlign: "right" }}>
          <button
            type="button"
            disabled={countdown > 0 || resending}
            onClick={handleResend}
            style={{
              background: "none", border: "none", cursor: countdown > 0 || resending ? "default" : "pointer",
              color: countdown > 0 || resending ? t.textMuted : t.primary,
              fontSize: 13, fontWeight: 600, padding: 0,
            }}
          >
            {resending ? "Sending…" : countdown > 0 ? `Resend in ${countdown}s` : "Resend OTP"}
          </button>
        </div>
      </Field>
      <Field>
        <label style={lbl}>Password *</label>
        <input
          type="password"
          autoComplete="new-password"
          placeholder="Min 8 characters"
          style={inp}
          value={password}
          onChange={(e) => { onChange("password", e.target.value); onError(""); }}
        />
        <PasswordStrengthBar password={password} />
      </Field>
      <Field>
        <label style={lbl}>Confirm Password *</label>
        <input
          type="password"
          autoComplete="new-password"
          placeholder="Repeat password"
          style={inp}
          value={(data.confirmPassword as string) ?? ""}
          onChange={(e) => { onChange("confirmPassword", e.target.value); onError(""); }}
        />
      </Field>
      <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }}>
        <input
          type="checkbox"
          checked={!!data.terms}
          onChange={(e) => onChange("terms", e.target.checked)}
          style={{ marginTop: 2 }}
        />
        <span style={{ color: t.textMuted, fontSize: 13 }}>
          I agree to the{" "}
          <a
            href="/terms"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: t.primary, textDecoration: "underline" }}
            onClick={(e) => e.stopPropagation()}
          >
            Terms &amp; Conditions
          </a>
        </span>
      </label>
    </div>
  );
}

/* ─── FileField helper ─────────────────────────────────────────────── */
function FileField({ label, fieldId, value, onChange }: {
  label: string; fieldId: string; value: File | null; onChange: (f: File | null) => void;
}) {
  const { t } = useStyles();
  const ref = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label style={{
        fontSize: 11, fontWeight: 700, color: t.primary,
        textTransform: "uppercase", letterSpacing: "0.07em",
      }}>{label}</label>
      <div
        onClick={() => ref.current?.click()}
        style={{
          height: 80,
          border: `1.5px dashed ${value ? t.primary : t.border}`,
          borderRadius: 12,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          background: value ? t.primaryLight : t.background,
          overflow: "hidden",
        }}
      >
        {preview
          ? <img src={preview} alt={label} style={{ height: "100%", width: "100%", objectFit: "cover" }} />
          : <span style={{ color: t.textMuted, fontSize: 12 }}>📷 Tap to upload {label}</span>}
      </div>
      <p style={{ fontSize: 11, color: t.textMuted, margin: "2px 0 0" }}>
        JPG or PNG · max 5 MB
      </p>
      <input
        ref={ref}
        type="file"
        accept="image/jpeg,image/png"
        capture="environment"
        style={{ display: "none" }}
        id={fieldId}
        onChange={(e) => {
          const f = e.target.files?.[0] ?? null;
          onChange(f);
          setPreview(f ? URL.createObjectURL(f) : null);
        }}
      />
    </div>
  );
}

/* ─── DocumentsStep — Area combobox (admin list + custom with debounce) ── */
function DocumentsStep({ data, onChange, onError }: StepComponentProps) {
  const { t, inp, lbl } = useStyles();
  injectStepAnimation();
  const zones = usePublicZones();

  const selectedCity = String(data.city ?? "").trim();
  const cityAreas: string[] = zones
    ? (zones.zones.find((z) => z.city === selectedCity)?.areas ?? [])
    : [];

  const currentArea = String(data.area ?? "");
  const [customMode, setCustomMode] = useState(
    !!currentArea && cityAreas.length > 0 && !cityAreas.includes(currentArea)
  );

  const areaHook = useCustomLocationInput(
    "area",
    selectedCity || undefined,
    (val) => { onChange("area", val); },
    onError
  );

  const fmtCnic = (v: string) => {
    const d = v.replace(/\D/g, "").slice(0, 13);
    if (d.length <= 5) return d;
    if (d.length <= 12) return `${d.slice(0, 5)}-${d.slice(5)}`;
    return `${d.slice(0, 5)}-${d.slice(5, 12)}-${d.slice(12)}`;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, animation: "stepFadeIn 0.5s ease" }}>
      <p style={{ color: t.textMuted, fontSize: 13, margin: 0 }}>
        Phone for OTP verification and KYC documents
      </p>
      <Field>
        <label style={lbl}>Phone Number *</label>
        <input
          type="tel"
          inputMode="tel"
          placeholder="03XXXXXXXXX"
          maxLength={11}
          style={inp}
          value={(data.phone as string) ?? ""}
          onChange={(e) => { onChange("phone", e.target.value.replace(/\D/g, "").slice(0, 11)); onError(""); }}
        />
        {!!data.phone && !isValidPhone(String(data.phone)) &&
          <p style={{ color: t.error, fontSize: 11, margin: 0, display: "flex", alignItems: "center", gap: 4 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            Valid Pakistani number required (03XXXXXXXXX)
          </p>}
        {!!data.phone && isValidPhone(String(data.phone)) &&
          <p style={{ color: t.primary, fontSize: 11, margin: 0, display: "flex", alignItems: "center", gap: 4 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
            Valid number
          </p>}
      </Field>
      <Field>
        <label style={lbl}>CNIC Number *</label>
        <input
          type="text"
          inputMode="numeric"
          placeholder="XXXXX-XXXXXXX-X"
          maxLength={15}
          style={inp}
          value={(data.cnic as string) ?? ""}
          onChange={(e) => { onChange("cnic", fmtCnic(e.target.value)); onError(""); }}
        />
        {!!data.cnic && isValidCnic(String(data.cnic)) &&
          <p style={{ color: t.primary, fontSize: 11, margin: 0, display: "flex", alignItems: "center", gap: 4 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
            Valid CNIC
          </p>}
      </Field>
      <Field>
        <label style={lbl}>Email <span style={{ fontWeight: 400, color: t.textMuted }}>(optional)</span></label>
        <input
          type="email"
          inputMode="email"
          placeholder="email@example.com"
          style={inp}
          value={(data.email as string) ?? ""}
          onChange={(e) => { onChange("email", e.target.value); onError(""); }}
        />
      </Field>

      {/* Area / Neighborhood */}
      <Field>
        <label style={lbl}>Area / Neighborhood *</label>

        {cityAreas.length > 0 && !customMode && (
          <div style={{ position: "relative" }}>
            <select
              value={currentArea}
              onChange={(e) => {
                const v = e.target.value;
                if (v === "__custom__") {
                  setCustomMode(true);
                  onChange("area", "");
                } else {
                  onChange("area", v);
                  onError("");
                }
              }}
              style={{
                ...inp,
                paddingRight: 36,
                appearance: "none",
                WebkitAppearance: "none",
                cursor: "pointer",
                color: currentArea ? t.text : t.textMuted,
              }}
            >
              <option value="" disabled style={{ color: t.textMuted }}>Select area in {selectedCity || "your city"}</option>
              {cityAreas.map((a) => (
                <option key={a} value={a} style={{ background: t.surface ?? "#0F1827", color: t.text }}>{a}</option>
              ))}
              <option value="__custom__" style={{ background: t.surface ?? "#0F1827", color: t.primary, fontStyle: "italic" }}>
                ✏ Other / Enter manually
              </option>
            </select>
            <span style={{
              position: "absolute", right: 14, top: "50%",
              transform: "translateY(-50%)", pointerEvents: "none",
              color: t.textMuted, fontSize: 12,
            }}>▾</span>
          </div>
        )}

        {(cityAreas.length === 0 || customMode) && (
          <div>
            <LocationAutocompleteInput
              type="area"
              city={selectedCity || undefined}
              value={currentArea}
              onChange={(v) => areaHook.handleInput(v)}
              onBlur={areaHook.handleBlur}
              placeholder={`e.g. Main Bazaar, Model Town${selectedCity ? ` in ${selectedCity}` : ""}`}
              style={inp}
              checking={areaHook.checking}
              autoFocus={customMode}
              t={t}
            />
            {areaHook.fieldError && (
              <p style={{ fontSize: 11, color: t.error, margin: "4px 0 0" }}>{areaHook.fieldError}</p>
            )}
            {!areaHook.fieldError && customMode && currentArea && (
              <p style={{ fontSize: 10, color: t.textMuted, margin: "4px 0 0" }}>Select a suggestion or enter manually.</p>
            )}
            {customMode && cityAreas.length > 0 && (
              <button
                type="button"
                onClick={() => { setCustomMode(false); onChange("area", ""); }}
                style={{
                  background: "none", border: "none", padding: "4px 0 0",
                  color: t.primary, fontSize: 12, fontWeight: 600,
                  cursor: "pointer", textAlign: "left",
                }}
              >
                ← Back to list
              </button>
            )}
          </div>
        )}
      </Field>

      <FileField label="CNIC Front" fieldId="cnicFrontPhoto" value={(data.cnicFrontPhoto as File) ?? null} onChange={(f) => onChange("cnicFrontPhoto", f)} />
      <FileField label="CNIC Back" fieldId="cnicBackPhoto" value={(data.cnicBackPhoto as File) ?? null} onChange={(f) => onChange("cnicBackPhoto", f)} />
      <FileField label="Store Front Photo" fieldId="storeFrontPhoto" value={(data.storeFrontPhoto as File) ?? null} onChange={(f) => onChange("storeFrontPhoto", f)} />
    </div>
  );
}

/**
 * Build vendor registration steps.
 */
export function getVendorSteps(_config: {
  phoneEnabled: boolean;
  emailEnabled: boolean;
}): StepConfig[] {
  return [...vendorSteps];
}
