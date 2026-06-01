import { useCallback, useEffect, useState } from "react";
import {
  checkGate,
  FEATURE_RULES_UPDATED_EVENT,
  FEATURE_USAGE_UPDATED_EVENT,
  type GateResult,
} from "./featureGate";
import { useAuth } from "./rider-auth";

export interface UseFeatureGateResult {
  /** Whether the feature is accessible for the current rider. */
  accessible: boolean;
  /** Populated when accessible is false. */
  reason: GateResult["reason"] | undefined;
  /** Verification items the rider must complete before the feature unlocks. */
  missingVerifications: string[];
  /** True while the auth context is still loading (no userId yet). */
  isLoading: boolean;
  /** True when accessible is false solely because the rules cache was absent.
   *  Callers should trigger a background refresh and show a transient notice
   *  rather than a permanent block, because the rules may allow access once
   *  the cache is hydrated. */
  cacheWasEmpty: boolean;
}

/**
 * Reactive feature-gate hook.
 *
 * Reads the locally-cached feature rules for the authenticated rider and
 * returns a structured result that updates automatically whenever the cache
 * is refreshed (login, periodic background poll, admin status change).
 *
 * Usage:
 *   const { accessible, reason, missingVerifications, isLoading } =
 *     useFeatureGate("accept_ride");
 */
export function useFeatureGate(featureName: string): UseFeatureGateResult {
  const { user, loading } = useAuth();

  const evaluate = useCallback((): GateResult | null => {
    if (!user?.id) return null;
    return checkGate(user.id, featureName);
  }, [user?.id, featureName]);

  const [result, setResult] = useState<GateResult | null>(() => evaluate());

  /* Re-evaluate whenever the user or featureName changes */
  useEffect(() => {
    setResult(evaluate());
  }, [evaluate]);

  /* Re-evaluate whenever a background refresh writes a new cache snapshot */
  useEffect(() => {
    const handler = () => setResult(evaluate());
    window.addEventListener(FEATURE_RULES_UPDATED_EVENT, handler);
    return () => window.removeEventListener(FEATURE_RULES_UPDATED_EVENT, handler);
  }, [evaluate]);

  /* Re-evaluate whenever recordUsage() increments a local usage counter so
   * daily-limit gate results stay accurate after each successful action. */
  useEffect(() => {
    const handler = () => setResult(evaluate());
    window.addEventListener(FEATURE_USAGE_UPDATED_EVENT, handler);
    return () => window.removeEventListener(FEATURE_USAGE_UPDATED_EVENT, handler);
  }, [evaluate]);

  if (loading || !user?.id) {
    return {
      accessible: false,
      reason: undefined,
      missingVerifications: [],
      isLoading: true,
      cacheWasEmpty: false,
    };
  }

  if (!result) {
    return {
      accessible: true,
      reason: undefined,
      missingVerifications: [],
      isLoading: false,
      cacheWasEmpty: false,
    };
  }

  return {
    accessible: result.allowed,
    reason: result.reason,
    missingVerifications: result.missingVerifications ?? [],
    isLoading: false,
    cacheWasEmpty: result.cacheWasEmpty ?? false,
  };
}
