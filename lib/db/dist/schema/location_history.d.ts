import { z } from "zod/v4";
export declare const locationHistoryTable: import("drizzle-orm/pg-core").PgTableWithColumns<{
    name: "location_history";
    schema: undefined;
    columns: {
        id: import("drizzle-orm/pg-core").PgColumn<{
            name: "id";
            tableName: "location_history";
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
        userId: import("drizzle-orm/pg-core").PgColumn<{
            name: "user_id";
            tableName: "location_history";
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
        rideId: import("drizzle-orm/pg-core").PgColumn<{
            name: "ride_id";
            tableName: "location_history";
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
        orderId: import("drizzle-orm/pg-core").PgColumn<{
            name: "order_id";
            tableName: "location_history";
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
        coords: import("drizzle-orm/pg-core").PgColumn<{
            name: "coords";
            tableName: "location_history";
            dataType: "json";
            columnType: "PgJsonb";
            data: {
                lat: number;
                lng: number;
            };
            driverParam: unknown;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {
            $type: {
                lat: number;
                lng: number;
            };
        }>;
        heading: import("drizzle-orm/pg-core").PgColumn<{
            name: "heading";
            tableName: "location_history";
            dataType: "string";
            columnType: "PgNumeric";
            data: string;
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
        speed: import("drizzle-orm/pg-core").PgColumn<{
            name: "speed";
            tableName: "location_history";
            dataType: "string";
            columnType: "PgNumeric";
            data: string;
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
        createdAt: import("drizzle-orm/pg-core").PgColumn<{
            name: "created_at";
            tableName: "location_history";
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
export declare const insertLocationHistorySchema: z.ZodObject<{
    id: z.ZodOptional<z.ZodInt>;
    userId: z.ZodString;
    rideId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    orderId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    coords: z.ZodType<{
        lat: number;
        lng: number;
    }, {
        lat: number;
        lng: number;
    }, z.core.$ZodTypeInternals<{
        lat: number;
        lng: number;
    }, {
        lat: number;
        lng: number;
    }>>;
    heading: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    speed: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, {
    out: {};
    in: {};
}>;
export type InsertLocationHistory = z.infer<typeof insertLocationHistorySchema>;
export type LocationHistory = typeof locationHistoryTable.$inferSelect;
//# sourceMappingURL=location_history.d.ts.map