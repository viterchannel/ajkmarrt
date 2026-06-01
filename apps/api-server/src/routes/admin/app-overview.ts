import { db } from "@workspace/db";
import {
  adminAccountsTable,
  ordersTable,
  parcelBookingsTable,
  pharmacyOrdersTable,
  ridesTable,
  usersTable,
} from "@workspace/db/schema";
import { and, count, eq, sql } from "drizzle-orm";
import { Router } from "express";
import { sendSuccess } from "../../lib/response.js";
import { requirePermission } from "../../middleware/require-permission.js";
import { adminAuth, getCachedSettings } from "../admin-shared.js";

const router = Router();

router.get("/app-overview", adminAuth, requirePermission("system.settings.view"), async (_req, res, next) => {
  try {
    const [
      [totalUsersRow],
      [activeUsersRow],
      [bannedUsersRow],
      [totalOrdersRow],
      [pendingOrdersRow],
      [totalRidesRow],
      [activeRidesRow],
      [totalPharmacyRow],
      [totalParcelRow],
      [adminAccountsRow],
    ] = await Promise.all([
      db.select({ c: count() }).from(usersTable).where(sql`${usersTable.deletedAt} IS NULL`),
      db
        .select({ c: count() })
        .from(usersTable)
        .where(
          and(
            eq(usersTable.isActive, true),
            eq(usersTable.isBanned, false),
            sql`${usersTable.deletedAt} IS NULL`
          )
        ),
      db
        .select({ c: count() })
        .from(usersTable)
        .where(eq(usersTable.isBanned, true)),
      db.select({ c: count() }).from(ordersTable),
      db.select({ c: count() }).from(ordersTable).where(eq(ordersTable.status, "pending")),
      db.select({ c: count() }).from(ridesTable),
      db
        .select({ c: count() })
        .from(ridesTable)
        .where(
          sql`${ridesTable.status} IN ('accepted','arrived','in_transit','searching','requested')`
        ),
      db.select({ c: count() }).from(pharmacyOrdersTable),
      db.select({ c: count() }).from(parcelBookingsTable),
      db.select({ c: count() }).from(adminAccountsTable),
    ]);

    const settings = await getCachedSettings();

    const featureKeys = [
      "mart",
      "food",
      "rides",
      "pharmacy",
      "parcel",
      "van",
      "wallet",
      "referral",
      "newUsers",
      "chat",
    ];
    const features: Record<string, string> = {};
    for (const key of featureKeys) {
      const raw = settings[`feature_${key}`] ?? settings[`feature_${key}_enabled`];
      features[key] = raw ?? "on";
    }

    sendSuccess(res, {
      users: {
        total: Number(totalUsersRow?.c ?? 0),
        active: Number(activeUsersRow?.c ?? 0),
        banned: Number(bannedUsersRow?.c ?? 0),
      },
      orders: {
        total: Number(totalOrdersRow?.c ?? 0),
        pending: Number(pendingOrdersRow?.c ?? 0),
      },
      rides: {
        total: Number(totalRidesRow?.c ?? 0),
        active: Number(activeRidesRow?.c ?? 0),
      },
      pharmacy: {
        total: Number(totalPharmacyRow?.c ?? 0),
      },
      parcel: {
        total: Number(totalParcelRow?.c ?? 0),
      },
      adminAccounts: Number(adminAccountsRow?.c ?? 0),
      appStatus: settings["app_status"] ?? "active",
      appName: settings["app_name"] ?? "AJKMart",
      features,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
