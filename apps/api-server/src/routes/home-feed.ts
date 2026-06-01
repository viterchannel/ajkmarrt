import { db } from "@workspace/db";
import { bannersTable, flashDealsTable, productsTable, userInteractionsTable } from "@workspace/db/schema";
import { and, asc, desc, eq, gt, gte, inArray, isNull, lte, sql } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { logger } from "../lib/logger.js";
import { sendInternalError, sendSuccess } from "../lib/response.js";
import { getCachedSettings } from "./admin.js";

const router: IRouter = Router();

router.get("/", async (req, res) => {
  res.set("Cache-Control", "public, max-age=120, stale-while-revalidate=60");

  try {
    const s = await getCachedSettings();
    const now = new Date();

    const flashDefault = parseInt(s["pagination_flash_deals"] ?? "20") || 20;
    const flashMax = Math.max(flashDefault, parseInt(s["pagination_products_max"] ?? "50") || 50);
    const flashLimit = Math.min(
      parseInt((req.query["flashLimit"] as string) || String(flashDefault)),
      flashMax
    );

    const trendingDefault = parseInt(s["pagination_trending_limit"] ?? "12") || 12;
    const trendingMax = parseInt(s["pagination_products_max"] ?? "50") || 50;
    const trendingLimit = Math.min(
      parseInt((req.query["trendingLimit"] as string) || String(trendingDefault)),
      trendingMax
    );

    const placement = (req.query["placement"] as string) || "home";
    const service = req.query["service"] as string | undefined;

    const [bannersRaw, flashDealsRaw, trendingRaw] = await Promise.all([
      /* ── Banners ─────────────────────────────────────────────────────── */
      db
        .select()
        .from(bannersTable)
        .where(
          and(
            eq(bannersTable.isActive, true),
            eq(bannersTable.placement, placement),
            and(
              and(
                sql`(${bannersTable.startDate} IS NULL OR ${bannersTable.startDate} <= ${now})`,
                sql`(${bannersTable.endDate} IS NULL OR ${bannersTable.endDate} >= ${now})`
              )
            )
          )
        )
        .orderBy(asc(bannersTable.sortOrder), desc(bannersTable.createdAt)),

      /* ── Flash deals ─────────────────────────────────────────────────── */
      db
        .select({
          productId: flashDealsTable.productId,
          dealStock: flashDealsTable.dealStock,
          soldCount: flashDealsTable.soldCount,
          endTime: flashDealsTable.endTime,
        })
        .from(flashDealsTable)
        .where(
          and(
            eq(flashDealsTable.isActive, true),
            lte(flashDealsTable.startTime, now),
            gte(flashDealsTable.endTime, now),
            gt(flashDealsTable.dealStock, flashDealsTable.soldCount)
          )
        )
        .limit(flashLimit),

      /* ── Trending interactions (last 7 days) ─────────────────────────── */
      db
        .select({
          productId: userInteractionsTable.productId,
          score: sql<number>`SUM(${userInteractionsTable.weight})`.as("score"),
        })
        .from(userInteractionsTable)
        .where(gte(userInteractionsTable.createdAt, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)))
        .groupBy(userInteractionsTable.productId)
        .orderBy(sql`score DESC`)
        .limit(trendingLimit * 2),
    ]);

    /* ── Map banners ──────────────────────────────────────────────────── */
    const filteredBanners = service
      ? bannersRaw.filter(
          (b) => !b.targetService || b.targetService === service || b.targetService === "all"
        )
      : bannersRaw;

    const banners = filteredBanners.map((b) => ({
      id: b.id,
      title: b.title,
      subtitle: b.subtitle,
      imageUrl: b.imageUrl,
      linkType: b.linkType,
      linkValue: b.linkValue,
      linkUrl:
        b.linkType === "url"
          ? b.linkValue
          : b.linkType === "product"
            ? `/product/${b.linkValue}`
            : b.linkType === "category"
              ? `/category/${b.linkValue}`
              : null,
      placement: b.placement,
      targetService: b.targetService,
      gradient1: b.colorFrom,
      gradient2: b.colorTo,
      icon: b.icon,
      sortOrder: b.sortOrder,
      isActive: b.isActive,
    }));

    /* ── Map flash deals ─────────────────────────────────────────────── */
    let flashDeals: unknown[] = [];
    if (flashDealsRaw.length > 0) {
      const dealProductIds = flashDealsRaw.map((d) => d.productId);
      const dealMap = new Map(flashDealsRaw.map((d) => [d.productId, d]));

      const dealProducts = await db
        .select()
        .from(productsTable)
        .where(
          and(
            inArray(productsTable.id, dealProductIds),
            eq(productsTable.approvalStatus, "approved"),
            eq(productsTable.inStock, true),
            isNull(productsTable.deletedAt)
          )
        )
        .orderBy(asc(productsTable.createdAt));

      flashDeals = dealProducts.map((p) => {
        const price = parseFloat(p.price);
        const origPrice = p.originalPrice ? parseFloat(p.originalPrice) : price;
        const discount =
          origPrice > price ? Math.round(((origPrice - price) / origPrice) * 100) : 0;
        const dealInfo = dealMap.get(p.id);
        return {
          ...p,
          price,
          originalPrice: origPrice,
          rating: p.rating ? parseFloat(p.rating) : null,
          discountPercent: discount,
          dealStock: dealInfo?.dealStock ?? null,
          soldCount: dealInfo?.soldCount ?? 0,
          dealExpiresAt: dealInfo?.endTime?.toISOString() ?? null,
        };
      });
    }

    /* ── Map trending ────────────────────────────────────────────────── */
    let trending: unknown[] = [];
    if (trendingRaw.length === 0) {
      const fallback = await db
        .select()
        .from(productsTable)
        .where(
          and(eq(productsTable.approvalStatus, "approved"), eq(productsTable.inStock, true))
        )
        .orderBy(desc(productsTable.reviewCount))
        .limit(trendingLimit);

      trending = fallback.map((p) => ({
        ...p,
        price: parseFloat(p.price),
        originalPrice: p.originalPrice ? parseFloat(p.originalPrice) : undefined,
        rating: p.rating ? parseFloat(p.rating) : 4.0,
        trendScore: 0,
      }));
    } else {
      const productIds = trendingRaw.map((t) => t.productId);
      const scoreMap = new Map(trendingRaw.map((t) => [t.productId, t.score]));

      const trendProducts = await db
        .select()
        .from(productsTable)
        .where(
          and(
            eq(productsTable.approvalStatus, "approved"),
            eq(productsTable.inStock, true),
            inArray(productsTable.id, productIds)
          )
        );

      trending = trendProducts
        .map((p) => ({
          ...p,
          price: parseFloat(p.price),
          originalPrice: p.originalPrice ? parseFloat(p.originalPrice) : undefined,
          rating: p.rating ? parseFloat(p.rating) : 4.0,
          trendScore: scoreMap.get(p.id) ?? 0,
        }))
        .sort((a, b) => (b.trendScore as number) - (a.trendScore as number))
        .slice(0, trendingLimit);
    }

    sendSuccess(res, { banners, flashDeals, trending });
  } catch (err) {
    logger.error(
      {
        error: err instanceof Error ? err.message : String(err),
        timestamp: new Date().toISOString(),
      },
      "[home-feed GET /] unhandled error"
    );
    sendInternalError(res);
  }
});

export default router;
