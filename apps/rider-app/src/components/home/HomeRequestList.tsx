import { AlertTriangle, Bike, Eye, RefreshCw } from "lucide-react";
import type { Order, Ride } from "../../lib/api";
import { OrderRequestCard, RideRequestCard } from "../dashboard";
import { ShimmerBlock } from "../ui/shimmer";

function getDeliveryEarn(type: string, config: any): number {
  const df = config.deliveryFee;
  let fee: number;
  if (typeof df === "number") {
    fee = df;
  } else if (df && typeof df === "object") {
    const raw = (df as Record<string, unknown>)[type] ?? (df as Record<string, unknown>).mart ?? 0;
    fee = typeof raw === "number" ? raw : parseFloat(String(raw)) || 0;
  } else {
    fee = parseFloat(String(df)) || 0;
  }
  return fee * ((config?.finance?.riderEarningPct ?? 80) / 100);
}

interface HomeRequestListProps {
  requestsLoading: boolean;
  requestsError: boolean;
  totalRequests: number;
  dismissed: Set<string>;
  onClearDismissed: () => void;
  orders: Order[];
  rides: Ride[];
  currency: string;
  config: any;
  isOffline?: boolean;
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
  acceptingRideId?: string | null;
  acceptingOrderId?: string | null;
  counterRidePending: boolean;
  rejectOfferPending: boolean;
  ignoreRidePending: boolean;
  requestsServerTime: string | null;
  userId: string;
  isRestricted: boolean;
  onRetry: () => void;
  T: (key: import("@workspace/i18n").TranslationKey) => string;
}

export function HomeRequestList({
  requestsLoading,
  requestsError,
  totalRequests,
  dismissed,
  onClearDismissed,
  orders,
  rides,
  currency,
  config,
  isOffline,
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
  requestsServerTime,
  userId,
  isRestricted,
  onRetry,
  T,
}: HomeRequestListProps) {
  if (requestsLoading) {
    return (
      <div className="space-y-px bg-card p-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-start gap-3 rounded-2xl p-3">
            {/* Countdown ring shimmer */}
            <ShimmerBlock className="h-11 w-11 flex-shrink-0 rounded-full" />
            {/* Icon well shimmer */}
            <ShimmerBlock className="h-12 w-12 flex-shrink-0 rounded-2xl" />
            <div className="flex-1 space-y-2">
              <ShimmerBlock className="h-4 w-2/5 rounded-lg" />
              <ShimmerBlock className="h-3 w-3/5 rounded-lg" />
              <ShimmerBlock className="h-3 w-1/2 rounded-lg" />
            </div>
            <ShimmerBlock className="h-12 w-20 flex-shrink-0 rounded-2xl" />
          </div>
        ))}
      </div>
    );
  }

  if (requestsError) {
    return (
      <div className="bg-card p-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-error/10">
          <AlertTriangle size={26} className="text-error" />
        </div>
        <p className="text-sm font-bold text-foreground">{T("couldNotLoadRequests")}</p>
        <p className="mt-1 text-xs text-muted-foreground">{T("checkConnectionTryAgain")}</p>
        <button
          onClick={onRetry}
          className="mt-4 inline-flex items-center gap-2 rounded-xl border border-border bg-muted/40 px-4 py-2.5 text-sm font-bold text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
        >
          <RefreshCw size={14} />
          {T("retry")}
        </button>
      </div>
    );
  }

  if (totalRequests === 0) {
    return (
      <div className="bg-card p-8 text-center sm:p-10">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/50 sm:h-[72px] sm:w-[72px]">
          <Bike size={30} className="text-muted-foreground" />
        </div>
        <p className="text-sm font-bold text-foreground sm:text-base">{T("noRequestsNow")}</p>
        <p className="mt-1.5 text-xs text-muted-foreground">{T("autoRefreshes")}</p>
        {dismissed.size > 0 && (
          <button
            onClick={onClearDismissed}
            className="mt-4 inline-flex items-center gap-1.5 rounded-xl border border-border bg-muted/40 px-4 py-2.5 text-xs font-bold text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
            aria-label={`${T("show")} ${dismissed.size} ${dismissed.size > 1 ? T("hiddenRequests") : T("hiddenRequest")}`}
          >
            <Eye size={13} /> {T("show")} {dismissed.size} {dismissed.size > 1 ? T("hiddenRequests") : T("hiddenRequest")}
          </button>
        )}
      </div>
    );
  }

  return (
    /* divide-border uses the CSS variable — not the hardcoded gray-100 that breaks dark mode */
    <div className="divide-y divide-border bg-card">
      {isOffline && (
        <div className="flex items-center gap-2 bg-error/15 px-4 py-3 text-xs font-semibold text-error">
          <span className="h-2 w-2 flex-shrink-0 rounded-full bg-error" />
          {T("noInternetAcceptDisabled")}
        </div>
      )}
      {orders.filter((o) => config?.features?.[o.type ?? ""] !== false).map((o) => (
        <OrderRequestCard
          key={o.id}
          order={o}
          earnings={getDeliveryEarn(o.type ?? "", config)}
          currency={currency}
          config={config}
          onAccept={onAcceptOrder}
          onReject={onRejectOrder}
          onDismiss={onDismiss}
          acceptPending={acceptingOrderId === o.id || !!isOffline}
          rejectPending={rejectOrderPending}
          anyAcceptPending={acceptRidePending || !!isOffline}
          serverTime={requestsServerTime}
          isRestricted={isRestricted}
          T={T}
        />
      ))}
      {config?.features?.rides !== false && rides.filter((r) =>
        r.type !== "van" || config?.features?.van !== false
      ).map((r) => (
        <RideRequestCard
          key={r.id}
          ride={r}
          userId={userId}
          isRestricted={isRestricted}
          config={config}
          currency={currency}
          onAccept={onAcceptRide}
          onCounter={onCounterRide}
          onRejectOffer={onRejectOffer}
          onIgnore={onIgnoreRide}
          onDismiss={onDismiss}
          acceptPending={acceptingRideId === r.id || acceptRidePending || !!isOffline}
          counterPending={counterRidePending}
          rejectOfferPending={rejectOfferPending}
          ignorePending={ignoreRidePending}
          anyAcceptPending={acceptOrderPending || (acceptRidePending && acceptingRideId !== r.id) || !!isOffline}
          serverTime={requestsServerTime}
          T={T}
        />
      ))}
    </div>
  );
}
