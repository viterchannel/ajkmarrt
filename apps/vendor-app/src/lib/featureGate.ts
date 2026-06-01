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
}

const CACHE_KEY_PREFIX = "vendor_featureRulesCache:";
const USAGE_KEY_PREFIX = "vendor_featureUsage:";

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export function featureRulesCacheKey(userId: string): string {
  return `${CACHE_KEY_PREFIX}${userId}`;
}

export function saveFeatureRulesCache(userId: string, rules: FeatureRule[]): void {
  try {
    localStorage.setItem(featureRulesCacheKey(userId), JSON.stringify(rules));
  } catch {
  }
}

export function loadFeatureRulesCache(userId: string): FeatureRule[] | null {
  try {
    const raw = localStorage.getItem(featureRulesCacheKey(userId));
    if (!raw) return null;
    return JSON.parse(raw) as FeatureRule[];
  } catch {
    return null;
  }
}

export function clearFeatureRulesCache(userId: string): void {
  try {
    localStorage.removeItem(featureRulesCacheKey(userId));
  } catch {
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
  } catch {
  }
}

export function checkGate(userId: string, featureName: string): GateResult {
  const rules = loadFeatureRulesCache(userId);

  if (!rules) {
    return { allowed: true, used: 0, limit: 0 };
  }

  const rule = rules.find((r) => r.featureName === featureName);
  if (!rule) {
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
        fallbackMsg:
          rule.fallbackMsg ??
          `You have reached your daily limit of ${limit} for this feature.`,
        missingVerifications: [],
        used,
        limit,
      };
    }
    return { allowed: true, used, limit };
  }

  return { allowed: true, used: 0, limit };
}
