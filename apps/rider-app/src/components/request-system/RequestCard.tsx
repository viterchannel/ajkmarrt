import { memo, useMemo, useState } from "react";
import { type TranslationKey } from "@workspace/i18n";
import {
  CheckCircle,
  Clock,
  Crown,
  MapPin,
  Navigation,
  Package,
  X,
  XCircle,
  ArrowUpCircle,
  TrendingUp,
  Bookmark,
  BookmarkCheck,
  ListOrdered,
  Users,
} from "lucide-react";
import type { UnifiedRequest } from "../../lib/request-engine/types";
import type { UseRequestEngineReturn } from "../../lib/request-engine/useRequestEngine";
import { formatCurrency, timeAgo } from "../dashboard/helpers";
import { AcceptCountdown } from "../dashboard/AcceptCountdown";
import { OrderTypeIcon } from "../dashboard/Icons";
import { MiniMap } from "../dashboard/MiniMap";
import { EarningsCalculator } from "./EarningsCalculator";
import { ReservationTimer } from "./ReservationTimer";
import { CollaborationPanel } from "./CollaborationPanel";

interface RequestCardProps {
  request: UnifiedRequest;
  engine: UseRequestEngineReturn;
  currency: string;
  config: any;
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
  isNetworkOffline: boolean;
}

export const RequestCard = memo(function RequestCard({
  request,
  engine,
  currency,
  config,
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
  isNetworkOffline,
}: RequestCardProps) {
  const isOrder = request._kind === "order";
  const isRide = request._kind === "ride";
  const r = request as any;

  const vp = engine.getVendorPriority(request);
  const score = engine.getScore(request);
  const reservation = request.reservation;
  const queuePos = engine.queuePosition(request.id);
  const isQueued = queuePos != null;
  const isInterested = isRide && ((request as any).collaboration ?? []).some((c: any) => c.riderId === "me");
  const collabCount = isRide ? ((request as any).collaboration ?? []).length : 0;

  const isAccepting = isOrder ? acceptingOrderId === request.id : acceptingRideId === request.id;
  const anyAcceptPending = !!acceptingOrderId || !!acceptingRideId;
  const isExpired = (r.timer ?? 0) <= 0;

  const [showScore, setShowScore] = useState(false);
  const [showReject, setShowReject] = useState(false);

  /* Reservation timer */
  const hasReservation = !!reservation;
  const canReserve = !hasReservation && !isExpired && !isRestricted;
  const isReserved = hasReservation && reservation!.expiresAt > Date.now();

  /* Vendor tier badge */
  const tierBadge = useMemo(() => {
    if (!vp) return null;
    const colors: Record<string, string> = {
      vip: "bg-purple-500 text-white",
      standard: "bg-blue-500 text-white",
      new: "bg-muted text-muted",
    };
    return (
      <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-extrabold ${colors[vp.tier]}`}>
        <Crown size={9} />
        {vp.tier.toUpperCase()}
      </span>
    );
  }, [vp]);

  /* Score badge */
  const scoreBadge = useMemo(() => {
    if (!score) return null;
    const color = score.composite >= 80 ? "bg-success text-white" : score.composite >= 50 ? "bg-warning text-white" : "bg-muted text-muted";
    return (
      <button
        onClick={() => setShowScore(!showScore)}
        className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-extrabold ${color}`}
      >
        <TrendingUp size={9} />
        {score.composite}
      </button>
    );
  }, [score, showScore]);

  /* Queue badge */
  const queueBadge = isQueued ? (
    <span className="flex items-center gap-1 rounded-full bg-info/15 px-2 py-0.5 text-[10px] font-extrabold text-info">
      <ListOrdered size={9} />
      #{queuePos}
    </span>
  ) : null;

  /* Collaboration badge */
  const collabBadge = collabCount > 0 ? (
    <span className="flex items-center gap-1 rounded-full bg-indigo-500/15 px-2 py-0.5 text-[10px] font-extrabold text-indigo-500">
      <Users size={9} />
      {collabCount}
    </span>
  ) : null;

  const handleAccept = () => {
    if (isOrder) onAcceptOrder(request.id);
    else onAcceptRide(request.id);
  };

  const handleReject = () => {
    if (isOrder) onRejectOrder(request.id);
    else onRejectOffer(request.id);
  };

  return (
    <div className={`relative rounded-2xl border bg-card p-3 shadow-sm transition-all ${isReserved ? "border-purple-500/40 shadow-purple-500/10" : "border-border"}`}>
      {/* Badges row */}
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        {tierBadge}
        {scoreBadge}
        {queueBadge}
        {collabBadge}
        {isReserved && (
          <span className="flex items-center gap-1 rounded-full bg-purple-500/15 px-2 py-0.5 text-[10px] font-extrabold text-purple-500">
            <BookmarkCheck size={9} />
            Reserved
          </span>
        )}
        {isNetworkOffline && (
          <span className="flex items-center gap-1 rounded-full bg-warning/15 px-2 py-0.5 text-[10px] font-extrabold text-warning">
            <Clock size={9} />
            Queued
          </span>
        )}
        <button
          onClick={() => onDismiss(request.id)}
          className="ml-auto rounded-full p-1 text-muted hover:bg-muted/50 hover:text-default"
          aria-label="Dismiss"
        >
          <X size={14} />
        </button>
      </div>

      {/* Score breakdown popup */}
      {showScore && score && (
        <div className="mb-2 rounded-xl bg-muted/50 p-2 text-[10px]">
          <div className="grid grid-cols-2 gap-1">
            <span className="text-muted">Distance: {score.distanceScore}</span>
            <span className="text-muted">Fare: {score.fareScore}</span>
            <span className="text-muted">Urgency: {score.urgencyScore}</span>
            <span className="text-muted">Vendor: {score.vendorBonusScore}</span>
          </div>
        </div>
      )}

      {/* Header: type, address, timer */}
      <div className="flex items-start gap-2">
        <div className="mt-0.5 flex-shrink-0">
          {isOrder ? (
            <OrderTypeIcon type={r.type ?? "mart"} />
          ) : (
            <Navigation size={18} className="text-brand" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-extrabold text-default truncate">
              {isOrder ? r.pickupAddress ?? r.address ?? "Delivery" : r.pickupAddress ?? "Ride"}
            </h3>
            <span className="text-[10px] text-muted whitespace-nowrap">{timeAgo(r.createdAt)}</span>
          </div>
          <p className="mt-0.5 text-xs text-muted truncate">
            <MapPin size={10} className="inline mr-1" />
            {isOrder ? r.dropAddress ?? "Unknown drop" : r.dropAddress ?? "Unknown destination"}
          </p>
        </div>
        <div className="flex-shrink-0">
          <AcceptCountdown
            createdAt={r.createdAt}
            timeoutSec={r.timer ?? 90}
            serverTime={r._serverTime}
          />
        </div>
      </div>

      {/* Mini map */}
      {(r.pickupLat != null && r.pickupLng != null) && (
        <div className="mt-2 rounded-xl overflow-hidden border border-border">
          <MiniMap
            pickupLat={r.pickupLat}
            pickupLng={r.pickupLng}
            dropLat={r.dropLat}
            dropLng={r.dropLng}
          />
        </div>
      )}

      {/* Fare & details */}
      <div className="mt-2 flex items-center justify-between">
        <div>
          <p className="text-lg font-extrabold text-default">
            {formatCurrency(r.fare, currency)}
          </p>
          <p className="text-[10px] text-muted">
            {isOrder ? (
              <>
                <Package size={9} className="inline mr-1" />
                {r.items?.length ?? 0} items · {r.type ?? "mart"}
              </>
            ) : (
              <>
                <Navigation size={9} className="inline mr-1" />
                {r.type ?? "standard"} · {r.distance ? `${r.distance} km` : ""}
              </>
            )}
          </p>
        </div>
        {r.paymentMethod && (
          <span className="rounded-full bg-muted px-2 py-1 text-[10px] font-bold text-muted capitalize">
            {r.paymentMethod}
          </span>
        )}
      </div>

      {/* Earnings calculator */}
      <div className="mt-2">
        <EarningsCalculator request={request} engine={engine} currency={currency} T={T} />
      </div>

      {/* Reservation timer */}
      {isReserved && (
        <div className="mt-2">
          <ReservationTimer
            reservation={reservation!}
            onExtend={() => engine.extendReservation(request.id)}
            onCancel={() => engine.cancelReservation(request.id)}
            T={T}
          />
        </div>
      )}

      {/* Collaboration panel (group rides) */}
      {isRide && (r.type === "shared" || r.type === "pool") && (
        <div className="mt-2">
          <CollaborationPanel
            rideId={request.id}
            interests={request.collaboration ?? []}
            isInterested={isInterested}
            onExpress={() => engine.expressInterest(request.id)}
            onWithdraw={() => engine.withdrawInterest(request.id)}
            T={T}
          />
        </div>
      )}

      {/* Action buttons */}
      <div className="mt-3 flex gap-2">
        {!showReject ? (
          <>
            {/* Reserve button */}
            {canReserve && (
              <button
                onClick={() => engine.reserveRequest(request.id, request._kind)}
                disabled={isAccepting || anyAcceptPending}
                className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border-2 border-purple-500/30 bg-purple-500/10 px-3 py-2 text-[11px] font-bold text-purple-500 transition-all hover:bg-purple-500/20 disabled:opacity-50"
              >
                <Bookmark size={14} />
                {T("reserve")}
              </button>
            )}

            {/* Queue button */}
            <button
              onClick={() => engine.toggleQueue(request.id, request._kind)}
              className={`flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border-2 px-3 py-2 text-[11px] font-bold transition-all ${
                isQueued
                  ? "border-info/30 bg-info/10 text-info"
                  : "border-border bg-muted/30 text-muted hover:bg-muted"
              }`}
            >
              <ListOrdered size={14} />
              {isQueued ? T("queued") : T("queue")}
            </button>

            {/* Reject */}
            <button
              onClick={() => setShowReject(true)}
              disabled={isAccepting || anyAcceptPending}
              className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-error/30 bg-error/10 px-3 py-2 text-[11px] font-bold text-error transition-all hover:bg-error/20 disabled:opacity-50"
            >
              <XCircle size={14} />
            </button>

            {/* Accept */}
            <button
              onClick={handleAccept}
              disabled={isExpired || isAccepting || anyAcceptPending || !!isRestricted || isReserved}
              className="flex min-h-[48px] flex-1 items-center justify-center gap-1.5 rounded-xl bg-brand py-2.5 text-sm font-extrabold text-white shadow-md shadow-brand/25 transition-all hover:bg-brand-hover hover:shadow-lg active:scale-[0.98] disabled:opacity-60"
            >
              <CheckCircle size={16} />
              {isAccepting ? T("accepting") : isReserved ? T("reserved") : T("accept")}
            </button>
          </>
        ) : (
          <div className="flex w-full gap-2">
            <button
              onClick={() => setShowReject(false)}
              className="flex min-h-[44px] flex-1 items-center justify-center rounded-xl border border-border bg-muted/30 text-xs font-bold text-muted"
            >
              {T("cancel")}
            </button>
            <button
              onClick={handleReject}
              disabled={rejectOrderPending || rejectOfferPending}
              className="flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-xl bg-error py-2.5 text-xs font-extrabold text-white transition-all hover:opacity-90 active:scale-[0.98]"
            >
              <XCircle size={14} />
              {T("rejectConfirm")}
            </button>
          </div>
        )}
      </div>

      {/* Counter offer (rides only) */}
      {isRide && !isExpired && !isAccepting && !showReject && !isReserved && (
        <div className="mt-2 border-t border-border pt-2">
          <button
            onClick={() => {
              const fare = Number(r.fare ?? 0) * 1.2;
              onCounterRide(request.id, fare);
            }}
            disabled={counterRidePending || isRestricted}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl border-2 border-warning/30 bg-warning/10 py-2 text-[11px] font-bold text-warning transition-all hover:bg-warning/20 disabled:opacity-50"
          >
            <ArrowUpCircle size={14} />
            {counterRidePending ? T("sendingCounter") : T("counterOffer")}
          </button>
        </div>
      )}
    </div>
  );
});
