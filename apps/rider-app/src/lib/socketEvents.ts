import { z } from "zod";

/* ── Socket event payload schemas (Zod) ──────────────────────────────────────
   Centralised runtime validation for every socket.io event the rider app
   receives that carries a meaningful payload.  Callers should use the
   `parse*` helpers or the raw schemas via `safeParse`.  Events that carry
   no payload (e.g. `rider:new_request`) don't need a schema here. */

export const RiderLocationPayloadSchema = z.object({
  lat: z.number(),
  lng: z.number(),
  userId: z.string().optional(),
  accuracy: z.number().optional(),
  heading: z.number().nullable().optional(),
  speed: z.number().nullable().optional(),
  timestamp: z.string().optional(),
});
export type RiderLocationPayload = z.infer<typeof RiderLocationPayloadSchema>;

export const RideAssignedPayloadSchema = z.object({
  id: z.string(),
  status: z.string(),
  pickupAddress: z.string().optional().nullable(),
  dropAddress: z.string().optional().nullable(),
  fare: z.union([z.string(), z.number()]).optional().nullable(),
  type: z.string().optional().nullable(),
});
export type RideAssignedPayload = z.infer<typeof RideAssignedPayloadSchema>;

export const RideOtpPayloadSchema = z.object({
  rideId: z.string(),
  otp: z.string(),
});
export type RideOtpPayload = z.infer<typeof RideOtpPayloadSchema>;

export const AdminChatPayloadSchema = z.object({
  message: z.string(),
  sentAt: z.string(),
  from: z.literal("admin"),
});
export type AdminChatPayload = z.infer<typeof AdminChatPayloadSchema>;

/* ── Safe parsers ────────────────────────────────────────────────────────────
   Each returns `null` on validation failure instead of throwing, so event
   handlers can skip malformed payloads without crashing the app. */

export function parseRiderLocationPayload(raw: unknown): RiderLocationPayload | null {
  const result = RiderLocationPayloadSchema.safeParse(raw);
  return result.success ? result.data : null;
}

export function parseRideAssignedPayload(raw: unknown): RideAssignedPayload | null {
  const result = RideAssignedPayloadSchema.safeParse(raw);
  return result.success ? result.data : null;
}

export function parseRideOtpPayload(raw: unknown): RideOtpPayload | null {
  const result = RideOtpPayloadSchema.safeParse(raw);
  return result.success ? result.data : null;
}

export function parseAdminChatPayload(raw: unknown): AdminChatPayload | null {
  const result = AdminChatPayloadSchema.safeParse(raw);
  return result.success ? result.data : null;
}

export const RideCancelledPayloadSchema = z.object({
  rideId: z.string().optional(),
  orderId: z.string().optional(),
  id: z.string().optional(),
  reason: z.string().optional().nullable(),
  cancelledBy: z.enum(["customer", "admin", "system"]).optional().nullable(),
});
export type RideCancelledPayload = z.infer<typeof RideCancelledPayloadSchema>;

export function parseRideCancelledPayload(raw: unknown): RideCancelledPayload | null {
  const result = RideCancelledPayloadSchema.safeParse(raw);
  return result.success ? result.data : null;
}

/* ── New-order event (real-time ride/order request pushed to rider) ─────── */
export const NewOrderPayloadSchema = z.object({
  order_id: z.string(),
  pickup: z.string().optional().nullable(),
  drop: z.string().optional().nullable(),
  fare: z.union([z.string(), z.number()]).optional().nullable(),
  timer: z.number().optional().nullable(),
});
export type NewOrderPayload = z.infer<typeof NewOrderPayloadSchema>;

export function parseNewOrderPayload(raw: unknown): NewOrderPayload | null {
  const result = NewOrderPayloadSchema.safeParse(raw);
  return result.success ? result.data : null;
}

/* ── Order cancelled (pending request withdrawn by customer or admin) ───── */
export const OrderCancelledPayloadSchema = z.object({
  order_id: z.string().optional(),
  reason: z.string().optional().nullable(),
});
export type OrderCancelledPayload = z.infer<typeof OrderCancelledPayloadSchema>;

export function parseOrderCancelledPayload(raw: unknown): OrderCancelledPayload | null {
  const result = OrderCancelledPayloadSchema.safeParse(raw);
  return result.success ? result.data : null;
}

/* ── KYC status changed (approval or rejection by admin) ────────────────── */
export const KycStatusChangedPayloadSchema = z.object({
  status: z.enum(["approved", "rejected", "pending", "under_review"]),
  reason: z.string().optional().nullable(),
});
export type KycStatusChangedPayload = z.infer<typeof KycStatusChangedPayloadSchema>;

export function parseKycStatusChangedPayload(raw: unknown): KycStatusChangedPayload | null {
  const result = KycStatusChangedPayloadSchema.safeParse(raw);
  return result.success ? result.data : null;
}

/* ── Rider location ACK (server confirms receipt of a location update) ───── */
export const RiderLocationAckPayloadSchema = z.object({
  order_id: z.string().optional().nullable(),
});
export type RiderLocationAckPayload = z.infer<typeof RiderLocationAckPayloadSchema>;

export function parseRiderLocationAckPayload(raw: unknown): RiderLocationAckPayload | null {
  const result = RiderLocationAckPayloadSchema.safeParse(raw);
  return result.success ? result.data : null;
}

/* ── Order/ride accepted by another rider (card should be removed) ──────── */
export const OrderAcceptedPayloadSchema = z.object({
  order_id: z.string().optional(),
  ride_id: z.string().optional(),
  id: z.string().optional(),
});
export type OrderAcceptedPayload = z.infer<typeof OrderAcceptedPayloadSchema>;

export function parseOrderAcceptedPayload(raw: unknown): OrderAcceptedPayload | null {
  const result = OrderAcceptedPayloadSchema.safeParse(raw);
  return result.success ? result.data : null;
}

/* ── Counter offer result (customer responded to rider's counter) ─────────── */
export const CounterResultPayloadSchema = z.object({
  ride_id: z.string().optional(),
  order_id: z.string().optional(),
  id: z.string().optional(),
  fare: z.union([z.string(), z.number()]).optional().nullable(),
});
export type CounterResultPayload = z.infer<typeof CounterResultPayloadSchema>;

export function parseCounterResultPayload(raw: unknown): CounterResultPayload | null {
  const result = CounterResultPayloadSchema.safeParse(raw);
  return result.success ? result.data : null;
}

/* ── Outgoing: rider:online (emitted immediately after connect) ──────────── */
export const RiderOnlinePayloadSchema = z.object({
  riderId: z.string(),
});
export type RiderOnlinePayload = z.infer<typeof RiderOnlinePayloadSchema>;

/* ── Outgoing: rider:location_update (emitted on fresh GPS movement) ──────── */
export const RiderLocationUpdatePayloadSchema = z.object({
  lat: z.number(),
  lng: z.number(),
  ts: z.string(),
});
export type RiderLocationUpdatePayload = z.infer<typeof RiderLocationUpdatePayloadSchema>;

/* ── Incoming: ride:otp_verified (customer OTP verified, advance stepper) ─── */
export const RideOtpVerifiedPayloadSchema = z.object({
  rideId: z.string(),
});
export type RideOtpVerifiedPayload = z.infer<typeof RideOtpVerifiedPayloadSchema>;

export function parseRideOtpVerifiedPayload(raw: unknown): RideOtpVerifiedPayload | null {
  const result = RideOtpVerifiedPayloadSchema.safeParse(raw);
  return result.success ? result.data : null;
}

/* ── Incoming: rider:approval_update (admin approved or rejected the application) ─── */
export const RiderApprovalUpdatePayloadSchema = z.object({
  status: z.enum(["approved", "rejected"]),
  reason: z.string().optional().nullable(),
  message: z.string().optional().nullable(),
});
export type RiderApprovalUpdatePayload = z.infer<typeof RiderApprovalUpdatePayloadSchema>;

export function parseRiderApprovalUpdatePayload(raw: unknown): RiderApprovalUpdatePayload | null {
  const result = RiderApprovalUpdatePayloadSchema.safeParse(raw);
  return result.success ? result.data : null;
}
