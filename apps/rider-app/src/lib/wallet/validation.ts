export interface PromoCode {
  id: string;
  expiresAt?: string | null;
  usageCount?: number;
  maxUsage?: number | null;
  perUserUsage?: number;
  maxPerUserUsage?: number | null;
}

export interface DailyLimitsConfig {
  maxDailyWithdrawal: number;
  maxDailyTransactionCount: number;
}

export interface WalletValidationResult {
  valid: boolean;
  reason: string;
}

export function checkSufficientBalance(balance: number, amount: number): WalletValidationResult {
  if (amount <= 0) {
    return { valid: false, reason: "validationAmountPositive" };
  }
  if (balance - amount < 0) {
    return { valid: false, reason: "validationInsufficientBalance" };
  }
  return { valid: true, reason: "ok" };
}

export function checkPromoStackable(activePromos: PromoCode[]): WalletValidationResult {
  /* Allows exactly one promo. Rejects when more than one is already applied,
     preventing silent double-stacking. Callers pass the full set of promos
     including the one being added — length > 1 means stacking is occurring. */
  if (activePromos.length > 1) {
    return { valid: false, reason: "validationOnePromoOnly" };
  }
  return { valid: true, reason: "ok" };
}

export function validatePromo(
  promo: PromoCode,
  _userId: string,
  now: Date = new Date()
): WalletValidationResult {
  if (promo.expiresAt) {
    const expiry = new Date(promo.expiresAt);
    if (isNaN(expiry.getTime())) {
      return { valid: false, reason: "validationPromoInvalid" };
    }
    if (expiry < now) {
      return { valid: false, reason: "validationPromoExpired" };
    }
  }

  if (typeof promo.maxUsage === "number" && promo.maxUsage != null) {
    const usageCount = promo.usageCount ?? 0;
    if (usageCount >= promo.maxUsage) {
      return { valid: false, reason: "validationPromoLimitReached" };
    }
  }

  if (typeof promo.maxPerUserUsage === "number" && promo.maxPerUserUsage != null) {
    const perUser = promo.perUserUsage ?? 0;
    if (perUser >= promo.maxPerUserUsage) {
      return { valid: false, reason: "validationPromoPerUserLimit" };
    }
  }

  return { valid: true, reason: "ok" };
}

export function checkDailyLimits(
  todayTotal: number,
  todayCount: number,
  amount: number,
  config: DailyLimitsConfig
): WalletValidationResult {
  if (todayTotal + amount > config.maxDailyWithdrawal) {
    return { valid: false, reason: "validationDailyLimitExceeded" };
  }
  if (todayCount + 1 > config.maxDailyTransactionCount) {
    return { valid: false, reason: "validationDailyCountExceeded" };
  }
  return { valid: true, reason: "ok" };
}
