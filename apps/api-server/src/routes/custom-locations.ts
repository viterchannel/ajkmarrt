/**
 * custom-locations.ts
 *
 * POST /api/locations/custom     — public, rate-limited
 *   Accepts { type, value, city? }, spell-checks, deduplicates against
 *   service_zones, saves pending request and notifies admins.
 *
 * GET  /api/admin/location-requests         — admin auth
 * GET  /api/admin/location-requests/count   — admin auth
 * PATCH /api/admin/location-requests/:id/approve — admin auth
 * PATCH /api/admin/location-requests/:id/reject  — admin auth
 */

import { db } from "@workspace/db";
import {
  customLocationRequestsTable,
  serviceZonesTable,
} from "@workspace/db/schema";
import { and, count, eq, ilike } from "drizzle-orm";
import { Router, type IRouter } from "express";
import rateLimit from "express-rate-limit";
import { sendError, sendSuccess } from "../lib/response.js";
import { adminAuth } from "./admin-shared.js";
import { correctLocationSpelling } from "../utils/correctLocationSpelling.js";

const suggestionsLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
});

const router: IRouter = Router();

const customLocLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many location submissions. Please wait." },
});

function sanitise(value: string): { ok: boolean; reason?: string } {
  const v = value.trim();
  if (!v) return { ok: false, reason: "Value cannot be empty" };
  if (/^\d+$/.test(v)) return { ok: false, reason: "Value cannot be numbers only" };
  if (/^[^a-zA-Z]+$/.test(v)) return { ok: false, reason: "Value must contain letters" };
  if (v.length > 100) return { ok: false, reason: "Value too long" };
  return { ok: true };
}

/**
 * GET /api/locations/suggestions?q=...&type=city|area&city=...
 */
router.get("/locations/suggestions", suggestionsLimiter, async (req, res) => {
  const q = String(req.query["q"] ?? "").trim();
  const type = String(req.query["type"] ?? "").trim();
  const city = String(req.query["city"] ?? "").trim();

  if (!q || q.length < 2) {
    sendSuccess(res, { suggestions: [] });
    return;
  }

  const pattern = `${q}%`;

  if (type === "area") {
    const rows = await db
      .selectDistinct({ value: serviceZonesTable.name })
      .from(serviceZonesTable)
      .where(
        and(
          ilike(serviceZonesTable.name, pattern),
          city ? ilike(serviceZonesTable.city, city) : undefined
        )
      )
      .limit(8);
    sendSuccess(res, { suggestions: rows.map((r) => r.value) });
  } else {
    const rows = await db
      .selectDistinct({ value: serviceZonesTable.city })
      .from(serviceZonesTable)
      .where(ilike(serviceZonesTable.city, pattern))
      .limit(8);
    sendSuccess(res, { suggestions: rows.map((r) => r.value) });
  }
});

/**
 * POST /api/locations/custom
 */
router.post("/locations/custom", customLocLimiter, async (req, res) => {
  const { type, value, city } = req.body as {
    type?: string;
    value?: string;
    city?: string;
  };

  if (!type || (type !== "city" && type !== "area")) {
    sendError(res, 'type must be "city" or "area"', 400);
    return;
  }
  if (!value || typeof value !== "string") {
    sendError(res, "value is required", 400);
    return;
  }

  const sanity = sanitise(value);
  if (!sanity.ok) {
    sendError(res, sanity.reason ?? "Invalid value", 400);
    return;
  }

  const correctedValue = await correctLocationSpelling(value);

  if (type === "area") {
    const existing = await db
      .select({ id: serviceZonesTable.id, name: serviceZonesTable.name })
      .from(serviceZonesTable)
      .where(
        and(
          ilike(serviceZonesTable.name, correctedValue),
          city ? ilike(serviceZonesTable.city, city) : undefined
        )
      )
      .limit(1);

    if (existing.length > 0) {
      sendSuccess(res, { correctedValue, matched: true, zoneId: existing[0]!.id });
      return;
    }
  } else {
    const existing = await db
      .select({ id: serviceZonesTable.id, city: serviceZonesTable.city })
      .from(serviceZonesTable)
      .where(ilike(serviceZonesTable.city, correctedValue))
      .limit(1);

    if (existing.length > 0) {
      sendSuccess(res, { correctedValue, matched: true, zoneId: existing[0]!.id });
      return;
    }
  }

  const [inserted] = await db
    .insert(customLocationRequestsTable)
    .values({
      type,
      rawValue: value.trim(),
      correctedValue,
      status: "pending",
      submittedBy: (req as { user?: { id?: string } }).user?.id ?? null,
    })
    .returning({ id: customLocationRequestsTable.id });

  sendSuccess(res, { correctedValue, matched: false, requestId: inserted?.id });
});

/**
 * GET /api/admin/location-requests
 */
router.get("/admin/location-requests", adminAuth, async (_req, res) => {
  const rows = await db
    .select()
    .from(customLocationRequestsTable)
    .orderBy(customLocationRequestsTable.createdAt);
  sendSuccess(res, { requests: rows.reverse() });
});

/**
 * GET /api/admin/location-requests/count
 */
router.get("/admin/location-requests/count", adminAuth, async (_req, res) => {
  const [row] = await db
    .select({ pendingCount: count() })
    .from(customLocationRequestsTable)
    .where(eq(customLocationRequestsTable.status, "pending"));
  sendSuccess(res, { pendingCount: row?.pendingCount ?? 0 });
});

/**
 * PATCH /api/admin/location-requests/:id/approve
 * Body: { lat: number, lng: number, name?: string, city?: string }
 */
router.patch("/admin/location-requests/:id/approve", adminAuth, async (req, res) => {
  const id = Number(req.params["id"]);
  if (!id) { sendError(res, "Invalid id", 400); return; }

  const { lat, lng, name: bodyName, city: bodyCity, radiusKm: bodyRadiusKm } = req.body as {
    lat?: unknown;
    lng?: unknown;
    name?: string;
    city?: string;
    radiusKm?: unknown;
  };

  const latNum = Number(lat);
  const lngNum = Number(lng);
  const radiusKmNum = bodyRadiusKm === undefined || bodyRadiusKm === null ? 30 : Number(bodyRadiusKm);

  if (!Number.isFinite(latNum) || latNum < -90 || latNum > 90) {
    sendError(res, "lat must be a number between -90 and 90", 400);
    return;
  }
  if (!Number.isFinite(lngNum) || lngNum < -180 || lngNum > 180) {
    sendError(res, "lng must be a number between -180 and 180", 400);
    return;
  }
  if (!Number.isFinite(radiusKmNum) || !Number.isInteger(radiusKmNum) || radiusKmNum < 1 || radiusKmNum > 500) {
    sendError(res, "radiusKm must be an integer between 1 and 500", 400);
    return;
  }

  const [request] = await db
    .select()
    .from(customLocationRequestsTable)
    .where(eq(customLocationRequestsTable.id, id))
    .limit(1);

  if (!request) { sendError(res, "Request not found", 404); return; }

  const zoneName = (bodyName?.trim()) || request.correctedValue;
  const zoneCity =
    (bodyCity?.trim()) ||
    (request.type === "area" ? (request.submittedBy ?? "Unknown") : request.correctedValue);

  if (request.type === "area") {
    await db
      .insert(serviceZonesTable)
      .values({
        name: zoneName,
        city: zoneCity,
        lat: String(latNum),
        lng: String(lngNum),
        radiusKm: String(radiusKmNum),
      })
      .onConflictDoNothing();
  } else {
    await db
      .insert(serviceZonesTable)
      .values({
        name: zoneName,
        city: zoneCity,
        lat: String(latNum),
        lng: String(lngNum),
        radiusKm: String(radiusKmNum),
      })
      .onConflictDoNothing();
  }

  const [updated] = await db
    .update(customLocationRequestsTable)
    .set({ status: "approved", updatedAt: new Date() })
    .where(eq(customLocationRequestsTable.id, id))
    .returning();

  sendSuccess(res, { request: updated });
});

/**
 * PATCH /api/admin/location-requests/:id/reject
 */
router.patch("/admin/location-requests/:id/reject", adminAuth, async (req, res) => {
  const id = Number(req.params["id"]);
  if (!id) { sendError(res, "Invalid id", 400); return; }

  const [updated] = await db
    .update(customLocationRequestsTable)
    .set({ status: "rejected", updatedAt: new Date() })
    .where(eq(customLocationRequestsTable.id, id))
    .returning();

  if (!updated) { sendError(res, "Request not found", 404); return; }
  sendSuccess(res, { request: updated });
});

/**
 * GET /api/locations/active-cities
 * Public — returns active distinct cities, optionally filtered by service type.
 * ?service=rides|orders|parcel
 * Returns { cities: string[], zones: { city: string, areas: string[] }[] }
 */
router.get("/locations/active-cities", async (req, res) => {
  res.set("Cache-Control", "public, max-age=60, stale-while-revalidate=30");
  try {
    const service = String(req.query["service"] ?? "").trim();

    const conditions = [eq(serviceZonesTable.isActive, true)];
    if (service === "rides") conditions.push(eq(serviceZonesTable.appliesToRides, true));
    else if (service === "orders") conditions.push(eq(serviceZonesTable.appliesToOrders, true));
    else if (service === "parcel") conditions.push(eq(serviceZonesTable.appliesToParcel, true));

    const zones = await db
      .select({ city: serviceZonesTable.city, name: serviceZonesTable.name })
      .from(serviceZonesTable)
      .where(and(...conditions))
      .orderBy(serviceZonesTable.city, serviceZonesTable.name);

    const cityMap = new Map<string, string[]>();
    for (const z of zones) {
      if (!cityMap.has(z.city)) cityMap.set(z.city, []);
      cityMap.get(z.city)!.push(z.name);
    }

    const grouped = Array.from(cityMap.entries()).map(([city, areas]) => ({ city, areas }));

    sendSuccess(res, { cities: Array.from(cityMap.keys()), zones: grouped });
  } catch (_err) {
    sendError(res, "Internal server error", 500);
  }
});

/**
 * GET /api/locations/active-areas
 * Public — returns active areas for a specific city (or all cities if omitted), filtered by service.
 * ?city=Muzaffarabad&service=rides|orders|parcel
 */
router.get("/locations/active-areas", async (req, res) => {
  res.set("Cache-Control", "public, max-age=60, stale-while-revalidate=30");
  try {
    const city = String(req.query["city"] ?? "").trim();
    const service = String(req.query["service"] ?? "").trim();

    const conditions = [eq(serviceZonesTable.isActive, true)];
    if (city) conditions.push(ilike(serviceZonesTable.city, city));
    if (service === "rides") conditions.push(eq(serviceZonesTable.appliesToRides, true));
    else if (service === "orders") conditions.push(eq(serviceZonesTable.appliesToOrders, true));
    else if (service === "parcel") conditions.push(eq(serviceZonesTable.appliesToParcel, true));

    const zones = await db
      .select({
        id: serviceZonesTable.id,
        name: serviceZonesTable.name,
        city: serviceZonesTable.city,
        lat: serviceZonesTable.lat,
        lng: serviceZonesTable.lng,
        radiusKm: serviceZonesTable.radiusKm,
      })
      .from(serviceZonesTable)
      .where(and(...conditions))
      .orderBy(serviceZonesTable.city, serviceZonesTable.name);

    sendSuccess(res, { areas: zones });
  } catch (_err) {
    sendError(res, "Internal server error", 500);
  }
});

export default router;
