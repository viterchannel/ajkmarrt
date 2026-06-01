import { RegisterScreen, ThemeProvider, useAuthTheme, ApprovalOverlay } from "@workspace/auth-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { api, getApiBase } from "../api";
import { captureDeviceMeta } from "../deviceMeta";
import { useAuth, normalizeRoles, type AuthUser } from "../rider-auth";
import { useAuthOps } from "./useAuth";
import { riderTheme } from "./theme";
import {
  DRAFT_KEY, DRAFT_TTL_KEY,
  loadDraft, saveDraft, getRiderSteps,
} from "./rider-register-steps";
import { trackEvent } from "../analytics";
import { useLanguage } from "../useLanguage";
import { tDual, type TranslationKey } from "@workspace/i18n";

/* sessionStorage key — home page reads this to show a post-registration doc warning */
const DOC_WARN_KEY = "reg_doc_upload_warning";

/** True when the error was a network-level failure (no HTTP response at all). */
function isOfflineError(err: unknown): boolean {
  if (err instanceof TypeError) return true;
  if (err instanceof Error && err.message.toLowerCase().includes("fetch")) return true;
  return false;
}

/** Capture browser geolocation; returns { lat, lng } or null on failure/timeout. */
function getRegistrationLocation(): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) { resolve(null); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
    );
  });
}

/* ─── "Already have an account?" footer ─────────────────────────────── */
function SignInFooter({ onNavigate }: { onNavigate: () => void }) {
  const theme = useAuthTheme();
  const { language } = useLanguage();
  const T = (key: TranslationKey) => tDual(key, language);
  return (
    <div style={{ textAlign: "center", padding: "0 0 24px", marginTop: 8 }}>
      <span style={{ color: theme.textMuted, fontSize: 14 }}>
        {T("alreadyHaveAccount")}{" "}
        <a href="/login" onClick={(e) => { e.preventDefault(); onNavigate(); }}
          style={{ color: theme.primary, fontWeight: 600, textDecoration: "none" }}>
          {T("signIn")}
        </a>
      </span>
    </div>
  );
}

/* ─── Main wizard component ─────────────────────────────────────────── */
export interface RegisterWizardProps {
  onDone?: () => void;
}

type RegistrationStatus = "idle" | "pending_approval" | "active";

export function RegisterWizard({ onDone }: RegisterWizardProps) {
  const [, navigate] = useLocation();
  const { register } = useAuthOps();
  const { login, retryConnection } = useAuth();
  const { language } = useLanguage();

  const [registrationStatus, setRegistrationStatus] = useState<RegistrationStatus>("idle");

  /* Holds token + refreshToken after successful registration so doAutoLogin
     can be called safely from onDone (after RegisterScreen finishes its own
     setCompleted flow) instead of from inside onSubmit where it races with
     RegisterScreen's setLoading / setCompleted state updates. */
  const pendingLoginRef = useRef<{ token: string; refreshToken?: string } | null>(null);

  const steps = useMemo(() => getRiderSteps({ phoneEnabled: true, emailEnabled: true }, language), [language]);

  /* ── Auto-login helper ──────────────────────────────────────────────
     Fetches the full profile immediately after registration so we can
     call login() directly — this avoids the brief guest-screen flash
     that retryConnection() (async effect) would cause.                */
  async function doAutoLogin(token: string, refreshToken?: string) {
    api.storeTokens(token, refreshToken);
    try { localStorage.removeItem(DRAFT_KEY); localStorage.removeItem(DRAFT_TTL_KEY); } catch { }
    try {
      const profile = await api.getMe() as AuthUser & { roles?: unknown; role?: unknown };
      const roles = normalizeRoles(profile);
      profile.roles = roles;
      login(token, profile as AuthUser, refreshToken);
    } catch {
      /* Fallback: retryConnection increments retryKey which re-runs the
         startup getMe() effect in rider-auth.tsx. User may see a short
         loading spinner but will land on the authenticated dashboard.  */
      retryConnection();
    }
    navigate("/");
  }

  /* ── Pending approval screen ────────────────────────────────────── */
  if (registrationStatus === "pending_approval") {
    return (
      <ThemeProvider role="rider" theme={riderTheme}>
        <ApprovalOverlay
          status="pending"
          title="Registration Submitted"
          message="Your registration is under review. You will be notified once the admin approves your account. Please check back later."
          actionLabel="Back to Login"
          onActionPress={() => navigate("/login")}
        />
      </ThemeProvider>
    );
  }

  /* ── Normal wizard ───────────────────────────────────────────────── */
  return (
    <ThemeProvider role="rider" theme={riderTheme}>
      <RegisterScreen
        role="rider"
        accent={riderTheme.primary}
        accentText="var(--color-surface)"
        steps={steps}
        initialData={loadDraft()}
        onDataChange={saveDraft}
        className="rider-register-screen"
        onSubmit={async (data) => {
          trackEvent("registration_funnel", { step: "form_submitted" });

          /* Fetch geolocation and device metadata in parallel */
          const [geo, deviceMeta] = await Promise.all([
            getRegistrationLocation(),
            captureDeviceMeta(),
          ]);

          const usernameVal = String(data.username ?? "").trim();
          /* Extract document files before building the JSON payload —
             File objects cannot be JSON-serialised or stored in localStorage. */
          const cnicFrontPhoto = data.cnicFrontPhoto instanceof File ? data.cnicFrontPhoto : null;
          const cnicBackPhoto = data.cnicBackPhoto instanceof File ? data.cnicBackPhoto : null;
          const licensePhoto = data.licensePhoto instanceof File ? data.licensePhoto : null;

          const payload: Record<string, unknown> = {
            phone: String(data.phone ?? "").trim(),
            password: data.password as string,
            name: String(data.fullName ?? "").trim(),
            username: usernameVal || undefined,
            email: data.email ? String(data.email).trim() : undefined,
            cnic: String(data.cnic ?? "").trim(),
            city: String(data.city ?? "").trim() || undefined,
            area: String(data.area ?? "").trim(),
            address: String(data.address ?? "").trim() || undefined,
            vehicleType: data.vehicleType as string,
            vehiclePlate: String(data.plateNumber ?? "").trim(),
            drivingLicense: String(data.licenseNumber ?? "").trim(),
            registrationLat: geo?.lat,
            registrationLng: geo?.lng,
            deviceMeta,
          };

          try {
            const result = await register(payload as Parameters<typeof api.registerRider>[0]);

            if (result.success) {
              trackEvent("register", { method: "otp" });
              trackEvent("registration_funnel", { step: "registration_success" });
              const d = result.data as Record<string, unknown>;
              const token = d?.token as string | undefined;
              const refreshToken = d?.refreshToken as string | undefined;

              /* Upload document photos if the rider provided any in Step 4.
                 This is best-effort — a failure here does NOT block login.
                 The rider can re-upload from the Profile / KYC page later. */
              const hasDocuments = cnicFrontPhoto || cnicBackPhoto || licensePhoto;
              if (hasDocuments && token) {
                try {
                  const form = new FormData();
                  if (cnicFrontPhoto) form.append("cnicFront",   cnicFrontPhoto);
                  if (cnicBackPhoto)  form.append("cnicBack",    cnicBackPhoto);
                  if (licensePhoto)   form.append("licensePhoto", licensePhoto);
                  const docRes = await fetch(`${getApiBase()}/verify/documents`, {
                    method: "POST",
                    headers: { Authorization: `Bearer ${token}` },
                    body: form,
                  });
                  if (!docRes.ok) {
                    console.warn(
                      "[RegisterWizard] document upload returned non-2xx (non-fatal):",
                      docRes.status
                    );
                    /* Persist a warning so the home page can surface a toast after login */
                    try {
                      sessionStorage.setItem(DOC_WARN_KEY, "1");
                    } catch { }
                  }
                } catch (docErr) {
                  /* Non-fatal — rider can upload documents later */
                  console.warn("[RegisterWizard] document upload failed (non-fatal):", docErr);
                  try { sessionStorage.setItem(DOC_WARN_KEY, "1"); } catch { }
                }
              }

              if (token) {
                /* Store login data for onDone — avoids calling navigate() inside onSubmit
                   which races with RegisterScreen's own setCompleted / setLoading updates. */
                pendingLoginRef.current = { token, refreshToken };
                setRegistrationStatus("active");
                /* Do NOT call doAutoLogin here — let RegisterScreen finish its completion
                   flow (setCompleted + onDone) first. Navigation happens in onDone below. */
              } else {
                /* No token → admin approval is pending */
                setRegistrationStatus("pending_approval");
                try { localStorage.removeItem(DRAFT_KEY); localStorage.removeItem(DRAFT_TTL_KEY); } catch { }
              }
            }

            return result;
          } catch (err: unknown) {
            /* Network error — show a clear message and let the user retry */
            if (isOfflineError(err)) {
              return {
                success: false,
                error: "No internet connection. Please check your network and try again.",
              };
            }
            throw err;
          }
        }}
        onDone={() => {
          /* If registration succeeded with a token, do the actual navigation here
             (after RegisterScreen has finished its setCompleted flow) rather than
             inside onSubmit where it raced with RegisterScreen's state updates. */
          if (pendingLoginRef.current) {
            const { token, refreshToken } = pendingLoginRef.current;
            pendingLoginRef.current = null;
            void doAutoLogin(token, refreshToken);
          }
          onDone?.();
        }}
      />
      <SignInFooter onNavigate={() => navigate("/login")} />
    </ThemeProvider>
  );
}
