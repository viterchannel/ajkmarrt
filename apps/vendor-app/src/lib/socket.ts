import { createLogger } from "@/lib/logger";
import { io, type Socket } from "socket.io-client";
import { api } from "./api";
import { markOrderSeen, wasOrderSeenRecently } from "./notificationSound";
const log = createLogger("[vendor-socket]");

export interface VendorNewOrderEvent {
  id: string;
  type?: string;
  total?: number;
  items?: unknown[];
  deliveryAddress?: string;
  paymentMethod?: string;
  [key: string]: unknown;
}

export interface RiderLocationPayload {
  userId: string;
  latitude: number;
  longitude: number;
  updatedAt: string;
}

export interface NotificationPayload {
  id: string;
  title: string;
  body: string;
  type: string;
  icon?: string;
  isRead?: boolean;
  createdAt: string;
  [key: string]: unknown;
}

type NewOrderHandler = (order: VendorNewOrderEvent) => void;
type OrderUpdateHandler = (order: Record<string, unknown>) => void;
type RiderLocationHandler = (payload: RiderLocationPayload) => void;
type NotificationHandler = (notif: NotificationPayload) => void;
type ConnectHandler = () => void;
type DisconnectHandler = () => void;

let _socket: Socket | null = null;
const _newOrderHandlers = new Set<NewOrderHandler>();
const _orderUpdateHandlers = new Set<OrderUpdateHandler>();
const _riderLocationHandlers = new Set<RiderLocationHandler>();
const _notificationHandlers = new Set<NotificationHandler>();
const _connectHandlers = new Set<ConnectHandler>();
const _disconnectHandlers = new Set<DisconnectHandler>();
let _currentVendorId: string | null = null;

function resolveSocketUrl(): string {
  const isCapacitor = (import.meta.env.VITE_CAPACITOR as string) === "true";
  if (isCapacitor) {
    const base = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/+$/, "");
    return base ?? "";
  }
  return window.location.origin;
}

function safeCall<T extends unknown[]>(handlers: Set<(...args: T) => void>, ...args: T): void {
  handlers.forEach((fn) => {
    try {
      fn(...args);
    } catch (err) {
      console.warn("[vendor-socket] handler error:", err); // eslint-disable-line no-console
    }
  });
}

export function connectVendorSocket(vendorId: string): void {
  if (_socket?.connected && _currentVendorId === vendorId) return;
  disconnectVendorSocket();

  const token = api.getToken();
  if (!token || !vendorId) return;

  _currentVendorId = vendorId;

  _socket = io(resolveSocketUrl(), {
    path: "/api/socket.io",
    auth: { token },
    query: { rooms: `vendor:${vendorId}` },
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000,
    reconnectionAttempts: Infinity,
  });

  _socket.on("connect", () => {
    log.debug("connected, joined vendor:", vendorId);
    _socket?.emit("join", `vendor:${vendorId}`);
    safeCall(_connectHandlers);
  });

  _socket.io.on("reconnect", () => {
    _socket?.emit("join", `vendor:${vendorId}`);
    safeCall(_connectHandlers);
  });

  _socket.on("disconnect", (reason) => {
    log.debug("disconnected:", reason);
    safeCall(_disconnectHandlers);
  });

  _socket.on("order:new", (order: VendorNewOrderEvent) => {
    const orderId = String(order?.id ?? "");
    if (orderId && wasOrderSeenRecently(orderId)) return;
    if (orderId) markOrderSeen(orderId);
    safeCall(_newOrderHandlers, order);
  });

  _socket.on("order:update", (order: Record<string, unknown>) => {
    safeCall(_orderUpdateHandlers, order);
  });

  _socket.on("rider:location", (payload: RiderLocationPayload) => {
    safeCall(_riderLocationHandlers, payload);
  });

  _socket.on("notification:new", (notif: NotificationPayload) => {
    safeCall(_notificationHandlers, notif);
  });

  _socket.on("theme-updated", (payload: { appRole: string; theme: string; colors?: Record<string, string> }) => {
    window.dispatchEvent(new CustomEvent("ajk:theme-updated", { detail: payload }));
  });

  _socket.on("connect_error", (err) => {
    log.warn("connect_error:", err.message);
  });
}

export function disconnectVendorSocket(): void {
  if (_socket) {
    _socket.io.off("reconnect");
    _socket.disconnect();
    _socket = null;
  }
  _currentVendorId = null;
}

export function isSocketConnected(): boolean {
  return _socket?.connected ?? false;
}

export function onNewOrder(fn: NewOrderHandler): () => void {
  _newOrderHandlers.add(fn);
  return () => {
    _newOrderHandlers.delete(fn);
  };
}

export function onOrderUpdate(fn: OrderUpdateHandler): () => void {
  _orderUpdateHandlers.add(fn);
  return () => {
    _orderUpdateHandlers.delete(fn);
  };
}

export function onRiderLocation(fn: RiderLocationHandler): () => void {
  _riderLocationHandlers.add(fn);
  return () => {
    _riderLocationHandlers.delete(fn);
  };
}

export function onConnect(fn: ConnectHandler): () => void {
  _connectHandlers.add(fn);
  return () => {
    _connectHandlers.delete(fn);
  };
}

export function onDisconnect(fn: DisconnectHandler): () => void {
  _disconnectHandlers.add(fn);
  return () => {
    _disconnectHandlers.delete(fn);
  };
}

export function onNotification(fn: NotificationHandler): () => void {
  _notificationHandlers.add(fn);
  return () => {
    _notificationHandlers.delete(fn);
  };
}
