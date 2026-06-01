import { date, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const featureUsageLogTable = pgTable("feature_usage_log", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  featureName: text("feature_name").notNull(),
  role: text("role").notNull(),
  usedAt: timestamp("used_at").notNull().defaultNow(),
  date: date("date").notNull(),
});
