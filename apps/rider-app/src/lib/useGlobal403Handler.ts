import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useVerificationGate } from "./VerificationGateContext";
import { useAuth } from "./rider-auth";

type BlockedError = {
  status?: number;
  blocked?: boolean;
  missingVerifications?: string[];
};

function extractBlockedError(error: unknown): BlockedError | null {
  if (!error || typeof error !== "object") return null;
  const e = error as BlockedError;
  if (e.status === 403) return e;
  return null;
}

/**
 * Global 403+blocked interceptor.
 *
 * Subscribes to the React Query QueryCache and MutationCache. Any time a query
 * or mutation throws an error with `status === 403 && blocked === true`, this
 * hook calls `addBlockedVerifications` (union-merge) so that `VerificationGateModal`
 * opens automatically — regardless of which page or component made the API call.
 *
 * Uses `addBlockedVerifications` (not `setBlockedVerifications`) to merge new
 * missing items with any already in state, preventing duplicates and avoiding
 * overwriting items surfaced by concurrent API calls.
 *
 * For bare 403s (without blocked:true), the session is no longer valid on the
 * server (revoked, banned, deleted). Force logout so the rider cannot continue
 * operating with a stale session.
 *
 * Must be rendered inside both <QueryClientProvider> and <VerificationGateProvider>.
 */
export function useGlobal403Handler() {
  const qc = useQueryClient();
  const { addBlockedVerifications } = useVerificationGate();
  const { logout } = useAuth();

  useEffect(() => {
    const handle = (error: unknown) => {
      const e = extractBlockedError(error);
      if (!e) return;
      if (e.blocked === true) {
        /* Verification-blocked 403: server included explicit verification
           payload — surface the verification gate modal.                     */
        const missing = Array.isArray(e.missingVerifications) ? e.missingVerifications : [];
        if (missing.length > 0) {
          addBlockedVerifications(missing);
        }
      } else {
        /* Bare 403 — no verification payload present.  This covers:
           • blocked: false  → server explicitly revoked the session
           • blocked: undefined → raw 403 from auth middleware (expired /
             invalidated token) that didn't attach a verification payload
           Both indicate the session is no longer valid on the server.  Force
           logout so the rider cannot continue operating with a stale session. */
        logout("/login");
      }
    };

    const queryUnsub = qc.getQueryCache().subscribe((event) => {
      if (event.type === "updated") {
        const action = (event as unknown as { action?: { type?: string; error?: unknown } }).action;
        if (action?.type === "error") handle(action.error);
      }
    });

    const mutationUnsub = qc.getMutationCache().subscribe((event) => {
      if (event.type === "updated") {
        const mutation = event.mutation;
        if (mutation?.state.status === "error") {
          handle(mutation.state.error);
        }
      }
    });

    return () => {
      queryUnsub();
      mutationUnsub();
    };
  }, [qc, addBlockedVerifications, logout]);
}
