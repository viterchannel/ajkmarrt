/**
 * terms_versions — published versions of every legal / consent policy
 * (terms, privacy, marketing, …). The admin "Consent Log" surface POSTs
 * to this table to force a re-acceptance flow on the next mobile launch.
 * Primary key is `(policy, version)` so the POST endpoint can be made
 * idempotent — repeated submissions of the same version no-op.
 */
export declare const termsVersionsTable: import("drizzle-orm/pg-core").PgTableWithColumns<{
    name: "terms_versions";
    schema: undefined;
    columns: {
        policy: import("drizzle-orm/pg-core").PgColumn<{
            name: "policy";
            tableName: "terms_versions";
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
        version: import("drizzle-orm/pg-core").PgColumn<{
            name: "version";
            tableName: "terms_versions";
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
        effectiveAt: import("drizzle-orm/pg-core").PgColumn<{
            name: "effective_at";
            tableName: "terms_versions";
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
        bodyMarkdown: import("drizzle-orm/pg-core").PgColumn<{
            name: "body_markdown";
            tableName: "terms_versions";
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
        changelog: import("drizzle-orm/pg-core").PgColumn<{
            name: "changelog";
            tableName: "terms_versions";
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
            tableName: "terms_versions";
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
export type TermsVersion = typeof termsVersionsTable.$inferSelect;
//# sourceMappingURL=terms_versions.d.ts.map