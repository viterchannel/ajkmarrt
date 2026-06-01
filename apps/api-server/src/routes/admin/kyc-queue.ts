import { db } from "@workspace/db";
import { kycStatusHistoryTable, riderProfilesTable, usersTable } from "@workspace/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { Router } from "express";
import { logger } from "../../lib/logger.js";
import {
  sendError,
  sendNotFound,
  sendSuccess,
  sendValidationError,
} from "../../lib/response.js";
import { awardVerificationBonus } from "../../services/verificationBonus.js";
import { getClientIp } from "../../middleware/security.js";
import { AuditService } from "../../services/admin-audit.service.js";
import { sendPushToUser } from "../../lib/webpush.js";
import { generateId } from "../../lib/id.js";
import { getIO } from "../../lib/socketio.js";

const router = Router();

router.get("/kyc/pending", async (_req, res) => {
  try {
    const pending = await db
      .select({
        id: usersTable.id,
        name: usersTable.name,
        phone: usersTable.phone,
        email: usersTable.email,
        roles: usersTable.roles,
        cnic: usersTable.idCardNumber,
        documentsSubmitted: usersTable.documentsSubmitted,
        documentsApproved: usersTable.documentsApproved,
        kycStatus: usersTable.kycStatus,
        createdAt: usersTable.createdAt,
        updatedAt: usersTable.updatedAt,
        regDocUrl: riderProfilesTable.regDocUrl,
      })
      .from(usersTable)
      .leftJoin(riderProfilesTable, eq(usersTable.id, riderProfilesTable.userId))
      .where(
        and(eq(usersTable.documentsSubmitted, true), eq(usersTable.documentsApproved, false), isNull(usersTable.deletedAt))
      );
    sendSuccess(res, { users: pending, total: pending.length });
  } catch (err) {
    logger.error({ err }, "[admin/kyc-queue] GET pending failed");
    sendError(res, "Failed to fetch pending KYC queue", 500);
  }
});

router.post("/kyc/:userId/approve", async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId) {
      sendValidationError(res, "userId is required");
      return;
    }

    const [user] = await db
      .select({ id: usersTable.id, documentsSubmitted: usersTable.documentsSubmitted })
      .from(usersTable)
      .where(and(eq(usersTable.id, userId), isNull(usersTable.deletedAt)))
      .limit(1);

    if (!user) {
      sendNotFound(res, "User not found");
      return;
    }
    if (!user.documentsSubmitted) {
      sendValidationError(res, "User has not submitted documents");
      return;
    }

    await db.transaction(async (tx) => {
      await tx
        .update(usersTable)
        .set({
          documentsApproved: true,
          kycStatus: "approved",
          updatedAt: new Date(),
        })
        .where(eq(usersTable.id, userId));

      await tx
        .update(riderProfilesTable)
        .set({ kycStatus: "approved", updatedAt: new Date() })
        .where(eq(riderProfilesTable.userId, userId));
    });

    await awardVerificationBonus(userId, "documents");

    sendPushToUser(userId, {
      title: "KYC Approved",
      body: "Your documents have been verified. You can now accept orders.",
      icon: "checkmark-circle-outline",
      tag: "kyc",
    }).catch((err: unknown) => {
      logger.warn({ err }, "[admin/kyc-queue] push notification failed (approve)");
    });

    getIO()?.to(`user:${userId}`).emit("kyc_status_changed", {
      status: "approved",
      reason: null,
    });

    AuditService.log({
      action: "kyc_document_approve",
      adminId: req.adminId,
      ip: getClientIp(req),
      details: `KYC documents approved for user ${userId}`,
      result: "success",
      affectedUserId: userId,
    });

    sendSuccess(res, { approved: true, userId });
  } catch (err) {
    logger.error({ err }, "[admin/kyc-queue] approve failed");
    sendError(res, "Failed to approve KYC documents", 500);
  }
});

router.post("/kyc/:userId/reject", async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId) {
      sendValidationError(res, "userId is required");
      return;
    }

    const [user] = await db
      .select({ id: usersTable.id, documentsSubmitted: usersTable.documentsSubmitted })
      .from(usersTable)
      .where(and(eq(usersTable.id, userId), isNull(usersTable.deletedAt)))
      .limit(1);

    if (!user) {
      sendNotFound(res, "User not found");
      return;
    }

    const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : undefined;
    /* rejectedDocs: array of document keys that failed, e.g. ["cnic_front","cnic_back","license","vehicle_photo"] */
    const rejectedDocs: string[] = Array.isArray(req.body?.rejectedDocs)
      ? (req.body.rejectedDocs as unknown[]).filter((d): d is string => typeof d === "string")
      : [];

    await db.transaction(async (tx) => {
      await tx
        .update(usersTable)
        .set({
          documentsSubmitted: false,
          documentsApproved: false,
          kycStatus: "rejected",
          ...(reason ? { approvalNote: reason } : {}),
          kycRejectedDocs: rejectedDocs.length > 0 ? JSON.stringify(rejectedDocs) : null,
          updatedAt: new Date(),
        })
        .where(eq(usersTable.id, userId));

      await tx
        .update(riderProfilesTable)
        .set({
          kycStatus: "rejected",
          ...(reason ? { kycRejectionReason: reason } : {}),
          updatedAt: new Date(),
        })
        .where(eq(riderProfilesTable.userId, userId));
    });

    sendPushToUser(userId, {
      title: "KYC Rejected",
      body: reason
        ? `Please resubmit your documents. ${reason}`
        : "Please resubmit your documents.",
      icon: "close-circle-outline",
      tag: "kyc",
    }).catch((err: unknown) => {
      logger.warn({ err }, "[admin/kyc-queue] push notification failed (reject)");
    });

    getIO()?.to(`user:${userId}`).emit("kyc_status_changed", {
      status: "rejected",
      reason: reason ?? null,
      rejectedDocs: rejectedDocs.length > 0 ? rejectedDocs : null,
    });

    AuditService.log({
      action: "kyc_document_reject",
      adminId: req.adminId,
      ip: getClientIp(req),
      details: `KYC documents rejected for user ${userId}${reason ? ` — reason: ${reason}` : ""}${rejectedDocs.length ? ` — docs: ${rejectedDocs.join(", ")}` : ""}`,
      result: "success",
      affectedUserId: userId,
    });

    sendSuccess(res, { rejected: true, userId });
  } catch (err) {
    logger.error({ err }, "[admin/kyc-queue] reject failed");
    sendError(res, "Failed to reject KYC documents", 500);
  }
});

const REVOCABLE_STATUSES = ["pending", "rejected"] as const;
type RevocableStatus = (typeof REVOCABLE_STATUSES)[number];

router.post("/kyc/:userId/revoke", async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId) {
      sendValidationError(res, "userId is required");
      return;
    }

    const newStatus = req.body?.status as string | undefined;
    if (!newStatus || !REVOCABLE_STATUSES.includes(newStatus as RevocableStatus)) {
      sendValidationError(res, "status must be 'pending' or 'rejected'");
      return;
    }

    const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : undefined;
    if (!reason) {
      sendValidationError(res, "reason is required when revoking KYC");
      return;
    }

    const [user] = await db
      .select({
        id: usersTable.id,
        kycStatus: usersTable.kycStatus,
        name: usersTable.name,
      })
      .from(usersTable)
      .where(and(eq(usersTable.id, userId), isNull(usersTable.deletedAt)))
      .limit(1);

    if (!user) {
      sendNotFound(res, "User not found");
      return;
    }

    const fromStatus = user.kycStatus ?? "unknown";

    if (fromStatus !== "approved") {
      sendValidationError(res, `Cannot revoke KYC: current status is '${fromStatus}', must be 'approved'`);
      return;
    }

    await db.transaction(async (tx) => {
      await tx
        .update(usersTable)
        .set({
          kycStatus: newStatus,
          documentsApproved: false,
          updatedAt: new Date(),
        })
        .where(eq(usersTable.id, userId));

      await tx
        .update(riderProfilesTable)
        .set({
          kycStatus: newStatus,
          kycRejectionReason: reason,
          updatedAt: new Date(),
        })
        .where(eq(riderProfilesTable.userId, userId));

      await tx.insert(kycStatusHistoryTable).values({
        id: generateId(),
        userId,
        fromStatus,
        toStatus: newStatus,
        reason,
        changedByAdminId: req.adminId ?? null,
        ip: getClientIp(req),
      });
    });

    sendPushToUser(userId, {
      title: "KYC Status Updated",
      body: reason
        ? `Your KYC approval has been revoked. ${reason}`
        : "Your KYC approval has been revoked. Please contact support.",
      icon: "alert-circle-outline",
      tag: "kyc",
    }).catch((err: unknown) => {
      logger.warn({ err }, "[admin/kyc-queue] push notification failed (revoke)");
    });

    getIO()?.to(`user:${userId}`).emit("kyc_status_changed", {
      status: newStatus,
      reason: reason ?? null,
    });

    AuditService.log({
      action: "kyc_status_revoke",
      adminId: req.adminId,
      ip: getClientIp(req),
      details: `KYC revoked for user ${userId}: ${fromStatus} → ${newStatus}. Reason: ${reason}`,
      result: "success",
      affectedUserId: userId,
    });

    sendSuccess(res, { revoked: true, userId, fromStatus, toStatus: newStatus });
  } catch (err) {
    logger.error({ err }, "[admin/kyc-queue] revoke failed");
    sendError(res, "Failed to revoke KYC status", 500);
  }
});

router.get("/kyc/:userId/history", async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId) {
      sendValidationError(res, "userId is required");
      return;
    }

    const history = await db
      .select()
      .from(kycStatusHistoryTable)
      .where(eq(kycStatusHistoryTable.userId, userId))
      .orderBy(kycStatusHistoryTable.createdAt);

    sendSuccess(res, { history });
  } catch (err) {
    logger.error({ err }, "[admin/kyc-queue] history fetch failed");
    sendError(res, "Failed to fetch KYC status history", 500);
  }
});

export default router;
