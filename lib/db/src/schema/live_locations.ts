import { decimal, index, pgTable, real, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const liveLocationsTable = pgTable(
  "live_locations",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    latitude: decimal("latitude", { precision: 10, scale: 6 }).notNull(),
    longitude: decimal("longitude", { precision: 10, scale: 6 }).notNull(),
    role: text("role").notNull(),
    action: text("action"),
    batteryLevel: real("battery_level"),
    lastSeen: timestamp("last_seen"),
    /** Timestamp of the most recent GPS ping received from this rider.
     *  Used by the ghost-rider cleanup job to detect riders who went offline
     *  without explicitly toggling offline (crash, background kill, etc).
     *  Any rider with lastPingAt older than 90 seconds is marked offline. */
    lastPingAt: timestamp("last_ping_at"),
    onlineSince: timestamp("online_since"),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("live_locations_role_idx").on(t.role),
    index("live_locations_lat_lng_idx").on(t.latitude, t.longitude),
    index("live_locations_role_updated_idx").on(t.role, t.updatedAt),
  ]
);

export const insertLiveLocationSchema = createInsertSchema(liveLocationsTable);
export type InsertLiveLocation = z.infer<typeof insertLiveLocationSchema>;
export type LiveLocation = typeof liveLocationsTable.$inferSelect;
