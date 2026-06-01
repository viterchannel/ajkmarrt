import * as allSchema from "@workspace/db";
import { db } from "@workspace/db";
import { getTableColumns, getTableName, is, sql } from "drizzle-orm";
import { PgTable } from "drizzle-orm/pg-core";

export interface ColumnDiff {
  table: string;
  missingInDb: string[]; // in schema, absent from DB
  extraInDb: string[]; // in DB, absent from schema (informational)
}

export interface SchemaDriftReport {
  ok: boolean;
  checkedAt: string;
  totalSchemaTables: number;
  totalDbTables: number;
  missingTables: string[]; // defined in schema, absent from DB
  extraTables: string[]; // exist in DB only (informational, not a crash risk)
  columnDrift: ColumnDiff[]; // tables present in both but with column gaps
}

export interface AutoFixResult {
  fixed: { table: string; column: string; sqlType: string; def: string }[];
  skipped: { table: string; column: string; reason: string }[];
  errors: { table: string; column: string; error: string }[];
}

/** Cached result from the most recent schema drift check (set at startup). */
let _lastDriftReport: SchemaDriftReport | null = null;

/**
 * Return the last drift report produced at startup, or null if the check
 * has not yet run. The health-dashboard endpoint reads this without
 * re-running the (expensive) DB introspection query.
 */
export function getLastDriftReport(): SchemaDriftReport | null {
  return _lastDriftReport;
}

/** Build map: tableName → Set<sqlColumnName> from all Drizzle schema exports. */
function buildSchemaMap(): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const exported of Object.values(allSchema)) {
    if (!is(exported as object, PgTable)) continue;
    const tableName = getTableName(exported as Parameters<typeof getTableName>[0]);
    const cols = getTableColumns(exported as Parameters<typeof getTableColumns>[0]);
    const colNames = new Set(Object.values(cols).map((c: { name: string }) => c.name));
    if (map.has(tableName)) {
      for (const c of colNames) map.get(tableName)!.add(c);
    } else {
      map.set(tableName, colNames);
    }
  }
  return map;
}

/**
 * Build map: tableName → (colName → Drizzle column object).
 * Used by autoFixSchemaDrift to get SQL type info for each column.
 */
function buildSchemaColumnsMap(): Map<string, Map<string, any>> {
  const map = new Map<string, Map<string, any>>();
  for (const exported of Object.values(allSchema)) {
    if (!is(exported as object, PgTable)) continue;
    const tableName = getTableName(exported as Parameters<typeof getTableName>[0]);
    const cols = getTableColumns(exported as Parameters<typeof getTableColumns>[0]);
    if (!map.has(tableName)) map.set(tableName, new Map());
    const colMap = map.get(tableName)!;
    for (const col of Object.values(cols) as any[]) {
      colMap.set(col.name as string, col);
    }
  }
  return map;
}

/**
 * Detect whether a value is a Drizzle SQL template expression (not a plain literal).
 * SQL expressions (e.g. sql`now()`, sql`false`) carry queryChunks and cannot be
 * reliably serialised back to raw SQL text, so we skip NOT NULL for those columns.
 */
function isSqlExpression(v: unknown): boolean {
  return (
    v !== null &&
    typeof v === "object" &&
    ("queryChunks" in v || "inlineParams" in v || "sql" in v)
  );
}

/**
 * Derive the SQL column definition string for an ALTER TABLE … ADD COLUMN statement.
 *
 * Safety rules:
 * - Nullable columns  → just the SQL type (always safe to add).
 * - NOT NULL + plain literal default → type + NOT NULL DEFAULT <literal>.
 * - NOT NULL + SQL-expression default → added as nullable; caller logs a warning.
 * - NOT NULL + no default → added as nullable; caller logs a warning.
 *   (Adding NOT NULL without a DEFAULT would fail on a table with existing rows.)
 *
 * Returns { def, warning? } where `def` is ready to embed after ADD COLUMN IF NOT EXISTS.
 */
function buildColumnSqlDef(col: any): { def: string; warning?: string } {
  const sqlType: string =
    typeof col.getSQLType === "function" ? col.getSQLType() : "text";

  if (!col.notNull) {
    return { def: sqlType };
  }

  // NOT NULL column — only safe to enforce if we have a plain literal default.
  const dflt = col.default;
  if (dflt === undefined || dflt === null) {
    return {
      def: sqlType,
      warning:
        `Column is NOT NULL in schema but has no default — ` +
        `added as nullable to avoid breaking existing rows. ` +
        `Backfill data then add the constraint manually.`,
    };
  }

  if (isSqlExpression(dflt)) {
    return {
      def: sqlType,
      warning:
        `Column is NOT NULL with a SQL-expression default — ` +
        `added as nullable (expression defaults cannot be safely serialised). ` +
        `Add NOT NULL manually after verifying the column is populated.`,
    };
  }

  // Plain literal default — safe to include.
  let defaultExpr: string;
  if (typeof dflt === "boolean") {
    defaultExpr = dflt ? "TRUE" : "FALSE";
  } else if (typeof dflt === "number") {
    defaultExpr = String(dflt);
  } else if (typeof dflt === "string") {
    // Escape single quotes inside the default value.
    defaultExpr = `'${dflt.replace(/'/g, "''")}'`;
  } else {
    defaultExpr = `'${String(dflt).replace(/'/g, "''")}'`;
  }

  return { def: `${sqlType} NOT NULL DEFAULT ${defaultExpr}` };
}

/** Query live DB for all public tables and their columns. */
async function buildDbMap(): Promise<Map<string, Set<string>>> {
  const rows = await db.execute<{ table_name: string; column_name: string }>(sql`
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
    ORDER BY table_name, ordinal_position
  `);
  const map = new Map<string, Set<string>>();
  for (const row of rows.rows) {
    if (!map.has(row.table_name)) map.set(row.table_name, new Set());
    map.get(row.table_name)!.add(row.column_name);
  }
  return map;
}

/** Compare schema definition against live DB and return a drift report. */
export async function checkSchemaDrift(): Promise<SchemaDriftReport> {
  const [schemaMap, dbMap] = await Promise.all([Promise.resolve(buildSchemaMap()), buildDbMap()]);

  const ignoredDbTables = new Set(["_schema_migrations"]);

  const missingTables: string[] = [];
  const extraTables: string[] = [];
  const columnDrift: ColumnDiff[] = [];

  for (const [table] of schemaMap) {
    if (!dbMap.has(table)) missingTables.push(table);
  }

  for (const [table] of dbMap) {
    if (!ignoredDbTables.has(table) && !schemaMap.has(table)) {
      extraTables.push(table);
    }
  }

  for (const [table, schemaColumns] of schemaMap) {
    const dbColumns = dbMap.get(table);
    if (!dbColumns) continue;

    const missingInDb = [...schemaColumns].filter((c) => !dbColumns.has(c));
    const extraInDb = [...dbColumns].filter((c) => !schemaColumns.has(c));

    if (missingInDb.length > 0 || extraInDb.length > 0) {
      columnDrift.push({ table, missingInDb, extraInDb });
    }
  }

  const ok =
    missingTables.length === 0 && columnDrift.filter((d) => d.missingInDb.length > 0).length === 0;

  const report: SchemaDriftReport = {
    ok,
    checkedAt: new Date().toISOString(),
    totalSchemaTables: schemaMap.size,
    totalDbTables: dbMap.size,
    missingTables: missingTables.sort(),
    extraTables: extraTables.sort(),
    columnDrift: columnDrift.sort((a, b) => a.table.localeCompare(b.table)),
  };

  _lastDriftReport = report;
  return report;
}

/**
 * Automatically fix schema drift by adding columns that exist in the Drizzle
 * schema but are absent from the live database.
 *
 * What this does:
 *  • Runs ALTER TABLE "<table>" ADD COLUMN IF NOT EXISTS "<col>" <type> for
 *    every column flagged as missingInDb in the supplied drift report.
 *  • Derives the SQL type from Drizzle's own column metadata (getSQLType()).
 *  • Includes NOT NULL DEFAULT <value> only when the schema has a plain literal
 *    default — avoids breaking existing rows.
 *  • Is fully idempotent: IF NOT EXISTS means re-running on an already-fixed
 *    DB is safe.
 *
 * What this does NOT do:
 *  • Drop extra columns in the DB (informational only — never destructive).
 *  • Create missing tables (those require full Drizzle migrations).
 *  • Rename columns.
 *
 * After running, call checkSchemaDrift() again to refresh the cached report.
 */
export async function autoFixSchemaDrift(drift: SchemaDriftReport): Promise<AutoFixResult> {
  const result: AutoFixResult = { fixed: [], skipped: [], errors: [] };

  const columnsToFix = drift.columnDrift.filter((d) => d.missingInDb.length > 0);
  if (columnsToFix.length === 0) {
    return result;
  }

  const schemaColumnsMap = buildSchemaColumnsMap();

  for (const diff of columnsToFix) {
    const tableColMap = schemaColumnsMap.get(diff.table);
    if (!tableColMap) {
      for (const colName of diff.missingInDb) {
        result.skipped.push({
          table: diff.table,
          column: colName,
          reason: "Table not found in schema column map — skipping",
        });
      }
      continue;
    }

    for (const colName of diff.missingInDb) {
      const col = tableColMap.get(colName);
      if (!col) {
        result.skipped.push({
          table: diff.table,
          column: colName,
          reason: "Column not found in schema column map — skipping",
        });
        continue;
      }

      const { def, warning } = buildColumnSqlDef(col);

      // Table and column names come from our own Drizzle schema — not user input.
      // We still double-quote them to handle any reserved word edge cases.
      const alterSql = `ALTER TABLE "${diff.table}" ADD COLUMN IF NOT EXISTS "${colName}" ${def}`;

      try {
        await db.execute(sql.raw(alterSql));
        result.fixed.push({ table: diff.table, column: colName, sqlType: def, def: alterSql });
        if (warning) {
          result.skipped.push({
            table: diff.table,
            column: colName,
            reason: `Fixed as nullable — ${warning}`,
          });
        }
      } catch (err: any) {
        result.errors.push({
          table: diff.table,
          column: colName,
          error: err?.message ?? String(err),
        });
      }
    }
  }

  return result;
}
