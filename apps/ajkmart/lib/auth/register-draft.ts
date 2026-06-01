/**
 * Registration draft persistence for AJKMart (React Native).
 * Uses AsyncStorage (not localStorage) for cross-platform storage.
 * 
 * Rules:
 *   - Save non-sensitive fields after each step
 *   - Skip: password, confirmPassword, otp, tempToken, authRefreshToken
 *   - 24h TTL — auto-clear expired drafts
 *   - Load draft on mount if available
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

const DRAFT_KEY = "@ajkmart_register_draft";
const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface RegisterDraft {
  step: number;
  phone?: string;
  name?: string;
  email?: string;
  username?: string;
  city?: string;
  area?: string;
  address?: string;
  latitude?: string;
  longitude?: string;
  cnic?: string;
  termsAccepted?: boolean;
  updatedAt: number;
}

export async function saveDraft(draft: Omit<RegisterDraft, "updatedAt">): Promise<void> {
  const payload: RegisterDraft = { ...draft, updatedAt: Date.now() };
  await AsyncStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
}

export async function loadDraft(): Promise<RegisterDraft | null> {
  try {
    const raw = await AsyncStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const draft = JSON.parse(raw) as RegisterDraft;
    if (Date.now() - draft.updatedAt > TTL_MS) {
      await clearDraft();
      return null;
    }
    return draft;
  } catch {
    return null;
  }
}

export async function clearDraft(): Promise<void> {
  await AsyncStorage.removeItem(DRAFT_KEY);
}

export async function hasDraft(): Promise<boolean> {
  const draft = await loadDraft();
  return draft !== null;
}
