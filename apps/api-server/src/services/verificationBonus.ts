import { db } from "@workspace/db";
import {
  usersTable,
  verificationBonusesTable,
  walletTransactionsTable,
} from "@workspace/db/schema";
import { eq, sql } from "drizzle-orm";
import { generateId } from "../lib/id.js";
import { logger } from "../lib/logger.js";

export type VerificationType = "email" | "phone" | "documents";

export async function awardVerificationBonus(
  userId: string,
  verificationType: VerificationType
): Promise<void> {
  try {
    const [bonus] = await db
      .select()
      .from(verificationBonusesTable)
      .where(eq(verificationBonusesTable.verificationType, verificationType))
      .limit(1);

    if (!bonus || !bonus.isActive || parseFloat(bonus.bonusAmount) <= 0) {
      return;
    }

    const bonusAmt = parseFloat(bonus.bonusAmount);

    await db.transaction(async (tx) => {
      const [user] = await tx
        .select({
          id: usersTable.id,
          verificationBonusClaimed: usersTable.verificationBonusClaimed,
        })
        .from(usersTable)
        .where(eq(usersTable.id, userId))
        .limit(1)
        .for("update");

      if (!user) return;

      const claimed = (user.verificationBonusClaimed as Record<string, boolean>) ?? {};
      if (claimed[verificationType]) return;

      await tx
        .update(usersTable)
        .set({
          walletBalance: sql`wallet_balance + ${bonusAmt.toFixed(2)}`,
          verificationBonusClaimed: sql`verification_bonus_claimed || ${JSON.stringify({ [verificationType]: true })}::jsonb`,
          updatedAt: new Date(),
        })
        .where(eq(usersTable.id, userId));

      await tx.insert(walletTransactionsTable).values({
        id: generateId(),
        userId,
        type: "credit",
        amount: bonusAmt.toFixed(2),
        description: `Verification bonus — ${verificationType} verified`,
        reference: `verification_bonus_${verificationType}`,
      });
    });
  } catch (err) {
    logger.warn({ err, userId, verificationType }, "[verificationBonus] award failed (non-fatal)");
  }
}
