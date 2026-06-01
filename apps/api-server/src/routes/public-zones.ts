/**
 * public-zones.ts — /api/service-zones/public
 *
 * Public (no auth) endpoint that returns admin-configured cities and their
 * service-zone names grouped for the rider registration form.
 *
 * Response shape:
 *   { cities: string[]; zones: { city: string; areas: string[] }[] }
 */
import { db } from "@workspace/db";
import { serviceZonesTable } from "@workspace/db/schema";
import { asc, eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { sendError, sendSuccess } from "../lib/response.js";

const router: IRouter = Router();

/**
 * GET /service-zones/public
 * Returns distinct cities and their active zone names (area suggestions).
 * Cached at CDN / proxy level for 5 minutes; safe to call on every page load.
 */
router.get("/public", async (_req, res) => {
  res.set("Cache-Control", "public, max-age=300, stale-while-revalidate=60");
  try {
    const zones = await db
      .select({
        city: serviceZonesTable.city,
        name: serviceZonesTable.name,
      })
      .from(serviceZonesTable)
      .where(eq(serviceZonesTable.isActive, true))
      .orderBy(asc(serviceZonesTable.city), asc(serviceZonesTable.name));

    /* Group by city */
    const cityMap = new Map<string, string[]>();
    for (const z of zones) {
      if (!cityMap.has(z.city)) cityMap.set(z.city, []);
      cityMap.get(z.city)!.push(z.name);
    }

    const grouped = Array.from(cityMap.entries()).map(([city, areas]) => ({
      city,
      areas,
    }));

    sendSuccess(res, {
      cities: Array.from(cityMap.keys()),
      zones: grouped,
    });
  } catch (_err) {
    sendError(res, "Internal server error", 500);
  }
});

export default router;
