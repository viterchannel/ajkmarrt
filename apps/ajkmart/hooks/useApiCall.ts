import { useCallback, useRef, useState } from "react";
import { useToast } from "@/context/ToastContext";
import { getErrorMessage } from "@/utils/errorUtils";

type ApiCallState<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
  retrying: boolean;
  retryCount: number;
  execute: (...args: any[]) => Promise<T | null>;
  retry: () => Promise<T | null>;
  reset: () => void;
};

const BACKOFF_BASE_MS = 1000;
const MAX_RETRIES = 3;

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

export function useApiCall<T>(
  apiFn: (...args: any[]) => Promise<T>,
  options?: {
    showErrorToast?: boolean;
    maxRetries?: number;
    onSuccess?: (data: T) => void;
    onError?: (error: string) => void;
    retryMessage?: string;
  },
): ApiCallState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const lastArgsRef = useRef<any[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);
  const { showToast } = useToast();

  // Keep latest options and apiFn in refs so callbacks never go stale without
  // needing to be recreated on every render (avoids infinite re-render loops).
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const apiFnRef = useRef(apiFn);
  apiFnRef.current = apiFn;

  const callWithRetry = useCallback(
    async (args: any[], isRetry = false): Promise<T | null> => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const controller = new AbortController();
      abortControllerRef.current = controller;

      const curOptions   = optionsRef.current;
      const showErr      = curOptions?.showErrorToast !== false;
      const maxRetries   = curOptions?.maxRetries ?? MAX_RETRIES;

      if (!isRetry) {
        setLoading(true);
        setError(null);
        setRetryCount(0);
      }

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        if (controller.signal.aborted) return null;

        if (attempt > 0) {
          setRetrying(true);
          setRetryCount(attempt);
          if (showErr) {
            showToast(
              optionsRef.current?.retryMessage || `Retrying... (${attempt}/${maxRetries})`,
              "warning",
            );
          }
          await delay(BACKOFF_BASE_MS * Math.pow(2, attempt - 1));
        }

        try {
          const result = await apiFnRef.current(...args);
          if (controller.signal.aborted) return null;
          setData(result);
          setLoading(false);
          setRetrying(false);
          setError(null);
          setRetryCount(0);
          optionsRef.current?.onSuccess?.(result);
          return result;
        } catch (e: unknown) {
          if (controller.signal.aborted) return null;
          const msg = getErrorMessage(e);
          if (attempt === maxRetries) {
            setError(msg);
            setLoading(false);
            setRetrying(false);
            if (showErr) {
              showToast(msg, "error");
            }
            optionsRef.current?.onError?.(msg);
            return null;
          }
        }
      }
      return null;
    },
    [showToast],
  );

  const execute = useCallback(
    async (...args: any[]) => {
      lastArgsRef.current = args;
      return callWithRetry(args, false);
    },
    [callWithRetry],
  );

  const retry = useCallback(async () => {
    return callWithRetry(lastArgsRef.current, true);
  }, [callWithRetry]);

  const reset = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setData(null);
    setLoading(false);
    setError(null);
    setRetrying(false);
    setRetryCount(0);
  }, []);

  return { data, loading, error, retrying, retryCount, execute, retry, reset };
}
