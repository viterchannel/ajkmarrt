import { check, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const otpAttemptsTable = pgTable(
  "otp_attempts",
  {
    key: text("key").primaryKey(),
    count: integer("count").notNull().default(0),
    firstAt: timestamp("first_at").notNull().defaultNow(),
    expiresAt: timestamp("expires_at").notNull(),
    identifierType: text("identifier_type").notNull().default("phone"),
    otpType: text("otp_type").notNull().default("login"),
  },
  (t) => [
    check("otp_attempts_identifier_type_check", sql`${t.identifierType} = ANY (ARRAY['phone'::text, 'email'::text])`),
    check("otp_attempts_otp_type_check", sql`${t.otpType} = ANY (ARRAY['login'::text, 'register'::text, 'reset'::text, 'merge'::text, 'trip'::text])`),
  ]
);

export type OtpAttempt = typeof otpAttemptsTable.$inferSelect;
