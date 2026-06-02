import type { TranslationKey } from "@workspace/i18n";
import {
  CheckCircle,
  Clock,
  MapPin,
  MessageSquare,
  Navigation,
  SkipForward,
  X,
  Zap,
} from "lucide-react";
import { memo, useEffect, useState } from "react";
import { toast } from "@/hooks/use-toast";
import type { Ride } from "../../lib/api";
import type { PlatformConfig } from "../../lib/useConfig";
import { AcceptCountdown } from "./AcceptCountdown";
import { RideTypeIcon } from "./Icons";
import { MiniMap } from "./MiniMap";
import { RequestAge } from "./RequestAge";
import {
  ACCEPT_TIMEOUT_SEC,
  buildMapsDeepLink,
  formatCurrency,
  PRICING_DEFAULTS,
  SVC_NAMES,
} from "./helpers";

interface RideRequestCardProps {
  ride: Ride;
  userId: string;
  isRestricted: boolean;
  config: PlatformConfig;
  currency: string;
  onAccept: (id: string) => void;
  onCounter: (id: string, counterFare: number) => Promise<void>;
  onRejectOffer: (id: string) => void;
  onIgnore: (id: string) => void;
  onDismiss: (id: string) => void;
  acceptPending: boolean;
  counterPending: boolean;
  rejectOfferPending: boolean;
  ignorePending: boolean;
  anyAcceptPending: boolean;
  serverTime?: string | null;
  T: (key: TranslationKey) => string;
}

export const RideRequestCard = memo(function RideRequestCard({
  ride: r,
  userId,
  isRestricted,
  config,
  currency,
  onAccept,
  onCounter,
  onRejectOffer,
  onIgnore,
  onDismiss,
  acceptPending,
  counterPending,
  rejectOfferPending,
  ignorePending,
  anyAcceptPending,
  serverTime,
  T,
}: RideRequestCardProps) {
  const [counterInput, setCounterInput] = useState("");
  const [showCounterForm, setShowCounterForm] = useState(false);
  const [counterError, setCounterError] = useState("");
  const [localBidPending, setLocalBidPending] = useState(false);

  useEffect(() => {
    if (r.myBid && localBidPending) setLocalBidPending(false);
  }, [r.myBid, localBidPending]);

  const acceptTimeoutSec =
    config.rides.acceptTimeoutSec ?? config.dispatch?.broadcastTimeoutSec ?? ACCEPT_TIMEOUT_SEC;

  const isBargain = r.status === "bargaining" && r.offeredFare != null;
  const isDispatched = r.dispatchedRiderId === userId;
  const offeredFare = r.offeredFare ?? r.fare;
  const effectiveFare = isBargain ? offeredFare : r.fare;
  const clockOffset =
    serverTime && !Number.isNaN(new Date(serverTime).getTime())
      ? new Date(serverTime).getTime() - Date.now()
      : 0;
  const rideExpired =
    (Date.now() + clockOffset - new Date(r.createdAt).getTime()) / 1000 >= acceptTimeoutSec;

  const riderEarningPct = config.finance.riderEarningPct ?? PRICING_DEFAULTS.defaultRiderEarningPct;
  const earnings = effectiveFare != null ? Number(effectiveFare) * (riderEarningPct / 100) : null;

  const svcName = SVC_NAMES[r.type ?? ""] ?? r.type?.replace(/_/g, " ") ?? "Ride";
  const rideDistKm = r.distance != null ? parseFloat(String(r.distance)) : null;
  const etaMin =
    rideDistKm != null && rideDistKm > 0 ? Math.max(1, Math.round((rideDistKm / 30) * 60)) : null;

  const mapsUrl = buildMapsDeepLink(
    r.dropLat != null ? parseFloat(String(r.dropLat)) : null,
    r.dropLng != null ? parseFloat(String(r.dropLng)) : null,
    r.dropAddress ?? r.pickupAddress ?? null
  );

  const getMinFare = () => {
    const vt = r.vehicleType as string | undefined;
    if (vt === "car") return config.rides.carMinFare ?? PRICING_DEFAULTS.carMinFare;
    if (vt === "rickshaw") return config.rides.rickshawMinFare ?? PRICING_DEFAULTS.rickshawMinFare;
    if (vt === "daba") return config.rides.dabaMinFare ?? PRICING_DEFAULTS.dabaMinFare;
    return config.rides.bikeMinFare ?? PRICING_DEFAULTS.bikeMinFare;
  };

  const getMaxFare = () => {
    const maxMult = config.rides.counterMaxMultiplier ?? PRICING_DEFAULTS.counterMaxMultiplier;
    return Number(r.offeredFare ?? r.fare ?? 0) * maxMult;
  };

  const validateAndSubmitCounter = async () => {
    if (localBidPending || counterPending) {
      toast({ title: "Please wait, previous action still processing" });
      return;
    }
    const v = Number(counterInput || 0);
    const minFare = getMinFare();
    const maxFare = getMaxFare();
    if (!v || v < minFare) {
      setCounterError(`Minimum fare is ${formatCurrency(minFare, currency)}`);
      return;
    }
    if (v > maxFare) {
      setCounterError(`Cannot exceed ${formatCurrency(maxFare, currency)}`);
      return;
    }
    setCounterError("");
    setLocalBidPending(true);
    try {
      await onCounter(r.id, v);
      setCounterInput("");
      setShowCounterForm(false);
    } catch (err) {
      setCounterError(err instanceof Error ? err.message : "Failed to submit counter offer");
      setLocalBidPending(false);
    }
  };

  const pickupLat = r.pickupLat != null ? parseFloat(String(r.pickupLat)) : null;
  const pickupLng = r.pickupLng != null ? parseFloat(String(r.pickupLng)) : null;
  const dropLat = r.dropLat != null ? parseFloat(String(r.dropLat)) : null;
  const dropLng = r.dropLng != null ? parseFloat(String(r.dropLng)) : null;
  const hasValidPickupCoords =
    pickupLat != null &&
    Number.isFinite(pickupLat) &&
    pickupLng != null &&
    Number.isFinite(pickupLng);

  return (
    <div
      className={`animate-[slideUp_0.3s_ease-out] p-4 ${
        isDispatched
          ? "border-l-4 border-blue-500 bg-gradient-to-r from-blue-500/8 to-transparent"
          : isBargain
            ? "border-l-4 border-warning bg-gradient-to-r from-warning/8 to-transparent"
            : ""
      } transition-colors`}
    >
      <div className="flex items-start gap-3">
        <AcceptCountdown
          createdAt={r.createdAt}
          serverTime={serverTime}
          onExpired={() => onDismiss(r.id)}
          timeoutSec={acceptTimeoutSec}
        />
        <div
          className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl border shadow-sm ${
            isDispatched
              ? "border-blue-500/30 bg-gradient-to-br from-blue-500/15 to-indigo-500/15"
              : isBargain
                ? "border-warning/30 bg-gradient-to-br from-warning/15 to-amber-500/15"
                : "border-success/20 bg-gradient-to-br from-success/10 to-emerald-500/10"
          }`}
        >
          {isBargain ? (
            <MessageSquare size={20} className="text-warning" />
          ) : (
            <RideTypeIcon type={r.type ?? ""} />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-1.5">
            <p className="text-[15px] font-extrabold tracking-tight text-foreground">
              {svcName} Request
            </p>
            {/* Status badges — static dot + label (not full-badge pulse which blurs text) */}
            {isDispatched && (
              <span className="flex items-center gap-1 rounded-full border border-blue-500/30 bg-blue-500/15 px-2 py-0.5 text-[10px] font-bold text-blue-500">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-500" />
                DISPATCHED
              </span>
            )}
            {isBargain && (
              <span className="flex items-center gap-1 rounded-full border border-warning/40 bg-warning/15 px-2 py-0.5 text-[10px] font-bold text-warning">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-warning" />
                BARGAIN
              </span>
            )}
            {isBargain && r.myBid && (
              <span className="flex items-center gap-1 rounded-full border border-blue-500/30 bg-blue-500/15 px-2 py-0.5 text-[10px] font-bold text-blue-500">
                <CheckCircle size={9} /> Bid Sent
              </span>
            )}
            {r.isParcel && (
              <span className="flex items-center gap-1 rounded-full border border-warning/30 bg-warning/15 px-2 py-0.5 text-[10px] font-bold text-warning">
                📦 Parcel
              </span>
            )}
            {r.isPoolRide && (
              <span className="flex items-center gap-1 rounded-full border border-violet-500/30 bg-violet-500/15 px-2 py-0.5 text-[10px] font-bold text-violet-400">
                👥 Pool
              </span>
            )}
            <RequestAge createdAt={r.createdAt} />
          </div>

          {(r.riderDistanceKm != null || r.riderEtaMin != null) && (
            <div className="mb-1 flex items-center gap-2">
              {r.riderDistanceKm != null && (
                <span className="flex items-center gap-1 rounded-full border border-blue-200/60 bg-blue-500/10 px-2 py-0.5 text-[10px] font-bold text-blue-500">
                  <Navigation size={9} />
                  {r.riderDistanceKm < 1
                    ? `${Math.round(r.riderDistanceKm * 1000)}m`
                    : `${r.riderDistanceKm} km`}{" "}
                  away
                </span>
              )}
              {r.riderEtaMin != null && (
                <span className="flex items-center gap-1 rounded-full border border-purple-500/20 bg-purple-500/10 px-2 py-0.5 text-[10px] font-bold text-purple-400">
                  <Clock size={9} /> {r.riderEtaMin} min ETA
                </span>
              )}
            </div>
          )}

          <div className="mt-1 space-y-1">
            <p className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
              <span className="inline-block h-2 w-2 flex-shrink-0 rounded-full bg-success shadow-sm shadow-success/30" />
              {r.pickupAddress || "Pickup location"}
            </p>
            <p className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
              <span className="inline-block h-2 w-2 flex-shrink-0 rounded-full bg-error shadow-sm shadow-red-500/30" />
              {r.dropAddress || "Drop-off location"}
            </p>
          </div>

          {/* Earnings + metadata row — consistent styling between ride and order cards */}
          <div className="mt-2.5 flex flex-wrap items-center gap-2.5">
            {earnings != null && earnings > 0 ? (
              <div
                className={`rounded-xl border px-3 py-1.5 ${isBargain ? "border-warning/20 bg-warning/10" : "border-success/20 bg-success/10"}`}
              >
                <p
                  className={`text-base font-extrabold leading-tight ${isBargain ? "text-warning" : "text-success"}`}
                >
                  +{formatCurrency(earnings, currency)}
                </p>
                <p className="text-[10px] font-semibold text-muted-foreground">{T("yourEarnings")}</p>
              </div>
            ) : null}
            {isBargain && offeredFare != null && (
              <div className="rounded-xl border border-warning/20 bg-warning/5 px-2.5 py-1.5">
                <p className="text-sm font-bold text-warning">
                  {formatCurrency(offeredFare, currency)}
                </p>
                <p className="text-[10px] font-medium text-muted-foreground">{T("customerOffer")}</p>
              </div>
            )}
            {rideDistKm != null && rideDistKm > 0 && (
              <div>
                <p className="text-sm font-bold text-foreground">{rideDistKm.toFixed(1)} km</p>
                <p className="text-[10px] font-medium text-muted-foreground">{T("distance")}</p>
              </div>
            )}
            {etaMin != null && (
              <div>
                <p className="text-sm font-bold text-blue-500">{etaMin} min</p>
                <p className="text-[10px] font-medium text-muted-foreground">ETA</p>
              </div>
            )}
            {r.fare != null && isBargain && (
              <div>
                <p className="text-sm font-bold text-muted-foreground line-through">
                  {formatCurrency(r.fare, currency)}
                </p>
                <p className="text-[10px] font-medium text-muted-foreground">{T("platformFare")}</p>
              </div>
            )}
          </div>

          {r.bargainNote && (
            <div className="mt-2.5 rounded-xl border border-warning/20 bg-warning/8 px-3 py-2">
              <p className="flex items-center gap-1.5 text-xs text-warning italic">
                <MessageSquare size={11} className="flex-shrink-0" /> "{r.bargainNote}"
              </p>
            </div>
          )}
        </div>
      </div>

      {hasValidPickupCoords && (
        <MiniMap pickupLat={pickupLat} pickupLng={pickupLng} dropLat={dropLat} dropLng={dropLng} />
      )}

      {/* Normal ride action bar */}
      {!isBargain && (
        <div className="mt-3 flex gap-2">
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Open pickup location in maps"
            className="flex min-h-[44px] items-center gap-1 rounded-xl border border-blue-500/30 bg-blue-500/10 px-3 text-xs font-bold text-blue-500 transition-colors hover:bg-blue-500/20"
          >
            <MapPin size={14} />
          </a>
          {isDispatched ? (
            <button
              onClick={() => onIgnore(r.id)}
              disabled={ignorePending || acceptPending || anyAcceptPending}
              className="flex min-h-[44px] items-center gap-1.5 rounded-xl border border-warning/40 bg-warning/8 px-3 text-sm font-bold text-warning transition-colors hover:bg-warning/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-warning/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:opacity-60"
              aria-label="Ignore dispatched ride"
            >
              <SkipForward size={14} /> Ignore
            </button>
          ) : (
            <button
              onClick={() => onDismiss(r.id)}
              className="flex min-h-[44px] items-center rounded-xl border border-border px-3 text-sm font-bold text-muted-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
              aria-label="Dismiss ride request"
            >
              <X size={16} />
            </button>
          )}
          <button
            onClick={() => onAccept(r.id)}
            disabled={
              rideExpired || acceptPending || anyAcceptPending || ignorePending || !!isRestricted
            }
            className="flex min-h-[48px] flex-1 items-center justify-center gap-1.5 rounded-xl bg-brand py-3 text-sm font-extrabold text-white shadow-md shadow-brand/25 transition-all hover:bg-brand-hover hover:shadow-lg active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:opacity-60"
            aria-label="Accept ride"
          >
            <CheckCircle size={16} />
            {acceptPending ? T("accepting") : T("acceptRide")}
          </button>
        </div>
      )}

      {/* Bargain flow */}
      {isBargain && (
        <div className="mt-3 space-y-2">
          {localBidPending && !r.myBid ? (
            <div className="flex items-center gap-3 rounded-xl border-2 border-indigo-500/30 bg-gradient-to-r from-indigo-500/10 to-blue-500/10 p-3.5">
              <div className="h-5 w-5 flex-shrink-0 animate-spin rounded-full border-2 border-indigo-400 border-t-transparent" />
              <div className="flex-1">
                <p className="text-xs font-bold text-indigo-500">
                  Bid Submitted — Waiting for Response
                </p>
                <p className="mt-0.5 text-[10px] text-indigo-400">
                  Your counter offer is being sent to the customer…
                </p>
              </div>
              <span className="animate-pulse rounded-full border border-indigo-300 bg-indigo-500/15 px-2.5 py-1 text-[10px] font-bold text-indigo-500">
                PENDING
              </span>
            </div>
          ) : r.myBid ? (
            /* Bid already placed — show update form */
            <div className="space-y-2.5 rounded-xl border-2 border-warning/30 bg-gradient-to-r from-warning/10 to-amber-500/10 p-3.5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="flex items-center gap-1 text-xs font-bold text-warning">
                    <MessageSquare size={11} /> Your Bid Pending
                  </p>
                  <p className="text-lg font-extrabold text-warning">
                    {formatCurrency(r.myBid.fare, currency)}
                  </p>
                </div>
                <span className="flex items-center gap-1.5 rounded-full border border-warning/30 bg-warning/15 px-2.5 py-1 text-[10px] font-bold text-warning">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-warning" />
                  WAITING
                </span>
              </div>
              <div className="flex gap-2">
                <input
                  type="number"
                  inputMode="numeric"
                  min="0.01"
                  max={String(getMaxFare())}
                  step="0.5"
                  value={counterInput}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === "" || Number(val) >= 0) setCounterInput(val);
                    if (counterError) setCounterError("");
                  }}
                  placeholder="Update bid..."
                  className={`h-11 flex-1 rounded-xl border bg-card px-3 text-sm focus:ring-2 focus:outline-none ${
                    counterError
                      ? "border-error/60 focus:border-error focus:ring-error/20"
                      : "border-border focus:border-warning/40 focus:ring-warning/20"
                  }`}
                  aria-label="Update counter fare amount"
                />
                <button
                  onClick={validateAndSubmitCounter}
                  disabled={counterPending || rideExpired || !!isRestricted}
                  className="min-h-[44px] rounded-xl bg-warning px-4 py-2.5 text-sm font-bold text-white transition-colors hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:opacity-60"
                  aria-label="Update counter bid"
                >
                  Update
                </button>
                <button
                  onClick={() => onAccept(r.id)}
                  disabled={rideExpired || acceptPending || anyAcceptPending || !!isRestricted}
                  className="flex min-h-[44px] items-center gap-1.5 rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-white shadow-sm shadow-brand/20 transition-colors hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:opacity-60"
                  aria-label="Accept ride at current fare"
                >
                  <CheckCircle size={14} /> Accept
                </button>
              </div>
              {counterError && <p className="text-xs font-semibold text-error">{counterError}</p>}
            </div>
          ) : showCounterForm ? (
            /* Counter form — open */
            <div className="space-y-2">
              <div className="flex gap-2">
                <input
                  type="number"
                  inputMode="numeric"
                  min="0.01"
                  max={String(getMaxFare())}
                  step="0.5"
                  value={counterInput}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === "" || Number(val) >= 0) setCounterInput(val);
                    if (counterError) setCounterError("");
                  }}
                  placeholder="Your counter fare..."
                  className={`h-11 flex-1 rounded-xl border bg-card px-4 text-sm focus:ring-2 focus:outline-none ${
                    counterError
                      ? "border-error/60 focus:border-error focus:ring-error/20"
                      : "border-border focus:border-warning focus:ring-warning/20"
                  }`}
                  aria-label="Enter counter fare amount"
                />
                <button
                  onClick={validateAndSubmitCounter}
                  disabled={counterPending || rideExpired || !!isRestricted}
                  className="min-h-[44px] rounded-xl bg-warning px-4 py-2.5 text-sm font-extrabold text-white transition-colors hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:opacity-60"
                  aria-label="Submit counter offer"
                >
                  {counterPending ? "Sending…" : "Submit"}
                </button>
                <button
                  onClick={() => {
                    setShowCounterForm(false);
                    setCounterError("");
                  }}
                  className="flex min-h-[44px] items-center rounded-xl border border-border px-3 py-2.5 text-muted-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
                  aria-label="Cancel counter offer"
                >
                  <X size={15} />
                </button>
              </div>
              {counterError && (
                <p className="px-1 text-xs font-semibold text-error">{counterError}</p>
              )}
            </div>
          ) : (
            /* Bargain default CTA row */
            <div className="flex gap-2">
              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Open location in maps"
                className="flex min-h-[44px] items-center gap-1 rounded-xl border border-blue-500/30 bg-blue-500/10 px-3 text-xs font-bold text-blue-500 transition-colors hover:bg-blue-500/20"
              >
                <MapPin size={14} />
              </a>
              <button
                onClick={() => onRejectOffer(r.id)}
                disabled={rejectOfferPending}
                className="flex min-h-[44px] items-center rounded-xl border border-border px-3 text-sm font-bold text-muted-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:opacity-50"
                aria-label="Reject ride offer"
              >
                <X size={16} />
              </button>
              <button
                onClick={() => setShowCounterForm(true)}
                className="flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-xl border border-warning/40 bg-warning/12 py-2.5 text-sm font-extrabold text-warning transition-all hover:bg-warning/20 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-warning/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
                aria-label="Make counter offer"
              >
                <MessageSquare size={14} /> Counter
              </button>
              <button
                onClick={() => onAccept(r.id)}
                disabled={rideExpired || acceptPending || anyAcceptPending || !!isRestricted}
                className="flex min-h-[48px] flex-1 items-center justify-center gap-1.5 rounded-xl bg-brand py-3 text-sm font-extrabold text-white shadow-md shadow-brand/25 transition-all hover:bg-brand-hover hover:shadow-lg active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:opacity-60"
                aria-label="Accept ride"
              >
                <CheckCircle size={16} />
                Accept
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
});
