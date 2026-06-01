import { z } from "zod/v4";
export declare const verificationBonusesTable: import("drizzle-orm/pg-core").PgTableWithColumns<{
    name: "verification_bonuses";
    schema: undefined;
    columns: {
        id: import("drizzle-orm/pg-core").PgColumn<{
            name: "id";
            tableName: "verification_bonuses";
            dataType: "number";
            columnType: "PgSerial";
            data: number;
            driverParam: number;
            notNull: true;
            hasDefault: true;
            isPrimaryKey: true;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {}>;
        verificationType: import("drizzle-orm/pg-core").PgColumn<{
            name: "verification_type";
            tableName: "verification_bonuses";
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
        bonusAmount: import("drizzle-orm/pg-core").PgColumn<{
            name: "bonus_amount";
            tableName: "verification_bonuses";
            dataType: "string";
            columnType: "PgNumeric";
            data: string;
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
        bonusType: import("drizzle-orm/pg-core").PgColumn<{
            name: "bonus_type";
            tableName: "verification_bonuses";
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
        isActive: import("drizzle-orm/pg-core").PgColumn<{
            name: "is_active";
            tableName: "verification_bonuses";
            dataType: "boolean";
            columnType: "PgBoolean";
            data: boolean;
            driverParam: boolean;
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
export declare const insertVerificationBonusSchema: z.ZodObject<{
    isActive: z.ZodOptional<z.ZodBoolean>;
    verificationType: z.ZodString;
    bonusAmount: z.ZodOptional<z.ZodString>;
    bonusType: z.ZodOptional<z.ZodString>;
}, {
    out: {};
    in: {};
}>;
export type InsertVerificationBonus = z.infer<typeof insertVerificationBonusSchema>;
export type VerificationBonus = typeof verificationBonusesTable.$inferSelect;
//# sourceMappingURL=verification-bonuses.d.ts.map