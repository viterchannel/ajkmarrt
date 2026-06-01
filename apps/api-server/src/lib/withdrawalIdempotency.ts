/**
 * Atomic idempotency guard for wallet withdrawal endpoints.
 *
 * Pattern (Redis available):
 *   1. GET rKey → if found, replay cached response or return 409 (in-flight).
 *   2. SET NX rKey "__in_flight__" EX 30 → 409 if another request holds the lock.
 *   3. Return { type:"acquired", commit, release } so the caller can:
 *        commit(status, body) — writes final response to Redis (5-min TTL)
 *        release()            — deletes the lock so clients can retry on failure
 *
 * Pattern (Redis unavailable):
 *   Falls back to the idempotency_keys table using INSERT ON CONFLICT DO NOTHING
 *   (same atomic-acquire pattern used by wallet.ts deposit/send flows).
 *
 * When rawKey is null/undefined the function returns a no-op "acquired" result
 * so callers need no conditional logic when the header is optional.
 */

import { db } from "@workspace/db";
import { idempotencyKeysTable } from "@workspace/db/schema";
import { and, eq } from "drizzle-orm";
import { generateId } from "./id.js";
import { logger } from "./logger.js";

const WITHDRAWAL_IDEM_TTL_SEC = 5 * 60;
const WITHDRAWAL_IDEM_TTL_MS = WITHDRAWAL_IDEM_TTL_SEC * 1000;
const INFLIGHT_TTL_SEC = 30;
const IN_FLIGHT_MARKER = "__in_flight__";

let _redis: import("ioredis").default | null | undefined = undefined;

async function getRedis() {
  if (_redis !== undefined) return _redis;
  try {
    const { redisClient } = await import("./redis.js");
    _redis = redisClient ?? null;
  } catch {
    _redis = null;
  }
  return _redis;
}

export type WithdrawalIdempotencyOutcome =
  | { type: "cached"; statusCode: number; body: unknown }
  | { type: "in_flight" }
  | {
      type: "acquired";
      txKey: string | undefined;
      commit: (statusCode: number, body: unknown) => Promise<void>;
      release: () => Promise<void>;
    };

const NOOP_ACQUIRED: Extract<WithdrawalIdempotencyOutcome, { type: "acquired" }> = {
  type: "acquired",
  txKey: undefined,
  commit: async () => {},
  release: async () => {},
};

/**
 * @param userId  The user performing the withdrawal.
 * @param rawKey  Raw value of X-Idempotency-Key header; null/undefined → no-op.
 * @param scope   Scope prefix to prevent cross-role key collisions in shared tables.
 */
export async function withdrawalIdempotency(
  userId: string,
  rawKey: string | null | undefined,
  scope: "vendor" | "rider" | "customer"
): Promise<WithdrawalIdempotencyOutcome> {
  if (!rawKey) return NOOP_ACQUIRED;

  const txKey = `${scope}:${userId}:withdraw:${rawKey}`;
  const rKey = `wd_idem:${txKey}`;

  const redis = await getRedis();

  if (redis) {
    try {
      const existing = await redis.get(rKey);

      if (existing) {
        if (existing === IN_FLIGHT_MARKER) {
          return { type: "in_flight" };
        }
        try {
          const parsed = JSON.parse(existing) as { statusCode: number; body: unknown };
          return { type: "cached", statusCode: parsed.statusCode, body: parsed.body };
        } catch {
          await redis.del(rKey).catch(() => {});
        }
      }

      const acquired = await redis.set(rKey, IN_FLIGHT_MARKER, "EX", INFLIGHT_TTL_SEC, "NX");
      if (!acquired) {
        const current = await redis.get(rKey);
        if (current && current !== IN_FLIGHT_MARKER) {
          try {
            const parsed = JSON.parse(current) as { statusCode: number; body: unknown };
            return { type: "cached", statusCode: parsed.statusCode, body: parsed.body };
          } catch { }
        }
        return { type: "in_flight" };
      }

      return {
        type: "acquired",
        txKey,
        commit: async (statusCode: number, body: unknown) => {
          try {
            await redis.set(
              rKey,
              JSON.stringify({ statusCode, body }),
              "EX",
              WITHDRAWAL_IDEM_TTL_SEC
            );
          } catch (err) {
            logger.warn({ err, userId, rKey }, "[withdrawal-idem] Redis commit failed");
          }
        },
        release: async () => {
          try {
            const val = await redis.get(rKey);
            if (val === IN_FLIGHT_MARKER) await redis.del(rKey);
          } catch (err) {
            logger.warn({ err, userId, rKey }, "[withdrawal-idem] Redis release failed");
          }
        },
      };
    } catch (err) {
      logger.warn({ err, userId }, "[withdrawal-idem] Redis error — falling back to DB");
    }
  }

  return dbWithdrawalIdempotency(userId, txKey);
}

async function dbWithdrawalIdempotency(
  userId: string,
  txKey: string
): Promise<WithdrawalIdempotencyOutcome> {
  const dbKey = `wd_idem:${txKey}`;
  const ttlCutoff = new Date(Date.now() - WITHDRAWAL_IDEM_TTL_MS);

  try {
    const inserted = await db
      .insert(idempotencyKeysTable)
      .values({ id: generateId(), userId, idempotencyKey: dbKey, responseData: "{}" })
      .onConflictDoNothing()
      .returning({ id: idempotencyKeysTable.id });

    if (inserted.length > 0) return buildDbAcquired(userId, txKey, dbKey);

    const [existing] = await db
      .select()
      .from(idempotencyKeysTable)
      .where(
        and(
          eq(idempotencyKeysTable.userId, userId),
          eq(idempotencyKeysTable.idempotencyKey, dbKey)
        )
      )
      .limit(1);

    if (!existing) {
      const retry = await db
        .insert(idempotencyKeysTable)
        .values({ id: generateId(), userId, idempotencyKey: dbKey, responseData: "{}" })
        .onConflictDoNothing()
        .returning({ id: idempotencyKeysTable.id });
      return retry.length > 0 ? buildDbAcquired(userId, txKey, dbKey) : { type: "in_flight" };
    }

    if (existing.createdAt < ttlCutoff) {
      await db
        .delete(idempotencyKeysTable)
        .where(
          and(
            eq(idempotencyKeysTable.id, existing.id),
            eq(idempotencyKeysTable.userId, userId)
          )
        );
      const reinserted = await db
        .insert(idempotencyKeysTable)
        .values({ id: generateId(), userId, idempotencyKey: dbKey, responseData: "{}" })
        .onConflictDoNothing()
        .returning({ id: idempotencyKeysTable.id });
      return reinserted.length > 0
        ? buildDbAcquired(userId, txKey, dbKey)
        : { type: "in_flight" };
    }

    if (existing.responseData === "{}") {
      return { type: "in_flight" };
    }

    try {
      const parsed = JSON.parse(existing.responseData) as { _sc?: number; [k: string]: unknown };
      const { _sc, ...body } = parsed;
      return { type: "cached", statusCode: _sc ?? 200, body };
    } catch {
      return { type: "in_flight" };
    }
  } catch (err) {
    logger.error(
      { err, userId },
      "[withdrawal-idem] DB fallback error — proceeding without idempotency lock"
    );
    return NOOP_ACQUIRED;
  }
}

function buildDbAcquired(
  userId: string,
  txKey: string,
  dbKey: string
): Extract<WithdrawalIdempotencyOutcome, { type: "acquired" }> {
  return {
    type: "acquired",
    txKey,
    commit: async (statusCode: number, body: unknown) => {
      const payload = JSON.stringify({ _sc: statusCode, ...(body as object) });
      await db
        .update(idempotencyKeysTable)
        .set({ responseData: payload })
        .where(
          and(
            eq(idempotencyKeysTable.userId, userId),
            eq(idempotencyKeysTable.idempotencyKey, dbKey)
          )
        )
        .catch((e: Error) =>
          logger.warn({ userId, dbKey, err: e.message }, "[withdrawal-idem] DB commit failed")
        );
    },
    release: async () => {
      await db
        .delete(idempotencyKeysTable)
        .where(
          and(
            eq(idempotencyKeysTable.userId, userId),
            eq(idempotencyKeysTable.idempotencyKey, dbKey)
          )
        )
        .catch((e: Error) =>
          logger.warn({ userId, dbKey, err: e.message }, "[withdrawal-idem] DB release failed")
        );
    },
  };
}
