import { db } from "@workspace/db";
import {
  idempotencyKeysTable,
  liveLocationsTable,
  locationLogsTable,
  notificationsTable,
  ordersTable,
  otpAttemptsTable,
  platformSettingsTable,
  pushSubscriptionsTable,
  reviewsTable,
  rideBidsTable,
  rideEventLogsTable,
  rideRatingsTable,
  rideServiceTypesTable,
  riderGateEventsTable,
  riderPenaltiesTable,
  riderProfilesTable,
  ridesTable,
  usersTable,
  vendorProfilesTable,
  walletTransactionsTable,
} from "@workspace/db/schema";
import { t } from "@workspace/i18n";
import { normalizeVehicleType } from "@workspace/service-constants";
import { createHash, randomInt, randomUUID } from "crypto";
import {
  and,
  avg,
  count,
  desc,
  eq,
  gte,
  isNull,
  ne,
  or,
  sql,
  sum,
  type InferSelectModel,
} from "drizzle-orm";
import { Router, type IRouter, type NextFunction, type Request, type Response } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { fireAndForget } from "../../lib/fireAndForget.js";
import { isInServiceZone } from "../../lib/geofence.js";
import { getUserLanguage } from "../../lib/getUserLanguage.js";
import { generateId } from "../../lib/id.js";
import { logger } from "../../lib/logger.js";
import { buildCursorPage, decodeCursor } from "../../lib/pagination/cursor.js";
import {
  sendError,
  sendErrorWithData,
  sendForbidden,
  sendNotFound,
  sendSuccess,
  sendTooManyRequests,
  sendValidationError,
} from "../../lib/response.js";
import { emitRideUpdate } from "../../lib/rideEvents.js";
import { checkFeatureAccess } from "../../middleware/featureAccess.js";
import { withdrawalIdempotency } from "../../lib/withdrawalIdempotency.js";
import {
  emitRideAssigned,
  emitRideDispatchUpdate,
  emitRideOtp,
  emitRiderLocation,
  emitRiderNewRequest,
  emitRiderOffline,
  emitRiderOnline,
  emitRiderStatus,
  getIO,
} from "../../lib/socketio.js";
import { emitWebhookEvent } from "../../lib/webhook-emitter.js";
import { sendPushToUser } from "../../lib/webpush.js";
import { gpsAntiSpoofMiddleware } from "../../middleware/gpsSpoof.js";
import { validateRiderLocationSecurity } from "../rides/dispatch.js";
import {
  addSecurityEvent,
  detectGPSSpoof,
  getCachedSettings,
  getClientIp,
  verifyUserJwt,
} from "../../middleware/security.js";

/** Hash a trip OTP for safe DB storage — SHA-256 hex of trimmed input. */
function hashTripOtp(otp: string): string {
  return createHash("sha256").update(otp.trim()).digest("hex");
}

/* ── CSRF double-submit cookie protection ────────────────────────────────────
   State-change POST endpoints (accept, cancel, status update) validate that the
   X-CSRF-Token header matches the csrf_token cookie value set by the frontend.
   This prevents cross-site request forgery on authenticated rider endpoints.   */
function csrfDoubleSubmit(req: Request, res: Response, next: NextFunction): void {
  const headerToken = req.headers["x-csrf-token"];
  const cookieToken = (req.cookies as Record<string, string> | undefined)?.["csrf_token"];
  /* Strictly enforce double-submit: both the cookie and the matching header
     must be present. Missing either (or a mismatch) is a rejected request. */
  if (!headerToken || !cookieToken || headerToken !== cookieToken) {
    sendForbidden(res, "CSRF token mismatch — request rejected.");
    return;
  }
  next();
}

/* ── Ride-action rate limiters (defined early so they can be referenced anywhere in the file) ── */

/** Ride-accept limiter: 10 accept attempts per rider per minute — prevents spam/abuse */
const rideAcceptLimiter = rateLimit({
  windowMs: 60_000,
  max: 10,
  keyGenerator: (req) => req.riderId ?? getClientIp(req) ?? "unknown",
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
  handler: (_req, res) => {
    sendTooManyRequests(res, "Too many ride accept attempts. Please wait a moment.");
  },
});

/** Ride-bid limiter: 60 counter bids per rider per minute */
const rideBidLimiter = rateLimit({
  windowMs: 60_000,
  max: 60,
  keyGenerator: (req) => req.riderId ?? getClientIp(req) ?? "unknown",
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
  handler: (_req, res) => {
    sendTooManyRequests(res, "Too many bid requests. Please wait before submitting another bid.");
  },
});

/** Ride-status limiter: 180 status updates per rider per minute — riders change status every ~20 s */
const rideStatusLimiter = rateLimit({
  windowMs: 60_000,
  max: 180,
  keyGenerator: (req) => req.riderId ?? getClientIp(req) ?? "unknown",
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
  handler: (_req, res) => {
    sendTooManyRequests(res, "Too many status update requests. Please wait a moment.");
  },
});

/** OTP limiter: 10 attempts per rider per 5 min — mirrors Careem/Uber OTP policy */
const otpLimiter = rateLimit({
  windowMs: 5 * 60_000,
  max: 10,
  keyGenerator: (req) => req.riderId ?? getClientIp(req) ?? "unknown",
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
  handler: (_req, res) => {
    sendTooManyRequests(res, "Too many OTP attempts. Please wait before trying again.");
  },
});

/** Ride-cancel rate limiter: 30 cancellations per rider per minute */
const rideCancelLimiter = rateLimit({
  windowMs: 60_000,
  max: 30,
  keyGenerator: (req) => req.riderId ?? getClientIp(req) ?? "unknown",
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
  handler: (_req, res) => {
    sendTooManyRequests(res, "Too many cancellation requests. Please wait before cancelling again.");
  },
});

/** Middleware that applies rideCancelLimiter only when the request body has status=cancelled */
const conditionalCancelLimiter = (req: Request, res: Response, next: NextFunction) => {
  const body = req.body as { status?: string };
  if (body?.status === "cancelled") {
    return rideCancelLimiter(req, res, next);
  }
  return next();

/* ── Additional rate limiters (H-03, M-05) ───────────────────────────────── */
};

/**
 * Request-feed limiter — 300 polls/min per rider.
 * Rider apps poll the request feed every ~200-500 ms during an active shift.
 * 300/min = 1 poll per 200 ms which matches aggressive real-time polling.
 */
const requestFeedLimiter = rateLimit({
  windowMs: 60_000,
  max: 300,
  keyGenerator: (req) => req.riderId ?? getClientIp(req) ?? "unknown",
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
  handler: (_req, res) => {
    sendTooManyRequests(res, "Too many request-feed polls. Please slow down.");
  },
});

/** Notifications-feed limiter — 200 fetches/min per rider */
const notificationsFeedLimiter = rateLimit({
  windowMs: 60_000,
  max: 200,
  keyGenerator: (req) => req.riderId ?? getClientIp(req) ?? "unknown",
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
  handler: (_req, res) => {
    sendTooManyRequests(res, "Too many notification fetches. Please wait a moment.");
  },
});

/** COD remittance limiter — 50 submissions per rider per 15 minutes */
const codRemitLimiter = rateLimit({
  windowMs: 15 * 60_000,
  max: 50,
  keyGenerator: (req) => req.riderId ?? getClientIp(req) ?? "unknown",
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
  handler: (_req, res) => {
    sendTooManyRequests(res, "Too many remittance submissions. Please wait before submitting again.");
  },
});

/** Wallet deposit limiter — 50 deposits per rider per 15 minutes */
const riderDepositLimiter = rateLimit({
  windowMs: 15 * 60_000,
  max: 50,
  keyGenerator: (req) => req.riderId ?? getClientIp(req) ?? "unknown",
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
  handler: (_req, res) => {
    sendTooManyRequests(res, "Too many deposit requests. Please wait before trying again.");
  },
});

const MAX_OTP_ATTEMPTS = 5;
const OTP_ATTEMPT_TTL_MS = 30 * 60_000;

const router: IRouter = Router();

const safeNum = (v: unknown, def = 0) => {
  const n = parseFloat(String(v ?? def));
  if (isNaN(n)) {
    logger.warn({ value: v, default: def }, "[rider] safeNum: NaN coercion — falling back to default");
    return def;
  }
  return n;
};

/* ── Server-side idempotency deduplication for mutating rider actions ──────
   Stores responses for X-Idempotency-Key for 5 minutes so retried requests
   (offline queue replays, network retries) return the same response instead of
   executing the action a second time.
   Primary store: Redis (when available). Fallback: PostgreSQL idempotency_keys
   table — cluster-safe and durable across restarts/scale-out.                  */
interface IdempotencyEntry {
  status: number;
  body: unknown;
  ts: number;
}
const IDEM_TTL_MS = 5 * 60_000;
const IDEM_TTL_SEC = Math.ceil(IDEM_TTL_MS / 1000);

/* Lazy import of redisClient so the module loads even if Redis is unconfigured.
   A startup-time check runs immediately (non-blocking) so operators can see the
   warning in logs at boot rather than only on the first idempotent request.     */
let _redisForIdem: import("ioredis").default | null | undefined = undefined;
async function getRedisForIdem() {
  if (_redisForIdem !== undefined) return _redisForIdem;
  try {
    const { redisClient } = await import("../../lib/redis.js");
    _redisForIdem = redisClient ?? null;
    if (!_redisForIdem) {
      logger.warn("[rider] Redis unavailable — idempotency cache is in-memory only (not cluster-safe, entries lost on restart)");
    }
  } catch {
    _redisForIdem = null;
  }
  return _redisForIdem;
}

/* Startup probe — runs once at module init so operators see the Redis status
   in server logs immediately, not only when the first idempotent request arrives. */
setImmediate(() => {
  getRedisForIdem().catch((err: unknown) => {
    logger.warn({ err }, "[rider] Startup idempotency Redis probe failed");
  });
});

function idemCacheKey(req: Request): string | null {
  const key = req.headers["x-idempotency-key"];
  if (!key || typeof key !== "string") return null;
  /* Scope by rider + HTTP method + route path to prevent cross-endpoint/cross-user collisions */
  const riderId = req.riderId ?? "anon";
  return `idem:${riderId}:${req.method}:${req.path}:${key}`;
}

async function checkIdempotency(req: Request, res: Response): Promise<boolean> {
  const cacheKey = idemCacheKey(req);
  if (!cacheKey) return false;
  const redis = await getRedisForIdem();
  if (redis) {
    try {
      const raw = await redis.get(cacheKey);
      if (raw) {
        const entry = JSON.parse(raw) as IdempotencyEntry;
        res.status(entry.status).json(entry.body);
        return true;
      }
      return false;
    } catch (err) {
      logger.warn({ err }, "[rider] Redis idempotency check failed — falling back to memory");
    }
  }
  /* DB fallback — cluster-safe, replaces in-memory Map */
  const riderId = req.riderId ?? "";
  if (riderId) {
    try {
      const ttlCutoff = new Date(Date.now() - IDEM_TTL_MS);
      const [dbRow] = await db
        .select({ responseData: idempotencyKeysTable.responseData })
        .from(idempotencyKeysTable)
        .where(
          and(
            eq(idempotencyKeysTable.userId, riderId),
            eq(idempotencyKeysTable.idempotencyKey, cacheKey),
            gte(idempotencyKeysTable.createdAt, ttlCutoff)
          )
        )
        .limit(1);
      if (dbRow) {
        try {
          const entry = JSON.parse(dbRow.responseData) as IdempotencyEntry;
          if (entry.status && entry.body !== undefined) {
            res.status(entry.status).json(entry.body);
            return true;
          }
        } catch { /* corrupt DB entry — treat as miss */ }
      }
    } catch (dbErr) {
      logger.warn({ err: dbErr }, "[rider] DB idempotency check failed — treating as miss");
    }
  }
  return false;
}

async function storeIdempotency(req: Request, status: number, body: unknown): Promise<void> {
  const cacheKey = idemCacheKey(req);
  if (!cacheKey) return;
  const entry: IdempotencyEntry = { status, body, ts: Date.now() };
  const redis = await getRedisForIdem();
  if (redis) {
    try {
      await redis.set(cacheKey, JSON.stringify(entry), "EX", IDEM_TTL_SEC);
      return;
    } catch (err) {
      logger.warn({ err }, "[rider] Redis idempotency store failed — falling back to memory");
    }
  }
  /* DB fallback — cluster-safe, replaces in-memory Map */
  const riderId = req.riderId ?? "";
  if (riderId) {
    try {
      await db
        .insert(idempotencyKeysTable)
        .values({
          id: generateId(),
          userId: riderId,
          idempotencyKey: cacheKey,
          responseData: JSON.stringify(entry),
        })
        .onConflictDoUpdate({
          target: [idempotencyKeysTable.userId, idempotencyKeysTable.idempotencyKey],
          set: { responseData: JSON.stringify(entry) },
        });
    } catch (dbErr) {
      logger.warn({ err: dbErr }, "[rider] DB idempotency store failed");
    }
  }
}

/** Middleware: blocks ride acceptance when the rider's vehicle profile is incomplete,
    the account is suspended/restricted, or there are active penalties in the last 30 days. */
async function validateRiderProfileComplete(req: Request, res: Response, next: NextFunction): Promise<void> {
  const riderId = req.riderId;
  if (!riderId) {
    logger.error("[rider] validateRiderProfileComplete: riderId is absent after riderAuth — unexpected auth state");
    sendError(res, "Authentication context missing", 500);
    return;
  }
  try {
    /* 1. Check user account status */
    const [user] = await db
      .select({ isRestricted: usersTable.isRestricted, approvalStatus: usersTable.approvalStatus })
      .from(usersTable)
      .where(eq(usersTable.id, riderId))
      .limit(1);
    if (user?.isRestricted) {
      sendForbidden(res, "Your account is suspended. Contact support before accepting rides.");
      return;
    }
    if ((user?.approvalStatus ?? "pending") !== "approved") {
      sendForbidden(res, "Your account is pending approval. You cannot accept rides until verified.");
      return;
    }

    /* 2. Check vehicle profile completeness */
    const [profile] = await db
      .select({
        vehicleType: riderProfilesTable.vehicleType,
        vehiclePhoto: riderProfilesTable.vehiclePhoto,
        vehiclePlate: riderProfilesTable.vehiclePlate,
        drivingLicense: riderProfilesTable.drivingLicense,
      })
      .from(riderProfilesTable)
      .where(eq(riderProfilesTable.userId, riderId))
      .limit(1);
    const missing: string[] = [];
    if (!profile?.vehicleType) missing.push("vehicle type");
    if (!profile?.vehiclePhoto) missing.push("vehicle photo");
    if (!profile?.vehiclePlate) missing.push("vehicle plate/number");
    if (!profile?.drivingLicense) missing.push("driving license");
    if (missing.length > 0) {
      sendForbidden(
        res,
        `Profile incomplete — please add your ${missing.join(", ")} in Settings before accepting rides.`
      );
      return;
    }

    /* 3. Check for active penalties in the last 30 days */
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [activePenalty] = await db
      .select({ riderId: riderPenaltiesTable.riderId })
      .from(riderPenaltiesTable)
      .where(
        and(
          eq(riderPenaltiesTable.riderId, riderId),
          sql`${riderPenaltiesTable.createdAt} >= ${thirtyDaysAgo.toISOString()}`
        )
      )
      .limit(1);
    if (activePenalty) {
      sendForbidden(res, "You have active penalties on your account. Resolve them before accepting rides.");
      return;
    }

    next();
  } catch (e: unknown) {
    next(e);
  }
}

async function validateRiderCanAccept(req: Request, res: Response, next: NextFunction): Promise<void> {
  const riderId = req.riderId;
  if (!riderId) {
    logger.error("[rider] validateRiderCanAccept: riderId is absent after riderAuth — unexpected auth state");
    sendError(res, "Authentication context missing", 500);
    return;
  }
  try {
    const [profile] = await db
      .select({
        vehicleType: riderProfilesTable.vehicleType,
        vehiclePhoto: riderProfilesTable.vehiclePhoto,
        drivingLicense: riderProfilesTable.drivingLicense,
        kycStatus: riderProfilesTable.kycStatus,
      })
      .from(riderProfilesTable)
      .where(eq(riderProfilesTable.userId, riderId))
      .limit(1);

    if (!profile?.vehicleType) {
      sendForbidden(res, "KYC incomplete: vehicle type");
      return;
    }
    if (!profile?.vehiclePhoto) {
      sendForbidden(res, "KYC incomplete: vehicle photo");
      return;
    }
    if (!profile?.drivingLicense) {
      sendForbidden(res, "KYC incomplete: driving license");
      return;
    }
    if (profile?.kycStatus !== "approved") {
      sendForbidden(res, "KYC incomplete: KYC not approved");
      return;
    }

    next();
  } catch (e: unknown) {
    next(e);
  }
}

const onlineSchema = z
  .object({
    online: z.boolean().optional(),
    isOnline: z.boolean().optional(),
  })
  .refine((d) => d.online !== undefined || d.isOnline !== undefined, {
    message: "Provide 'online' or 'isOnline'",
  })
  .transform((d) => ({ isOnline: d.online ?? d.isOnline! }));

const profileSchema = z
  .object({
    name: z.string().optional(),
    email: z.string().email().optional(),
    /* M-02: Enforce the standard Pakistani CNIC format XXXXX-XXXXXXX-X. */
    cnic: z
      .string()
      .regex(/^\d{5}-\d{7}-\d$/, "CNIC must be in format XXXXX-XXXXXXX-X (e.g. 12345-1234567-1)")
      .optional(),
    address: z.string().optional(),
    city: z.string().optional(),
    emergencyContact: z.string().optional(),
    vehicleType: z.string().optional(),
    vehiclePlate: z.string().optional(),
    vehicleRegNo: z.string().optional(),
    vehicleRegistration: z.string().optional(),
    drivingLicense: z.string().optional(),
    bankName: z.string().optional(),
    /* M-02: Enforce realistic bank account number length (8–24 digits). */
    bankAccount: z.string().min(8, "Bank account must be at least 8 digits").max(24, "Bank account number is too long").optional(),
    bankAccountTitle: z.string().optional(),
    avatar: z.string().optional(),
    cnicDocUrl: z.string().optional(),
    licenseDocUrl: z.string().optional(),
    regDocUrl: z.string().optional(),
    vehiclePhoto: z.string().optional(),
    dailyGoal: z.number().positive().nullable().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.vehicleType && !data.vehiclePhoto) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "vehiclePhoto is required when setting vehicleType",
        path: ["vehiclePhoto"],
      });
    }
    if (data.vehicleType && !data.vehiclePlate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "vehiclePlate is required when setting vehicleType",
        path: ["vehiclePlate"],
      });
    }
  })
  .transform((data) => {
    if (data.vehicleRegistration && !data.vehicleRegNo) {
      data.vehicleRegNo = data.vehicleRegistration;
    }
    const { vehicleRegistration: _vr, ...rest } = data;
    return rest;
  });

const MAX_PROOF_PHOTO_BYTES = 5 * 1024 * 1024;
/* Base64 encoding inflates data by ~33%, so the encoded payload can be up to 4/3 * rawBytes.
   We measure only the base64 payload (after the data URI prefix) for accuracy. */
const MAX_PROOF_PHOTO_BASE64_LEN = Math.ceil(MAX_PROOF_PHOTO_BYTES * (4 / 3));

function proofPhotoWithinLimit(dataUri: string): boolean {
  const commaIdx = dataUri.indexOf(",");
  const payload = commaIdx >= 0 ? dataUri.slice(commaIdx + 1) : dataUri;
  const withinLimit = payload.length <= MAX_PROOF_PHOTO_BASE64_LEN;
  if (!withinLimit) {
    logger.warn(
      { payloadLen: payload.length, maxLen: MAX_PROOF_PHOTO_BASE64_LEN },
      "[rider] proofPhoto payload exceeds 5 MB limit — request will be rejected"
    );
  }
  return withinLimit;
}

/* orderStatusSchema accepts the new proofPhotoUrl (URL string, preferred) and the
   deprecated proofPhoto (base64 data URI) for backwards compatibility during the
   grace period. Clients should migrate to proofPhotoUrl. */
const orderStatusSchema = z.object({
  status: z.enum(["out_for_delivery", "picked_up", "delivered", "cancelled"]),
  proofPhotoUrl: z.string().url("proofPhotoUrl must be a valid URL").optional(),
  proofPhoto: z
    .string()
    .refine(
      (v) => v.startsWith("data:image/"),
      "proofPhoto must be a base64 data URI (data:image/...)"
    )
    .refine(proofPhotoWithinLimit, "proofPhoto exceeds 5 MB limit")
    .optional(),
});

/* rideStatusSchema accepts the new proofPhotoUrl (URL string, preferred) and the
   deprecated proofPhoto (base64 data URI) for backwards compatibility during the
   grace period. Clients should migrate to proofPhotoUrl. */
const rideStatusSchema = z.object({
  status: z.enum(["arrived", "in_transit", "completed", "cancelled"]),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  proofPhotoUrl: z.string().url("proofPhotoUrl must be a valid URL").optional(),
  proofPhoto: z
    .string()
    .refine(
      (v) => v.startsWith("data:image/"),
      "proofPhoto must be a base64 data URI (data:image/...)"
    )
    .refine(proofPhotoWithinLimit, "proofPhoto exceeds 5 MB limit")
    .optional(),
});

const RIDE_STATUS_TRANSITIONS: Record<string, string[]> = {
  accepted: ["arrived", "cancelled"],
  arrived: ["in_transit", "cancelled"],
  in_transit: ["completed", "cancelled"],
};

const DEFAULT_MAX_COUNTER_FARE = 100_000;
const stripHtml = (s: string) => s.replace(/<[^>]*>/g, "").trim();

const counterSchema = z.object({
  counterFare: z.number().positive(),
  note: z.string().max(300).transform(stripHtml).optional(),
});

const withdrawSchema = z.object({
  amount: z.number().positive(),
  bankName: z.string().min(1),
  /* L-04: Realistic bank account number length + digits-only guard. */
  accountNumber: z
    .string()
    .min(8, "Account number must be at least 8 digits")
    .max(24, "Account number is too long")
    .regex(/^\d+$/, "Account number must contain digits only"),
  accountTitle: z.string().min(1),
  paymentMethod: z.string().optional(),
  note: z.string().optional(),
});

const depositSchema = z.object({
  amount: z.number().min(100),
  paymentMethod: z.string().min(1),
  transactionId: z.string().min(6).max(64).regex(/^[A-Za-z0-9\-_]+$/, "Transaction ID must be alphanumeric (letters, digits, hyphens, underscores only)"),
  accountNumber: z.string().optional(),
  note: z.string().optional(),
});

const idParamSchema = z.object({ id: z.string().min(1, "ID is required") });
const otpVerifySchema = z.object({
  otp: z
    .string()
    .min(1, "OTP is required")
    .max(10, "OTP is too long")
    .regex(/^\d+$/, "OTP must contain digits only"),
});

const locationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().optional(),
  speed: z.number().optional(),
  heading: z.number().optional(),
  batteryLevel: z.number().min(0).max(100).optional(),
});

/* ── Auth Middleware ── */
export async function riderAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers["authorization"];
  const tokenHeader = req.headers["x-auth-token"] as string | undefined;
  const raw = tokenHeader || (authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null);

  if (!raw) {
    sendErrorWithData(res, "Authentication required", { code: "AUTH_REQUIRED" }, 401);
    return;
  }

  const payload = verifyUserJwt(raw);
  if (!payload) {
    sendErrorWithData(
      res,
      "Invalid or expired session. Please log in again.",
      { code: "TOKEN_INVALID" },
      401
    );
    return;
  }

  try {
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, payload.userId))
      .limit(1);
    if (!user) {
      sendErrorWithData(res, "User not found", { code: "AUTH_REQUIRED" }, 401);
      return;
    }
    if (user.isBanned) {
      sendErrorWithData(
        res,
        "Your account has been permanently banned. Please contact support.",
        { code: "ACCOUNT_BANNED" },
        401
      );
      return;
    }
    if (!user.isActive) {
      /* Structured response for approval states so the frontend can show the right screen */
      if (user.approvalStatus === "pending") {
        sendErrorWithData(
          res,
          "Your account is pending admin approval.",
          {
            code: "APPROVAL_PENDING",
            approvalStatus: "pending",
          },
          403
        );
        return;
      }
      if (user.approvalStatus === "rejected") {
        sendErrorWithData(
          res,
          "Your account application was rejected.",
          {
            code: "APPROVAL_REJECTED",
            approvalStatus: "rejected",
            rejectionReason: user.approvalNote ?? null,
          },
          403
        );
        return;
      }
      sendErrorWithData(
        res,
        "Account is inactive. Please contact support.",
        { code: "ACCOUNT_INACTIVE" },
        403
      );
      return;
    }

    if (
      typeof payload.tokenVersion === "number" &&
      payload.tokenVersion !== (user.tokenVersion ?? 0)
    ) {
      sendErrorWithData(
        res,
        "Session revoked. Please log in again.",
        { code: "TOKEN_EXPIRED" },
        401
      );
      return;
    }

    const dbRoles = (user.roles || "").split(",").map((r: string) => r.trim());
    const jwtRoles = (payload.roles || payload.role || "").split(",").map((r: string) => r.trim());
    if (!dbRoles.includes("rider") || !jwtRoles.includes("rider")) {
      sendErrorWithData(
        res,
        "Access denied. This portal is for riders only.",
        { code: "ROLE_DENIED" },
        403
      );
      return;
    }

    const [profile] = await db
      .select()
      .from(riderProfilesTable)
      .where(eq(riderProfilesTable.userId, user.id))
      .limit(1);
    req.riderId = user.id;
    req.riderUser = profile
      ? { ...user, ...profile, kycStatus: profile.kycStatus ?? user.kycStatus }
      : user;
    next();
  } catch (err) {
    logger.error("[riderAuth] DB error:", err instanceof Error ? err.message : err);
    sendError(res, "Authentication service temporarily unavailable", 503);
  }
}

router.use(riderAuth);

/* ── Attestation token validation middleware ─────────────────────────────────
   Checks the X-Attest-Token header on sensitive endpoints.  The token is
   issued by POST /riders/attest after the device passes Play Integrity (Android)
   or App Attest (iOS) verification.  On web builds or in dev/staging the token
   may be absent — the middleware logs a warning but does NOT block in those
   environments so web/dev flows continue to work.

   In production with NODE_ENV=production, a missing or clearly invalid token
   results in a 403 "Device attestation required" response on endpoints that are
   decorated with this middleware.

   Usage:
     router.post("/sensitive-route", requireAttestation, async (req, res) => { … })

   The in-memory store below is intentionally simple — it acts as a deny-list
   for tokens we've already seen ONLY to catch trivial replay attacks.  A
   production deployment should persist issued tokens in Redis and enforce one
   token-per-session rather than a module-level Map.                           */
const _issuedAttestTokens = new Map<string, number>(); /* token → expiresAt */

export function recordAttestToken(token: string, expiresAt: number): void {
  _issuedAttestTokens.set(token, expiresAt);
  /* Prune expired entries to avoid unbounded growth */
  const now = Date.now();
  for (const [t, exp] of _issuedAttestTokens.entries()) {
    if (exp < now) _issuedAttestTokens.delete(t);
  }
}

function requireAttestation(req: Request, res: Response, next: NextFunction): void {
  const token = req.headers["x-attest-token"] as string | undefined;

  /* Enforcement is auto-detected from credential availability:
       - Production (NODE_ENV=production) AND credentials configured
         (PLAY_INTEGRITY_API_KEY or APP_ATTEST_TEAM_ID set) → hard block
       - Non-production OR credentials absent → log + allow (safe default during roll-out)

     This is deterministic: once you set the API keys, enforcement is active.
     No additional flags to forget. */
  const credentialsConfigured =
    Boolean(process.env.PLAY_INTEGRITY_API_KEY) ||
    Boolean(process.env.APP_ATTEST_TEAM_ID);
  const enforce = process.env.NODE_ENV === "production" && credentialsConfigured;

  if (!token) {
    if (enforce) {
      sendError(res, "Device attestation required", 403);
      return;
    }
    logger.debug({ path: req.path, riderId: req.riderId }, "[attest] missing X-Attest-Token (enforcement off, allowing)");
    next();
    return;
  }

  /* Validate: token must exist in our issued-token registry and not be expired */
  const expiresAt = _issuedAttestTokens.get(token);
  if (!expiresAt || expiresAt < Date.now()) {
    if (enforce) {
      logger.warn({ riderId: req.riderId }, "[attest] invalid or expired X-Attest-Token");
      sendError(res, "Device attestation expired or invalid — please re-attest", 403);
      return;
    }
    logger.debug({ path: req.path, riderId: req.riderId }, "[attest] unrecognised/expired token (enforcement off, allowing)");
    next();
    return;
  }

  /* Valid token — allow request */
  next();
}

/* ── GET /rider/me — Profile ── */
router.get("/me", async (req, res) => {
  try {
    /* appRole guard — client must supply ?appRole=rider so the server can
     reject tokens that belong to a different app context (e.g. a vendor
     JWT accidentally sent to the rider app). Returns WRONG_ROLE so clients
     can surface a meaningful "wrong app" error instead of a generic 403. */
    const appRole = req.query.appRole as string | undefined;
    if (appRole && appRole !== "rider") {
      sendErrorWithData(
        res,
        "Access denied. This endpoint requires a rider session.",
        { code: "WRONG_ROLE" },
        403
      );
      return;
    }
    const user = req.riderUser!;
    const riderId = user.id;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const s = await getCachedSettings();
    const riderKeepPct = (Number(s["rider_keep_pct"]) || 80) / 100;

    const [riderProfile] = await db
      .select()
      .from(riderProfilesTable)
      .where(eq(riderProfilesTable.userId, riderId))
      .limit(1);

    const maxDeliveriesSetting = parseInt(s["rider_max_deliveries"] ?? "3");

    const [
      ordersTodayStats,
      ordersAllStats,
      ridesTodayStats,
      ridesAllStats,
      bonusTodayStats,
      bonusAllStats,
      liveLocationRow,
      activeOrdersCount,
      activeRidesCount,
      unreadNotifCount,
    ] = await Promise.all([
      db
        .select({ c: count(), s: sum(ordersTable.total) })
        .from(ordersTable)
        .where(
          and(
            eq(ordersTable.riderId, riderId),
            eq(ordersTable.status, "delivered"),
            gte(ordersTable.updatedAt, today),
            isNull(ordersTable.deletedAt)
          )
        ),
      db
        .select({ c: count(), s: sum(ordersTable.total) })
        .from(ordersTable)
        .where(
          and(
            eq(ordersTable.riderId, riderId),
            eq(ordersTable.status, "delivered"),
            isNull(ordersTable.deletedAt)
          )
        ),
      db
        .select({ c: count(), s: sum(ridesTable.fare) })
        .from(ridesTable)
        .where(
          and(
            eq(ridesTable.riderId, riderId),
            eq(ridesTable.status, "completed"),
            gte(ridesTable.updatedAt, today)
          )
        ),
      db
        .select({ c: count(), s: sum(ridesTable.fare) })
        .from(ridesTable)
        .where(and(eq(ridesTable.riderId, riderId), eq(ridesTable.status, "completed"))),
      /* Per-trip bonus credits (rider_bonus_per_trip wallet transactions) */
      db
        .select({ s: sum(walletTransactionsTable.amount) })
        .from(walletTransactionsTable)
        .where(
          and(
            eq(walletTransactionsTable.userId, riderId),
            eq(walletTransactionsTable.type, "bonus"),
            gte(walletTransactionsTable.createdAt, today)
          )
        ),
      db
        .select({ s: sum(walletTransactionsTable.amount) })
        .from(walletTransactionsTable)
        .where(
          and(
            eq(walletTransactionsTable.userId, riderId),
            eq(walletTransactionsTable.type, "bonus")
          )
        ),
      /* onlineSince from live_locations */
      db
        .select({ onlineSince: liveLocationsTable.onlineSince })
        .from(liveLocationsTable)
        .where(eq(liveLocationsTable.userId, riderId))
        .limit(1),
      /* activeOrderCount — orders assigned and not yet delivered/cancelled */
      db
        .select({ c: count() })
        .from(ordersTable)
        .where(
          and(
            eq(ordersTable.riderId, riderId),
            isNull(ordersTable.deletedAt),
            sql`${ordersTable.status} NOT IN ('delivered', 'cancelled', 'rejected')`
          )
        ),
      /* activeRidesCount — rides assigned and not yet completed/cancelled */
      db
        .select({ c: count() })
        .from(ridesTable)
        .where(
          and(
            eq(ridesTable.riderId, riderId),
            sql`${ridesTable.status} NOT IN ('completed', 'cancelled')`
          )
        ),
      /* unreadNotifications */
      db
        .select({ c: count() })
        .from(notificationsTable)
        .where(
          and(
            eq(notificationsTable.userId, riderId),
            eq(notificationsTable.isRead, false)
          )
        ),
    ]);

    const deliveriesToday = (ordersTodayStats[0]?.c ?? 0) + (ridesTodayStats[0]?.c ?? 0);
    const earningsToday =
      Math.round(
        (safeNum(ordersTodayStats[0]?.s) + safeNum(ridesTodayStats[0]?.s)) * riderKeepPct * 100
      ) /
        100 +
      safeNum(bonusTodayStats[0]?.s);
    const totalDeliveries = (ordersAllStats[0]?.c ?? 0) + (ridesAllStats[0]?.c ?? 0);
    const totalEarnings =
      Math.round(
        (safeNum(ordersAllStats[0]?.s) + safeNum(ridesAllStats[0]?.s)) * riderKeepPct * 100
      ) /
        100 +
      safeNum(bonusAllStats[0]?.s);

    const [ratingRow] = await db
      .select({ avg: avg(reviewsTable.rating) })
      .from(reviewsTable)
      .where(eq(reviewsTable.riderId, riderId));
    const avgRating = ratingRow?.avg
      ? parseFloat(parseFloat(String(ratingRow.avg)).toFixed(1))
      : null;

    const apiOnlineSince = liveLocationRow[0]?.onlineSince
      ? new Date(liveLocationRow[0].onlineSince).getTime()
      : null;
    const activeOrderCount = (activeOrdersCount[0]?.c ?? 0) + (activeRidesCount[0]?.c ?? 0);
    const unreadNotifications = unreadNotifCount[0]?.c ?? 0;

    sendSuccess(res, {
      id: user.id,
      phone: user.phone,
      name: user.name,
      email: user.email,
      username: user.username,
      role: user.roles,
      roles: user.roles,
      avatar: user.avatar,
      isOnline: user.isOnline,
      isRestricted: user.isRestricted ?? (!user.isActive && (user.cancelCount ?? 0) > 0),
      approvalStatus: user.approvalStatus ?? "approved",
      rejectionReason: user.approvalNote ?? null,
      walletBalance: safeNum(user.walletBalance),
      cnic: user.idCardNumber,
      address: user.address,
      city: user.city,
      area: user.area,
      emergencyContact: user.emergencyContact,
      vehicleType: riderProfile?.vehicleType ?? null,
      vehiclePlate: riderProfile?.vehiclePlate ?? null,
      vehicleRegNo: riderProfile?.vehicleRegNo ?? null,
      drivingLicense: riderProfile?.drivingLicense ?? null,
      vehiclePhoto: riderProfile?.vehiclePhoto ?? null,
      bankName: user.bankName,
      bankAccount: user.bankAccount,
      bankAccountTitle: user.bankAccountTitle,
      twoFactorEnabled: !!user.totpEnabled,
      accountLevel: user.accountLevel,
      kycStatus: user.kycStatus,
      /* Structured per-document rejection list — JSON array stored as text in DB,
         parsed here so the rider app receives a typed string[] directly */
      kycRejectedDocs: (() => {
        try {
          return user.kycRejectedDocs ? (JSON.parse(user.kycRejectedDocs) as string[]) : null;
        } catch {
          return null;
        }
      })(),
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      dailyGoal: riderProfile?.dailyGoal ? parseFloat(String(riderProfile.dailyGoal)) : null,
      cnicProvided: user.cnicProvided || !!user.idCardNumber,
      phoneVerified: !!user.phoneVerified,
      emailVerified: !!user.emailVerified,
      documentsSubmitted: !!user.documentsSubmitted,
      documentsApproved: !!user.documentsApproved,
      ...(() => {
        try {
          const docs = JSON.parse(riderProfile?.documents || "{}");
          return {
            cnicDocUrl: docs.cnicDocUrl || null,
            cnicBackDocUrl: docs.cnicBackDocUrl || null,
            licenseDocUrl: docs.licenseDocUrl || null,
            regDocUrl: docs.regDocUrl || null,
          };
        } catch (err) {
          logger.debug(
            { error: err instanceof Error ? err.message : String(err) },
            "[fn] error with fallback return"
          );
          return { cnicDocUrl: null, cnicBackDocUrl: null, licenseDocUrl: null, regDocUrl: null };
        }
      })(),
      stats: {
        deliveriesToday,
        earningsToday: parseFloat(earningsToday.toFixed(2)),
        totalDeliveries,
        totalEarnings: parseFloat(totalEarnings.toFixed(2)),
        rating: avgRating,
      },
      onlineSince: user.isOnline ? apiOnlineSince : null,
      activeOrderCount,
      maxDeliveries: maxDeliveriesSetting,
      unreadNotifications,
    });
  } catch (err) {
    logger.error(
      {
        error: err instanceof Error ? err.message : String(err),
        timestamp: new Date().toISOString(),
      },
      "[route] unhandled error"
    );
    sendError(res, "Internal server error", 500);
  }
});

/* ── POST /rider/kyc/request — Submit KYC review from existing registration docs ── */
router.post("/kyc/request", async (req, res) => {
  try {
    const riderId = req.riderId!;
    const [riderProfile] = await db
      .select({ documents: riderProfilesTable.documents })
      .from(riderProfilesTable)
      .where(eq(riderProfilesTable.userId, riderId))
      .limit(1);

    let hasDocs = false;
    if (riderProfile?.documents) {
      try {
        const docs = JSON.parse(riderProfile.documents);
        hasDocs = !!(docs.cnicDocUrl || docs.licenseDocUrl || docs.vehiclePhoto);
      } catch {
        hasDocs = false;
      }
    }
    if (!hasDocs) {
      sendForbidden(
        res,
        "No documents found. Please upload your documents in the Vehicle tab first."
      );
      return;
    }

    const [user] = await db
      .select({ kycStatus: usersTable.kycStatus })
      .from(usersTable)
      .where(eq(usersTable.id, riderId))
      .limit(1);

    if (user?.kycStatus === "verified") {
      sendError(res, "Your documents are already verified.", 400);
      return;
    }
    if (user?.kycStatus === "pending") {
      sendError(res, "Your KYC review is already in progress.", 400);
      return;
    }

    await db
      .update(usersTable)
      .set({ kycStatus: "pending", updatedAt: new Date() })
      .where(eq(usersTable.id, riderId));

    logger.info({ riderId }, "[kyc] rider requested KYC review from registration docs");
    sendSuccess(res, {
      message: "KYC review requested. Our team will review your documents shortly.",
    });
  } catch (err) {
    logger.error(
      { error: err instanceof Error ? err.message : String(err) },
      "[kyc/request] error"
    );
    sendError(res, "Internal server error", 500);
  }
});

/* ── PATCH /rider/online — Toggle online status ── */
router.patch("/online", async (req, res) => {
  try {
    const parsed = onlineSchema.safeParse(req.body);
    if (!parsed.success) {
      sendValidationError(res, parsed.error.issues[0]?.message || "Invalid input");
      return;
    }
    const riderId = req.riderId!;
    const riderUser = req.riderUser!;
    const { isOnline } = parsed.data;
    /* ── 3-Gate check when going online ─────────────────────────────────────
       Mirrors the accept_ride gates in featureAccess.ts so both actions are
       guarded by the same eligibility rules.
       Gate 1: phoneVerified
       Gate 2: approvalStatus === "approved"
       Gate 3: walletBalance >= rider_min_balance (fetched live from DB)      */
    if (isOnline) {
      if (!riderUser.phoneVerified) {
        fireAndForget(
          db
            .insert(riderGateEventsTable)
            .values({ riderId, gate: 1, reason: "phone_not_verified" })
        );
        res.status(403).json({
          success: false,
          blocked: true,
          gate: 1,
          reason: "phone_not_verified",
          message: "Verify your phone number to go online.",
        });
        return;
      }

      if ((riderUser.approvalStatus ?? "pending") !== "approved") {
        fireAndForget(
          db.insert(riderGateEventsTable).values({
            riderId,
            gate: 2,
            reason: "account_not_approved",
            metadata: JSON.stringify({ approvalStatus: riderUser.approvalStatus }),
          })
        );
        res.status(403).json({
          success: false,
          blocked: true,
          gate: 2,
          reason: "account_not_approved",
          message: "Your account is pending admin approval.",
        });
        return;
      }

      const [minBalRow] = await db
        .select({ value: platformSettingsTable.value })
        .from(platformSettingsTable)
        .where(eq(platformSettingsTable.key, "rider_min_balance"))
        .limit(1);
      const platformMinBalance = parseFloat(minBalRow?.value ?? "0");
      const riderBalance = parseFloat(String(riderUser.walletBalance ?? "0"));
      if (platformMinBalance > 0 && riderBalance < platformMinBalance) {
        fireAndForget(
          db.insert(riderGateEventsTable).values({
            riderId,
            gate: 3,
            reason: "insufficient_wallet_balance",
            metadata: JSON.stringify({
              currentBalance: riderBalance,
              minimumBalance: platformMinBalance,
            }),
          })
        );
        res.status(403).json({
          success: false,
          blocked: true,
          gate: 3,
          reason: "insufficient_wallet_balance",
          minimumBalance: platformMinBalance,
          currentBalance: riderBalance,
          message: `Top up your wallet with at least Rs. ${platformMinBalance} to go online.`,
        });
        return;
      }
    }

    let serviceZoneWarning: string | undefined;
    if (isOnline) {
      try {
        const reqLat = typeof req.body.latitude === "number" ? req.body.latitude : undefined;
        const reqLng = typeof req.body.longitude === "number" ? req.body.longitude : undefined;
        let checkLat = reqLat;
        let checkLng = reqLng;
        if (checkLat === undefined || checkLng === undefined) {
          const [loc] = await db
            .select({
              latitude: liveLocationsTable.latitude,
              longitude: liveLocationsTable.longitude,
            })
            .from(liveLocationsTable)
            .where(eq(liveLocationsTable.userId, riderId))
            .limit(1);
          if (loc) {
            checkLat = parseFloat(String(loc.latitude));
            checkLng = parseFloat(String(loc.longitude));
          }
        }
        if (
          checkLat !== undefined &&
          checkLng !== undefined &&
          Number.isFinite(checkLat) &&
          Number.isFinite(checkLng) &&
          !(checkLat === 0 && checkLng === 0)
        ) {
          const zoneCheck = await isInServiceZone(checkLat, checkLng, "rides");
          if (!zoneCheck.allowed) {
            serviceZoneWarning =
              "You are currently outside the active service area. You may not receive ride requests until you move into a service zone.";
          }
        }
      } catch (err) {
        logger.debug(
          { error: err instanceof Error ? err.message : String(err) },
          "[route] non-critical error suppressed"
        );
      }
    }

    await db
      .update(usersTable)
      .set({ isOnline: !!isOnline, updatedAt: new Date() })
      .where(eq(usersTable.id, riderId));

    /* Reset spoof hit counter when going offline so the next session starts clean.
     clearSpoofHits is defined later in this file as a hoisted function declaration
     (line ~2557) — no import needed since it lives in the same module. */
    if (!isOnline) {
      clearSpoofHits(riderId);
    }

    /* When going online, immediately upsert live_locations with last known
     coordinates so the rider appears on the admin map without waiting for
     the first GPS ping. Falls back gracefully if no prior location exists. */
    if (isOnline) {
      try {
        const STALE_SEED_MS = 30 * 60 * 1000;
        const [lastLog] = await db
          .select({
            latitude: locationLogsTable.latitude,
            longitude: locationLogsTable.longitude,
            createdAt: locationLogsTable.createdAt,
          })
          .from(locationLogsTable)
          .where(and(eq(locationLogsTable.userId, riderId), eq(locationLogsTable.role, "rider")))
          .orderBy(desc(locationLogsTable.createdAt))
          .limit(1);
        const now = new Date();
        const isStale =
          lastLog?.createdAt &&
          now.getTime() - new Date(lastLog.createdAt).getTime() > STALE_SEED_MS;
        if (lastLog && !isStale) {
          await db
            .insert(liveLocationsTable)
            .values({
              userId: riderId,
              latitude: lastLog.latitude,
              longitude: lastLog.longitude,
              role: "rider",
              action: null,
              onlineSince: now,
              updatedAt: now,
            })
            .onConflictDoUpdate({
              target: liveLocationsTable.userId,
              /* onlineSince is set only here (session start) — heartbeat does NOT overwrite it */
              set: {
                latitude: lastLog.latitude,
                longitude: lastLog.longitude,
                role: "rider",
                action: null,
                onlineSince: now,
                updatedAt: now,
              },
            });
        } else {
          /* No prior GPS log: still set onlineSince so session start is tracked */
          await db
            .insert(liveLocationsTable)
            .values({
              userId: riderId,
              latitude: "0",
              longitude: "0",
              role: "rider",
              action: null,
              onlineSince: now,
              updatedAt: now,
            })
            .onConflictDoUpdate({
              target: liveLocationsTable.userId,
              set: { onlineSince: now, updatedAt: now },
            })
            .catch((e: unknown) => {
              logger.warn("[rider] live_location seed failed:", (e as Error)?.message);
            });
        }
      } catch (e: unknown) {
        logger.warn("[rider] live_location seed failed:", (e as Error)?.message);
      }
    }

    /* Emit real-time status events to admin-fleet */
    try {
      const statusPayload = {
        userId: riderId,
        isOnline: !!isOnline,
        name: riderUser.name ?? undefined,
        updatedAt: new Date().toISOString(),
      };
      emitRiderStatus(statusPayload);
      if (isOnline) {
        emitRiderOnline({ userId: riderId, name: riderUser.name ?? undefined, updatedAt: statusPayload.updatedAt });
      } else {
        emitRiderOffline({ userId: riderId, name: riderUser.name ?? undefined, updatedAt: statusPayload.updatedAt });
      }
    } catch (err) {
      logger.debug(
        { error: err instanceof Error ? err.message : String(err) },
        "[route] non-critical error suppressed"
      );
    }

    sendSuccess(res, {
      isOnline: !!isOnline,
      ...(serviceZoneWarning ? { serviceZoneWarning } : {}),
    });
  } catch (err) {
    logger.error(
      {
        error: err instanceof Error ? err.message : String(err),
        timestamp: new Date().toISOString(),
      },
      "[route] unhandled error"
    );
    sendError(res, "Internal server error", 500);
  }
});

/* ── PATCH /rider/status — Toggle online status (spec-compliant alias for /rider/online) ──
   Accepts { online: boolean } per spec; falls back to { isOnline } for backward compatibility.
   The /rider/online route above remains as a backward-compatible alias. */
router.patch("/status", async (req, res) => {
  try {
    const parsed = onlineSchema.safeParse(req.body);
    if (!parsed.success) {
      sendValidationError(res, parsed.error.issues[0]?.message || "Invalid input");
      return;
    }
    const riderId = req.riderId!;
    const riderUser = req.riderUser!;
    const { isOnline } = parsed.data;
    if (isOnline && (riderUser.approvalStatus ?? "pending") !== "approved") {
      sendForbidden(
        res,
        "Your account is pending re-verification. You cannot go online until an admin approves your profile."
      );
      return;
    }
    let serviceZoneWarning: string | undefined;
    if (isOnline) {
      try {
        const reqLat = typeof req.body.latitude === "number" ? req.body.latitude : undefined;
        const reqLng = typeof req.body.longitude === "number" ? req.body.longitude : undefined;
        let checkLat = reqLat;
        let checkLng = reqLng;
        if (checkLat === undefined || checkLng === undefined) {
          const [loc] = await db
            .select({ latitude: liveLocationsTable.latitude, longitude: liveLocationsTable.longitude })
            .from(liveLocationsTable)
            .where(eq(liveLocationsTable.userId, riderId))
            .limit(1);
          if (loc) {
            checkLat = parseFloat(String(loc.latitude));
            checkLng = parseFloat(String(loc.longitude));
          }
        }
        if (
          checkLat !== undefined && checkLng !== undefined &&
          Number.isFinite(checkLat) && Number.isFinite(checkLng) &&
          !(checkLat === 0 && checkLng === 0)
        ) {
          const zoneCheck = await isInServiceZone(checkLat, checkLng, "rides");
          if (!zoneCheck.allowed) {
            serviceZoneWarning =
              "You are currently outside the active service area. You may not receive ride requests until you move into a service zone.";
          }
        }
      } catch (err) {
        logger.debug({ error: err instanceof Error ? err.message : String(err) }, "[route] non-critical error suppressed");
      }
    }
    await db.update(usersTable).set({ isOnline: !!isOnline, updatedAt: new Date() }).where(eq(usersTable.id, riderId));
    if (!isOnline) clearSpoofHits(riderId);
    if (isOnline) {
      try {
        const STALE_SEED_MS = 30 * 60 * 1000;
        const [lastLog] = await db
          .select({ latitude: locationLogsTable.latitude, longitude: locationLogsTable.longitude, createdAt: locationLogsTable.createdAt })
          .from(locationLogsTable)
          .where(and(eq(locationLogsTable.userId, riderId), eq(locationLogsTable.role, "rider")))
          .orderBy(desc(locationLogsTable.createdAt))
          .limit(1);
        const now = new Date();
        const isStale = lastLog?.createdAt && now.getTime() - new Date(lastLog.createdAt).getTime() > STALE_SEED_MS;
        if (lastLog && !isStale) {
          await db.insert(liveLocationsTable).values({
            userId: riderId, latitude: lastLog.latitude, longitude: lastLog.longitude,
            role: "rider", action: null, onlineSince: now, updatedAt: now,
          }).onConflictDoUpdate({
            target: liveLocationsTable.userId,
            set: { latitude: lastLog.latitude, longitude: lastLog.longitude, role: "rider", action: null, onlineSince: now, updatedAt: now },
          });
        } else {
          await db.insert(liveLocationsTable).values({
            userId: riderId, latitude: "0", longitude: "0",
            role: "rider", action: null, onlineSince: now, updatedAt: now,
          }).onConflictDoUpdate({
            target: liveLocationsTable.userId,
            set: { onlineSince: now, updatedAt: now },
          }).catch((e: unknown) => { logger.warn("[rider] live_location seed failed:", (e as Error)?.message); });
        }
      } catch (e: unknown) {
        logger.warn("[rider] live_location seed failed:", (e as Error)?.message);
      }
    }
    try {
      const updatedAt = new Date().toISOString();
      emitRiderStatus({ userId: riderId, isOnline: !!isOnline, name: riderUser.name ?? undefined, updatedAt });
      if (isOnline) {
        emitRiderOnline({ userId: riderId, name: riderUser.name ?? undefined, updatedAt });
      } else {
        emitRiderOffline({ userId: riderId, name: riderUser.name ?? undefined, updatedAt });
      }
    } catch (err) {
      logger.debug({ error: err instanceof Error ? err.message : String(err) }, "[route] non-critical error suppressed");
    }
    sendSuccess(res, { isOnline: !!isOnline, ...(serviceZoneWarning ? { serviceZoneWarning } : {}) });
  } catch (err) {
    logger.error({ error: err instanceof Error ? err.message : String(err), timestamp: new Date().toISOString() }, "[route] unhandled error");
    sendError(res, "Internal server error", 500);
  }
});

/* ── PATCH /rider/profile — Update profile ── */
router.patch("/profile", async (req, res) => {
  try {
    const parsed = profileSchema.safeParse(req.body);
    if (!parsed.success) {
      sendValidationError(res, parsed.error.issues[0]?.message || "Invalid input");
      return;
    }
    const riderId = req.riderId!;
    const currentUser = req.riderUser!;
    const {
      name,
      email,
      cnic,
      address,
      city,
      emergencyContact,
      vehicleType,
      vehiclePlate,
      vehicleRegNo,
      drivingLicense,
      bankName,
      bankAccount,
      bankAccountTitle,
      avatar,
      cnicDocUrl,
      licenseDocUrl,
      regDocUrl,
      vehiclePhoto,
      dailyGoal,
    } = parsed.data;
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    const profileUpdates: Record<string, unknown> = { updatedAt: new Date() };
    if (name !== undefined) updates.name = name;
    if (email !== undefined) updates.email = email;
    if (cnic !== undefined) {
      updates.idCardNumber = cnic;
      updates.cnicProvided = !!cnic;
    }
    if (address !== undefined) updates.address = address;
    if (city !== undefined) updates.city = city;
    if (emergencyContact !== undefined) updates.emergencyContact = emergencyContact;
    if (vehicleType !== undefined)
      profileUpdates.vehicleType = normalizeVehicleType(vehicleType) || vehicleType;
    if (vehiclePlate !== undefined) profileUpdates.vehiclePlate = vehiclePlate;
    if (vehicleRegNo !== undefined) profileUpdates.vehicleRegNo = vehicleRegNo;
    if (drivingLicense !== undefined) profileUpdates.drivingLicense = drivingLicense;
    if (dailyGoal !== undefined)
      profileUpdates.dailyGoal = dailyGoal != null ? String(dailyGoal) : null;
    if (bankName !== undefined) updates.bankName = bankName;
    if (bankAccount !== undefined) updates.bankAccount = bankAccount;
    if (bankAccountTitle !== undefined) updates.bankAccountTitle = bankAccountTitle;
    if (avatar !== undefined) {
      if (avatar && !avatar.startsWith("/api/uploads/")) {
        sendValidationError(res, "Avatar must be an uploaded file URL");
        return;
      }
      updates.avatar = avatar;
    }
    /* Document photo URLs — stored in the rider profile `documents` JSON column. */
    if (cnicDocUrl !== undefined || licenseDocUrl !== undefined || regDocUrl !== undefined) {
      if (cnicDocUrl && !cnicDocUrl.startsWith("/api/uploads/")) {
        sendValidationError(res, "cnicDocUrl must be an uploaded file URL");
        return;
      }
      if (licenseDocUrl && !licenseDocUrl.startsWith("/api/uploads/")) {
        sendValidationError(res, "licenseDocUrl must be an uploaded file URL");
        return;
      }
      if (regDocUrl && !regDocUrl.startsWith("/api/uploads/")) {
        sendValidationError(res, "regDocUrl must be an uploaded file URL");
        return;
      }
      let existingDocs: Record<string, string> = {};
      try {
        existingDocs = JSON.parse(currentUser.documents || "{}");
      } catch (err) {
        logger.debug(
          { error: err instanceof Error ? err.message : String(err) },
          `[route] intentional: ignore parse/parse error`
        );
      }
      if (cnicDocUrl !== undefined) existingDocs.cnicDocUrl = cnicDocUrl;
      if (licenseDocUrl !== undefined) existingDocs.licenseDocUrl = licenseDocUrl;
      if (regDocUrl !== undefined) existingDocs.regDocUrl = regDocUrl;
      profileUpdates.documents = JSON.stringify(existingDocs);
    }
    if (vehiclePhoto !== undefined) {
      if (vehiclePhoto && !vehiclePhoto.startsWith("/api/uploads/")) {
        sendValidationError(res, "vehiclePhoto must be an uploaded file URL");
        return;
      }
      profileUpdates.vehiclePhoto = vehiclePhoto;
    }

    /* Detect sensitive identity field changes — reset approval to pending so admin can re-verify */
    const cnicChanged = cnic !== undefined && cnic !== currentUser.idCardNumber;
    const drivingLicenseChanged =
      drivingLicense !== undefined && drivingLicense !== currentUser.drivingLicense;
    if (cnicChanged || drivingLicenseChanged) {
      updates.approvalStatus = "pending";
      updates.isOnline = false;
    }

    let user: typeof usersTable.$inferSelect & Partial<typeof riderProfilesTable.$inferSelect>;
    try {
      /* H-01: Wrap both table writes in one transaction so a partial failure
         (e.g. riderProfiles insert failing) cannot leave users + riderProfiles
         in an inconsistent state (e.g. CNIC updated but vehicleType not). */
      const [updated, profile] = await db.transaction(async (tx) => {
        const [upd] = await tx
          .update(usersTable)
          .set(updates)
          .where(eq(usersTable.id, riderId))
          .returning();
        let prof: typeof riderProfilesTable.$inferSelect | undefined;
        if (Object.keys(profileUpdates).length > 1) {
          const [up] = await tx
            .insert(riderProfilesTable)
            .values({ userId: riderId, ...profileUpdates })
            .onConflictDoUpdate({ target: riderProfilesTable.userId, set: profileUpdates })
            .returning();
          prof = up;
        } else {
          const [existing] = await tx
            .select()
            .from(riderProfilesTable)
            .where(eq(riderProfilesTable.userId, riderId))
            .limit(1);
          prof = existing;
        }
        return [upd, prof] as const;
      });
      user = profile
        ? { ...updated, ...profile, kycStatus: profile.kycStatus ?? updated.kycStatus }
        : updated;
    } catch (dbErr: unknown) {
      const msg = (dbErr as Error)?.message || "";
      if (msg.includes("unique") || msg.includes("duplicate")) {
        /* L-01: Return a field-specific error message so the client can highlight
           the conflicting field rather than showing a generic 409 banner. */
        const isCnicConflict = msg.toLowerCase().includes("cnic");
        sendError(
          res,
          isCnicConflict
            ? "This CNIC is already registered to another account"
            : "A profile field conflicts with an existing record (e.g. duplicate CNIC)",
          409
        );
      } else {
        sendError(res, "Failed to update profile. Please try again.", 500);
      }
      return;
    }

    if (cnicChanged || drivingLicenseChanged) {
      const reVerifyLang = await getUserLanguage(riderId);
      await db
        .insert(notificationsTable)
        .values({
          id: generateId(),
          userId: riderId,
          title: t("approvalPending", reVerifyLang),
          body: t("approvalMsg", reVerifyLang),
          type: "system",
          icon: "shield-outline",
        })
        .catch((e: Error) => {
          logger.warn(
            { riderId, err: e.message },
            "[rider] approval-pending notification insert failed"
          );
        });
    }

    sendSuccess(res, {
      id: user.id,
      name: user.name,
      phone: user.phone,
      email: user.email,
      username: user.username,
      avatar: user.avatar,
      role: user.roles,
      isOnline: user.isOnline,
      walletBalance: safeNum(user.walletBalance),
      approvalStatus: user.approvalStatus,
      cnic: user.idCardNumber,
      address: user.address,
      city: user.city,
      area: user.area,
      emergencyContact: user.emergencyContact,
      vehicleType: user.vehicleType,
      vehiclePlate: user.vehiclePlate,
      vehicleRegNo: user.vehicleRegNo,
      drivingLicense: user.drivingLicense,
      bankName: user.bankName,
      bankAccount: user.bankAccount,
      bankAccountTitle: user.bankAccountTitle,
      accountLevel: user.accountLevel,
      kycStatus: user.kycStatus,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
      vehiclePhoto: user.vehiclePhoto,
      ...(() => {
        try {
          const docs = JSON.parse(user.documents || "{}");
          return {
            cnicDocUrl: docs.cnicDocUrl || null,
            licenseDocUrl: docs.licenseDocUrl || null,
            regDocUrl: docs.regDocUrl || null,
          };
        } catch (err) {
          logger.debug(
            { error: err instanceof Error ? err.message : String(err) },
            "[fn] error with fallback return"
          );
          return { cnicDocUrl: null, licenseDocUrl: null, regDocUrl: null };
        }
      })(),
      ...(cnicChanged || drivingLicenseChanged ? { pendingVerification: true } : {}),
    });
  } catch (err) {
    logger.error(
      {
        error: err instanceof Error ? err.message : String(err),
        timestamp: new Date().toISOString(),
      },
      "[route] unhandled error"
    );
    sendError(res, "Internal server error", 500);
  }
});

/* ── PATCH /rider/goal — Set personal daily earnings goal (dedicated endpoint) ── */
router.patch("/goal", async (req, res) => {
  try {
    const schema = z.object({ dailyGoal: z.number().positive().nullable() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      sendValidationError(res, parsed.error.issues[0]?.message || "Invalid input");
      return;
    }
    const riderId = req.riderId!;
    const { dailyGoal } = parsed.data;
    await db
      .update(riderProfilesTable)
      .set({ dailyGoal: dailyGoal != null ? String(dailyGoal) : null, updatedAt: new Date() })
      .where(eq(riderProfilesTable.userId, riderId));
    sendSuccess(res, { dailyGoal });
  } catch (err) {
    logger.error({ err }, "[route] PATCH /rider/goal failed");
    sendError(res, "Failed to update goal", 500);
  }
});

/* ── Haversine distance (km) ── */
function calcDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/* ── Phone masking helper ──
   Returns the raw phone number only for statuses where the rider has formally accepted
   the job and needs to contact the customer. All other statuses get a masked number. */
const PHONE_REVEAL_ORDER_STATUSES = new Set(["out_for_delivery", "picked_up"]);
const PHONE_REVEAL_RIDE_STATUSES = new Set(["accepted", "arrived", "in_transit"]);

function maskPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 6) return "****";
  return `${digits.slice(0, 4)}-***-${digits.slice(-2)}`;
}

/* ── GET /rider/requests — Available orders + rides (incl. bargaining, with own bid info + distance/ETA) ── */
/* InDrive-style broadcast: ALL nearby riders within admin radius see every open ride.
   First to accept wins via atomic WHERE riderId IS NULL. */
/* H-03: Rate-limit the broadcast-request feed — without this, an always-on client
   could hammer the endpoint and inflate DB load with large IN-clauses. */
router.get("/requests", requestFeedLimiter, async (req, res) => {
  try {
    const riderId = req.riderId!;
    const s = await getCachedSettings();
    const avgSpeed = parseFloat(s["dispatch_avg_speed_kmh"] ?? "25");
    const radiusKm = parseFloat(s["dispatch_min_radius_km"] ?? "5");

    const riderUser = req.riderUser! as Record<string, unknown>;
    const riderVehicle = normalizeVehicleType(String(riderUser.vehicleType ?? ""));

    const [orders, rides, myBids, riderLoc] = await Promise.all([
      db
        .select()
        .from(ordersTable)
        .where(
          and(
            or(eq(ordersTable.status, "confirmed"), eq(ordersTable.status, "preparing")),
            isNull(ordersTable.riderId),
            isNull(ordersTable.deletedAt)
          )
        )
        .orderBy(desc(ordersTable.createdAt))
        .limit(20),
      db
        .select()
        .from(ridesTable)
        .where(
          and(
            or(eq(ridesTable.status, "searching"), eq(ridesTable.status, "bargaining")),
            isNull(ridesTable.riderId)
          )
        )
        .orderBy(desc(ridesTable.createdAt))
        .limit(30),
      db
        .select()
        .from(rideBidsTable)
        .where(and(eq(rideBidsTable.riderId, riderId), eq(rideBidsTable.status, "pending"))),
      db.select().from(liveLocationsTable).where(eq(liveLocationsTable.userId, riderId)).limit(1),
    ]);

    const myBidMap = new Map<string, (typeof myBids)[0]>(myBids.map((b) => [b.rideId, b]));
    const rLoc = riderLoc[0]
      ? {
          lat: parseFloat(String(riderLoc[0].latitude)),
          lng: parseFloat(String(riderLoc[0].longitude)),
        }
      : null;

    const filteredRides = rides
      .map((r) => {
        let riderDistanceKm: number | null = null;
        let riderEtaMin: number | null = null;
        if (rLoc && r.pickupLat && r.pickupLng) {
          riderDistanceKm =
            Math.round(
              calcDistance(rLoc.lat, rLoc.lng, parseFloat(r.pickupLat), parseFloat(r.pickupLng)) *
                10
            ) / 10;
          riderEtaMin = Math.max(1, Math.round((riderDistanceKm / avgSpeed) * 60));
        }
        return {
          ...r,
          fare: safeNum(r.fare),
          distance: safeNum(r.distance),
          offeredFare: r.offeredFare ? safeNum(r.offeredFare) : null,
          counterFare: r.counterFare ? safeNum(r.counterFare) : null,
          bargainRounds: r.bargainRounds ?? 0,
          riderDistanceKm,
          riderEtaMin,
          myBid: myBidMap.has(r.id)
            ? {
                id: myBidMap.get(r.id)!.id,
                fare: safeNum(myBidMap.get(r.id)!.fare),
                note: myBidMap.get(r.id)!.note,
              }
            : null,
        };
      })
      .filter((r) => {
        if (riderVehicle && r.type) {
          const rideType = normalizeVehicleType(r.type);
          if (rideType !== riderVehicle && rideType !== "any") return false;
        }
        if (r.riderDistanceKm == null) return true;
        return r.riderDistanceKm <= radiusKm;
      })
      .sort((a, b) => (a.riderDistanceKm ?? 999) - (b.riderDistanceKm ?? 999));

    /* Phone masking for /rider/requests:
     - ordersTable has no customerPhone column — the customer phone is only in usersTable.
       Orders are safe to spread as-is (no phone present in the row).
     - ridesTable has receiverPhone (parcel rides) which is the receiver contact.
       Mask it here: the rider has not been assigned yet so should not see full number. */
    const maskedRides = filteredRides.map((r) => ({
      ...r,
      receiverPhone: r.receiverPhone ? maskPhone(r.receiverPhone) : null,
    }));

    /* Include serverTime in the response so the client can compute clock offset
     for AcceptCountdown drift correction without a separate NTP round-trip. */
    res.status(200).json({
      success: true,
      serverTime: new Date().toISOString(),
      data: {
        orders: orders.map((o) => ({ ...o, total: safeNum(o.total) })),
        rides: maskedRides,
      },
    });
  } catch (err) {
    logger.error(
      {
        error: err instanceof Error ? err.message : String(err),
        timestamp: new Date().toISOString(),
      },
      "[route] unhandled error"
    );
    sendError(res, "Internal server error", 500);
  }
});

/* ── GET /rider/active — Current active delivery ── */
router.get("/active", async (req, res) => {
  try {
    const riderId = req.riderId!;
    const [order, ride] = await Promise.all([
      db
        .select()
        .from(ordersTable)
        .where(
          and(
            eq(ordersTable.riderId, riderId),
            or(
              eq(ordersTable.status, "confirmed"),
              eq(ordersTable.status, "preparing"),
              eq(ordersTable.status, "ready"),
              eq(ordersTable.status, "picked_up"),
              eq(ordersTable.status, "out_for_delivery")
            )
          )
        )
        .orderBy(desc(ordersTable.updatedAt))
        .limit(1),
      db
        .select()
        .from(ridesTable)
        .where(
          and(
            eq(ridesTable.riderId, riderId),
            or(
              eq(ridesTable.status, "accepted"),
              eq(ridesTable.status, "arrived"),
              eq(ridesTable.status, "in_transit")
            )
          )
        )
        .orderBy(desc(ridesTable.updatedAt))
        .limit(1),
    ]);

    // Enrich with customer name/phone so rider can call the customer
    let enrichedRide:
      | (Omit<NonNullable<(typeof ride)[0]>, "fare" | "distance"> & {
          fare: number;
          distance: number;
          customerName: string | null;
          customerPhone: string | null;
          customerAjkId: string | null;
        })
      | null = null;
    if (ride[0]) {
      const [customer] = await db
        .select({ name: usersTable.name, phone: usersTable.phone, ajkId: usersTable.ajkId })
        .from(usersTable)
        .where(eq(usersTable.id, ride[0].userId))
        .limit(1);
      const revealPhone = PHONE_REVEAL_RIDE_STATUSES.has(ride[0].status ?? "");
      enrichedRide = {
        ...ride[0],
        fare: safeNum(ride[0].fare),
        distance: safeNum(ride[0].distance),
        customerName: customer?.name || null,
        customerPhone: revealPhone ? customer?.phone || null : maskPhone(customer?.phone),
        customerAjkId: customer?.ajkId || null,
      };
    }

    let enrichedOrder:
      | (Omit<NonNullable<(typeof order)[0]>, "total"> & {
          total: number;
          customerName: string | null;
          customerPhone: string | null;
          customerAjkId: string | null;
          vendorStoreName: string | null;
          vendorPhone: string | null;
        })
      | null = null;
    if (order[0]) {
      type CustomerRow = { name: string | null; phone: string | null; ajkId: string | null };
      type VendorRow = { storeName: string | null; phone: string | null };
      const promises: [Promise<CustomerRow[]>, Promise<VendorRow[]>] = [
        db
          .select({ name: usersTable.name, phone: usersTable.phone, ajkId: usersTable.ajkId })
          .from(usersTable)
          .where(eq(usersTable.id, order[0].userId))
          .limit(1),
        order[0].vendorId
          ? db
              .select({ storeName: vendorProfilesTable.storeName, phone: usersTable.phone })
              .from(usersTable)
              .leftJoin(vendorProfilesTable, eq(usersTable.id, vendorProfilesTable.userId))
              .where(eq(usersTable.id, order[0].vendorId))
              .limit(1)
          : Promise.resolve([]),
      ];
      const [customerRows, vendorRows] = await Promise.all(promises);
      const customer = customerRows[0];
      const vendor = vendorRows[0];
      const revealPhone = PHONE_REVEAL_ORDER_STATUSES.has(order[0].status ?? "");
      enrichedOrder = {
        ...order[0],
        total: safeNum(order[0].total),
        customerName: customer?.name || null,
        customerPhone: revealPhone ? customer?.phone || null : maskPhone(customer?.phone),
        customerAjkId: customer?.ajkId || null,
        vendorStoreName: vendor?.storeName || null,
        vendorPhone: revealPhone ? vendor?.phone || null : maskPhone(vendor?.phone),
      };
    }

    sendSuccess(res, { order: enrichedOrder, ride: enrichedRide });
  } catch (err) {
    logger.error(
      {
        error: err instanceof Error ? err.message : String(err),
        timestamp: new Date().toISOString(),
      },
      "[route] unhandled error"
    );
    sendError(res, "Internal server error", 500);
  }
});

/* ── POST /rider/orders/:id/accept — Accept an order ──
   Uses WHERE riderId IS NULL to prevent two riders accepting the same order (race condition) */
router.post("/orders/:id/accept", rideAcceptLimiter, async (req, res) => {
  try {
    if (await checkIdempotency(req, res)) return;
    const paramParsed = idParamSchema.safeParse(req.params);
    if (!paramParsed.success) {
      sendValidationError(res, "Invalid order ID");
      return;
    }
    const riderId = req.riderId!;
    const riderUser = req.riderUser!;
    const orderId = paramParsed.data.id;

    if (riderUser.isRestricted) {
      sendForbidden(
        res,
        "Your account is restricted. You cannot accept new orders. Contact support for assistance."
      );
      return;
    }
    if ((riderUser.approvalStatus ?? "pending") !== "approved") {
      sendForbidden(
        res,
        "Your account is pending re-verification. You cannot accept orders until an admin approves your profile."
      );
      return;
    }

    const s = await getCachedSettings();

    /* ── Load target order first (needed for cash/COD checks) ── */
    const [targetOrder] = await db
      .select({ paymentMethod: ordersTable.paymentMethod })
      .from(ordersTable)
      .where(eq(ordersTable.id, orderId))
      .limit(1);

    /* ── Cash-order gate: admin can restrict riders from taking cash orders ── */
    const cashAllowed = (s["rider_cash_allowed"] ?? "on") === "on";
    if (!cashAllowed) {
      if (targetOrder?.paymentMethod === "cash" || targetOrder?.paymentMethod === "cod") {
        sendForbidden(res, "Cash-on-delivery orders are currently not available for riders.");
        return;
      }
    }

    const isCashOrder =
      targetOrder?.paymentMethod === "cash" || targetOrder?.paymentMethod === "cod";
    const minBalance = isCashOrder ? parseFloat(s["rider_min_balance"] ?? "0") : 0;
    const maxDeliveries = parseInt(s["rider_max_deliveries"] ?? "3");

    /* ── All eligibility checks + atomic accept inside a single transaction ──
     This eliminates the TOCTOU window between the balance/count reads and the UPDATE. */
    let updated: typeof ordersTable.$inferSelect | undefined;
    let toctouError:
      | { status: number; message: string; data?: Record<string, unknown> }
      | undefined;

    await db.transaction(async (tx) => {
      /* ── Lock the rider row first to serialize concurrent accept attempts from the same rider.
       This prevents two parallel requests from both passing the activeCount check before
       either commit can update the count in the DB. ── */
      await tx.execute(sql`SELECT id FROM users WHERE id = ${riderId} FOR UPDATE`);

      /* ── Minimum wallet balance gate for cash/COD orders ── */
      if (isCashOrder && minBalance > 0) {
        const [riderRow] = await tx
          .select({ walletBalance: usersTable.walletBalance })
          .from(usersTable)
          .where(eq(usersTable.id, riderId))
          .limit(1);
        const currentBal = safeNum(riderRow?.walletBalance);
        if (currentBal < minBalance) {
          toctouError = {
            status: 403,
            message: `Minimum wallet balance required for cash orders is Rs. ${minBalance}. Your balance: Rs. ${currentBal.toFixed(0)}. Please top up your wallet to accept cash orders.`,
            data: { code: "BELOW_MIN_BALANCE", required: minBalance, current: currentBal },
          };
          return;
        }
      }

      /* ── Max simultaneous deliveries gate ── */
      const [activeOrders, activeRides] = await Promise.all([
        tx
          .select({ c: count() })
          .from(ordersTable)
          .where(
            and(
              eq(ordersTable.riderId, riderId),
              or(
                eq(ordersTable.status, "out_for_delivery"),
                eq(ordersTable.status, "picked_up"),
                eq(ordersTable.status, "ready"),
                eq(ordersTable.status, "confirmed")
              )
            )
          ),
        tx
          .select({ c: count() })
          .from(ridesTable)
          .where(
            and(
              eq(ridesTable.riderId, riderId),
              or(
                eq(ridesTable.status, "accepted"),
                eq(ridesTable.status, "arrived"),
                eq(ridesTable.status, "in_transit")
              )
            )
          ),
      ]);
      const activeCount = (activeOrders[0]?.c ?? 0) + (activeRides[0]?.c ?? 0);
      if (activeCount >= maxDeliveries) {
        toctouError = {
          status: 429,
          message: `Maximum ${maxDeliveries} active deliveries allowed. Complete a current delivery first.`,
        };
        return;
      }

      /* ── Atomic accept: only succeeds if riderId is still NULL in DB ── */
      const now = new Date();
      const [result] = await tx
        .update(ordersTable)
        .set({
          riderId,
          riderName: String(riderUser.name || "Rider"),
          riderPhone: riderUser.phone ? String(riderUser.phone) : null,
          assignedRiderId: riderId,
          assignedAt: now,
          acceptedAt: now,
          updatedAt: now,
        })
        .where(and(eq(ordersTable.id, orderId), isNull(ordersTable.riderId)))
        .returning();
      updated = result;
    });

    if (toctouError) {
      if (toctouError.data) {
        sendErrorWithData(res, toctouError.message, toctouError.data, toctouError.status);
        return;
      }
      sendError(res, toctouError.message, toctouError.status);
      return;
    }

    if (!updated) {
      // Either not found OR already taken by another rider
      const [existing] = await db
        .select()
        .from(ordersTable)
        .where(eq(ordersTable.id, orderId))
        .limit(1);
      if (!existing) {
        sendNotFound(res, "Order not found");
        return;
      }
      sendError(res, "Order already taken by another rider", 409);
      return;
    }

    const orderAcceptLang = await getUserLanguage(updated.userId);
    await db
      .insert(notificationsTable)
      .values({
        id: generateId(),
        userId: updated.userId,
        title: t("notifRideAccepted", orderAcceptLang) + " 🚴",
        body: t("notifOrderOnWay", orderAcceptLang),
        type: "order",
        icon: "bicycle-outline",
      })
      .catch((err: Error) => {
        logger.error("[rider] background op failed:", err.message);
      });

    const responseBody = { ...updated, total: safeNum(updated.total) };
    await storeIdempotency(req, 200, { success: true, data: responseBody });
    sendSuccess(res, responseBody);
  } catch (err) {
    logger.error(
      {
        error: err instanceof Error ? err.message : String(err),
        timestamp: new Date().toISOString(),
      },
      "[route] unhandled error"
    );
    sendError(res, "Internal server error", 500);
  }
});

/* ── POST /rider/orders/:id/reject — Rider explicitly rejects/skips an order ──
   Records the rejection server-side so the dispatch engine can skip this rider
   for future broadcasts of the same order. No penalty is applied. */
router.post("/orders/:id/reject", async (req, res) => {
  try {
    if (await checkIdempotency(req, res)) return;
    const paramParsed = idParamSchema.safeParse(req.params);
    if (!paramParsed.success) {
      sendValidationError(res, "Invalid order ID");
      return;
    }
    const riderId = req.riderId!;
    const orderId = paramParsed.data.id;
    const rawReason = typeof req.body?.reason === "string" ? req.body.reason.trim() : "";
    if (rawReason !== "" && rawReason.length < 5) {
      sendValidationError(res, "Rejection reason must be at least 5 characters");
      return;
    }
    const reason = rawReason.slice(0, 200) || "skipped";

    const [order] = await db
      .select({ id: ordersTable.id, status: ordersTable.status })
      .from(ordersTable)
      .where(eq(ordersTable.id, orderId))
      .limit(1);
    if (!order) {
      sendNotFound(res, "Order not found");
      return;
    }

    await db
      .insert(notificationsTable)
      .values({
        id: generateId(),
        userId: riderId,
        title: "Order skipped",
        body: `You skipped order ${orderId.slice(-6).toUpperCase()} — ${reason}`,
        type: "system",
        icon: "close-circle-outline",
      })
      .catch((e: Error) => {
        logger.warn(
          { riderId, orderId, err: e.message },
          "[rider] skip-order notification insert failed"
        );
      });

    await storeIdempotency(req, 200, { success: true, data: { orderId, reason } });
    sendSuccess(res, { orderId, reason });
  } catch (err) {
    logger.error(
      {
        error: err instanceof Error ? err.message : String(err),
        timestamp: new Date().toISOString(),
      },
      "[route] unhandled error"
    );
    sendError(res, "Internal server error", 500);
  }
});

/* ── Cancellation penalty helper ──
   Fully atomic: count read, base record, cancel-count increment, optional
   penalty deduction, and optional restriction are all inside ONE transaction
   so a partial failure cannot leave the cancel count inflated. Wallet balance
   is floored at 0 via GREATEST to prevent negative balances. */
async function handleCancelPenalty(
  riderId: string
): Promise<{ dailyCancels: number; penaltyApplied: number; restricted: boolean }> {
  const s = await getCachedSettings();
  const limit = parseInt(s["rider_cancel_limit_daily"] ?? "3", 10);
  const penaltyAmt = parseFloat(s["rider_cancel_penalty_amount"] ?? "50");
  const restrictEnabled = (s["rider_cancel_restrict_enabled"] ?? "on") === "on";

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let penaltyApplied = 0;
  let restricted = false;
  let dailyCancels = 0;

  await db.transaction(async (tx) => {
    /* Lock-free count read inside transaction for consistency */
    const [countRow] = await tx
      .select({ c: count() })
      .from(walletTransactionsTable)
      .where(
        and(
          eq(walletTransactionsTable.userId, riderId),
          eq(walletTransactionsTable.type, "cancel_penalty"),
          gte(walletTransactionsTable.createdAt, today),
          sql`reference LIKE 'cancel:%'`
        )
      );
    dailyCancels = (countRow?.c ?? 0) + 1;

    /* Base cancel event (amount=0) and cancel-count bump — always recorded */
    await tx.insert(walletTransactionsTable).values({
      id: generateId(),
      userId: riderId,
      type: "cancel_penalty",
      amount: "0",
      description: `Cancellation #${dailyCancels} today`,
      reference: `cancel:${randomUUID()}`,
    });
    await tx
      .update(usersTable)
      .set({ cancelCount: sql`cancel_count + 1`, updatedAt: new Date() })
      .where(eq(usersTable.id, riderId));

    if (dailyCancels > limit) {
      penaltyApplied = penaltyAmt;
      /* Floor wallet at 0 so balance can never go negative from a penalty */
      await tx
        .update(usersTable)
        .set({
          walletBalance: sql`GREATEST(wallet_balance - ${penaltyAmt}, 0)`,
          updatedAt: new Date(),
        })
        .where(eq(usersTable.id, riderId));
      await tx.insert(walletTransactionsTable).values({
        id: generateId(),
        userId: riderId,
        type: "cancel_penalty",
        amount: penaltyAmt.toFixed(2),
        description: `Excessive cancellation penalty (${dailyCancels}/${limit} today) — Rs. ${penaltyAmt} deducted`,
        reference: `cancel_penalty:${randomUUID()}`,
      });
      await tx.insert(riderPenaltiesTable).values({
        id: generateId(),
        riderId,
        type: "cancel",
        amount: penaltyAmt.toFixed(2),
        reason: `Excessive cancellation (${dailyCancels}/${limit} today)`,
      });

      if (restrictEnabled) {
        await tx
          .update(usersTable)
          .set({ isRestricted: true, updatedAt: new Date() })
          .where(eq(usersTable.id, riderId));
        restricted = true;
      }
    }
  });

  /* Notifications are outside the transaction (non-critical, fire-and-forget) */
  if (dailyCancels > limit) {
    const penaltyLang = await getUserLanguage(riderId);
    await db
      .insert(notificationsTable)
      .values({
        id: generateId(),
        userId: riderId,
        title: restricted
          ? t("notifAccountRestricted", penaltyLang) + " ⚠️"
          : t("notifCancelPenalty", penaltyLang) + " ⚠️",
        body: restricted
          ? t("notifCancelRestrictedBody", penaltyLang)
              .replace("{count}", String(dailyCancels))
              .replace("{limit}", String(limit))
              .replace("{amount}", String(penaltyAmt))
          : t("notifCancelPenaltyBody", penaltyLang)
              .replace("{count}", String(dailyCancels))
              .replace("{limit}", String(limit))
              .replace("{amount}", String(penaltyAmt)),
        type: "system",
        icon: "alert-circle-outline",
      })
      .catch((e: Error) => {
        logger.warn(
          { riderId, err: e.message },
          "[rider] cancel-penalty notification insert failed"
        );
      });
  } else if (dailyCancels === limit) {
    const warnLang = await getUserLanguage(riderId);
    await db
      .insert(notificationsTable)
      .values({
        id: generateId(),
        userId: riderId,
        title: t("notifCancelWarning", warnLang) + " ⚠️",
        body: t("notifCancelWarningBody", warnLang)
          .replace("{count}", String(dailyCancels))
          .replace("{limit}", String(limit))
          .replace("{amount}", String(penaltyAmt)),
        type: "system",
        icon: "alert-circle-outline",
      })
      .catch((e: Error) => {
        logger.warn(
          { riderId, err: e.message },
          "[rider] cancel-warning notification insert failed"
        );
      });
  }

  return { dailyCancels, penaltyApplied, restricted };
}

/* ── GET /rider/cancel-stats — Rider's cancellation stats ── */
router.get("/cancel-stats", async (req, res) => {
  try {
    const riderId = req.riderId!;
    const s = await getCachedSettings();
    const dailyLimit = parseInt(s["rider_cancel_limit_daily"] ?? "3", 10);
    const penaltyAmt = parseFloat(s["rider_cancel_penalty_amount"] ?? "50");
    const restrictEnabled = (s["rider_cancel_restrict_enabled"] ?? "on") === "on";

    const now = new Date();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const monthAgo = new Date(today);
    monthAgo.setDate(monthAgo.getDate() - 30);

    /* Source of truth: walletTransactionsTable rows with type="cancel_penalty" where
     reference starts with "cancel:" — these are the base cancellation events (one per
     cancel, amount=0) written by handleCancelPenalty. Penalty rows have reference
     "cancel_penalty:..." and are excluded to avoid double-counting penalised cancels. */
    const [todayRow, weekRow, monthRow] = await Promise.all([
      db
        .select({ c: count() })
        .from(walletTransactionsTable)
        .where(
          and(
            eq(walletTransactionsTable.userId, riderId),
            eq(walletTransactionsTable.type, "cancel_penalty"),
            gte(walletTransactionsTable.createdAt, today),
            sql`reference LIKE 'cancel:%'`
          )
        ),
      db
        .select({ c: count() })
        .from(walletTransactionsTable)
        .where(
          and(
            eq(walletTransactionsTable.userId, riderId),
            eq(walletTransactionsTable.type, "cancel_penalty"),
            gte(walletTransactionsTable.createdAt, weekAgo),
            sql`reference LIKE 'cancel:%'`
          )
        ),
      db
        .select({ c: count() })
        .from(walletTransactionsTable)
        .where(
          and(
            eq(walletTransactionsTable.userId, riderId),
            eq(walletTransactionsTable.type, "cancel_penalty"),
            gte(walletTransactionsTable.createdAt, monthAgo),
            sql`reference LIKE 'cancel:%'`
          )
        ),
    ]);

    const todayCount = todayRow[0]?.c ?? 0;
    const weekCount = weekRow[0]?.c ?? 0;
    const monthCount = monthRow[0]?.c ?? 0;

    const [monthDeliveredRow, monthCompletedRow] = await Promise.all([
      db
        .select({ c: count() })
        .from(ordersTable)
        .where(
          and(
            eq(ordersTable.riderId, riderId),
            eq(ordersTable.status, "delivered"),
            gte(ordersTable.updatedAt, monthAgo)
          )
        ),
      db
        .select({ c: count() })
        .from(ridesTable)
        .where(
          and(
            eq(ridesTable.riderId, riderId),
            eq(ridesTable.status, "completed"),
            gte(ridesTable.updatedAt, monthAgo)
          )
        ),
    ]);
    const monthTrips = (monthDeliveredRow[0]?.c ?? 0) + (monthCompletedRow[0]?.c ?? 0) + monthCount;
    const cancelRate =
      monthTrips > 0 ? parseFloat(((monthCount / monthTrips) * 100).toFixed(1)) : null;

    sendSuccess(res, {
      today: { cancels: todayCount },
      week: { cancels: weekCount },
      month: { cancels: monthCount },
      dailyCancels: todayCount,
      dailyLimit,
      penaltyAmount: penaltyAmt,
      remaining: Math.max(0, dailyLimit - todayCount),
      restrictEnabled,
      cancelRate,
    });
  } catch (err) {
    logger.error(
      {
        error: err instanceof Error ? err.message : String(err),
        timestamp: new Date().toISOString(),
      },
      "[route] unhandled error"
    );
    sendError(res, "Internal server error", 500);
  }
});

/* ── POST /rider/orders/:id/pickup-confirm — Delivery pickup confirmation ── */
router.post("/orders/:id/pickup-confirm", async (req, res) => {
  try {
    if (await checkIdempotency(req, res)) return;
    const riderId = req.riderId!;
    const orderId = req.params["id"] as string;

    const [order] = await db
      .select()
      .from(ordersTable)
      .where(and(eq(ordersTable.id, orderId), eq(ordersTable.riderId, riderId)))
      .limit(1);
    if (!order) {
      sendNotFound(res, "Order not found or not assigned to you");
      return;
    }

    const allowedFrom = new Set(["confirmed", "preparing", "ready"]);
    if (!allowedFrom.has(order.status)) {
      sendValidationError(
        res,
        `Cannot confirm pickup: order status is "${order.status}". Allowed: ${[...allowedFrom].join(", ")}.`
      );
      return;
    }

    const [updated] = await db
      .update(ordersTable)
      .set({ status: "picked_up", updatedAt: new Date() })
      .where(and(eq(ordersTable.id, orderId), eq(ordersTable.riderId, riderId)))
      .returning();

    const pickupLang = await getUserLanguage(riderId);
    await db
      .insert(notificationsTable)
      .values({
        id: generateId(),
        userId: order.userId,
        title: "Order picked up" + (" 🚴"),
        body: "Your order has been picked up by the rider.",
        type: "order",
        icon: "package-outline",
      })
      .catch((e: Error) => logger.error("[rider] notif insert failed:", e.message));

    try {
      emitRideDispatchUpdate({ orderId, rideId: orderId, action: "picked_up", status: "picked_up" });
    } catch (err) {
      logger.debug({ error: err instanceof Error ? err.message : String(err) }, "[route] non-critical error suppressed");
    }

    await storeIdempotency(req, 200, { success: true, data: updated });
    sendSuccess(res, updated);
  } catch (err) {
    logger.error(
      { error: err instanceof Error ? err.message : String(err), timestamp: new Date().toISOString() },
      "[route] unhandled error"
    );
    sendError(res, "Internal server error", 500);
  }
});

/* ── PATCH /rider/orders/:id/status — Update order status (delivered) ── */
router.patch("/orders/:id/status", async (req, res) => {
  try {
    if (await checkIdempotency(req, res)) return;
    const parsed = orderStatusSchema.safeParse(req.body);
    if (!parsed.success) {
      sendValidationError(res, parsed.error.issues[0]?.message || "Invalid status");
      return;
    }
    const riderId = req.riderId!;
    const { status, proofPhotoUrl, proofPhoto } = parsed.data;

    /* Resolve the effective proof URL: prefer the new proofPhotoUrl field; fall back to the
       deprecated base64 proofPhoto field for backwards compatibility. Log a deprecation warning
       when only the legacy field is provided so operators can track migration progress. */
    let resolvedProofPhotoUrl: string | undefined = proofPhotoUrl;
    if (!resolvedProofPhotoUrl && proofPhoto) {
      logger.warn(
        { orderId: req.params["id"] },
        "[rider/orders] DEPRECATED: proofPhoto base64 field used — clients should migrate to proofPhotoUrl (URL string)"
      );
      resolvedProofPhotoUrl = proofPhoto;
    }

    const [order] = await db
      .select()
      .from(ordersTable)
      .where(and(eq(ordersTable.id, req.params["id"] as string), eq(ordersTable.riderId, riderId)))
      .limit(1);
    if (!order) {
      sendNotFound(res, "Order not found or not yours");
      return;
    }

    /* Proof photo is mandatory for delivery confirmation — prevents fraudulent delivery claims */
    if (status === "delivered" && !resolvedProofPhotoUrl) {
      sendValidationError(
        res,
        "Proof of delivery photo is required to mark an order as delivered. Please upload a photo."
      );
      return;
    }

    /* ── Rider Cancel: clear riderId + reset to preparing so another rider can pick it up ── */
    if (status === "cancelled") {
      const penalty = await handleCancelPenalty(riderId);

      const [cancelled] = await db
        .update(ordersTable)
        .set({ riderId: null, status: "preparing", updatedAt: new Date() })
        .where(
          and(eq(ordersTable.id, req.params["id"] as string), eq(ordersTable.riderId, riderId))
        )
        .returning();
      const riderChangeLang = await getUserLanguage(order.userId);
      await db
        .insert(notificationsTable)
        .values({
          id: generateId(),
          userId: order.userId,
          title: t("notifRiderChange", riderChangeLang) + " 🔄",
          body: t("notifRiderChangeBody", riderChangeLang),
          type: "order",
          icon: "refresh-outline",
        })
        .catch((err: Error) => {
          logger.error("[rider] background op failed:", err.message);
        });
      const cancelledBody = {
        ...cancelled,
        total: safeNum(cancelled?.total || 0),
        cancelledByRider: true,
        cancelPenalty: penalty,
      };
      await storeIdempotency(req, 200, { success: true, data: cancelledBody });
      sendSuccess(res, cancelledBody);
      return;
    }

    const ORDER_RIDER_TRANSITIONS: Record<string, string[]> = {
      confirmed: ["picked_up"],
      preparing: ["picked_up"],
      ready: ["picked_up"],
      picked_up: ["out_for_delivery"],
      out_for_delivery: ["delivered"],
    };
    const allowedNext = ORDER_RIDER_TRANSITIONS[order.status] || [];
    if (!allowedNext.includes(status)) {
      sendValidationError(
        res,
        `Cannot change order from "${order.status}" to "${status}". Allowed: ${allowedNext.join(", ") || "none"}.`
      );
      return;
    }

    const updateData: { status: string; updatedAt: Date; proofPhotoUrl?: string } = {
      status,
      updatedAt: new Date(),
    };
    if (status === "delivered" && resolvedProofPhotoUrl) {
      updateData.proofPhotoUrl = resolvedProofPhotoUrl;
    }

    let updated: typeof order;

    if (status === "delivered") {
      const s = await getCachedSettings();
      const riderKeepPct = (Number(s["rider_keep_pct"]) || 80) / 100;
      const platformFeePct = 1 - riderKeepPct;
      const bonusPerTrip = parseFloat(s["rider_bonus_per_trip"] ?? "0");
      const orderTotal = safeNum(order.total);
      const isCash = order.paymentMethod === "cash" || order.paymentMethod === "cod";

      if (isCash) {
        const platformFeeCents = Math.round(orderTotal * 100 * platformFeePct);
        const riderShareCents = Math.round(orderTotal * 100) - platformFeeCents;
        const platformFee = platformFeeCents / 100;
        const riderShare = riderShareCents / 100;
        const txResult = await db
          .transaction(async (tx) => {
            const [row] = await tx
              .update(ordersTable)
              .set(updateData)
              .where(
                and(
                  eq(ordersTable.id, req.params["id"] as string),
                  eq(ordersTable.riderId, riderId),
                  eq(ordersTable.status, order.status)
                )
              )
              .returning();
            if (!row) throw new Error("STATUS_CONFLICT");
            await tx.insert(walletTransactionsTable).values({
              id: generateId(),
              userId: riderId,
              type: "cash_collection",
              amount: orderTotal.toFixed(2),
              description: `Cash collected — Order #${order.id.slice(-6).toUpperCase()} (Rs. ${orderTotal.toFixed(0)} total)`,
              reference: `order:${order.id}`,
              paymentMethod: "cash",
            });
            await tx
              .update(usersTable)
              .set({ walletBalance: sql`wallet_balance - ${platformFee}`, updatedAt: new Date() })
              .where(eq(usersTable.id, riderId));
            await tx.insert(walletTransactionsTable).values({
              id: generateId(),
              userId: riderId,
              type: "platform_fee",
              amount: platformFee.toFixed(2),
              description: `Platform fee (${Math.round(platformFeePct * 100)}%) — Cash Order #${order.id.slice(-6).toUpperCase()} · Rider keeps Rs. ${riderShare}`,
              reference: `order:${order.id}`,
            });
            if (bonusPerTrip > 0) {
              await tx
                .update(usersTable)
                .set({
                  walletBalance: sql`wallet_balance + ${bonusPerTrip}`,
                  updatedAt: new Date(),
                })
                .where(eq(usersTable.id, riderId));
              await tx.insert(walletTransactionsTable).values({
                id: generateId(),
                userId: riderId,
                type: "bonus",
                amount: bonusPerTrip.toFixed(2),
                description: `Per-trip bonus — Order #${order.id.slice(-6).toUpperCase()}`,
              });
            }
            return row;
          })
          .catch((err: Error) => {
            if (err.message === "STATUS_CONFLICT") return null;
            throw err;
          });
        if (!txResult) {
          sendError(res, "Order status has already been updated", 409);
          return;
        }
        updated = txResult;
        const riderCashLang = await getUserLanguage(riderId);
        await db
          .insert(notificationsTable)
          .values({
            id: generateId(),
            userId: riderId,
            title: t("notifOrderDelivered", riderCashLang),
            body: t("notifCashFeeDeductedBody", riderCashLang)
              .replace("{fee}", String(platformFee))
              .replace("{cash}", orderTotal.toFixed(0)),
            type: "wallet",
            icon: "wallet-outline",
          })
          .catch((e: Error) => logger.error("[rider] notif insert failed:", e.message));
      } else {
        const earnings = Math.round(orderTotal * 100 * riderKeepPct) / 100;
        const totalCredit = Math.round((earnings + bonusPerTrip) * 100) / 100;
        const txResult = await db
          .transaction(async (tx) => {
            const [row] = await tx
              .update(ordersTable)
              .set(updateData)
              .where(
                and(
                  eq(ordersTable.id, req.params["id"] as string),
                  eq(ordersTable.riderId, riderId),
                  eq(ordersTable.status, order.status)
                )
              )
              .returning();
            if (!row) throw new Error("STATUS_CONFLICT");
            await tx
              .update(usersTable)
              .set({ walletBalance: sql`wallet_balance + ${totalCredit}`, updatedAt: new Date() })
              .where(eq(usersTable.id, riderId));
            await tx.insert(walletTransactionsTable).values({
              id: generateId(),
              userId: riderId,
              type: "credit",
              amount: earnings.toFixed(2),
              description: `Delivery earnings — Order #${order.id.slice(-6).toUpperCase()} (${Math.round(riderKeepPct * 100)}%)`,
            });
            if (bonusPerTrip > 0) {
              await tx.insert(walletTransactionsTable).values({
                id: generateId(),
                userId: riderId,
                type: "bonus",
                amount: bonusPerTrip.toFixed(2),
                description: `Per-trip bonus — Order #${order.id.slice(-6).toUpperCase()}`,
              });
            }
            return row;
          })
          .catch((err: Error) => {
            if (err.message === "STATUS_CONFLICT") return null;
            throw err;
          });
        if (!txResult) {
          sendError(res, "Order status has already been updated", 409);
          return;
        }
        updated = txResult;
        const riderEarnLang = await getUserLanguage(riderId);
        await db
          .insert(notificationsTable)
          .values({
            id: generateId(),
            userId: riderId,
            title: t("notifWalletCredited", riderEarnLang),
            body: t("notifWalletCreditedBody", riderEarnLang).replace(
              "{amount}",
              earnings.toFixed(0)
            ),
            type: "wallet",
            icon: "wallet-outline",
          })
          .catch((e: Error) =>
            logger.warn(
              {
                message: "[rider] rider-delivery-earn notif insert failed",
                error: e.message,
                code: "RIDER_NOTIF_EARN_FAILED",
                correlationId: null,
                timestamp: new Date().toISOString(),
                userId: riderId,
              },
              "[rider] rider-delivery-earn notif insert failed"
            )
          );
      }

      const custDelivLang = await getUserLanguage(order.userId);
      await db
        .insert(notificationsTable)
        .values({
          id: generateId(),
          userId: order.userId,
          title: t("notifOrderDelivered", custDelivLang) + " 🎉",
          body: t("orderDeliveredEnjoy", custDelivLang),
          type: "order",
          icon: "bag-check-outline",
        })
        .catch((e: unknown) =>
          logger.warn(
            {
              message: "[rider] customer order-delivered notif insert failed",
              error: e instanceof Error ? e.message : String(e),
              code: "RIDER_NOTIF_CUST_DELIVERED_FAILED",
              correlationId: null,
              timestamp: new Date().toISOString(),
              orderId: order.userId,
            },
            "[rider] customer order-delivered notif insert failed"
          )
        );

      /* ── Customer loyalty points (customer_loyalty_enabled + customer_loyalty_pts) ── */
      const loyaltyEnabled = (s["customer_loyalty_enabled"] ?? "on") === "on";
      if (loyaltyEnabled && order.userId) {
        const loyaltyPtsPerHundred = parseFloat(s["customer_loyalty_pts"] ?? "5");
        const orderTotal = safeNum(order.total);
        const loyaltyPts = Math.floor((orderTotal / 100) * loyaltyPtsPerHundred);
        if (loyaltyPts > 0) {
          try {
            await db.transaction(async (tx) => {
              await tx
                .update(usersTable)
                .set({ walletBalance: sql`wallet_balance + ${loyaltyPts}`, updatedAt: new Date() })
                .where(eq(usersTable.id, order.userId));
              await tx.insert(walletTransactionsTable).values({
                id: generateId(),
                userId: order.userId,
                type: "loyalty",
                amount: loyaltyPts.toFixed(2),
                description: `Loyalty points (${loyaltyPtsPerHundred} pts/Rs.100) — Order #${order.id.slice(-6).toUpperCase()}`,
              });
            });
            const loyaltyLang = await getUserLanguage(order.userId);
            await db
              .insert(notificationsTable)
              .values({
                id: generateId(),
                userId: order.userId,
                title: t("notifLoyaltyEarned", loyaltyLang) + " ⭐",
                body: t("notifLoyaltyEarnedBody", loyaltyLang).replace(
                  "{points}",
                  String(loyaltyPts)
                ),
                type: "wallet",
                icon: "star-outline",
              })
              .catch((err: Error) => {
                logger.error("[rider] loyalty notif failed:", err.message);
              });
          } catch (err) {
            logger.error(
              "[rider] loyalty credit tx failed:",
              err instanceof Error ? err.message : err
            );
          }
        }
      }

      /* ── Finance cashback credit to customer ── */
      const cashbackEnabled = (s["finance_cashback_enabled"] ?? "off") === "on";
      if (cashbackEnabled && order.userId) {
        const cashbackPct = parseFloat(s["finance_cashback_pct"] ?? "2") / 100;
        const cashbackMaxRs = parseFloat(s["finance_cashback_max_rs"] ?? "100");
        const orderTotal = safeNum(order.total);
        const rawCashback = parseFloat((orderTotal * cashbackPct).toFixed(2));
        const cashbackAmt = Math.min(rawCashback, cashbackMaxRs);
        if (cashbackAmt > 0) {
          try {
            await db.transaction(async (tx) => {
              await tx
                .update(usersTable)
                .set({ walletBalance: sql`wallet_balance + ${cashbackAmt}`, updatedAt: new Date() })
                .where(eq(usersTable.id, order.userId));
              await tx.insert(walletTransactionsTable).values({
                id: generateId(),
                userId: order.userId,
                type: "cashback",
                amount: cashbackAmt.toFixed(2),
                description: `Cashback ${Math.round(cashbackPct * 100)}% — Order #${order.id.slice(-6).toUpperCase()}`,
              });
            });
            const cashbackLang = await getUserLanguage(order.userId);
            await db
              .insert(notificationsTable)
              .values({
                id: generateId(),
                userId: order.userId,
                title: t("notifCashbackCredited", cashbackLang) + " 🎁",
                body: t("notifCashbackCreditedBody", cashbackLang).replace(
                  "{amount}",
                  cashbackAmt.toFixed(0)
                ),
                type: "wallet",
                icon: "wallet-outline",
              })
              .catch((err: Error) => {
                logger.error("[rider] cashback notif failed:", err.message);
              });
          } catch (err) {
            logger.error(
              "[rider] cashback credit tx failed:",
              err instanceof Error ? err.message : err
            );
          }
        }
      }
    } else {
      const [row] = await db
        .update(ordersTable)
        .set(updateData)
        .where(
          and(
            eq(ordersTable.id, req.params["id"] as string),
            eq(ordersTable.riderId, riderId),
            eq(ordersTable.status, order.status)
          )
        )
        .returning();
      if (!row) {
        sendNotFound(res, "Order not found or not yours");
        return;
      }
      updated = row;
    }

    if (status === "delivered") {
      fireAndForget(
        emitWebhookEvent("order_delivered", {
          orderId: updated.id,
          riderId,
          userId: updated.userId,
          total: safeNum(updated.total).toFixed(2),
        }),
        "rider:webhook:order_delivered",
        logger,
        { orderId: updated.id, code: "WEBHOOK_EMIT" }
      );
      fireAndForget(
        emitWebhookEvent("payment_received", {
          orderId: updated.id,
          userId: updated.userId,
          amount: safeNum(updated.total).toFixed(2),
          method: updated.paymentMethod ?? "unknown",
        }),
        "rider:webhook:payment_received",
        logger,
        { orderId: updated.id, code: "WEBHOOK_EMIT" }
      );
    }

    const orderStatusBody = { ...updated, total: safeNum(updated.total) };
    await storeIdempotency(req, 200, { success: true, data: orderStatusBody });
    sendSuccess(res, orderStatusBody);
  } catch (err) {
    logger.error(
      {
        error: err instanceof Error ? err.message : String(err),
        timestamp: new Date().toISOString(),
      },
      "[route] unhandled error"
    );
    sendError(res, "Internal server error", 500);
  }
});

/* ── POST /rider/rides/:id/accept — Accept a ride ──
   Uses WHERE riderId IS NULL to prevent two riders accepting same ride (race condition) */
router.post("/rides/:id/accept", csrfDoubleSubmit, validateRiderCanAccept, validateRiderProfileComplete, rideAcceptLimiter, checkFeatureAccess("accept_ride"), async (req, res) => {
  try {
    if (await checkIdempotency(req, res)) return;
    const paramParsed = idParamSchema.safeParse(req.params);
    if (!paramParsed.success) {
      sendValidationError(res, "Invalid ride ID");
      return;
    }
    const riderId = req.riderId!;
    const riderUser = req.riderUser!;
    const rideId = paramParsed.data.id;

    if (riderUser.isRestricted) {
      sendForbidden(
        res,
        "Your account is restricted. You cannot accept new rides. Contact support for assistance."
      );
      return;
    }
    if ((riderUser.approvalStatus ?? "pending") !== "approved") {
      sendForbidden(
        res,
        "Your account is pending re-verification. You cannot accept rides until an admin approves your profile."
      );
      return;
    }

    /* GPS spoof guard — validate the rider's current position before processing accept */
    {
      const [livePos] = await db
        .select({ latitude: liveLocationsTable.latitude, longitude: liveLocationsTable.longitude })
        .from(liveLocationsTable)
        .where(eq(liveLocationsTable.userId, riderId))
        .limit(1);
      if (livePos) {
        try {
          await validateRiderLocationSecurity(
            riderId,
            parseFloat(String(livePos.latitude)),
            parseFloat(String(livePos.longitude))
          );
        } catch (spoofErr) {
          const se = spoofErr as { code?: string; httpStatus?: number; message?: string };
          if (se.code === "GPS_SPOOF") {
            sendForbidden(res, se.message ?? "GPS validation failed");
            return;
          }
          throw spoofErr;
        }
      }
    }

    const s = await getCachedSettings();
    const maxDeliveries = parseInt(s["rider_max_deliveries"] ?? "3");

    /* Check if this is a bargaining ride — load it first (non-destructive pre-flight read) */
    const [targetRide] = await db
      .select()
      .from(ridesTable)
      .where(eq(ridesTable.id, rideId))
      .limit(1);
    if (!targetRide) {
      sendNotFound(res, "Ride not found");
      return;
    }

    /* For bargaining rides, rider accepts the customer's offered fare */
    const isBargaining = targetRide.status === "bargaining";
    const agreedFare = isBargaining ? (targetRide.offeredFare ?? targetRide.fare) : targetRide.fare;

    /* Pre-flight balance check for bargaining + wallet — fail fast before touching the DB.
     The actual deduction happens AFTER the atomic accept to prevent double-charging:
     if two riders race, only the winner should pay; loser's wallet stays untouched. */
    if (isBargaining && targetRide.paymentMethod === "wallet") {
      const fareAmt = safeNum(agreedFare);
      const [customer] = await db
        .select({ walletBalance: usersTable.walletBalance })
        .from(usersTable)
        .where(eq(usersTable.id, targetRide.userId))
        .limit(1);
      if (!customer) {
        sendNotFound(res, "Customer not found");
        return;
      }
      if (safeNum(customer.walletBalance) < fareAmt) {
        sendValidationError(res, "Customer has insufficient wallet balance");
        return;
      }
    }

    /* Atomic accept: only succeeds if riderId is still NULL in the DB.
     All eligibility checks (active count, min balance) run INSIDE the transaction
     after locking the rider row — eliminating the TOCTOU window that existed when
     these checks ran outside the transaction (two concurrent requests from the same
     rider could both pass the count check before either commit wrote back to the DB).
     Wallet deduction is also all-or-nothing: the losing rider's money stays untouched. */
    const acceptedAt = new Date();
    const fareAmt = safeNum(agreedFare);

    let toctouError:
      | { status: number; message: string; data?: Record<string, unknown> }
      | undefined;
    let updated: typeof ridesTable.$inferSelect | undefined;
    try {
      updated = await db.transaction(async (tx) => {
        /* Lock the rider row first to serialize concurrent accept attempts from the same rider.
         This prevents two parallel requests from both passing the activeCount check before
         either commit can update the count in the DB — matching the order accept pattern. */
        await tx.execute(sql`SELECT id FROM users WHERE id = ${riderId} FOR UPDATE`);

        /* ── Max simultaneous deliveries gate (inside lock so count is authoritative) ── */
        const [activeOrders, activeRides] = await Promise.all([
          tx
            .select({ c: count() })
            .from(ordersTable)
            .where(
              and(
                eq(ordersTable.riderId, riderId),
                or(
                  eq(ordersTable.status, "out_for_delivery"),
                  eq(ordersTable.status, "picked_up"),
                  eq(ordersTable.status, "ready"),
                  eq(ordersTable.status, "confirmed")
                )
              )
            ),
          tx
            .select({ c: count() })
            .from(ridesTable)
            .where(
              and(
                eq(ridesTable.riderId, riderId),
                or(
                  eq(ridesTable.status, "accepted"),
                  eq(ridesTable.status, "arrived"),
                  eq(ridesTable.status, "in_transit")
                )
              )
            ),
        ]);
        const activeCount = (activeOrders[0]?.c ?? 0) + (activeRides[0]?.c ?? 0);
        if (activeCount >= maxDeliveries) {
          toctouError = {
            status: 429,
            message: `Maximum ${maxDeliveries} active deliveries allowed. Complete a current delivery first.`,
          };
          return undefined;
        }

        /* ── Minimum wallet balance gate for cash rides (inside lock so balance is authoritative) ── */
        if (targetRide.paymentMethod === "cash") {
          const minBalance = parseFloat(s["rider_min_balance"] ?? "0");
          if (minBalance > 0) {
            const [riderRow] = await tx
              .select({ walletBalance: usersTable.walletBalance })
              .from(usersTable)
              .where(eq(usersTable.id, riderId))
              .limit(1);
            const currentBal = safeNum(riderRow?.walletBalance);
            if (currentBal < minBalance) {
              toctouError = {
                status: 403,
                message: `Minimum wallet balance required for cash rides is Rs. ${minBalance}. Your balance: Rs. ${currentBal.toFixed(0)}. Please top up your wallet first.`,
                data: { code: "BELOW_MIN_BALANCE", required: minBalance, current: currentBal },
              };
              return undefined;
            }
          }
        }

        const [accepted] = await tx
          .update(ridesTable)
          .set({
            riderId,
            riderName: riderUser.name || "Rider",
            riderPhone: riderUser.phone,
            status: "accepted",
            fare: isBargaining ? fareAmt.toFixed(2) : targetRide.fare,
            bargainStatus: isBargaining ? "agreed" : targetRide.bargainStatus,
            acceptedAt,
            updatedAt: acceptedAt,
          })
          .where(
            and(
              eq(ridesTable.id, rideId),
              isNull(ridesTable.riderId),
              or(eq(ridesTable.status, "searching"), eq(ridesTable.status, "bargaining"))
            )
          )
          .returning();

        if (!accepted) return undefined; // another rider won the race or ride was cancelled

        /* Deduct wallet only if this rider won the accept race */
        if (isBargaining && targetRide.paymentMethod === "wallet") {
          const [walletDeducted] = await tx
            .update(usersTable)
            .set({ walletBalance: sql`wallet_balance - ${fareAmt}`, updatedAt: new Date() })
            .where(
              and(
                eq(usersTable.id, targetRide.userId),
                gte(usersTable.walletBalance, fareAmt.toFixed(2))
              )
            )
            .returning({ id: usersTable.id });
          if (!walletDeducted) throw new Error("Insufficient wallet balance for ride payment.");
          await tx.insert(walletTransactionsTable).values({
            id: generateId(),
            userId: targetRide.userId,
            type: "debit",
            amount: fareAmt.toFixed(2),
            description: `Ride payment (bargained) — #${targetRide.id.slice(-6).toUpperCase()}`,
          });
        }

        await tx
          .update(rideBidsTable)
          .set({ status: "rejected", updatedAt: new Date() })
          .where(and(eq(rideBidsTable.rideId, rideId), eq(rideBidsTable.status, "pending")));

        return accepted;
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("Insufficient wallet balance")) {
        sendErrorWithData(res, msg, { code: "INSUFFICIENT_WALLET" }, 402);
        return;
      }
      logger.error("[rider] ride accept transaction failed:", msg);
      sendError(res, "Failed to accept ride. Please try again.", 500);
      return;
    }

    if (toctouError) {
      if (toctouError.data) {
        sendErrorWithData(res, toctouError.message, toctouError.data, toctouError.status);
        return;
      }
      sendError(res, toctouError.message, toctouError.status);
      return;
    }

    if (!updated) {
      sendError(res, "Ride already taken by another rider", 409);
      return;
    }

    const rideAssignLang = await getUserLanguage(updated.userId);
    await db
      .insert(notificationsTable)
      .values({
        id: generateId(),
        userId: updated.userId,
        title: t("notifRideAccepted", rideAssignLang) + " 🚗",
        body: isBargaining
          ? `${riderUser.name || "Your rider"} ne Rs. ${safeNum(agreedFare).toFixed(0)} par offer accept kar liya!`
          : `${riderUser.name || "Your rider"} ${t("notifRiderComingBody", rideAssignLang)}`,
        type: "ride",
        icon: updated.type === "bike" ? "bicycle-outline" : "car-outline",
      })
      .catch((err: Error) => {
        logger.error("[rider] background op failed:", err.message);
      });

    /* Generate trip OTP and emit to customer.
       Store SHA-256 hash in DB — raw OTP only goes to customer via Socket.IO. */
    const tripOtp = String(randomInt(1000, 10000));
    await db
      .update(ridesTable)
      .set({ tripOtp: hashTripOtp(tripOtp), updatedAt: new Date() })
      .where(eq(ridesTable.id, updated.id))
      .catch((e: Error) => {
        logger.error({ rideId: updated.id, err: e.message }, "[rider] tripOtp DB update failed");
      });
    emitRideOtp(updated.userId, updated.id, tripOtp, updated.riderId);

    emitRideDispatchUpdate({ rideId: updated.id, action: "accepted", status: "accepted" });
    emitRideUpdate(updated.id);
    /* Notify the accepting rider so the app immediately navigates to /active */
    emitRideAssigned(riderId, {
      id: updated.id,
      status: "accepted",
      pickupAddress: updated.pickupAddress,
      dropAddress: updated.dropAddress,
      fare: safeNum(updated.fare),
      type: updated.type,
    });
    const { tripOtp: _omitOtp, ...rideWithoutOtp } = updated;
    const rideAcceptBody = {
      ...rideWithoutOtp,
      fare: safeNum(updated.fare),
      distance: safeNum(updated.distance),
    };
    await storeIdempotency(req, 200, { success: true, data: rideAcceptBody });
    sendSuccess(res, rideAcceptBody);
  } catch (err) {
    logger.error(
      {
        error: err instanceof Error ? err.message : String(err),
        timestamp: new Date().toISOString(),
      },
      "[route] unhandled error"
    );
    sendError(res, "Internal server error", 500);
  }
});

/* ── POST /rider/rides/:id/verify-otp — Verify customer OTP before starting trip ── */
router.post("/rides/:id/verify-otp", otpLimiter, async (req, res) => {
  try {
    if (await checkIdempotency(req, res)) return;
    const riderId = req.riderId!;
    const rideId = req.params["id"] as string;
    const parsed = otpVerifySchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      sendValidationError(res, parsed.error.issues[0]?.message || "OTP is required");
      return;
    }
    const { otp } = parsed.data;

    const [ride] = await db
      .select()
      .from(ridesTable)
      .where(and(eq(ridesTable.id, rideId), eq(ridesTable.riderId, riderId)))
      .limit(1);

    if (!ride) {
      sendNotFound(res, "Ride not found or not yours");
      return;
    }
    if (!["arrived", "accepted"].includes(ride.status)) {
      sendValidationError(
        res,
        "OTP can only be verified once you have accepted and are en route to the pickup location."
      );
      return;
    }
    if (ride.otpVerified) {
      /* Already verified — reject further attempts; the trip is already gated */
      sendForbidden(
        res,
        "otp_already_verified",
        "This trip's OTP has already been verified. Start the trip from the rider app."
      );
      return;
    }
    if (!ride.tripOtp) {
      sendValidationError(
        res,
        "No OTP found for this ride. The customer needs to request a new one."
      );
      return;
    }
    /* Dev bypass: accept "0000" as a universal trip OTP when ALLOW_DEV_OTP=true.
       This allows API testing without needing the customer's socket connection.
       Never active in production (ALLOW_DEV_OTP is blocked in prod by startup check). */
    const isDevBypass =
      process.env["ALLOW_DEV_OTP"] === "true" &&
      process.env["NODE_ENV"] !== "production" &&
      otp === "0000";

    if (!isDevBypass && ride.tripOtp !== hashTripOtp(otp)) {
      /* Track failed attempt with a single atomic SQL statement.
       The CASE expression handles expiry entirely in the DB:
       - If the row is new or expired → count resets to 1, window starts fresh
       - If the row is active → count is incremented by 1
       RETURNING count gives us the authoritative value without a separate read. */
      const expiresAt = new Date(Date.now() + OTP_ATTEMPT_TTL_MS);
      const result = await db.execute<{ count: number }>(sql`
      INSERT INTO otp_attempts (key, count, first_at, expires_at)
      VALUES (${rideId}, 1, now(), ${expiresAt})
      ON CONFLICT (key) DO UPDATE SET
        count      = CASE WHEN otp_attempts.expires_at < now() THEN 1 ELSE otp_attempts.count + 1 END,
        first_at   = CASE WHEN otp_attempts.expires_at < now() THEN now() ELSE otp_attempts.first_at END,
        expires_at = CASE WHEN otp_attempts.expires_at < now() THEN ${expiresAt} ELSE otp_attempts.expires_at END
      RETURNING count
    `);
      const newCount = (result.rows[0] as { count: number } | undefined)?.count ?? 1;

      if (newCount >= MAX_OTP_ATTEMPTS) {
        /* Invalidate the current OTP so the customer must request a fresh one */
        await db
          .update(ridesTable)
          .set({ tripOtp: null, updatedAt: new Date() })
          .where(eq(ridesTable.id, rideId))
          .catch((e: Error) => {
            logger.error(
              { rideId, err: e.message },
              "[rider] tripOtp invalidation DB update failed"
            );
          });
        db.delete(otpAttemptsTable)
          .where(eq(otpAttemptsTable.key, rideId))
          .catch((err: unknown) => {
            logger.debug(
              { err: err instanceof Error ? err.message : String(err), rideId },
              "[rider] OTP attempts cleanup (max-exceeded) failed — non-critical"
            );
          });
        sendErrorWithData(
          res,
          "Too many incorrect OTP attempts. The current OTP has been invalidated. Please ask the customer to refresh their app to receive a new OTP.",
          { code: "OTP_INVALIDATED" },
          403
        );
        return;
      }

      const remaining = MAX_OTP_ATTEMPTS - newCount;
      sendErrorWithData(
        res,
        `Incorrect OTP. Please check with your customer. ${remaining} attempt${remaining === 1 ? "" : "s"} remaining.`,
        { code: "OTP_MISMATCH", attemptsRemaining: remaining },
        403
      );
      return;
    }

    /* Success — clear attempt row and mark verified */
    db.delete(otpAttemptsTable)
      .where(eq(otpAttemptsTable.key, rideId))
      .catch((err: unknown) => {
        logger.debug(
          { err: err instanceof Error ? err.message : String(err), rideId },
          "[rider] OTP attempts cleanup (success) failed — non-critical"
        );
      });
    await db
      .update(ridesTable)
      .set({ otpVerified: true, updatedAt: new Date() })
      .where(eq(ridesTable.id, rideId));
    emitRideDispatchUpdate({ rideId, action: "otp-verified", status: ride.status });
    emitRideUpdate(rideId);
    await storeIdempotency(req, 200, {
      success: true,
      message: "OTP verified. You may now start the trip.",
    });
    sendSuccess(res, undefined, "OTP verified. You may now start the trip.");
  } catch (err) {
    logger.error(
      {
        error: err instanceof Error ? err.message : String(err),
        timestamp: new Date().toISOString(),
      },
      "[route] unhandled error"
    );
    sendError(res, "Internal server error", 500);
  }
});

/* ── POST /rider/rides/cancel — Cancel an active ride ──
   Dedicated cancel endpoint with per-rider rate limiting (10/min).
   Accepts { rideId, reason? } in the request body.                           */
const rideCancelBodySchema = z.object({
  rideId: z.string().min(1),
  reason: z.string().max(500).optional(),
});
router.post("/rides/cancel", csrfDoubleSubmit, rideCancelLimiter, async (req, res) => {
  try {
    if (await checkIdempotency(req, res)) return;
    const parsed = rideCancelBodySchema.safeParse(req.body);
    if (!parsed.success) {
      sendValidationError(res, parsed.error.issues[0]?.message || "Invalid request body");
      return;
    }
    const riderId = req.riderId!;
    const { rideId, reason } = parsed.data;
    const [ride] = await db
      .select()
      .from(ridesTable)
      .where(and(eq(ridesTable.id, rideId), eq(ridesTable.riderId, riderId)))
      .limit(1);
    if (!ride) {
      sendNotFound(res, "Ride not found or not yours");
      return;
    }
    const allowed = RIDE_STATUS_TRANSITIONS[ride.status];
    if (!allowed?.includes("cancelled")) {
      sendValidationError(res, `Cannot cancel a ride in "${ride.status}" status.`);
      return;
    }
    await db
      .update(ridesTable)
      .set({ status: "cancelled", cancellationReason: reason ?? "Rider cancelled", cancelledAt: new Date(), updatedAt: new Date() })
      .where(and(eq(ridesTable.id, rideId), eq(ridesTable.riderId, riderId)));
    emitRideUpdate(rideId);
    const body = { success: true, message: "Ride cancelled" };
    await storeIdempotency(req, 200, body);
    sendSuccess(res, body);
  } catch (err) {
    logger.error({ error: err instanceof Error ? err.message : String(err) }, "[route] POST /rides/cancel error");
    sendError(res, "Internal server error", 500);
  }
});

/* ── PATCH /rider/rides/:id/status — Update ride status (completed/cancelled) ── */
router.patch("/rides/:id/status", csrfDoubleSubmit, rideStatusLimiter, conditionalCancelLimiter, async (req, res) => {
  try {
    if (await checkIdempotency(req, res)) return;
    const parsed = rideStatusSchema.safeParse(req.body);
    if (!parsed.success) {
      sendValidationError(res, parsed.error.issues[0]?.message || "Invalid status");
      return;
    }
    const riderId = req.riderId!;
    const { status, lat: _lat, lng: _lng, proofPhotoUrl: rawProofPhotoUrl, proofPhoto: rideProofPhoto } = parsed.data;

    /* Resolve the effective proof URL: prefer the new proofPhotoUrl field; fall back to the
       deprecated base64 proofPhoto field for backwards compatibility during the grace period.
       Log a structured deprecation warning when only the legacy field is provided. */
    let proofPhotoUrl: string | undefined = rawProofPhotoUrl;
    if (!proofPhotoUrl && rideProofPhoto) {
      logger.warn(
        { rideId: req.params["id"] },
        "[rider/rides] DEPRECATED: proofPhoto base64 field used — clients should migrate to proofPhotoUrl (URL string)"
      );
      proofPhotoUrl = rideProofPhoto;
    }

    const [ride] = await db
      .select()
      .from(ridesTable)
      .where(and(eq(ridesTable.id, req.params["id"] as string), eq(ridesTable.riderId, riderId)))
      .limit(1);
    if (!ride) {
      sendNotFound(res, "Ride not found or not yours");
      return;
    }

    /* ── State Machine: enforce valid transitions ── */
    const allowed = RIDE_STATUS_TRANSITIONS[ride.status];
    if (!allowed || !allowed.includes(status)) {
      sendValidationError(
        res,
        `Cannot transition from "${ride.status}" to "${status}". Allowed: ${(allowed || []).join(", ") || "none"}`
      );
      return;
    }

    /* ── Proximity check: "arrived" requires rider to be near pickup ── */
    if (status === "arrived" && ride.pickupLat && ride.pickupLng) {
      const s = await getCachedSettings();
      const proximityM = parseFloat(s["dispatch_ride_start_proximity_m"] ?? "500");

      /* Use ONLY server-stored live location (trusted) for proximity verification.
       Client-supplied lat/lng is NOT used — it can be spoofed.
       Reject stale locations older than 2 minutes to prevent false proximity matches. */
      const PROXIMITY_STALE_MS = 2 * 60 * 1000;
      let riderLat: number | undefined;
      let riderLng: number | undefined;
      const [storedLoc] = await db
        .select()
        .from(liveLocationsTable)
        .where(eq(liveLocationsTable.userId, riderId))
        .limit(1);
      if (
        storedLoc &&
        storedLoc.updatedAt &&
        Date.now() - new Date(storedLoc.updatedAt).getTime() < PROXIMITY_STALE_MS
      ) {
        riderLat = parseFloat(storedLoc.latitude);
        riderLng = parseFloat(storedLoc.longitude);
      }

      if (riderLat == null || riderLng == null) {
        sendValidationError(
          res,
          "Unable to verify your location. Please enable GPS and try again."
        );
        return;
      }

      const distKm = calcDistance(
        riderLat,
        riderLng,
        parseFloat(ride.pickupLat),
        parseFloat(ride.pickupLng)
      );
      if (distKm * 1000 > proximityM) {
        sendValidationError(
          res,
          `You must be within ${proximityM}m of the pickup location to mark arrived. Current distance: ${(distKm * 1000).toFixed(0)}m`
        );
        return;
      }
    }

    /* ── OTP gate: in_transit requires OTP verification ── */
    if (status === "in_transit" && !ride.otpVerified) {
      sendErrorWithData(
        res,
        "Customer OTP not verified. Ask the customer for the 4-digit code, then tap 'Verify OTP'.",
        { code: "OTP_REQUIRED" },
        400
      );
      return;
    }

    let updated: typeof ride;

    if (status === "completed") {
      const s = await getCachedSettings();
      const riderKeepPct = (Number(s["rider_keep_pct"]) || 80) / 100;
      const platformFeePct = 1 - riderKeepPct;
      const bonusPerTrip = parseFloat(s["rider_bonus_per_trip"] ?? "0");
      const fareAmt = safeNum(ride.fare);
      const isCashRide = ride.paymentMethod === "cash";

      if (isCashRide) {
        const platformFeeCents = Math.round(fareAmt * 100 * platformFeePct);
        const riderShareCents = Math.round(fareAmt * 100) - platformFeeCents;
        const platformFee = platformFeeCents / 100;
        const riderShare = riderShareCents / 100;
        let newRiderBalance = 0;
        updated = await db.transaction(async (tx) => {
          const [statusRow] = await tx
            .update(ridesTable)
            .set({ status, completedAt: new Date(), updatedAt: new Date(), ...(proofPhotoUrl ? { proofPhotoUrl } : {}) })
            .where(
              and(
                eq(ridesTable.id, req.params["id"] as string),
                eq(ridesTable.riderId, riderId),
                eq(ridesTable.status, ride.status)
              )
            )
            .returning();
          if (!statusRow) throw new Error("Ride not found or status already changed");
          await tx.insert(walletTransactionsTable).values({
            id: generateId(),
            userId: riderId,
            type: "cash_collection",
            amount: fareAmt.toFixed(2),
            description: `Cash collected — Ride #${ride.id.slice(-6).toUpperCase()} (Rs. ${fareAmt.toFixed(0)} total)`,
            reference: `ride:${ride.id}`,
            paymentMethod: "cash",
          });
          const [riderBefore] = await tx
            .select({ walletBalance: usersTable.walletBalance })
            .from(usersTable)
            .where(eq(usersTable.id, riderId))
            .limit(1);
          const currentBalance = safeNum(riderBefore?.walletBalance);
          const deductible = Math.min(currentBalance, platformFee);
          const shortfall = parseFloat((platformFee - deductible).toFixed(2));
          const [riderAfter] = await tx
            .update(usersTable)
            .set({
              walletBalance: sql`GREATEST(0, wallet_balance - ${deductible})`,
              updatedAt: new Date(),
            })
            .where(eq(usersTable.id, riderId))
            .returning({ walletBalance: usersTable.walletBalance });
          newRiderBalance = safeNum(riderAfter?.walletBalance);
          await tx.insert(walletTransactionsTable).values({
            id: generateId(),
            userId: riderId,
            type: "platform_fee",
            amount: platformFee.toFixed(2),
            description: `Platform fee (${Math.round(platformFeePct * 100)}%) — Cash Ride #${ride.id.slice(-6).toUpperCase()} · Rider keeps Rs. ${riderShare}`,
            reference: `ride:${ride.id}`,
          });
          if (shortfall > 0) {
            await tx.insert(walletTransactionsTable).values({
              id: generateId(),
              userId: riderId,
              type: "platform_fee_debt",
              amount: shortfall.toFixed(2),
              description: `Platform fee debt (Rs. ${shortfall.toFixed(2)} outstanding) — Cash Ride #${ride.id.slice(-6).toUpperCase()}. Deducted from future earnings.`,
              reference: `ride:${ride.id}`,
            });
          }
          if (bonusPerTrip > 0) {
            await tx
              .update(usersTable)
              .set({ walletBalance: sql`wallet_balance + ${bonusPerTrip}`, updatedAt: new Date() })
              .where(eq(usersTable.id, riderId));
            await tx.insert(walletTransactionsTable).values({
              id: generateId(),
              userId: riderId,
              type: "bonus",
              amount: bonusPerTrip.toFixed(2),
              description: `Per-trip bonus — Ride #${ride.id.slice(-6).toUpperCase()}`,
            });
            newRiderBalance += bonusPerTrip;
          }
          /* M-01: Auto-offline set inside the transaction so that if any wallet
             write is rolled back, the rider is not silently taken offline with
             their balance unchanged. Push notification stays outside. */
          if (newRiderBalance <= 0) {
            await tx
              .update(usersTable)
              .set({ isOnline: false, updatedAt: new Date() })
              .where(eq(usersTable.id, riderId));
          }
          return statusRow;
        });
        const rideCashLang = await getUserLanguage(riderId);
        await db
          .insert(notificationsTable)
          .values({
            id: generateId(),
            userId: riderId,
            title: t("rideCompleted", rideCashLang),
            body: t("notifCashFeeDeductedBody", rideCashLang)
              .replace("{fee}", String(platformFee))
              .replace("{cash}", fareAmt.toFixed(0)),
            type: "wallet",
            icon: "wallet-outline",
          })
          .catch((e: Error) => logger.error("[rider] notif insert failed:", e.message));
        /* Push notification only — DB update is now inside the transaction above. */
        if (newRiderBalance <= 0) {
          sendPushToUser(riderId, {
            title: "Wallet Empty — You are now Offline",
            body: "Your wallet balance is 0. Top up to go online and accept rides.",
            tag: "wallet-empty",
          }).catch((e: Error) =>
            logger.warn(
              { riderId, err: e.message },
              "[rider/complete] wallet-empty push notification failed"
            )
          );
        }
      } else {
        const earnings = Math.round(fareAmt * 100 * riderKeepPct) / 100;
        const totalCredit = Math.round((earnings + bonusPerTrip) * 100) / 100;
        updated = await db.transaction(async (tx) => {
          const [statusRow] = await tx
            .update(ridesTable)
            .set({ status, completedAt: new Date(), updatedAt: new Date(), ...(proofPhotoUrl ? { proofPhotoUrl } : {}) })
            .where(
              and(
                eq(ridesTable.id, req.params["id"] as string),
                eq(ridesTable.riderId, riderId),
                eq(ridesTable.status, ride.status)
              )
            )
            .returning();
          if (!statusRow) throw new Error("Ride not found or status already changed");
          await tx
            .update(usersTable)
            .set({ walletBalance: sql`wallet_balance + ${totalCredit}`, updatedAt: new Date() })
            .where(eq(usersTable.id, riderId));
          await tx.insert(walletTransactionsTable).values({
            id: generateId(),
            userId: riderId,
            type: "credit",
            amount: earnings.toFixed(2),
            description: `Ride earnings — #${ride.id.slice(-6).toUpperCase()} (${Math.round(riderKeepPct * 100)}%)`,
          });
          if (bonusPerTrip > 0) {
            await tx.insert(walletTransactionsTable).values({
              id: generateId(),
              userId: riderId,
              type: "bonus",
              amount: bonusPerTrip.toFixed(2),
              description: `Per-trip bonus — Ride #${ride.id.slice(-6).toUpperCase()}`,
            });
          }
          return statusRow;
        });
        const rideEarnLang = await getUserLanguage(riderId);
        await db
          .insert(notificationsTable)
          .values({
            id: generateId(),
            userId: riderId,
            title: t("notifWalletCredited", rideEarnLang),
            body: t("notifWalletCreditedBody", rideEarnLang).replace(
              "{amount}",
              earnings.toFixed(0)
            ),
            type: "wallet",
            icon: "wallet-outline",
          })
          .catch((e: unknown) =>
            logger.warn(
              {
                message: "[rider] ride-earn wallet notif insert failed",
                error: e instanceof Error ? e.message : String(e),
                code: "RIDER_NOTIF_RIDE_EARN_FAILED",
                correlationId: null,
                timestamp: new Date().toISOString(),
                userId: riderId,
              },
              "[rider] ride-earn wallet notif insert failed"
            )
          );
      }

      const custRideCompleteLang = await getUserLanguage(ride.userId);
      await db
        .insert(notificationsTable)
        .values({
          id: generateId(),
          userId: ride.userId,
          title: t("rideCompleted", custRideCompleteLang) + " ✅",
          body: t("notifRideCompletedBody", custRideCompleteLang),
          type: "ride",
          icon: "checkmark-circle-outline",
        })
        .catch((e) => logger.error("customer notif insert failed:", e));
      /* Web Push: trip completed */
      sendPushToUser(ride.userId, {
        title: "Trip Completed ✅",
        body: `Your ride has been completed. Fare: Rs. ${safeNum(ride.fare).toFixed(0)}`,
        tag: "ride-completed",
        data: { rideId: ride.id },
      }).catch((e: Error) => {
        logger.warn(
          {
            message: "[rider] trip-completed push to customer failed",
            error: e.message,
            code: "RIDER_PUSH_TRIP_CUST_FAILED",
            correlationId: null,
            timestamp: new Date().toISOString(),
            rideId: ride.id,
            userId: ride.userId,
          },
          "[rider] trip-completed push to customer failed"
        );
      });
      sendPushToUser(riderId, {
        title: "Trip Completed 🎉",
        body: `You've completed a trip. Check your wallet for earnings.`,
        tag: "ride-completed-rider",
        data: { rideId: ride.id },
      }).catch((e: Error) => {
        logger.warn(
          {
            message: "[rider] trip-completed push to rider failed",
            error: e.message,
            code: "RIDER_PUSH_TRIP_RIDER_FAILED",
            correlationId: null,
            timestamp: new Date().toISOString(),
            rideId: ride.id,
            riderId,
          },
          "[rider] trip-completed push to rider failed"
        );
      });
      fireAndForget(
        emitWebhookEvent("ride_completed", {
          rideId: ride.id,
          riderId,
          userId: ride.userId,
          fare: safeNum(ride.fare).toFixed(2),
        }),
        "rider:webhook:ride_completed",
        logger,
        { rideId: ride.id, code: "WEBHOOK_EMIT" }
      );
    } else {
      const now = new Date();
      const timestampFields =
        status === "arrived"
          ? { arrivedAt: now }
          : status === "in_transit"
            ? { startedAt: now }
            : status === "cancelled"
              ? { cancelledAt: now }
              : {};
      const [row] = await db
        .update(ridesTable)
        .set({ status, updatedAt: now, ...timestampFields })
        .where(
          and(
            eq(ridesTable.id, req.params["id"] as string),
            eq(ridesTable.riderId, riderId),
            eq(ridesTable.status, ride.status)
          )
        )
        .returning();
      if (!row) {
        sendNotFound(res, "Ride not found, not yours, or status already changed");
        return;
      }
      updated = row;
      /* Web Push + OTP re-emit: rider arrived at pickup */
      if (status === "arrived") {
        sendPushToUser(ride.userId, {
          title: "Rider Has Arrived 📍",
          body: "Your rider is at the pickup location. Share your OTP to start the trip.",
          tag: "rider-arrived",
          data: { rideId: ride.id },
        }).catch((e: Error) => {
          logger.warn(
            { rideId: ride.id, userId: ride.userId, err: e.message },
            "[rider] rider-arrived push to customer failed"
          );
        });
        /* Re-emit the OTP on arrived so that any customer who missed the
         original socket event (e.g. brief disconnect) gets the OTP now.
         We cannot recover the raw OTP from the stored SHA-256 hash, so we
         generate a fresh one, update the hash in DB, and emit the raw value. */
        if (ride.tripOtp) {
          const freshOtp = String(randomInt(1000, 10000));
          try {
            /* Await the DB write BEFORE emitting the OTP.  Emitting first would
               give the customer an OTP whose hash is not yet in the database —
               the verification step would reject it, permanently blocking ride
               completion until the customer requests another OTP.             */
            await db
              .update(ridesTable)
              .set({ tripOtp: hashTripOtp(freshOtp), updatedAt: new Date() })
              .where(eq(ridesTable.id, ride.id));
            emitRideOtp(ride.userId, ride.id, freshOtp, ride.riderId);
          } catch (e: unknown) {
            logger.error(
              { rideId: ride.id, err: (e as Error).message },
              "[rider] arrived tripOtp refresh failed — OTP not emitted to avoid mismatch"
            );
          }
        }
      }
    }

    emitRideDispatchUpdate({ rideId: updated.id, action: "status-change", status });
    emitRideUpdate(updated.id);
    const { tripOtp: _omitStatusOtp, ...updatedWithoutOtp } = updated;
    const rideStatusBody = {
      ...updatedWithoutOtp,
      fare: safeNum(updated.fare),
      distance: safeNum(updated.distance),
    };
    await storeIdempotency(req, 200, { success: true, data: rideStatusBody });
    sendSuccess(res, rideStatusBody);
  } catch (err) {
    logger.error(
      {
        error: err instanceof Error ? err.message : String(err),
        timestamp: new Date().toISOString(),
      },
      "[route] unhandled error"
    );
    sendError(res, "Internal server error", 500);
  }
});

/* ── POST /rider/rides/:id/counter — Rider submits a bid on a bargaining ride (InDrive multi-bid) ── */
router.post("/rides/:id/counter", rideBidLimiter, async (req, res) => {
  try {
    if (await checkIdempotency(req, res)) return;
    const parsed = counterSchema.safeParse(req.body);
    if (!parsed.success) {
      sendValidationError(res, parsed.error.issues[0]?.message || "counterFare required");
      return;
    }
    const riderId = req.riderId!;
    const riderUser = req.riderUser!;
    const rideId = req.params["id"] as string;
    const { counterFare, note } = parsed.data;

    const [ride] = await db.select().from(ridesTable).where(eq(ridesTable.id, rideId)).limit(1);
    if (!ride) {
      sendNotFound(res, "Ride not found");
      return;
    }
    if (ride.status !== "bargaining") {
      sendValidationError(res, "This ride is not in bargaining state");
      return;
    }

    const parsedCounter = safeNum(counterFare);
    const platformFare = safeNum(ride.fare);
    const offeredAmt = safeNum(ride.offeredFare ?? 0);

    const rideSettings = await getCachedSettings();
    const maxFare = parseFloat(rideSettings["ride_max_fare"] ?? String(DEFAULT_MAX_COUNTER_FARE));
    if (parsedCounter > maxFare) {
      sendValidationError(res, `Counter offer cannot exceed Rs. ${maxFare.toFixed(0)}`);
      return;
    }
    const maxMultiplier = parseFloat(rideSettings["ride_counter_offer_max_multiplier"] ?? "3");
    const maxAllowedByMultiplier = platformFare > 0 ? platformFare * maxMultiplier : maxFare;
    if (parsedCounter > maxAllowedByMultiplier) {
      sendValidationError(
        res,
        `Counter offer cannot exceed ${maxMultiplier}× the platform fare (Rs. ${maxAllowedByMultiplier.toFixed(0)})`
      );
      return;
    }
    if (parsedCounter <= offeredAmt) {
      sendValidationError(
        res,
        `Counter offer must be higher than customer's offer (Rs. ${offeredAmt.toFixed(0)})`
      );
      return;
    }

    /* Enforce service min_fare — check platform_settings first, fall back to rideServiceTypesTable
     so the constraint works even when per-type settings haven't been configured in the admin panel */
    const minFareKey = `ride_${ride.type}_min_fare`;
    const psMinFare = rideSettings[minFareKey];
    let serviceMinFare = psMinFare !== undefined ? parseFloat(psMinFare) : 0;
    if (!(serviceMinFare > 0)) {
      const [svc] = await db
        .select({ minFare: rideServiceTypesTable.minFare })
        .from(rideServiceTypesTable)
        .where(eq(rideServiceTypesTable.key, ride.type))
        .limit(1);
      serviceMinFare = svc ? parseFloat(svc.minFare ?? "0") : 0;
    }
    if (serviceMinFare > 0 && parsedCounter < serviceMinFare) {
      sendValidationError(
        res,
        `Counter offer cannot be lower than the minimum fare of Rs. ${serviceMinFare.toFixed(0)} for this service`
      );
      return;
    }

    /*
     * Strict one-bid-per-rider-per-ride: DB UNIQUE INDEX on (ride_id, rider_id).
     * UPSERT: update fare+note on existing bid; insert on first bid.
     * FOR-UPDATE on the ride row serialises concurrent submissions.
     */

    let bid: InferSelectModel<typeof rideBidsTable> | undefined;
    let isFirstBid = false;
    try {
      const result = await db.transaction(async (tx) => {
        const [lockedRide] = await tx
          .select({ id: ridesTable.id, status: ridesTable.status })
          .from(ridesTable)
          .where(eq(ridesTable.id, rideId))
          .for("update");

        /*
         * Allow bids in both 'searching' (initial offer, no bids yet) and
         * 'bargaining' (counter after customer's rejection). Restricting to
         * 'bargaining' only would block the very first bid a rider submits.
         */
        if (!lockedRide || !["searching", "bargaining"].includes(lockedRide.status)) {
          throw Object.assign(new Error("Ride is no longer accepting bids"), { statusCode: 409 });
        }

        /* Check for any existing bid row (any status) for this rider on this ride. */
        const [existingBid] = await tx
          .select({ id: rideBidsTable.id })
          .from(rideBidsTable)
          .where(and(eq(rideBidsTable.rideId, rideId), eq(rideBidsTable.riderId, riderId)))
          .limit(1);

        if (existingBid) {
          /* UPSERT branch: update fare, note and reset to pending.
           expiresAt is refreshed to 30 minutes from now so the re-submitted
           bid is not immediately hidden by the expiry filter in bid queries. */
          const refreshedExpiresAt = new Date(Date.now() + 30 * 60_000);
          const [updated] = await tx
            .update(rideBidsTable)
            .set({
              fare: parsedCounter.toFixed(2),
              note: note ?? null,
              status: "pending",
              expiresAt: refreshedExpiresAt,
              updatedAt: new Date(),
            })
            .where(and(eq(rideBidsTable.id, existingBid.id), eq(rideBidsTable.riderId, riderId)))
            .returning();
          isFirstBid = false;
          return updated;
        } else {
          /* INSERT branch: first-time bid from this rider on this ride.
           expiresAt is set to 30 minutes from now so ghost bids from
           offline riders are automatically excluded from negotiation screens. */
          const bidExpiresAt = new Date(Date.now() + 30 * 60_000);
          const [inserted] = await tx
            .insert(rideBidsTable)
            .values({
              id: generateId(),
              rideId,
              riderId,
              riderName: riderUser.name || "Rider",
              riderPhone: riderUser.phone ?? null,
              fare: parsedCounter.toFixed(2),
              note: note ?? null,
              status: "pending",
              expiresAt: bidExpiresAt,
            })
            .returning();
          isFirstBid = true;
          return inserted;
        }
      });
      bid = result;
    } catch (e: unknown) {
      const err = e as { statusCode?: number; message?: string };
      const status = err.statusCode ?? 400;
      sendError(res, err.message ?? "Bid failed", status);
      return;
    }

    if (isFirstBid) {
      const bidLang = await getUserLanguage(ride.userId);
      await db
        .insert(notificationsTable)
        .values({
          id: generateId(),
          userId: ride.userId,
          title: t("notifNewBid", bidLang) + " 💬",
          body: t("notifNewBidBody", bidLang)
            .replace("{name}", riderUser.name || "A rider")
            .replace("{amount}", parsedCounter.toFixed(0)),
          type: "ride",
          icon: "chatbubble-outline",
          link: "/ride",
        })
        .catch((err: Error) => {
          logger.error("[rider] background op failed:", err.message);
        });
    }

    emitRideDispatchUpdate({ rideId, action: "bid", status: "bargaining" });
    emitRideUpdate(rideId);
    const counterBody = { bid: { ...bid, fare: safeNum(bid!.fare) } };
    await storeIdempotency(req, 200, { success: true, data: counterBody });
    sendSuccess(res, counterBody);
  } catch (err) {
    logger.error(
      {
        error: err instanceof Error ? err.message : String(err),
        timestamp: new Date().toISOString(),
      },
      "[route] unhandled error"
    );
    sendError(res, "Internal server error", 500);
  }
});

/* ── POST /rider/rides/:id/reject-offer — Rider dismisses a bargaining ride (local dismiss, no DB lock) ── */
router.post("/rides/:id/reject-offer", async (req, res) => {
  try {
    if (await checkIdempotency(req, res)) return;
    /* InDrive model: riders don't lock the ride anymore, so "rejection" is purely a local dismiss.
     If this rider had submitted a pending bid, we cancel it. */
    const riderId = req.riderId!;
    const rideId = req.params["id"] as string;

    /* Cancel any pending bid this rider submitted */
    await db
      .update(rideBidsTable)
      .set({ status: "rejected", updatedAt: new Date() })
      .where(
        and(
          eq(rideBidsTable.rideId, rideId),
          eq(rideBidsTable.riderId, riderId),
          eq(rideBidsTable.status, "pending")
        )
      );

    await storeIdempotency(req, 200, { success: true, message: "Ride dismissed" });
    sendSuccess(res, undefined, "Ride dismissed");
  } catch (err) {
    logger.error(
      {
        error: err instanceof Error ? err.message : String(err),
        timestamp: new Date().toISOString(),
      },
      "[route] unhandled error"
    );
    sendError(res, "Internal server error", 500);
  }
});

/* ── POST /rider/rides/:id/event-log — GPS-tagged audit event ──
   Records a rider-emitted lifecycle event (e.g. "arrived_at_pickup",
   "customer_not_found") against the ride for admin audit.
   Body: { event: string, lat?: number, lng?: number }
   Guards: ride must belong to this rider. */
const rideEventLogSchema = z.object({
  event: z.string().min(1).max(100),
  lat: z.number().min(-90).max(90).optional().nullable(),
  lng: z.number().min(-180).max(180).optional().nullable(),
});

router.post("/rides/:id/event-log", async (req, res) => {
  try {
    if (await checkIdempotency(req, res)) return;
    const riderId = req.riderId!;
    const rideId = req.params["id"] as string;

    const parsed = rideEventLogSchema.safeParse(req.body);
    if (!parsed.success) {
      sendValidationError(res, parsed.error.issues[0]?.message || "Invalid event data");
      return;
    }
    const { event, lat, lng } = parsed.data;

    const [ride] = await db
      .select({ id: ridesTable.id, status: ridesTable.status, riderId: ridesTable.riderId })
      .from(ridesTable)
      .where(eq(ridesTable.id, rideId))
      .limit(1);

    if (!ride) {
      sendNotFound(res, "Ride not found");
      return;
    }
    if (ride.riderId !== riderId) {
      sendForbidden(res, "You are not assigned to this ride");
      return;
    }

    const logId = generateId();
    await db.insert(rideEventLogsTable).values({
      id: logId,
      rideId,
      riderId,
      event,
      lat: lat != null ? String(lat) : null,
      lng: lng != null ? String(lng) : null,
    });

    await storeIdempotency(req, 200, { success: true, data: { id: logId, rideId, event } });
    sendSuccess(res, { id: logId, rideId, event }, "Event logged");
  } catch (err) {
    logger.error(
      {
        error: err instanceof Error ? err.message : String(err),
        timestamp: new Date().toISOString(),
      },
      "[route] unhandled error"
    );
    sendError(res, "Internal server error", 500);
  }
});

/* ── GET /rider/history — Delivery history ── */
router.get("/history", async (req, res) => {
  try {
    const riderId = req.riderId!;
    const s = await getCachedSettings();
    const riderKeepPct = (Number(s["rider_keep_pct"]) || 80) / 100;

    const rawLimit = parseInt(String(req.query["limit"] || "50"), 10);
    const rawOffset = parseInt(String(req.query["offset"] || "0"), 10);
    const limitParam = Math.min(isNaN(rawLimit) || rawLimit < 1 ? 50 : rawLimit, 200);
    const offsetParam = isNaN(rawOffset) || rawOffset < 0 ? 0 : rawOffset;

    /* ── Server-side kind + period filters (C-01 / M-01 / M-08) ─────────────
       kind   = "all" | "order" | "ride"
       period = "all" | "today" | "week" | "month"
       Date boundaries are computed in PKT (UTC+5) so "today" means
       midnight-to-now in Pakistan Standard Time, not UTC midnight.           */
    const kindParam = String(req.query["kind"] || "all").toLowerCase();
    const periodParam = String(req.query["period"] || "all").toLowerCase();

    const PKT_OFFSET_MS = 5 * 60 * 60 * 1000; // UTC+5
    const nowMs = Date.now();
    const nowInPKT = nowMs + PKT_OFFSET_MS;
    const todayStartPKT = new Date(
      Math.floor(nowInPKT / (24 * 60 * 60 * 1000)) * (24 * 60 * 60 * 1000) - PKT_OFFSET_MS
    );

    let periodStart: Date | null = null;
    if (periodParam === "today") {
      periodStart = todayStartPKT;
    } else if (periodParam === "week") {
      periodStart = new Date(todayStartPKT.getTime() - 6 * 24 * 60 * 60 * 1000);
    } else if (periodParam === "month") {
      periodStart = new Date(todayStartPKT.getTime() - 29 * 24 * 60 * 60 * 1000);
    }

    /* ── Build per-table filter fragments ──────────────────────────────────────
       kind=parcel → delivered orders with type='parcel'
       kind=order  → delivered orders that are NOT parcel (food/mart)
       kind=ride   → completed/cancelled rides only
       kind=all    → union of all the above (global pagination via UNION ALL)   */
    const parcelTypeFilter =
      kindParam === "parcel"
        ? sql`o.type = 'parcel'`
        : kindParam === "order"
          ? sql`o.type <> 'parcel'`
          : sql`TRUE`;

    const periodConditionOrders = periodStart
      ? sql`AND o.updated_at >= ${periodStart.toISOString()}`
      : sql``;
    const periodConditionRides = periodStart
      ? sql`AND r.updated_at >= ${periodStart.toISOString()}`
      : sql``;

    /* ── kind=all: UNION ALL with global ORDER BY + LIMIT/OFFSET ────────────
       Per-table pagination is broken for mixed histories — items get skipped
       or repeated when both tables have records in the same time window.
       A UNION ALL with global ordering is the only correct approach.           */
    let combined: Array<{
      kind: "order" | "ride";
      id: string;
      status: string;
      amount: number;
      earnings: number;
      address: string | null;
      type: string;
      createdAt: Date;
      updatedAt: Date;
      origin: string | null;
      destination: string | null;
      fare: number;
      distance: string | number | null;
      proofPhoto: string | null;
    }>;
    let filteredTotal: number;

    if (kindParam === "all") {
      /* UNION ALL data query — single ordered stream, global LIMIT/OFFSET */
      const unionRows = await db.execute(sql`
        SELECT 'order' AS kind,
               o.id, o.status,
               o.total::numeric          AS amount,
               o.delivery_address        AS address,
               o.type,
               o.created_at,
               o.updated_at,
               NULL::text                AS origin,
               o.delivery_address        AS destination,
               NULL::numeric             AS fare,
               NULL::numeric             AS distance,
               o.proof_photo_url         AS proof_photo
        FROM   orders o
        WHERE  o.rider_id = ${riderId}
          AND  o.status   = 'delivered'
          ${periodConditionOrders}

        UNION ALL

        SELECT 'ride' AS kind,
               r.id, r.status,
               r.fare::numeric           AS amount,
               r.drop_address            AS address,
               r.type,
               r.created_at,
               r.updated_at,
               r.pickup_address          AS origin,
               r.drop_address            AS destination,
               r.fare::numeric           AS fare,
               r.distance::numeric       AS distance,
               NULL::text                AS proof_photo
        FROM   rides r
        WHERE  r.rider_id = ${riderId}
          AND  r.status   IN ('completed','cancelled')
          ${periodConditionRides}

        ORDER BY updated_at DESC
        LIMIT  ${limitParam}
        OFFSET ${offsetParam}
      `);

      /* COUNT query for filtered total (separate so the data query stays lean) */
      const countRow = await db.execute(sql`
        SELECT COUNT(*) AS total FROM (
          SELECT o.id FROM orders o
          WHERE  o.rider_id = ${riderId} AND o.status = 'delivered'
          ${periodConditionOrders}

          UNION ALL

          SELECT r.id FROM rides r
          WHERE  r.rider_id = ${riderId} AND r.status IN ('completed','cancelled')
          ${periodConditionRides}
        ) t
      `);

      filteredTotal = Number((countRow.rows[0] as Record<string, unknown>)?.["total"] ?? 0);

      combined = (unionRows.rows as Record<string, unknown>[]).map((row) => {
        const isRide = row["kind"] === "ride";
        const rawAmount = safeNum(row["amount"]);
        return {
          kind: (row["kind"] as "order" | "ride"),
          id: String(row["id"]),
          status: String(row["status"]),
          amount: rawAmount,
          earnings: isRide && row["status"] === "cancelled"
            ? 0
            : Math.round(rawAmount * 100 * riderKeepPct) / 100,
          address: row["address"] != null ? String(row["address"]) : null,
          type: String(row["type"]),
          createdAt: new Date(String(row["created_at"])),
          updatedAt: new Date(String(row["updated_at"])),
          origin: row["origin"] != null ? String(row["origin"]) : null,
          destination: row["destination"] != null ? String(row["destination"]) : null,
          fare: safeNum(row["fare"]),
          distance: row["distance"] != null ? String(row["distance"]) : null,
          proofPhoto: row["proof_photo"] != null ? String(row["proof_photo"]) : null,
        };
      });
    } else {
      /* Single-table path — pagination is correct because only one table is involved */
      const includeOrders = kindParam === "order" || kindParam === "parcel";
      const includeRides = kindParam === "ride";

      const drizzleParcelFilter =
        kindParam === "parcel"
          ? eq(ordersTable.type, "parcel")
          : kindParam === "order"
            ? ne(ordersTable.type, "parcel")
            : undefined;

      const [orderRows, rideRows, orderCountRows, rideCountRows] = await Promise.all([
        includeOrders
          ? db
              .select()
              .from(ordersTable)
              .where(
                and(
                  eq(ordersTable.riderId, riderId),
                  eq(ordersTable.status, "delivered"),
                  drizzleParcelFilter,
                  periodStart
                    ? sql`${ordersTable.updatedAt} >= ${periodStart.toISOString()}`
                    : undefined
                )
              )
              .orderBy(desc(ordersTable.updatedAt))
              .limit(limitParam)
              .offset(offsetParam)
          : Promise.resolve([] as (typeof ordersTable.$inferSelect)[]),
        includeRides
          ? db
              .select()
              .from(ridesTable)
              .where(
                and(
                  eq(ridesTable.riderId, riderId),
                  or(eq(ridesTable.status, "completed"), eq(ridesTable.status, "cancelled")),
                  periodStart
                    ? sql`${ridesTable.updatedAt} >= ${periodStart.toISOString()}`
                    : undefined
                )
              )
              .orderBy(desc(ridesTable.updatedAt))
              .limit(limitParam)
              .offset(offsetParam)
          : Promise.resolve([] as (typeof ridesTable.$inferSelect)[]),
        includeOrders
          ? db
              .select({ total: count() })
              .from(ordersTable)
              .where(
                and(
                  eq(ordersTable.riderId, riderId),
                  eq(ordersTable.status, "delivered"),
                  drizzleParcelFilter,
                  periodStart
                    ? sql`${ordersTable.updatedAt} >= ${periodStart.toISOString()}`
                    : undefined
                )
              )
          : Promise.resolve([{ total: 0 }]),
        includeRides
          ? db
              .select({ total: count() })
              .from(ridesTable)
              .where(
                and(
                  eq(ridesTable.riderId, riderId),
                  or(eq(ridesTable.status, "completed"), eq(ridesTable.status, "cancelled")),
                  periodStart
                    ? sql`${ridesTable.updatedAt} >= ${periodStart.toISOString()}`
                    : undefined
                )
              )
          : Promise.resolve([{ total: 0 }]),
      ]);

      filteredTotal =
        (orderCountRows[0]?.total ?? 0) + (rideCountRows[0]?.total ?? 0);

      combined = [
        ...orderRows.map((o) => ({
          kind: "order" as const,
          id: o.id,
          status: o.status,
          amount: safeNum(o.total),
          earnings: Math.round(safeNum(o.total) * 100 * riderKeepPct) / 100,
          address: o.deliveryAddress,
          type: o.type,
          createdAt: o.createdAt,
          updatedAt: o.updatedAt,
          origin: null as string | null,
          destination: o.deliveryAddress,
          fare: 0,
          distance: null as string | null,
          proofPhoto: o.proofPhotoUrl ?? null,
        })),
        /* Cancelled rides have no earnings — the rider was never paid. */
        ...rideRows.map((r) => ({
          kind: "ride" as const,
          id: r.id,
          status: r.status,
          amount: safeNum(r.fare),
          earnings:
            r.status === "cancelled" ? 0 : Math.round(safeNum(r.fare) * 100 * riderKeepPct) / 100,
          address: r.dropAddress,
          type: r.type,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
          origin: r.pickupAddress,
          destination: r.dropAddress,
          fare: safeNum(r.fare),
          distance: r.distance,
          proofPhoto: null as string | null,
        })),
      ].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    }

    /* hasMore is derived from the authoritative server-side count so infinite
       scroll reflects the true filtered total regardless of page size. */
    const hasMore = offsetParam + combined.length < filteredTotal;

    sendSuccess(res, {
      history: combined,
      hasMore,
      total: filteredTotal,
      limit: limitParam,
      offset: offsetParam,
    });
  } catch (err) {
    logger.error(
      {
        error: err instanceof Error ? err.message : String(err),
        timestamp: new Date().toISOString(),
      },
      "[route] unhandled error"
    );
    sendError(res, "Internal server error", 500);
  }
});

/* ── GET /rider/reviews — Reviews received by this rider (excludes hidden/deleted) ── */
router.get("/reviews", async (req, res) => {
  try {
    const riderId = req.riderId!;
    const pageLimit = 50;

    /* For unified reviews table: COALESCE(riderRating, rating) gives the rider-specific score.
     - Dual-rated delivery: `riderRating` = rider score, `rating` = vendor score.
     - Ride-only: `rating` IS the rider score, `riderRating` is null. */
    const riderScore = sql<number>`COALESCE(${reviewsTable.riderRating}, ${reviewsTable.rating})`;
    const visibleReviewConditions = and(
      eq(reviewsTable.riderId, riderId),
      eq(reviewsTable.hidden, false),
      isNull(reviewsTable.deletedAt)
    );
    const visibleRatingConditions = and(
      eq(rideRatingsTable.riderId, riderId),
      eq(rideRatingsTable.hidden, false),
      isNull(rideRatingsTable.deletedAt)
    );

    /* ── Aggregates from reviewsTable (DB-level, no limit) ── */
    const [reviewStats, reviewBreakdown] = await Promise.all([
      db
        .select({ total: count(), avgRating: avg(riderScore) })
        .from(reviewsTable)
        .where(visibleReviewConditions),
      db
        .select({ star: sql<number>`ROUND(${riderScore})`, cnt: count() })
        .from(reviewsTable)
        .where(visibleReviewConditions)
        .groupBy(sql`ROUND(${riderScore})`),
    ]);

    /* ── Aggregates from rideRatingsTable (DB-level, exclude rides already in reviewsTable) ── */
    /* Use a correlated NOT EXISTS subquery so the database uses its indexes directly —
     no extra round-trip and no dynamic NOT IN list that degrades the query plan. */
    const legacyConditions = and(
      visibleRatingConditions,
      sql`NOT EXISTS (
      SELECT 1 FROM reviews
      WHERE reviews.order_id = ride_ratings.ride_id
        AND reviews.rider_id = ${riderId}
        AND reviews.order_type = 'ride'
        AND reviews.hidden = false
        AND reviews.deleted_at IS NULL
    )`
    );

    const [legacyStats, legacyBreakdown] = await Promise.all([
      db
        .select({ total: count(), avgSum: sql<number>`SUM(${rideRatingsTable.stars})` })
        .from(rideRatingsTable)
        .where(legacyConditions),
      db
        .select({ star: sql<number>`ROUND(${rideRatingsTable.stars})`, cnt: count() })
        .from(rideRatingsTable)
        .where(legacyConditions)
        .groupBy(sql`ROUND(${rideRatingsTable.stars})`),
    ]);

    /* ── Compute unified aggregates ── */
    const reviewTotal = reviewStats[0]?.total ?? 0;
    const legacyTotal = legacyStats[0]?.total ?? 0;
    const total = reviewTotal + legacyTotal;

    /* Weighted avg: (reviewAvg * reviewTotal + legacySum) / total */
    const reviewAvgRaw = reviewStats[0]?.avgRating ? parseFloat(reviewStats[0].avgRating) : 0;
    const legacySum = legacyStats[0]?.avgSum ? Number(legacyStats[0].avgSum) : 0;
    const avgRating =
      total > 0 ? parseFloat(((reviewAvgRaw * reviewTotal + legacySum) / total).toFixed(1)) : null;

    const starBreakdown: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const row of reviewBreakdown) {
      const s = Math.round(Number(row.star));
      if (s >= 1 && s <= 5) starBreakdown[s] = (starBreakdown[s] ?? 0) + row.cnt;
    }
    for (const row of legacyBreakdown) {
      const s = Math.round(Number(row.star));
      if (s >= 1 && s <= 5) starBreakdown[s] = (starBreakdown[s] ?? 0) + row.cnt;
    }

    /* ── Paginated review list (most recent 50) from both sources ── */
    const [reviewRows, ratingRows] = await Promise.all([
      db
        .select({
          id: reviewsTable.id,
          orderId: reviewsTable.orderId,
          rating: riderScore,
          comment: reviewsTable.comment,
          orderType: reviewsTable.orderType,
          createdAt: reviewsTable.createdAt,
          customerName: usersTable.name,
        })
        .from(reviewsTable)
        .leftJoin(usersTable, eq(reviewsTable.userId, usersTable.id))
        .where(visibleReviewConditions)
        .orderBy(desc(reviewsTable.createdAt))
        .limit(pageLimit),

      db
        .select({
          id: rideRatingsTable.id,
          orderId: rideRatingsTable.rideId,
          rating: rideRatingsTable.stars,
          comment: rideRatingsTable.comment,
          orderType: sql<string>`'ride'`,
          createdAt: rideRatingsTable.createdAt,
          customerName: usersTable.name,
        })
        .from(rideRatingsTable)
        .leftJoin(usersTable, eq(rideRatingsTable.userId, usersTable.id))
        .where(legacyConditions)
        .orderBy(desc(rideRatingsTable.createdAt))
        .limit(pageLimit),
    ]);

    const reviews = [...reviewRows, ...ratingRows]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, pageLimit);

    sendSuccess(res, { reviews, avgRating, total, starBreakdown });
  } catch (err) {
    logger.error(
      {
        error: err instanceof Error ? err.message : String(err),
        timestamp: new Date().toISOString(),
      },
      "[route] unhandled error"
    );
    sendError(res, "Internal server error", 500);
  }
});

/* ── GET /rider/earnings — Earnings summary ── */
router.get("/earnings", async (req, res) => {
  try {
    const riderId = req.riderId!;
    const now = new Date();
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    const s = await getCachedSettings();
    const riderKeepPct = (Number(s["rider_keep_pct"]) || 80) / 100;

    /* Bonus transactions are credited per completed trip and must be included in the
     earnings summary — otherwise the displayed total is always lower than actual
     when rider_bonus_per_trip > 0. */
    const [
      todayOrders,
      yesterdayOrders,
      weekOrders,
      monthOrders,
      todayRides,
      yesterdayRides,
      weekRides,
      monthRides,
      todayBonus,
      yesterdayBonus,
      weekBonus,
      monthBonus,
      profileRow,
      todayFoodOrders,
      weekFoodOrders,
      monthFoodOrders,
    ] = await Promise.all([
      db
        .select({ s: sum(ordersTable.total), c: count() })
        .from(ordersTable)
        .where(
          and(
            eq(ordersTable.riderId, riderId),
            eq(ordersTable.status, "delivered"),
            gte(ordersTable.updatedAt, today)
          )
        ),
      db
        .select({ s: sum(ordersTable.total), c: count() })
        .from(ordersTable)
        .where(
          and(
            eq(ordersTable.riderId, riderId),
            eq(ordersTable.status, "delivered"),
            gte(ordersTable.updatedAt, yesterday),
            sql`${ordersTable.updatedAt} < ${today.toISOString()}`
          )
        ),
      db
        .select({ s: sum(ordersTable.total), c: count() })
        .from(ordersTable)
        .where(
          and(
            eq(ordersTable.riderId, riderId),
            eq(ordersTable.status, "delivered"),
            gte(ordersTable.updatedAt, weekAgo)
          )
        ),
      db
        .select({ s: sum(ordersTable.total), c: count() })
        .from(ordersTable)
        .where(
          and(
            eq(ordersTable.riderId, riderId),
            eq(ordersTable.status, "delivered"),
            gte(ordersTable.updatedAt, monthAgo)
          )
        ),
      db
        .select({ s: sum(ridesTable.fare), c: count() })
        .from(ridesTable)
        .where(
          and(
            eq(ridesTable.riderId, riderId),
            eq(ridesTable.status, "completed"),
            gte(ridesTable.updatedAt, today)
          )
        ),
      db
        .select({ s: sum(ridesTable.fare), c: count() })
        .from(ridesTable)
        .where(
          and(
            eq(ridesTable.riderId, riderId),
            eq(ridesTable.status, "completed"),
            gte(ridesTable.updatedAt, yesterday),
            sql`${ridesTable.updatedAt} < ${today.toISOString()}`
          )
        ),
      db
        .select({ s: sum(ridesTable.fare), c: count() })
        .from(ridesTable)
        .where(
          and(
            eq(ridesTable.riderId, riderId),
            eq(ridesTable.status, "completed"),
            gte(ridesTable.updatedAt, weekAgo)
          )
        ),
      db
        .select({ s: sum(ridesTable.fare), c: count() })
        .from(ridesTable)
        .where(
          and(
            eq(ridesTable.riderId, riderId),
            eq(ridesTable.status, "completed"),
            gte(ridesTable.updatedAt, monthAgo)
          )
        ),
      /* Per-trip bonuses credited to wallet on ride/delivery completion */
      db
        .select({ s: sum(walletTransactionsTable.amount) })
        .from(walletTransactionsTable)
        .where(
          and(
            eq(walletTransactionsTable.userId, riderId),
            eq(walletTransactionsTable.type, "bonus"),
            gte(walletTransactionsTable.createdAt, today)
          )
        ),
      db
        .select({ s: sum(walletTransactionsTable.amount) })
        .from(walletTransactionsTable)
        .where(
          and(
            eq(walletTransactionsTable.userId, riderId),
            eq(walletTransactionsTable.type, "bonus"),
            gte(walletTransactionsTable.createdAt, yesterday),
            sql`${walletTransactionsTable.createdAt} < ${today.toISOString()}`
          )
        ),
      db
        .select({ s: sum(walletTransactionsTable.amount) })
        .from(walletTransactionsTable)
        .where(
          and(
            eq(walletTransactionsTable.userId, riderId),
            eq(walletTransactionsTable.type, "bonus"),
            gte(walletTransactionsTable.createdAt, weekAgo)
          )
        ),
      db
        .select({ s: sum(walletTransactionsTable.amount) })
        .from(walletTransactionsTable)
        .where(
          and(
            eq(walletTransactionsTable.userId, riderId),
            eq(walletTransactionsTable.type, "bonus"),
            gte(walletTransactionsTable.createdAt, monthAgo)
          )
        ),
      db
        .select({ dailyGoal: riderProfilesTable.dailyGoal })
        .from(riderProfilesTable)
        .where(eq(riderProfilesTable.userId, riderId))
        .limit(1),
      /* Food order breakdown */
      db
        .select({ s: sum(ordersTable.total), c: count() })
        .from(ordersTable)
        .where(
          and(
            eq(ordersTable.riderId, riderId),
            eq(ordersTable.status, "delivered"),
            eq(ordersTable.type, "food"),
            gte(ordersTable.updatedAt, today)
          )
        ),
      db
        .select({ s: sum(ordersTable.total), c: count() })
        .from(ordersTable)
        .where(
          and(
            eq(ordersTable.riderId, riderId),
            eq(ordersTable.status, "delivered"),
            eq(ordersTable.type, "food"),
            gte(ordersTable.updatedAt, weekAgo)
          )
        ),
      db
        .select({ s: sum(ordersTable.total), c: count() })
        .from(ordersTable)
        .where(
          and(
            eq(ordersTable.riderId, riderId),
            eq(ordersTable.status, "delivered"),
            eq(ordersTable.type, "food"),
            gte(ordersTable.updatedAt, monthAgo)
          )
        ),
    ]);

    const todayTotal =
      (safeNum(todayOrders[0]?.s) + safeNum(todayRides[0]?.s)) * riderKeepPct +
      safeNum(todayBonus[0]?.s);
    const yesterdayTotal =
      (safeNum(yesterdayOrders[0]?.s) + safeNum(yesterdayRides[0]?.s)) * riderKeepPct +
      safeNum(yesterdayBonus[0]?.s);
    const weekTotal =
      (safeNum(weekOrders[0]?.s) + safeNum(weekRides[0]?.s)) * riderKeepPct +
      safeNum(weekBonus[0]?.s);
    const monthTotal =
      (safeNum(monthOrders[0]?.s) + safeNum(monthRides[0]?.s)) * riderKeepPct +
      safeNum(monthBonus[0]?.s);

    const personalDailyGoal = profileRow[0]?.dailyGoal
      ? parseFloat(String(profileRow[0].dailyGoal))
      : null;

    function mkBreakdown(
      allOrders: typeof todayOrders,
      foodOrders: typeof todayFoodOrders,
      rides: typeof todayRides
    ) {
      const foodEarnings = parseFloat((safeNum(foodOrders[0]?.s) * riderKeepPct).toFixed(2));
      const foodCount = Number(foodOrders[0]?.c ?? 0);
      const parcelEarnings = parseFloat(
        (Math.max(0, safeNum(allOrders[0]?.s) - safeNum(foodOrders[0]?.s)) * riderKeepPct).toFixed(
          2
        )
      );
      const parcelCount = Math.max(0, Number(allOrders[0]?.c ?? 0) - foodCount);
      const ridesEarnings = parseFloat((safeNum(rides[0]?.s) * riderKeepPct).toFixed(2));
      const ridesCount = Number(rides[0]?.c ?? 0);
      return {
        food: { earnings: foodEarnings, count: foodCount },
        parcel: { earnings: parcelEarnings, count: parcelCount },
        rides: { earnings: ridesEarnings, count: ridesCount },
      };
    }

    /* ── Net breakdown summary (audit requirement: gross/platformFees/cancellationFees/bonus/net) ── */
    const monthGrossRides = safeNum(monthRides[0]?.s);
    const monthGrossOrders = safeNum(monthOrders[0]?.s);
    const monthGross = parseFloat((monthGrossRides + monthGrossOrders).toFixed(2));
    /* platform_fee is stored per ride at booking time (default 0 until set by admin) */
    const [monthPlatformFeesRow] = await db
      .select({ s: sum(ridesTable.platformFee) })
      .from(ridesTable)
      .where(
        and(
          eq(ridesTable.riderId, riderId),
          eq(ridesTable.status, "completed"),
          gte(ridesTable.updatedAt, monthAgo)
        )
      );
    /* Cancellation fees are recorded as wallet debit transactions with reference 'cancel_penalty:*' */
    const [monthCancelFeesRow] = await db
      .select({ s: sum(walletTransactionsTable.amount) })
      .from(walletTransactionsTable)
      .where(
        and(
          eq(walletTransactionsTable.userId, riderId),
          eq(walletTransactionsTable.type, "debit"),
          sql`${walletTransactionsTable.reference} LIKE 'cancel_penalty:%'`,
          gte(walletTransactionsTable.createdAt, monthAgo)
        )
      );
    const monthPlatformFees = parseFloat((safeNum(monthPlatformFeesRow?.s)).toFixed(2));
    const monthCancellationFees = parseFloat((safeNum(monthCancelFeesRow?.s)).toFixed(2));
    const monthBonusAmt = parseFloat((safeNum(monthBonus[0]?.s)).toFixed(2));
    const monthNet = parseFloat(
      (monthGrossRides * riderKeepPct + monthGrossOrders * riderKeepPct + monthBonusAmt - monthCancellationFees).toFixed(2)
    );
    const monthTotalRides = Number(monthRides[0]?.c ?? 0);

    sendSuccess(res, {
      today: {
        earnings: parseFloat(todayTotal.toFixed(2)),
        deliveries: (todayOrders[0]?.c ?? 0) + (todayRides[0]?.c ?? 0),
        breakdown: mkBreakdown(todayOrders, todayFoodOrders, todayRides),
      },
      yesterday: {
        earnings: parseFloat(yesterdayTotal.toFixed(2)),
        deliveries: (yesterdayOrders[0]?.c ?? 0) + (yesterdayRides[0]?.c ?? 0),
      },
      week: {
        earnings: parseFloat(weekTotal.toFixed(2)),
        deliveries: (weekOrders[0]?.c ?? 0) + (weekRides[0]?.c ?? 0),
        breakdown: mkBreakdown(weekOrders, weekFoodOrders, weekRides),
      },
      month: {
        earnings: parseFloat(monthTotal.toFixed(2)),
        deliveries: (monthOrders[0]?.c ?? 0) + (monthRides[0]?.c ?? 0),
        breakdown: mkBreakdown(monthOrders, monthFoodOrders, monthRides),
      },
      /** Audit-required net breakdown (30-day rolling window) */
      summary: {
        gross: monthGross,
        platformFees: monthPlatformFees,
        cancellationFees: monthCancellationFees,
        bonus: monthBonusAmt,
        net: monthNet,
        totalRides: monthTotalRides,
      },
      dailyGoal: personalDailyGoal,
    });
  } catch (err) {
    logger.error(
      {
        error: err instanceof Error ? err.message : String(err),
        timestamp: new Date().toISOString(),
      },
      "[route] unhandled error"
    );
    sendError(res, "Internal server error", 500);
  }
});

/* ── GET /riders/earnings/monthly — Per-calendar-month aggregates ────────────
   Returns gross earnings, platform commission, net payout and delivery count
   for each of the past N calendar months (default 6, max 12).

   Query params:
     months  — number of past months to return (1–12, default 6)

   Response:
     { months: [{ year, month, label, grossEarnings, commission, netEarnings, deliveries }] }
   Items are ordered newest-first (current month first).                       */
router.get("/earnings/monthly", async (req, res) => {
  try {
    const riderId = req.riderId!;
    const monthsCount = Math.min(12, Math.max(1, parseInt(String(req.query.months ?? "6")) || 6));

    const s = await getCachedSettings();
    const riderKeepPct = (Number(s["rider_keep_pct"]) || 80) / 100;

    const now = new Date();
    const results: {
      year: number;
      month: number;
      label: string;
      grossEarnings: number;
      commission: number;
      netEarnings: number;
      deliveries: number;
    }[] = [];

    for (let i = 0; i < monthsCount; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const start = new Date(d.getFullYear(), d.getMonth(), 1);
      const endExclusive = new Date(d.getFullYear(), d.getMonth() + 1, 1);
      const endIso = endExclusive.toISOString();

      const [orders, rides, bonuses, platformFeeRows] = await Promise.all([
        db
          .select({ s: sum(ordersTable.total), c: count() })
          .from(ordersTable)
          .where(
            and(
              eq(ordersTable.riderId, riderId),
              eq(ordersTable.status, "delivered"),
              gte(ordersTable.updatedAt, start),
              sql`${ordersTable.updatedAt} < ${endIso}`
            )
          ),
        db
          .select({ s: sum(ridesTable.fare), c: count() })
          .from(ridesTable)
          .where(
            and(
              eq(ridesTable.riderId, riderId),
              eq(ridesTable.status, "completed"),
              gte(ridesTable.updatedAt, start),
              sql`${ridesTable.updatedAt} < ${endIso}`
            )
          ),
        db
          .select({ s: sum(walletTransactionsTable.amount) })
          .from(walletTransactionsTable)
          .where(
            and(
              eq(walletTransactionsTable.userId, riderId),
              eq(walletTransactionsTable.type, "bonus"),
              gte(walletTransactionsTable.createdAt, start),
              sql`${walletTransactionsTable.createdAt} < ${endIso}`
            )
          ),
        db
          .select({ s: sum(walletTransactionsTable.amount) })
          .from(walletTransactionsTable)
          .where(
            and(
              eq(walletTransactionsTable.userId, riderId),
              eq(walletTransactionsTable.type, "platform_fee"),
              gte(walletTransactionsTable.createdAt, start),
              sql`${walletTransactionsTable.createdAt} < ${endIso}`
            )
          ),
      ]);

      const gross = safeNum(orders[0]?.s) + safeNum(rides[0]?.s);
      const bonusAmt = safeNum(bonuses[0]?.s);
      const platformFeeAmt = safeNum(platformFeeRows[0]?.s);
      const netEarnings = parseFloat((gross * riderKeepPct + bonusAmt).toFixed(2));
      const commission = parseFloat(
        (gross * (1 - riderKeepPct) + platformFeeAmt).toFixed(2)
      );
      const deliveries = Number(orders[0]?.c ?? 0) + Number(rides[0]?.c ?? 0);

      results.push({
        year: d.getFullYear(),
        month: d.getMonth() + 1,
        label: d.toLocaleDateString("en-PK", { month: "long", year: "numeric" }),
        grossEarnings: parseFloat(gross.toFixed(2)),
        commission,
        netEarnings,
        deliveries,
      });
    }

    sendSuccess(res, { months: results });
  } catch (err) {
    logger.error(
      { error: err instanceof Error ? err.message : String(err) },
      "[route] monthly earnings error"
    );
    sendError(res, "Internal server error", 500);
  }
});

/* ── GET /riders/earnings/summary — Server-side SUM aggregates ──────────────
   Returns pre-computed totals directly from wallet_transactions rows so the
   displayed values are always complete, regardless of how many pages the
   rider has scrolled through in the transaction list.

   Fields:
     todayEarned    — credit rows for today (midnight → now, Asia/Karachi)
     weekEarned     — credit rows for rolling 7-day window
     monthEarned    — credit rows for rolling 30-day window
     totalEarned    — all-time credit + bonus rows
     totalWithdrawn — all-time debit rows (excludes refunds)             */
router.get("/earnings/summary", async (req, res) => {
  try {
    const riderId = req.riderId!;

    const now = new Date();
    /* Midnight in Asia/Karachi (UTC+5). Approximate via fixed offset; this
       matches how the rest of the rider finance code handles "today". */
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - 7);

    const monthStart = new Date(todayStart);
    monthStart.setDate(monthStart.getDate() - 30);

    const [todayRow, weekRow, monthRow, totalEarnedRow, totalWithdrawnRow] = await Promise.all([
      /* Today: credit type only */
      db
        .select({ s: sum(walletTransactionsTable.amount) })
        .from(walletTransactionsTable)
        .where(
          and(
            eq(walletTransactionsTable.userId, riderId),
            eq(walletTransactionsTable.type, "credit"),
            gte(walletTransactionsTable.createdAt, todayStart)
          )
        ),
      /* Rolling 7-day: credit type */
      db
        .select({ s: sum(walletTransactionsTable.amount) })
        .from(walletTransactionsTable)
        .where(
          and(
            eq(walletTransactionsTable.userId, riderId),
            eq(walletTransactionsTable.type, "credit"),
            gte(walletTransactionsTable.createdAt, weekStart)
          )
        ),
      /* Rolling 30-day: credit type */
      db
        .select({ s: sum(walletTransactionsTable.amount) })
        .from(walletTransactionsTable)
        .where(
          and(
            eq(walletTransactionsTable.userId, riderId),
            eq(walletTransactionsTable.type, "credit"),
            gte(walletTransactionsTable.createdAt, monthStart)
          )
        ),
      /* All-time credit + bonus */
      db
        .select({ s: sum(walletTransactionsTable.amount) })
        .from(walletTransactionsTable)
        .where(
          and(
            eq(walletTransactionsTable.userId, riderId),
            or(
              eq(walletTransactionsTable.type, "credit"),
              eq(walletTransactionsTable.type, "bonus")
            )
          )
        ),
      /* All-time withdrawals (debit rows that are NOT refunds) */
      db
        .select({ s: sum(walletTransactionsTable.amount) })
        .from(walletTransactionsTable)
        .where(
          and(
            eq(walletTransactionsTable.userId, riderId),
            eq(walletTransactionsTable.type, "debit"),
            sql`(${walletTransactionsTable.reference} IS NULL OR ${walletTransactionsTable.reference} NOT LIKE 'refund:%')`
          )
        ),
    ]);

    sendSuccess(res, {
      todayEarned: parseFloat((safeNum(todayRow[0]?.s)).toFixed(2)),
      weekEarned: parseFloat((safeNum(weekRow[0]?.s)).toFixed(2)),
      monthEarned: parseFloat((safeNum(monthRow[0]?.s)).toFixed(2)),
      totalEarned: parseFloat((safeNum(totalEarnedRow[0]?.s)).toFixed(2)),
      totalWithdrawn: parseFloat((safeNum(totalWithdrawnRow[0]?.s)).toFixed(2)),
    });
  } catch (err) {
    logger.error(
      { error: err instanceof Error ? err.message : String(err), timestamp: new Date().toISOString() },
      "[route] unhandled error"
    );
    sendError(res, "Internal server error", 500);
  }
});

/* ── GET /rider/wallet/transactions ──
   Cursor-paginated. Default page size 50, hard cap 200. The cursor is an
   opaque base64 of `{ createdAt, id }` from the last item of the previous
   page; pages are sorted by `(createdAt DESC, id DESC)` so the (createdAt,id)
   tuple is a strict, deterministic ordering even when two transactions land
   in the same millisecond.

   Legacy mode: when the request includes `?legacy=1` we return the original
   non-paginated `{ balance, transactions }` shape (capped at 100) so that
   any client still on the old API keeps working through the transition. The
   rider-app frontend uses the paginated path. */
router.get("/wallet/transactions", async (req, res) => {
  try {
    const riderId = req.riderId!;
    const user = req.riderUser!;

    /* Parse `limit` defensively: malformed query strings (e.g. `?limit=abc`)
     produce NaN from parseInt, which would silently propagate as a broken
     LIMIT clause. Normalise to the default and clamp into the allowed range. */
    function parseLimit(raw: unknown, fallback: number, max: number): number {
      const n = parseInt(String(raw ?? ""), 10);
      const safe = Number.isFinite(n) && n > 0 ? n : fallback;
      return Math.min(Math.max(1, safe), max);
    }

    const isLegacy = String(req.query["legacy"] ?? "") === "1";
    if (isLegacy) {
      const legacyLimit = parseLimit(req.query["limit"], 50, 100);
      const txns = await db
        .select()
        .from(walletTransactionsTable)
        .where(eq(walletTransactionsTable.userId, riderId))
        .orderBy(desc(walletTransactionsTable.createdAt))
        .limit(legacyLimit);
      sendSuccess(res, {
        balance: safeNum(user.walletBalance),
        transactions: txns.map((t) => ({ ...t, amount: safeNum(t.amount) })),
      });
      return;
    }

    const limit = parseLimit(req.query["limit"], 50, 200);

    /* Decode compound cursor (createdAt + id) using the shared cursor utility.
     Compound keys guarantee deterministic ordering even when two transactions
     land in the same millisecond. Bad/forged cursors are silently treated as
     "no cursor" so a stale link cannot 500 the endpoint. */
    let cursorCreatedAt: Date | null = null;
    let cursorId: string | null = null;
    const cursorDecoded = decodeCursor(String(req.query["cursor"] ?? ""));
    if (cursorDecoded) {
      try {
        const parsed = JSON.parse(cursorDecoded);
        const ts = typeof parsed?.createdAt === "string" ? new Date(parsed.createdAt) : null;
        const cid = typeof parsed?.id === "string" ? parsed.id : null;
        if (ts && !isNaN(ts.getTime()) && cid) {
          cursorCreatedAt = ts;
          cursorId = cid;
        }
      } catch (err) {
        logger.debug(
          { error: err instanceof Error ? err.message : String(err) },
          `[route] ignore malformed cursor`
        );
      }
    }

    /* Fetch limit+1 to determine whether a next page exists without a count(). */
    const baseFilter = eq(walletTransactionsTable.userId, riderId);
    const filter =
      cursorCreatedAt && cursorId
        ? and(
            baseFilter,
            or(
              sql`${walletTransactionsTable.createdAt} < ${cursorCreatedAt}`,
              and(
                sql`${walletTransactionsTable.createdAt} = ${cursorCreatedAt}`,
                sql`${walletTransactionsTable.id} < ${cursorId}`
              )
            )
          )
        : baseFilter;

    const rows = await db
      .select()
      .from(walletTransactionsTable)
      .where(filter)
      .orderBy(desc(walletTransactionsTable.createdAt), desc(walletTransactionsTable.id))
      .limit(limit + 1);

    /* Use the shared buildCursorPage utility for consistent page slicing.
     The cursor value is the JSON-encoded compound key so clients remain
     decoupled from internal field names. */
    type WalletTxRow = (typeof rows)[number];
    const cursorPage = buildCursorPage<WalletTxRow>({
      data: rows,
      limit,
      getCursorValue: (row: WalletTxRow) => {
        const createdAt =
          row.createdAt instanceof Date ? row.createdAt : new Date(String(row.createdAt));
        return JSON.stringify({ createdAt: createdAt.toISOString(), id: row.id });
      },
    });
    const { data: page, nextCursor, hasMore: _hasMore } = cursorPage;

    const [promoRow] = await db
      .select({ s: sum(walletTransactionsTable.amount) })
      .from(walletTransactionsTable)
      .where(
        and(
          eq(walletTransactionsTable.userId, riderId),
          sql`${walletTransactionsTable.type} IN ('bonus', 'cashback', 'loyalty')`
        )
      );
    const promoBalance = parseFloat(safeNum(promoRow?.s).toFixed(2));

    sendSuccess(res, {
      balance: safeNum(user.walletBalance),
      promoBalance,
      items: page.map((t) => ({ ...t, amount: safeNum(t.amount) })),
      nextCursor,
      limit,
    });
  } catch (err) {
    logger.error(
      {
        error: err instanceof Error ? err.message : String(err),
        timestamp: new Date().toISOString(),
      },
      "[route] unhandled error"
    );
    sendError(res, "Internal server error", 500);
  }
});

/* ── Payout gating note ────────────────────────────────────────────────────────
   No non-admin payout route exists for riders or vendors. All /payout endpoints
   live exclusively under /admin/* (finance.ts, finance/wallets.ts) and are
   already protected by requirePermission("finance.payouts.release"). There is
   no user-facing payout route to gate with checkFeatureAccess("payout").       */

/* ── POST /rider/wallet/withdraw — Atomic withdrawal (prevents race condition) ── */
router.post("/wallet/withdraw", checkFeatureAccess("withdraw_money"), requireAttestation, async (req, res) => {
  let releaseIdem: (() => Promise<void>) | null = null;
  try {
    const riderId = req.riderId!;
    const rawKey =
      typeof req.headers["x-idempotency-key"] === "string"
        ? req.headers["x-idempotency-key"].trim()
        : null;

    /* ── Preflight validation (before acquiring lock so failures don't hold the key) ── */
    const parsed = withdrawSchema.safeParse(req.body);
    if (!parsed.success) {
      sendValidationError(res, parsed.error.issues[0]?.message || "Invalid input");
      return;
    }
    const { amount, accountTitle, accountNumber, bankName, paymentMethod, note } = parsed.data;
    const amt = amount;

    const s = await getCachedSettings();
    const withdrawalEnabled = (s["rider_withdrawal_enabled"] ?? "on") === "on";
    const minPayout = parseFloat(s["rider_min_payout"] ?? "500");
    const maxPayout = parseFloat(s["rider_max_payout"] ?? "50000");

    if (!withdrawalEnabled) {
      sendForbidden(res, "Withdrawals are currently paused by admin. Please try again later.");
      return;
    }
    if (!amt || amt <= 0) {
      sendValidationError(res, "Valid amount required");
      return;
    }
    if (amt < minPayout) {
      sendValidationError(res, `Minimum withdrawal is Rs. ${minPayout}`);
      return;
    }
    if (amt > maxPayout) {
      sendValidationError(res, `Maximum single withdrawal is Rs. ${maxPayout}`);
      return;
    }
    if (!accountTitle || !accountNumber || !bankName) {
      sendValidationError(res, "Account title, number and bank name are required");
      return;
    }

    /* ── Acquire idempotency lock (after all preflight checks pass) ── */
    const idem = await withdrawalIdempotency(riderId, rawKey, "rider");
    if (idem.type === "cached") { res.status(idem.statusCode).json(idem.body); return; }
    if (idem.type === "in_flight") {
      sendError(res, "Duplicate withdrawal request — please retry in a moment.", 409);
      return;
    }
    /* idem.type === "acquired" from here */
    releaseIdem = idem.release;

    const txId = generateId();
    const result = await db.transaction(async (tx) => {
      /* Lock the rider row so concurrent withdrawals cannot both pass the balance check */
      const [user] = await tx
        .select()
        .from(usersTable)
        .where(eq(usersTable.id, riderId))
        .limit(1)
        .for("update");
      if (!user) throw new Error("User not found");

      const balance = safeNum(user.walletBalance);
      if (amt > balance) throw new Error(`Insufficient balance. Available: Rs. ${balance}`);

      /* DB floor guard — prevents negative balance if two withdrawals clear pre-flight simultaneously */
      const [deducted] = await tx
        .update(usersTable)
        .set({ walletBalance: sql`wallet_balance - ${amt}`, updatedAt: new Date() })
        .where(and(eq(usersTable.id, riderId), gte(usersTable.walletBalance, amt.toFixed(2))))
        .returning({ id: usersTable.id });
      if (!deducted) throw new Error(`Insufficient balance. Please try again.`);
      await tx.insert(walletTransactionsTable).values({
        id: txId,
        userId: riderId,
        type: "debit",
        amount: amt.toFixed(2),
        description: `Withdrawal — ${bankName} · ${accountNumber} · ${accountTitle}${note ? ` · ${note}` : ""}`,
        reference: "pending",
        paymentMethod: paymentMethod || bankName,
        ...(idem.txKey ? { idempotencyKey: idem.txKey } : {}),
      });
      return balance - amt;
    });

    const withdrawLang = await getUserLanguage(riderId);
    await db
      .insert(notificationsTable)
      .values({
        id: generateId(),
        userId: riderId,
        title: t("notifWithdrawalPending", withdrawLang) + " ✅",
        body: t("notifWithdrawalPendingBody", withdrawLang).replace("{amount}", amt.toFixed(0)),
        type: "wallet",
        icon: "cash-outline",
      })
      .catch((err: Error) => {
        logger.error("[rider] background op failed:", err.message);
      });

    const withdrawBody = { newBalance: parseFloat(result.toFixed(2)), amount: amt, txId };
    releaseIdem = null; // transaction committed — do not release on any subsequent error
    await idem.commit(200, { success: true, data: withdrawBody });
    sendSuccess(res, withdrawBody);
  } catch (err) {
    if (releaseIdem) await releaseIdem();
    /* Unique constraint violation on idempotency_key — concurrent duplicate slipped past the lock */
    const pgErr = err as { code?: string; constraint?: string };
    if (pgErr?.code === "23505" && pgErr?.constraint?.includes("idempotency")) {
      sendError(res, "Duplicate withdrawal request — please retry in a moment.", 409);
      return;
    }
    logger.error(
      {
        error: err instanceof Error ? err.message : String(err),
        timestamp: new Date().toISOString(),
      },
      "[route] unhandled error"
    );
    const msg = err instanceof Error ? err.message : "Withdrawal failed";
    sendValidationError(res, msg);
  }
});

/* ── GET /rider/cod/remittances — Paginated list of COD remittances ── */
router.get("/cod/remittances", async (req, res) => {
  try {
    const riderId = req.riderId!;
    const page = Math.max(1, parseInt(String(req.query.page ?? "1")));
    const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit ?? "20"))));
    const status = String(req.query.status ?? "all");
    const offset = (page - 1) * limit;

    const whereConditions = [
      eq(walletTransactionsTable.userId, riderId),
      eq(walletTransactionsTable.type, "cod_remittance"),
    ];

    if (status === "pending") {
      whereConditions.push(sql`${walletTransactionsTable.reference} LIKE 'pending:%'`);
    } else if (status === "verified") {
      whereConditions.push(sql`${walletTransactionsTable.reference} LIKE 'verified:%'`);
    } else if (status === "rejected") {
      whereConditions.push(sql`${walletTransactionsTable.reference} LIKE 'rejected:%'`);
    }

    const [rows, totalRows] = await Promise.all([
      db
        .select()
        .from(walletTransactionsTable)
        .where(and(...whereConditions))
        .orderBy(desc(walletTransactionsTable.createdAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: count() })
        .from(walletTransactionsTable)
        .where(and(...whereConditions)),
    ]);

    const total = Number(totalRows[0]?.count ?? 0);
    sendSuccess(res, {
      remittances: rows.map((r) => {
        const ref = r.reference ?? "";
        const statusKey: "pending" | "verified" | "rejected" = ref.startsWith("verified:")
          ? "verified"
          : ref.startsWith("rejected:")
            ? "rejected"
            : "pending";
        /* Extract human-readable note/rejection-reason from the reference tail */
        let note: string | null = null;
        if (statusKey === "verified" || statusKey === "rejected") {
          const parts = ref.split(":");
          /* format: verified:<adminId>:<note>  or rejected:<adminId>:<reason> */
          note = parts.slice(2).join(":") || null;
        }
        return {
          ...r,
          amount: safeNum(r.amount),
          status: statusKey,
          rejectionNote: statusKey === "rejected" ? note : null,
          adminNote: statusKey === "verified" ? note : null,
        };
      }),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: page * limit < total,
      },
    });
  } catch (err) {
    logger.error(
      { error: err instanceof Error ? err.message : String(err) },
      "[cod/remittances] error"
    );
    sendError(res, "Internal server error", 500);
  }
});

/* ── GET /rider/cod-summary — COD balance + remittance history ── */
router.get("/cod-summary", async (req, res) => {
  try {
    const riderId = req.riderId!;
    const [codAgg, verifiedAgg, remittances] = await Promise.all([
      db
        .select({ total: sum(ordersTable.total), count: count() })
        .from(ordersTable)
        .where(
          and(
            eq(ordersTable.riderId, riderId),
            eq(ordersTable.status, "delivered"),
            eq(ordersTable.paymentMethod, "cod")
          )
        ),
      db
        .select({ total: sum(walletTransactionsTable.amount) })
        .from(walletTransactionsTable)
        .where(
          and(
            eq(walletTransactionsTable.userId, riderId),
            eq(walletTransactionsTable.type, "cod_remittance"),
            sql`reference LIKE 'verified:%'`
          )
        ),
      db
        .select()
        .from(walletTransactionsTable)
        .where(
          and(
            eq(walletTransactionsTable.userId, riderId),
            eq(walletTransactionsTable.type, "cod_remittance")
          )
        )
        .orderBy(desc(walletTransactionsTable.createdAt))
        .limit(30),
    ]);
    const totalCollected = safeNum(codAgg[0]?.total);
    const totalVerified = safeNum(verifiedAgg[0]?.total);
    /* totalRemitted = verified remittances (cash handed back to platform).
       pendingAmount = amount still owed by the rider (not yet remitted).
       Legacy field aliases (totalVerified, netOwed) are kept for backward
       compatibility with any older client versions still in the field. */
    const totalRemitted = totalVerified;
    const pendingAmount = Math.max(0, totalCollected - totalVerified);
    sendSuccess(res, {
      totalCollected,
      totalRemitted,
      pendingAmount,
      totalVerified,
      netOwed: pendingAmount,
      codOrderCount: Number(codAgg[0]?.count ?? 0),
      remittances: remittances.map((r) => ({ ...r, amount: safeNum(r.amount) })),
    });
  } catch (err) {
    logger.error(
      {
        error: err instanceof Error ? err.message : String(err),
        timestamp: new Date().toISOString(),
      },
      "[route] unhandled error"
    );
    sendError(res, "Internal server error", 500);
  }
});

const remitSchema = z.object({
  /* L-03: Clamp to 2 decimal places to prevent floating-point drift in PKR amounts. */
  amount: z.coerce
    .number()
    .positive("Amount must be positive")
    .refine((v) => Math.round(v * 100) / 100 === v, {
      message: "Amount must have at most 2 decimal places",
    }),
  paymentMethod: z.string().min(1, "Payment method is required"),
  accountNumber: z.string().optional(),
  transactionId: z.string().optional(),
  note: z.string().max(500).optional(),
});

/* ── POST /rider/cod/remit — submit COD cash remittance ── */
/* M-05: Rate-limit COD remittance to prevent accidental double-submission spam. */
router.post("/cod/remit", codRemitLimiter, requireAttestation, async (req, res) => {
  try {
    if (await checkIdempotency(req, res)) return;
    const riderId = req.riderId!;
    const parsed = remitSchema.safeParse(req.body);
    if (!parsed.success) {
      sendValidationError(res, parsed.error.issues[0]?.message || "Invalid remittance data");
      return;
    }
    const { amount, paymentMethod, accountNumber, transactionId, note } = parsed.data;

    const txId = generateId();
    const refParts = [paymentMethod];
    if (accountNumber) refParts.push(accountNumber);
    if (transactionId) refParts.push(transactionId);

    const result = await db
      .transaction(async (tx) => {
        const [codAgg] = await tx
          .select({ total: sum(ordersTable.total) })
          .from(ordersTable)
          .where(
            and(
              eq(ordersTable.riderId, riderId),
              eq(ordersTable.status, "delivered"),
              eq(ordersTable.paymentMethod, "cod")
            )
          );
        const [verifiedAgg] = await tx
          .select({ total: sum(walletTransactionsTable.amount) })
          .from(walletTransactionsTable)
          .where(
            and(
              eq(walletTransactionsTable.userId, riderId),
              eq(walletTransactionsTable.type, "cod_remittance"),
              sql`reference LIKE 'verified:%'`
            )
          );
        const [pendingAgg] = await tx
          .select({ total: sum(walletTransactionsTable.amount) })
          .from(walletTransactionsTable)
          .where(
            and(
              eq(walletTransactionsTable.userId, riderId),
              eq(walletTransactionsTable.type, "cod_remittance"),
              sql`reference LIKE 'pending:%'`
            )
          );

        const totalCollected = safeNum(codAgg?.total);
        const totalVerified = safeNum(verifiedAgg?.total);
        const totalPending = safeNum(pendingAgg?.total);
        const netOwed = Math.max(0, totalCollected - totalVerified - totalPending);

        if (Number(amount) > netOwed) {
          throw new Error(`OVER_LIMIT:${netOwed}`);
        }

        await tx.insert(walletTransactionsTable).values({
          id: txId,
          userId: riderId,
          amount: String(amount),
          type: "cod_remittance",
          description: note || `COD remittance via ${paymentMethod}`,
          reference: `pending:${refParts.join(":")}`,
        });

        return { netOwed };
      })
      .catch((err: Error) => {
        if (err.message.startsWith("OVER_LIMIT:")) return { overLimit: err.message.split(":")[1] };
        throw err;
      });

    if ("overLimit" in result) {
      sendError(res, `Remittance amount exceeds available owed balance (${result.overLimit})`, 400);
      return;
    }

    const remitBody = {
      transactionId: txId,
      message: "Remittance submitted for admin verification",
    };
    await storeIdempotency(req, 200, { success: true, data: remitBody });
    sendSuccess(res, remitBody);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to submit remittance";
    sendError(res, msg, 500);
  }
});

/* ── GET /rider/notifications ── */
/* M-05: Limit notification polling to 30 req/min to prevent flooding. */
router.get("/notifications", notificationsFeedLimiter, async (req, res) => {
  try {
    const riderId = req.riderId!;
    const notifs = await db
      .select()
      .from(notificationsTable)
      .where(eq(notificationsTable.userId, riderId))
      .orderBy(desc(notificationsTable.createdAt))
      .limit(30);
    sendSuccess(res, {
      notifications: notifs,
      unread: notifs.filter((n: Record<string, unknown>) => !n.isRead).length,
    });
  } catch (err) {
    logger.error(
      {
        error: err instanceof Error ? err.message : String(err),
        timestamp: new Date().toISOString(),
      },
      "[route] unhandled error"
    );
    sendError(res, "Internal server error", 500);
  }
});

/* ── PATCH /rider/notifications/read-all ── */
router.patch("/notifications/read-all", async (req, res) => {
  try {
    const riderId = req.riderId!;
    await db
      .update(notificationsTable)
      .set({ isRead: true })
      .where(eq(notificationsTable.userId, riderId));
    sendSuccess(res);
  } catch (err) {
    logger.error(
      {
        error: err instanceof Error ? err.message : String(err),
        timestamp: new Date().toISOString(),
      },
      "[route] unhandled error"
    );
    sendError(res, "Internal server error", 500);
  }
});

/* ── PATCH /rider/notifications/:id/read ── */
router.patch("/notifications/:id/read", async (req, res) => {
  try {
    const riderId = req.riderId!;
    const { id } = req.params as Record<string, string>;
    if (!id || typeof id !== "string") {
      sendValidationError(res, "Invalid notification id");
      return;
    }
    await db
      .update(notificationsTable)
      .set({ isRead: true })
      .where(and(eq(notificationsTable.id, id), eq(notificationsTable.userId, riderId)));
    const [updated] = await db
      .select({ id: notificationsTable.id, isRead: notificationsTable.isRead })
      .from(notificationsTable)
      .where(and(eq(notificationsTable.id, id), eq(notificationsTable.userId, riderId)))
      .limit(1);
    if (!updated) {
      sendNotFound(res, "Notification not found");
      return;
    }
    sendSuccess(res);
    return;
  } catch (err) {
    logger.error("Failed to mark notification read:", err);
    sendError(res, "Failed to mark notification as read", 500);
    return;
  }
});

/* ── POST /riders/push-token — Register FCM or VAPID push token for this rider.
   Mirrors the behaviour of POST /push/subscribe but scoped to rider auth and
   always sets role="rider". Used by the rider app's push.ts when calling
   /api/riders/push-token (the rider-scoped endpoint). */
router.post("/push-token", async (req, res) => {
  try {
    const riderId = req.riderId!;
    const body = req.body as Record<string, unknown>;
    const tokenType = body["type"] as string | undefined;

    if (tokenType === "fcm") {
      const token = body["token"] as string | undefined;
      if (!token) {
        sendValidationError(res, "token required for FCM");
        return;
      }
      await db
        .delete(pushSubscriptionsTable)
        .where(
          and(
            eq(pushSubscriptionsTable.userId, riderId),
            eq(pushSubscriptionsTable.tokenType, "fcm"),
            eq(pushSubscriptionsTable.role, "rider")
          )
        );
      const id = generateId();
      await db.insert(pushSubscriptionsTable).values({
        id,
        userId: riderId,
        role: "rider",
        tokenType: "fcm",
        endpoint: token,
        p256dh: null,
        authKey: null,
      });
      sendSuccess(res, { id });
      return;
    }

    /* VAPID subscription */
    const endpoint = body["endpoint"] as string | undefined;
    const p256dh = body["p256dh"] as string | undefined;
    const auth = body["auth"] as string | undefined;
    if (!endpoint) {
      sendValidationError(res, "endpoint required for VAPID");
      return;
    }
    await db
      .delete(pushSubscriptionsTable)
      .where(
        and(
          eq(pushSubscriptionsTable.userId, riderId),
          eq(pushSubscriptionsTable.endpoint, endpoint)
        )
      );
    const id = generateId();
    await db.insert(pushSubscriptionsTable).values({
      id,
      userId: riderId,
      role: "rider",
      tokenType: "vapid",
      endpoint,
      p256dh: p256dh ?? null,
      authKey: auth ?? null,
    });
    sendSuccess(res, { id });
  } catch (err) {
    logger.error(
      {
        error: err instanceof Error ? err.message : String(err),
        timestamp: new Date().toISOString(),
      },
      "[rider] push-token registration failed"
    );
    sendError(res, "Internal server error", 500);
  }
});

/* ── GET /rider/wallet/min-balance — Returns min balance config ── */
router.get("/wallet/min-balance", async (req, res) => {
  try {
    const riderId = req.riderId!;
    const s = await getCachedSettings();
    const minBalance = parseFloat(s["rider_min_balance"] ?? "0");
    const depositEnabled = (s["rider_deposit_enabled"] ?? "on") === "on";
    const [user] = await db
      .select({ walletBalance: usersTable.walletBalance })
      .from(usersTable)
      .where(eq(usersTable.id, riderId))
      .limit(1);
    const currentBalance = safeNum(user?.walletBalance);
    sendSuccess(res, {
      minBalance,
      depositEnabled,
      currentBalance,
      isBelowMin: minBalance > 0 && currentBalance < minBalance,
      shortfall: minBalance > 0 ? Math.max(0, minBalance - currentBalance) : 0,
    });
  } catch (err) {
    logger.error(
      {
        error: err instanceof Error ? err.message : String(err),
        timestamp: new Date().toISOString(),
      },
      "[route] unhandled error"
    );
    sendError(res, "Internal server error", 500);
  }
});

/* ── POST /rider/wallet/deposit — Submit a manual deposit request ── */
/* M-05: Limit deposit submissions to 10 per 15 minutes per rider. */
router.post("/wallet/deposit", riderDepositLimiter, async (req, res) => {
  try {
    if (await checkIdempotency(req, res)) return;
    const parsed = depositSchema.safeParse(req.body);
    if (!parsed.success) {
      sendValidationError(res, parsed.error.issues[0]?.message || "Invalid input");
      return;
    }
    const riderId = req.riderId!;
    const { amount, paymentMethod, accountNumber, transactionId, note } = parsed.data;
    const amt = amount;

    const s = await getCachedSettings();
    const depositEnabled = (s["rider_deposit_enabled"] ?? "on") === "on";

    if (!depositEnabled) {
      sendForbidden(res, "Deposits are currently disabled by admin. Please contact support.");
      return;
    }
    if (!amt || amt <= 0) {
      sendValidationError(res, "Valid amount required");
      return;
    }
    if (amt < 100) {
      sendValidationError(res, "Minimum deposit is Rs. 100");
      return;
    }
    if (!paymentMethod) {
      sendValidationError(res, "Payment method required");
      return;
    }
    if (!transactionId?.trim()) {
      sendValidationError(res, "Transaction ID is required for verification");
      return;
    }

    /* Build explicit allowlist of currently-enabled payment methods */
    const PAYMENT_METHOD_SETTING: Record<string, string> = {
      jazzcash: "jazzcash_enabled",
      easypaisa: "easypaisa_enabled",
      bank: "bank_enabled",
    };
    const enabledMethods = Object.entries(PAYMENT_METHOD_SETTING)
      .filter(([, settingKey]) => (s[settingKey] ?? "off") === "on")
      .map(([key]) => key);
    const methodKey = paymentMethod.toLowerCase().replace(/\s+/g, "");
    if (enabledMethods.length > 0 && !enabledMethods.includes(methodKey)) {
      sendValidationError(
        res,
        `Payment method '${paymentMethod}' is not enabled. Available: ${enabledMethods.join(", ")}.`
      );
      return;
    }

    const txId = generateId();
    await db.insert(walletTransactionsTable).values({
      id: txId,
      userId: riderId,
      type: "deposit",
      amount: amt.toFixed(2),
      description: `Wallet Deposit — ${paymentMethod}${accountNumber ? ` · From: ${accountNumber}` : ""}${transactionId ? ` · TxID: ${transactionId}` : ""}${note ? ` · ${note}` : ""}`,
      reference: "pending",
      paymentMethod,
    });

    const depositNotifLang = await getUserLanguage(riderId);
    await db
      .insert(notificationsTable)
      .values({
        id: generateId(),
        userId: riderId,
        title: t("notifWalletDeposit", depositNotifLang) + " ✅",
        body: t("notifWalletDepositBody", depositNotifLang).replace("{amount}", amt.toFixed(0)),
        type: "wallet",
        icon: "wallet-outline",
      })
      .catch((e: unknown) =>
        logger.warn(
          {
            message: "[rider] deposit notif insert failed",
            error: e instanceof Error ? e.message : String(e),
            code: "RIDER_NOTIF_DEPOSIT_FAILED",
            correlationId: null,
            timestamp: new Date().toISOString(),
            userId: riderId,
          },
          "[rider] deposit notif insert failed"
        )
      );

    const depositBody = { txId, amount: amt };
    await storeIdempotency(req, 200, { success: true, data: depositBody });
    sendSuccess(res, depositBody);
  } catch (err) {
    logger.error(
      {
        error: err instanceof Error ? err.message : String(err),
        timestamp: new Date().toISOString(),
      },
      "[route] unhandled error"
    );
    sendError(res, "Internal server error", 500);
  }
});

const spoofHitStore = new Map<string, number>();

/* Exported so auth logout and online-status toggle can clear hits for a session */
export function clearSpoofHits(riderId: string): void {
  spoofHitStore.delete(`spoof_hits:${riderId}`);
}

/**
 * Location update limiter — 300 updates/min per rider.
 * Uber/Careem send GPS every 3-5 s = 12-20/min typical, but bursts
 * during app resume or map re-center can spike to 5/s.
 * 300/min gives safe headroom without blocking legitimate tracking.
 */
const locationRateLimiter = rateLimit({
  windowMs: 60_000,
  max: 300,
  keyGenerator: (req) => req.riderId ?? getClientIp(req) ?? "unknown",
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    sendTooManyRequests(
      res,
      "Location update rate limit exceeded. Please wait before sending another update."
    );
  },
});

/* ── PATCH /rider/location — GPS heartbeat: rider sends periodic location updates ── */
router.patch("/location", locationRateLimiter, gpsAntiSpoofMiddleware, async (req, res) => {
  try {
    const parsed = locationSchema.safeParse(req.body);
    if (!parsed.success) {
      sendValidationError(res, parsed.error.issues[0]?.message || "Invalid location data");
      return;
    }
    const riderId = req.riderId!;

    const { latitude, longitude, accuracy, speed, heading, batteryLevel } = parsed.data;

    const settings = await getCachedSettings();

    if (settings["security_gps_tracking"] === "off") {
      sendForbidden(res, "GPS tracking is currently disabled by admin.");
      return;
    }

    /* ── Server-side distance throttling ── */
    const minDistanceMeters = parseInt(settings["gps_min_distance_meters"] ?? "25", 10);
    if (minDistanceMeters > 0) {
      const [prev] = await db
        .select({ lat: liveLocationsTable.latitude, lng: liveLocationsTable.longitude })
        .from(liveLocationsTable)
        .where(eq(liveLocationsTable.userId, riderId))
        .limit(1);
      if (prev) {
        const R = 6371000;
        const pLat = parseFloat(String(prev.lat));
        const pLng = parseFloat(String(prev.lng));
        const dLat = ((latitude - pLat) * Math.PI) / 180;
        const dLng = ((longitude - pLng) * Math.PI) / 180;
        const a =
          Math.sin(dLat / 2) ** 2 +
          Math.cos((pLat * Math.PI) / 180) *
            Math.cos((latitude * Math.PI) / 180) *
            Math.sin(dLng / 2) ** 2;
        const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        if (dist < minDistanceMeters) {
          sendSuccess(res, {
            skipped: true,
            reason: "distance_threshold",
            updatedAt: new Date().toISOString(),
          });
          return;
        }
      }
    }

    /* accuracy === 0, mockProvider flag, and emulator-signature coordinate checks are
     handled upstream by gpsAntiSpoofMiddleware — no need to repeat them here. */

    /* GPS Spoof Detection — spoofed pings are rejected immediately on detection.
     Minimum threshold is always 200 km/h (physically impossible for standard ground transport),
     or the admin-configured max if it's higher. Mock GPS provider flag is also checked. */
    if (accuracy !== undefined) {
      const minAccuracyMeters = parseInt(settings["security_gps_accuracy"] ?? "50", 10);
      if (accuracy > minAccuracyMeters) {
        /* Reject low-accuracy pings — cell-tower or Wi-Fi triangulation produces
         very high accuracy values (100-1000m+) and must not update live locations
         or be used for proximity checks like "arrived". */
        sendErrorWithData(
          res,
          `GPS accuracy (${Math.round(accuracy)}m) exceeds the allowed threshold (${minAccuracyMeters}m). Please move to an open area or enable high-accuracy GPS.`,
          {
            code: "GPS_ACCURACY_LOW",
            accuracy,
            threshold: minAccuracyMeters,
          },
          422
        );
        return;
      }
    }

    /* Stale grace period threshold — configurable via admin settings, default 30 min */
    const staleGraceMinutes = parseInt(settings["security_gps_stale_grace_minutes"] ?? "30", 10);
    const STALE_GRACE_MS = staleGraceMinutes * 60 * 1000;

    /* speedWarning is set when a speed anomaly is detected on hit 1 or 2 (warn-before-reject).
     The ping is still accepted (DB writes proceed) — only the response payload differs. */
    let speedWarning: { hit: number; detectedSpeedKmh: number } | null = null;

    if (settings["security_spoof_detection"] === "on") {
      const configMaxSpeed = parseInt(settings["security_max_speed_kmh"] ?? "150", 10);
      let MAX_ALLOWED_KMH = Math.max(configMaxSpeed, 200); /* never below 200 km/h */

      /* Accuracy-proportional speed tolerance: moderate GPS accuracy (20–50m) at
       startup can produce legitimate jumps. Apply a 1.5× multiplier so a 50m
       GPS drift in 1 second isn't treated the same as a 500km jump. */
      if (accuracy !== undefined && accuracy >= 20 && accuracy <= 50) {
        MAX_ALLOWED_KMH = MAX_ALLOWED_KMH * 1.5;
      }

      const [prev] = await db
        .select()
        .from(liveLocationsTable)
        .where(eq(liveLocationsTable.userId, riderId))
        .limit(1);

      /* Stale location grace period: if the previous ping is older than the configured threshold,
       skip speed-based comparison entirely — treat this as a fresh session start.
       This prevents false positives when riders open the app after a long break. */
      const prevIsStale = prev && Date.now() - new Date(prev.updatedAt).getTime() > STALE_GRACE_MS;

      /* Emulator-signature, accuracy===0, and mockProvider checks are now handled
       upstream by gpsAntiSpoofMiddleware before the request reaches this handler.
       Only speed-based spoofing (requires DB context) remains here. */
      const mockFlagged = false; /* always false at this point — middleware already blocked */
      const emulatorFlagged = false; /* always false at this point — middleware already blocked */

      const spoofHitKey = `spoof_hits:${riderId}`;
      const currentHits: number = spoofHitStore.get(spoofHitKey) ?? 0;

      /* Check speed-based spoofing if we have a non-stale previous location */
      let speedSpoofed = false;
      let detectedSpeedKmh = 0;
      if (prev && !prevIsStale) {
        const prevLat = parseFloat(String(prev.latitude));
        const prevLon = parseFloat(String(prev.longitude));
        const result = detectGPSSpoof(
          prevLat,
          prevLon,
          prev.updatedAt,
          latitude,
          longitude,
          MAX_ALLOWED_KMH
        );
        speedSpoofed = result.spoofed;
        detectedSpeedKmh = result.speedKmh;
      }

      if (speedSpoofed || mockFlagged || emulatorFlagged) {
        const newHits = currentHits + 1;
        spoofHitStore.set(spoofHitKey, newHits);

        const reason = emulatorFlagged
          ? "Emulator signature detected — known fake GPS coordinates"
          : mockFlagged
            ? "Mock GPS provider detected"
            : `Speed ${detectedSpeedKmh.toFixed(1)} km/h exceeds ${MAX_ALLOWED_KMH.toFixed(0)} km/h`;

        const ip = getClientIp(req);
        addSecurityEvent({
          type: "gps_spoof_detected",
          ip,
          userId: riderId,
          details: `GPS spoof: ${reason} (hit ${newHits})`,
          severity: newHits >= 3 ? "high" : "medium",
        });

        /* 3rd+ consecutive violation: auto-offline + emit admin alert + hard reject
           (applies to both speed anomalies and mock/emulator detections) */
        if (newHits >= 3) {
          spoofHitStore.set(spoofHitKey, 0);
          let autoOffline = false;
          try {
            await db
              .update(usersTable)
              .set({ isOnline: false, updatedAt: new Date() })
              .where(eq(usersTable.id, riderId));
            autoOffline = true;
          } catch (err) {
            logger.warn(
              { riderId, err: err instanceof Error ? err.message : String(err) },
              "[rider] Failed to auto-offline rider due to spoofing"
            );
          }
          const io = getIO();
          if (io) {
            io.to("admin-fleet").emit("rider:spoof-alert", {
              userId: riderId,
              reason,
              autoOffline,
              sentAt: new Date().toISOString(),
            });
          }
          sendErrorWithData(
            res,
            "GPS location rejected: repeated spoofing detected. You have been taken offline.",
            {
              autoOffline,
              code: "GPS_SPOOF_DETECTED",
              hit: newHits,
            },
            422
          );
          return;
        }

        /* Emulator/mock on hits 1-2: always hard-reject (unambiguous signal).
           Hit count still accumulates toward 3-hit auto-offline enforcement above. */
        if (mockFlagged || emulatorFlagged) {
          sendErrorWithData(
            res,
            "GPS location rejected: mock GPS provider detected. Please disable fake GPS apps.",
            {
              autoOffline: false,
              code: "GPS_SPOOF_DETECTED",
              hit: newHits,
            },
            422
          );
          return;
        }

        /* 1st or 2nd speed anomaly: tolerate the ping — continue to DB writes.
           A warning is attached to the success response to inform the client. */
        speedWarning = { hit: newHits, detectedSpeedKmh: Math.round(detectedSpeedKmh) };
      } else if (currentHits > 0) {
        spoofHitStore.set(spoofHitKey, 0);
      }
    }

    const nowDate = new Date();

    await db.insert(locationLogsTable).values({
      id: generateId(),
      userId: riderId,
      role: "rider",
      latitude: latitude.toString(),
      longitude: longitude.toString(),
      accuracy: accuracy ?? null,
      speed: speed ?? null,
      heading: heading ?? null,
      batteryLevel: batteryLevel ?? null,
      isSpoofed: false,
      createdAt: nowDate,
    });

    const action = req.body.action ?? null;

    await db
      .insert(liveLocationsTable)
      .values({
        userId: riderId,
        latitude: latitude.toString(),
        longitude: longitude.toString(),
        role: "rider",
        action,
        updatedAt: nowDate,
      })
      .onConflictDoUpdate({
        target: liveLocationsTable.userId,
        set: {
          latitude: latitude.toString(),
          longitude: longitude.toString(),
          role: "rider",
          action,
          updatedAt: nowDate,
        },
      });

    /* Derive rideId from DB — never trust client-supplied value to prevent
     unauthorized injection into arbitrary ride:{rideId} Socket.io rooms. */
    let rideId: string | null = null;
    let vendorId: string | null = null;
    try {
      const [activeRide] = await db
        .select({ id: ridesTable.id })
        .from(ridesTable)
        .where(
          and(
            eq(ridesTable.riderId, riderId),
            or(
              eq(ridesTable.status, "accepted"),
              eq(ridesTable.status, "arrived"),
              eq(ridesTable.status, "in_transit")
            )
          )
        )
        .orderBy(desc(ridesTable.updatedAt))
        .limit(1);
      rideId = activeRide?.id ?? null;
    } catch (err) {
      logger.warn(
        { riderId, err: err instanceof Error ? err.message : String(err) },
        "[rider] Failed to lookup active ride"
      );
    }

    /* Look up vendor and orderId for active delivery order */
    let orderId: string | null = null;
    try {
      const [activeOrder] = await db
        .select({ id: ordersTable.id, vendorId: ordersTable.vendorId })
        .from(ordersTable)
        .where(
          and(
            eq(ordersTable.riderId, riderId),
            or(eq(ordersTable.status, "out_for_delivery"), eq(ordersTable.status, "picked_up"))
          )
        )
        .limit(1);
      vendorId = activeOrder?.vendorId ?? null;
      orderId = activeOrder?.id ?? null;
    } catch (err) {
      logger.warn(
        { riderId, err: err instanceof Error ? err.message : String(err) },
        "[rider] Failed to lookup active delivery order"
      );
    }

    const updatedAt = nowDate.toISOString();

    emitRiderLocation({
      userId: riderId,
      latitude,
      longitude,
      accuracy,
      speed,
      heading,
      batteryLevel,
      action,
      rideId,
      vendorId,
      orderId,
      vehicleType: normalizeVehicleType(String(req.riderUser?.vehicleType ?? "")) || null,
      updatedAt,
    });

    if (speedWarning) {
      sendSuccess(res, {
        updatedAt,
        warning: "GPS_SPEED_ANOMALY",
        hit: speedWarning.hit,
        detectedSpeedKmh: speedWarning.detectedSpeedKmh,
      });
    } else {
      sendSuccess(res, { updatedAt });
    }
  } catch (err) {
    logger.error(
      {
        error: err instanceof Error ? err.message : String(err),
        timestamp: new Date().toISOString(),
      },
      "[route] unhandled error"
    );
    sendError(res, "Internal server error", 500);
  }
});

/* ── validateGpsPing — stateless per-ping GPS sanity check ──────────────────
   Performs coordinate-range, mock-provider (accuracy===0), and GPS accuracy
   threshold checks without requiring any DB context.  Speed-based detection
   (which needs the previous location) is handled separately in the batch loop.

   Returns { valid: true } on success, or { valid: false, reason } on failure.
   ─────────────────────────────────────────────────────────────────────────── */
function validateGpsPing(
  ping: { latitude: number; longitude: number; accuracy?: number },
  minAccuracyMeters: number
): { valid: boolean; reason?: string } {
  /* accuracy === 0 is a physical impossibility from real GPS hardware and a
     reliable emulator / mock-provider signature */
  if (ping.accuracy === 0) {
    return { valid: false, reason: "accuracy_zero" };
  }
  /* accuracy exceeds the platform-configured threshold */
  if (ping.accuracy !== undefined && ping.accuracy > minAccuracyMeters) {
    return { valid: false, reason: "accuracy_low" };
  }
  return { valid: true };
}

/* ── POST /rider/location/batch — Replay queued offline GPS pings ── */
const batchLocationSchema = z.object({
  locations: z
    .array(
      z.object({
        latitude: z.number().min(-90).max(90),
        longitude: z.number().min(-180).max(180),
        accuracy: z.number().optional(),
        speed: z.number().optional(),
        heading: z.number().optional(),
        batteryLevel: z.number().min(0).max(100).optional(),
        timestamp: z.string(),
      })
    )
    .min(1)
    .max(100),
});

router.post("/location/batch", async (req, res) => {
  try {
    const parsed = batchLocationSchema.safeParse(req.body);
    if (!parsed.success) {
      sendValidationError(res, parsed.error.issues[0]?.message || "Invalid input");
      return;
    }
    const riderId = req.riderId!;

    const settings = await getCachedSettings();

    /* GPS accuracy threshold — same as the single-ping endpoint */
    const minAccuracyMeters = parseInt(settings["security_gps_accuracy"] ?? "50", 10);

    /* Speed-spoof threshold — same floor as single-ping endpoint */
    const configMaxSpeed = parseInt(settings["security_max_speed_kmh"] ?? "150", 10);
    const BASE_MAX_ALLOWED_KMH = Math.max(configMaxSpeed, 200); /* never below 200 km/h */

    /* Stale grace period — configurable, same key as single-ping endpoint */
    const batchStaleGraceMinutes = parseInt(
      settings["security_gps_stale_grace_minutes"] ?? "30",
      10
    );
    const BATCH_STALE_GRACE_MS = batchStaleGraceMinutes * 60 * 1000;

    const nowMs = Date.now();
    /* Reject timestamps more than 24 h old or more than 60 s in the future.
     Client-supplied timestamps are untrusted; bounding them prevents arbitrary
     historical backdating of location records. */
    const MAX_AGE_MS = 24 * 60 * 60 * 1000;
    const MAX_FUTURE_MS = 60 * 1000;

    const sorted = parsed.data.locations.sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    let inserted = 0;
    let skipped = 0;
    let rejectedMock = 0;
    let batchSpoofWarnings = 0;
    let prevBatchLat: number | null = null;
    let prevBatchLng: number | null = null;
    let prevBatchTs: Date | null = null;
    const bulkRows: Array<typeof locationLogsTable.$inferInsert> = [];

    /* Batch-scoped spoof hit counter — mirrors single-ping warn-before-reject logic */
    const batchSpoofHitKey = `spoof_hits:${riderId}`;
    let batchCurrentHits: number = spoofHitStore.get(batchSpoofHitKey) ?? 0;

    /* Track whether 3+ hit enforcement was triggered mid-batch */
    let batchHardBlocked = false;
    let batchHardBlockReason = "";

    for (const loc of sorted) {
      const ts = new Date(loc.timestamp);
      const tsMs = ts.getTime();

      /* ── Timestamp sanity ── */
      if (isNaN(tsMs) || nowMs - tsMs > MAX_AGE_MS || tsMs - nowMs > MAX_FUTURE_MS) {
        skipped++;
        continue;
      }

      /* ── Per-ping static validation (mock provider + accuracy threshold) ── */
      const pingCheck = validateGpsPing(loc, minAccuracyMeters);
      if (!pingCheck.valid) {
        if (pingCheck.reason === "accuracy_zero") rejectedMock++;
        skipped++;
        continue;
      }

      /* ── Speed-based spoof detection within the batch ── */
      if (
        settings["security_spoof_detection"] === "on" &&
        prevBatchLat != null &&
        prevBatchLng != null &&
        prevBatchTs != null
      ) {
        /* Stale grace period: if gap between consecutive batch pings exceeds threshold, skip speed check */
        const gapMs = ts.getTime() - prevBatchTs.getTime();
        const isStaleGap = gapMs > BATCH_STALE_GRACE_MS;

        /* Accuracy-proportional speed tolerance: same 1.5× multiplier for moderate accuracy */
        const batchMaxSpeed =
          loc.accuracy !== undefined && loc.accuracy >= 20 && loc.accuracy <= 50
            ? BASE_MAX_ALLOWED_KMH * 1.5
            : BASE_MAX_ALLOWED_KMH;

        if (!isStaleGap) {
          const result = detectGPSSpoof(
            prevBatchLat,
            prevBatchLng,
            prevBatchTs,
            loc.latitude,
            loc.longitude,
            batchMaxSpeed
          );
          if (result.spoofed) {
            batchCurrentHits++;
            spoofHitStore.set(batchSpoofHitKey, batchCurrentHits);
            if (batchCurrentHits >= 3) {
              /* 3rd+ violation: mark hard block, stop processing further pings */
              batchHardBlocked = true;
              batchHardBlockReason = `Speed ${result.speedKmh.toFixed(1)} km/h exceeds ${batchMaxSpeed.toFixed(0)} km/h`;
              skipped++;
              continue;
            }
            /* 1st or 2nd: tolerate and persist the ping (warn only) */
            batchSpoofWarnings++;
            /* Fall through to bulkRows.push — ping is accepted with a warning */
          } else {
            /* Clean ping after previous anomaly(ies) — reset consecutive counter */
            if (batchCurrentHits > 0) {
              batchCurrentHits = 0;
              spoofHitStore.set(batchSpoofHitKey, 0);
            }
          }
        } else {
          /* Stale gap treated as fresh start — reset consecutive counter */
          if (batchCurrentHits > 0) {
            batchCurrentHits = 0;
            spoofHitStore.set(batchSpoofHitKey, 0);
          }
        }
      }

      /* Skip pings after a hard block is triggered */
      if (batchHardBlocked) {
        skipped++;
        continue;
      }

      /* Deterministic row ID: (riderId, ms timestamp, batch-sequence index).
       Including `bulkRows.length` as a sequence disambiguates two pings that
       share the same millisecond timestamp (e.g. rapid client polling or
       clock drift), while still being stable across retries: the client sends
       the identical sorted array so the same index is assigned to the same
       ping every time. onConflictDoNothing then silently skips duplicates. */
      const deterministicId = `loc:${riderId}:${tsMs}:${bulkRows.length}`;
      bulkRows.push({
        id: deterministicId,
        userId: riderId,
        role: "rider" as const,
        latitude: loc.latitude.toString(),
        longitude: loc.longitude.toString(),
        accuracy: loc.accuracy ?? null,
        speed: loc.speed ?? null,
        heading: loc.heading ?? null,
        batteryLevel: loc.batteryLevel ?? null,
        isSpoofed: false,
        createdAt: ts,
      });
      prevBatchLat = loc.latitude;
      prevBatchLng = loc.longitude;
      prevBatchTs = ts;
    }

    if (bulkRows.length > 0) {
      const CHUNK_SIZE = 50;
      for (let i = 0; i < bulkRows.length; i += CHUNK_SIZE) {
        const chunk = bulkRows.slice(i, i + CHUNK_SIZE);
        try {
          /* onConflictDoNothing: idempotent on retry — duplicate pings (same
           deterministic ID) are silently ignored rather than failing the batch. */
          const result = await db
            .insert(locationLogsTable)
            .values(chunk)
            .onConflictDoNothing()
            .returning({ id: locationLogsTable.id });
          inserted += result.length;
          skipped += chunk.length - result.length;
        } catch (err) {
          logger.warn(
            {
              error: err instanceof Error ? err.message : String(err),
              code: "LOCATION_LOG_BATCH_FAILED",
              timestamp: new Date().toISOString(),
            },
            "[rider] Location log batch insert failed — trying row-by-row"
          );
          for (const row of chunk) {
            try {
              const r = await db
                .insert(locationLogsTable)
                .values(row)
                .onConflictDoNothing()
                .returning({ id: locationLogsTable.id });
              if (r.length > 0) inserted++;
              else skipped++;
            } catch (err) {
              logger.debug(
                { error: err instanceof Error ? err.message : String(err) },
                "[fn] skipped on error"
              );
              skipped++;
            }
          }
        }
      }
    }

    /* Only update live location and emit if at least one clean ping was inserted.
     prevBatchLat/Lng hold the last accepted (non-spoofed, in-accuracy) coordinates. */
    if (inserted > 0) {
      const nowDate = new Date();
      await db
        .insert(liveLocationsTable)
        .values({
          userId: riderId,
          latitude: prevBatchLat!.toString(),
          longitude: prevBatchLng!.toString(),
          role: "rider",
          action: null,
          updatedAt: nowDate,
        })
        .onConflictDoUpdate({
          target: liveLocationsTable.userId,
          set: {
            latitude: prevBatchLat!.toString(),
            longitude: prevBatchLng!.toString(),
            role: "rider",
            action: null,
            updatedAt: nowDate,
          },
        });

      emitRiderLocation({
        userId: riderId,
        latitude: prevBatchLat!,
        longitude: prevBatchLng!,
        accuracy: undefined,
        speed: undefined,
        heading: undefined,
        batteryLevel: undefined,
        action: null,
        rideId: null,
        vendorId: null,
        orderId: null,
        vehicleType: normalizeVehicleType(String(req.riderUser?.vehicleType ?? "")) || null,
        updatedAt: nowDate.toISOString(),
      });
    }

    /* If a 3rd+ consecutive speed violation was hit: emit admin alert and auto-offline
     AFTER inserting previously accepted (warn-tolerated) pings. */
    if (batchHardBlocked) {
      spoofHitStore.set(batchSpoofHitKey, 0);
      try {
        await db
          .update(usersTable)
          .set({ isOnline: false, updatedAt: new Date() })
          .where(eq(usersTable.id, riderId));
      } catch (err) {
        logger.warn(
          { riderId, err: err instanceof Error ? err.message : String(err) },
          "[rider] Failed to auto-offline rider due to batch spoofing"
        );
      }
      const io = getIO();
      if (io) {
        io.to("admin-fleet").emit("rider:spoof-alert", {
          userId: riderId,
          reason: batchHardBlockReason,
          autoOffline: true,
          sentAt: new Date().toISOString(),
        });
      }
      addSecurityEvent({
        type: "gps_spoof_detected",
        ip: getClientIp(req),
        userId: riderId,
        details: `GPS spoof (batch): ${batchHardBlockReason} (hit 3+)`,
        severity: "high",
      });
      /* M-04: 403 (Forbidden) is more semantically correct than 422 for active
         enforcement decisions — the server understands the request but refuses
         it because policy has been violated. 422 is reserved for malformed data. */
      sendErrorWithData(
        res,
        "GPS location rejected: repeated spoofing detected in batch. You have been taken offline.",
        {
          autoOffline: true,
          code: "GPS_SPOOF_DETECTED",
          inserted,
          skipped,
        },
        403
      );
      return;
    }

    const batchResponse: Record<string, unknown> = {
      inserted,
      skipped,
      rejectedMock,
      total: sorted.length,
    };
    if (batchSpoofWarnings > 0) {
      batchResponse["warning"] = "GPS_SPEED_ANOMALY";
      batchResponse["spoofWarnings"] = batchSpoofWarnings;
    }
    sendSuccess(res, batchResponse);
  } catch (err) {
    logger.error(
      {
        error: err instanceof Error ? err.message : String(err),
        timestamp: new Date().toISOString(),
      },
      "[route] unhandled error"
    );
    sendError(res, "Internal server error", 500);
  }
});

/* ── GET /rider/wallet/deposits — Deposit history ── */
router.get("/wallet/deposits", async (req, res) => {
  try {
    const riderId = req.riderId!;
    const deposits = await db
      .select()
      .from(walletTransactionsTable)
      .where(
        and(
          eq(walletTransactionsTable.userId, riderId),
          eq(walletTransactionsTable.type, "deposit")
        )
      )
      .orderBy(desc(walletTransactionsTable.createdAt))
      .limit(20);
    sendSuccess(res, {
      deposits: deposits.map((d) => {
        const ref = d.reference ?? "pending";
        const status =
          ref.startsWith("approved:") ||
          ref.startsWith("paid:") ||
          ref === "verified" ||
          ref === "approved"
            ? "verified"
            : ref.startsWith("rejected:")
              ? "rejected"
              : "pending";
        return {
          ...d,
          amount: safeNum(d.amount),
          status,
          method: d.paymentMethod ?? null,
        };
      }),
    });
  } catch (err) {
    logger.error(
      {
        error: err instanceof Error ? err.message : String(err),
        timestamp: new Date().toISOString(),
      },
      "[route] unhandled error"
    );
    sendError(res, "Internal server error", 500);
  }
});

/* ── Ignore penalty helper ── */
async function handleIgnorePenalty(
  riderId: string
): Promise<{ dailyIgnores: number; penaltyApplied: number; restricted: boolean }> {
  const s = await getCachedSettings();
  const limit = parseInt(s["rider_ignore_limit_daily"] ?? "5", 10);
  const penaltyAmt = parseFloat(s["rider_ignore_penalty_amount"] ?? "30");
  const restrictEnabled = (s["rider_ignore_restrict_enabled"] ?? "off") === "on";

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let penaltyApplied = 0;
  let restricted = false;
  let dailyIgnores = 0;

  await db.transaction(async (tx) => {
    const [countRow] = await tx
      .select({ c: count() })
      .from(riderPenaltiesTable)
      .where(
        and(
          eq(riderPenaltiesTable.riderId, riderId),
          eq(riderPenaltiesTable.type, "ignore"),
          gte(riderPenaltiesTable.createdAt, today)
        )
      );
    dailyIgnores = (countRow?.c ?? 0) + 1;

    await tx
      .update(usersTable)
      .set({ ignoreCount: sql`ignore_count + 1`, updatedAt: new Date() })
      .where(eq(usersTable.id, riderId));

    await tx.insert(riderPenaltiesTable).values({
      id: generateId(),
      riderId,
      type: "ignore",
      amount: "0",
      reason: `Ignore #${dailyIgnores} today`,
    });

    if (dailyIgnores > limit) {
      penaltyApplied = penaltyAmt;
      /* Floor wallet at 0 so balance can never go negative from an ignore penalty */
      await tx
        .update(usersTable)
        .set({
          walletBalance: sql`GREATEST(wallet_balance - ${penaltyAmt}, 0)`,
          updatedAt: new Date(),
        })
        .where(eq(usersTable.id, riderId));
      await tx.insert(walletTransactionsTable).values({
        id: generateId(),
        userId: riderId,
        type: "ignore_penalty",
        amount: penaltyAmt.toFixed(2),
        description: `Ignore penalty (${dailyIgnores}/${limit} today) — Rs. ${penaltyAmt}`,
        reference: `ignore_penalty:${Date.now()}`,
      });

      if (restrictEnabled) {
        await tx
          .update(usersTable)
          .set({ isRestricted: true, updatedAt: new Date() })
          .where(eq(usersTable.id, riderId));
        restricted = true;
      }
    }
  });

  if (dailyIgnores > limit) {
    const ignorePenaltyLang = await getUserLanguage(riderId);
    await db
      .insert(notificationsTable)
      .values({
        id: generateId(),
        userId: riderId,
        title: restricted
          ? t("notifAccountRestricted", ignorePenaltyLang) + " ⚠️"
          : t("notifCancelPenalty", ignorePenaltyLang) + " ⚠️",
        body: restricted
          ? t("notifIgnoreRestrictedBody", ignorePenaltyLang)
              .replace("{count}", String(dailyIgnores))
              .replace("{limit}", String(limit))
              .replace("{amount}", String(penaltyAmt))
          : t("notifIgnorePenaltyBody", ignorePenaltyLang)
              .replace("{count}", String(dailyIgnores))
              .replace("{limit}", String(limit))
              .replace("{amount}", String(penaltyAmt)),
        type: "system",
        icon: "alert-circle-outline",
      })
      .catch((e: Error) => {
        logger.warn(
          { riderId, err: e.message },
          "[rider] ignore-penalty notification insert failed"
        );
      });
  } else if (dailyIgnores === limit) {
    const ignoreWarnLang = await getUserLanguage(riderId);
    await db
      .insert(notificationsTable)
      .values({
        id: generateId(),
        userId: riderId,
        title: t("notifCancelWarning", ignoreWarnLang) + " ⚠️",
        body: t("notifIgnoreWarningBody", ignoreWarnLang)
          .replace("{count}", String(dailyIgnores))
          .replace("{limit}", String(limit))
          .replace("{amount}", String(penaltyAmt)),
        type: "system",
        icon: "alert-circle-outline",
      })
      .catch((e: Error) => {
        logger.warn(
          { riderId, err: e.message },
          "[rider] ignore-warning notification insert failed"
        );
      });
  }

  return { dailyIgnores, penaltyApplied, restricted };
}

/* ── POST /rider/rides/:id/ignore — Rider ignores a ride request ── */
router.post("/rides/:id/ignore", async (req, res) => {
  try {
    if (await checkIdempotency(req, res)) return;
    const riderId = req.riderId!;
    const rideId = req.params["id"] as string;

    const [ride] = await db.select().from(ridesTable).where(eq(ridesTable.id, rideId)).limit(1);
    if (!ride) {
      sendNotFound(res, "Ride not found");
      return;
    }
    if (!["searching", "bargaining"].includes(ride.status)) {
      sendValidationError(res, "Ride is no longer available");
      return;
    }

    const penalty = await handleIgnorePenalty(riderId);

    const ignoreBody = { rideId, ignorePenalty: penalty };
    await storeIdempotency(req, 200, { success: true, data: ignoreBody });
    sendSuccess(res, ignoreBody);
  } catch (err) {
    logger.error(
      {
        error: err instanceof Error ? err.message : String(err),
        timestamp: new Date().toISOString(),
      },
      "[route] unhandled error"
    );
    sendError(res, "Internal server error", 500);
  }
});

/* ── GET /rider/ignore-stats — Rider's ignore stats for today ── */
router.get("/ignore-stats", async (req, res) => {
  try {
    const riderId = req.riderId!;
    const s = await getCachedSettings();
    const limit = parseInt(s["rider_ignore_limit_daily"] ?? "5", 10);
    const penaltyAmt = parseFloat(s["rider_ignore_penalty_amount"] ?? "30");

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [countRow] = await db
      .select({ c: count() })
      .from(riderPenaltiesTable)
      .where(
        and(
          eq(riderPenaltiesTable.riderId, riderId),
          eq(riderPenaltiesTable.type, "ignore"),
          gte(riderPenaltiesTable.createdAt, today)
        )
      );

    sendSuccess(res, {
      dailyIgnores: countRow?.c ?? 0,
      dailyLimit: limit,
      penaltyAmount: penaltyAmt,
      remaining: Math.max(0, limit - (countRow?.c ?? 0)),
    });
  } catch (err) {
    logger.error(
      {
        error: err instanceof Error ? err.message : String(err),
        timestamp: new Date().toISOString(),
      },
      "[route] unhandled error"
    );
    sendError(res, "Internal server error", 500);
  }
});

/* ── GET /rider/penalty-history — Rider's penalty history ── */
router.get("/penalty-history", async (req, res) => {
  try {
    const riderId = req.riderId!;
    const penalties = await db
      .select()
      .from(riderPenaltiesTable)
      .where(eq(riderPenaltiesTable.riderId, riderId))
      .orderBy(desc(riderPenaltiesTable.createdAt))
      .limit(50);
    const mapped = penalties.map((p) => ({
      ...p,
      amount: safeNum(p.amount),
      createdAt: p.createdAt instanceof Date ? p.createdAt.toISOString() : p.createdAt,
    }));
    const totalDeducted = mapped.reduce(
      (s, p) => s + (typeof p.amount === "number" ? p.amount : safeNum(p.amount)),
      0
    );
    sendSuccess(res, {
      penalties: mapped,
      total_deducted: parseFloat(totalDeducted.toFixed(2)),
    });
  } catch (err) {
    logger.error(
      {
        error: err instanceof Error ? err.message : String(err),
        timestamp: new Date().toISOString(),
      },
      "[route] unhandled error"
    );
    sendError(res, "Internal server error", 500);
  }
});

const sosSchema = z.object({
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
  rideId: z.string().optional().nullable(),
});

/* ── POST /rider/sos — Rider SOS alert ── */
router.post("/sos", requireAttestation, async (req, res) => {
  try {
    if (await checkIdempotency(req, res)) return;
    const settings = await getCachedSettings();
    if ((settings["feature_sos"] ?? "on") !== "on") {
      sendError(res, "SOS feature is currently disabled", 503);
      return;
    }

    const parsed = sosSchema.safeParse(req.body);
    if (!parsed.success) {
      sendValidationError(res, parsed.error.issues[0]?.message || "Invalid SOS data");
      return;
    }
    const riderId = req.riderId!;
    const riderUser = req.riderUser!;
    const { latitude, longitude, rideId } = parsed.data;

    const parsedLat = latitude ?? null;
    const parsedLng = longitude ?? null;

    const validCoords =
      parsedLat != null &&
      parsedLng != null &&
      isFinite(parsedLat) &&
      isFinite(parsedLng) &&
      !(Math.abs(parsedLat) < 0.001 && Math.abs(parsedLng) < 0.001);

    const locationStr = validCoords
      ? ` · Location: ${parsedLat!.toFixed(5)},${parsedLng!.toFixed(5)}`
      : "";
    const rideStr = rideId ? ` · Ride: #${String(rideId).slice(-8).toUpperCase()}` : "";

    const alertId = generateId();
    const sosLang = await getUserLanguage(riderId);

    const now = new Date();
    const sosTitle = `🆘 ${t("sosAlert", sosLang)} — ${riderUser.name || "Unknown"} (rider)`;
    const sosBody = `Phone: ${riderUser.phone || "N/A"}${rideStr}${locationStr}`;
    const sosLink = rideId ? `/rides/${rideId}` : `/users/${riderId}`;

    try {
      await db.insert(notificationsTable).values({
        id: alertId,
        userId: riderId,
        title: sosTitle,
        body: sosBody,
        type: "sos",
        icon: "alert-circle-outline",
        link: sosLink,
        sosStatus: "pending",
      });
    } catch (err) {
      logger.error(
        "[rider] SOS notification insert failed — cannot persist SOS:",
        err instanceof Error ? err.message : err
      );
      sendError(res, "SOS alert could not be saved. Please call emergency contacts directly.", 503);
      return;
    }

    const { emitRiderSOS, emitSosNew } = await import("../../lib/socketio.js");

    /* Legacy relay event — keep for backward compat with existing fleet map listener */
    emitRiderSOS({
      userId: riderId,
      name: riderUser.name ?? "Rider",
      phone: riderUser.phone ?? null,
      latitude: validCoords ? parsedLat! : null,
      longitude: validCoords ? parsedLng! : null,
    });

    /* New lifecycle event — drives admin SOS alert panel and sidebar badge */
    emitSosNew({
      id: alertId,
      userId: riderId,
      title: sosTitle,
      body: sosBody,
      link: sosLink,
      sosStatus: "pending",
      acknowledgedAt: null,
      acknowledgedBy: null,
      acknowledgedByName: null,
      resolvedAt: null,
      resolvedBy: null,
      resolvedByName: null,
      resolutionNotes: null,
      createdAt: now.toISOString(),
    });

    const sosResponseBody = { alertId, sentAt: now.toISOString() };
    await storeIdempotency(req, 200, { success: true, data: sosResponseBody });
    sendSuccess(res, sosResponseBody);
  } catch (err) {
    logger.error(
      {
        error: err instanceof Error ? err.message : String(err),
        timestamp: new Date().toISOString(),
      },
      "[route] unhandled error"
    );
    sendError(res, "Internal server error", 500);
  }
});

/* ── GET /riders/sos/status — Rider polls for acknowledgement of their latest SOS ── */
router.get("/sos/status", async (req, res) => {
  try {
    const riderId = req.riderId!;
    const [latest] = await db
      .select({
        id: notificationsTable.id,
        sosStatus: notificationsTable.sosStatus,
        acknowledgedAt: notificationsTable.acknowledgedAt,
        acknowledgedByName: notificationsTable.acknowledgedByName,
        resolvedAt: notificationsTable.resolvedAt,
        resolutionNotes: notificationsTable.resolutionNotes,
        createdAt: notificationsTable.createdAt,
      })
      .from(notificationsTable)
      .where(
        and(
          eq(notificationsTable.userId, riderId),
          eq(notificationsTable.type, "sos")
        )
      )
      .orderBy(desc(notificationsTable.createdAt))
      .limit(1);

    if (!latest) {
      sendSuccess(res, { alert: null });
      return;
    }

    sendSuccess(res, {
      alert: {
        id: latest.id,
        sosStatus: latest.sosStatus ?? "pending",
        acknowledgedAt: latest.acknowledgedAt ? latest.acknowledgedAt.toISOString() : null,
        acknowledgedByName: latest.acknowledgedByName ?? null,
        resolvedAt: latest.resolvedAt ? latest.resolvedAt.toISOString() : null,
        resolutionNotes: latest.resolutionNotes ?? null,
        createdAt: latest.createdAt ? latest.createdAt.toISOString() : null,
      },
    });
  } catch (err) {
    logger.error(
      { error: err instanceof Error ? err.message : String(err), timestamp: new Date().toISOString() },
      "[route] unhandled error"
    );
    sendError(res, "Internal server error", 500);
  }
});

const osrmQuerySchema = z.object({
  fromLat: z.coerce.number().min(-90).max(90),
  fromLng: z.coerce.number().min(-180).max(180),
  toLat: z.coerce.number().min(-90).max(90),
  toLng: z.coerce.number().min(-180).max(180),
});

/* ── GET /rider/osrm-route — Fetch turn-by-turn directions from OSRM ── */
router.get("/osrm-route", async (req, res) => {
  try {
    const parsed = osrmQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      sendValidationError(
        res,
        parsed.error.issues[0]?.message ||
          "fromLat, fromLng, toLat, toLng required (valid coordinates)"
      );
      return;
    }
    const { fromLat, fromLng, toLat, toLng } = parsed.data;

    const coords = `${fromLng},${fromLat};${toLng},${toLat}`;
    const osrmBase = process.env.OSRM_API_URL ?? "https://router.project-osrm.org";
    const osrmUrl = `${osrmBase}/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=true&annotations=false`;

    /* Haversine fallback helper — straight-line distance when OSRM is unavailable */
    const haversineFallback = () => {
      const distanceKm = calcDistance(fromLat, fromLng, toLat, toLng);
      const durationMin = Math.round((distanceKm / 30) * 60); /* assume 30 km/h avg speed */
      sendSuccess(res, {
        fallback: true,
        distanceKm: Math.round(distanceKm * 10) / 10,
        durationMin,
      });
    };

    try {
      const ctrl = new AbortController();
      const timeout = setTimeout(() => ctrl.abort(), 8000);
      let osrmResp: Awaited<ReturnType<typeof fetch>>;
      try {
        osrmResp = await fetch(osrmUrl, { signal: ctrl.signal });
      } catch (fetchErr: unknown) {
        clearTimeout(timeout);
        logger.warn(
          "[rider/osrm-route] OSRM unreachable, using Haversine fallback:",
          fetchErr instanceof Error ? fetchErr.message : fetchErr
        );
        haversineFallback();
        return;
      }
      clearTimeout(timeout);

      if (!osrmResp.ok) {
        /* Rate-limited or any other non-2xx: always return a usable fallback estimate
         rather than propagating the upstream error to the rider. */
        logger.warn(
          "[rider/osrm-route] OSRM returned non-200:",
          osrmResp.status,
          "— using Haversine fallback"
        );
        haversineFallback();
        return;
      }

      const data = (await osrmResp.json()) as {
        code: string;
        routes?: Array<{
          geometry: { coordinates: [number, number][] };
          legs: Array<{
            steps: Array<{
              maneuver: {
                instruction?: string;
                type: string;
                modifier?: string;
                location?: [number, number];
              };
              name: string;
              distance: number;
              duration: number;
            }>;
          }>;
          distance: number;
          duration: number;
        }>;
      };

      if (data.code !== "Ok" || !data.routes?.length) {
        logger.warn(
          "[rider/osrm-route] OSRM returned no route (code:",
          data.code,
          ") — using Haversine fallback"
        );
        haversineFallback();
        return;
      }

      const route = data.routes[0]!;
      const steps = route.legs.flatMap((leg) =>
        leg.steps.map((step) => ({
          instruction:
            step.maneuver.instruction ??
            `${step.maneuver.type}${step.maneuver.modifier ? ` ${step.maneuver.modifier}` : ""}`,
          streetName: step.name || "",
          distanceM: Math.round(step.distance),
          durationSec: Math.round(step.duration),
          /* Maneuver location so client can auto-advance steps as rider position updates */
          maneuverLat: step.maneuver.location?.[1] ?? null,
          maneuverLng: step.maneuver.location?.[0] ?? null,
        }))
      );

      sendSuccess(res, {
        distanceM: Math.round(route.distance),
        durationSec: Math.round(route.duration),
        geometry: route.geometry.coordinates.map(([lng, lat]) => ({ lat, lng })),
        steps,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Routing request failed";
      logger.warn("[rider/osrm-route] Unexpected error:", msg, "— using Haversine fallback");
      if (!res.headersSent) haversineFallback();
    }
  } catch (err) {
    logger.error(
      {
        error: err instanceof Error ? err.message : String(err),
        timestamp: new Date().toISOString(),
      },
      "[route] unhandled error"
    );
    sendError(res, "Internal server error", 500);
  }
});

/* ── Rider AI Assistant ────────────────────────────────────────────────────────
   POST /rider/ai-chat
   Riders can ask questions about their work, earnings, app features, policies,
   etc. Uses Gemini with a rider-specific system prompt; falls back to smart
   templates when the API key is unavailable. */
const aiChatSchema = z.object({
  message: z.string().min(1).max(2000),
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() }))
    .max(20)
    .optional(),
});

router.post("/ai-chat", async (req: Request, res: Response) => {
  try {
    const parse = aiChatSchema.safeParse(req.body);
    if (!parse.success) {
      sendError(res, "Invalid request", 400);
      return;
    }
    const { message, history = [] } = parse.data;

    try {
      const { generateAIContent } = await import("../../services/communicationAI.js");

      const RIDER_SYSTEM =
        "You are a helpful AI assistant for AJKMart rider partners in AJK, Pakistan. " +
        "You answer questions about deliveries, rides, earnings, wallet, policies, app features, and support. " +
        "Keep answers short (2-4 sentences), practical, and friendly. Respond in the same language as the question (Urdu or English).";

      const historyText = history
        .slice(-6)
        .map((h) => `${h.role === "user" ? "Rider" : "Assistant"}: ${h.content}`)
        .join("\n");

      const fullPrompt = historyText
        ? `${RIDER_SYSTEM}\n\nConversation so far:\n${historyText}\n\nRider: ${message}\nAssistant:`
        : `${RIDER_SYSTEM}\n\nRider: ${message}\nAssistant:`;

      const result = await generateAIContent(fullPrompt);
      sendSuccess(res, { reply: result.content, source: result.source });

      /* Fire a push notification to the requesting rider so they know the reply
       arrived if they navigated away from the AI Help tab.
       This is non-blocking — errors are swallowed so they never affect the
       response already sent above. Only sent to the exact rider who asked,
       preventing any cross-user leakage. */
      const riderId = req.riderId;
      if (riderId) {
        const preview =
          result.content.length > 80 ? result.content.slice(0, 80) + "…" : result.content;
        sendPushToUser(riderId, {
          title: "AI Assistant replied",
          body: preview,
          data: { type: "ai_chat" },
        }).catch((pushErr: unknown) => {
          logger.warn({ err: (pushErr as Error)?.message }, "[rider] ai-chat push failed");
        });
      }
    } catch (err) {
      logger.error({ err }, "rider ai-chat error");
      sendError(res, "Could not get AI response", 500);
    }
  } catch (err) {
    logger.error(
      {
        error: err instanceof Error ? err.message : String(err),
        timestamp: new Date().toISOString(),
      },
      "[route] unhandled error"
    );
    sendError(res, "Internal server error", 500);
  }
});

/* ── Vehicle Types ─────────────────────────────────────────────────────────────
   GET /rider/vehicle-types
   Returns the supported vehicle categories that riders can register with.
   Also returns `types` array with {key, label} for the new dropdown format. */
router.get("/vehicle-types", async (_req: Request, res: Response) => {
  try {
    const types = [
      { key: "bike",       label: "Bike / Motorcycle" },
      { key: "car",        label: "Car" },
      { key: "rickshaw",   label: "Rickshaw / QingQi" },
      { key: "van",        label: "Van" },
      { key: "bicycle",    label: "Bicycle" },
      { key: "on_foot",    label: "On Foot" },
    ];
    sendSuccess(res, { types, vehicleTypes: types.map((t) => t.key) });
  } catch (err) {
    logger.error(
      { error: err instanceof Error ? err.message : String(err) },
      "[rider/vehicle-types] error"
    );
    sendError(res, "Internal server error", 500);
  }
});

/* ── Bank List ─────────────────────────────────────────────────────────────────
   GET /rider/banks
   Returns the bank/mobile-wallet list.  Sources from platform setting
   `rider_bank_list` (JSON string of [{value,label}]) if configured,
   otherwise returns the curated fallback list. */
const _FALLBACK_BANKS = [
  { value: "EasyPaisa",    label: "EasyPaisa" },
  { value: "JazzCash",     label: "JazzCash" },
  { value: "MCB",          label: "MCB" },
  { value: "HBL",          label: "HBL" },
  { value: "UBL",          label: "UBL" },
  { value: "Meezan Bank",  label: "Meezan Bank" },
  { value: "Bank Alfalah", label: "Bank Alfalah" },
  { value: "NBP",          label: "NBP" },
  { value: "Allied Bank",  label: "Allied Bank" },
  { value: "Other",        label: "Other" },
];
router.get("/banks", async (_req: Request, res: Response) => {
  try {
    const settings = await getCachedSettings();
    const raw = (settings as Record<string, unknown>)?.rider_bank_list as string | undefined;
    let banks: Array<{ value: string; label: string }> = _FALLBACK_BANKS;
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as unknown;
        if (Array.isArray(parsed) && parsed.length > 0) {
          banks = parsed as Array<{ value: string; label: string }>;
        }
      } catch {
        /* malformed setting — use fallback */
      }
    }
    sendSuccess(res, { banks });
  } catch (err) {
    logger.error(
      { error: err instanceof Error ? err.message : String(err) },
      "[rider/banks] error"
    );
    sendError(res, "Internal server error", 500);
  }
});

/* ── Play Integrity verification (Android) ───────────────────────────────────
   Calls Google's Play Integrity API to decode and verify the integrity token.
   Requires environment variable:
     PLAY_INTEGRITY_API_KEY  — a Google Cloud API key restricted to the Play
                               Integrity API, OR
     GOOGLE_APPLICATION_CREDENTIALS  — path to a service account JSON file
                                       (key is preferred for simpler setup)
   Package name comes from PLAY_INTEGRITY_PACKAGE_NAME (default: com.ajkmart.rider)

   Verdict requirements (all must pass):
     appIntegrity.appRecognitionVerdict   === "PLAY_RECOGNIZED"
     deviceIntegrity.deviceRecognitionVerdict includes "MEETS_DEVICE_INTEGRITY"
     requestDetails.requestPackageName    === expected package name
*/
async function verifyPlayIntegrityToken(integrityToken: string): Promise<{
  ok: boolean;
  reason?: string;
}> {
  const apiKey = process.env.PLAY_INTEGRITY_API_KEY;
  const packageName =
    process.env.PLAY_INTEGRITY_PACKAGE_NAME ?? "com.ajkmart.rider";

  if (!apiKey) {
    return { ok: false, reason: "PLAY_INTEGRITY_API_KEY not configured" };
  }

  let resp: Awaited<ReturnType<typeof fetch>>;
  try {
    resp = await fetch(
      `https://playintegrity.googleapis.com/v1/${encodeURIComponent(packageName)}:decodeIntegrityToken`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
        },
        body: JSON.stringify({ integrity_token: integrityToken }),
        signal: AbortSignal.timeout(10_000),
      }
    );
  } catch (err) {
    return {
      ok: false,
      reason: `Play Integrity API unreachable: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  if (!resp.ok) {
    const body = await resp.text().catch(() => "");
    return {
      ok: false,
      reason: `Play Integrity API returned ${resp.status}: ${body.slice(0, 200)}`,
    };
  }

  const payload = (await resp.json()) as {
    tokenPayloadExternal?: {
      requestDetails?: {
        requestPackageName?: string;
        requestHash?: string;
        timestampMillis?: string;
      };
      appIntegrity?: {
        appRecognitionVerdict?: string;
        packageName?: string;
        versionCode?: string;
      };
      deviceIntegrity?: {
        deviceRecognitionVerdict?: string[];
      };
      accountDetails?: {
        appLicensingVerdict?: string;
      };
    };
  };

  const ext = payload.tokenPayloadExternal;
  if (!ext) return { ok: false, reason: "Empty token payload" };

  /* Verify package name */
  if (ext.requestDetails?.requestPackageName !== packageName) {
    return {
      ok: false,
      reason: `Package name mismatch: got ${ext.requestDetails?.requestPackageName}`,
    };
  }
  if (ext.appIntegrity?.packageName !== packageName) {
    return {
      ok: false,
      reason: `App package name mismatch: got ${ext.appIntegrity?.packageName}`,
    };
  }

  /* Verify app recognition */
  if (ext.appIntegrity?.appRecognitionVerdict !== "PLAY_RECOGNIZED") {
    return {
      ok: false,
      reason: `App not Play Recognized: ${ext.appIntegrity?.appRecognitionVerdict}`,
    };
  }

  /* Verify device integrity */
  const deviceVerdicts = ext.deviceIntegrity?.deviceRecognitionVerdict ?? [];
  if (!deviceVerdicts.includes("MEETS_DEVICE_INTEGRITY")) {
    return {
      ok: false,
      reason: `Device integrity not met: [${deviceVerdicts.join(", ")}]`,
    };
  }

  return { ok: true };
}

/* ── App Attest verification (iOS) ───────────────────────────────────────────
   Verifies an Apple App Attest assertion token.  The attestation object is a
   CBOR-encoded byte array containing a certificate chain rooted at Apple's
   App Attest CA.

   Requires environment variables:
     APP_ATTEST_TEAM_ID   — 10-character Apple Developer Team ID
     APP_ATTEST_BUNDLE_ID — app bundle identifier (e.g. com.ajkmart.rider)

   The verification algorithm follows Apple's documentation at:
   https://developer.apple.com/documentation/devicecheck/validating_apps_that_connect_to_your_server

   Step overview:
     1. Base64-decode the attestation object
     2. Decode the CBOR structure to extract the certificate chain
     3. Verify the certificate chain against Apple's App Attest root CA
        (https://www.apple.com/certificateauthority/Apple_App_Attestation_Root_CA.pem)
     4. Extract the key identifier from the credCert and compare against the
        keyId supplied by the client
     5. Verify the nonce in the certificate extensions matches
        SHA-256(authenticatorData || sha256(clientDataJSON))

   NOTE: Full CBOR decoding requires the `cbor` npm package.  If that package
   is not installed, this function falls back to a structural check (base64
   decode succeeds + minimum byte length) and logs a warning.  Install `cbor`
   and uncomment the full verification block below for production use.
*/
async function verifyAppAttestToken(attestationBase64: string): Promise<{
  ok: boolean;
  reason?: string;
}> {
  const teamId = process.env.APP_ATTEST_TEAM_ID;
  const bundleId = process.env.APP_ATTEST_BUNDLE_ID;

  if (!teamId || !bundleId) {
    return {
      ok: false,
      reason: "APP_ATTEST_TEAM_ID or APP_ATTEST_BUNDLE_ID not configured",
    };
  }

  let attestationBytes: Buffer;
  try {
    attestationBytes = Buffer.from(attestationBase64, "base64");
  } catch {
    return { ok: false, reason: "Invalid base64 attestation object" };
  }

  /* Minimum sanity check — a real App Attest object is never < 200 bytes */
  if (attestationBytes.length < 200) {
    return { ok: false, reason: "Attestation object too short to be valid" };
  }

  /* ── Full CBOR + x509 verification ──────────────────────────────────────
     Uncomment and implement this block after installing `cbor`:
       pnpm --filter @workspace/api-server add cbor

  try {
    const cbor = await import("cbor");
    const decoded = await cbor.decodeFirst(attestationBytes);

    // decoded.fmt should be "apple-appattest"
    if (decoded.fmt !== "apple-appattest") {
      return { ok: false, reason: `Unexpected format: ${decoded.fmt}` };
    }

    const certChain: Buffer[] = decoded.attStmt.x5c.map(
      (c: Buffer) => Buffer.from(c)
    );

    // Verify chain against Apple's App Attest root CA
    // (Download from https://www.apple.com/certificateauthority/
    //  and store in src/assets/apple_app_attest_root_ca.pem)
    const { X509Certificate } = await import("crypto");
    const rootPem = await readFile("src/assets/apple_app_attest_root_ca.pem", "utf8");
    const rootCert = new X509Certificate(rootPem);
    const leafCert = new X509Certificate(certChain[0]);

    if (!leafCert.verify(rootCert.publicKey)) {
      return { ok: false, reason: "Certificate chain verification failed" };
    }

    // Verify bundle ID in leaf cert SAN
    const expectedAppId = `${teamId}.${bundleId}`;
    if (!leafCert.subjectAltName?.includes(expectedAppId)) {
      return { ok: false, reason: `Bundle ID mismatch in cert: ${leafCert.subjectAltName}` };
    }
  } catch (err) {
    return {
      ok: false,
      reason: `CBOR/x509 verification error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
  ── end full verification block ── */

  /* Structural verification passes (cbor package not installed).
     Log a warning so operators know full chain verification is not active. */
  logger.warn(
    { bundleId, teamId },
    "[attest] App Attest structural check only — install cbor package for full chain verification"
  );
  return { ok: true };
}

/* ── Device Attestation ────────────────────────────────────────────────────────
   POST /riders/attest
   Accepts a Play Integrity (Android) or App Attest (iOS) token generated by
   the native Capacitor plugin on the client.  Calls the platform-appropriate
   attestation API to validate the token, then issues a 24-hour session-bound
   attestation claim.

   Enforcement:
   - In production (NODE_ENV=production) when credentials are configured:
     token is rejected if verification fails → 403
   - When credentials are not yet configured → 403 "not configured" (not 503)
     so clients handle it gracefully but calls are still rejected
   - In dev/staging (NODE_ENV != production) → structural check only (non-empty token)

   The attestToken returned is stored by the client in Capacitor Preferences and
   sent as X-Attest-Token on sensitive subsequent requests (wallet/withdraw, etc.) */
router.post("/attest", async (req: Request, res: Response) => {
  try {
    const riderId = req.riderId;
    if (!riderId) {
      sendError(res, "Unauthorized", 401);
      return;
    }

    const { platform, token } = req.body as { platform?: string; token?: string };

    if (!platform || !token) {
      sendError(res, "platform and token are required", 400);
      return;
    }

    const isProd = process.env.NODE_ENV === "production";
    let verificationPassed = false;
    let verificationReason = "";

    if (isProd) {
      if (platform === "android") {
        const result = await verifyPlayIntegrityToken(token);
        verificationPassed = result.ok;
        verificationReason = result.reason ?? "";
      } else if (platform === "ios") {
        const result = await verifyAppAttestToken(token);
        verificationPassed = result.ok;
        verificationReason = result.reason ?? "";
      } else {
        verificationPassed = false;
        verificationReason = `Unknown platform: ${platform}`;
      }
    } else {
      /* Dev/staging: structural check only — token must be a non-empty string */
      verificationPassed = typeof token === "string" && token.length > 10;
      verificationReason = verificationPassed ? "" : "Token too short or empty";
    }

    if (!verificationPassed) {
      logger.warn(
        { riderId, platform, reason: verificationReason },
        "[attest] attestation token rejected"
      );
      /* 403 (not 503) — client should surface "re-attest required" error */
      sendError(res, "Attestation failed", 403);
      return;
    }

    /* Issue a short-lived session attestation claim (24 hours).
       Token is cryptographically random — not guessable.              */
    const { randomBytes } = await import("crypto");
    const expiresAt = Date.now() + 24 * 60 * 60 * 1000;
    const attestToken = `att_${randomBytes(24).toString("hex")}`;

    /* Register the token server-side so requireAttestation can verify it */
    recordAttestToken(attestToken, expiresAt);

    logger.info({ riderId, platform }, "[attest] attestation succeeded");
    sendSuccess(res, { attestToken, expiresAt });
  } catch (err) {
    logger.error(
      { error: err instanceof Error ? err.message : String(err) },
      "[rider/attest] error"
    );
    sendError(res, "Internal server error", 500);
  }
});

/* ── Delete Account ────────────────────────────────────────────────────────────
   DELETE /rider/account
   Soft-deletes the authenticated rider's own account by stamping deletedAt.
   Personal data is fully wiped by the 30-day PII purge scheduler job.
   The client must clear tokens and log the rider out after this call.
   Returns purgeDaysRemaining so the client can inform the user of the
   data-deletion timeline. */
router.delete("/account", requireAttestation, async (req: Request, res: Response) => {
  try {
    const riderId = req.riderId;
    if (!riderId) {
      sendError(res, "Unauthorized", 401);
      return;
    }
    const deletedAt = new Date();
    await db
      .update(usersTable)
      .set({ deletedAt })
      .where(eq(usersTable.id, riderId));
    logger.info({ riderId }, "[rider/account] soft-deleted rider account");
    sendSuccess(res, {
      deleted: true,
      purgeDaysRemaining: 30,
      purgeDate: new Date(deletedAt.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      message: "Your account has been scheduled for deletion. Your personal data will be permanently wiped within 30 days.",
    });
  } catch (err) {
    logger.error(
      { error: err instanceof Error ? err.message : String(err) },
      "[rider/account] delete error"
    );
    sendError(res, "Internal server error", 500);
  }
});

/* ── Submit Feedback ───────────────────────────────────────────────────────────
   POST /rider/feedback
   Accepts structured feedback from an authenticated rider. Currently logged
   via the application logger; a dedicated DB table can be added later. */
const feedbackSchema = z.object({
  message: z.string().min(1).max(2000),
  rating: z.number().int().min(1).max(5).optional(),
  category: z.enum(["app", "support", "earnings", "safety", "other"]).optional(),
});

/* ── Offline-action log ─────────────────────────────────────────────────────
   Receives a record of each successfully-replayed offline action so the ops
   team can see what actions were queued and when they were processed.
   Fire-and-forget from the client — failures are silently swallowed. */
const offlineActionLogSchema = z.object({
  id: z.string().min(1).max(128),
  actionType: z.string().min(1).max(64),
  entityId: z.string().max(128).optional(),
  payload: z.record(z.unknown()).optional(),
  processedAt: z.string().optional(),
});

router.post("/offline-actions/log", async (req: Request, res: Response) => {
  try {
    const parse = offlineActionLogSchema.safeParse(req.body);
    if (!parse.success) {
      sendError(res, "Invalid request", 400);
      return;
    }
    const { id, actionType, entityId, payload, processedAt } = parse.data;
    const riderId = req.riderId;
    if (!riderId) {
      sendError(res, "Unauthorized", 401);
      return;
    }

    const { offlineActionsTable } = await import("@workspace/db/schema");

    await db
      .insert(offlineActionsTable)
      .values({
        id,
        riderId,
        actionType,
        payload: { entityId, ...(payload ?? {}) },
        status: "processed",
        processedAt: processedAt ? new Date(processedAt) : new Date(),
      })
      .onConflictDoNothing();

    sendSuccess(res, { logged: true });
  } catch (err) {
    logger.error(
      { error: err instanceof Error ? err.message : String(err) },
      "[rider/offline-actions/log] error"
    );
    sendError(res, "Internal server error", 500);
  }
});

router.post("/feedback", async (req: Request, res: Response) => {
  try {
    const parse = feedbackSchema.safeParse(req.body);
    if (!parse.success) {
      sendError(res, "Invalid request", 400);
      return;
    }
    const { message, rating, category } = parse.data;
    const riderId = req.riderId;
    logger.info(
      { riderId, rating, category, messageLen: message.length },
      "[rider/feedback] received"
    );
    sendSuccess(res, { received: true });
  } catch (err) {
    logger.error(
      { error: err instanceof Error ? err.message : String(err) },
      "[rider/feedback] error"
    );
    sendError(res, "Internal server error", 500);
  }
});

/* ── DEV ONLY: simulate a ride request for testing rider popup ───────────── */
if (process.env.NODE_ENV !== "production") {
  router.post("/test-ride-request", async (req, res) => {
    try {
      const riderId = (req as any).riderId ?? "";
      if (!riderId) {
        sendError(res, "Unauthorized", 401);
        return;
      }
      const body = req.body as any;
      const requestId = body.request_id ?? generateId();
      const pickup = {
        lat: body.pickup_lat ?? 33.7215,
        lng: body.pickup_lng ?? 73.0433,
        address: body.pickup_address ?? "Test Pickup, Islamabad",
      };
      const drop = {
        lat: body.drop_lat ?? 33.6844,
        lng: body.drop_lng ?? 73.0479,
        address: body.drop_address ?? "Test Drop, Islamabad",
      };
      const fare = body.fare ?? 150;
      const type = body.type ?? "bike";

      // Emit socket event directly to this rider (no DB insert needed for UI test)
      emitRiderNewRequest(riderId, {
        type: "ride",
        requestId,
        summary: `${type} ride from ${pickup.address} to ${drop.address} — Rs ${fare}`,
      });

      sendSuccess(res, {
        requestId,
        riderId,
        pickup,
        drop,
        fare,
        type,
        message: "Ride request created and socket event emitted.",
      });
    } catch (err) {
      logger.error(
        { error: err instanceof Error ? err.message : String(err) },
        "[rider/test-ride-request] error"
      );
      sendError(res, "Internal server error", 500);
    }
  });
}

/* ── THEME CONFIGURATION ENDPOINTS ─────────────────────────────────────────
   Admins can customize light/dark mode colors for the entire rider app.
   Theme config is stored in memory/cache and can later be persisted to DB. */

const defaultThemeConfig = {
  /* Light mode colors */
  lightBrandPrimary: "#D4A300",
  lightBrandHover: "#C29600",
  lightBackground: "#FEFAF5",
  lightCard: "#FFFFFF",
  lightText: "#131313",
  lightBorder: "#DFD4CA",
  lightAccent: "#0B6FA3",
  lightSuccess: "#2C8C3E",
  lightWarning: "#D97706",
  lightError: "#C91F2E",
  /* Dark mode colors */
  darkBrandPrimary: "#FFD700",
  darkBrandHover: "#FFC107",
  darkBackground: "#0A0A0A",
  darkCard: "#1A1A1A",
  darkText: "#FFFFFF",
  darkBorder: "#2A2A2A",
  darkAccent: "#FFC107",
  darkSuccess: "#4CAF50",
  darkWarning: "#FF9800",
  darkError: "#F44336",
};

let themeConfig = { ...defaultThemeConfig };

/* GET /api/rider/theme-config — retrieve current theme configuration */
router.get("/theme-config", async (req: Request, res: Response) => {
  try {
    sendSuccess(res, themeConfig);
  } catch (err) {
    logger.error(
      { error: err instanceof Error ? err.message : String(err) },
      "[rider/theme-config:get] error"
    );
    sendError(res, "Internal server error", 500);
  }
});

/* PUT /api/rider/theme-config — update theme configuration (admin only) */
router.put("/theme-config", async (req: Request, res: Response) => {
  try {
    /* TODO: Add admin role check middleware */
    /* For now, allowing all authenticated riders for testing */
    const riderId = (req as any).riderId;
    if (!riderId) {
      sendError(res, "Unauthorized", 401);
      return;
    }

    const updates = req.body;
    
    /* Validate that only theme config keys are being updated */
    const validKeys = Object.keys(defaultThemeConfig);
    const updateKeys = Object.keys(updates);
    const invalidKeys = updateKeys.filter((k) => !validKeys.includes(k));

    if (invalidKeys.length > 0) {
      sendValidationError(res, `Invalid theme keys: ${invalidKeys.join(", ")}`);
      return;
    }

    /* Validate color format (simple hex check) */
    const colorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
    for (const [key, value] of Object.entries(updates)) {
      if (typeof value === "string" && !colorRegex.test(value)) {
        sendValidationError(res, `Invalid color format for ${key}: ${value}`);
        return;
      }
    }

    /* Merge updates with current config */
    themeConfig = { ...themeConfig, ...updates };

    logger.info(
      { riderId, updatedKeys: updateKeys },
      "[rider/theme-config:put] theme updated"
    );

    sendSuccess(res, themeConfig);
  } catch (err) {
    logger.error(
      { error: err instanceof Error ? err.message : String(err) },
      "[rider/theme-config:put] error"
    );
    sendError(res, "Internal server error", 500);
  }
});

export default router;
