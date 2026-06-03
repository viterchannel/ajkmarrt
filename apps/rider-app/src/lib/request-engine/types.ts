import type { Order, Ride } from "../api";

/* ── Vendor Priority System ── */
export type VendorTier = "vip" | "standard" | "new";

export interface VendorPriority {
  tier: VendorTier;
  priorityScore: number; /* 0-100 */
  tierBonusPct: number;   /* extra earnings % */
  assignedAt?: string;
}

/* ── Request Scoring ── */
export interface RequestScore {
  distanceScore: number;  /* 0-100 (closer = higher) */
  fareScore: number;       /* 0-100 (higher fare = higher) */
  urgencyScore: number;    /* 0-100 (older = higher) */
  vendorBonusScore: number; /* 0-100 (VIP vendor bonus) */
  composite: number;       /* weighted average 0-100 */
}

/* ── Earnings Breakdown ── */
export interface EarningsBreakdown {
  baseEarnings: number;
  distanceBonus: number;
  timeBonus: number;
  surgeBonus: number;
  vendorTierBonus: number;
  total: number;
  platformFee: number;
  netEarnings: number;
}

/* ── Reservation ── */
export interface Reservation {
  requestId: string;
  type: "order" | "ride";
  expiresAt: number; /* ms timestamp */
  reservedAt: number;
  extended: boolean; /* true if extended once */
}

/* ── Collaboration (Group Rides) ── */
export interface CollaborationInterest {
  rideId: string;
  riderId: string;
  riderName: string;
  interestedAt: string;
  status: "pending" | "accepted" | "rejected";
}

/* ── Filter State ── */
export interface RequestFilter {
  distanceMaxKm: number | null;
  paymentMethods: ("cash" | "card" | "wallet")[];
  timeWindow: "any" | "15min" | "30min" | "1hour";
  requestTypes: ("food" | "mart" | "pharmacy" | "parcel" | "ride" | "any")[];
  minEarnings: number | null;
  vendorTier: VendorTier[];
  showOnlyPriority: boolean;
  sortBy: "score" | "distance" | "earnings" | "time";
}

/* ── Batch Group ── */
export interface BatchGroup {
  id: string;
  requests: Array<Order | Ride>;
  totalEarnings: number;
  pickupArea: string;
  distance: number; /* km */
  count: number;
  routePolyline?: string;
}

/* ── Unified Request Type ── */
export type UnifiedRequest =
  | (Order & { _kind: "order"; vendorPriority?: VendorPriority; score?: RequestScore; reservation?: Reservation })
  | (Ride & { _kind: "ride"; vendorPriority?: VendorPriority; score?: RequestScore; reservation?: Reservation; collaboration?: CollaborationInterest[] });

export type RequestKind = "all" | "orders" | "rides";

/* ── Queue Entry ── */
export interface QueueEntry {
  requestId: string;
  type: "order" | "ride";
  position: number;
  estimatedWaitSec: number;
  priority: boolean;
  enqueuedAt: string;
}

export const DEFAULT_FILTER: RequestFilter = {
  distanceMaxKm: null,
  paymentMethods: ["cash", "card", "wallet"],
  timeWindow: "any",
  requestTypes: ["food", "mart", "pharmacy", "parcel"],
  minEarnings: null,
  vendorTier: ["vip", "standard", "new"],
  showOnlyPriority: false,
  sortBy: "score",
};
