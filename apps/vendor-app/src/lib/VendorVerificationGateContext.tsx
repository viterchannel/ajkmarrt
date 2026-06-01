import { createContext, useCallback, useContext, useState } from "react";
import type { ReactNode } from "react";

const SESSION_KEY = "_ajkm_vendor_blockedVerifications";

function readFromSession(): string[] {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    return [];
  }
}

interface VendorVerificationGateContextValue {
  blockedVerifications: string[];
  setBlockedVerifications: (items: string[]) => void;
  clearBlockedVerifications: () => void;
}

const VendorVerificationGateContext = createContext<VendorVerificationGateContextValue>({
  blockedVerifications: [],
  setBlockedVerifications: () => {},
  clearBlockedVerifications: () => {},
});

export function VendorVerificationGateProvider({ children }: { children: ReactNode }) {
  const [blockedVerifications, _set] = useState<string[]>(readFromSession);

  const setBlockedVerifications = useCallback((items: string[]) => {
    _set(items);
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(items));
    } catch {
    }
  }, []);

  const clearBlockedVerifications = useCallback(() => {
    _set([]);
    try {
      sessionStorage.removeItem(SESSION_KEY);
    } catch {
    }
  }, []);

  return (
    <VendorVerificationGateContext.Provider
      value={{ blockedVerifications, setBlockedVerifications, clearBlockedVerifications }}
    >
      {children}
    </VendorVerificationGateContext.Provider>
  );
}

export function useVendorVerificationGate() {
  return useContext(VendorVerificationGateContext);
}
