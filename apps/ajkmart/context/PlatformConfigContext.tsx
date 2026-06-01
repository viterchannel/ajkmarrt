import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";

import { API_BASE } from "@/utils/api";

const CACHE_MS = 30_000;
const ASYNC_STORAGE_KEY = "ajkmart_platform_config";

export interface PlatformConfig {
  appStatus: "active" | "maintenance" | "limited" | "down";
  features: {
    mart: boolean;
    food: boolean;
    rides: boolean;
    pharmacy: boolean;
    parcel: boolean;
    van?: boolean;
    school?: boolean;
    wallet: boolean;
    referral: boolean;
    newUsers: boolean;
    chat: boolean;
    liveTracking: boolean;
    reviews: boolean;
    sos: boolean;
    [key: string]: boolean | undefined;
  };
  content: {
    trackerBannerEnabled: boolean;
    trackerBannerPosition: "top" | "bottom";
    showBanner: boolean;
    banner: string;
    announcement: string;
    maintenanceMsg: string;
    supportMsg: string;
    vendorNotice: string;
    riderNotice: string;
    tncUrl: string;
    privacyUrl: string;
    refundPolicyUrl: string;
    faqUrl: string;
    aboutUrl: string;
  };
  platform: {
    appName: string;
    appTagline: string;
    appVersion: string;
    minAppVersion: string;
    supportPhone: string;
    supportEmail: string;
    supportHours: string;
    businessAddress: string;
    socialFacebook: string;
    socialInstagram: string;
    supportContact?: string;
  };
  orderRules: {
    minOrderAmount: number;
    maxCodAmount: number;
    maxCartValue: number;
    cancelWindowMin: number;
    autoCancelMin: number;
    refundDays: number;
    preptimeMin: number;
    ratingWindowHours: number;
    scheduleEnabled: boolean;
    serviceableCities: string[];
  };
  deliveryFee: {
    mart: number;
    food: number;
    pharmacy: number;
    parcel: number;
    parcelPerKg: number;
    freeEnabled: boolean;
    freeDeliveryAbove: number;
  };
  parcelFares: Record<string, number>;
  rides: {
    bikeBaseFare: number;
    bikePerKm: number;
    bikeMinFare: number;
    carBaseFare: number;
    carPerKm: number;
    carMinFare: number;
    surgeEnabled: boolean;
    surgeMultiplier: number;
    cancellationFee: number;
    bargainingEnabled: boolean;
    bargainingMinPct: number;
    bargainingMaxRounds: number;
    riderEarningPct: number;
  };
  finance: {
    gstEnabled: boolean;
    gstPct: number;
    cashbackEnabled: boolean;
    cashbackPct: number;
    cashbackMaxRs: number;
    invoiceEnabled: boolean;
    platformCommissionPct: number;
    vendorCommissionPct: number;
    riderEarningPct: number;
    minVendorPayout: number;
    minRiderPayout: number;
    vendorSettleDays: number;
    referralBonus: number;
  };
  customer: {
    walletMax: number;
    minTopup: number;
    maxTopup: number;
    minWithdrawal: number;
    maxWithdrawal: number;
    minTransfer: number;
    maxTransfer: number;
    dailyLimit: number;
    p2pDailyLimit: number;
    withdrawalProcessingDays: number;
    kycRequired: boolean;
    topupMethods: string;
    referralEnabled: boolean;
    referralBonus: number;
    loyaltyEnabled: boolean;
    loyaltyPtsPerRs100: number;
    maxOrdersDay: number;
    signupBonus: number;
    p2pEnabled: boolean;
    walletCashbackPct: number;
    walletCashbackOrders: boolean;
    walletCashbackRides: boolean;
    walletCashbackPharm: boolean;
  };
  integrations: {
    pushNotif: boolean;
    analytics: boolean;
    analyticsPlatform: string;
    analyticsTrackingId: string;
    analyticsDebug: boolean;
    sentry: boolean;
    sentryDsn: string;
    sentryEnvironment: string;
    sentrySampleRate: number;
    sentryTracesSampleRate: number;
    maps: boolean;
    mapsAutocomplete: boolean;
    mapsGeocoding: boolean;
    mapsDistanceMatrix: boolean;
    whatsapp: boolean;
    sms: boolean;
    email: boolean;
  };
  auth: {
    phoneOtpEnabled: boolean | Record<string, boolean>;
    emailOtpEnabled: boolean | Record<string, boolean>;
    usernamePasswordEnabled: boolean | Record<string, boolean>;
    googleEnabled: boolean | Record<string, boolean>;
    facebookEnabled: boolean | Record<string, boolean>;
    emailRegisterEnabled: boolean | Record<string, boolean>;
    biometricEnabled: boolean | Record<string, boolean>;
    captchaEnabled: boolean;
    twoFactorEnabled: boolean | Record<string, boolean>;
    magicLinkEnabled: boolean | Record<string, boolean>;
    captchaSiteKey: string;
    googleClientId: string;
    facebookAppId: string;
    authMode?: "OTP" | "EMAIL" | "FIREBASE" | "HYBRID";
    firebaseEnabled?: boolean;
  };
  language: {
    defaultLanguage: string;
    enabledLanguages: string[];
  };
  cities: string[];
  regional?: {
    phoneFormat?: string;
    phoneHint?: string;
    currency?: string;
    timezone?: string;
  };
  supportHoursSchedule?: Array<{ day: string; open: string; close: string }>;
  pagination?: {
    flashDealsLimit?: number;
    productsPerPage?: number;
    ordersPerPage?: number;
  };
  onboarding?: {
    slides?: Array<{ title: string; subtitle?: string; image?: string }>;
    skipEnabled?: boolean;
  };
}

const DEFAULT: PlatformConfig = {
  appStatus: "active",
  features: { mart: true, food: true, rides: true, pharmacy: true, parcel: true, wallet: true, referral: true, newUsers: true, chat: false, liveTracking: true, reviews: true, sos: true },
  content: {
    trackerBannerEnabled: true,
    trackerBannerPosition: "top" as const,
    showBanner:      true,
    banner:          "Free delivery on your first order! 🎉",
    announcement:    "",
    maintenanceMsg:  "We're performing scheduled maintenance. Back soon!",
    supportMsg:      "Need help? Chat with us!",
    vendorNotice:    "",
    riderNotice:     "",
    tncUrl:          "",
    privacyUrl:      "",
    refundPolicyUrl: "",
    faqUrl:          "",
    aboutUrl:        "",
  },
  platform: {
    appName: "AJKMart",
    appTagline: "Your super app for everything",
    appVersion: "1.0.0",
    minAppVersion: "0.0.0",
    supportPhone: "03001234567",
    supportEmail: "",
    supportHours: "Mon–Sat, 8AM–10PM",
    businessAddress: "Muzaffarabad, AJK, Pakistan",
    socialFacebook: "",
    socialInstagram: "",
  },
  orderRules: {
    minOrderAmount:    100,
    maxCodAmount:      5000,
    maxCartValue:      50000,
    cancelWindowMin:   5,
    autoCancelMin:     15,
    refundDays:        3,
    preptimeMin:       15,
    ratingWindowHours: 48,
    scheduleEnabled:   false,
    serviceableCities: [] as string[],
  },
  deliveryFee: {
    mart: 80, food: 60, pharmacy: 50, parcel: 100,
    parcelPerKg: 40, freeEnabled: true, freeDeliveryAbove: 1000,
  },
  parcelFares: {} as Record<string, number>,
  rides: {
    bikeBaseFare: 15, bikePerKm: 8, bikeMinFare: 50,
    carBaseFare: 25, carPerKm: 12, carMinFare: 80,
    surgeEnabled: false, surgeMultiplier: 1.5, cancellationFee: 30,
    bargainingEnabled: true, bargainingMinPct: 70, bargainingMaxRounds: 3,
    riderEarningPct: 80,
  },
  finance: {
    gstEnabled: false, gstPct: 17, cashbackEnabled: false, cashbackPct: 2, cashbackMaxRs: 100,
    invoiceEnabled: false, platformCommissionPct: 10, vendorCommissionPct: 15, riderEarningPct: 80,
    minVendorPayout: 500, minRiderPayout: 500, vendorSettleDays: 7, referralBonus: 100,
  },
  customer: {
    walletMax: 50000, minTopup: 100, maxTopup: 25000, minWithdrawal: 200, maxWithdrawal: 10000, minTransfer: 200, maxTransfer: 10000,
    dailyLimit: 20000, p2pDailyLimit: 10000, withdrawalProcessingDays: 2, kycRequired: false,
    topupMethods: "jazzcash,easypaisa,bank",
    referralEnabled: true, referralBonus: 100,
    loyaltyEnabled: true, loyaltyPtsPerRs100: 5,
    maxOrdersDay: 10, signupBonus: 0, p2pEnabled: true,
    walletCashbackPct: 0, walletCashbackOrders: true, walletCashbackRides: false, walletCashbackPharm: false,
  },
  integrations: {
    pushNotif: false, analytics: false, analyticsPlatform: "ga4", analyticsTrackingId: "", analyticsDebug: false,
    sentry: false, sentryDsn: "", sentryEnvironment: "production", sentrySampleRate: 1.0, sentryTracesSampleRate: 0.1,
    maps: false, mapsAutocomplete: true, mapsGeocoding: true, mapsDistanceMatrix: true,
    whatsapp: false, sms: false, email: false,
  },
  auth: {
    phoneOtpEnabled: true,
    emailOtpEnabled: true,
    usernamePasswordEnabled: true,
    googleEnabled: false,
    facebookEnabled: false,
    emailRegisterEnabled: true,
    biometricEnabled: false,
    captchaEnabled: false,
    twoFactorEnabled: false,
    magicLinkEnabled: false,
    captchaSiteKey: "",
    googleClientId: "",
    facebookAppId: "",
  },
  language: {
    defaultLanguage: "en",
    enabledLanguages: ["en", "ur", "roman", "en_roman", "en_ur"],
  },
  cities: [
    "Muzaffarabad", "Mirpur", "Rawalakot", "Kotli", "Bagh", "Bhimber",
    "Islamabad", "Rawalpindi", "Lahore", "Karachi", "Peshawar", "Quetta",
    "Faisalabad", "Multan", "Sialkot", "Gujranwala", "Hyderabad",
    "Abbottabad", "Bahawalpur", "Sargodha", "Sukkur", "Mardan",
    "Mansehra", "Gilgit", "Skardu",
  ],
};

function isMethodEnabled(val: boolean | Record<string, boolean> | undefined | null, role = "customer"): boolean {
  if (val === undefined || val === null) return false;
  if (typeof val === "boolean") return val;
  if (typeof val !== "object") return false;
  return val[role] ?? false;
}

export { isMethodEnabled };

interface Ctx {
  config: PlatformConfig;
  loading: boolean;
  limitedFunctionality: boolean;
  error: boolean;
  hasCachedConfig: boolean;
  refresh: () => void;
}

const PlatformConfigContext = createContext<Ctx>({
  config: DEFAULT,
  loading: false,
  limitedFunctionality: false,
  error: false,
  hasCachedConfig: false,
  refresh: () => {},
});

let _cached: PlatformConfig | null = null;
let _cachedAt = 0;

function parseConfig(raw: Record<string, unknown>): PlatformConfig {
  const rawPlatform = (raw.platform ?? {}) as Record<string, unknown>;
  const rawFeatures = (raw.features ?? {}) as Record<string, unknown>;
  const rawContent = (raw.content ?? {}) as Record<string, unknown>;
  const rawOrderRules = (raw.orderRules ?? {}) as Record<string, unknown>;
  const rawDeliveryFee = (raw.deliveryFee ?? {}) as Record<string, unknown>;
  const rawRides = (raw.rides ?? {}) as Record<string, unknown>;
  const rawFinance = (raw.finance ?? {}) as Record<string, unknown>;
  const rawCustomer = (raw.customer ?? {}) as Record<string, unknown>;
  const rawIntegrations = (raw.integrations ?? {}) as Record<string, unknown>;
  const rawAuth = (raw.auth ?? {}) as Record<string, unknown>;
  const rawLanguage = (raw.language ?? {}) as Record<string, unknown>;

  const rawStatus = rawPlatform.appStatus as string | undefined;
  const appStatus: PlatformConfig["appStatus"] =
    rawStatus === "maintenance" ? "maintenance" :
    rawStatus === "limited" ? "limited" :
    rawStatus === "down" ? "down" :
    "active";

  return {
    appStatus,
    features: {
      mart:         (rawFeatures.mart         ?? true)  as boolean,
      food:         (rawFeatures.food         ?? true)  as boolean,
      rides:        (rawFeatures.rides        ?? true)  as boolean,
      pharmacy:     (rawFeatures.pharmacy     ?? true)  as boolean,
      parcel:       (rawFeatures.parcel       ?? true)  as boolean,
      wallet:       (rawFeatures.wallet       ?? true)  as boolean,
      referral:     (rawFeatures.referral     ?? true)  as boolean,
      newUsers:     (rawFeatures.newUsers     ?? true)  as boolean,
      chat:         (rawFeatures.chat         ?? false) as boolean,
      liveTracking: (rawFeatures.liveTracking ?? true)  as boolean,
      reviews:      (rawFeatures.reviews      ?? true)  as boolean,
      sos:          (rawFeatures.sos          ?? true)  as boolean,
    },
    content: {
      trackerBannerEnabled: (rawContent.trackerBannerEnabled ?? true) as boolean,
      trackerBannerPosition: (rawContent.trackerBannerPosition ?? "top") as "top" | "bottom",
      showBanner:      (rawContent.showBanner      ?? true)  as boolean,
      banner:          (rawContent.banner          ?? DEFAULT.content.banner) as string,
      announcement:    (rawContent.announcement    ?? "") as string,
      maintenanceMsg:  (rawContent.maintenanceMsg  ?? DEFAULT.content.maintenanceMsg) as string,
      supportMsg:      (rawContent.supportMsg      ?? DEFAULT.content.supportMsg) as string,
      vendorNotice:    (rawContent.vendorNotice    ?? "") as string,
      riderNotice:     (rawContent.riderNotice     ?? "") as string,
      tncUrl:          (rawContent.tncUrl          ?? "") as string,
      privacyUrl:      (rawContent.privacyUrl      ?? "") as string,
      refundPolicyUrl: (rawContent.refundPolicyUrl ?? "") as string,
      faqUrl:          (rawContent.faqUrl          ?? "") as string,
      aboutUrl:        (rawContent.aboutUrl        ?? "") as string,
    },
    platform: {
      appName:         (rawPlatform.appName         ?? DEFAULT.platform.appName) as string,
      appTagline:      (rawPlatform.appTagline      ?? DEFAULT.platform.appTagline) as string,
      appVersion:      (rawPlatform.appVersion      ?? DEFAULT.platform.appVersion) as string,
      minAppVersion:   (rawPlatform.minAppVersion   ?? "0.0.0") as string,
      supportPhone:    (rawPlatform.supportPhone    ?? DEFAULT.platform.supportPhone) as string,
      supportEmail:    (rawPlatform.supportEmail    ?? "") as string,
      supportHours:    (rawPlatform.supportHours    ?? DEFAULT.platform.supportHours) as string,
      businessAddress: (rawPlatform.businessAddress ?? DEFAULT.platform.businessAddress) as string,
      socialFacebook:  (rawPlatform.socialFacebook  ?? "") as string,
      socialInstagram: (rawPlatform.socialInstagram ?? "") as string,
      supportContact:  rawPlatform.supportContact as string | undefined,
    },
    orderRules: {
      minOrderAmount:    (rawOrderRules.minOrderAmount    ?? DEFAULT.orderRules.minOrderAmount) as number,
      maxCodAmount:      (rawOrderRules.maxCodAmount      ?? DEFAULT.orderRules.maxCodAmount) as number,
      maxCartValue:      (rawOrderRules.maxCartValue      ?? DEFAULT.orderRules.maxCartValue) as number,
      cancelWindowMin:   (rawOrderRules.cancelWindowMin   ?? DEFAULT.orderRules.cancelWindowMin) as number,
      autoCancelMin:     (rawOrderRules.autoCancelMin     ?? DEFAULT.orderRules.autoCancelMin) as number,
      refundDays:        (rawOrderRules.refundDays        ?? DEFAULT.orderRules.refundDays) as number,
      preptimeMin:       (rawOrderRules.preptimeMin       ?? DEFAULT.orderRules.preptimeMin) as number,
      ratingWindowHours: (rawOrderRules.ratingWindowHours ?? DEFAULT.orderRules.ratingWindowHours) as number,
      scheduleEnabled:   (rawOrderRules.scheduleEnabled   ?? DEFAULT.orderRules.scheduleEnabled) as boolean,
      serviceableCities: Array.isArray(rawOrderRules.serviceableCities) ? rawOrderRules.serviceableCities as string[] : [],
    },
    deliveryFee: {
      mart:              (rawDeliveryFee.mart              ?? DEFAULT.deliveryFee.mart) as number,
      food:              (rawDeliveryFee.food              ?? DEFAULT.deliveryFee.food) as number,
      pharmacy:          (rawDeliveryFee.pharmacy          ?? DEFAULT.deliveryFee.pharmacy) as number,
      parcel:            (rawDeliveryFee.parcel            ?? DEFAULT.deliveryFee.parcel) as number,
      parcelPerKg:       (rawDeliveryFee.parcelPerKg       ?? DEFAULT.deliveryFee.parcelPerKg) as number,
      freeEnabled:       (rawDeliveryFee.freeEnabled       ?? DEFAULT.deliveryFee.freeEnabled) as boolean,
      freeDeliveryAbove: (rawDeliveryFee.freeDeliveryAbove ?? rawPlatform.freeDeliveryAbove ?? DEFAULT.deliveryFee.freeDeliveryAbove) as number,
    },
    parcelFares: (raw.parcelFares && typeof raw.parcelFares === "object" && !Array.isArray(raw.parcelFares))
      ? raw.parcelFares as Record<string, number>
      : DEFAULT.parcelFares,
    rides: {
      bikeBaseFare:        (rawRides.bikeBaseFare        ?? DEFAULT.rides.bikeBaseFare) as number,
      bikePerKm:           (rawRides.bikePerKm           ?? DEFAULT.rides.bikePerKm) as number,
      bikeMinFare:         (rawRides.bikeMinFare         ?? DEFAULT.rides.bikeMinFare) as number,
      carBaseFare:         (rawRides.carBaseFare         ?? DEFAULT.rides.carBaseFare) as number,
      carPerKm:            (rawRides.carPerKm            ?? DEFAULT.rides.carPerKm) as number,
      carMinFare:          (rawRides.carMinFare          ?? DEFAULT.rides.carMinFare) as number,
      surgeEnabled:        (rawRides.surgeEnabled        ?? DEFAULT.rides.surgeEnabled) as boolean,
      surgeMultiplier:     (rawRides.surgeMultiplier     ?? DEFAULT.rides.surgeMultiplier) as number,
      cancellationFee:     (rawRides.cancellationFee     ?? DEFAULT.rides.cancellationFee) as number,
      bargainingEnabled:   (rawRides.bargainingEnabled   ?? DEFAULT.rides.bargainingEnabled) as boolean,
      bargainingMinPct:    (rawRides.bargainingMinPct    ?? DEFAULT.rides.bargainingMinPct) as number,
      bargainingMaxRounds: (rawRides.bargainingMaxRounds ?? DEFAULT.rides.bargainingMaxRounds) as number,
      riderEarningPct:     (rawRides.riderEarningPct     ?? DEFAULT.rides.riderEarningPct) as number,
    },
    finance: {
      gstEnabled:            (rawFinance.gstEnabled            ?? DEFAULT.finance.gstEnabled) as boolean,
      gstPct:                (rawFinance.gstPct                ?? DEFAULT.finance.gstPct) as number,
      cashbackEnabled:       (rawFinance.cashbackEnabled       ?? DEFAULT.finance.cashbackEnabled) as boolean,
      cashbackPct:           (rawFinance.cashbackPct           ?? DEFAULT.finance.cashbackPct) as number,
      cashbackMaxRs:         (rawFinance.cashbackMaxRs         ?? DEFAULT.finance.cashbackMaxRs) as number,
      invoiceEnabled:        (rawFinance.invoiceEnabled        ?? DEFAULT.finance.invoiceEnabled) as boolean,
      platformCommissionPct: (rawFinance.platformCommissionPct ?? DEFAULT.finance.platformCommissionPct) as number,
      vendorCommissionPct:   (rawFinance.vendorCommissionPct   ?? DEFAULT.finance.vendorCommissionPct) as number,
      riderEarningPct:       (rawFinance.riderEarningPct       ?? DEFAULT.finance.riderEarningPct) as number,
      minVendorPayout:       (rawFinance.minVendorPayout       ?? DEFAULT.finance.minVendorPayout) as number,
      minRiderPayout:        (rawFinance.minRiderPayout        ?? DEFAULT.finance.minRiderPayout) as number,
      vendorSettleDays:      (rawFinance.vendorSettleDays      ?? DEFAULT.finance.vendorSettleDays) as number,
      referralBonus:         (rawFinance.referralBonus         ?? DEFAULT.finance.referralBonus) as number,
    },
    customer: {
      walletMax:                (rawCustomer.walletMax                ?? DEFAULT.customer.walletMax) as number,
      minTopup:                 (rawCustomer.minTopup                 ?? DEFAULT.customer.minTopup) as number,
      maxTopup:                 (rawCustomer.maxTopup                 ?? DEFAULT.customer.maxTopup) as number,
      minWithdrawal:            (rawCustomer.minWithdrawal            ?? DEFAULT.customer.minWithdrawal) as number,
      maxWithdrawal:            (rawCustomer.maxWithdrawal            ?? DEFAULT.customer.maxWithdrawal) as number,
      minTransfer:              (rawCustomer.minTransfer              ?? DEFAULT.customer.minTransfer) as number,
      maxTransfer:              (rawCustomer.maxTransfer              ?? DEFAULT.customer.maxTransfer) as number,
      dailyLimit:               (rawCustomer.dailyLimit               ?? DEFAULT.customer.dailyLimit) as number,
      p2pDailyLimit:            (rawCustomer.p2pDailyLimit            ?? DEFAULT.customer.p2pDailyLimit) as number,
      withdrawalProcessingDays: (rawCustomer.withdrawalProcessingDays ?? DEFAULT.customer.withdrawalProcessingDays) as number,
      kycRequired:              (rawCustomer.kycRequired              ?? DEFAULT.customer.kycRequired) as boolean,
      topupMethods:             (rawCustomer.topupMethods             ?? DEFAULT.customer.topupMethods) as string,
      referralEnabled:          (rawCustomer.referralEnabled          ?? DEFAULT.customer.referralEnabled) as boolean,
      referralBonus:            (rawCustomer.referralBonus            ?? DEFAULT.customer.referralBonus) as number,
      loyaltyEnabled:           (rawCustomer.loyaltyEnabled           ?? DEFAULT.customer.loyaltyEnabled) as boolean,
      loyaltyPtsPerRs100:       (rawCustomer.loyaltyPtsPerRs100       ?? DEFAULT.customer.loyaltyPtsPerRs100) as number,
      maxOrdersDay:             (rawCustomer.maxOrdersDay             ?? DEFAULT.customer.maxOrdersDay) as number,
      signupBonus:              (rawCustomer.signupBonus              ?? DEFAULT.customer.signupBonus) as number,
      p2pEnabled:               (rawCustomer.p2pEnabled               ?? DEFAULT.customer.p2pEnabled) as boolean,
      walletCashbackPct:        (rawCustomer.walletCashbackPct        ?? DEFAULT.customer.walletCashbackPct) as number,
      walletCashbackOrders:     (rawCustomer.walletCashbackOrders     ?? DEFAULT.customer.walletCashbackOrders) as boolean,
      walletCashbackRides:      (rawCustomer.walletCashbackRides      ?? DEFAULT.customer.walletCashbackRides) as boolean,
      walletCashbackPharm:      (rawCustomer.walletCashbackPharm      ?? DEFAULT.customer.walletCashbackPharm) as boolean,
    },
    integrations: {
      pushNotif:              (rawIntegrations.pushNotif             ?? DEFAULT.integrations.pushNotif) as boolean,
      analytics:              (rawIntegrations.analytics             ?? DEFAULT.integrations.analytics) as boolean,
      analyticsPlatform:      (rawIntegrations.analyticsPlatform     ?? DEFAULT.integrations.analyticsPlatform) as string,
      analyticsTrackingId:    (rawIntegrations.analyticsTrackingId   ?? DEFAULT.integrations.analyticsTrackingId) as string,
      analyticsDebug:         (rawIntegrations.analyticsDebug        ?? DEFAULT.integrations.analyticsDebug) as boolean,
      sentry:                 (rawIntegrations.sentry                ?? DEFAULT.integrations.sentry) as boolean,
      sentryDsn:              (rawIntegrations.sentryDsn             ?? DEFAULT.integrations.sentryDsn) as string,
      sentryEnvironment:      (rawIntegrations.sentryEnvironment     ?? DEFAULT.integrations.sentryEnvironment) as string,
      sentrySampleRate:       (rawIntegrations.sentrySampleRate      ?? DEFAULT.integrations.sentrySampleRate) as number,
      sentryTracesSampleRate: (rawIntegrations.sentryTracesSampleRate ?? DEFAULT.integrations.sentryTracesSampleRate) as number,
      maps:                   (rawIntegrations.maps                  ?? DEFAULT.integrations.maps) as boolean,
      mapsAutocomplete:       (rawIntegrations.mapsAutocomplete      ?? DEFAULT.integrations.mapsAutocomplete) as boolean,
      mapsGeocoding:          (rawIntegrations.mapsGeocoding         ?? DEFAULT.integrations.mapsGeocoding) as boolean,
      mapsDistanceMatrix:     (rawIntegrations.mapsDistanceMatrix    ?? DEFAULT.integrations.mapsDistanceMatrix) as boolean,
      whatsapp:               (rawIntegrations.whatsapp              ?? DEFAULT.integrations.whatsapp) as boolean,
      sms:                    (rawIntegrations.sms                   ?? DEFAULT.integrations.sms) as boolean,
      email:                  (rawIntegrations.email                 ?? DEFAULT.integrations.email) as boolean,
    },
    auth: {
      phoneOtpEnabled:         rawAuth.phoneOtpEnabled         ?? DEFAULT.auth.phoneOtpEnabled,
      emailOtpEnabled:         rawAuth.emailOtpEnabled         ?? DEFAULT.auth.emailOtpEnabled,
      usernamePasswordEnabled: rawAuth.usernamePasswordEnabled ?? DEFAULT.auth.usernamePasswordEnabled,
      googleEnabled:           rawAuth.googleEnabled           ?? DEFAULT.auth.googleEnabled,
      facebookEnabled:         rawAuth.facebookEnabled         ?? DEFAULT.auth.facebookEnabled,
      emailRegisterEnabled:    rawAuth.emailRegisterEnabled    ?? DEFAULT.auth.emailRegisterEnabled,
      biometricEnabled:        rawAuth.biometricEnabled        ?? DEFAULT.auth.biometricEnabled,
      captchaEnabled:          (rawAuth.captchaEnabled         ?? DEFAULT.auth.captchaEnabled) as boolean,
      twoFactorEnabled:        rawAuth.twoFactorEnabled        ?? DEFAULT.auth.twoFactorEnabled,
      magicLinkEnabled:        rawAuth.magicLinkEnabled        ?? DEFAULT.auth.magicLinkEnabled,
      captchaSiteKey:          (rawAuth.captchaSiteKey         ?? DEFAULT.auth.captchaSiteKey) as string,
      googleClientId:          (rawAuth.googleClientId         ?? DEFAULT.auth.googleClientId) as string,
      facebookAppId:           (rawAuth.facebookAppId          ?? DEFAULT.auth.facebookAppId) as string,
      authMode:                rawAuth.authMode as PlatformConfig["auth"]["authMode"],
      firebaseEnabled:         rawAuth.firebaseEnabled as boolean | undefined,
    },
    language: {
      defaultLanguage:  (rawLanguage.defaultLanguage  ?? DEFAULT.language.defaultLanguage) as string,
      enabledLanguages: Array.isArray(rawLanguage.enabledLanguages) && (rawLanguage.enabledLanguages as unknown[]).length > 0
        ? rawLanguage.enabledLanguages as string[]
        : DEFAULT.language.enabledLanguages,
    },
    cities: Array.isArray(raw.cities) && (raw.cities as unknown[]).length > 0
      ? raw.cities as string[]
      : DEFAULT.cities,
  };
}

export function PlatformConfigProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<PlatformConfig>(_cached ?? DEFAULT);
  const [loading, setLoading] = useState(!_cached);
  const [limitedFunctionality, setLimitedFunctionality] = useState(false);
  const [error, setError] = useState(false);
  const [hasCachedConfig, setHasCachedConfig] = useState(!!_cached);
  const fetchingRef = useRef(false);

  const fetchConfig = useCallback(async (force = false) => {
    if (fetchingRef.current) return;
    const now = Date.now();
    if (!force && _cached && now - _cachedAt < CACHE_MS) {
      setConfig(_cached);
      setLoading(false);
      return;
    }
    fetchingRef.current = true;
    setError(false);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8_000);
      let res: Response;
      try {
        res = await fetch(`${API_BASE}/platform-config`, { cache: "no-store", signal: controller.signal });
      } finally {
        clearTimeout(timeoutId);
      }
      if (!res.ok) throw new Error("config fetch failed");
      const raw = await res.json() as Record<string, unknown>;
      const parsed = parseConfig(raw);
      _cached = parsed;
      _cachedAt = Date.now();
      setConfig(parsed);
      setLimitedFunctionality(false);
      setHasCachedConfig(true);
      AsyncStorage.setItem(ASYNC_STORAGE_KEY, JSON.stringify(parsed)).catch(() => {});
    } catch {
      setError(true);
      if (_cached) {
        setConfig(_cached);
        setLimitedFunctionality(false);
        setHasCachedConfig(true);
      } else {
        try {
          const stored = await AsyncStorage.getItem(ASYNC_STORAGE_KEY);
          if (stored) {
            const parsed = JSON.parse(stored) as PlatformConfig;
            _cached = parsed;
            _cachedAt = 0;
            setConfig(parsed);
            setLimitedFunctionality(false);
            setHasCachedConfig(true);
          } else {
            setLimitedFunctionality(true);
            setHasCachedConfig(false);
          }
        } catch {
          setLimitedFunctionality(true);
          setHasCachedConfig(false);
        }
      }
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }, []);

  useEffect(() => {
    fetchConfig();
    const interval = setInterval(() => fetchConfig(), CACHE_MS);
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") fetchConfig(true);
    });
    return () => { clearInterval(interval); sub.remove(); };
  }, [fetchConfig]);

  const refresh = useCallback(() => fetchConfig(true), [fetchConfig]);

  return (
    <PlatformConfigContext.Provider value={{ config, loading, limitedFunctionality, error, hasCachedConfig, refresh }}>
      {children}
    </PlatformConfigContext.Provider>
  );
}

export function usePlatformConfig() {
  return useContext(PlatformConfigContext);
}
