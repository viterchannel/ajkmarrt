import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const themeConfigsTable = pgTable("theme_configs", {
  id: uuid("id").primaryKey().defaultRandom(),
  appRole: text("app_role").notNull(),
  selectedTheme: text("selected_theme").notNull(),
  colors: text("colors").notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  updatedBy: text("updated_by"),
});

export const insertThemeConfigSchema = createInsertSchema(themeConfigsTable).omit({
  id: true,
  updatedAt: true,
});

export type InsertThemeConfig = z.infer<typeof insertThemeConfigSchema>;
export type ThemeConfig = typeof themeConfigsTable.$inferSelect;
