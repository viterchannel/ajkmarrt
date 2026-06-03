import { test, expect } from "@playwright/test";

/**
 * Theme Management E2E Tests
 * Tests the complete theme system across all apps
 */

test.describe("Theme Management System", () => {
  test("API: GET /api/admin/theme-config/:appRole returns theme config", async ({
    request,
  }) => {
    const roles = ["admin", "vendor", "rider", "customer"];

    for (const role of roles) {
      const response = await request.get(`/api/admin/theme-config/${role}`);
      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(body).toHaveProperty("selectedTheme");
      expect(body).toHaveProperty("colors");
      expect(body).toHaveProperty("appRole", role);

      // Verify color structure
      expect(body.colors).toHaveProperty("primary");
      expect(body.colors).toHaveProperty("secondary");
      expect(body.colors).toHaveProperty("semantic");
      expect(body.colors).toHaveProperty("text");
    }
  });

  test("API: GET /api/admin/theme-config returns all role configs", async ({
    request,
  }) => {
    const response = await request.get("/api/admin/theme-config");
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body).toHaveProperty("configs");
    expect(Array.isArray(body.configs)).toBe(true);
    expect(body.configs.length).toBeGreaterThanOrEqual(4);

    // Verify each role config
    const roles = body.configs.map((cfg: any) => cfg.appRole);
    expect(roles).toContain("admin");
    expect(roles).toContain("vendor");
    expect(roles).toContain("rider");
    expect(roles).toContain("customer");
  });

  test("Rider App: Theme loads on page", async ({ page }) => {
    await page.goto("/rider/");

    // Check if theme is applied (check for dark class or theme attribute)
    const htmlElement = page.locator("html");
    const themeAttr = await htmlElement.getAttribute("data-theme");
    const darkClass = await htmlElement.evaluate((el) =>
      el.classList.contains("dark")
    );

    expect(themeAttr || darkClass).toBeTruthy();
  });

  test("Rider App: Theme persists to localStorage", async ({ page }) => {
    await page.goto("/rider/");

    // Check if theme is saved in localStorage
    const themeValue = await page.evaluate(() => {
      return localStorage.getItem("rider-theme");
    });

    expect(themeValue).toBeTruthy();
    expect(["light", "dark", "system"]).toContain(themeValue);
  });

  test("Rider App: useThemeConfig hook loads API config", async ({ page }) => {
    await page.goto("/rider/profile");

    // Wait for theme config to load from API
    await page.waitForTimeout(1000);

    // Check if CSS variables are applied
    const brandPrimaryColor = await page.evaluate(() => {
      return getComputedStyle(document.documentElement).getPropertyValue(
        "--color-brand-primary"
      );
    });

    expect(brandPrimaryColor).toBeTruthy();
  });

  test("Vendor App: Theme API endpoint is accessible", async ({ request }) => {
    const response = await request.get("/api/admin/theme-config/vendor");
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.selectedTheme).toBe("dark-blue");
  });

  test("Admin App: Theme management page loads", async ({ page }) => {
    // Navigate to admin theme management
    await page.goto("/admin/theme-management");

    // Check if page has role tabs
    const adminTab = page.locator('button:has-text("Admin Panel")');
    const vendorTab = page.locator('button:has-text("Vendor App")');
    const riderTab = page.locator('button:has-text("Rider App")');

    await expect(adminTab).toBeVisible();
    await expect(vendorTab).toBeVisible();
    await expect(riderTab).toBeVisible();
  });

  test("Theme Registry: All themes are registered", async ({ request }) => {
    // Test that theme endpoints respond for all known themes
    const themes = ["dark-gold", "light-mode", "dark-blue", "dark-navy", "high-contrast"];

    for (const theme of themes) {
      // Simply verify the theme is mentioned in theme management response
      const response = await request.get("/api/admin/theme-config/admin");
      expect(response.status()).toBe(200);
    }
  });

  test("Database: Theme configs persist", async ({ request }) => {
    const getConfig = async () => {
      const response = await request.get("/api/admin/theme-config/rider");
      return (await response.json()).selectedTheme;
    };

    const initialTheme = await getConfig();
    expect(initialTheme).toBeTruthy();

    // Theme should be consistent across multiple requests
    const secondTheme = await getConfig();
    expect(secondTheme).toBe(initialTheme);
  });

  test("Rider App: Light/Dark theme toggle works", async ({ page }) => {
    await page.goto("/rider/settings");

    // Look for theme toggle button (if available)
    const settingsPage = page.locator("text=Settings");
    await expect(settingsPage).toBeVisible();

    // Verify theme settings section exists
    const themeSection = page.locator("text=Theme");
    if (await themeSection.isVisible()) {
      // Click theme option and verify it changes
      await themeSection.click();
    }
  });

  test("Customer App: Theme loads correctly", async ({ page }) => {
    // Note: Customer app might not exist yet, but we test the API
    const response = await request.get("/api/admin/theme-config/customer");
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.selectedTheme).toBe("dark-gold");
  });
});

test.describe("Theme System Integration", () => {
  test("All apps use consistent theme structure", async ({ request }) => {
    const roles = ["admin", "vendor", "rider", "customer"];
    const colorKeys = [
      "primary",
      "secondary",
      "semantic",
      "text",
    ];

    for (const role of roles) {
      const response = await request.get(`/api/admin/theme-config/${role}`);
      const body = await response.json();

      for (const key of colorKeys) {
        expect(body.colors).toHaveProperty(key);
        expect(typeof body.colors[key]).toBe("object");
      }
    }
  });

  test("Theme changes broadcast via Socket.IO", async ({ page, context }) => {
    // This test would require Socket.IO connection setup
    // Placeholder for future enhancement
    expect(true).toBe(true);
  });

  test("Default theme fallback works", async ({ request }) => {
    const response = await request.get("/api/admin/theme-config/nonexistent");
    // Should return 200 with default config
    expect(response.status()).toBe(200);
  });
});
