import { useCallback, useEffect, useRef } from "react";
import type { TranslationKey } from "@workspace/i18n";
import type { Order, Ride } from "../../lib/api";
import { ActiveTaskBanner } from "../dashboard/ActiveTaskBanner";
import { RequestBoard } from "../request-system/RequestBoard";
import { useRequestEngine } from "../../lib/request-engine/useRequestEngine";

/* ─── Skeleton loader row ─────────────────────────────────────────────────── */

function SkeletonRow() {
  return (
    <div className="px-4 py-3 animate-pulse">
      <div className="flex items-start gap-3">
        <div className="h-12 w-12 flex-shrink-0 rounded-2xl bg-muted/30" />
        <div className="flex-1 space-y-2">
          <div className="h-3.5 w-3/5 rounded-lg bg-muted/30" />
          <div className="h-2.5 w-4/5 rounded-lg bg-muted/20" />
          <div className="h-2.5 w-2/5 rounded-lg bg-muted/20" />
        </div>
        <div className="h-10 w-16 rounded-2xl bg-muted/30" />
      </div>
      <div className="mt-3 flex gap-2">
        <div className="h-10 w-10 rounded-xl bg-muted/20" />
        <div className="h-10 w-10 rounded-xl bg-muted/20" />
        <div className="h-11 flex-1 rounded-xl bg-muted/25" />
      </div>
    </div>
  );
}

/* ─── Props ──────────────────────────────────────────────────────────────── */

interface HomeRequestsProps {
  isOnline: boolean;
  totalRequests: number;
  requestsLoading: boolean;
  requestsError: boolean;
  visibleOrders: Order[];
  visibleRides: Ride[];
  currency: string;
  config: any;
  dismissed: Set<string>;
  onClearDismissed: () => void;
  onAcceptOrder: (id: string) => void;
  onRejectOrder: (id: string) => void;
  onAcceptRide: (id: string) => void;
  onCounterRide: (id: string, fare: number) => Promise<void>;
  onRejectOffer: (id: string) => void;
  onIgnoreRide: (id: string) => void;
  onDismiss: (id: string) => void;
  isNetworkOffline: boolean;
  acceptOrderPending: boolean;
  rejectOrderPending: boolean;
  acceptRidePending: boolean;
  acceptingRideId: string | null;
  acceptingOrderId: string | null;
  counterRidePending: boolean;
  rejectOfferPending: boolean;
  ignoreRidePending: boolean;
  requestsServerTime: string | null;
  userId: string;
  isRestricted: boolean;
  onRetry: () => void;
  T: (key: TranslationKey) => string;
  hasActiveTask: boolean;
  activeData: any;
  trackerBannerEnabled: boolean;
  trackerBannerPosition: string;
  newFlash: boolean;
  onGoOnline: () => void;
  toggling: boolean;
}

/* ─── Main export ────────────────────────────────────────────────────────── */

export function HomeRequests({
  isOnline,
  totalRequests,
  requestsLoading,
  visibleOrders,
  visibleRides,
  currency,
  config,
  onAcceptOrder,
  onRejectOrder,
  onAcceptRide,
  onCounterRide,
  onRejectOffer,
  onIgnoreRide,
  onDismiss,
  isNetworkOffline,
  acceptOrderPending,
  rejectOrderPending,
  acceptRidePending,
  acceptingRideId,
  acceptingOrderId,
  counterRidePending,
  rejectOfferPending,
  ignoreRidePending,
  userId,
  isRestricted,
  onRetry,
  T,
  hasActiveTask,
  activeData,
  trackerBannerEnabled,
  trackerBannerPosition,
  newFlash,
}: HomeRequestsProps) {
  const engine = useRequestEngine(
    visibleOrders,
    visibleRides,
    null,
    null,
    config,
    { onAcceptOrder, onAcceptRide }
  );

  /*
   * IntersectionObserver sentinel — placed below the request list.
   * When the user scrolls to the bottom of the feed (page-level scroll),
   * fires onRetry() to refresh the query and surface any new requests
   * that may have arrived since the last fetch.
   */
  const sentinelRef = useRef<HTMLDivElement>(null);
  const onNearEnd = useCallback(() => { onRetry(); }, [onRetry]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) onNearEnd();
      },
      { threshold: 0.1 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [onNearEnd]);

  if (!isOnline) return null;

  return (
    <>
      {/* Top tracker banner */}
      {trackerBannerEnabled && hasActiveTask && trackerBannerPosition === "top" && (
        <ActiveTaskBanner activeData={activeData} variant="green" />
      )}
      {hasActiveTask && !trackerBannerEnabled && (
        <ActiveTaskBanner activeData={activeData} variant="amber" />
      )}

      {/* Request list with react-window virtualization (via RequestBoard) */}
      <div
        className={`overflow-hidden rounded-3xl shadow-sm transition-all duration-300 ${newFlash ? "ring-4 ring-green-400 ring-offset-2 ring-offset-page-bg" : ""}`}
      >
        {requestsLoading && totalRequests === 0 ? (
          /* Skeleton loaders on first paint while data loads */
          <div className="divide-y divide-border/30 rounded-3xl border border-border bg-card">
            <div className="px-4 py-3">
              <div className="h-3 w-32 rounded bg-muted/30 animate-pulse" />
            </div>
            {[0, 1, 2].map((i) => (
              <SkeletonRow key={i} />
            ))}
          </div>
        ) : (
          <RequestBoard
            engine={engine}
            currency={currency}
            config={config}
            isNetworkOffline={isNetworkOffline}
            onAcceptOrder={onAcceptOrder}
            onRejectOrder={onRejectOrder}
            onAcceptRide={onAcceptRide}
            onCounterRide={onCounterRide}
            onRejectOffer={onRejectOffer}
            onIgnoreRide={onIgnoreRide}
            onDismiss={onDismiss}
            acceptOrderPending={acceptOrderPending}
            rejectOrderPending={rejectOrderPending}
            acceptRidePending={acceptRidePending}
            acceptingRideId={acceptingRideId}
            acceptingOrderId={acceptingOrderId}
            counterRidePending={counterRidePending}
            rejectOfferPending={rejectOfferPending}
            ignoreRidePending={ignoreRidePending}
            T={T}
            userId={userId}
            isRestricted={isRestricted}
            onNearEnd={onNearEnd}
          />
        )}
      </div>

      {/*
       * IntersectionObserver sentinel — invisible 1px div below the feed.
       * Observed at page-scroll level (outside the List's internal scroll).
       * Triggers onRetry() to refresh the query when user reaches page bottom.
       */}
      <div ref={sentinelRef} style={{ height: 1 }} aria-hidden="true" />

      {/* Bottom tracker banner */}
      {trackerBannerEnabled && hasActiveTask && trackerBannerPosition === "bottom" && (
        <div className="mt-3">
          <ActiveTaskBanner activeData={activeData} variant="green" />
        </div>
      )}
    </>
  );
}
