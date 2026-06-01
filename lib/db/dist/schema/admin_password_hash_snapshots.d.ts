import { z } from "zod/v4";
/**
 * Admin password hash snapshots.
 *
 * One row per admin. Stores the sha256 of the bcrypt secret that the
 * application most recently set/observed via a *known* in-app code path
 * (super-admin seed, completed reset link, authenticated change-password,
 * or first observation at startup). Used by the startup watchdog
 * (`detectAndNotifyOutOfBandPasswordResets`) to detect the case where
 * `admin_accounts.secret` has been mutated *outside* the app — typically
 * by an operator running an SQL UPDATE for account recovery, or by a
 * compromised database operator silently rewriting an admin's hash.
 *
 * On detection the affected admin is emailed and an audit-log entry is
 * recorded so the change appears alongside the existing reset events.
 *
 * Storing only the sha256 of the bcrypt hash (rather than the bcrypt
 * hash itself) keeps the secret distance one extra hop deep and makes
 * the table cheap to scan at startup.
 */
export declare const adminPasswordHashSnapshotsTable: import("drizzle-orm/pg-core").PgTableWithColumns<{
    name: "admin_password_hash_snapshots";
    schema: undefined;
    columns: {
        adminId: import("drizzle-orm/pg-core").PgColumn<{
            name: "admin_id";
            tableName: "admin_password_hash_snapshots";
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
        secretHash: import("drizzle-orm/pg-core").PgColumn<{
            name: "secret_hash";
            tableName: "admin_password_hash_snapshots";
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
        passwordChangedAt: import("drizzle-orm/pg-core").PgColumn<{
            name: "password_changed_at";
            tableName: "admin_password_hash_snapshots";
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
        lastVerifiedAt: import("drizzle-orm/pg-core").PgColumn<{
            name: "last_verified_at";
            tableName: "admin_password_hash_snapshots";
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
        updatedAt: import("drizzle-orm/pg-core").PgColumn<{
            name: "updated_at";
            tableName: "admin_password_hash_snapshots";
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
export declare const insertAdminPasswordHashSnapshotSchema: import("drizzle-zod").BuildSchema<"insert", {
    adminId: import("drizzle-orm/pg-core").PgColumn<{
        name: "admin_id";
        tableName: "admin_password_hash_snapshots";
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
    secretHash: import("drizzle-orm/pg-core").PgColumn<{
        name: "secret_hash";
        tableName: "admin_password_hash_snapshots";
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
    passwordChangedAt: import("drizzle-orm/pg-core").PgColumn<{
        name: "password_changed_at";
        tableName: "admin_password_hash_snapshots";
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
    lastVerifiedAt: import("drizzle-orm/pg-core").PgColumn<{
        name: "last_verified_at";
        tableName: "admin_password_hash_snapshots";
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
    updatedAt: import("drizzle-orm/pg-core").PgColumn<{
        name: "updated_at";
        tableName: "admin_password_hash_snapshots";
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
}, undefined, undefined>;
export type InsertAdminPasswordHashSnapshot = z.infer<typeof insertAdminPasswordHashSnapshotSchema>;
export type AdminPasswordHashSnapshot = typeof adminPasswordHashSnapshotsTable.$inferSelect;
//# sourceMappingURL=admin_password_hash_snapshots.d.ts.map