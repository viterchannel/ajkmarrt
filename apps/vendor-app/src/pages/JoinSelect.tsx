import { useLocation } from "wouter";
import { JoinSelect as SharedJoinSelect } from "@workspace/auth-react";

const VENDOR_THEME = {
  bg: "#060A14",
  card: "#0D1117",
  border: "#1a2236",
  logoFill: "#060A14",
};

export default function JoinSelect() {
  const [, navigate] = useLocation();

  return (
    <SharedJoinSelect
      theme={VENDOR_THEME}
      actions={{
        onRiderRegister: () => { window.location.href = "/rider/register"; },
        onRiderLogin: () => { window.location.href = "/rider/login"; },
        onVendorRegister: () => navigate("/register"),
        onVendorLogin: () => navigate("/login"),
      }}
    />
  );
}
