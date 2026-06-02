import type { TranslationKey } from "@workspace/i18n";
import { CheckCircle, MapPin, Navigation, X, XCircle } from "lucide-react";
import { memo, useEffect, useState } from "react";
import { toast } from "sonner";
import type { Order } from "../../lib/api";
import type { PlatformConfig } from "../../lib/useConfig";
import { AcceptCountdown } from "./AcceptCountdown";
import { OrderTypeIcon } from "./Icons";
import { MiniMap } from "./MiniMap";
import { RequestAge } from "./RequestAge";
import { ACCEPT_TIMEOUT_SEC, buildMapsDeepLink, formatCurrency, PRICING_DEFAULTS } from "./helpers";

interface OrderRequestCardProps {
  order: Order;
  earnings: number;
  currency: string;
  config?: PlatformConfig;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
  onDismiss: (id: string) => void;
  acceptPending: boolean;
  rejectPending: boolean;
  anyAcceptPending: boolean;
  serverTime?: string | null;
  isRestricted?: boolean;
  T: (key: TranslationKey) => string;
}

export const OrderRequestCard = memo(function OrderRequestCard({
  order: o,
  earnings,
  currency,
  config,
  onAccept,
  onReject,
  onDismiss,
  acceptPending,
  rejectPending,
  anyAcceptPending,
  serverTime,
  isRestricted = false,
  T,
}: OrderRequestCardProps) {
  const [showRejectConfirm, setShowRejectConfirm] = useState(false);

  useEffect(() => {
    if (!config?.features) return;
    const type = (o.type ?? "mart") as keyof typeof config.features;
    if (config.features[type] === false) {
      onDismiss(o.id);
    }
  }, [config?.features, o.id, o.type, onDismiss]);

  const acceptTimeoutSec =
    config?.rides?.acceptTimeoutSec ?? config?.dispatch?.broadcastTimeoutSec ?? ACCEPT_TIMEOUT_SEC;

  const clockOffset =
    serverTime && !Number.isNaN(new Date(serverTime).getTime())
      ? new Date(serverTime).getTime() - Date.now()
      : 0;
  const isExpired =
    (Date.now() + clockOffset - new Date(o.createdAt).getTime()) / 1000 >= acceptTimeoutSec;

  const orderType = o.type ?? "delivery";
  const orderTotal =
    typeof o.total === "number"
      ? o.total
      : typeof o.total === "string"
        ? parseFloat(o.total)
        : null;
  const itemCount = o.itemCount ?? o.item_count ?? null;
  const distanceKm = o.distanceKm ?? o.distance_km ?? null;
  const deliveryAddress = o.deliveryAddress ?? o.delivery_address ?? null;
  const vendorStoreName = o.vendorStoreName ?? o.vendor_store_name ?? null;
  const configDeliveryFee = (() => {
    if (!config?.deliveryFee) return PRICING_DEFAULTS.defaultDeliveryFee;
    if (orderType === "food") return config.deliveryFee.food ?? PRICING_DEFAULTS.defaultDeliveryFee;
    if (orderType === "pharmacy")
      return config.deliveryFee.pharmacy ?? PRICING_DEFAULTS.defaultDeliveryFee;
    if (orderType === "parcel")
      return config.deliveryFee.parcel ?? PRICING_DEFAULTS.defaultDeliveryFee;
    return config.deliveryFee.mart ?? PRICING_DEFAULTS.defaultDeliveryFee;
  })();
  const deliveryFee =
    typeof earnings === "number" && Number.isFinite(earnings) ? earnings : configDeliveryFee;

  const vendorLat = o.vendorLat != null ? parseFloat(String(o.vendorLat)) : null;
  const vendorLng = o.vendorLng != null ? parseFloat(String(o.vendorLng)) : null;
  const deliveryLat = o.deliveryLat != null ? parseFloat(String(o.deliveryLat)) : null;
  const deliveryLng = o.deliveryLng != null ? parseFloat(String(o.deliveryLng)) : null;
  const hasValidVendorCoords =
    vendorLat != null &&
    Number.isFinite(vendorLat) &&
    vendorLng != null &&
    Number.isFinite(vendorLng);

  return (
    <div className="animate-[slideUp_0.3s_ease-out] p-4">
      <div className="flex items-start gap-3">
        <AcceptCountdown
          createdAt={o.createdAt}
          serverTime={serverTime}
          onExpired={() => onDismiss(o.id)}
          timeoutSec={acceptTimeoutSec}
        />
        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-indigo-50 shadow-sm">
          <OrderTypeIcon type={orderType} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-0.5 flex flex-wrap items-center gap-2">
            <p className="text-[15px] font-extrabold tracking-tight text-foreground">
              {orderType.charAt(0).toUpperCase() + orderType.slice(1)} Delivery
            </p>
            <RequestAge createdAt={o.createdAt} />
          </div>
          {vendorStoreName ? (
            <p className="flex items-center gap-1 truncate text-xs font-semibold text-blue-400">
              <MapPin size={10} /> {vendorStoreName}
            </p>
          ) : null}
          <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
            <Navigation size={10} className="text-muted-foreground" /> {deliveryAddress || "Destination"}
          </p>
        </div>
        {/* Earnings badge — label uses text-white/70 for WCAG contrast on green bg */}
        {deliveryFee > 0 ? (
          <div className="flex-shrink-0 rounded-2xl bg-success px-3 py-2 text-right shadow-sm shadow-green-300/30">
            <p className="text-base font-extrabold leading-tight text-white">
              +{formatCurrency(deliveryFee, currency)}
            </p>
            <p className="text-[10px] font-semibold text-white/70">{T("yourEarnings")}</p>
          </div>
        ) : (
          <div className="flex-shrink-0 rounded-2xl bg-muted px-3 py-2 text-right">
            <p className="text-sm font-bold leading-tight text-muted-foreground">—</p>
            <p className="text-[10px] font-semibold text-muted-foreground">{T("yourEarnings")}</p>
          </div>
        )}
      </div>

      {(orderTotal != null || itemCount != null || distanceKm != null) && (
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          {orderTotal != null && Number.isFinite(orderTotal) && (
            <div className="rounded-xl border border-border bg-muted/30 px-2.5 py-1.5">
              <p className="text-xs font-bold text-foreground">
                {formatCurrency(orderTotal, currency)}
              </p>
              <p className="text-[10px] text-muted-foreground">{T("orderTotal")}</p>
            </div>
          )}
          {itemCount != null && Number(itemCount) > 0 && (
            <div className="rounded-xl border border-border bg-muted/30 px-2.5 py-1.5">
              <p className="text-xs font-bold text-foreground">{Number(itemCount)} items</p>
              <p className="text-[10px] text-muted-foreground">{T("toCollect")}</p>
            </div>
          )}
          {distanceKm != null && parseFloat(String(distanceKm)) > 0 && (
            <div className="rounded-xl border border-blue-200/60 bg-blue-500/10 px-2.5 py-1.5">
              <p className="text-xs font-bold text-blue-500">
                {parseFloat(String(distanceKm)).toFixed(1)} km
              </p>
              <p className="text-[10px] text-blue-400">{T("distance")}</p>
            </div>
          )}
        </div>
      )}

      {hasValidVendorCoords && (
        <MiniMap
          pickupLat={vendorLat}
          pickupLng={vendorLng}
          dropLat={deliveryLat}
          dropLng={deliveryLng}
        />
      )}

      {showRejectConfirm ? (
        <div className="mt-3 animate-[slideUp_0.15s_ease-out] rounded-2xl border border-error/20 bg-error/8 p-3.5">
          <p className="mb-3 text-sm font-semibold text-error">
            Reject this order request?
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setShowRejectConfirm(false)}
              className="flex min-h-[44px] flex-1 items-center justify-center rounded-xl border border-border bg-card px-3 py-2.5 text-sm font-bold text-muted-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
              aria-label="Cancel rejection"
            >
              Keep It
            </button>
            <button
              onClick={async () => {
                setShowRejectConfirm(false);
                try {
                  await onReject(o.id);
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Failed to reject order");
                }
              }}
              disabled={rejectPending}
              className="flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-xl bg-error px-3 py-2.5 text-sm font-extrabold text-white transition-colors hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:opacity-60"
              aria-label="Confirm reject order"
            >
              <XCircle size={14} /> Yes, Reject
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex gap-2">
          {deliveryAddress && (
            <a
              href={buildMapsDeepLink(deliveryLat, deliveryLng, deliveryAddress)}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Open delivery address in maps"
              className="flex min-h-[44px] items-center gap-1 rounded-xl border border-blue-500/30 bg-blue-500/10 px-3 text-xs font-bold text-blue-500 transition-colors hover:bg-blue-500/20"
            >
              <MapPin size={14} />
            </a>
          )}
          <button
            onClick={() => setShowRejectConfirm(true)}
            disabled={rejectPending}
            className="flex min-h-[44px] items-center gap-1 rounded-xl border border-error/30 bg-error/5 px-3 text-sm font-bold text-error transition-colors hover:bg-error/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error/30 focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:opacity-60"
            aria-label="Reject order"
          >
            <XCircle size={14} />
          </button>
          <button
            onClick={async () => {
              try {
                await onDismiss(o.id);
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "Failed to dismiss order");
              }
            }}
            className="flex min-h-[44px] items-center rounded-xl border border-border px-3 text-sm font-bold text-muted-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
            aria-label="Dismiss order request"
          >
            <X size={16} />
          </button>
          <button
            onClick={() => onAccept(o.id)}
            disabled={isExpired || acceptPending || anyAcceptPending || isRestricted}
            className="flex min-h-[48px] flex-1 items-center justify-center gap-1.5 rounded-xl bg-brand py-3 text-sm font-extrabold text-white shadow-md shadow-brand/25 transition-all hover:bg-brand-hover hover:shadow-lg active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:opacity-60"
            aria-label="Accept order"
          >
            <CheckCircle size={16} />
            {acceptPending ? T("accepting") : T("acceptOrder")}
          </button>
        </div>
      )}
    </div>
  );
});
