import { ForgotPasswordFlow, ThemeProvider } from "@workspace/auth-react";
import { useLocation } from "wouter";
import { api } from "../lib/api";

export default function ForgotPassword() {
  const [, navigate] = useLocation();

  return (
    <ThemeProvider role="vendor">
      <ForgotPasswordFlow
        role="vendor"
        logoSrc={import.meta.env.BASE_URL.replace(/\/$/, "") + "/ajkmart-logo.png"}
        logoAlt="AJKMart"
        api={{
          forgotPassword: (data) => api.forgotPassword(data),
          verifyResetOtp: async (data) => {
            const res = (await api.verifyResetOtp(data)) as Record<string, unknown>;
            return { resetToken: res.resetToken as string };
          },
          resetPassword: (data) => api.resetPassword(data),
          twoFactorVerify: (data) => api.twoFactorVerify(data),
        }}
        onSuccess={() => navigate("/login")}
      />
    </ThemeProvider>
  );
}
