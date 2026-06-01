import { sql } from "drizzle-orm";
import { check, decimal, index, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const walletTransactionsTable = pgTable(
  "wallet_transactions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
    description: text("description").notNull(),
    reference: text("reference"),
    paymentMethod: text("payment_method"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    /** P2P transfer: ID of the recipient user (NULL for non-P2P transactions). */
    receiverId: text("receiver_id").references(() => usersTable.id, { onDelete: "set null" }),
    /** P2P transfer: display name of the recipient at time of transfer. */
    receiverName: text("receiver_name"),
    /** P2P transfer: optional note attached by the sender. */
    p2pNote: text("p2p_note"),
    /** Idempotency key to prevent duplicate transactions from replayed requests. */
    idempotencyKey: text("idempotency_key"),
  },
  (t) => [
    index("wallet_txn_user_id_idx").on(t.userId),
    index("wallet_txn_created_at_idx").on(t.createdAt),
    index("wallet_txn_reference_idx").on(t.reference),
    index("idx_wallet_txn_receiver").on(t.receiverId),
    check("wallet_txn_amount_non_negative", sql`${t.amount} >= 0`),
    // PERF-05: Explicit named unique index on idempotency_key (partial — NULLs excluded).
    // The deployed index also carries INCLUDE (type, amount) for index-only scan support
    // during idempotency lookups; the INCLUDE clause is applied via migration 0058 because
    // Drizzle's index builder does not yet expose INCLUDE column syntax.
    uniqueIndex("wallet_txn_idempotency_key_idx")
      .on(t.idempotencyKey)
      .where(sql`${t.idempotencyKey} IS NOT NULL`),
  ]
);

export const insertWalletTransactionSchema = createInsertSchema(walletTransactionsTable).omit({
  createdAt: true,
});
export type InsertWalletTransaction = z.infer<typeof insertWalletTransactionSchema>;
export type WalletTransaction = typeof walletTransactionsTable.$inferSelect;
