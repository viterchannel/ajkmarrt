import { index, pgEnum, pgTable, text, timestamp, unique } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const userRoleEnum = pgEnum("user_role", [
  "customer",
  "rider",
  "vendor",
  "admin",
  "van_driver",
]);

export const userRolesTable = pgTable(
  "user_roles",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    role: userRoleEnum("role").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    unique("user_roles_user_id_role_unique").on(t.userId, t.role),
    index("user_roles_user_id_idx").on(t.userId),
    index("user_roles_role_idx").on(t.role),
  ]
);

export type UserRole = typeof userRolesTable.$inferSelect;
export type InsertUserRole = typeof userRolesTable.$inferInsert;
