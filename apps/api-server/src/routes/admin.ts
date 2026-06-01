import { db } from "@workspace/db";
import {
  ordersTable,
  productsTable,
  userRolesTable,
  usersTable,
  walletTransactionsTable,
} from "@workspace/db/schema";
import { and, count, eq, inArray, sql } from "drizzle-orm";
import { Router, type IRouter, type Request, type Response } from "express";
import { logger } from "../lib/logger.js";
import { csrfProtection } from "../middleware/admin-auth.js";
import { adminAuth } from "./admin-shared.js";
import { getLastDriftReport } from "../services/schemaDrift.service.js";
import adminAccountsRoutes from "./admin/admin-accounts.js";
import analyticsRoutes from "./admin/analytics.js";
import authControlRoutes from "./admin/auth-control.js";
import broadcastsRoutes from "./admin/broadcasts.js";
import businessRulesRoutes from "./admin/business-rules.js";
import chatMonitorRoutes from "./admin/chat-monitor.js";
import communicationAdminRoutes from "./admin/communication.js";
import conditionsRoutes from "./admin/conditions.js";
import contentRoutes from "./admin/content.js";
import deepLinksRoutes from "./admin/deep-links.js";
import deliveryAccessRoutes from "./admin/delivery-access.js";
import experimentsRoutes from "./admin/experiments.js";
import faqAdminRoutes from "./admin/faq.js";
import financeRoutes from "./admin/finance/wallets.js";
import ridesRoutes from "./admin/fleet/rides.js";
import serviceZonesRoutes from "./admin/fleet/zones.js";
import citiesRoutes from "./admin/fleet/cities.js";
import inventorySettingsRoutes from "./admin/inventory-settings.js";
import launchRoutes, { ensureLaunchData } from "./admin/launch.js";
import loyaltyAdminRoutes from "./admin/loyalty.js";
import ordersRoutes from "./admin/orders.js";
import otpRoutes from "./admin/otp.js";
import platformSettingsRoutes from "./admin/platform-settings.js";
import popupsRoutes from "./admin/popups.js";
import qrCodesRoutes from "./admin/qr-codes.js";
import releaseNotesRoutes from "./admin/release-notes.js";
import searchAnalyticsRoutes from "./admin/search-analytics.js";
import securityRoutes from "./admin/security.js";
import smsGatewaysRoutes from "./admin/sms-gateways.js";
import appOverviewRoutes from "./admin/app-overview.js";
import { router as statsRoutes } from "./admin/stats.js";
import supportChatAdminRoutes from "./admin/support-chat.js";
import rbacRoutes from "./admin/system/rbac.js";
import usersRoutes from "./admin/system/users.js";
import userAddressesRoutes from "./admin/user-addresses.js";
import weatherConfigRoutes from "./admin/weather-config.js";
import webhookRegistrationsRoutes from "./admin/webhook-registrations.js";
import whatsappDeliveryRoutes from "./admin/whatsapp-delivery.js";
import whitelistRoutes from "./admin/whitelist.js";
import wishlistAnalyticsRoutes from "./admin/wishlist-analytics.js";
import featureRulesRoutes from "./admin/feature-rules.js";
import verificationBonusesRoutes from "./admin/verification-bonuses.js";
import kycQueueRoutes from "./admin/kyc-queue.js";
import revenueAnalyticsRoutes from "./admin/revenue-analytics.js";
import riderApprovalRoutes from "./admin/rider-approval.js";
import codRemittancesRoutes from "./admin/cod-remittances.js";
import sosRoutes from "./sos.js";
export {
  adminAuth,
  DEFAULT_PLATFORM_SETTINGS,
  DEFAULT_RIDE_SERVICES,
  ensureAuthMethodColumn,
  ensureCommunicationTables,
  ensureComplianceTables,
  ensureDefaultLocations,
  ensureDefaultRideServices,
  ensureFaqsTable,
  ensureOrdersGpsColumns,
  ensurePromotionsTables,
  ensureRideBidsMigration,
  ensureSupportMessagesTable,
  ensureVanServiceUpgrade,
  ensureVendorLocationColumns,
  ensureWalletP2PColumns,
  getAdminSecret,
  getCachedSettings,
  getPlatformSettings,
  type AdminRequest,
} from "./admin-shared.js";
export { ensureLaunchData };
const router: IRouter = Router();
router.use(adminAuth);
router.use(csrfProtection);
router.use(usersRoutes);
router.use(ordersRoutes);
router.use(ridesRoutes);
router.use(financeRoutes);
router.use(contentRoutes);
router.use("/system/rbac", rbacRoutes);
router.use("/service-zones", serviceZonesRoutes);
router.use(citiesRoutes);
router.use(deliveryAccessRoutes);
router.use(conditionsRoutes);
router.use(popupsRoutes);
router.use("/support-chat", supportChatAdminRoutes);
router.use("/faqs", faqAdminRoutes);
router.use(communicationAdminRoutes);
router.use(loyaltyAdminRoutes);
router.use("/chat-monitor", chatMonitorRoutes);
router.use(wishlistAnalyticsRoutes);
router.use(featureRulesRoutes);
router.use(verificationBonusesRoutes);
router.use(kycQueueRoutes);
router.use(revenueAnalyticsRoutes);
router.use(riderApprovalRoutes);
router.use(codRemittancesRoutes);
router.use(analyticsRoutes);
router.use(searchAnalyticsRoutes);
router.use("/qr-codes", qrCodesRoutes);
router.use("/weather-config", weatherConfigRoutes);
router.use(userAddressesRoutes);
router.use(experimentsRoutes);
router.use("/whatsapp", whatsappDeliveryRoutes);
router.use("/business-rules", businessRulesRoutes);
router.use(webhookRegistrationsRoutes);
router.use(deepLinksRoutes);
router.use(releaseNotesRoutes);
router.use("/launch", launchRoutes);
router.use(otpRoutes);
router.use("/sms-gateways", smsGatewaysRoutes);
router.use("/whitelist", whitelistRoutes);
router.use(platformSettingsRoutes);
router.use(inventorySettingsRoutes);
router.use(securityRoutes);
router.use(broadcastsRoutes);
router.use(authControlRoutes);
router.use(adminAccountsRoutes);
router.use(statsRoutes);
router.use(appOverviewRoutes);
router.use("/sos", sosRoutes);
/**
 * GET /api/admin/schema-drift
 * Returns the cached schema-drift report produced at startup.
 * Allows ops to check schema status from the Admin health dashboard
 * without tailing server logs or re-running the full DB introspection.
 */
router.get("/schema-drift", (_req: Request, res: Response) => {
  const report = getLastDriftReport();
  if (!report) {
    res.status(503).json({
      success: false,
      message: "Schema drift check has not yet run. Check back after server startup completes.",
    });
    return;
  }
  res.status(report.ok ? 200 : 200).json({ success: true, data: report });
});

router.get("/pending-counts", async (_req: Request, res: Response) => {
  try {
    const [
      [pendingRiders],
      [pendingOrders],
      [pendingWithdrawals],
      [pendingDeposits],
      [pendingProducts],
    ] = await Promise.all([
      db
        .select({ count: count() })
        .from(usersTable)
        .where(and(inArray(usersTable.approvalStatus, ["pending", "pending_review"]), sql`EXISTS (SELECT 1 FROM ${userRolesTable} WHERE ${userRolesTable.userId} = ${usersTable.id} AND ${userRolesTable.role} = 'rider')`)),
      db.select({ count: count() }).from(ordersTable).where(eq(ordersTable.status, "pending")),
      db
        .select({ count: count() })
        .from(walletTransactionsTable)
        .where(
          and(
            eq(walletTransactionsTable.type, "withdrawal"),
            sql`(${walletTransactionsTable.reference} = 'pending' OR ${walletTransactionsTable.reference} IS NULL)`
          )
        ),
      db
        .select({ count: count() })
        .from(walletTransactionsTable)
        .where(
          and(
            sql`type IN ('topup', 'deposit')`,
            sql`(${walletTransactionsTable.reference} = 'pending' OR ${walletTransactionsTable.reference} IS NULL OR ${walletTransactionsTable.reference} LIKE 'pending:%')`
          )
        ),
      db
        .select({ count: count() })
        .from(productsTable)
        .where(and(eq(productsTable.approvalStatus, "pending"), sql`deleted_at IS NULL`)),
    ]);
    res.json({
      pendingRiders: Number(pendingRiders?.count ?? 0),
      pendingOrders: Number(pendingOrders?.count ?? 0),
      pendingWithdrawals: Number(pendingWithdrawals?.count ?? 0),
      pendingDeposits: Number(pendingDeposits?.count ?? 0),
      pendingProducts: Number(pendingProducts?.count ?? 0),
    });
  } catch (err) {
    logger.warn({ err }, "[pending-counts] query failed");
    res.json({
      pendingRiders: 0,
      pendingOrders: 0,
      pendingWithdrawals: 0,
      pendingDeposits: 0,
      pendingProducts: 0,
    });
  }
});
export default router;
