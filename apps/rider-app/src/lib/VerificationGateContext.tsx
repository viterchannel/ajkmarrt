import { createContext, useCallback, useContext, useState } from "react";
import type { ReactNode } from "react";

const SESSION_KEY = "_ajkm_blockedVerifications";

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

interface VerificationGateContextValue {
  blockedVerifications: string[];
  setBlockedVerifications: (items: string[]) => void;
  addBlockedVerifications: (items: string[]) => void;
  clearBlockedVerifications: () => void;
}

const VerificationGateContext = createContext<VerificationGateContextValue>({
  blockedVerifications: [],
  setBlockedVerifications: () => {},
  addBlockedVerifications: () => {},
  clearBlockedVerifications: () => {},
});

export function VerificationGateProvider({ children }: { children: ReactNode }) {
  const [blockedVerifications, _set] = useState<string[]>(readFromSession);

  const setBlockedVerifications = useCallback((items: string[]) => {
    _set(items);
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(items));
    } catch {
    }
  }, []);

  const addBlockedVerifications = useCallback((items: string[]) => {
    _set((prev) => {
      const merged = Array.from(new Set([...prev, ...items]));
      try {
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(merged));
      } catch {
      }
      return merged;
    });
  }, []);

  const clearBlockedVerifications = useCallback(() => {
    _set([]);
    try {
      sessionStorage.removeItem(SESSION_KEY);
    } catch {
    }
  }, []);

  return (
    <VerificationGateContext.Provider
      value={{ blockedVerifications, setBlockedVerifications, addBlockedVerifications, clearBlockedVerifications }}
    >
      {children}
    </VerificationGateContext.Provider>
  );
}

export function useVerificationGate() {
  return useContext(VerificationGateContext);
}
