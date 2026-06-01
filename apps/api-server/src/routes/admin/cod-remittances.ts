import { db } from "@workspace/db";
import {
  usersTable,
  walletTransactionsTable,
} from "@workspace/db/schema";
import { and, count, desc, eq, ilike, or, sql, sum } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod/v4";
import { logger } from "../../lib/logger.js";
import { sendError, sendSuccess, sendValidationError } from "../../lib/response.js";
import type { AdminRequest } from "../admin-shared.js";

const router = Router();

/* ── GET /admin/cod-remittances — Paginated list of all rider COD remittances ──
   Query params:
     page, limit, status (all|pending|verified|rejected), search (rider name/phone) */
router.get("/cod-remittances", async (req, res) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page ?? "1")));
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? "20"))));
    const status = String(req.query.status ?? "all");
    const search = String(req.query.search ?? "").trim();
    const offset = (page - 1) * limit;

    /* Conditions that apply to walletTransactionsTable only (no join needed) */
    const txConditions = [eq(walletTransactionsTable.type, "cod_remittance")];

    if (status === "pending") {
      txConditions.push(sql`${walletTransactionsTable.reference} LIKE 'pending:%'`);
    } else if (status === "verified") {
      txConditions.push(sql`${walletTransactionsTable.reference} LIKE 'verified:%'`);
    } else if (status === "rejected") {
      txConditions.push(sql`${walletTransactionsTable.reference} LIKE 'rejected:%'`);
    }

    /* Rider search — filter by name or phone (case-insensitive, requires join) */
    const searchCondition = search
      ? or(ilike(usersTable.name, `%${search}%`), ilike(usersTable.phone, `%${search}%`))
      : null;

    const allConditions = searchCondition
      ? [...txConditions, searchCondition]
      : txConditions;

    const [rows, totalRows, summaryRows] = await Promise.all([
      db
        .select({
          id: walletTransactionsTable.id,
          userId: walletTransactionsTable.userId,
          amount: walletTransactionsTable.amount,
          type: walletTransactionsTable.type,
          description: walletTransactionsTable.description,
          reference: walletTransactionsTable.reference,
          createdAt: walletTransactionsTable.createdAt,
          riderName: usersTable.name,
          riderPhone: usersTable.phone,
        })
        .from(walletTransactionsTable)
        .leftJoin(usersTable, eq(walletTransactionsTable.userId, usersTable.id))
        .where(and(...allConditions))
        .orderBy(desc(walletTransactionsTable.createdAt))
        .limit(limit)
        .offset(offset),
      /* Count also joins when search is active so results match the list */
      db
        .select({ count: count() })
        .from(walletTransactionsTable)
        .leftJoin(usersTable, eq(walletTransactionsTable.userId, usersTable.id))
        .where(and(...allConditions)),
      /* Summary per status bucket — use a computed label column so PostgreSQL
         aggregation is valid: the label is in GROUP BY and selected.          */
      db.execute(sql`
        SELECT
          CASE
            WHEN reference LIKE 'verified:%' THEN 'verified'
            WHEN reference LIKE 'rejected:%' THEN 'rejected'
            ELSE 'pending'
          END AS status_key,
          COUNT(*)::int        AS cnt,
          SUM(amount::numeric) AS total_amount
        FROM ${walletTransactionsTable}
        WHERE type = 'cod_remittance'
        GROUP BY status_key
      `),
    ]);

    const total = Number(totalRows[0]?.count ?? 0);

    let pendingAmount = 0;
    let verifiedAmount = 0;
    let rejectedAmount = 0;
    for (const r of (summaryRows as any).rows ?? []) {
      const amt = parseFloat(String(r.total_amount ?? "0"));
      if (r.status_key === "verified") verifiedAmount += amt;
      else if (r.status_key === "rejected") rejectedAmount += amt;
      else pendingAmount += amt;
    }

    sendSuccess(res, {
      remittances: rows.map((r) => {
        const ref = r.reference ?? "";
        const statusKey = ref.startsWith("verified:")
          ? "verified"
          : ref.startsWith("rejected:")
            ? "rejected"
            : "pending";
        const meta = ref.startsWith("verified:") || ref.startsWith("rejected:")
          ? ref.substring(ref.indexOf(":") + 1)
          : null;
        return {
          ...r,
          amount: parseFloat(String(r.amount ?? "0")),
          status: statusKey,
          meta,
        };
      }),
      summary: { pendingAmount, verifiedAmount, rejectedAmount },
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: page * limit < total,
      },
    });
  } catch (err) {
    logger.error({ err }, "[admin/cod-remittances] list error");
    sendError(res, "Internal server error", 500);
  }
});

const verifySchema = z.object({
  note: z.string().max(500).optional(),
});

/* ── PATCH /admin/cod-remittances/:id/verify — Verify COD remittance ──
   Uses a conditional UPDATE (WHERE reference LIKE 'pending:%') to guard
   against double-processing under concurrent requests.                  */
router.patch("/cod-remittances/:id/verify", async (req: AdminRequest, res) => {
  try {
    const { id } = req.params;
    const parsed = verifySchema.safeParse(req.body);
    if (!parsed.success) {
      sendValidationError(res, parsed.error.issues[0]?.message || "Invalid input");
      return;
    }
    const adminId = req.adminUser?.id ?? "admin";
    const note = parsed.data.note ?? "";
    const verifiedRef = `verified:${adminId}:${note}`.substring(0, 255);

    await db.transaction(async (trx) => {
      /* Fetch the transaction for amount — still need to read it first */
      const [tx] = await trx
        .select()
        .from(walletTransactionsTable)
        .where(
          and(
            eq(walletTransactionsTable.id, id),
            eq(walletTransactionsTable.type, "cod_remittance")
          )
        )
        .limit(1);

      if (!tx) {
        throw Object.assign(new Error("NOT_FOUND"), { statusCode: 404 });
      }

      /* Atomic conditional update — only succeeds if still in pending state */
      const updated = await trx
        .update(walletTransactionsTable)
        .set({ reference: verifiedRef })
        .where(
          and(
            eq(walletTransactionsTable.id, id),
            sql`${walletTransactionsTable.reference} LIKE 'pending:%'`
          )
        );

      /* If nothing was updated the remittance was already processed */
      const affectedRows = (updated as any).rowCount ?? (updated as any).rowsAffected ?? 0;
      if (affectedRows === 0) {
        const alreadyProcessed = !(tx.reference ?? "").startsWith("pending:");
        if (alreadyProcessed) {
          throw Object.assign(new Error("ALREADY_PROCESSED"), { statusCode: 409 });
        }
      }

      const amount = parseFloat(String(tx.amount ?? "0"));

      await trx.execute(sql`
        UPDATE users
        SET wallet_balance = COALESCE(wallet_balance, 0) + ${amount},
            updated_at = NOW()
        WHERE id = ${tx.userId}
      `);

      await trx.insert(walletTransactionsTable).values({
        userId: tx.userId,
        amount: amount.toFixed(2),
        type: "credit",
        description: `COD remittance verified by admin (ref: ${id})`,
        reference: `cod_verify:${id}`,
        createdAt: new Date(),
      });

      logger.info({ txId: id, riderId: tx.userId, amount, adminId }, "[admin/cod-remittances] verified");
    });

    sendSuccess(res, { message: "Remittance verified and wallet credited." });
  } catch (err: any) {
    if (err?.statusCode === 404) { sendError(res, "Remittance not found", 404); return; }
    if (err?.statusCode === 409) { sendError(res, "Remittance already processed", 409); return; }
    logger.error({ err }, "[admin/cod-remittances] verify error");
    sendError(res, "Internal server error", 500);
  }
});

const rejectSchema = z.object({
  reason: z.string().min(1, "Rejection reason is required").max(500),
});

/* ── PATCH /admin/cod-remittances/:id/reject — Reject COD remittance ──
   Uses a conditional UPDATE (WHERE reference LIKE 'pending:%') to guard
   against double-processing under concurrent requests.                  */
router.patch("/cod-remittances/:id/reject", async (req: AdminRequest, res) => {
  try {
    const { id } = req.params;
    const parsed = rejectSchema.safeParse(req.body);
    if (!parsed.success) {
      sendValidationError(res, parsed.error.issues[0]?.message || "Rejection reason required");
      return;
    }
    const adminId = req.adminUser?.id ?? "admin";
    const { reason } = parsed.data;
    const rejectedRef = `rejected:${adminId}:${reason}`.substring(0, 255);

    /* Read existing transaction first (needed to confirm it exists and type) */
    const [tx] = await db
      .select({ id: walletTransactionsTable.id, reference: walletTransactionsTable.reference })
      .from(walletTransactionsTable)
      .where(
        and(
          eq(walletTransactionsTable.id, id),
          eq(walletTransactionsTable.type, "cod_remittance")
        )
      )
      .limit(1);

    if (!tx) {
      sendError(res, "Remittance not found", 404);
      return;
    }

    /* Atomic conditional update — only succeeds if still in pending state */
    const updated = await db
      .update(walletTransactionsTable)
      .set({ reference: rejectedRef })
      .where(
        and(
          eq(walletTransactionsTable.id, id),
          sql`${walletTransactionsTable.reference} LIKE 'pending:%'`
        )
      );

    const affectedRows = (updated as any).rowCount ?? (updated as any).rowsAffected ?? 0;
    if (affectedRows === 0) {
      sendError(res, "Remittance already processed", 409);
      return;
    }

    logger.info({ txId: id, riderId: tx.id, adminId, reason }, "[admin/cod-remittances] rejected");
    sendSuccess(res, { message: "Remittance rejected." });
  } catch (err) {
    logger.error({ err }, "[admin/cod-remittances] reject error");
    sendError(res, "Internal server error", 500);
  }
});

export default router;
