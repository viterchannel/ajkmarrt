import { useCallback, useMemo, useRef, useState } from "react";
import type { Order, Ride } from "../api";
import type {
  BatchGroup,
  RequestFilter,
  RequestKind,
  Reservation,
  UnifiedRequest,
  VendorPriority,
  RequestScore,
  EarningsBreakdown,
  CollaborationInterest,
  QueueEntry,
  VendorTier,
} from "./types";

const haversine = (lat1: number, lng1: number, lat2: number, lng2: number) => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

/* ── Smart scoring algorithm ── */
function computeScore(
  req: Order | Ride,
  kind: "order" | "ride",
  riderLat: number | null,
  riderLng: number | null,
  vendorPriority?: VendorPriority,
  config?: { commissionPct?: number; rider?: { bonusPerTrip?: number } }
): RequestScore {
  /* Distance score */
  let distanceScore = 50;
  const pLat = kind === "order" ? (req as Order).vendorLat : (req as Ride).pickupLat;
  const pLng = kind === "order" ? (req as Order).vendorLng : (req as Ride).pickupLng;
  if (riderLat != null && riderLng != null && pLat != null && pLng != null) {
    const d = haversine(riderLat, riderLng, Number(pLat), Number(pLng));
    distanceScore = Math.max(0, Math.min(100, 100 - d * 15));
  }

  /* Fare score */
  const fare = Number((req as any).fare ?? 0);
  let fareScore = Math.min(100, (fare / 500) * 100);

  /* Urgency score (older = higher) */
  const createdAt = new Date((req as any).createdAt ?? Date.now()).getTime();
  const ageMin = (Date.now() - createdAt) / 60000;
  const urgencyScore = Math.min(100, ageMin * 2);

  /* Vendor bonus */
  const vendorBonusScore = vendorPriority?.priorityScore ?? 50;

  /* Composite weighted */
  const composite = Math.round(
    distanceScore * 0.35 + fareScore * 0.25 + urgencyScore * 0.15 + vendorBonusScore * 0.25
  );
  return { distanceScore, fareScore, urgencyScore, vendorBonusScore, composite };
}

/* ── Earnings calculator ── */
export function calculateEarnings(
  req: Order | Ride,
  kind: "order" | "ride",
  vendorPriority?: VendorPriority,
  config?: { commissionPct?: number; rider?: { bonusPerTrip?: number; keepPct?: number } }
): EarningsBreakdown {
  const fare = Number((req as any).fare ?? 0);
  const commissionPct = config?.commissionPct ?? 20;
  const keepPct = config?.rider?.keepPct ?? 80;
  const bonusPerTrip = config?.rider?.bonusPerTrip ?? 0;
  const baseEarnings = (fare * keepPct) / 100;
  const platformFee = (fare * commissionPct) / 100;

  /* Distance bonus */
  const dLat = kind === "order" ? (req as Order).vendorLat : (req as Ride).pickupLat;
  const dLng = kind === "order" ? (req as Order).vendorLng : (req as Ride).pickupLng;
  const distanceKm = dLat && dLng ? haversine(0, 0, Number(dLat), Number(dLng)) : 0; /* placeholder, real rider lat needed */
  const distanceBonus = distanceKm > 5 ? Math.round(distanceKm * 2) : 0;

  /* Time bonus (surge for older requests) */
  const createdAt = new Date((req as any).createdAt ?? Date.now()).getTime();
  const ageMin = (Date.now() - createdAt) / 60000;
  const timeBonus = ageMin > 10 ? Math.round(ageMin * 0.5) : 0;

  /* Surge bonus */
  const surgeBonus = (req as any).surgeMultiplier
    ? Math.round(baseEarnings * ((Number((req as any).surgeMultiplier) - 1)))
    : 0;

  /* Vendor tier bonus */
  const tierBonusPct = vendorPriority?.tierBonusPct ?? 0;
  const vendorTierBonus = Math.round(baseEarnings * (tierBonusPct / 100));

  const total = baseEarnings + distanceBonus + timeBonus + surgeBonus + vendorTierBonus + bonusPerTrip;
  const netEarnings = total - platformFee;

  return {
    baseEarnings,
    distanceBonus,
    timeBonus,
    surgeBonus,
    vendorTierBonus,
    total,
    platformFee,
    netEarnings,
  };
}

/* ── Vendor priority detection (mocked for now, will be server-backed) ── */
function detectVendorPriority(req: Order | Ride): VendorPriority | undefined {
  const vendorId = (req as any).vendorId ?? (req as any).userId ?? "";
  if (!vendorId) return undefined;
  /* Deterministic pseudo-random tier based on vendor ID */
  const hash = vendorId.split("").reduce((acc: number, c: string) => acc + c.charCodeAt(0), 0);
  const tiers: VendorTier[] = ["vip", "standard", "new"];
  const tier: VendorTier = tiers[hash % 3] ?? "standard";
  const scores: Record<VendorTier, { score: number; bonus: number }> = {
    vip: { score: 90, bonus: 15 },
    standard: { score: 60, bonus: 5 },
    new: { score: 30, bonus: 0 },
  };
  return {
    tier,
    priorityScore: scores[tier].score,
    tierBonusPct: scores[tier].bonus,
  };
}

/* ── Batch grouping by proximity ── */
export function groupIntoBatches(
  orders: Order[],
  rides: Ride[],
  riderLat: number | null,
  riderLng: number | null,
  maxDistanceKm = 2,
  maxBatchSize = 5
): BatchGroup[] {
  const all: Array<{ item: Order | Ride; kind: "order" | "ride" }> = [
    ...orders.map((o) => ({ item: o, kind: "order" as const })),
    ...rides.map((r) => ({ item: r, kind: "ride" as const })),
  ];

  const groups: BatchGroup[] = [];
  const used = new Set<string>();

  for (const { item, kind } of all) {
    if (used.has(item.id)) continue;
    const pLat = kind === "order" ? (item as Order).vendorLat : (item as Ride).pickupLat;
    const pLng = kind === "order" ? (item as Order).vendorLng : (item as Ride).pickupLng;
    if (pLat == null || pLng == null) continue;

    const batch: Array<Order | Ride> = [item];
    used.add(item.id);

    for (const { item: other, kind: otherKind } of all) {
      if (used.has(other.id)) continue;
      if (batch.length >= maxBatchSize) break;
      const oLat = otherKind === "order" ? (other as Order).vendorLat : (other as Ride).pickupLat;
      const oLng = otherKind === "order" ? (other as Order).vendorLng : (other as Ride).pickupLng;
      if (oLat == null || oLng == null) continue;
      const d = haversine(Number(pLat), Number(pLng), Number(oLat), Number(oLng));
      if (d <= maxDistanceKm) {
        batch.push(other);
        used.add(other.id);
      }
    }

    if (batch.length >= 2) {
      const totalEarnings = batch.reduce((sum, b) => sum + Number((b as any).fare ?? 0), 0);
      groups.push({
        id: `batch-${item.id}`,
        requests: batch,
        totalEarnings,
        pickupArea: (item as any).pickupAddress ?? "Nearby Area",
        distance: riderLat && riderLng ? haversine(riderLat, riderLng, Number(pLat), Number(pLng)) : 0,
        count: batch.length,
      });
    }
  }

  return groups;
}

/* ── Filter function ── */
export function filterRequests(
  requests: UnifiedRequest[],
  filter: RequestFilter,
  riderLat: number | null,
  riderLng: number | null
): UnifiedRequest[] {
  let result = [...requests];

  /* Distance filter */
  if (filter.distanceMaxKm != null && riderLat != null && riderLng != null) {
    result = result.filter((r) => {
      const pLat = r._kind === "order" ? (r as any).vendorLat : (r as any).pickupLat;
      const pLng = r._kind === "order" ? (r as any).vendorLng : (r as any).pickupLng;
      if (pLat == null || pLng == null) return true;
      const maxKm = filter.distanceMaxKm ?? 999;
      return haversine(riderLat, riderLng, Number(pLat), Number(pLng)) <= maxKm;
    });
  }

  /* Payment method filter */
  if (filter.paymentMethods.length > 0) {
    result = result.filter((r) => {
      const method = (r as any).paymentMethod ?? "cash";
      return filter.paymentMethods.includes(method);
    });
  }

  /* Time window filter */
  if (filter.timeWindow !== "any") {
    const now = Date.now();
    const limits: Record<string, number> = { "15min": 15, "30min": 30, "1hour": 60 };
    const limit = limits[filter.timeWindow] ?? 60;
    result = result.filter((r) => {
      const created = new Date(r.createdAt ?? now).getTime();
      return (now - created) / 60000 <= limit;
    });
  }

  /* Type filter */
  if (filter.requestTypes.length > 0) {
    result = result.filter((r) => {
      if (r._kind === "ride") return filter.requestTypes.includes("ride");
      const type = (r as any).type ?? "mart";
      return filter.requestTypes.includes(type as any);
    });
  }

  /* Minimum earnings filter */
  if (filter.minEarnings != null) {
    result = result.filter((r) => {
      const fare = Number((r as any).fare ?? 0);
      return fare >= filter.minEarnings!;
    });
  }

  /* Vendor tier filter */
  if (filter.vendorTier.length > 0) {
    result = result.filter((r) => {
      const tier = r.vendorPriority?.tier;
      if (!tier) return true;
      return filter.vendorTier.includes(tier);
    });
  }

  /* Priority-only filter */
  if (filter.showOnlyPriority) {
    result = result.filter((r) => (r.vendorPriority?.priorityScore ?? 0) >= 70);
  }

  /* Sorting */
  switch (filter.sortBy) {
    case "distance":
      result.sort((a, b) => {
        const aScore = a.score?.distanceScore ?? 0;
        const bScore = b.score?.distanceScore ?? 0;
        return bScore - aScore;
      });
      break;
    case "earnings":
      result.sort((a, b) => {
        const aFare = Number((a as any).fare ?? 0);
        const bFare = Number((b as any).fare ?? 0);
        return bFare - aFare;
      });
      break;
    case "time":
      result.sort((a, b) => new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime());
      break;
    case "score":
    default:
      result.sort((a, b) => (b.score?.composite ?? 0) - (a.score?.composite ?? 0));
      break;
  }

  return result;
}

/* ── Hook ── */
export interface UseRequestEngineReturn {
  /* Unified list */
  allRequests: UnifiedRequest[];
  filteredRequests: UnifiedRequest[];
  visibleOrders: UnifiedRequest[];
  visibleRides: UnifiedRequest[];

  /* Filtering */
  filter: RequestFilter;
  setFilter: (f: Partial<RequestFilter>) => void;
  activeTab: RequestKind;
  setActiveTab: (t: RequestKind) => void;

  /* Batch */
  batchGroups: BatchGroup[];
  selectedBatchId: string | null;
  selectBatch: (id: string | null) => void;
  batchAccept: (groupId: string) => void;

  /* Reservation */
  reservations: Record<string, Reservation>;
  reserveRequest: (id: string, type: "order" | "ride") => boolean;
  extendReservation: (id: string) => boolean;
  cancelReservation: (id: string) => void;

  /* Collaboration */
  collaborationInterests: Record<string, CollaborationInterest[]>;
  expressInterest: (rideId: string) => void;
  withdrawInterest: (rideId: string) => void;

  /* Queue */
  queueEntries: QueueEntry[];
  isInQueue: (id: string) => boolean;
  toggleQueue: (id: string, type: "order" | "ride") => void;
  queuePosition: (id: string) => number | null;

  /* Earnings */
  getEarningsBreakdown: (req: UnifiedRequest) => EarningsBreakdown;

  /* Priority helpers */
  getVendorPriority: (req: UnifiedRequest) => VendorPriority | undefined;
  getScore: (req: UnifiedRequest) => RequestScore | undefined;
}

export function useRequestEngine(
  orders: Order[],
  rides: Ride[],
  riderLat: number | null,
  riderLng: number | null,
  config?: { commissionPct?: number; rider?: { bonusPerTrip?: number; keepPct?: number } }
): UseRequestEngineReturn {
  const [filter, setFilterState] = useState<RequestFilter>({
    distanceMaxKm: null,
    paymentMethods: ["cash", "card", "wallet"],
    timeWindow: "any",
    requestTypes: ["food", "mart", "pharmacy", "parcel", "ride"],
    minEarnings: null,
    vendorTier: ["vip", "standard", "new"],
    showOnlyPriority: false,
    sortBy: "score",
  });

  const [activeTab, setActiveTab] = useState<RequestKind>("all");
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [reservations, setReservations] = useState<Record<string, Reservation>>({});
  const [collaborationInterests, setCollaborationInterests] = useState<Record<string, CollaborationInterest[]>>({});
  const [queueEntries, setQueueEntries] = useState<QueueEntry[]>([]);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* Build unified requests */
  const allRequests = useMemo<UnifiedRequest[]>(() => {
    const unified: UnifiedRequest[] = [];
    for (const o of orders) {
      const vp = detectVendorPriority(o);
      const score = computeScore(o, "order", riderLat, riderLng, vp, config);
      const earnings = calculateEarnings(o, "order", vp, config);
      unified.push({
        ...o,
        _kind: "order",
        vendorPriority: vp,
        score,
        reservation: reservations[o.id],
      } as any);
    }
    for (const r of rides) {
      const vp = detectVendorPriority(r);
      const score = computeScore(r, "ride", riderLat, riderLng, vp, config);
      const earnings = calculateEarnings(r, "ride", vp, config);
      unified.push({
        ...r,
        _kind: "ride",
        vendorPriority: vp,
        score,
        reservation: reservations[r.id],
        collaboration: collaborationInterests[r.id],
      } as any);
    }
    return unified;
  }, [orders, rides, riderLat, riderLng, config, reservations, collaborationInterests]);

  /* Filtered */
  const filteredRequests = useMemo(() => filterRequests(allRequests, filter, riderLat, riderLng), [
    allRequests,
    filter,
    riderLat,
    riderLng,
  ]);

  /* Tab visibility */
  const visibleOrders = useMemo(() => filteredRequests.filter((r) => r._kind === "order"), [filteredRequests]);
  const visibleRides = useMemo(() => filteredRequests.filter((r) => r._kind === "ride"), [filteredRequests]);

  /* Batch groups */
  const batchGroups = useMemo(() => groupIntoBatches(orders, rides, riderLat, riderLng, 2, 5), [orders, rides, riderLat, riderLng]);

  /* Reservation expiry timer */
  if (timerRef.current) clearInterval(timerRef.current);
  timerRef.current = setInterval(() => {
    const now = Date.now();
    setReservations((prev) => {
      const next: Record<string, Reservation> = {};
      for (const [id, res] of Object.entries(prev)) {
        if (res.expiresAt > now) next[id] = res;
      }
      return next;
    });
  }, 5000);

  /* Filter setter */
  const setFilter = useCallback((partial: Partial<RequestFilter>) => {
    setFilterState((prev) => ({ ...prev, ...partial }));
  }, []);

  /* Reserve a request (3 min, one extension to 5 min) */
  const reserveRequest = useCallback((id: string, type: "order" | "ride") => {
    const now = Date.now();
    if (reservations[id]) return false;
    setReservations((prev) => ({
      ...prev,
      [id]: { requestId: id, type, reservedAt: now, expiresAt: now + 3 * 60 * 1000, extended: false },
    }));
    return true;
  }, [reservations]);

  const extendReservation = useCallback((id: string) => {
    const res = reservations[id];
    if (!res || res.extended) return false;
    setReservations((prev) => ({
      ...prev,
      [id]: { ...res, expiresAt: Date.now() + 5 * 60 * 1000, extended: true },
    }));
    return true;
  }, [reservations]);

  const cancelReservation = useCallback((id: string) => {
    setReservations((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  /* Collaboration */
  const expressInterest = useCallback((rideId: string) => {
    /* In real app, this would emit a socket event */
    setCollaborationInterests((prev) => {
      const list = prev[rideId] ?? [];
      return {
        ...prev,
        [rideId]: [
          ...list,
          {
            rideId,
            riderId: "me",
            riderName: "You",
            interestedAt: new Date().toISOString(),
            status: "pending",
          },
        ],
      };
    });
  }, []);

  const withdrawInterest = useCallback((rideId: string) => {
    setCollaborationInterests((prev) => {
      const list = (prev[rideId] ?? []).filter((i) => i.riderId !== "me");
      return { ...prev, [rideId]: list };
    });
  }, []);

  /* Queue management */
  const isInQueue = useCallback((id: string) => queueEntries.some((e) => e.requestId === id), [queueEntries]);

  const toggleQueue = useCallback((id: string, type: "order" | "ride") => {
    setQueueEntries((prev) => {
      const exists = prev.some((e) => e.requestId === id);
      if (exists) {
        return prev.filter((e) => e.requestId !== id);
      }
      const pos = prev.length + 1;
      return [
        ...prev,
        {
          requestId: id,
          type,
          position: pos,
          estimatedWaitSec: pos * 30,
          priority: false,
          enqueuedAt: new Date().toISOString(),
        },
      ];
    });
  }, []);

  const queuePosition = useCallback((id: string) => {
    const entry = queueEntries.find((e) => e.requestId === id);
    return entry ? entry.position : null;
  }, [queueEntries]);

  /* Batch accept */
  const batchAccept = useCallback((groupId: string) => {
    const group = batchGroups.find((g) => g.id === groupId);
    if (!group) return;
    /* In real app, this would queue all requests for acceptance */
    console.log("Batch accept", group.requests.map((r) => r.id));
  }, [batchGroups]);

  /* Earnings */
  const getEarningsBreakdown = useCallback((req: UnifiedRequest) => {
    return calculateEarnings(req, req._kind, req.vendorPriority, config);
  }, [config]);

  const getVendorPriority = useCallback((req: UnifiedRequest) => req.vendorPriority, []);
  const getScore = useCallback((req: UnifiedRequest) => req.score, []);

  return {
    allRequests,
    filteredRequests,
    visibleOrders,
    visibleRides,
    filter,
    setFilter,
    activeTab,
    setActiveTab,
    batchGroups,
    selectedBatchId,
    selectBatch: setSelectedBatchId,
    batchAccept,
    reservations,
    reserveRequest,
    extendReservation,
    cancelReservation,
    collaborationInterests,
    expressInterest,
    withdrawInterest,
    queueEntries,
    isInQueue,
    toggleQueue,
    queuePosition,
    getEarningsBreakdown,
    getVendorPriority,
    getScore,
  };
}
