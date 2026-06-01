export declare const usingFallback = false;
declare const databaseUrl: string;
export { databaseUrl };
export type PgSslOption = boolean | {
    rejectUnauthorized: boolean;
};
export interface PgPoolConnection {
    connectionString: string;
    ssl?: PgSslOption;
}
export declare function buildPgPoolConfig(rawUrl?: string): PgPoolConnection;
export declare const pgPoolConfig: PgPoolConnection;
//# sourceMappingURL=connection-url.d.ts.map