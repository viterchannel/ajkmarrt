import type { TranslationKey } from "@workspace/i18n";
import type { Order, Ride } from "../../lib/api";
import { HomeRequestList } from "./HomeRequestList";
import { RequestListHeader } from "../dashboard/RequestListHeader";
import { ActiveTaskBanner } from "../dashboard/ActiveTaskBanner";
import { RequestBoard } from "../request-system/RequestBoard";
import { useRequestEngine } from "../../lib/request-engine/useRequestEngine";

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

export function HomeRequests({
  isOnline,
  totalRequests,
  requestsLoading,
  requestsError,
  visibleOrders,
  visibleRides,
  currency,
  config,
  dismissed,
  onClearDismissed,
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
  requestsServerTime,
  userId,
  isRestricted,
  onRetry,
  T,
  hasActiveTask,
  activeData,
  trackerBannerEnabled,
  trackerBannerPosition,
  newFlash,
  onGoOnline,
  toggling,
}: HomeRequestsProps) {
  const useNewBoard = true; /* Feature toggle — set false to revert to legacy */

  const engine = useRequestEngine(
    visibleOrders,
    visibleRides,
    null,
    null,
    config
  );

  if (!isOnline) {
    return null;
  }

  return (
    <>
      {/* Top tracker banner */}
      {trackerBannerEnabled && hasActiveTask && trackerBannerPosition === "top" && (
        <ActiveTaskBanner activeData={activeData} variant="green" />
      )}

      {hasActiveTask && !trackerBannerEnabled && (
        <ActiveTaskBanner activeData={activeData} variant="amber" />
      )}

      {/* Request list */}
      <div
        className={`overflow-hidden rounded-3xl shadow-sm transition-all duration-300 ${newFlash ? "ring-4 ring-green-400 ring-offset-2 ring-offset-page-bg" : ""}`}
      >
        {useNewBoard ? (
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
          />
        ) : (
          <>
            <RequestListHeader totalRequests={totalRequests} T={T} />
            <HomeRequestList
              requestsLoading={requestsLoading}
              requestsError={requestsError}
              totalRequests={totalRequests}
              dismissed={dismissed}
              onClearDismissed={onClearDismissed}
              orders={visibleOrders}
              rides={visibleRides}
              currency={currency}
              config={config}
              isOffline={isNetworkOffline}
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
              requestsServerTime={requestsServerTime}
              userId={userId}
              isRestricted={isRestricted}
              onRetry={onRetry}
              T={T}
            />
          </>
        )}
      </div>

      {/* Bottom tracker banner */}
      {trackerBannerEnabled && hasActiveTask && trackerBannerPosition === "bottom" && (
        <div className="mt-3">
          <ActiveTaskBanner activeData={activeData} variant="green" />
        </div>
      )}
    </>
  );
}
