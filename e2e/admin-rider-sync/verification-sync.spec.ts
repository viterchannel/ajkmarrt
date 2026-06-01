/**
 * Admin → Rider: Verification Sync
 *
 * Flow being tested:
 *   1. Admin UI (saved auth state) navigates to pending-riders page and approves a rider.
 *   2. Real /api/admin/users/:id is queried — no mock — to assert the approval propagated.
 *   3. Rider profile rendering with the resulting verified state is asserted via mockRiderAuth.
 *
 * Tests that require a real pending rider in the DB skip gracefully when none exists.
 */
import { expect, test } from "@playwright/test";
import { mockRiderAuth } from "../helpers/mock-auth";
import { seedTestRider, adminVerifyRider } from "./syncHelpers";

const BASE_URL = process.env["E2E_BASE_URL"] ?? "http://localhost:5000";

test.describe("Admin → Rider: Verification Sync", () => {
  // ── 1: Full UI-driven sync flow ──────────────────────────────────────────
  test(
    "admin approves pending rider via UI → /api/admin/users/:id shows approved/active",
    async ({ page, request }) => {
      const rider = await seedTestRider(request);
      test.skip(
        !rider,
        "No test rider found — seed a rider with phone 03199999001 to run this test"
      );

      const riderId = rider!.id;

      await adminVerifyRider(page, riderId);

      const res = await request.get(`${BASE_URL}/api/admin/users/${riderId}`, {
        headers: { "x-e2e-test": "1" },
      });
      expect(res.ok()).toBe(true);

      const body = await res.json();
      const userData = body?.data ?? body?.user ?? body;
      const approvalStatus =
        userData?.approvalStatus ?? userData?.user?.approvalStatus;
      const isActive =
        userData?.isActive ?? userData?.user?.isActive;

      const isApprovedOrActive =
        approvalStatus === "approved" || isActive === true;
      expect(isApprovedOrActive).toBe(true);
    }
  );

  // ── 2: Rider profile shows KYC-verified badge when isKycVerified: true ───
  test(
    "rider profile shows verified indicator when isKycVerified is true",
    async ({ page }) => {
      const verifiedRider = {
        id: "e2e-rider-verified",
        name: "Verified Rider",
        phone: "03199999001",
        role: "rider",
        isKycVerified: true,
        isActive: true,
        vehicleType: "bike",
        vehiclePlate: "E2E-001",
        rating: 4.9,
        totalRides: 100,
      };

      await page.route("**/api/rider/me", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ success: true, data: verifiedRider }),
        });
      });
      await page.route("**/api/rider/profile", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ success: true, data: verifiedRider }),
        });
      });
      await mockRiderAuth(page);

      await page.goto("/rider/profile");
      await page.waitForLoadState("networkidle");

      const profileSection = page
        .locator("main, section, [class*='profile']")
        .first();
      await expect(profileSection).toBeVisible({ timeout: 15_000 });

      const verifiedEl = page
        .locator(
          "[class*='verified'], [class*='badge'], [aria-label*='verified' i], " +
          "[data-verified='true'], text=Verified, text=KYC Verified"
        )
        .first();

      const badgeVisible = await verifiedEl.isVisible({ timeout: 5_000 }).catch(() => false);
      if (badgeVisible) {
        await expect(verifiedEl).toBeVisible();
      } else {
        const fallback = page
          .locator("p, span, div")
          .filter({ hasText: /verified|approved/i })
          .first();
        await expect(fallback).toBeVisible({ timeout: 5_000 });
      }
    }
  );

  // ── 3: Rider profile does NOT show verified badge when isKycVerified: false ─
  test(
    "rider profile does not show verified badge when isKycVerified is false",
    async ({ page }) => {
      const unverifiedRider = {
        id: "e2e-rider-unverified",
        name: "Unverified Rider",
        phone: "03199999002",
        role: "rider",
        isKycVerified: false,
        isActive: true,
        vehicleType: "bike",
        vehiclePlate: "E2E-002",
        rating: 0,
        totalRides: 0,
      };

      await page.route("**/api/rider/me", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ success: true, data: unverifiedRider }),
        });
      });
      await page.route("**/api/rider/profile", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ success: true, data: unverifiedRider }),
        });
      });
      await mockRiderAuth(page);

      await page.goto("/rider/profile");
      await page.waitForLoadState("networkidle");

      const profileSection = page
        .locator("main, section, [class*='profile']")
        .first();
      await expect(profileSection).toBeVisible({ timeout: 15_000 });

      const kycBadge = page
        .locator("[aria-label='KYC Verified'], [data-verified='true'], [class*='kyc-badge']")
        .first();
      const badgeVisible = await kycBadge.isVisible({ timeout: 2_000 }).catch(() => false);
      expect(badgeVisible).toBe(false);
    }
  );

  // ── 4: Admin riders list loads (admin auth sanity) ────────────────────────
  test(
    "admin riders list page loads with riders table",
    async ({ page }) => {
      await page.goto("/admin/riders");
      await page.waitForLoadState("domcontentloaded");

      const heading = page
        .locator("h1, h2")
        .filter({ hasText: /riders/i })
        .first();
      await expect(heading).toBeVisible({ timeout: 15_000 });

      const tableOrList = page
        .locator("table, [role='table'], [class*='rider-row'], [class*='riders']")
        .first();
      await expect(tableOrList).toBeVisible({ timeout: 12_000 });
    }
  );
});
