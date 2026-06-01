import { db, featureRulesTable, popularLocationsTable, rideServiceTypesTable, verificationBonusesTable } from "@workspace/db";
import { count, eq, and } from "drizzle-orm";
import { logger } from "./logger.js";

/* ── DEFAULT RIDE SERVICES ───────────────────────────────────────────────── */

const DEFAULT_RIDE_SERVICES = [
  { id: "bike", name: "Bike", icon: "bicycle-outline", baseFare: "30", perKm: "10" },
  { id: "car", name: "Car", icon: "car-outline", baseFare: "80", perKm: "20" },
  { id: "rickshaw", name: "Rickshaw", icon: "car-sport-outline", baseFare: "50", perKm: "12" },
];

/* ── DEFAULT POPULAR LOCATIONS ───────────────────────────────────────────── */

const DEFAULT_LOCATIONS = [
  {
    name: "Muzaffarabad Chowk",
    nameUrdu: "مظفرآباد چوک",
    lat: 34.3697,
    lng: 73.4716,
    category: "chowk",
    icon: "🏙️",
    sortOrder: 1,
  },
  {
    name: "Kohala Bridge",
    nameUrdu: "کوہالہ پل",
    lat: 34.2021,
    lng: 73.3791,
    category: "landmark",
    icon: "🌉",
    sortOrder: 2,
  },
  {
    name: "Mirpur City Centre",
    nameUrdu: "میرپور سٹی سینٹر",
    lat: 33.1413,
    lng: 73.7508,
    category: "chowk",
    icon: "🏙️",
    sortOrder: 3,
  },
  {
    name: "Rawalakot Bazar",
    nameUrdu: "راولاکوٹ بازار",
    lat: 33.8572,
    lng: 73.7613,
    category: "bazar",
    icon: "🛍️",
    sortOrder: 4,
  },
  {
    name: "Bagh City",
    nameUrdu: "باغ شہر",
    lat: 33.9732,
    lng: 73.7729,
    category: "general",
    icon: "🌆",
    sortOrder: 5,
  },
  {
    name: "Kotli Main Chowk",
    nameUrdu: "کوٹلی مین چوک",
    lat: 33.5152,
    lng: 73.9019,
    category: "chowk",
    icon: "🏙️",
    sortOrder: 6,
  },
  {
    name: "Poonch City",
    nameUrdu: "پونچھ شہر",
    lat: 33.77,
    lng: 74.0954,
    category: "general",
    icon: "🌆",
    sortOrder: 7,
  },
  {
    name: "Neelum Valley",
    nameUrdu: "نیلم ویلی",
    lat: 34.5689,
    lng: 73.8765,
    category: "landmark",
    icon: "🏔️",
    sortOrder: 8,
  },
  {
    name: "AJK University",
    nameUrdu: "یونیورسٹی آف آزاد کشمیر",
    lat: 34.3601,
    lng: 73.5088,
    category: "school",
    icon: "🎓",
    sortOrder: 9,
  },
  {
    name: "District Headquarters Hospital",
    nameUrdu: "ضلعی ہیڈکوارٹر ہسپتال",
    lat: 34.3712,
    lng: 73.473,
    category: "hospital",
    icon: "🏥",
    sortOrder: 10,
  },
  {
    name: "Muzaffarabad Bus Stand",
    nameUrdu: "مظفرآباد بس اڈہ",
    lat: 34.3664,
    lng: 73.4726,
    category: "landmark",
    icon: "🚏",
    sortOrder: 11,
  },
  {
    name: "Hattian Bala",
    nameUrdu: "ہٹیاں بالا",
    lat: 34.0949,
    lng: 73.8185,
    category: "general",
    icon: "🌆",
    sortOrder: 12,
  },
];

/* ── DEFAULT FEATURE RULES ───────────────────────────────────────────────── */

const DEFAULT_FEATURE_RULES = [
  { role: "customer", featureName: "order_grocery",    requiredVerifications: [] as string[],                              maxDailyLimit: 0, fallbackMsg: null },
  { role: "customer", featureName: "ride_booking",     requiredVerifications: ["phone_verified"],                          maxDailyLimit: 0, fallbackMsg: null },
  { role: "customer", featureName: "wallet_topup",     requiredVerifications: ["phone_verified"],                          maxDailyLimit: 0, fallbackMsg: null },
  { role: "rider",    featureName: "view_earnings",    requiredVerifications: ["phone_verified"],                          maxDailyLimit: 0, fallbackMsg: null },
  { role: "rider",    featureName: "accept_ride",      requiredVerifications: ["phone_verified", "documents_approved"],    maxDailyLimit: 0, fallbackMsg: "Verify phone & upload documents to accept rides" },
  { role: "vendor",   featureName: "create_menu_item", requiredVerifications: ["phone_verified", "documents_approved"],   maxDailyLimit: 0, fallbackMsg: null },
  { role: "vendor",   featureName: "add_product",      requiredVerifications: ["documents_approved"],                      maxDailyLimit: 0, fallbackMsg: null },
];

/* ── KYC FEATURE RULES — upserted every startup ─────────────────────────── */

const KYC_FEATURE_RULES = [
  { role: "customer", featureName: "withdraw_money", requiredVerifications: ["phone_verified", "documents_approved"], fallbackMsg: "Verify phone & upload documents to enable withdrawals", maxDailyLimit: 0 },
  { role: "rider",    featureName: "withdraw_money", requiredVerifications: ["phone_verified", "documents_approved"], fallbackMsg: "Verify phone & upload documents to enable withdrawals", maxDailyLimit: 0 },
  { role: "vendor",   featureName: "withdraw_money", requiredVerifications: ["phone_verified", "documents_approved"], fallbackMsg: "Verify phone & upload documents to enable withdrawals", maxDailyLimit: 0 },
  { role: "rider",    featureName: "accept_ride",    requiredVerifications: ["phone_verified", "documents_approved"], fallbackMsg: "Verify phone & upload documents to accept rides",       maxDailyLimit: 0 },
  { role: "vendor",   featureName: "add_product",    requiredVerifications: ["documents_approved"],                   fallbackMsg: null,                                                   maxDailyLimit: 0 },
];

/* ── DEFAULT VERIFICATION BONUSES ────────────────────────────────────────── */

const DEFAULT_VERIFICATION_BONUSES = [
  { verificationType: "email",     bonusAmount: "0",     bonusType: "coins", isActive: false },
  { verificationType: "phone",     bonusAmount: "20.00", bonusType: "coins", isActive: true },
  { verificationType: "documents", bonusAmount: "0",     bonusType: "coins", isActive: false },
];

/* ── SEED GUARDS ─────────────────────────────────────────────────────────── */

let _rideServicesSeedInProgress = false;
let _locationsSeedInProgress = false;
let _featureRulesSeedInProgress = false;
let _verificationBonusesSeedInProgress = false;
let _kycRulesSeedInProgress = false;

export async function ensureDefaultRideServices(): Promise<void> {
  if (_rideServicesSeedInProgress) return;
  _rideServicesSeedInProgress = true;
  try {
    const [row] = await db.select({ c: count() }).from(rideServiceTypesTable);
    if ((row?.c ?? 0) > 0) return;
    await db
      .insert(rideServiceTypesTable)
      .values(
        DEFAULT_RIDE_SERVICES.map((s, idx) => ({
          id: `svc_${s.id}`,
          key: s.id,
          name: s.name,
          icon: s.icon,
          baseFare: s.baseFare,
          perKm: s.perKm,
          minFare: "50",
          isEnabled: true,
          isCustom: false,
          allowBargaining: true,
          sortOrder: idx + 1,
        }))
      )
      .onConflictDoNothing();
  } catch (err) {
    logger.error({ err }, "[seedDefaults] ensureDefaultRideServices failed");
  } finally {
    _rideServicesSeedInProgress = false;
  }
}

export async function ensureDefaultLocations(): Promise<void> {
  if (_locationsSeedInProgress) return;
  _locationsSeedInProgress = true;
  try {
    const [row] = await db.select({ c: count() }).from(popularLocationsTable);
    if ((row?.c ?? 0) > 0) return;
    await db
      .insert(popularLocationsTable)
      .values(
        DEFAULT_LOCATIONS.map((l) => ({
          id: `loc_${l.name.toLowerCase().replace(/[^a-z0-9]/g, "_")}`,
          name: l.name,
          nameUrdu: l.nameUrdu,
          lat: l.lat.toFixed(6),
          lng: l.lng.toFixed(6),
          category: l.category,
          icon: l.icon,
          isActive: true,
          sortOrder: l.sortOrder,
        }))
      )
      .onConflictDoNothing();
  } catch (err) {
    logger.error({ err }, "[seedDefaults] ensureDefaultLocations failed");
  } finally {
    _locationsSeedInProgress = false;
  }
}

export async function ensureDefaultFeatureRules(): Promise<void> {
  if (_featureRulesSeedInProgress) return;
  _featureRulesSeedInProgress = true;
  try {
    const [row] = await db.select({ c: count() }).from(featureRulesTable);
    if ((row?.c ?? 0) > 0) return;
    await db
      .insert(featureRulesTable)
      .values(
        DEFAULT_FEATURE_RULES.map((r) => ({
          role: r.role,
          featureName: r.featureName,
          requiredVerifications: r.requiredVerifications,
          maxDailyLimit: r.maxDailyLimit,
          fallbackMsg: r.fallbackMsg ?? null,
          isActive: true,
        }))
      )
      .onConflictDoNothing();
  } catch (err) {
    logger.error({ err }, "[seedDefaults] ensureDefaultFeatureRules failed");
  } finally {
    _featureRulesSeedInProgress = false;
  }
}

export async function ensureDefaultVerificationBonuses(): Promise<void> {
  if (_verificationBonusesSeedInProgress) return;
  _verificationBonusesSeedInProgress = true;
  try {
    const [row] = await db.select({ c: count() }).from(verificationBonusesTable);
    if ((row?.c ?? 0) > 0) return;
    await db
      .insert(verificationBonusesTable)
      .values(DEFAULT_VERIFICATION_BONUSES)
      .onConflictDoNothing();
  } catch (err) {
    logger.error({ err }, "[seedDefaults] ensureDefaultVerificationBonuses failed");
  } finally {
    _verificationBonusesSeedInProgress = false;
  }
}

/**
 * Idempotent upsert of KYC-gated feature rules and phone verification bonus.
 * Run every startup to ensure correct state regardless of prior seed data.
 *
 * Feature gates enforced:
 *   - withdraw_money (customer/rider/vendor): phone_verified + documents_approved
 *   - accept_ride (rider): documents_approved only
 *
 * Verification bonus:
 *   - phone → PKR 20.00 wallet credit (awarded automatically on phone verify)
 */
export async function upsertKycFeatureRulesAndBonus(): Promise<void> {
  if (_kycRulesSeedInProgress) return;
  _kycRulesSeedInProgress = true;
  try {
    for (const rule of KYC_FEATURE_RULES) {
      const [existing] = await db
        .select({ id: featureRulesTable.id })
        .from(featureRulesTable)
        .where(
          and(
            eq(featureRulesTable.featureName, rule.featureName),
            eq(featureRulesTable.role, rule.role)
          )
        )
        .limit(1);

      if (existing) {
        await db
          .update(featureRulesTable)
          .set({
            requiredVerifications: rule.requiredVerifications,
            fallbackMsg: rule.fallbackMsg ?? null,
            maxDailyLimit: (rule as { maxDailyLimit?: number }).maxDailyLimit ?? 0,
            isActive: true,
          })
          .where(eq(featureRulesTable.id, existing.id));
      } else {
        await db
          .insert(featureRulesTable)
          .values({
            role: rule.role,
            featureName: rule.featureName,
            requiredVerifications: rule.requiredVerifications,
            fallbackMsg: rule.fallbackMsg ?? null,
            maxDailyLimit: (rule as { maxDailyLimit?: number }).maxDailyLimit ?? 0,
            isActive: true,
          })
          .onConflictDoNothing();
      }
    }
    logger.info("[seedDefaults] KYC feature rules upserted");

    const [phoneBonus] = await db
      .select({ id: verificationBonusesTable.id })
      .from(verificationBonusesTable)
      .where(eq(verificationBonusesTable.verificationType, "phone"))
      .limit(1);

    if (phoneBonus) {
      await db
        .update(verificationBonusesTable)
        .set({ bonusAmount: "20.00", isActive: true })
        .where(eq(verificationBonusesTable.id, phoneBonus.id));
    } else {
      await db
        .insert(verificationBonusesTable)
        .values({ verificationType: "phone", bonusAmount: "20.00", isActive: true })
        .onConflictDoNothing();
    }
    logger.info("[seedDefaults] Phone verification bonus upserted (PKR 20.00)");

    for (const vType of ["email", "documents"] as const) {
      const [existing] = await db
        .select({ id: verificationBonusesTable.id })
        .from(verificationBonusesTable)
        .where(eq(verificationBonusesTable.verificationType, vType))
        .limit(1);
      if (existing) {
        await db
          .update(verificationBonusesTable)
          .set({ bonusAmount: "0", isActive: false })
          .where(eq(verificationBonusesTable.id, existing.id));
      } else {
        await db
          .insert(verificationBonusesTable)
          .values({ verificationType: vType, bonusAmount: "0", isActive: false })
          .onConflictDoNothing();
      }
    }
    logger.info("[seedDefaults] Email + documents verification bonuses set inactive (per spec)");
  } catch (err) {
    logger.error({ err }, "[seedDefaults] upsertKycFeatureRulesAndBonus failed (non-fatal)");
  } finally {
    _kycRulesSeedInProgress = false;
  }
}
