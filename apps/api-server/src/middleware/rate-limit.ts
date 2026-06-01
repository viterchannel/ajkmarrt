/**
 * Tiered rate-limit middleware.
 *
 * All limiters are created through `createRateLimiter()` — a typed factory that:
 *   - Uses Redis sorted-set + Lua for true **sliding-window** counters when
 *     REDIS_URL is configured.  Each request is recorded as a scored member
 *     (score = Unix-ms timestamp) and members older than `windowMs` are pruned
 *     atomically in the same script, so the window rolls forward on every call.
 *   - Falls back to express-rate-limit's built-in **fixed-window** in-memory
 *     store when Redis is unavailable.  A startup warning is emitted so
 *     operators know to configure Redis in multi-instance deployments.
 *   - Returns JSON 429 responses with `retryAfter` (seconds), `code`, and
 *     `tier`-adjusted human-readable messages — never raw "Too many requests".
 *   - Accepts first-class `skipOnSuccess` — successful responses (HTTP < 400)
 *     do not consume quota; the sorted-set member is removed on `res.finish`.
 *   - Accepts a first-class `message` shape that overrides the default JSON 429
 *     body (merged with `retryAfter` so callers always get that field).
 *
 * Limits calibrated to professional ride-hailing / B2B delivery standards
 * (Uber, DoorDash, Careem level).  Authenticated per-user windows are generous
 * because mobile apps poll frequently; brute-force attack vectors (login,
 * password-reset, OTP) remain tighter on a per-phone / per-IP basis.
 *
 * Tiers:
 *   globalLimiter           2500 req / 15 min  — all /api traffic
 *   loginLimiter              30 req / 60 s  / IP            — POST /api/auth/login
 *   otpLimiter                10 req / 5 min / phone (or IP) — OTP send/verify
 *   userApiLimiter           600 req / 60 s  / authenticated user ID
 *   authLimiter             200 req / 15 min  — OTP / login / social-auth (legacy guard)
 *   adminAuthLimiter         30 req / 15 min  — admin login & password-reset
 *   paymentLimiter          200 req / 15 min  — wallet & payment routes
 *   publicLimiter           500 req / 15 min  — public scraping-prone endpoints
 *   redeemLimiter            50 req / 15 min / user — POST /api/loyalty/redeem
 *   exportDataLimiter        20 req / 15 min / user — POST /api/users/export-data
 *   registerUploadLimiter    50 req / 60 min / IP  — POST /api/uploads/register (unauthenticated)
 *   refreshTokenLimiter     300 req / 15 min / user — token refresh (mobile apps refresh often)
 *   uploadLimiter           100 req / 60 min / IP  — /api/uploads
 *   kycSubmitLimiter         15 req / 60 min / user — KYC document submission
 *   orderPlacementLimiter    80 req / 15 min / user — order creation
 *   healthCheckLimiter     5000 req / 15 min / IP  — mobile startup polling (skipOnSuccess)
 *   homeFeedLimiter        5000 req / 15 min / IP  — home screen feed polling (skipOnSuccess)
 */
import type { NextFunction, Request, RequestHandler, Response } from "express";
import rateLimit, { type Options } from "express-rate-limit";
import crypto from "node:crypto";
import { RedisStore } from "rate-limit-redis";
import { logger } from "../lib/logger.js";
import { redisClient } from "../lib/redis.js";

/* ── Lua sliding-window script ───────────────────────────────────────────────
 *
 * KEYS[1]  — sorted-set key for this limiter + client identity
 * ARGV[1]  — current Unix timestamp in milliseconds
 * ARGV[2]  — window size in milliseconds
 * ARGV[3]  — maximum allowed count within the window
 * ARGV[4]  — unique member ID for this request (UUID)
 * ARGV[5]  — "1" to record the request; "0" to only check (e.g. dry-run)
 *
 * Returns array: { allowed (0|1), retryAfterSeconds (integer), currentCount }
 */
const SLIDING_WINDOW_LUA = `
local key        = KEYS[1]
local now        = tonumber(ARGV[1])
local window_ms  = tonumber(ARGV[2])
local max_count  = tonumber(ARGV[3])
local member     = ARGV[4]
local do_add     = tonumber(ARGV[5])

-- Remove entries outside the rolling window
redis.call('ZREMRANGEBYSCORE', key, 0, now - window_ms)

local count = tonumber(redis.call('ZCARD', key))

if count >= max_count then
  -- Compute retry-after from the oldest surviving entry
  local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
  local retry_after = 1
  if oldest and #oldest >= 2 then
    local expires_at = tonumber(oldest[2]) + window_ms
    retry_after = math.ceil((expires_at - now) / 1000)
    if retry_after < 1 then retry_after = 1 end
  end
  return {0, retry_after, count}
end

if do_add == 1 then
  redis.call('ZADD', key, now, member)
  -- TTL slightly longer than the window so the key auto-expires after inactivity
  redis.call('PEXPIRE', key, window_ms + 5000)
end

return {1, 0, count + (do_add == 1 and 1 or 0)}
`;

/**
 * Options for the `createRateLimiter` factory.
 */
export interface RateLimiterOptions {
  /** Redis key namespace — must be unique per limiter to prevent counter collisions. */
  prefix: string;
  /** Maximum number of requests allowed within `windowMs`. */
  max: number;
  /** Sliding-window duration in milliseconds. */
  windowMs: number;
  /**
   * When `true`, successful responses (HTTP status < 400) do not consume quota.
   * The sorted-set member is removed from Redis on `res.finish` when the status
   * is below 400.  Defaults to `false`.
   */
  skipOnSuccess?: boolean;
  /**
   * Custom JSON body for 429 responses.  Merged with `{ retryAfter, code, tier }`
   * so the `retryAfter` field is always present even if you override `message`.
   */
  message?: Record<string, unknown>;
  /**
   * Controls the user-visible message in 429 responses (used when `message` is
   * not provided):
   * - "strict"   → "Too many attempts. Please wait before trying again."
   * - "standard" → "Too many requests. Please slow down."  (default)
   * - "lenient"  → "You're making requests too fast. Please wait a moment."
   */
  tier?: "strict" | "standard" | "lenient";
  /** Custom key generator. Defaults to client IP. */
  keyGenerator?: (req: Request) => string;
  /** Any additional express-rate-limit options used only in the in-memory fallback path. */
  extra?: Partial<Options>;
}

const TIER_MESSAGES: Record<NonNullable<RateLimiterOptions["tier"]>, string> = {
  strict: "Too many attempts. Please wait before trying again.",
  standard: "Too many requests. Please slow down.",
  lenient: "You're making requests too fast. Please wait a moment.",
};

/* ── IP helper (shared by key generators) ───────────────────────────────── */
const ipKey = (req: Request): string => req.ip || req.socket?.remoteAddress || "unknown";

const userOrIpKey = (req: Request): string => {
  const uid = req.userId ?? req.customerId ?? req.riderId ?? req.vendorId;
  return uid ? `user:${uid}` : ipKey(req);
};

/* ── Fallback: express-rate-limit in-memory fixed-window ─────────────────── */
function makeFallbackLimiter(options: RateLimiterOptions): RequestHandler {
  const { prefix, max, windowMs, tier = "standard", keyGenerator, extra, message } = options;

  if (process.env["MULTI_INSTANCE"] === "true") {
    logger.warn(
      { prefix },
      "[rate-limit] Redis unavailable in multi-instance mode — counters are per-instance and not shared across replicas"
    );
  }

  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req: Request, res: Response) => {
      const retryAfter = Math.ceil(windowMs / 1000);
      res.status(429).json({
        success: false,
        error: TIER_MESSAGES[tier],
        ...message,
        retryAfter,
        code: "RATE_LIMITED",
        tier,
      });
    },
    ...(keyGenerator ? { keyGenerator: (req: Request, _res: Response) => keyGenerator(req) } : {}),
    ...extra,
  });
}

/* ── Redis sliding-window middleware ────────────────────────────────────── */
function makeRedisSlidingLimiter(
  options: RateLimiterOptions,
  fallbackLimiter: RequestHandler
): RequestHandler {
  const {
    prefix,
    max,
    windowMs,
    tier = "standard",
    keyGenerator,
    skipOnSuccess = false,
    message,
  } = options;

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!redisClient) {
      await fallbackLimiter(req, res, next);
      return;
    }

    const clientKey = keyGenerator ? keyGenerator(req) : ipKey(req);
    const redisKey = `rl:${prefix}:${clientKey}`;
    const member = crypto.randomUUID();
    const now = Date.now();

    try {
      const result = (await (redisClient as import("ioredis").Redis).eval(
        SLIDING_WINDOW_LUA,
        1,
        redisKey,
        String(now),
        String(windowMs),
        String(max),
        member,
        "1"
      )) as [number, number, number];

      const allowed = result[0] === 1;
      const retryAfter = result[1] ?? Math.ceil(windowMs / 1000);
      const currentCount = result[2] ?? 0;

      /* Standard rate-limit headers */
      res.setHeader("RateLimit-Limit", String(max));
      res.setHeader("RateLimit-Remaining", String(Math.max(0, max - currentCount)));
      res.setHeader("RateLimit-Reset", String(Math.ceil((now + windowMs) / 1000)));

      if (!allowed) {
        res.setHeader("Retry-After", String(retryAfter));
        res.status(429).json({
          success: false,
          error: TIER_MESSAGES[tier],
          ...message,
          retryAfter,
          code: "RATE_LIMITED",
          tier,
        });
        return;
      }

      /* skipOnSuccess: remove the member if the response completes successfully */
      if (skipOnSuccess) {
        res.on("finish", () => {
          if (res.statusCode < 400 && redisClient) {
            (redisClient as import("ioredis").Redis)
              .zrem(redisKey, member)
              .catch((err: unknown) => {
                logger.warn({ prefix, err }, "[rate-limit] Failed to remove member on success");
              });
          }
        });
      }

      next();
    } catch (err) {
      /* Redis error — delegate to in-memory fallback instead of failing open */
      logger.error(
        { prefix, redisKey, err },
        "[rate-limit] Redis eval failed — using in-memory fallback"
      );
      await fallbackLimiter(req, res, next);
    }
  };
}

/**
 * Factory for all AJKMart rate limiters.
 *
 * When REDIS_URL is available, the returned middleware uses a Redis sorted-set
 * sliding-window (via Lua) so the counter rolls forward continuously rather than
 * resetting at a fixed boundary.  When Redis is unavailable it falls back to
 * express-rate-limit's in-memory fixed-window store.
 *
 * First-class options: `skipOnSuccess` (successful HTTP calls don't consume quota)
 * and `message` (custom JSON shape merged into every 429 body).
 *
 * @example
 * ```typescript
 * export const myLimiter = createRateLimiter({
 *   prefix: "my-endpoint",
 *   max: 5,
 *   windowMs: 60_000,
 *   tier: "strict",
 *   skipOnSuccess: true,
 *   keyGenerator: (req) => req.body?.email ?? ipKey(req),
 * });
 * ```
 */
export function createRateLimiter(options: RateLimiterOptions): RequestHandler {
  const { prefix, tier = "standard" } = options;

  if (redisClient) {
    logger.info(
      { prefix, store: "Redis (sliding-window)", tier },
      "[rate-limit] limiter configured"
    );
    const fallback = makeFallbackLimiter(options);
    return makeRedisSlidingLimiter(options, fallback);
  }

  logger.info(
    { prefix, store: "in-memory (fixed-window)", tier },
    "[rate-limit] limiter configured"
  );
  return makeFallbackLimiter(options);
}

/** @deprecated Use `createRateLimiter()` instead. */
function _makeOptions(
  prefix: string,
  max: number,
  windowMs: number,
  extra?: Partial<Options>
): Partial<Options> {
  return {
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    store: (() => {
      if (!redisClient) return undefined;
      try {
        return new RedisStore({
          prefix: `rl:${prefix}:`,
          sendCommand: (...args: string[]) => {
            if (!redisClient)
              return Promise.reject(
                new Error("[rate-limit] Redis client not available")
              ) as ReturnType<import("rate-limit-redis").SendCommandFn>;
            return (redisClient.call as (...a: string[]) => Promise<unknown>)(
              ...args
            ) as ReturnType<import("rate-limit-redis").SendCommandFn>;
          },
        });
      } catch {
        return undefined;
      }
    })(),
    handler: (_req: Request, res: Response) => {
      res.status(429).json({
        success: false,
        error: TIER_MESSAGES.standard,
        retryAfter: Math.ceil(windowMs / 1000),
        code: "RATE_LIMITED",
        tier: "standard",
      });
    },
    ...extra,
  };
}

const WINDOW_60_MIN = 60 * 60 * 1000;
const WINDOW_15_MIN = 15 * 60 * 1000;
const WINDOW_5_MIN  =  5 * 60 * 1000;
const WINDOW_1_MIN  = 60 * 1000;

/* ── Broad traffic limiters ──────────────────────────────────────────────── */

/** 2500 req / 15 min (5000 in non-production) — blanket guard for all /api traffic. */
export const globalLimiter = createRateLimiter({
  prefix: "global",
  max: process.env.NODE_ENV !== "production" ? 5000 : 2500,
  windowMs: WINDOW_15_MIN,
});

/** 200 req / 15 min — legacy guard for OTP/login/social-auth routes (use specific limiters where possible). */
export const authLimiter = createRateLimiter({ prefix: "auth", max: 200, windowMs: WINDOW_15_MIN });

/** 30 req / 15 min — admin login and password-reset (strict, security-critical). */
export const adminAuthLimiter = createRateLimiter({
  prefix: "admin-auth",
  max: process.env.NODE_ENV !== "production" ? 300 : 30,
  windowMs: WINDOW_15_MIN,
  tier: "strict",
});

/** 200 req / 15 min — wallet and payment routes. */
export const paymentLimiter = createRateLimiter({
  prefix: "payment",
  max: 200,
  windowMs: WINDOW_15_MIN,
});

/**
 * publicLimiter — 500 req / 15 min for public, scraping-prone endpoints.
 * Applied to banners, categories, products, promotions/public,
 * recommendations, public-vendors, and deep-links endpoints.
 */
export const publicLimiter = createRateLimiter({
  prefix: "public",
  max: 500,
  windowMs: WINDOW_15_MIN,
});

/* ── Auth-specific limiters (relaxed for real-world usage) ──────────────── */

/**
 * loginLimiter — 30 login attempts / 60 s / IP.
 * Generous enough for autofill retries and form re-submissions without
 * blocking legitimate users on shared IPs (offices, mobile networks).
 */
export const loginLimiter = createRateLimiter({
  prefix: "login",
  max: 30,
  windowMs: WINDOW_1_MIN,
  tier: "standard",
  keyGenerator: (req) => ipKey(req),
});

/**
 * otpLimiter — 10 OTP send/verify attempts / 5 min / phone (fallback to IP).
 * 5-minute sliding window per phone mirrors Careem/Uber OTP policy: users
 * can tap "Resend" a few times without being locked, but rapid automated
 * probing is still blocked.
 */
export const otpLimiter = createRateLimiter({
  prefix: "otp",
  max: 10,
  windowMs: WINDOW_5_MIN,
  tier: "standard",
  keyGenerator: (req) => {
    const phone = req.body?.phone ?? req.body?.identifier;
    if (phone && typeof phone === "string" && phone.length > 0) {
      return `phone:${(phone as string).replace(/\s/g, "")}`;
    }
    return ipKey(req);
  },
});

/**
 * emailOtpLimiter — 10 email OTP send/verify attempts / 5 min / email (fallback to IP).
 * Matches otpLimiter policy for consistency across auth channels.
 */
export const emailOtpLimiter = createRateLimiter({
  prefix: "email-otp",
  max: 10,
  windowMs: WINDOW_5_MIN,
  tier: "standard",
  keyGenerator: (req) => {
    const email = req.body?.email ?? req.body?.identifier;
    if (email && typeof email === "string" && (email as string).includes("@")) {
      return `email:${(email as string).toLowerCase().trim()}`;
    }
    return ipKey(req);
  },
});

/**
 * magicLinkLimiter — 15 magic link requests / 15 min / email (fallback to IP).
 * Slightly relaxed from default: user may request multiple links if the
 * first email was delayed.
 */
export const magicLinkLimiter = createRateLimiter({
  prefix: "magic-link",
  max: 15,
  windowMs: WINDOW_15_MIN,
  tier: "standard",
  keyGenerator: (req) => {
    const email = req.body?.email;
    if (email && typeof email === "string" && (email as string).includes("@")) {
      return `email:${(email as string).toLowerCase().trim()}`;
    }
    return ipKey(req);
  },
});

/**
 * registrationLimiter — 50 registration attempts / 60 min / IP.
 * Generous for onboarding events / QR-code campaigns where many users
 * register from the same venue WiFi.
 */
export const registrationLimiter = createRateLimiter({
  prefix: "registration",
  max: 50,
  windowMs: WINDOW_60_MIN,
  tier: "standard",
  keyGenerator: (req) => ipKey(req),
});

/**
 * refreshTokenLimiter — 300 token refresh requests / 15 min / userId (fallback to IP).
 * Mobile apps (Rider, Vendor) refresh silently in the background; a generous
 * window prevents false 429s on app foreground/resume cycles.
 */
export const refreshTokenLimiter = createRateLimiter({
  prefix: "refresh-token",
  max: 300,
  windowMs: WINDOW_15_MIN,
  tier: "lenient",
  keyGenerator: (req) => userOrIpKey(req),
});

/**
 * passwordResetLimiter — 15 password reset requests / 60 min / IP.
 * Security-critical; kept conservative to prevent account enumeration.
 */
export const passwordResetLimiter = createRateLimiter({
  prefix: "password-reset",
  max: 15,
  windowMs: WINDOW_60_MIN,
  tier: "standard",
  keyGenerator: (req) => ipKey(req),
});

/**
 * redeemLimiter — 50 redemptions / 15 min / authenticated user ID (fallback to IP).
 */
export const redeemLimiter = createRateLimiter({
  prefix: "redeem",
  max: 50,
  windowMs: WINDOW_15_MIN,
  tier: "standard",
  keyGenerator: (req) => userOrIpKey(req),
});

/**
 * exportDataLimiter — 20 exports / 15 min / authenticated user ID (fallback to IP).
 * Apply to POST /api/users/export-data to prevent bulk personal data extraction.
 */
export const exportDataLimiter = createRateLimiter({
  prefix: "export-data",
  max: 20,
  windowMs: WINDOW_15_MIN,
  tier: "standard",
  keyGenerator: (req) => userOrIpKey(req),
});

/**
 * registerUploadLimiter — 50 uploads / 60 min / IP.
 * Apply to POST /api/uploads/register (unauthenticated pre-signup document upload).
 * Prevents storage/bandwidth exhaustion by anonymous callers.
 */
export const registerUploadLimiter = createRateLimiter({
  prefix: "register-upload",
  max: 50,
  windowMs: WINDOW_60_MIN,
  tier: "standard",
  keyGenerator: (req) => ipKey(req),
});

/**
 * userApiLimiter — 600 requests / 60 s / authenticated user ID (fallback to IP).
 * Calibrated for active riders / vendors whose apps issue background sync
 * calls (location, order-status, notification polling) at ~5–10 req/s.
 */
export const userApiLimiter = createRateLimiter({
  prefix: "user-api",
  max: 600,
  windowMs: WINDOW_1_MIN,
  tier: "lenient",
  keyGenerator: (req) => userOrIpKey(req),
  extra: { skip: (req: Request) => req.method === "OPTIONS" },
});

/**
 * uploadLimiter — 100 uploads / 60 min / IP.
 * Applied globally to /api/uploads to prevent storage and bandwidth abuse.
 */
export const uploadLimiter = createRateLimiter({
  prefix: "upload",
  max: 100,
  windowMs: WINDOW_60_MIN,
  tier: "standard",
  keyGenerator: (req) => ipKey(req),
  message: { success: false, error: "Upload limit reached. Try again in 1 hour." },
});

/**
 * kycSubmitLimiter — 15 KYC submissions / 60 min / authenticated user ID (fallback to IP).
 * Relaxed from 10 so riders who need to re-photograph blurry documents
 * (common in low-light) are not locked out during onboarding.
 */
export const kycSubmitLimiter = createRateLimiter({
  prefix: "kyc-submit",
  max: 15,
  windowMs: WINDOW_60_MIN,
  tier: "standard",
  keyGenerator: (req) => userOrIpKey(req),
  message: { success: false, error: "Too many KYC submissions. Please wait before trying again." },
});

/**
 * orderPlacementLimiter — 80 orders / 15 min / authenticated user ID (fallback to IP).
 * Higher ceiling for vendor bulk-order scenarios and B2B clients.
 */
export const orderPlacementLimiter = createRateLimiter({
  prefix: "order-place",
  max: 80,
  windowMs: WINDOW_15_MIN,
  tier: "standard",
  keyGenerator: (req) => userOrIpKey(req),
  message: { success: false, error: "Too many orders placed. Please wait a few minutes and try again." },
});

/**
 * adminActionLimiter — 500 requests / 10 min / admin ID (fallback to IP).
 * Supports bulk admin operations (batch payout runs, mass approval queues).
 */
export const adminActionLimiter = createRateLimiter({
  prefix: "admin-action",
  max: 500,
  windowMs: 10 * 60 * 1000,
  tier: "standard",
  keyGenerator: (req) => (req as Request & { adminId?: string }).adminId ?? ipKey(req),
  message: { success: false, error: "Admin action rate limit exceeded." },
});

/**
 * healthCheckLimiter — 5000 req / 15 min / IP with skipOnSuccess.
 * Mobile apps poll /api/health every ~30 s on startup + connectivity checks;
 * successful pings do not consume quota so normal polling never triggers 429.
 */
export const healthCheckLimiter = createRateLimiter({
  prefix: "health-check",
  max: process.env.NODE_ENV !== "production" ? 5000 : 5000,
  windowMs: WINDOW_15_MIN,
  skipOnSuccess: true,
  tier: "lenient",
});

/**
 * homeFeedLimiter — 5000 req / 15 min / IP with skipOnSuccess.
 * Applied to high-frequency home-screen polling:
 *   GET /api/recommendations/trending
 *   GET /api/products/flash-deals
 * Successful feed loads do not consume quota; the ceiling blocks only
 * abusive scrapers that loop tight requests.
 */
export const homeFeedLimiter = createRateLimiter({
  prefix: "home-feed",
  max: process.env.NODE_ENV !== "production" ? 5000 : 5000,
  windowMs: WINDOW_15_MIN,
  skipOnSuccess: true,
  tier: "lenient",
});
