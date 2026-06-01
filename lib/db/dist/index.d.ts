import * as schema from "./schema";
/**
 * Shared PostgreSQL connection pool.
 *
 * Tuning rationale:
 *  - max 20: safe ceiling for a single-process server; above 25 risks hitting
 *    Replit/managed-PG per-role connection limits.
 *  - min 2: keeps two warm connections alive so the first cold request after
 *    a period of inactivity never blocks on TCP + TLS + auth handshake.
 *  - idleTimeoutMillis 30 s: reclaim idle connections quickly so the DB-side
 *    max_connections headroom stays available for other processes.
 *  - connectionTimeoutMillis 5 s: fail fast rather than queue indefinitely;
 *    the caller's request can return a 503 immediately.
 *  - statement_timeout 10 s: hard server-side kill for runaway queries that
 *    would otherwise hold a connection and a transaction lock forever.
 */
export declare const pool: import("pg").Pool;
export declare const db: import("drizzle-orm/node-postgres").NodePgDatabase<typeof schema> & {
    $client: import("pg").Pool;
};
export * from "./schema";
//# sourceMappingURL=index.d.ts.map