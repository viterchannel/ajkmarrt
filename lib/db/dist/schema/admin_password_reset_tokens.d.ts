import { z } from "zod/v4";
/**
 * Admin password reset tokens.
 *
 * One row per issued reset token. The raw token is **never** persisted;
 * we store only its sha256 hash in `tokenHash`. Tokens are single-use
 * (`usedAt` is stamped on consumption) and time-limited (`expiresAt`,
 * default 30 minutes from issuance).
 *
 * `requestedBy` distinguishes a self-service forgot-password request from
 * a super-admin "send reset link" action. `requesterAdminId` is set when
 * a super-admin issues the token on behalf of another admin (audit trail).
 */
export declare const adminPasswordResetTokensTable: import("drizzle-orm/pg-core").PgTableWithColumns<{
    name: "admin_password_reset_tokens";
    schema: undefined;
    columns: {
        id: import("drizzle-orm/pg-core").PgColumn<{
            name: "id";
            tableName: "admin_password_reset_tokens";
            dataType: "string";
            columnType: "PgText";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: true;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {}>;
        adminId: import("drizzle-orm/pg-core").PgColumn<{
            name: "admin_id";
            tableName: "admin_password_reset_tokens";
            dataType: "string";
            columnType: "PgText";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {}>;
        tokenHash: import("drizzle-orm/pg-core").PgColumn<{
            name: "token_hash";
            tableName: "admin_password_reset_tokens";
            dataType: "string";
            columnType: "PgText";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {}>;
        expiresAt: import("drizzle-orm/pg-core").PgColumn<{
            name: "expires_at";
            tableName: "admin_password_reset_tokens";
            dataType: "date";
            columnType: "PgTimestamp";
            data: Date;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {}>;
        usedAt: import("drizzle-orm/pg-core").PgColumn<{
            name: "used_at";
            tableName: "admin_password_reset_tokens";
            dataType: "date";
            columnType: "PgTimestamp";
            data: Date;
            driverParam: string;
            notNull: false;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {}>;
        requestedBy: import("drizzle-orm/pg-core").PgColumn<{
            name: "requested_by";
            tableName: "admin_password_reset_tokens";
            dataType: "string";
            columnType: "PgText";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: true;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {}>;
        requesterAdminId: import("drizzle-orm/pg-core").PgColumn<{
            name: "requester_admin_id";
            tableName: "admin_password_reset_tokens";
            dataType: "string";
            columnType: "PgText";
            data: string;
            driverParam: string;
            notNull: false;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {}>;
        requesterIp: import("drizzle-orm/pg-core").PgColumn<{
            name: "requester_ip";
            tableName: "admin_password_reset_tokens";
            dataType: "string";
            columnType: "PgVarchar";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: true;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {
            length: 45;
        }>;
        requesterUserAgent: import("drizzle-orm/pg-core").PgColumn<{
            name: "requester_user_agent";
            tableName: "admin_password_reset_tokens";
            dataType: "string";
            columnType: "PgText";
            data: string;
            driverParam: string;
            notNull: false;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {}>;
        createdAt: import("drizzle-orm/pg-core").PgColumn<{
            name: "created_at";
            tableName: "admin_password_reset_tokens";
            dataType: "date";
            columnType: "PgTimestamp";
            data: Date;
            driverParam: string;
            notNull: true;
            hasDefault: true;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {}>;
    };
    dialect: "pg";
}>;
export declare const insertAdminPasswordResetTokenSchema: z.ZodObject<{
    id: z.ZodString;
    expiresAt: z.ZodDate;
    tokenHash: z.ZodString;
    usedAt: z.ZodOptional<z.ZodNullable<z.ZodDate>>;
    adminId: z.ZodString;
    requestedBy: z.ZodOptional<z.ZodString>;
    requesterAdminId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    requesterIp: z.ZodOptional<z.ZodString>;
    requesterUserAgent: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, {
    out: {};
    in: {};
}>;
export type InsertAdminPasswordResetToken = z.infer<typeof insertAdminPasswordResetTokenSchema>;
export type AdminPasswordResetToken = typeof adminPasswordResetTokensTable.$inferSelect;
//# sourceMappingURL=admin_password_reset_tokens.d.ts.map