import { createLogger } from "@/lib/logger";

const log = createLogger("[featureGate]");

export interface FeatureRule {
  featureName: string;
  accessible: boolean;
  requiredVerifications: string[];
  missingVerifications: string[];
  fallbackMsg: string | null;
  maxDailyLimit: number;
}

export interface GateResult {
  allowed: boolean;
  reason?: "not_accessible" | "daily_limit_exceeded";
  fallbackMsg?: string | null;
  missingVerifications?: string[];
  used: number;
  limit: number;
  /** True when the result was produced because the rules cache was absent
   *  (localStorage empty / private browsing). A false result due to a missing
   *  cache should trigger a background cache refresh rather than a permanent
   *  block, because the rule might allow access once fetched. */
  cacheWasEmpty?: boolean;
}

/** Features that must fail-closed (deny) when the rules cache is absent or
 *  the specific rule is not found. Any other feature keeps the existing
 *  fail-open behaviour so non-critical flows are not disrupted. */
export const CRITICAL_FEATURES: ReadonlySet<string> = new Set([
  "accept_ride",
  "accept_order",
  "withdraw_money",
]);

/** Custom window event dispatched whenever the feature-rules cache is written.
 *  useFeatureGate subscribes to this event so consumers re-render automatically
 *  when the cache is refreshed (login, background poll, admin status change). */
export const FEATURE_RULES_UPDATED_EVENT = "featureRulesUpdated" as const;

/** Custom window event dispatched whenever a local usage counter is incremented
 *  via recordUsage(). useFeatureGate subscribes so daily-limit gate results
 *  re-evaluate immediately after a successful action, preventing a stale
 *  accessible:true result from allowing extra attempts beyond the daily limit. */
export const FEATURE_USAGE_UPDATED_EVENT = "featureUsageUpdated" as const;

const CACHE_KEY_PREFIX = "featureRulesCache:";
const USAGE_KEY_PREFIX = "featureUsage:";

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export function featureRulesCacheKey(userId: string): string {
  return `${CACHE_KEY_PREFIX}${userId}`;
}

export function saveFeatureRulesCache(userId: string, rules: FeatureRule[]): void {
  try {
    localStorage.setItem(featureRulesCacheKey(userId), JSON.stringify(rules));
    /* Notify any useFeatureGate subscribers that the cache has been refreshed */
    window.dispatchEvent(new CustomEvent(FEATURE_RULES_UPDATED_EVENT));
  } catch (err) {
    log.warn({ err: err instanceof Error ? err.message : String(err) }, "[featureGate] saveFeatureRulesCache failed");
  }
}

export function loadFeatureRulesCache(userId: string): FeatureRule[] | null {
  try {
    const raw = localStorage.getItem(featureRulesCacheKey(userId));
    if (!raw) return null;
    return JSON.parse(raw) as FeatureRule[];
  } catch (err) {
    log.warn({ err: err instanceof Error ? err.message : String(err) }, "[featureGate] loadFeatureRulesCache failed");
    return null;
  }
}

export function clearFeatureRulesCache(userId: string): void {
  try {
    localStorage.removeItem(featureRulesCacheKey(userId));
  } catch {
    /* non-critical */
  }
}

function usageKey(userId: string, featureName: string): string {
  return `${USAGE_KEY_PREFIX}${userId}:${featureName}:${todayStr()}`;
}

function getLocalUsage(userId: string, featureName: string): number {
  try {
    const val = localStorage.getItem(usageKey(userId, featureName));
    return val ? parseInt(val, 10) : 0;
  } catch {
    return 0;
  }
}

export function recordUsage(userId: string, featureName: string): void {
  try {
    const key = usageKey(userId, featureName);
    const current = getLocalUsage(userId, featureName);
    localStorage.setItem(key, String(current + 1));
    /* Notify useFeatureGate subscribers so daily-limit results re-evaluate
     * immediately after a successful action — prevents stale accessible:true
     * from allowing attempts beyond the daily limit. */
    window.dispatchEvent(new CustomEvent(FEATURE_USAGE_UPDATED_EVENT));
  } catch (err) {
    log.warn({ err: err instanceof Error ? err.message : String(err) }, "[featureGate] recordUsage failed");
  }
}

export function checkGate(userId: string, featureName: string): GateResult {
  const rules = loadFeatureRulesCache(userId);

  if (!rules) {
    if (CRITICAL_FEATURES.has(featureName)) {
      return {
        allowed: false,
        reason: "not_accessible",
        fallbackMsg: "Checking your account status…",
        missingVerifications: [],
        used: 0,
        limit: 0,
        cacheWasEmpty: true,
      };
    }
    return { allowed: true, used: 0, limit: 0 };
  }

  const rule = rules.find((r) => r.featureName === featureName);
  if (!rule) {
    if (CRITICAL_FEATURES.has(featureName)) {
      return {
        allowed: false,
        reason: "not_accessible",
        fallbackMsg: "Checking your account status…",
        missingVerifications: [],
        used: 0,
        limit: 0,
        cacheWasEmpty: true,
      };
    }
    return { allowed: true, used: 0, limit: 0 };
  }

  if (!rule.accessible) {
    return {
      allowed: false,
      reason: "not_accessible",
      fallbackMsg: rule.fallbackMsg,
      missingVerifications: rule.missingVerifications,
      used: 0,
      limit: 0,
    };
  }

  const limit = rule.maxDailyLimit ?? 0;
  if (limit > 0) {
    const used = getLocalUsage(userId, featureName);
    if (used >= limit) {
      return {
        allowed: false,
        reason: "daily_limit_exceeded",
        fallbackMsg: rule.fallbackMsg ?? `You have reached your daily limit of ${limit} for this feature.`,
        missingVerifications: [],
        used,
        limit,
      };
    }
    return { allowed: true, used, limit };
  }

  return { allowed: true, used: 0, limit };
}
