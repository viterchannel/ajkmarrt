import { boolean, integer, jsonb, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const featureRulesTable = pgTable("feature_rules", {
  id: serial("id").primaryKey(),
  role: text("role").notNull(),
  featureName: text("feature_name").notNull(),
  requiredVerifications: jsonb("required_verifications").notNull().default([]),
  maxDailyLimit: integer("max_daily_limit").notNull().default(0),
  fallbackMsg: text("fallback_msg"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertFeatureRuleSchema = createInsertSchema(featureRulesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertFeatureRule = z.infer<typeof insertFeatureRuleSchema>;
export type FeatureRule = typeof featureRulesTable.$inferSelect;
