import { db } from "@workspace/db";
import { themeConfigsTable } from "@workspace/db/schema";
import { Router, type IRouter, type Request, type Response } from "express";
import { eq } from "drizzle-orm";
import { logger } from "../../lib/logger.js";
import { getIO } from "../../lib/socketio.js";
import { authenticateAdmin } from "../../middleware/admin-auth.js";

const router: IRouter = Router();

/* ── helpers ─────────────────────────────────────────────────────────────────────────────── */

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
      .from(themeConfigsTable)
      .where(eq(themeConfigsTable.appRole, appRole))
      .limit(1);
    if (row[0]) {
      return {
        selectedTheme: row[0].selectedTheme,
        colors: JSON.parse(row[0].colors),
        appRole,
        updatedAt: row[0].updatedAt,
        updatedBy: row[0].updatedBy,
      };
    }
  } catch (err) {
    logger.warn({ err, appRole }, "[theme-management] getThemeConfig error");
  }
  return { ...DEFAULT_THEME_CONFIG, appRole };
}

async function saveThemeConfig(
  appRole: string,
  selectedTheme: string,
  colors: Record<string, unknown>,
  updatedBy?: string
): Promise<void> {
  const existing = await db
    .select()
    .from(themeConfigsTable)
    .where(eq(themeConfigsTable.appRole, appRole))
    .limit(1);

  if (existing[0]) {
    await db
      .update(themeConfigsTable)
      .set({
        selectedTheme,
        colors: JSON.stringify(colors),
        updatedAt: new Date(),
        updatedBy,
      })
      .where(eq(themeConfigsTable.appRole, appRole));
  } else {
    await db.insert(themeConfigsTable).values({
      appRole,
      selectedTheme,
      colors: JSON.stringify(colors),
      updatedBy,
    });
  }
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

      const selectedTheme = theme ?? "dark-gold";
      const themeColors = colors ?? DEFAULT_THEME_CONFIG.colors;
      const updatedBy = req.admin?.id ?? req.admin?.email ?? "system";

      await saveThemeConfig(appRole, selectedTheme, themeColors, updatedBy);

      // Broadcast to all connected clients via Socket.IO
      const io = getIO();
      if (io) {
        io.emit("theme-updated", {
          appRole,
          theme: selectedTheme,
          colors: themeColors,
        });
      }

      logger.info({ appRole, theme: selectedTheme, updatedBy }, "[theme-management] config updated");
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
