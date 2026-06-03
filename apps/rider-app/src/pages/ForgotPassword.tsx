import { ForgotPasswordFlow, ThemeProvider, useAuthTheme } from "@workspace/auth-react";
import { useRef } from "react";
import { useLocation } from "wouter";
import { tDual, type TranslationKey } from "@workspace/i18n";
import { api } from "../lib/api";
import { riderTheme } from "../lib/auth/theme";
import { useLanguage } from "../lib/useLanguage";

function BackToLoginLink() {
  const theme = useAuthTheme();
  const [, navigate] = useLocation();
  const { language } = useLanguage();
  const T = (key: TranslationKey) => tDual(key, language);

  return (
    <div style={{ textAlign: "center", padding: "0 0 28px", marginTop: 8 }}>
      <span style={{ color: theme.textMuted, fontSize: 14 }}>
        {T("rememberYourPassword")}{" "}
        <a
          href="/login"
          onClick={(e) => { e.preventDefault(); navigate("/login"); }}
          style={{ color: theme.primary, fontWeight: 600, textDecoration: "none" }}
        >
          {T("signIn")}
        </a>
      </span>
    </div>
  );
}

export default function ForgotPassword() {
  const [, navigate] = useLocation();
  const resetRef = useRef({ resetToken: "", newPassword: "" });
  const { language } = useLanguage();
  const T = (key: TranslationKey) => tDual(key, language);

  return (
    <ThemeProvider role="rider" theme={riderTheme}>
      <ForgotPasswordFlow
        role="rider"
        logoSrc={import.meta.env.BASE_URL.replace(/\/$/, "") + "/ajkmart-logo.png"}
        logoAlt="AJKMart"
        strings={{
          backBtn:           T("back"),
          phoneLabel:        T("phoneNumber"),
          emailLabel:        T("emailAddress"),
          minPasswordHint:   T("regPasswordMinHint"),
          repeatPasswordHint: T("regRepeatPassword"),
          verifyBtn:         T("verifyAndContinue"),
          totpSubtitle:      T("subtitleTotp"),
          minPasswordError:  T("regPasswordMinLength"),
        }}
        api={{
          forgotPassword: (data) =>
            api.forgotPassword(
              (data.phone
                ? { method: "phone", phone: data.phone }
                : { method: "email", email: data.email as string }
              ) as Parameters<typeof api.forgotPassword>[0]
            ),
          verifyResetOtp: async (data) => {
            const res = (await api.verifyResetOtp(data)) as { resetToken: string };
            resetRef.current.resetToken = res.resetToken;
            return res;
          },
          resetPassword: async (data) => {
            resetRef.current.newPassword = data.newPassword;
            return api.resetPassword(data as Parameters<typeof api.resetPassword>[0]);
          },
          twoFactorVerify: async ({ code }) => {
            const { resetToken, newPassword } = resetRef.current;
            return api.resetPassword({
              resetToken,
              newPassword,
              totpCode: code,
            } as Parameters<typeof api.resetPassword>[0]);
          },
        }}
        onSuccess={() => navigate("/login")}
      />
      <BackToLoginLink />
    </ThemeProvider>
  );
}
