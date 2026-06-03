import { db } from "@workspace/db";
import { platformSettingsTable } from "@workspace/db/schema";
import { Router, type IRouter, type Request, type Response } from "express";
import { eq } from "drizzle-orm";
import { logger } from "../../lib/logger.js";
import { getIO } from "../../lib/socketio.js";
import { authenticateAdmin } from "../../middleware/admin-auth.js";

const router: IRouter = Router();

/* ── helpers ─────────────────────────────────────────────────────────────────────────────── */

function themeKey(appRole: string): string {
  return `theme_config_${appRole}`;
}

const DEFAULT_THEME_CONFIG = {
  selectedTheme: "dark-gold",
  colors: {
    primary: {
      dark:     "#1A1A2E",
      gold:     "#D4AF37",
      darkGold: "#C4860F",
    },
    secondary: {
      lightGray:  "#F5F5F5",
      darkGray:   "#333333",
      borderGray: "#E0E0E0",
    },
    semantic: {
      success: "#4CAF50",
      warning: "#FFC107",
      error:   "#F44336",
      info:    "#2196F3",
    },
    text: {
      primary:   "#1A1A2E",
      secondary: "#666666",
      light:     "#FFFFFF",
    },
  },
};

async function getThemeConfig(appRole: string): Promise<Record<string, unknown>> {
  try {
    const row = await db
      .select()
      .from(platformSettingsTable)
      .where(eq(platformSettingsTable.key, themeKey(appRole)))
      .limit(1);
    if (row[0]?.value) {
      return JSON.parse(row[0].value);
    }
  } catch (err) {
    logger.warn({ err, appRole }, "[theme-management] getThemeConfig parse error");
  }
  return { ...DEFAULT_THEME_CONFIG, appRole };
}

async function saveThemeConfig(
  appRole: string,
  config: Record<string, unknown>
): Promise<void> {
  const key = themeKey(appRole);
  const value = JSON.stringify(config);
  await db
    .insert(platformSettingsTable)
    .values({
      key,
      value,
      label: `Theme config for ${appRole}`,
      category: "theme",
    })
    .onConflictDoUpdate({
      target: platformSettingsTable.key,
      set: { value, updatedAt: new Date() },
    });
}

/* ── POST /api/admin/theme-config ───────────────────────────────────────────────────────────── */

router.post(
  "/theme-config",
  authenticateAdmin,
  async (req: Request, res: Response) => {
    try {
      const { theme, colors, appRole } = req.body;

      if (!appRole || !["admin", "vendor", "rider", "customer"].includes(appRole)) {
        res.status(400).json({ error: "Missing or invalid appRole" });
        return;
      }

      const config = {
        selectedTheme: theme ?? "darkGold",
        colors: colors ?? DEFAULT_THEME_CONFIG.colors,
        appRole,
        updatedAt: new Date().toISOString(),
      };

      await saveThemeConfig(appRole, config);

      // Broadcast to all connected clients via Socket.IO
      const io = getIO();
      if (io) {
        io.emit("theme-updated", { appRole, theme: config.selectedTheme, colors: config.colors });
      }

      logger.info({ appRole, theme: config.selectedTheme }, "[theme-management] config updated");
      res.json({ success: true });
    } catch (err) {
      logger.error({ err }, "[theme-management] POST /theme-config failed");
      res.status(500).json({ error: "Failed to save theme config" });
    }
  }
);

/* ── GET /api/admin/theme-config/:appRole ───────────────────────────────────────────────────────────────── */

router.get("/theme-config/:appRole", async (req: Request, res: Response) => {
  try {
    const appRole = req.params.appRole;
    const config = await getThemeConfig(appRole);
    res.json(config);
  } catch (err) {
    logger.error({ err }, "[theme-management] GET /theme-config/:appRole failed");
    res.status(500).json({ error: "Failed to load theme config" });
  }
});

/* ── GET /api/admin/theme-config (all roles) ───────────────────────────────────────────────────────────────── */

router.get("/theme-config", async (_req: Request, res: Response) => {
  try {
    const roles = ["admin", "vendor", "rider", "customer"];
    const configs = await Promise.all(
      roles.map(async (role) => {
        const config = await getThemeConfig(role);
        return { appRole: role, ...config };
      })
    );
    res.json({ configs });
  } catch (err) {
    logger.error({ err }, "[theme-management] GET /theme-config failed");
    res.status(500).json({ error: "Failed to load theme configs" });
  }
});

export default router;
