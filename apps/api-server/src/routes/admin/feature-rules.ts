import { db } from "@workspace/db";
import { featureRulesTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";
import { generateId } from "../../lib/id.js";
import { logger } from "../../lib/logger.js";
import {
  sendCreated,
  sendError,
  sendNotFound,
  sendSuccess,
  sendValidationError,
} from "../../lib/response.js";

const router = Router();

const featureRuleSchema = z.object({
  role: z.enum(["customer", "rider", "vendor"]),
  featureName: z.string().min(1).max(100),
  requiredVerifications: z
    .array(z.enum(["phone_verified", "email_verified", "documents_approved"]))
    .default([]),
  maxDailyLimit: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
});

const patchFeatureRuleSchema = featureRuleSchema.partial();

router.get("/feature-rules", async (_req, res) => {
  try {
    const rules = await db.select().from(featureRulesTable);
    sendSuccess(res, { rules });
  } catch (err) {
    logger.error({ err }, "[admin/feature-rules] GET failed");
    sendError(res, "Failed to fetch feature rules", 500);
  }
});

router.post("/feature-rules", async (req, res) => {
  try {
    const parsed = featureRuleSchema.safeParse(req.body);
    if (!parsed.success) {
      sendValidationError(res, parsed.error.errors[0]?.message ?? "Invalid input");
      return;
    }
    const { role, featureName, requiredVerifications, maxDailyLimit, isActive } = parsed.data;
    const [rule] = await db
      .insert(featureRulesTable)
      .values({
        role,
        featureName,
        requiredVerifications,
        maxDailyLimit,
        isActive,
      })
      .returning();
    sendCreated(res, { rule });
  } catch (err) {
    logger.error({ err }, "[admin/feature-rules] POST failed");
    sendError(res, "Failed to create feature rule", 500);
  }
});

router.patch("/feature-rules/:id", async (req, res) => {
  try {
    const id = parseInt(req.params["id"] as string, 10);
    if (isNaN(id)) {
      sendValidationError(res, "Invalid rule ID");
      return;
    }
    const parsed = patchFeatureRuleSchema.safeParse(req.body);
    if (!parsed.success) {
      sendValidationError(res, parsed.error.errors[0]?.message ?? "Invalid input");
      return;
    }
    const updates: Record<string, unknown> = { ...parsed.data, updatedAt: new Date() };
    const [updated] = await db
      .update(featureRulesTable)
      .set(updates)
      .where(eq(featureRulesTable.id, id))
      .returning();
    if (!updated) {
      sendNotFound(res, "Feature rule not found");
      return;
    }
    sendSuccess(res, { rule: updated });
  } catch (err) {
    logger.error({ err }, "[admin/feature-rules] PATCH failed");
    sendError(res, "Failed to update feature rule", 500);
  }
});

router.delete("/feature-rules/:id", async (req, res) => {
  try {
    const id = parseInt(req.params["id"] as string, 10);
    if (isNaN(id)) {
      sendValidationError(res, "Invalid rule ID");
      return;
    }
    const [deleted] = await db
      .delete(featureRulesTable)
      .where(eq(featureRulesTable.id, id))
      .returning({ id: featureRulesTable.id });
    if (!deleted) {
      sendNotFound(res, "Feature rule not found");
      return;
    }
    sendSuccess(res, { deleted: true });
  } catch (err) {
    logger.error({ err }, "[admin/feature-rules] DELETE failed");
    sendError(res, "Failed to delete feature rule", 500);
  }
});

export default router;
