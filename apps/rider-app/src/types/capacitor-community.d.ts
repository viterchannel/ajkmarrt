/**
 * Ambient type declarations for Capacitor community plugins that lack
 * published TypeScript definitions.
 *
 * These stubs allow the TypeScript compiler to resolve dynamic imports
 * without unsafe `as any` casts, while keeping the runtime behaviour
 * unchanged.
 */

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
