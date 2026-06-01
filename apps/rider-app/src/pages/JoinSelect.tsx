import { useLocation } from "wouter";
import { JoinSelect as SharedJoinSelect } from "@workspace/auth-react";
import { useLanguage } from "../lib/useLanguage";
import type { Language } from "@workspace/i18n";

const RIDER_THEME = {
  bg: "var(--color-surface)",
  card: "var(--color-card-dark)",
  border: "#1e2530",
  logoFill: "var(--color-surface)",
};

type Lang = "en" | "ur" | "roman";

export default function JoinSelect() {
  const [, navigate] = useLocation();
  const { language, setLanguage } = useLanguage();

  return (
    <SharedJoinSelect
      theme={RIDER_THEME}
      language={language as Lang}
      onLanguageChange={(l: Lang) => setLanguage(l as Language)}
      actions={{
        onRiderRegister: () => navigate("/register"),
        onRiderLogin: () => navigate("/login"),
        onVendorRegister: () => { window.location.href = "/vendor/register"; },
        onVendorLogin: () => { window.location.href = "/vendor/login"; },
      }}
    />
  );
}
