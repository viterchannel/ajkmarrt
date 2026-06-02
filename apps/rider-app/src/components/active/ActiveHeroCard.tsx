import { MapPin, Phone, ShoppingCart, User } from "lucide-react";
import { haversineDistance, ElapsedBadge, formatCurrency } from "./ActiveHelpers";
import { CallButton } from "./ActiveHelpers";

function DistanceStrip({
  riderPos,
  destLat,
  destLng,
}: {
  riderPos: { lat: number; lng: number } | null;
  destLat?: number | null;
  destLng?: number | null;
}) {
  if (!riderPos || destLat == null || destLng == null) return null;
  if (!Number.isFinite(destLat) || !Number.isFinite(destLng)) return null;
  const km = haversineDistance(riderPos.lat, riderPos.lng, destLat, destLng);
  const minutes = Math.round((km / 25) * 60);
  const distLabel = km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
  return (
    <div className="flex items-center gap-2 rounded-xl border border-success/20 bg-success/10 px-3 py-2">
      <MapPin size={12} className="flex-shrink-0 text-success" />
      <p className="text-xs font-bold text-success">
        📍 {distLabel} · ~{minutes} min
      </p>
    </div>
  );
}

export interface ActiveHeroCardProps {
  kind: "order" | "ride";
  order?: Record<string, unknown>;
  ride?: Record<string, unknown>;
  orderStep?: number;
  rideStep?: number;
  riderPos: { lat: number; lng: number } | null;
  currency: string;
  startedAt?: string | null;
}

export function ActiveHeroCard({
  kind,
  order,
  ride,
  orderStep = 0,
  rideStep = 0,
  riderPos,
  currency,
  startedAt,
}: ActiveHeroCardProps) {
  if (kind === "order" && order) {
    const deliveryFee = order.deliveryFee as number | undefined;
    const destLat =
      orderStep === 0
        ? (order.vendorLat as number | null | undefined)
        : (order.deliveryLat as number | null | undefined);
    const destLng =
      orderStep === 0
        ? (order.vendorLng as number | null | undefined)
        : (order.deliveryLng as number | null | undefined);

    return (
      <div className="rounded-2xl border border-border/80 bg-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ElapsedBadge startIso={startedAt} />
          </div>
          {deliveryFee != null && (
            <span className="rounded-full border border-brand/30 bg-brand/15 px-2.5 py-1 text-xs font-bold text-brand">
              {formatCurrency(deliveryFee, currency)}
            </span>
          )}
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border border-warning/30 bg-warning/10">
              <ShoppingCart size={18} className="text-warning" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold tracking-wider text-warning/80 uppercase">
                Store
              </p>
              <p className="truncate text-sm font-black text-foreground">
                {(order.vendorStoreName as string) || "Store"}
              </p>
              {!!order.vendorAddress && (
                <p className="truncate text-[11px] text-muted-foreground">
                  {order.vendorAddress as string}
                </p>
              )}
            </div>
            {!!order.vendorPhone && (
              <CallButton
                phone={order.vendorPhone as string}
                label=""
                name={(order.vendorStoreName as string) || "Store"}
              />
            )}
          </div>

          <div className="h-px bg-border/30" />

          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border border-blue-500/30 bg-blue-500/10">
              <User size={18} className="text-blue-400" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold tracking-wider text-blue-400/80 uppercase">
                Customer
              </p>
              <p className="truncate text-sm font-black text-foreground">
                {(order.customerName as string) || "Customer"}
              </p>
              {!!order.deliveryAddress && (
                <p className="truncate text-[11px] text-muted-foreground">
                  {order.deliveryAddress as string}
                </p>
              )}
            </div>
            {!!order.customerPhone && (
              <CallButton
                phone={order.customerPhone as string}
                label=""
                name={(order.customerName as string) || "Customer"}
              />
            )}
          </div>
        </div>

        <div className="mt-3">
          <DistanceStrip riderPos={riderPos} destLat={destLat} destLng={destLng} />
        </div>
      </div>
    );
  }

  if (kind === "ride" && ride) {
    const fare = ride.fare as number | null | undefined;
    const destLat =
      rideStep >= 2
        ? (ride.dropLat as number | null | undefined)
        : (ride.pickupLat as number | null | undefined);
    const destLng =
      rideStep >= 2
        ? (ride.dropLng as number | null | undefined)
        : (ride.pickupLng as number | null | undefined);

    return (
      <div className="rounded-2xl border border-border/80 bg-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ElapsedBadge startIso={startedAt} />
          </div>
          {fare != null && (
            <span className="rounded-full border border-brand/30 bg-brand/15 px-2.5 py-1 text-xs font-bold text-brand">
              {formatCurrency(fare, currency)}
            </span>
          )}
        </div>

        {!!ride.customerName && (
          <p className="mb-3 text-center text-base font-black text-foreground">
            {ride.customerName as string}
          </p>
        )}

        <div className="space-y-2">
          <div className="flex items-center gap-2 rounded-xl border border-success/20 bg-success/10 px-3 py-2.5">
            <MapPin size={14} className="flex-shrink-0 text-success" />
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold text-success/70 uppercase">Pickup</p>
              <p className="truncate text-xs font-bold text-foreground">
                {(ride.pickupAddress as string) || "Pickup location"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-xl border border-error/20 bg-error/10 px-3 py-2.5">
            <MapPin size={14} className="flex-shrink-0 text-error" />
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold text-error/70 uppercase">Drop-off</p>
              <p className="truncate text-xs font-bold text-foreground">
                {(ride.dropAddress as string) || "Drop-off location"}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-3">
          <DistanceStrip riderPos={riderPos} destLat={destLat} destLng={destLng} />
        </div>
      </div>
    );
  }

  return null;
}
