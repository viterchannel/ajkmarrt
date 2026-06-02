/**
 * Ambient type declarations for Capacitor community plugins that lack
 * published TypeScript definitions.
 *
 * These stubs allow the TypeScript compiler to resolve dynamic imports
 * without unsafe `as any` casts, while keeping the runtime behaviour
 * unchanged.
 */

/* ── Capacitor global type ── */
interface CapacitorGlobal {
  ready?: boolean;
  Preferences?: {
    set(options: { key: string; value: string }): Promise<void>;
    get(options: { key: string }): Promise<{ value: string | null }>;
    remove(options: { key: string }): Promise<void>;
    keys(): Promise<{ keys: string[] }>;
    clear(): Promise<void>;
  };
  getPlatform(): "ios" | "android" | "web";
}

declare global {
  interface Window {
    Capacitor?: CapacitorGlobal;
  }
}

/* ── Battery Status API ── */
interface BatteryManager {
  level: number;
  charging: boolean;
  chargingTime: number;
  dischargingTime: number;
  addEventListener(type: string, listener: EventListener): void;
  removeEventListener(type: string, listener: EventListener): void;
}

interface NavigatorWithBattery extends Navigator {
  getBattery(): Promise<BatteryManager>;
}

interface NavigatorWithWakeLock extends Navigator {
  wakeLock?: {
    request(type: "screen" | "system"): Promise<{ release(): Promise<void> }>;
  };
}

declare global {
  interface Navigator extends NavigatorWithBattery, NavigatorWithWakeLock {}
}

/* ── MediaQueryList compatibility (for older browsers) ── */
interface MediaQueryListPolyfill {
  addListener?(callback: (mql: MediaQueryListEvent) => void): void;
  removeListener?(callback: (mql: MediaQueryListEvent) => void): void;
}

declare module "@capacitor-community/play-integrity" {
  export interface PlayIntegrity {
    requestIntegrityToken(options: { nonce: string }): Promise<{ token: string }>;
  }
  export const PlayIntegrity: PlayIntegrity;
}

declare module "@capacitor-community/app-attest" {
  export interface AppAttest {
    generateKey(): Promise<string>;
    attestKey(options: { keyId: string; challenge: string }): Promise<{ attestation: string }>;
  }
  export const AppAttest: AppAttest;
}
