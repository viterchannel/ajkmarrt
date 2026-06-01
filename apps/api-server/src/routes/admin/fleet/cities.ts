import { db } from "@workspace/db";
import { serviceZonesTable } from "@workspace/db/schema";
import { and, count, eq, sql } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { invalidateZoneCache } from "../../../lib/geofence.js";
import {
  sendError,
  sendNotFound,
  sendSuccess,
  sendValidationError,
} from "../../../lib/response.js";
import { requirePermission } from "../../../middleware/require-permission.js";
import { addAuditEntry, getClientIp, type AdminRequest } from "../../admin-shared.js";

const router: IRouter = Router();

/* ── GET /admin/cities — distinct cities with aggregated zone stats ── */
router.get("/cities", requirePermission("fleet.zones.view"), async (_req, res) => {
  try {
    const rows = await db
      .select({
        city: serviceZonesTable.city,
        totalZones: count(serviceZonesTable.id),
        activeZones: sql<number>`cast(sum(case when ${serviceZonesTable.isActive} then 1 else 0 end) as int)`,
        appliesToRides: sql<boolean>`bool_or(${serviceZonesTable.appliesToRides})`,
        appliesToOrders: sql<boolean>`bool_or(${serviceZonesTable.appliesToOrders})`,
        appliesToParcel: sql<boolean>`bool_or(${serviceZonesTable.appliesToParcel})`,
        isActive: sql<boolean>`bool_and(${serviceZonesTable.isActive})`,
      })
      .from(serviceZonesTable)
      .groupBy(serviceZonesTable.city)
      .orderBy(serviceZonesTable.city);

    sendSuccess(res, rows);
  } catch (_err) {
    sendError(res, "Internal server error", 500);
  }
});

/* ── PATCH /admin/cities/:city/status — bulk enable/disable all zones in a city ── */
router.patch(
  "/cities/:city/status",
  requirePermission("fleet.zones.manage"),
  async (req, res) => {
    const adminReq = req as AdminRequest;
    try {
      const city = decodeURIComponent(req.params["city"] as string).trim();
      if (!city) {
        sendValidationError(res, "City name is required");
        return;
      }

      const { isActive } = req.body as { isActive?: unknown };
      if (typeof isActive !== "boolean" && isActive !== "true" && isActive !== "false") {
        sendValidationError(res, "isActive (boolean) is required");
        return;
      }
      const active = isActive === true || isActive === "true";

      const updated = await db
        .update(serviceZonesTable)
        .set({ isActive: active, updatedAt: new Date() })
        .where(eq(serviceZonesTable.city, city))
        .returning({ id: serviceZonesTable.id });

      if (updated.length === 0) {
        sendNotFound(res, "No zones found for this city");
        return;
      }

      invalidateZoneCache();

      void addAuditEntry({
        action: "city_status_updated",
        ip: getClientIp(req),
        adminId: adminReq.adminId,
        adminName: adminReq.adminName,
        details: `Admin ${active ? "enabled" : "disabled"} all ${updated.length} zone(s) in city '${city}'`,
        result: "success",
      });

      sendSuccess(res, { city, isActive: active, updatedCount: updated.length });
    } catch (_err) {
      sendError(res, "Internal server error", 500);
    }
  }
);

/* ── PATCH /admin/cities/:city — rename city and/or bulk-update service flags ── */
router.patch(
  "/cities/:city",
  requirePermission("fleet.zones.manage"),
  async (req, res) => {
    const adminReq = req as AdminRequest;
    try {
      const city = decodeURIComponent(req.params["city"] as string).trim();
      if (!city) {
        sendValidationError(res, "City name is required");
        return;
      }

      const body = req.body as {
        newName?: unknown;
        lat?: unknown;
        lng?: unknown;
        radiusKm?: unknown;
        appliesToRides?: unknown;
        appliesToOrders?: unknown;
        appliesToParcel?: unknown;
      };

      const updates: Record<string, unknown> = { updatedAt: new Date() };
      const changes: string[] = [];

      if (body.newName !== undefined) {
        const newName = String(body.newName).trim();
        if (!newName) {
          sendValidationError(res, "newName cannot be empty");
          return;
        }
        updates.city = newName;
        changes.push(`city renamed to '${newName}'`);
      }

      if (body.lat !== undefined) {
        const lat = Number(body.lat);
        if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
          sendValidationError(res, "lat must be a valid number between -90 and 90");
          return;
        }
        updates.lat = String(lat);
        changes.push(`lat=${lat}`);
      }

      if (body.lng !== undefined) {
        const lng = Number(body.lng);
        if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
          sendValidationError(res, "lng must be a valid number between -180 and 180");
          return;
        }
        updates.lng = String(lng);
        changes.push(`lng=${lng}`);
      }

      if (body.radiusKm !== undefined) {
        const radiusKm = Number(body.radiusKm);
        if (!Number.isFinite(radiusKm) || radiusKm <= 0 || radiusKm > 5000) {
          sendValidationError(res, "radiusKm must be a positive number up to 5000");
          return;
        }
        updates.radiusKm = String(radiusKm);
        changes.push(`radiusKm=${radiusKm}`);
      }

      if (typeof body.appliesToRides === "boolean") {
        updates.appliesToRides = body.appliesToRides;
        changes.push(`appliesToRides=${String(body.appliesToRides)}`);
      }
      if (typeof body.appliesToOrders === "boolean") {
        updates.appliesToOrders = body.appliesToOrders;
        changes.push(`appliesToOrders=${String(body.appliesToOrders)}`);
      }
      if (typeof body.appliesToParcel === "boolean") {
        updates.appliesToParcel = body.appliesToParcel;
        changes.push(`appliesToParcel=${String(body.appliesToParcel)}`);
      }

      if (changes.length === 0) {
        sendValidationError(res, "No valid fields to update. Provide newName, lat/lng/radiusKm, and/or service flags.");
        return;
      }

      const updated = await db
        .update(serviceZonesTable)
        .set(updates)
        .where(eq(serviceZonesTable.city, city))
        .returning({ id: serviceZonesTable.id });

      if (updated.length === 0) {
        sendNotFound(res, "No zones found for this city");
        return;
      }

      invalidateZoneCache();

      void addAuditEntry({
        action: "city_updated",
        ip: getClientIp(req),
        adminId: adminReq.adminId,
        adminName: adminReq.adminName,
        details: `Admin updated city '${city}': ${changes.join(", ")} (${updated.length} zone(s) affected)`,
        result: "success",
      });

      sendSuccess(res, {
        city: updates.city ?? city,
        updatedCount: updated.length,
        changes,
      });
    } catch (_err) {
      sendError(res, "Internal server error", 500);
    }
  }
);

/* ── DELETE /admin/cities/:city — delete all zones of a city (guarded) ── */
router.delete(
  "/cities/:city",
  requirePermission("fleet.zones.manage"),
  async (req, res) => {
    const adminReq = req as AdminRequest;
    try {
      const city = decodeURIComponent(req.params["city"] as string).trim();
      if (!city) {
        sendValidationError(res, "City name is required");
        return;
      }

      const { force } = req.query as { force?: string };

      if (force !== "true") {
        const [stats] = await db
          .select({
            total: count(serviceZonesTable.id),
            active: sql<number>`cast(sum(case when ${serviceZonesTable.isActive} then 1 else 0 end) as int)`,
          })
          .from(serviceZonesTable)
          .where(eq(serviceZonesTable.city, city));

        if (!stats || Number(stats.total) === 0) {
          sendNotFound(res, "No zones found for this city");
          return;
        }

        if (Number(stats.active) > 0) {
          sendError(
            res,
            `City '${city}' has ${stats.active} active zone(s). Disable all zones first or use ?force=true to override.`,
            409
          );
          return;
        }
      }

      const deleted = await db
        .delete(serviceZonesTable)
        .where(eq(serviceZonesTable.city, city))
        .returning({ id: serviceZonesTable.id, name: serviceZonesTable.name });

      if (deleted.length === 0) {
        sendNotFound(res, "No zones found for this city");
        return;
      }

      invalidateZoneCache();

      void addAuditEntry({
        action: "city_deleted",
        ip: getClientIp(req),
        adminId: adminReq.adminId,
        adminName: adminReq.adminName,
        details: `Admin deleted all ${deleted.length} zone(s) in city '${city}': ${deleted.map((z) => z.name).join(", ")}`,
        result: "success",
      });

      sendSuccess(res, { city, deletedCount: deleted.length, deletedZones: deleted });
    } catch (_err) {
      sendError(res, "Internal server error", 500);
    }
  }
);

export default router;
