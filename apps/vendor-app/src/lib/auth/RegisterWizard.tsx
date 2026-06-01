import { RegisterScreen, ThemeProvider, useAuthTheme } from "@workspace/auth-react";
import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { api } from "../api";
import { useAuth } from "./useAuth";
import { vendorTheme } from "./theme";
import {
  DRAFT_KEY, DRAFT_TTL_KEY,
  loadDraft, saveDraft, getVendorSteps,
} from "./vendor-register-steps";
import { VendorRegistrationSuccess } from "./VendorRegistrationSuccess";

function SignInFooter({ onNavigate }: { onNavigate: () => void }) {
  const theme = useAuthTheme();
  return (
    <div style={{
      textAlign: "center",
      padding: "0 0 24px",
      marginTop: -8,
    }}>
      <span style={{ color: theme.textMuted, fontSize: 14 }}>
        Already have an account?{" "}
        <a
          href="/login"
          onClick={(e) => { e.preventDefault(); onNavigate(); }}
          style={{ color: theme.primary, fontWeight: 600, textDecoration: "none" }}
        >
          Sign in
        </a>
      </span>
    </div>
  );
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

export function RegisterWizard() {
  const [, navigate] = useLocation();
  const { register } = useAuth();
  const [submitted, setSubmitted] = useState(false);
  const [submittedStoreName, setSubmittedStoreName] = useState<string>("");
  const [submittedOwnerName, setSubmittedOwnerName] = useState<string>("");
  const [submittedCity, setSubmittedCity] = useState<string>("");

  const steps = useMemo(() => getVendorSteps({ phoneEnabled: true, emailEnabled: true }), []);

  if (submitted) {
    return (
      <VendorRegistrationSuccess
        storeName={submittedStoreName}
        ownerName={submittedOwnerName}
        city={submittedCity}
        onGoToLogin={() => navigate("/login")}
      />
    );
  }

  return (
    <ThemeProvider role="vendor" theme={vendorTheme}>
      <RegisterScreen
        role="vendor"
        accent={vendorTheme.primary}
        accentText="#ffffff"
        steps={steps}
        initialData={loadDraft()}
        onDataChange={saveDraft}
        className="vendor-register-screen"
        onSubmit={async (data) => {
          async function uploadDocIfFile(field: unknown): Promise<string | undefined> {
            if (!(field instanceof File)) return undefined;
            try {
              const { url } = (await api.uploadRegistrationDoc(field)) as { url: string };
              return url;
            } catch {
              return undefined;
            }
          }
          const [cnicFront, cnicBack, storeFront] = await Promise.all([
            uploadDocIfFile(data.cnicFrontPhoto),
            uploadDocIfFile(data.cnicBackPhoto),
            uploadDocIfFile(data.storeFrontPhoto),
          ]);
          const documents = (cnicFront || cnicBack || storeFront)
            ? JSON.stringify({ cnicFront, cnicBack, storeFront })
            : undefined;

          const geo = await getRegistrationLocation();

          const result = await register({
            phone: data.phone as string,
            storeName: data.storeName as string,
            storeCategory: data.storeCategory as string,
            name: data.ownerName as string,
            city: data.city as string,
            area: String(data.area ?? "").trim(),
            address: data.address as string | undefined,
            cnic: String(data.cnic ?? "").trim(),
            email: data.email ? String(data.email).trim() : undefined,
            bankName: data.bankName as string | undefined,
            bankAccount: data.bankAccount as string | undefined,
            bankAccountTitle: data.bankAccountTitle as string | undefined,
            password: data.password as string,
            documents,
            acceptedTermsVersion: "1.0",
            registrationLat: geo?.lat,
            registrationLng: geo?.lng,
          });

          if (result.success) {
            /* Store details for success screen */
            setSubmittedStoreName(String(data.storeName ?? "").trim());
            setSubmittedOwnerName(String(data.ownerName ?? "").trim());
            setSubmittedCity(String(data.city ?? "").trim());
            try {
              localStorage.removeItem(DRAFT_KEY);
              localStorage.removeItem(DRAFT_TTL_KEY);
            } catch { }
          }
          return result;
        }}
        onDone={() => setSubmitted(true)}
      />
      <SignInFooter onNavigate={() => navigate("/login")} />
    </ThemeProvider>
  );
}
