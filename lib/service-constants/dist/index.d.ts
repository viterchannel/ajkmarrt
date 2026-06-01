export type ServiceKey = "mart" | "food" | "rides" | "pharmacy" | "parcel" | "van" | "school";
/**
 * Canonical list of Pakistani cities used across customer and rider registration forms.
 * AJK cities are listed first as the platform's primary region; major cities follow.
 * Single source of truth — import from here instead of hardcoding in each UI.
 */
export declare const PAKISTAN_CITIES: readonly string[];
/**
 * Normalises a raw vehicle-type string to a canonical value used across the
 * API server and rider app. Centralised here so both callers share a single
 * source of truth.
 */
export declare function normalizeVehicleType(raw: string | null | undefined): string;
export declare const SERVICE_KEYS: ServiceKey[];
export interface ServiceMetadata {
    key: ServiceKey;
    featureFlag: string;
    label: string;
    description: string;
    adminIcon: string;
    color: string;
    colorLight: string;
}
export declare const SERVICE_METADATA: Record<ServiceKey, ServiceMetadata>;
export declare const ADMIN_SERVICE_LIST: {
    key: ServiceKey;
    label: string;
    description: string;
    icon: string;
    setting: string;
    color: string;
    colorLight: string;
}[];
/**
 * Returns the socket.io room name for an order.
 * Ride and parcel orders join `ride:{id}`; all other services join `order:{id}`.
 * Used by both the API server (emit targets) and the frontend (subscribe room).
 */
export declare function getSocketRoom(orderId: string, orderType: string): string;
export declare const ORDER_VALID_STATUSES: readonly ["pending", "confirmed", "preparing", "ready", "picked_up", "out_for_delivery", "delivered", "cancelled"];
export type OrderStatus = (typeof ORDER_VALID_STATUSES)[number];
export declare const RIDE_VALID_STATUSES: readonly ["searching", "bargaining", "accepted", "arrived", "in_transit", "ongoing", "completed", "cancelled"];
export type RideStatus = (typeof RIDE_VALID_STATUSES)[number];
export declare const PARCEL_VALID_STATUSES: readonly ["pending", "accepted", "in_transit", "completed", "cancelled"];
export type ParcelStatus = (typeof PARCEL_VALID_STATUSES)[number];
export declare const PHARMACY_ORDER_VALID_STATUSES: readonly ["pending", "confirmed", "preparing", "ready", "picked_up", "out_for_delivery", "delivered", "cancelled"];
export type PharmacyOrderStatus = (typeof PHARMACY_ORDER_VALID_STATUSES)[number];
//# sourceMappingURL=index.d.ts.map