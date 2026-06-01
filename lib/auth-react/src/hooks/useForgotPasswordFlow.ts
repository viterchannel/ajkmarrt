import { useCallback, useState } from "react";

export type ForgotPasswordStep =
  | "choose-method"
  | "send-otp"
  | "enter-otp"
  | "new-password"
  | "totp-verify"
  | "success";

export interface UseForgotPasswordFlowOptions {
  role: "rider" | "vendor";
  api: {
    forgotPassword: (data: { phone?: string; email?: string }) => Promise<unknown>;
    verifyResetOtp: (data: {
      phone?: string;
      email?: string;
      otp: string;
    }) => Promise<{ resetToken: string }>;
    resetPassword: (data: { resetToken: string; newPassword: string }) => Promise<unknown>;
    twoFactorVerify?: (data: { code: string }) => Promise<unknown>;
  };
  onSuccess?: () => void;
}

export interface UseForgotPasswordFlowResult {
  step: ForgotPasswordStep;
  method: "phone" | "email";
  loading: boolean;
  error: string | null;
  resetToken: string;
  actions: {
    selectMethod: (method: "phone" | "email") => void;
    sendOtp: (contact: string) => Promise<void>;
    verifyOtp: (otp: string) => Promise<void>;
    setNewPassword: (password: string) => Promise<void>;
    verifyTotp: (code: string) => Promise<void>;
    reset: () => void;
  };
}

export function useForgotPasswordFlow(
  opts: UseForgotPasswordFlowOptions
): UseForgotPasswordFlowResult {
  const [step, setStep] = useState<ForgotPasswordStep>("choose-method");
  const [method, setMethod] = useState<"phone" | "email">("phone");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetToken, setResetToken] = useState("");
  const [_contact, setContact] = useState("");
  const [_password, setPassword] = useState("");

  const clearError = () => setError(null);

  const selectMethod = useCallback((m: "phone" | "email") => {
    setMethod(m);
    setStep("send-otp");
    clearError();
  }, []);

  const sendOtp = useCallback(
    async (contact: string) => {
      clearError();
      setLoading(true);
      try {
        const data: { phone?: string; email?: string } =
          method === "phone" ? { phone: contact } : { email: contact };
        await opts.api.forgotPassword(data);
        setContact(contact);
        setStep("enter-otp");
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Failed to send OTP");
      } finally {
        setLoading(false);
      }
    },
    [method, opts.api]
  );

  const verifyOtp = useCallback(
    async (otp: string) => {
      clearError();
      setLoading(true);
      try {
        const data: { phone?: string; email?: string; otp: string } =
          method === "phone"
            ? { phone: _contact, otp }
            : { email: _contact, otp };
        const res = await opts.api.verifyResetOtp(data);
        if (!res.resetToken) throw new Error("No reset token received");
        setResetToken(res.resetToken);
        setStep("new-password");
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "OTP verification failed");
      } finally {
        setLoading(false);
      }
    },
    [_contact, method, opts.api]
  );

  const setNewPassword = useCallback(
    async (password: string) => {
      clearError();
      if (!resetToken) {
        setError("Session expired. Please start over.");
        return;
      }
      setLoading(true);
      try {
        await opts.api.resetPassword({ resetToken, newPassword: password });
        setPassword(password);
        setStep("success");
        opts.onSuccess?.();
      } catch (e: unknown) {
        const errObj = e as { responseData?: { requires2FA?: boolean } };
        if (errObj?.responseData?.requires2FA) {
          setPassword(password);
          setStep("totp-verify");
          setLoading(false);
          return;
        }
        setError(e instanceof Error ? e.message : "Failed to reset password");
      } finally {
        setLoading(false);
      }
    },
    [resetToken, opts]
  );

  const verifyTotp = useCallback(
    async (code: string) => {
      clearError();
      setLoading(true);
      try {
        if (opts.api.twoFactorVerify) {
          await opts.api.twoFactorVerify({ code });
        } else {
          await opts.api.resetPassword({ resetToken, newPassword: _password });
        }
        setStep("success");
        opts.onSuccess?.();
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "2FA verification failed");
      } finally {
        setLoading(false);
      }
    },
    [opts, resetToken, _password]
  );

  const reset = useCallback(() => {
    setStep("choose-method");
    setMethod("phone");
    setLoading(false);
    setError(null);
    setResetToken("");
    setContact("");
    setPassword("");
  }, []);

  return {
    step,
    method,
    loading,
    error,
    resetToken,
    actions: { selectMethod, sendOtp, verifyOtp, setNewPassword, verifyTotp, reset },
  };
}
