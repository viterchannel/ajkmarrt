import { Wifi, Zap } from "lucide-react";
import { Link } from "wouter";
import type { TranslationKey } from "@workspace/i18n";
import type { Order, Ride } from "../../lib/api";
import { HomeRequestList } from "./HomeRequestList";
import { RequestListHeader } from "../dashboard/RequestListHeader";
import { ActiveTaskBanner } from "../dashboard/ActiveTaskBanner";

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
  if (!isOnline) {
    return (
      <div className="animate-[slideUp_0.3s_ease-out] rounded-3xl border border-white/10 bg-card-dark p-8 text-center shadow-sm sm:p-10">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-border-dark sm:h-20 sm:w-20">
          <Wifi size={32} className="text-[#B0B0B0]" />
        </div>
        <p className="text-base font-extrabold tracking-tight text-[#B0B0B0] sm:text-lg">
          You are Offline
        </p>
        <p className="mt-1.5 text-sm text-[#B0B0B0]">
          Toggle the switch above to start accepting orders
        </p>
        <button
          onClick={onGoOnline}
          disabled={toggling}
          className="mt-5 inline-flex items-center gap-2 rounded-xl bg-brand px-6 py-3 text-sm font-bold text-white shadow-sm shadow-brand/20 transition-all hover:bg-brand-hover active:scale-[0.98] disabled:opacity-60"
          aria-label="Go online to start accepting orders"
        >
          <Zap size={16} /> Go Online
        </button>
      </div>
    );
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
