import { useMemo } from "react";
import { type TranslationKey } from "@workspace/i18n";
import { Package, Bike, SlidersHorizontal } from "lucide-react";
import type { UseRequestEngineReturn } from "../../lib/request-engine/useRequestEngine";
import type { RequestKind } from "../../lib/request-engine/types";
import { RequestFilterBar } from "./RequestFilterBar";
import { RequestCard } from "./RequestCard";
import { BatchAcceptPanel } from "./BatchAcceptPanel";

interface RequestBoardProps {
  engine: UseRequestEngineReturn;
  currency: string;
  config: any;
  isNetworkOffline: boolean;
  onAcceptOrder: (id: string) => void;
  onRejectOrder: (id: string) => void;
  onAcceptRide: (id: string) => void;
  onCounterRide: (id: string, fare: number) => Promise<void>;
  onRejectOffer: (id: string) => void;
  onIgnoreRide: (id: string) => void;
  onDismiss: (id: string) => void;
  acceptOrderPending: boolean;
  rejectOrderPending: boolean;
  acceptRidePending: boolean;
  acceptingRideId: string | null;
  acceptingOrderId: string | null;
  counterRidePending: boolean;
  rejectOfferPending: boolean;
  ignoreRidePending: boolean;
  T: (key: TranslationKey) => string;
  userId: string;
  isRestricted: boolean;
}

export function RequestBoard({
  engine,
  currency,
  config,
  isNetworkOffline,
  onAcceptOrder,
  onRejectOrder,
  onAcceptRide,
  onCounterRide,
  onRejectOffer,
  onIgnoreRide,
  onDismiss,
  acceptOrderPending,
  rejectOrderPending,
  acceptRidePending,
  acceptingRideId,
  acceptingOrderId,
  counterRidePending,
  rejectOfferPending,
  ignoreRidePending,
  T,
  userId,
  isRestricted,
}: RequestBoardProps) {
  const { activeTab, setActiveTab, filteredRequests, visibleOrders, visibleRides, batchGroups } = engine;

  const tabCounts: Record<string, number> = useMemo(() => ({
    all: filteredRequests.length,
    orders: visibleOrders.length,
    rides: visibleRides.length,
  }), [filteredRequests, visibleOrders, visibleRides]);

  const tabs: { id: string; label: string; icon: typeof Package }[] = [
    { id: "all", label: T("allRequests"), icon: SlidersHorizontal },
    { id: "orders", label: T("deliveryRequests"), icon: Package },
    { id: "rides", label: T("rideRequests"), icon: Bike },
  ];

  const visibleRequests = activeTab === "all" ? filteredRequests : activeTab === "orders" ? visibleOrders : visibleRides;

  return (
    <div className="space-y-3">
      {/* Dual-panel tabs with counts */}
      <div className="flex gap-1.5 rounded-2xl bg-card p-1.5 shadow-sm">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id as RequestKind)}
            className={`relative flex flex-1 items-center justify-center gap-1.5 rounded-xl px-2 py-2.5 text-xs font-bold transition-all ${
              activeTab === t.id
                ? "bg-brand text-white shadow-sm"
                : "text-muted hover:bg-muted/50"
            }`}
            aria-pressed={activeTab === t.id}
          >
            <t.icon size={14} />
            <span className="hidden sm:inline">{t.label}</span>
            <span
              className={`flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-extrabold ${
                activeTab === t.id ? "bg-white/25 text-white" : "bg-muted text-muted"
              }`}
            >
              {tabCounts[t.id]}
            </span>
          </button>
        ))}
      </div>

      {/* Filter bar */}
      <RequestFilterBar filter={engine.filter} onChange={engine.setFilter} T={T} />

      {/* Batch accept panel (when 2+ nearby orders) */}
      {batchGroups.length > 0 && (
        <BatchAcceptPanel
          groups={batchGroups}
          selectedId={engine.selectedBatchId}
          onSelect={engine.selectBatch}
          onAccept={engine.batchAccept}
          currency={currency}
          T={T}
        />
      )}

      {/* Offline indicator */}
      {isNetworkOffline && (
        <div className="flex items-center gap-2 rounded-xl bg-warning/15 px-3 py-2.5 text-xs font-semibold text-warning">
          <span className="h-2 w-2 flex-shrink-0 rounded-full bg-warning animate-pulse" />
          {T("offlineQueueEnabled")}
        </div>
      )}

      {/* Request list */}
      {visibleRequests.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl bg-card py-12 text-center">
          <div className="mb-3 rounded-full bg-muted/50 p-3">
            <SlidersHorizontal size={24} className="text-muted" />
          </div>
          <p className="text-sm font-semibold text-muted">{T("noRequestsMatch")}</p>
          <p className="mt-1 text-xs text-muted/60">{T("adjustFiltersRequest")}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {visibleRequests.map((req) => (
            <RequestCard
              key={req.id}
              request={req}
              engine={engine}
              currency={currency}
              config={config}
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
              isNetworkOffline={isNetworkOffline}
            />
          ))}
        </div>
      )}
    </div>
  );
}
