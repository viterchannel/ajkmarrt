import { index, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const offlineActionsTable = pgTable(
  "offline_actions",
  {
    id: text("id").primaryKey(),
    riderId: text("rider_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    actionType: text("action_type").notNull(),
    payload: jsonb("payload").notNull().default({}),
    status: text("status").notNull().default("processed"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    processedAt: timestamp("processed_at"),
  },
  (t) => [
    index("offline_actions_rider_id_idx").on(t.riderId),
    index("offline_actions_created_at_idx").on(t.createdAt),
  ]
);
