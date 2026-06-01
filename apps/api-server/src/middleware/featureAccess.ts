import { db } from "@workspace/db";
import { featureRulesTable, featureUsageLogTable, platformSettingsTable, riderGateEventsTable, usersTable } from "@workspace/db/schema";
import { and, count, eq, sql } from "drizzle-orm";
import type { NextFunction, Request, Response } from "express";
import { logger } from "../lib/logger.js";

export function checkFeatureAccess(featureName: string) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const userId = req.customerId ?? req.riderId ?? req.vendorId;
    if (!userId) {
      next();
      return;
    }

    try {
      const [user] = await db
        .select({
          phoneVerified: usersTable.phoneVerified,
          emailVerified: usersTable.emailVerified,
          documentsApproved: usersTable.documentsApproved,
          approvalStatus: usersTable.approvalStatus,
          walletBalance: usersTable.walletBalance,
          roles: usersTable.roles,
        })
        .from(usersTable)
        .where(eq(usersTable.id, userId))
        .limit(1);

      if (!user) {
        if (featureName === "accept_ride") {
          res.status(403).json({
            success: false,
            blocked: true,
            reason: "user_not_found",
            message: "Rider account not found.",
          });
          return;
        }
        next();
        return;
      }

      const role = (user.roles ?? "customer").split(",")[0]?.trim() ?? "customer";

      /* ── 3-Gate ride eligibility check (accept_ride, rider only) ──────────────
         Runs BEFORE the generic feature_rules / daily-cap pipeline.
         Gates are checked in order; first failure returns 403 immediately.
         If all three pass, execution falls through to the existing feature_rules
         and daily-usage-cap logic below — nothing is skipped.

         Gate 1: phoneVerified = true
         Gate 2: approvalStatus = "approved"
         Gate 3: walletBalance >= rider_min_balance (fetched live, no cache)

         Each 403 includes a machine-readable `reason` so the rider app can show
         the correct banner without string-matching the message. */
      if (featureName === "accept_ride" && role === "rider") {
        if (!user.phoneVerified) {
          db.insert(riderGateEventsTable)
            .values({ riderId: userId, gate: 1, reason: "phone_not_verified" })
            .catch((err) => logger.warn({ err, userId }, "[featureAccess] failed to log gate 1 event"));
          res.status(403).json({
            success: false,
            blocked: true,
            gate: 1,
            reason: "phone_not_verified",
            message: "Verify your phone to accept rides.",
          });
          return;
        }

        if (user.approvalStatus !== "approved") {
          db.insert(riderGateEventsTable)
            .values({ riderId: userId, gate: 2, reason: "account_not_approved", metadata: JSON.stringify({ approvalStatus: user.approvalStatus }) })
            .catch((err) => logger.warn({ err, userId }, "[featureAccess] failed to log gate 2 event"));
          res.status(403).json({
            success: false,
            blocked: true,
            gate: 2,
            reason: "account_not_approved",
            message: "Account pending admin approval.",
          });
          return;
        }

        /* Fetch rider_min_balance live from DB so admin changes take effect
           immediately without an app restart.
           Key: "rider_min_balance" (same key used by platform-config route →
           rider.minBalance and the admin settings panel UI field).

           Double-spend prevention: both the balance read and the gate decision
           run inside a transaction with SELECT … FOR UPDATE on the user row.
           This serializes concurrent accept_ride attempts so the second request
           reads the freshly-deducted balance (after the first request's handler
           has committed its deduction) rather than the stale pre-deduction value.
           Without this lock two simultaneous accepts could both pass gate 3
           and both deduct from the same wallet balance. */
        let platformMinBalance = 0;
        let riderBalance = 0;
        let balanceBelowMin = false;
        try {
          await db.transaction(async (tx) => {
            /* Acquire a row-level write lock on the user so concurrent accept
               requests are serialized behind this gate check.  The handler that
               runs after this middleware also uses FOR UPDATE when deducting,
               ensuring end-to-end serialization of the balance check + deduct. */
            const [lockedUser] = await tx
              .select({ walletBalance: usersTable.walletBalance })
              .from(usersTable)
              .where(eq(usersTable.id, userId))
              .for("update");

            const [minBalRow] = await tx
              .select({ value: platformSettingsTable.value })
              .from(platformSettingsTable)
              .where(eq(platformSettingsTable.key, "rider_min_balance"))
              .limit(1);

            platformMinBalance = parseFloat(minBalRow?.value ?? "0");
            riderBalance = parseFloat(String(lockedUser?.walletBalance ?? "0"));
            balanceBelowMin = platformMinBalance > 0 && riderBalance < platformMinBalance;
          });
        } catch (balErr) {
          logger.warn({ balErr, userId }, "[featureAccess] gate 3 balance transaction failed — failing closed");
          res.status(503).json({
            success: false,
            blocked: true,
            reason: "gate_check_error",
            message: "Service temporarily unavailable. Please try again.",
          });
          return;
        }

        if (balanceBelowMin) {
          db.insert(riderGateEventsTable)
            .values({
              riderId: userId,
              gate: 3,
              reason: "insufficient_wallet_balance",
              metadata: JSON.stringify({ currentBalance: riderBalance, minimumBalance: platformMinBalance }),
            })
            .catch((err) => logger.warn({ err, userId }, "[featureAccess] failed to log gate 3 event"));
          res.status(403).json({
            success: false,
            blocked: true,
            gate: 3,
            reason: "insufficient_wallet_balance",
            minimumBalance: platformMinBalance,
            currentBalance: riderBalance,
            message: `Please top up your wallet with minimum Rs. ${platformMinBalance} to start receiving rides.`,
          });
          return;
        }

        /* All 3 gates passed — fall through to feature_rules / daily-cap below. */
      }

      const [rule] = await db
        .select()
        .from(featureRulesTable)
        .where(
          and(
            eq(featureRulesTable.featureName, featureName),
            eq(featureRulesTable.role, role),
            eq(featureRulesTable.isActive, true)
          )
        )
        .limit(1);

      if (!rule) {
        if (featureName === "accept_ride") {
          res.status(503).json({
            success: false,
            blocked: true,
            reason: "gate_rule_not_found",
            message: "Service temporarily unavailable. Please try again.",
          });
          return;
        }
        next();
        return;
      }

      const required = (rule.requiredVerifications as string[]) ?? [];
      const missing: string[] = [];

      for (const v of required) {
        if ((v === "phone" || v === "phone_verified") && !user.phoneVerified) missing.push("phone_verified");
        if ((v === "email" || v === "email_verified") && !user.emailVerified) missing.push("email_verified");
        if ((v === "documents" || v === "documents_approved") && !user.documentsApproved) missing.push("documents_approved");
      }

      if (missing.length > 0) {
        res.status(403).json({
          success: false,
          blocked: true,
          reason: `Feature '${featureName}' requires the following verification(s): ${missing.join(", ")}`,
          requiredVerifications: required,
          missingVerifications: missing,
          fallbackMsg: rule.fallbackMsg ?? null,
        });
        return;
      }

      /* Enforce daily usage cap if maxDailyLimit > 0.
         Verified riders (documentsApproved) are exempt from the accept_ride cap.
         The count-check + insert is done inside a serializable transaction so
         concurrent requests cannot both slip past the cap. */
      const maxLimit = rule.maxDailyLimit ?? 0;
      const isVerifiedRider = featureName === "accept_ride" && user.documentsApproved;

      if (maxLimit > 0 && !isVerifiedRider) {
        const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

        let limitExceeded = false;
        let usedCount = 0;

        /* Fail-closed: any error in the daily-limit transaction returns 429/503
           rather than falling through to next() and allowing the request. */
        try {
          await db.transaction(async (tx) => {
            /* Serializable isolation prevents concurrent count+insert races */
            await tx.execute(sql`SET TRANSACTION ISOLATION LEVEL SERIALIZABLE`);

            const [usageRow] = await tx
              .select({ used: count() })
              .from(featureUsageLogTable)
              .where(
                and(
                  eq(featureUsageLogTable.userId, userId),
                  eq(featureUsageLogTable.featureName, featureName),
                  eq(featureUsageLogTable.date, today)
                )
              );

            usedCount = usageRow?.used ?? 0;
            if (usedCount >= maxLimit) {
              limitExceeded = true;
              return; // roll back (no insert)
            }

            /* Record usage atomically inside the same transaction */
            await tx.insert(featureUsageLogTable).values({
              userId,
              featureName,
              role,
              usedAt: new Date(),
              date: today,
            });
          });
        } catch (txErr) {
          /* Serialization conflict or DB error — fail closed so the cap is never bypassed */
          logger.warn({ txErr, userId, featureName }, "[featureAccess] daily-limit transaction failed — rejecting request (fail-closed)");
          res.status(503).json({
            success: false,
            blocked: true,
            reason: "daily_limit_check_error",
            fallbackMsg: "Service temporarily unavailable. Please try again.",
          });
          return;
        }

        if (limitExceeded) {
          res.status(429).json({
            success: false,
            blocked: true,
            reason: "daily_limit_exceeded",
            fallbackMsg: rule.fallbackMsg ?? `You have reached your daily limit of ${maxLimit} for this feature.`,
            limit: maxLimit,
            used: usedCount,
          });
          return;
        }
      }

      next();
    } catch (err) {
      logger.warn({ err, userId, featureName }, "[featureAccess] check failed");
      if (featureName === "accept_ride") {
        res.status(503).json({
          success: false,
          blocked: true,
          reason: "gate_check_error",
          message: "Service temporarily unavailable. Please try again.",
        });
        return;
      }
      /* For non-critical features keep fail-open to avoid disrupting other flows */
      next();
    }
  };
}
