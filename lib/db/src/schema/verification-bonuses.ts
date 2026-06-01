import { boolean, decimal, pgTable, serial, text } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const verificationBonusesTable = pgTable("verification_bonuses", {
  id: serial("id").primaryKey(),
  verificationType: text("verification_type").notNull(),
  bonusAmount: decimal("bonus_amount", { precision: 10, scale: 2 }).notNull().default("0"),
  bonusType: text("bonus_type").notNull().default("coins"),
  isActive: boolean("is_active").notNull().default(true),
});

export const insertVerificationBonusSchema = createInsertSchema(verificationBonusesTable).omit({
  id: true,
});
export type InsertVerificationBonus = z.infer<typeof insertVerificationBonusSchema>;
export type VerificationBonus = typeof verificationBonusesTable.$inferSelect;
