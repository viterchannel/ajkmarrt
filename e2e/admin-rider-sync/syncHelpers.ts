/**
 * Shared helpers for admin-rider-sync E2E specs.
 *
 * All API calls use the admin credentials from the saved storageState.
 * The `request` fixture in the admin-rider-sync project inherits that state.
 */
import type { APIRequestContext, Page } from "@playwright/test";

export const BASE_URL = process.env["E2E_BASE_URL"] ?? "http://localhost:5000";
export const E2E_RIDER_PHONE = "03199999001";
export const E2E_RIDER_NAME = "E2E Test Rider";
export const E2E_RIDER_TEMP_PASSWORD = "TestRider@E2E1";

export type TestRider = {
  id: string;
  phone: string;
  name: string;
  isActive: boolean;
  approvalStatus?: string;
  createdByTest?: boolean;
};

/**
 * Find the test rider by phone via admin users list.
 * Checks GET /api/admin/users?search=<phone>&role=rider.
 */
async function findTestRider(request: APIRequestContext): Promise<TestRider | null> {
  const res = await request.get(`${BASE_URL}/api/admin/users`, {
    params: { role: "rider", search: E2E_RIDER_PHONE, limit: "10" },
    headers: { "x-e2e-test": "1" },
  });
  if (!res.ok()) return null;

  const body = await res.json();
  const users: TestRider[] = body?.data?.users ?? body?.data ?? [];
  if (!Array.isArray(users) || users.length === 0) return null;

  return (
    users.find((u) => u.phone === E2E_RIDER_PHONE) ??
    users[0] ??
    null
  );
}

/**
 * Create-or-fetch deterministic test rider via admin API.
 * Returns the rider object. Never returns null — throws on failure.
 */
export async function seedTestRider(request: APIRequestContext): Promise<TestRider> {
  const existing = await findTestRider(request);
  if (existing) return existing;

  const createRes = await request.post(`${BASE_URL}/api/admin/users`, {
    data: {
      phone: E2E_RIDER_PHONE,
      name: E2E_RIDER_NAME,
      role: "rider",
      tempPassword: E2E_RIDER_TEMP_PASSWORD,
    },
    headers: { "x-e2e-test": "1" },
  });

  if (!createRes.ok()) {
    const body = await createRes.json().catch(() => ({}));
    if (
      createRes.status() === 409 ||
      JSON.stringify(body).toLowerCase().includes("already exists")
    ) {
      const refetch = await findTestRider(request);
      if (refetch) return { ...refetch, createdByTest: false };
    }
    throw new Error(
      `seedTestRider: failed to create rider — HTTP ${createRes.status()}: ${JSON.stringify(body)}`
    );
  }

  const body = await createRes.json();
  const created = body?.data?.user ?? body?.data ?? body?.user;
  if (!created?.id) throw new Error("seedTestRider: create returned no user object");

  return { ...created, createdByTest: true };
}

/**
 * Approve a rider via the admin approval API.
 * Returns true on success or if already approved (idempotent).
 */
export async function adminApproveRiderViaApi(
  request: APIRequestContext,
  riderId: string
): Promise<boolean> {
  const res = await request.patch(
    `${BASE_URL}/api/admin/riders/${riderId}/approval`,
    {
      data: { status: "approved" },
      headers: { "x-e2e-test": "1" },
    }
  );
  return res.status() === 200 || res.status() === 409;
}

/**
 * Block a rider via PATCH /api/admin/users/:id { isActive: false }.
 */
export async function adminBlockRiderViaApi(
  request: APIRequestContext,
  riderId: string
): Promise<boolean> {
  const res = await request.patch(`${BASE_URL}/api/admin/users/${riderId}`, {
    data: { isActive: false },
    headers: { "x-e2e-test": "1" },
  });
  return res.ok();
}

/**
 * Restore a blocked/mutated rider to active state.
 */
export async function cleanupTestRider(
  request: APIRequestContext,
  riderId: string
): Promise<void> {
  await request.patch(`${BASE_URL}/api/admin/users/${riderId}`, {
    data: { isActive: true },
    headers: { "x-e2e-test": "1" },
  });
}

/**
 * Fetch the rider from the admin users list to get fresh field values.
 * Returns the user record or null if not found.
 */
export async function getAdminRiderRecord(
  request: APIRequestContext,
  phone: string
): Promise<TestRider | null> {
  const res = await request.get(`${BASE_URL}/api/admin/users`, {
    params: { role: "rider", search: phone, limit: "10" },
    headers: { "x-e2e-test": "1" },
  });
  if (!res.ok()) return null;

  const body = await res.json();
  const users: TestRider[] = body?.data?.users ?? body?.data ?? [];
  return Array.isArray(users)
    ? (users.find((u) => u.phone === phone) ?? users[0] ?? null)
    : null;
}

/**
 * Navigate to /admin/pending-riders and click the Approve button for a rider
 * identified by their table row (first visible pending row used as fallback).
 */
export async function adminVerifyRiderViaUi(page: Page, riderId: string): Promise<void> {
  await page.goto("/admin/pending-riders");
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(2000);

  const riderRow = page
    .locator(`[data-id="${riderId}"], [data-user-id="${riderId}"]`)
    .first();
  const rowVisible = await riderRow.isVisible({ timeout: 3_000 }).catch(() => false);

  const scope = rowVisible ? riderRow : page;
  const approveBtn = scope
    .locator("button, [role='menuitem']")
    .filter({ hasText: /approve|verify/i })
    .first();

  if (await approveBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await approveBtn.click();
    await page.waitForTimeout(1000);
  }
}

/**
 * Navigate to the admin rider detail panel and click the Block/Suspend action.
 */
export async function adminBlockRiderViaUi(page: Page, riderId: string): Promise<void> {
  await page.goto(`/admin/riders?id=${riderId}`);
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(2000);

  const actionsBtn = page
    .locator("button")
    .filter({ hasText: /actions|more|options/i })
    .first();
  if (await actionsBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await actionsBtn.click();
    await page.waitForTimeout(500);
  }

  const blockBtn = page
    .locator("button, [role='menuitem'], [role='option']")
    .filter({ hasText: /block|suspend|restrict/i })
    .first();
  if (await blockBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await blockBtn.click();
    await page.waitForTimeout(500);
    const confirmBtn = page
      .locator("button")
      .filter({ hasText: /confirm|yes|block|suspend/i })
      .first();
    if (await confirmBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await confirmBtn.click();
      await page.waitForTimeout(1000);
    }
  }
}

/**
 * Fetch the public /api/platform-config from the API server.
 */
export async function getAdminPlatformConfig(
  request: APIRequestContext
): Promise<Record<string, unknown>> {
  const res = await request.get(`${BASE_URL}/api/platform-config`, {
    headers: { "x-e2e-test": "1" },
  });
  if (!res.ok()) return {};
  return res.json();
}

/**
 * Read whether rider_instant_payout_enabled is currently on.
 */
export async function getRiderInstantPayoutEnabled(
  request: APIRequestContext
): Promise<boolean> {
  const config = await getAdminPlatformConfig(request);
  const rider = config?.rider as Record<string, unknown> | undefined;
  return rider?.instantPayoutEnabled === true;
}

/**
 * Set rider_instant_payout_enabled via admin platform-settings.
 * Route schema: PUT /api/admin/platform-settings { settings: [{ key, value }] }
 */
export async function setRiderInstantPayoutEnabled(
  request: APIRequestContext,
  enabled: boolean
): Promise<void> {
  await request.put(`${BASE_URL}/api/admin/platform-settings`, {
    data: {
      settings: [{ key: "rider_instant_payout_enabled", value: enabled ? "on" : "off" }],
    },
    headers: { "x-e2e-test": "1" },
  });
}
