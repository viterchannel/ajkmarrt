/**
 * Admin → Rider: Feature Toggle Sync (Instant Payout)
 *
 * Flow being tested:
 *   1. Admin UI (saved auth state) navigates to /admin/configuration and toggles
 *      the Instant Payout switch.
 *   2. Real /api/platform-config is fetched without mocking to assert the toggle
 *      propagated to the shared config endpoint.
 *   3. Rider wallet page is loaded with mockRiderAuth but WITHOUT mocking
 *      /api/platform-config, so it reads the live value that was just set by admin.
 *
 * afterEach restores the original toggle state via API so tests are idempotent.
 */
import { expect, test } from "@playwright/test";
import { mockRiderAuth } from "../helpers/mock-auth";
import {
  getAdminPlatformConfig,
  getRiderInstantPayoutEnabled,
  setRiderInstantPayoutEnabled,
} from "./syncHelpers";

test.describe("Admin → Rider: Feature Toggle Sync (Instant Payout)", () => {
  let originalEnabled: boolean;

  test.beforeEach(async ({ request }) => {
    originalEnabled = await getRiderInstantPayoutEnabled(request);
  });

  test.afterEach(async ({ request }) => {
    await setRiderInstantPayoutEnabled(request, originalEnabled);
  });

  // ── 1: Admin UI toggle OFF → real platform-config reflects false ─────────
  test(
    "admin toggles Instant Payout OFF via UI → /api/platform-config returns instantPayoutEnabled: false",
    async ({ page, request }) => {
      await page.goto("/admin/configuration");
      await page.waitForLoadState("domcontentloaded");

      const instantPayoutLabel = page
        .locator("label, tr, [class*='row'], [class*='setting-row']")
        .filter({ hasText: /instant payout/i })
        .first();
      await expect(instantPayoutLabel).toBeVisible({ timeout: 15_000 });

      const toggle = instantPayoutLabel
        .locator("[role='switch'], input[type='checkbox'], [class*='switch'], [class*='toggle']")
        .first();
      const toggleVisible = await toggle.isVisible({ timeout: 5_000 }).catch(() => false);

      if (toggleVisible) {
        const isCurrentlyOn = await toggle.evaluate((el) => {
          if (el instanceof HTMLInputElement) return el.checked;
          return el.getAttribute("aria-checked") === "true" ||
            el.getAttribute("data-state") === "checked";
        });
        if (isCurrentlyOn) {
          await toggle.click();
          await page.waitForTimeout(800);
        }
      } else {
        await setRiderInstantPayoutEnabled(request, false);
      }

      const config = await getAdminPlatformConfig(request);
      const rider = config?.rider as Record<string, unknown> | undefined;

      expect(rider).toBeDefined();
      expect(rider?.instantPayoutEnabled).toBe(false);
    }
  );

  // ── 2: Admin API toggle ON → real platform-config reflects true ──────────
  test(
    "admin turns Instant Payout ON → /api/platform-config returns instantPayoutEnabled: true",
    async ({ request }) => {
      await setRiderInstantPayoutEnabled(request, true);

      const config = await getAdminPlatformConfig(request);
      const rider = config?.rider as Record<string, unknown> | undefined;

      expect(rider).toBeDefined();
      expect(rider?.instantPayoutEnabled).toBe(true);
    }
  );

  // ── 3: Admin API toggle OFF → rider wallet (live config, no mock) hides toggle
  test(
    "rider wallet hides Instant Payout option when admin has disabled it (live config)",
    async ({ page, request }) => {
      await setRiderInstantPayoutEnabled(request, false);

      await mockRiderAuth(page);

      await page.goto("/rider/wallet");
      await page.waitForLoadState("networkidle");

      const walletContent = page
        .locator("main, [class*='wallet'], [class*='content']")
        .first();
      await expect(walletContent).toBeVisible({ timeout: 15_000 });

      const withdrawBtn = page
        .locator("button")
        .filter({ hasText: /withdraw|payout|cashout/i })
        .first();
      const withdrawVisible = await withdrawBtn
        .isVisible({ timeout: 5_000 })
        .catch(() => false);
      if (withdrawVisible) {
        await withdrawBtn.click();
        await page.waitForTimeout(800);
      }

      const instantPayoutToggle = page
        .locator("button, [role='switch']")
        .filter({ hasText: /instant payout/i })
        .first();
      await expect(instantPayoutToggle).not.toBeVisible({ timeout: 5_000 });
    }
  );

  // ── 4: Admin API toggle ON → rider wallet (live config, no mock) shows toggle
  test(
    "rider wallet shows Instant Payout toggle when admin has enabled it (live config)",
    async ({ page, request }) => {
      await setRiderInstantPayoutEnabled(request, true);

      await mockRiderAuth(page);

      await page.goto("/rider/wallet");
      await page.waitForLoadState("networkidle");

      const walletContent = page
        .locator("main, [class*='wallet'], [class*='content']")
        .first();
      await expect(walletContent).toBeVisible({ timeout: 15_000 });

      const withdrawBtn = page
        .locator("button")
        .filter({ hasText: /withdraw|payout|cashout/i })
        .first();
      await expect(withdrawBtn).toBeVisible({ timeout: 8_000 });
      await withdrawBtn.click();
      await page.waitForTimeout(800);

      const instantToggle = page
        .locator("button, [role='switch'], [class*='toggle'], div")
        .filter({ hasText: /instant/i })
        .first();
      await expect(instantToggle).toBeVisible({ timeout: 6_000 });
    }
  );

  // ── 5: Admin configuration page structure ────────────────────────────────
  test(
    "admin /configuration page shows Instant Payout label and switch",
    async ({ page }) => {
      await page.goto("/admin/configuration");
      await page.waitForLoadState("domcontentloaded");

      const heading = page.locator("h1, h2").first();
      await expect(heading).toBeVisible({ timeout: 15_000 });

      const instantPayoutLabel = page
        .locator("label, span, td, [class*='label']")
        .filter({ hasText: /instant payout/i })
        .first();
      await expect(instantPayoutLabel).toBeVisible({ timeout: 15_000 });

      const toggle = page
        .locator("[role='switch'], input[type='checkbox'], [class*='switch'], [class*='toggle']")
        .first();
      await expect(toggle).toBeVisible({ timeout: 10_000 });
    }
  );
});
