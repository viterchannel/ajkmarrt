import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { StoreHours } from "../lib/vendor-auth";
import { useAuth } from "../lib/vendor-auth";

interface UseStoreStatusOptions {
  onSuccess?: () => void;
  onError?: (e: Error) => void;
}

export function useStoreStatus(options?: UseStoreStatusOptions) {
  const { user, refreshUser } = useAuth();
  const qc = useQueryClient();

  const mut = useMutation({
    mutationFn: (isOpen: boolean) => api.updateStore({ storeIsOpen: isOpen }),
    onSuccess: () => {
      void refreshUser();
      void qc.invalidateQueries({ queryKey: ["vendor-stats"] });
      options?.onSuccess?.();
    },
    onError: (e: Error) => options?.onError?.(e),
  });

  return {
    isOpen: !!user?.storeIsOpen,
    storeHours: (user?.storeHours ?? null) as StoreHours | null,
    toggle: () => {
      /* Guard against null user (e.g. during session handover) to avoid firing
         a mutation with an unintended value while auth state is undefined.  */
      if (!user) return;
      mut.mutate(!user.storeIsOpen);
    },
    isPending: mut.isPending,
  };
}
