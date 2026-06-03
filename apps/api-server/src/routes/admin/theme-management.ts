import { db } from "@workspace/db";
import { themeConfigsTable } from "@workspace/db/schema";
import { Router, type IRouter, type Request, type Response } from "express";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { logger } from "../../lib/logger.js";
import { getIO } from "../../lib/socketio.js";
import { authenticateAdmin, csrfProtection } from "../../middleware/admin-auth.js";

const router: IRouter = Router();

/* ── Constants ───────────────────────────────────────────────────────────────── */

const VALID_ROLES  = ["admin", "vendor", "rider", "customer"] as const;
const VALID_THEMES = ["dark-gold", "light-mode", "dark-blue", "dark-navy", "high-contrast"] as const;
const HEX_COLOR_RE = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/;

type AppRole = typeof VALID_ROLES[number];
type ThemeId = typeof VALID_THEMES[number];

/* ── Zod validation schemas ──────────────────────────────────────────────────── */

const hexColor = z
  .string()
  .regex(HEX_COLOR_RE, "Must be a valid hex color (#RGB or #RRGGBB)");

const themeColorsSchema = z.object({
  primary:   z.object({ dark: hexColor, gold: hexColor, darkGold: hexColor }),
  secondary: z.object({ lightGray: hexColor, darkGray: hexColor, borderGray: hexColor }),
  semantic:  z.object({ success: hexColor, warning: hexColor, error: hexColor, info: hexColor }),
  text:      z.object({ primary: hexColor, secondary: hexColor, light: hexColor }),
}).strict();

const saveThemeBodySchema = z.object({
  appRole: z.enum(VALID_ROLES),
  theme:   z.enum(VALID_THEMES),
  colors:  themeColorsSchema,
});

type ValidatedColors = z.infer<typeof themeColorsSchema>;

/* ── Default config ──────────────────────────────────────────────────────────── */

const DEFAULT_THEME_CONFIG: { selectedTheme: ThemeId; colors: ValidatedColors } = {
  selectedTheme: "dark-gold",
  colors: {
    primary:   { dark: "#1A1A2E", gold: "#D4AF37", darkGold: "#C4860F" },
    secondary: { lightGray: "#F5F5F5", darkGray: "#333333", borderGray: "#E0E0E0" },
    semantic:  { success: "#4CAF50", warning: "#FFC107", error: "#F44336", info: "#2196F3" },
    text:      { primary: "#1A1A2E", secondary: "#666666", light: "#FFFFFF" },
  },
};

/* ── DB helpers ──────────────────────────────────────────────────────────────── */

async function getThemeConfig(appRole: string): Promise<Record<string, unknown>> {
  try {
    const rows = await db
      .select()
      .from(themeConfigsTable)
      .where(eq(themeConfigsTable.appRole, appRole))
      .limit(1);

    if (rows[0]) {
      let colors: unknown;
      try {
        colors = JSON.parse(rows[0].colors);
      } catch (parseErr) {
        logger.warn(
          { parseErr, appRole },
          "[theme-management] stored colors JSON is corrupt — returning defaults",
        );
        colors = DEFAULT_THEME_CONFIG.colors;
      }
      return {
        selectedTheme: rows[0].selectedTheme,
        colors,
        appRole,
        updatedAt: rows[0].updatedAt,
        updatedBy: rows[0].updatedBy,
      };
    }
  } catch (err) {
    logger.warn({ err, appRole }, "[theme-management] getThemeConfig DB error — returning defaults");
  }
  return { ...DEFAULT_THEME_CONFIG, appRole };
}

/**
 * Atomic upsert — eliminates the TOCTOU SELECT→INSERT/UPDATE race.
 * Requires the unique index on app_role (added to schema).
 */
async function upsertThemeConfig(
  appRole: AppRole,
  selectedTheme: ThemeId,
  colors: ValidatedColors,
  updatedBy: string,
): Promise<void> {
  const colorsJson = JSON.stringify(colors);
  await db
    .insert(themeConfigsTable)
    .values({ appRole, selectedTheme, colors: colorsJson, updatedBy })
    .onConflictDoUpdate({
      target: themeConfigsTable.appRole,
      set: {
        selectedTheme,
        colors:    colorsJson,
        updatedAt: new Date(),
        updatedBy,
      },
    });
}

/* ── POST /api/admin/theme-config ─────────────────────────────────────────────
   Protected: JWT + CSRF applied inline because this router is mounted BEFORE
   the global adminAuth + csrfProtection chain in admin.ts (GET routes must
   remain public for ThemeProvider on client apps).
   ────────────────────────────────────────────────────────────────────────────── */

router.post(
  "/theme-config",
  authenticateAdmin,
  csrfProtection,
  async (req: Request, res: Response) => {
    const parsed = saveThemeBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: "Invalid theme configuration",
        details: parsed.error.issues.map((i) => ({
          field:   i.path.join("."),
          message: i.message,
        })),
      });
      return;
    }

    const { appRole, theme, colors } = parsed.data;
    const updatedBy = req.admin?.sub ?? req.admin?.name ?? "system";

    try {
      await upsertThemeConfig(appRole, theme, colors, updatedBy);

      const io = getIO();
      if (io) {
        io.emit("theme-updated", { appRole, theme, colors });
      }

      logger.info({ appRole, theme, updatedBy }, "[theme-management] config updated");
      res.json({ success: true });
    } catch (err) {
      logger.error({ err }, "[theme-management] POST /theme-config failed");
      res.status(500).json({ error: "Failed to save theme config" });
    }
  },
);

/* ── GET /api/admin/theme-config/:appRole ─────────────────────────────────────
   Public — ThemeProvider on every app fetches this without credentials.
   Theme colors are not PII; no auth required.
   ────────────────────────────────────────────────────────────────────────────── */

router.get("/theme-config/:appRole", async (req: Request, res: Response) => {
  const { appRole } = req.params;
  if (!VALID_ROLES.includes(appRole as AppRole)) {
    res.status(400).json({ error: "Invalid appRole" });
    return;
  }
  try {
    const config = await getThemeConfig(appRole);
    res.json(config);
  } catch (err) {
    logger.error({ err }, "[theme-management] GET /theme-config/:appRole failed");
    res.status(500).json({ error: "Failed to load theme config" });
  }
});

/* ── GET /api/admin/theme-config ──────────────────────────────────────────────
   Returns all four role configs for the admin management page.
   Public: theme data is non-sensitive.
   ────────────────────────────────────────────────────────────────────────────── */

router.get("/theme-config", async (_req: Request, res: Response) => {
  try {
    const configs = await Promise.all(
      VALID_ROLES.map(async (role) => {
        const config = await getThemeConfig(role);
        return { appRole: role, ...config };
      }),
    );
    res.json({ configs });
  } catch (err) {
    logger.error({ err }, "[theme-management] GET /theme-config failed");
    res.status(500).json({ error: "Failed to load theme configs" });
  }
});

export default router;
