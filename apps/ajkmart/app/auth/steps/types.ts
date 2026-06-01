import type { AppUser } from "@/context/AuthContext";

export interface RegisterData {
  phone: string;
  name: string;
  email: string;
  username: string;
  city: string;
  area: string;
  address: string;
  latitude: string;
  longitude: string;
  cnic: string;
  password: string;
  confirmPassword: string;
  termsAccepted: boolean;
}

export interface StepBaseProps {
  data: RegisterData;
  onChange: (patch: Partial<RegisterData>) => void;
  onError: (msg: string) => void;
  onClearError: () => void;
  loading: boolean;
  onLoadingChange: (v: boolean) => void;
  error: string;
}

export interface StepPhoneVerifyProps extends StepBaseProps {
  authToken: string;
  onOtpVerified: (token: string, refreshToken: string, user: AppUser) => void;
}
