/**
 * Admin → Rider: Block / Suspend Sync
 *
 * Flow being tested:
 *   1. Admin UI (saved auth state) blocks a rider via the riders management panel.
 *   2. Real /api/admin/users/:id is called without mocking to assert isActive: false.
 *   3. Rider app is loaded with mockRiderAuth but /api/rider/me returns 403 (blocked),
 *      asserting the app renders the blocked/login state — not the home screen.
 *
 * afterEach restores blocked rider to isActive: true via API.
 */
import { expect, test } from "@playwright/test";
import { mockRiderAuth } from "../helpers/mock-auth";
import {
  seedTestRider,
  cleanupTestRider,
  adminBlockRider,
  adminBlockRiderViaApi,
} from "./syncHelpers";

const BASE_URL = process.env["E2E_BASE_URL"] ?? "http://localhost:5000";

test.describe("Admin → Rider: Block / Suspend Sync", () => {
  // ── 1: Admin UI-driven block → real API asserts isActive: false ──────────
  test(
    "admin blocks rider via UI → /api/admin/users/:id shows isActive: false",
    async ({ page, request }) => {
      const rider = await seedTestRider(request);
      test.skip(
        !rider,
        "No test rider found — seed a rider with phone 03199999001 to run this test"
      );

      const riderId = rider!.id;

      try {
        await adminBlockRider(page, riderId);

        const res = await request.get(`${BASE_URL}/api/admin/users/${riderId}`, {
          headers: { "x-e2e-test": "1" },
        });
        expect(res.ok()).toBe(true);

        const body = await res.json();
        const userData = body?.data ?? body?.user ?? body;
        const isActive =
          userData?.isActive ?? userData?.user?.isActive;

        expect(isActive).toBe(false);
      } finally {
        await cleanupTestRider(request, riderId);
      }
    }
  );

  // ── 2: Admin API block → real API asserts isActive: false ────────────────
  test(
    "admin blocks rider via API → /api/admin/users/:id shows isActive: false",
    async ({ request }) => {
      const rider = await seedTestRider(request);
      test.skip(
        !rider,
        "No test rider found — seed a rider with phone 03199999001 to run this test"
      );

      const riderId = rider!.id;

      try {
        const blocked = await adminBlockRiderViaApi(request, riderId);
        expect(blocked).toBe(true);

        const res = await request.get(`${BASE_URL}/api/admin/users/${riderId}`, {
          headers: { "x-e2e-test": "1" },
        });
        expect(res.ok()).toBe(true);

        const body = await res.json();
        const userData = body?.data ?? body?.user ?? body;
        const isActive =
          userData?.isActive ?? userData?.user?.isActive;

        expect(isActive).toBe(false);
      } finally {
        await cleanupTestRider(request, riderId);
      }
    }
  );

  // ── 3: Blocked session → rider app stays off home screen ─────────────────
  test(
    "rider app does not show home screen when /api/rider/me returns 403 blocked",
    async ({ page }) => {
      await page.route("**/api/rider/me", async (route) => {
        await route.fulfill({
          status: 403,
          contentType: "application/json",
          body: JSON.stringify({
            success: false,
            message: "Account has been suspended",
            code: "ACCOUNT_SUSPENDED",
            blocked: false,
          }),
        });
      });
      await page.route("**/api/auth/me", async (route) => {
        await route.fulfill({
          status: 403,
          contentType: "application/json",
          body: JSON.stringify({
            success: false,
            message: "Account has been suspended",
            blocked: false,
          }),
        });
      });
      await page.route("**/api/auth/refresh", async (route) => {
        await route.fulfill({
          status: 403,
          contentType: "application/json",
          body: JSON.stringify({ success: false, message: "Account suspended" }),
        });
      });

      await page.addInitScript(() => {
        localStorage.setItem("ajkmart_rider_token", "e2e-fake-blocked-token");
        localStorage.setItem("ajkmart_rider_refresh_token", "e2e-fake-blocked-refresh");
      });

      await page.goto("/rider");
      await page.waitForLoadState("domcontentloaded");
      await page.waitForTimeout(3500);

      const onlineToggle = page
        .locator("[role='switch'], button")
        .filter({ hasText: /go online|online|offline/i })
        .first();
      const onlineVisible = await onlineToggle.isVisible({ timeout: 2_000 }).catch(() => false);
      expect(onlineVisible).toBe(false);

      const isOnLoginPage = page.url().includes("/login");
      const loginScreen = page
        .locator("text=Deliver with AJKMart")
        .first();
      const loginVisible = await loginScreen.isVisible({ timeout: 5_000 }).catch(() => false);

      expect(isOnLoginPage || loginVisible).toBe(true);
    }
  );

  // ── 4: Active rider stays on home screen ─────────────────────────────────
  test(
    "rider app home screen accessible when account is active",
    async ({ page }) => {
      await page.route("**/api/rider/me", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            data: {
              id: "e2e-rider-active",
              name: "Active Rider",
              phone: "03199999004",
              role: "rider",
              isActive: true,
              isBanned: false,
              isKycVerified: true,
              vehicleType: "bike",
              vehiclePlate: "E2E-004",
              rating: 4.7,
              totalRides: 50,
            },
          }),
        });
      });
      await mockRiderAuth(page);

      await page.goto("/rider");
      await page.waitForLoadState("networkidle");

      const homeContent = page
        .locator("main, [class*='home'], [class*='dashboard'], [class*='content']")
        .first();
      await expect(homeContent).toBeVisible({ timeout: 15_000 });

      const isOnLoginPage = page.url().includes("/login");
      expect(isOnLoginPage).toBe(false);
    }
  );

  // ── 5: Admin UI exposes block action in rider detail panel ────────────────
  test(
    "admin riders list shows block/suspend action in rider detail panel",
    async ({ page }) => {
      await page.goto("/admin/riders");
      await page.waitForLoadState("domcontentloaded");
      await page.waitForTimeout(2000);

      const rows = page.locator("tbody tr, [role='row']:not([role='columnheader'])");
      const count = await rows.count();
      if (count === 0) {
        test.skip();
        return;
      }

      await rows.first().click();
      await page.waitForTimeout(800);

      const panel = page
        .locator("[role='dialog'], [data-state='open'], [class*='sheet'], [class*='modal']")
        .first();
      await expect(panel).toBeVisible({ timeout: 8_000 });

      const blockAction = panel
        .locator("button, [role='menuitem'], [role='button']")
        .filter({ hasText: /block|suspend|restrict|ban/i })
        .first();
      await expect(blockAction).toBeVisible({ timeout: 5_000 });
    }
  );
});
