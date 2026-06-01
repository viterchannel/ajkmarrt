import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const kycStatusHistoryTable = pgTable("kyc_status_history", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  fromStatus: text("from_status").notNull(),
  toStatus: text("to_status").notNull(),
  reason: text("reason"),
  changedByAdminId: text("changed_by_admin_id"),
  changedByAdminName: text("changed_by_admin_name"),
  ip: text("ip"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type KycStatusHistory = typeof kycStatusHistoryTable.$inferSelect;
