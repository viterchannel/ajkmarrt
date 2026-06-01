import { db } from "@workspace/db";
import {
  riderProfilesTable,
  userRolesTable,
  usersTable,
} from "@workspace/db/schema";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { Router } from "express";
import { sendPushToUser } from "../../lib/webpush.js";
import { getIO } from "../../lib/socketio.js";
import { logger } from "../../lib/logger.js";
import {
  sendError,
  sendNotFound,
  sendSuccess,
  sendValidationError,
} from "../../lib/response.js";
import { requirePermission } from "../../middleware/require-permission.js";
import { AuditService } from "../../services/admin-audit.service.js";
import { getClientIp, getCachedSettings } from "../../middleware/security.js";
import type { AdminRequest } from "../admin-shared.js";
import { sendRiderApprovalEmail, sendRiderRejectionEmail } from "../../services/email.js";
import { sendApprovalSMS, sendRejectionSMS } from "../../services/sms.js";

const router = Router();

const PENDING_STATUSES = ["pending", "pending_review"] as const;

/**
 * GET /api/admin/riders/pending-approval
 * Returns all riders whose approvalStatus is 'pending' or 'pending_review',
 * with their profile docs. Both values are in active use across the platform.
 */
router.get(
  "/riders/pending-approval",
  requirePermission("riders.approve"),
  async (_req, res) => {
    try {
      const pendingRiders = await db
        .select({
          id: usersTable.id,
          name: usersTable.name,
          phone: usersTable.phone,
          email: usersTable.email,
          cnic: usersTable.idCardNumber,
          city: usersTable.city,
          area: usersTable.area,
          address: usersTable.address,
          approvalStatus: usersTable.approvalStatus,
          approvalNote: usersTable.approvalNote,
          createdAt: usersTable.createdAt,
          vehicleType: riderProfilesTable.vehicleType,
          vehiclePlate: riderProfilesTable.vehiclePlate,
          drivingLicense: riderProfilesTable.drivingLicense,
          vehiclePhoto: riderProfilesTable.vehiclePhoto,
          regDocUrl: riderProfilesTable.regDocUrl,
          documents: riderProfilesTable.documents,
        })
        .from(usersTable)
        .leftJoin(riderProfilesTable, eq(usersTable.id, riderProfilesTable.userId))
        .where(
          and(
            inArray(usersTable.approvalStatus, [...PENDING_STATUSES]),
            isNull(usersTable.deletedAt),
            sql`EXISTS (
              SELECT 1 FROM ${userRolesTable}
              WHERE ${userRolesTable.userId} = ${usersTable.id}
              AND ${userRolesTable.role} = 'rider'
            )`
          )
        )
        .orderBy(usersTable.createdAt);

      sendSuccess(res, {
        riders: pendingRiders.map((r) => ({
          ...r,
          createdAt: r.createdAt.toISOString(),
        })),
        total: pendingRiders.length,
      });
    } catch (err) {
      logger.error({ err }, "[admin/rider-approval] GET pending-approval failed");
      sendError(res, "Failed to fetch pending riders", 500);
    }
  }
);

/**
 * PATCH /api/admin/riders/:id/approval
 * Body: { status: "approved" | "rejected", reason?: string }
 * Approves or rejects a rider and notifies them via push + socket.
 */
router.patch(
  "/riders/:id/approval",
  requirePermission("riders.approve"),
  async (req, res) => {
    const adminReq = req as AdminRequest;
    const riderId = req.params["id"] as string;
    const { status, reason } = req.body as { status: string; reason?: string };

    if (!riderId?.trim()) {
      sendValidationError(res, "Rider ID is required");
      return;
    }
    if (!status || !["approved", "rejected"].includes(status)) {
      sendValidationError(res, "status must be 'approved' or 'rejected'");
      return;
    }
    if (status === "rejected" && !reason?.trim()) {
      sendValidationError(res, "reason is required when rejecting a rider");
      return;
    }
    if (reason && reason.length > 500) {
      sendValidationError(res, "Reason must be 500 characters or fewer");
      return;
    }

    try {
      const [rider] = await db
        .select({
          id: usersTable.id,
          name: usersTable.name,
          email: usersTable.email,
          phone: usersTable.phone,
          approvalStatus: usersTable.approvalStatus,
        })
        .from(usersTable)
        .where(
          and(
            eq(usersTable.id, riderId),
            isNull(usersTable.deletedAt),
            sql`EXISTS (
              SELECT 1 FROM ${userRolesTable}
              WHERE ${userRolesTable.userId} = ${usersTable.id}
              AND ${userRolesTable.role} = 'rider'
            )`
          )
        )
        .limit(1);

      if (!rider) {
        sendNotFound(res, "Rider not found");
        return;
      }

      /* Guard: only act on pending riders — enforces valid state transitions
         and gives idempotent 200 for repeated same-status calls. */
      if (!(PENDING_STATUSES as readonly string[]).includes(rider.approvalStatus)) {
        if (rider.approvalStatus === status) {
          sendSuccess(res, { updated: false, riderId, status, note: "Rider is already in this state" });
        } else {
          res.status(409).json({
            success: false,
            error: `Cannot change status: rider is already '${rider.approvalStatus}'.`,
            code: "INVALID_STATUS_TRANSITION",
          });
        }
        return;
      }

      const now = new Date();

      if (status === "approved") {
        /* Atomic lock: include pending-status in WHERE so a concurrent second
           approval finds 0 rows → 409, preventing silent double-processing. */
        const [approvedRow] = await db
          .update(usersTable)
          .set({
            approvalStatus: "approved",
            isActive: true,
            approvalNote: reason?.trim() || null,
            updatedAt: now,
          })
          .where(
            and(
              eq(usersTable.id, riderId),
              inArray(usersTable.approvalStatus, [...PENDING_STATUSES])
            )
          )
          .returning({ id: usersTable.id });

        if (!approvedRow) {
          res.status(409).json({
            success: false,
            error: "Rider was already processed by another admin. Please refresh the list.",
            code: "CONCURRENT_UPDATE",
          });
          return;
        }

        sendPushToUser(riderId, {
          title: "Application Approved! 🎉",
          body: "Your rider application has been approved. You can now start accepting rides.",
          icon: "checkmark-circle-outline",
          tag: "rider_approval",
        }).catch((err: unknown) => {
          logger.warn({ err }, "[admin/rider-approval] push notification failed (approve)");
        });

        getIO()
          ?.to(`user:${riderId}`)
          .emit("rider:approval_update", {
            status: "approved",
            message: "Your application has been approved. Welcome aboard!",
          });

        getCachedSettings().then((settings) => {
          if (rider.email) {
            sendRiderApprovalEmail(rider.email, rider.name, settings).catch((err: unknown) => {
              logger.warn({ err }, "[admin/rider-approval] approval email failed");
            });
          }
          if (rider.phone) {
            sendApprovalSMS(rider.phone, rider.name, "rider", settings).catch((err: unknown) => {
              logger.warn({ err }, "[admin/rider-approval] approval SMS failed");
            });
          }
        }).catch((err: unknown) => {
          logger.warn({ err }, "[admin/rider-approval] failed to load settings for approval notifications");
        });

        AuditService.log({
          action: "rider_approve",
          adminId: adminReq.adminId,
          ip: getClientIp(req),
          details: `Rider application approved for user ${riderId}${reason ? ` — note: ${reason}` : ""}`,
          result: "success",
          affectedUserId: riderId,
        });
      } else {
        const trimmedReason = reason!.trim();
        /* Atomic lock: include pending-status in WHERE so a concurrent second
           rejection finds 0 rows → 409, preventing silent double-processing. */
        const [rejectedRow] = await db
          .update(usersTable)
          .set({
            approvalStatus: "rejected",
            isActive: false,
            approvalNote: trimmedReason,
            updatedAt: now,
          })
          .where(
            and(
              eq(usersTable.id, riderId),
              inArray(usersTable.approvalStatus, [...PENDING_STATUSES])
            )
          )
          .returning({ id: usersTable.id });

        if (!rejectedRow) {
          res.status(409).json({
            success: false,
            error: "Rider was already processed by another admin. Please refresh the list.",
            code: "CONCURRENT_UPDATE",
          });
          return;
        }

        sendPushToUser(riderId, {
          title: "Application Update",
          body: `Your rider application requires attention. ${trimmedReason}`,
          icon: "close-circle-outline",
          tag: "rider_approval",
        }).catch((err: unknown) => {
          logger.warn({ err }, "[admin/rider-approval] push notification failed (reject)");
        });

        getIO()
          ?.to(`user:${riderId}`)
          .emit("rider:approval_update", {
            status: "rejected",
            reason: trimmedReason,
            message: `Your application was not approved. ${trimmedReason}`,
          });

        getCachedSettings().then((settings) => {
          if (rider.email) {
            sendRiderRejectionEmail(rider.email, rider.name, trimmedReason, settings).catch((err: unknown) => {
              logger.warn({ err }, "[admin/rider-approval] rejection email failed");
            });
          }
          if (rider.phone) {
            sendRejectionSMS(rider.phone, rider.name, "rider", trimmedReason, settings).catch((err: unknown) => {
              logger.warn({ err }, "[admin/rider-approval] rejection SMS failed");
            });
          }
        }).catch((err: unknown) => {
          logger.warn({ err }, "[admin/rider-approval] failed to load settings for rejection notifications");
        });

        AuditService.log({
          action: "rider_reject",
          adminId: adminReq.adminId,
          ip: getClientIp(req),
          details: `Rider application rejected for user ${riderId} — reason: ${trimmedReason}`,
          result: "success",
          affectedUserId: riderId,
        });
      }

      sendSuccess(res, { updated: true, riderId, status });
    } catch (err) {
      logger.error({ err }, "[admin/rider-approval] PATCH approval failed");
      sendError(res, "Failed to update rider approval status", 500);
    }
  }
);

/**
 * POST /api/admin/riders/bulk-approve
 * Approves multiple pending rider applications in one atomic UPDATE.
 * Riders not currently in PENDING_STATUSES are silently skipped and
 * reported in the `skipped` count so the caller knows the difference.
 */
router.post(
  "/riders/bulk-approve",
  requirePermission("riders.approve"),
  async (req, res) => {
    const adminReq = req as AdminRequest;
    const { riderIds } = req.body as { riderIds: unknown };

    if (!Array.isArray(riderIds) || riderIds.length === 0) {
      sendValidationError(res, "riderIds must be a non-empty array");
      return;
    }
    if (riderIds.length > 50) {
      sendValidationError(res, "Cannot bulk-approve more than 50 riders at once");
      return;
    }
    const ids = (riderIds as unknown[]).filter(
      (id): id is string => typeof id === "string" && id.trim().length > 0
    );
    if (ids.length === 0) {
      sendValidationError(res, "riderIds must contain valid rider ID strings");
      return;
    }

    try {
      const now = new Date();
      /* Single atomic UPDATE — only rows still in a pending status are
         touched, so concurrent single-approvals cannot cause double-processing. */
      const approved = await db
        .update(usersTable)
        .set({ approvalStatus: "approved", isActive: true, updatedAt: now })
        .where(
          and(
            inArray(usersTable.id, ids),
            inArray(usersTable.approvalStatus, [...PENDING_STATUSES]),
            isNull(usersTable.deletedAt)
          )
        )
        .returning({
          id: usersTable.id,
          name: usersTable.name,
          email: usersTable.email,
          phone: usersTable.phone,
        });

      const approvedIds = approved.map((r) => r.id);
      const skipped = ids.length - approvedIds.length;

      /* Fire-and-forget: push, socket, email, SMS for every approved rider. */
      getCachedSettings()
        .then((settings) => {
          for (const rider of approved) {
            sendPushToUser(rider.id, {
              title: "Application Approved! 🎉",
              body: "Your rider application has been approved. You can now start accepting rides.",
              icon: "checkmark-circle-outline",
              tag: "rider_approval",
            }).catch((err: unknown) => {
              logger.warn({ err, riderId: rider.id }, "[admin/bulk-approve] push failed");
            });

            getIO()?.to(`user:${rider.id}`).emit("rider:approval_update", {
              status: "approved",
              message: "Your application has been approved. Welcome aboard!",
            });

            if (rider.email) {
              sendRiderApprovalEmail(rider.email, rider.name, settings).catch((err: unknown) => {
                logger.warn({ err, riderId: rider.id }, "[admin/bulk-approve] email failed");
              });
            }
            if (rider.phone) {
              sendApprovalSMS(rider.phone, rider.name, "rider", settings).catch((err: unknown) => {
                logger.warn({ err, riderId: rider.id }, "[admin/bulk-approve] SMS failed");
              });
            }
          }
        })
        .catch((err: unknown) => {
          logger.warn({ err }, "[admin/bulk-approve] failed to load settings for notifications");
        });

      AuditService.log({
        action: "rider_bulk_approve",
        adminId: adminReq.adminId,
        ip: getClientIp(req),
        details: `Bulk approved ${approvedIds.length} rider(s) (${skipped} skipped already-processed) — IDs: ${approvedIds.join(", ")}`,
        result: "success",
      });

      sendSuccess(res, { approved: approvedIds.length, skipped, approvedIds });
    } catch (err) {
      logger.error({ err }, "[admin/rider-approval] POST bulk-approve failed");
      sendError(res, "Failed to bulk approve riders", 500);
    }
  }
);

export default router;
