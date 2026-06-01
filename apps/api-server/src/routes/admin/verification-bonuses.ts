import { db } from "@workspace/db";
import { verificationBonusesTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";
import { logger } from "../../lib/logger.js";
import {
  sendError,
  sendNotFound,
  sendSuccess,
  sendValidationError,
} from "../../lib/response.js";

const router = Router();

const patchBonusSchema = z.object({
  bonusAmount: z.number().min(0).optional(),
  bonusType: z.enum(["coins", "cash"]).optional(),
  isActive: z.boolean().optional(),
});

router.get("/verification-bonuses", async (_req, res) => {
  try {
    const bonuses = await db.select().from(verificationBonusesTable);
    sendSuccess(res, { bonuses });
  } catch (err) {
    logger.error({ err }, "[admin/verification-bonuses] GET failed");
    sendError(res, "Failed to fetch verification bonuses", 500);
  }
});

router.patch("/verification-bonuses/:id", async (req, res) => {
  try {
    const id = parseInt(req.params["id"] as string, 10);
    if (isNaN(id)) {
      sendValidationError(res, "Invalid bonus ID");
      return;
    }
    const parsed = patchBonusSchema.safeParse(req.body);
    if (!parsed.success) {
      sendValidationError(res, parsed.error.errors[0]?.message ?? "Invalid input");
      return;
    }
    const updates: Record<string, unknown> = {};
    if (parsed.data.bonusAmount !== undefined)
      updates.bonusAmount = parsed.data.bonusAmount.toFixed(2);
    if (parsed.data.bonusType !== undefined) updates.bonusType = parsed.data.bonusType;
    if (parsed.data.isActive !== undefined) updates.isActive = parsed.data.isActive;

    if (Object.keys(updates).length === 0) {
      sendValidationError(res, "No fields to update");
      return;
    }

    const [updated] = await db
      .update(verificationBonusesTable)
      .set(updates)
      .where(eq(verificationBonusesTable.id, id))
      .returning();
    if (!updated) {
      sendNotFound(res, "Verification bonus not found");
      return;
    }
    sendSuccess(res, { bonus: updated });
  } catch (err) {
    logger.error({ err }, "[admin/verification-bonuses] PATCH failed");
    sendError(res, "Failed to update verification bonus", 500);
  }
});

export default router;
