import { SocialButtons } from "./SocialButtons";

export interface SocialLoginButtonsProps {
  onGooglePress?: () => void;
  onFacebookPress?: () => void;
  loadingProvider?: "google" | "facebook" | null;
  disabled?: boolean;
  className?: string;
  label?: string;
  googleLabel?: string;
  facebookLabel?: string;
}

export function SocialLoginButtons({
  onGooglePress,
  onFacebookPress,
  loadingProvider = null,
  disabled = false,
  className,
  label,
  googleLabel,
  facebookLabel,
}: SocialLoginButtonsProps) {
  return (
    <SocialButtons
      className={className}
      label={label}
      disabled={disabled}
      onGoogle={onGooglePress}
      onFacebook={onFacebookPress}
      googleLoading={loadingProvider === "google"}
      facebookLoading={loadingProvider === "facebook"}
      googleLabel={googleLabel}
      facebookLabel={facebookLabel}
    />
  );
}
