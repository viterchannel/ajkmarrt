import { index, integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const riderGateEventsTable = pgTable(
  "rider_gate_events",
  {
    id: serial("id").primaryKey(),
    riderId: text("rider_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    gate: integer("gate").notNull(),
    reason: text("reason").notNull(),
    metadata: text("metadata"),
    blockedAt: timestamp("blocked_at").notNull().defaultNow(),
  },
  (t) => [
    index("rider_gate_events_rider_id_idx").on(t.riderId),
    index("rider_gate_events_blocked_at_idx").on(t.blockedAt),
  ]
);

export type RiderGateEvent = typeof riderGateEventsTable.$inferSelect;
