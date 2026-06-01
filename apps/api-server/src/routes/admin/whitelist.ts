/**
 * Admin routes for OTP Whitelist management.
 * Mounted at /api/admin/whitelist
 */
import { db } from "@workspace/db";
import { whitelistUsersTable } from "@workspace/db/schema";
import { desc, eq } from "drizzle-orm";
import { Router } from "express";
import { generateId } from "../../lib/id.js";
import { logger } from "../../lib/logger.js";
import { sendError, sendNotFound, sendSuccess } from "../../lib/response.js";
import { requirePermission } from "../../middleware/require-permission.js";
import { addAuditEntry, adminAuth, getClientIp, type AdminRequest } from "../admin-shared.js";

const router = Router();
router.use(adminAuth);

/* GET /api/admin/whitelist */
router.get("/", requirePermission("system.whitelist.view"), async (_req, res) => {
  try {
    const rows = await db
      .select()
      .from(whitelistUsersTable)
      .orderBy(desc(whitelistUsersTable.createdAt));
    res.json({ entries: rows });
  } catch (err) {
    logger.error({ err }, "[whitelist] list failed");
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

/* POST /api/admin/whitelist */
router.post("/", requirePermission("system.whitelist.manage"), async (req, res) => {
  const adminReq = req as AdminRequest;
  try {
    const { identifier, label, bypassCode, expiresAt } = req.body;

    if (!identifier) {
      sendError(res, "identifier (phone or email) is required");
      return;
    }
    if (!bypassCode) {
      sendError(res, "bypassCode is required");
      return;
    }

    const isProduction = process.env.NODE_ENV === "production";
    const insecureCodes = ["000000", "123456"];
    if (isProduction && insecureCodes.includes(bypassCode)) {
      sendError(res, `bypassCode '${bypassCode}' is not allowed in production — use a unique code`);
      return;
    }

    if (expiresAt) {
      const expDate = new Date(expiresAt);
      if (isNaN(expDate.getTime()) || expDate <= new Date()) {
        sendError(res, "expiresAt must be a valid future date");
        return;
      }
    }

    const id = generateId();
    try {
      const normalizedIdentifier = String(identifier).toLowerCase().trim();
      const [row] = await db
        .insert(whitelistUsersTable)
        .values({
          id,
          identifier: normalizedIdentifier,
          label: label || null,
          bypassCode,
          isActive: true,
          expiresAt: expiresAt ? new Date(expiresAt) : null,
        })
        .returning();

      void addAuditEntry({
        action: "whitelist_entry_created",
        ip: getClientIp(req),
        adminId: adminReq.adminId,
        adminName: adminReq.adminName,
        details: `Admin added '${normalizedIdentifier}' to OTP bypass whitelist${label ? ` (label: ${label})` : ""}`,
        result: "success",
      });

      sendSuccess(res, { entry: row });
    } catch (err: unknown) {
      if (err instanceof Error && err.message?.includes("unique")) {
        sendError(res, "This identifier is already in the whitelist");
        return;
      }
      throw err;
    }
  } catch (err) {
    logger.error({ err }, "[whitelist] create failed");
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

/* PATCH /api/admin/whitelist/:id */
router.patch("/:id", requirePermission("system.whitelist.manage"), async (req, res) => {
  const adminReq = req as AdminRequest;
  try {
    const { id } = req.params as Record<string, string>;
    const { label, bypassCode, isActive, expiresAt } = req.body;

    const [existing] = await db
      .select({ id: whitelistUsersTable.id, identifier: whitelistUsersTable.identifier })
      .from(whitelistUsersTable)
      .where(eq(whitelistUsersTable.id, id!))
      .limit(1);
    if (!existing) {
      sendNotFound(res, "Whitelist entry");
      return;
    }

    if (expiresAt !== undefined && expiresAt !== null) {
      const expDate = new Date(expiresAt);
      if (isNaN(expDate.getTime()) || expDate <= new Date()) {
        sendError(res, "expiresAt must be a valid future date");
        return;
      }
    }

    const updates: Partial<typeof whitelistUsersTable.$inferInsert> = { updatedAt: new Date() };
    if (label !== undefined) updates.label = label;
    if (bypassCode !== undefined) updates.bypassCode = bypassCode;
    if (isActive !== undefined) updates.isActive = isActive;
    if (expiresAt !== undefined) updates.expiresAt = expiresAt ? new Date(expiresAt) : null;

    const [updated] = await db
      .update(whitelistUsersTable)
      .set(updates)
      .where(eq(whitelistUsersTable.id, id!))
      .returning();

    void addAuditEntry({
      action: "whitelist_entry_updated",
      ip: getClientIp(req),
      adminId: adminReq.adminId,
      adminName: adminReq.adminName,
      details: `Admin updated whitelist entry for '${existing.identifier}' (id: ${id})`,
      result: "success",
    });

    sendSuccess(res, { entry: updated });
  } catch (err) {
    logger.error({ err }, "[whitelist] update failed");
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

/* DELETE /api/admin/whitelist/:id */
router.delete("/:id", requirePermission("system.whitelist.manage"), async (req, res) => {
  const adminReq = req as AdminRequest;
  try {
    const { id } = req.params as Record<string, string>;

    const [existing] = await db
      .select({ id: whitelistUsersTable.id, identifier: whitelistUsersTable.identifier })
      .from(whitelistUsersTable)
      .where(eq(whitelistUsersTable.id, id!))
      .limit(1);
    if (!existing) {
      sendNotFound(res, "Whitelist entry");
      return;
    }

    await db.delete(whitelistUsersTable).where(eq(whitelistUsersTable.id, id!));

    void addAuditEntry({
      action: "whitelist_entry_deleted",
      ip: getClientIp(req),
      adminId: adminReq.adminId,
      adminName: adminReq.adminName,
      details: `Admin removed '${existing.identifier}' from OTP bypass whitelist`,
      result: "success",
    });

    sendSuccess(res, { deleted: true });
  } catch (err) {
    logger.error({ err }, "[whitelist] delete failed");
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

export default router;
