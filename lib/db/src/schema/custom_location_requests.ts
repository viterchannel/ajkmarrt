import {
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { serviceZonesTable } from "./service_zones";

export const customLocationRequestsTable = pgTable(
  "custom_location_requests",
  {
    id: serial("id").primaryKey(),
    type: text("type").notNull().$type<"city" | "area">(),
    rawValue: text("raw_value").notNull(),
    correctedValue: text("corrected_value").notNull(),
    linkedZoneId: integer("linked_zone_id").references(() => serviceZonesTable.id, {
      onDelete: "set null",
    }),
    status: text("status").notNull().default("pending").$type<"pending" | "approved" | "rejected">(),
    submittedBy: text("submitted_by"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("clr_status_idx").on(t.status),
    index("clr_type_idx").on(t.type),
    index("clr_created_at_idx").on(t.createdAt),
  ]
);

export const insertCustomLocationRequestSchema = createInsertSchema(
  customLocationRequestsTable
).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCustomLocationRequest = z.infer<typeof insertCustomLocationRequestSchema>;
export type CustomLocationRequest = typeof customLocationRequestsTable.$inferSelect;
