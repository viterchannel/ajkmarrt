import type { AdminChatMessage } from "./socket";

const ADMIN_CHAT_MESSAGES_KEY = "ajkmart:admin_chat_messages";
const ADMIN_CHAT_UNREAD_KEY = "ajkmart:admin_chat_unread";
const ADMIN_CHAT_RIDER_MESSAGES_KEY = "ajkmart:admin_chat_rider_messages";
const MAX_MESSAGES = 100;

export function loadAdminChatMessages(): AdminChatMessage[] {
  try {
    const raw = localStorage.getItem(ADMIN_CHAT_MESSAGES_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as AdminChatMessage[]) : [];
  } catch {
    return [];
  }
}

export function persistAdminChatMessages(messages: AdminChatMessage[]): void {
  try {
    const capped = messages.length > MAX_MESSAGES ? messages.slice(-MAX_MESSAGES) : messages;
    localStorage.setItem(ADMIN_CHAT_MESSAGES_KEY, JSON.stringify(capped));
  } catch {
  }
}

export function loadAdminChatUnread(): number {
  try {
    const raw = localStorage.getItem(ADMIN_CHAT_UNREAD_KEY);
    if (raw === null) return 0;
    const n = parseInt(raw, 10);
    return isNaN(n) || n < 0 ? 0 : n;
  } catch {
    return 0;
  }
}

export function persistAdminChatUnread(count: number): void {
  try {
    localStorage.setItem(ADMIN_CHAT_UNREAD_KEY, String(count));
  } catch {
  }
}

export interface PersistedRiderMessage {
  id: string;
  content: string;
  senderId: string;
  messageType: string;
  createdAt: string;
  deliveryStatus: string;
}

export function loadAdminChatRiderMessages(): PersistedRiderMessage[] {
  try {
    const raw = localStorage.getItem(ADMIN_CHAT_RIDER_MESSAGES_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as PersistedRiderMessage[]) : [];
  } catch {
    return [];
  }
}

export function persistAdminChatRiderMessages(messages: PersistedRiderMessage[]): void {
  try {
    const capped = messages.length > MAX_MESSAGES ? messages.slice(-MAX_MESSAGES) : messages;
    localStorage.setItem(ADMIN_CHAT_RIDER_MESSAGES_KEY, JSON.stringify(capped));
  } catch {
  }
}
