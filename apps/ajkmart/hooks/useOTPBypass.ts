/**
 * useOTPBypass hook for Customer App (AJKMart)
 *
 * Derives bypass state from data returned by the send-otp API response
 * (the `bypassActive`, `bypassExpiresAt`, and `bypassMessage` fields) rather
 * than making an independent /api/auth/config fetch.  This keeps client state
 * in sync with the server's canonical bypass decision at the moment the OTP
 * request is made.
 *
 * Usage:
 *   const bypass = useOTPBypass(sendOtpResponseData);
 *   // sendOtpResponseData comes from the PATCH /auth/send-otp response body
 *
 * If no data is provided (e.g. before the first send-otp call), all fields
 * default to "no bypass" so the OTP input is always shown until we know for
 * certain that bypass is active.
 */
export interface OTPBypassData {
  bypassActive?: boolean;
  otpBypassActive?: boolean;
  bypassExpiresAt?: string | null;
  otpBypassExpiresAt?: string | null;
  bypassMessage?: string | null;
}

export const useOTPBypass = (bypassData?: OTPBypassData) => {
  const active = !!(bypassData?.bypassActive ?? bypassData?.otpBypassActive);
  const expiresStr = bypassData?.bypassExpiresAt ?? bypassData?.otpBypassExpiresAt ?? null;
  const expiresAt = expiresStr ? new Date(expiresStr) : null;
  const message = bypassData?.bypassMessage ?? null;

  const remainingSeconds = expiresAt
    ? Math.max(0, Math.ceil((expiresAt.getTime() - Date.now()) / 1000))
    : 0;

  /* Treat bypass as expired if the window has closed but the flag is still
     set — prevents showing a "no OTP needed" banner after the window ends.  */
  const isExpired = remainingSeconds === 0 && active && expiresAt != null;

  return {
    bypassActive: active && !isExpired,
    bypassExpiresAt: isExpired ? null : expiresAt,
    bypassMessage: message,
    remainingSeconds,
    loading: false,
  };
};
