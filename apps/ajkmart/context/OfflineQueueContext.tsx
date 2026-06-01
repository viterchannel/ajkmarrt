import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import NetInfo from "@react-native-community/netinfo";
import {
  enqueueRequest,
  drainQueue,
  queueLength,
  type OfflineQueueAction,
} from "@/lib/offline/queue";
import { API_BASE } from "@/utils/api";

interface OfflineQueueContextType {
  enqueue: (
    action: OfflineQueueAction,
    endpoint: string,
    method: "POST" | "PUT" | "PATCH",
    payload: Record<string, unknown>,
    token?: string | null,
  ) => Promise<void>;
  flush: (token?: string | null) => Promise<void>;
  pendingCount: number;
}

const OfflineQueueContext = createContext<OfflineQueueContextType>({
  enqueue: async () => {},
  flush: async () => {},
  pendingCount: 0,
});

export function OfflineQueueProvider({ children }: { children: React.ReactNode }) {
  const [pendingCount, setPendingCount] = useState(0);
  const tokenRef = useRef<string | null | undefined>(null);

  const refreshCount = useCallback(async () => {
    try {
      const len = await queueLength();
      setPendingCount(len);
    } catch {}
  }, []);

  useEffect(() => {
    refreshCount();
  }, [refreshCount]);

  const flush = useCallback(async (token?: string | null) => {
    try {
      await drainQueue(API_BASE, token ?? tokenRef.current);
      await refreshCount();
    } catch {}
  }, [refreshCount]);

  const enqueue = useCallback(async (
    action: OfflineQueueAction,
    endpoint: string,
    method: "POST" | "PUT" | "PATCH",
    payload: Record<string, unknown>,
    token?: string | null,
  ) => {
    if (token) tokenRef.current = token;
    await enqueueRequest(action, endpoint, method, payload);
    await refreshCount();
  }, [refreshCount]);

  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      if (state.isConnected) {
        flush(tokenRef.current);
      }
    });
    return () => unsub();
  }, [flush]);

  return (
    <OfflineQueueContext.Provider value={{ enqueue, flush, pendingCount }}>
      {children}
    </OfflineQueueContext.Provider>
  );
}

export function useOfflineQueue() {
  return useContext(OfflineQueueContext);
}
