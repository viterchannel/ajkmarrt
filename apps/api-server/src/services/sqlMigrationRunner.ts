import { buildPgPoolConfig } from "@workspace/db/connection-url";
import fs from "fs";
import path from "path";
import { Pool } from "pg";
import { fileURLToPath } from "url";
import { logger } from "../lib/logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Applies all pending SQL migrations at startup.
 *
 * Two migration tracks are applied in order:
 *
 * 1. Drizzle-generated migrations (`lib/db/drizzle/`): tracked in
 *    `_drizzle_migrations`. These are the Drizzle schema source-of-truth files
 *    and contain all column additions and table creations (including the
 *    security tables `data_export_logs` and `sentry_known_issues`).
 *
 * 2. Custom SQL migrations (`lib/db/migrations/`): tracked in
 *    `_schema_migrations`. These handle FK rewrites, index additions, and any
 *    DDL that Drizzle cannot express (DO blocks, conditional logic, etc.).
 *
 * Both directories are sorted alphabetically so migrations are applied in
 * version order. Files already recorded in their tracking table are skipped.
 */
/**
 * Split a SQL file into individual statements, correctly handling:
 * - Dollar-quoted strings: DO $$ ... $$; — semicolons inside are NOT separators
 * - Single-quoted strings: 'hello; world' — semicolons inside are NOT separators
 * - Line comments: -- comment (stripped before splitting)
 *
 * Returns trimmed, non-empty statements ready to pass to pool.query().
 */
function splitSqlStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = "";
  let i = 0;

  while (i < sql.length) {
    // Line comment: skip to end of line
    if (sql[i] === "-" && sql[i + 1] === "-") {
      while (i < sql.length && sql[i] !== "\n") i++;
      continue;
    }

    // Dollar-quoted string: $tag$...$tag$ — consume everything until closing tag
    if (sql[i] === "$") {
      // Find the closing $ of the opening tag (e.g. "$$" or "$body$")
      const tagStart = i;
      i++; // skip first $
      while (i < sql.length && sql[i] !== "$") i++;
      i++; // skip closing $
      const tag = sql.slice(tagStart, i); // e.g. "$$" or "$body$"
      current += tag;

      // Now consume until we find the matching closing tag
      while (i < sql.length) {
        const closing = sql.indexOf(tag, i);
        if (closing === -1) {
          // Malformed — consume the rest
          current += sql.slice(i);
          i = sql.length;
          break;
        }
        current += sql.slice(i, closing + tag.length);
        i = closing + tag.length;
        break;
      }
      continue;
    }

    // Single-quoted string: skip until closing quote (handle '' escapes)
    if (sql[i] === "'") {
      current += sql[i++];
      while (i < sql.length) {
        if (sql[i] === "'" && sql[i + 1] === "'") {
          current += "''";
          i += 2;
        } else if (sql[i] === "'") {
          current += sql[i++];
          break;
        } else {
          current += sql[i++];
        }
      }
      continue;
    }

    // Statement terminator outside any quoted context
    if (sql[i] === ";") {
      const stmt = current.trim();
      if (stmt.length > 0) statements.push(stmt);
      current = "";
      i++;
      continue;
    }

    current += sql[i++];
  }

  // Catch any trailing statement without a final semicolon
  const trailing = current.trim();
  if (trailing.length > 0) statements.push(trailing);

  return statements;
}

export async function runSqlMigrations() {
  const rawUrl = process.env.DATABASE_URL;
  if (!rawUrl) {
    logger.error("[migrations] DATABASE_URL not set, skipping migrations");
    return;
  }
  /* Replit sometimes injects env vars with a leading "=" — strip it */
  const databaseUrl = rawUrl.startsWith("=") ? rawUrl.slice(1) : rawUrl;
  const pool = new Pool(buildPgPoolConfig(databaseUrl));
  try {
    await pool.query("SELECT 1");
    logger.info("[migrations] Database connection successful");

    // Tracking tables for both migration tracks
    await pool.query(`
      CREATE TABLE IF NOT EXISTS _drizzle_migrations (
        filename TEXT PRIMARY KEY,
        applied_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS _schema_migrations (
        filename TEXT PRIMARY KEY,
        applied_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    // ── Track 1: Drizzle-generated migrations ──────────────────────────────
    // These files are the Drizzle ORM schema source-of-truth. From this file
    // (artifacts/api-server/src/services) the drizzle dir is four or three
    // levels up depending on build layout (tsx dev vs dist). Both paths are
    // checked so the runner works in all environments.
    const drizzleCandidateDirs = [
      path.join(__dirname, "../../../../lib/db/drizzle"),
      path.join(__dirname, "../../../lib/db/drizzle"),
    ];
    const drizzleDir = drizzleCandidateDirs.find((dir) => fs.existsSync(dir));
    if (drizzleDir) {
      const files = fs
        .readdirSync(drizzleDir)
        .filter((f) => f.endsWith(".sql"))
        .sort();
      for (const file of files) {
        const { rows } = await pool.query("SELECT 1 FROM _drizzle_migrations WHERE filename = $1", [
          file,
        ]);
        if (rows.length) continue;
        const sql = fs.readFileSync(path.join(drizzleDir, file), "utf8");
        // Drizzle files use --> statement-breakpoint comments as separators.
        // Split on them so each DDL statement runs individually — this lets us
        // handle per-statement errors (e.g. already-exists, unsupported syntax).
        const statements = sql
          .split(/--> statement-breakpoint/)
          .map((s) => s.trim())
          .filter((s) => s.length > 0);
        let hadFatal = false;
        for (const stmt of statements) {
          // Rewrite "CREATE TYPE IF NOT EXISTS" → plain "CREATE TYPE" because
          // PostgreSQL doesn't support IF NOT EXISTS on TYPE in all versions.
          // We catch the duplicate_object error (42710) below instead.
          const normalised = stmt.replace(/CREATE TYPE IF NOT EXISTS/gi, "CREATE TYPE");
          try {
            await pool.query(normalised);
          } catch (err: any) {
            // PG error codes: 42P07 = duplicate_table, 42710 = duplicate_object,
            // 42701 = duplicate_column, 42P16 = invalid_table_definition (idx already exists)
            // 42703 = undefined_column (index on missing column — skip gracefully)
            const alreadyExists = ["42P07", "42710", "42701", "42P16", "42P11", "42703"].includes(
              err.code
            );
            if (alreadyExists) {
              logger.debug(
                { file, code: err.code, msg: err.message },
                "[migrations:drizzle] Skipping statement — objects already exist or column mismatch"
              );
            } else {
              logger.error(
                { file, stmt: normalised.slice(0, 120), err },
                "[migrations:drizzle] FAILED applying statement"
              );
              hadFatal = true;
              break;
            }
          }
        }
        if (hadFatal) {
          throw new Error(`Migration ${file} had a fatal statement error — see logs above`);
        }
        await pool.query("INSERT INTO _drizzle_migrations (filename) VALUES ($1)", [file]);
        logger.info({ file }, "[migrations:drizzle] Applied migration");
      }
    } else {
      logger.warn("[migrations:drizzle] Drizzle migrations directory not found, skipping");
    }

    // ── Track 2: Custom SQL migrations ────────────────────────────────────
    // FK rewrites, conditional DO blocks, index additions, and any DDL that
    // Drizzle cannot express directly.
    const customCandidateDirs = [
      path.join(__dirname, "../../../../lib/db/migrations"),
      path.join(__dirname, "../../../lib/db/migrations"),
    ];
    const migrationsDir = customCandidateDirs.find((dir) => fs.existsSync(dir));
    if (migrationsDir) {
      const files = fs
        .readdirSync(migrationsDir)
        .filter((f) => f.endsWith(".sql"))
        .sort();
      for (const file of files) {
        const { rows } = await pool.query("SELECT 1 FROM _schema_migrations WHERE filename = $1", [
          file,
        ]);
        if (rows.length) continue;
        const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");

        // Split the file into individual statements so each runs in its own
        // pool.query() call. This is required for statements that cannot run
        // inside a transaction block (e.g. CREATE/DROP INDEX CONCURRENTLY).
        //
        // IMPORTANT: We must NOT naively split on ";" because dollar-quoted
        // PL/pgSQL blocks (DO $$ ... $$;) contain semicolons inside them.
        // This parser tracks dollar-quote depth and only splits on ";" that
        // appear outside any dollar-quoted string.
        const statements = splitSqlStatements(sql);

        let hadFatal = false;
        for (const stmt of statements) {
          try {
            await pool.query(stmt);
          } catch (err: any) {
            // PG error codes: 42P07 = duplicate_table, 42710 = duplicate_object,
            // 42701 = duplicate_column, 42P16 = invalid_table_definition (idx already exists)
            const alreadyExists = ["42P07", "42710", "42701", "42P16", "42P11", "42703"].includes(
              err.code
            );
            if (alreadyExists) {
              logger.debug(
                { file, code: err.code, msg: err.message },
                "[migrations] Skipping statement — objects already exist or column mismatch"
              );
            } else {
              logger.error({ file, stmt: stmt.slice(0, 120), err }, "[migrations] FAILED applying statement");
              hadFatal = true;
              break;
            }
          }
        }
        if (hadFatal) {
          throw new Error(`Migration ${file} had a fatal statement error — see logs above`);
        }
        await pool.query("INSERT INTO _schema_migrations (filename) VALUES ($1)", [file]);
        logger.info({ file }, "[migrations] Applied migration");
      }
    }
  } finally {
    await pool.end();
  }
}
