/*── Shared Order Types for Admin /orders page ──*/

/** Enriched admin order shape returned by /api/admin/orders-enriched */
export interface AdminOrder {
  id: string;
  userId: string;
  vendorId?: string | null;
  assignedRiderId?: string | null;
  riderId?: string | null;
  type: string;
  status: string;
  total: string | number;
  deliveryAddress?: string | null;
  customerLat?: number | null;
  customerLng?: number | null;
  paymentMethod: string;
  estimatedTime?: string | null;
  createdAt: string;
  updatedAt?: string;
  userName?: string | null;
  userPhone?: string | null;
  vendorName?: string | null;
  riderName?: string | null;
  items: AdminOrderItem[];
  /* optional extras */
  trackingStatus?: string;
  otpVerified?: boolean;
  disputeCount?: number;
  isParcel?: boolean;
  deliveredAt?: string | null;
  cancelledAt?: string | null;
  deliveryLat?: number | null;
  deliveryLng?: number | null;
  gpsMismatch?: boolean;
  gpsAccuracy?: number | null;
  riderPhone?: string | null;
  proofPhotoUrl?: string | null;
  txnRef?: string | null;
  refundedAt?: string | null;
  refundedAmount?: number | null;
}

export interface AdminOrderItem {
  productId?: string;
  name?: string;
  productName?: string;
  price?: string | number;
  qty?: number;
  quantity?: number;
  image?: string;
}

/** Minimal rider shape used in admin rider assignment */
export interface AdminRider {
  id: string;
  name: string;
  phone?: string;
  isActive?: boolean;
  isBanned?: boolean;
  vehicleType?: string;
  vehiclePlate?: string;
  lat?: number;
  lng?: number;
}

/** Return request record */
export interface ReturnRequest {
  id: string;
  reason: string;
  amount: number;
  refundAmount?: number;
  status: string;
  createdAt: string;
  updatedAt?: string;
}

/** Dispute record */
export interface DisputeRecord {
  id: string;
  reason: string;
  type?: string;
  note?: string;
  details?: string;
  status: string;
  createdAt: string;
  updatedAt?: string;
  resolution?: string;
}
